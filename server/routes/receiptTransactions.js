const express = require('express');
const router = express.Router();
require('../config/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');
const { verifyToken, requireRole } = require('../middleware/auth');
const { resolveRestaurantId } = require('../services/resolveRestaurantId');
const logger = require('../utils/logger');

// Owner / accounts-manager only (same as the rest of Financials).
router.use(verifyToken, requireRole(['owner', 'accountsManager']));

/**
 * Normalize a receipt's date to an ISO YYYY-MM-DD string when possible.
 * The AI may return "MM/DD/YYYY", "YYYY-MM-DD", or null. Falls back to the
 * scannedAt timestamp so every transaction can still be bucketed by month.
 */
function normalizeDate(t) {
    const raw = t.date || t.scannedAt;
    if (!raw) return null;
    // Already ISO-ish?
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw));
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // MM/DD/YYYY or M/D/YYYY
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(raw));
    if (us) {
        const mm = String(us[1]).padStart(2, '0');
        const dd = String(us[2]).padStart(2, '0');
        return `${us[3]}-${mm}-${dd}`;
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
}

function monthOf(t) {
    const d = normalizeDate(t);
    return d ? d.slice(0, 7) : null; // YYYY-MM
}

// Load all receipt transactions for a location (with a normalized date/month).
async function loadAll(location) {
    const rid = await resolveRestaurantId(location);
    const db = getFirestore();
    const snap = await db.collection('restaurants').doc(rid)
        .collection('receiptTransactions').get();
    return snap.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, normDate: normalizeDate(data), month: monthOf(data) };
    });
}

/**
 * GET /api/receipt-transactions?location=..&month=YYYY-MM&vendor=..&item=..
 * Returns filtered transactions (most recent first).
 */
router.get('/', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const month = (req.query.month || '').trim();
        const vendor = (req.query.vendor || '').trim().toLowerCase();
        const item = (req.query.item || '').trim().toLowerCase();

        let list = await loadAll(location);
        if (month) list = list.filter((t) => t.month === month);
        if (vendor) list = list.filter((t) => (t.vendor || '').toLowerCase().includes(vendor));
        if (item) {
            list = list.filter((t) => (t.lineItems || []).some(
                (li) => (li.description || '').toLowerCase().includes(item)
            ));
        }
        list.sort((a, b) => String(b.normDate || '').localeCompare(String(a.normDate || '')));
        res.json(list);
    } catch (error) {
        logger.error(`[ReceiptTxns] list failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to load receipt transactions' });
    }
});

/** GET /api/receipt-transactions/filters?location=.. -> { vendors:[], items:[], months:[] } */
router.get('/filters', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const list = await loadAll(location);
        const vendors = new Set();
        const items = new Set();
        const months = new Set();
        for (const t of list) {
            if (t.vendor) vendors.add(t.vendor);
            if (t.month) months.add(t.month);
            for (const li of (t.lineItems || [])) {
                if (li.description) items.add(li.description);
            }
        }
        res.json({
            vendors: [...vendors].sort(),
            items: [...items].sort(),
            months: [...months].sort().reverse(),
        });
    } catch (error) {
        logger.error(`[ReceiptTxns] filters failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to load filters' });
    }
});

/**
 * GET /api/receipt-transactions/item-price-history?location=..&item=..
 * Returns the unit-price history for an item across all receipts so the client
 * can chart price fluctuation over time.
 *   { item, points: [{ date, unitPrice, vendor, quantity, amount, txnId }], stats: {...} }
 * unitPrice is used when present, otherwise derived as amount / quantity.
 */
router.get('/item-price-history', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const item = (req.query.item || '').trim();
        if (!location || !item) return res.status(400).json({ error: 'location and item are required' });

        const list = await loadAll(location);
        const target = item.toLowerCase();
        const points = [];
        for (const t of list) {
            for (const li of (t.lineItems || [])) {
                if ((li.description || '').toLowerCase() !== target) continue;
                const qty = Number(li.quantity);
                const amount = Number(li.amount);
                let unit = Number(li.unitPrice);
                if (!(unit > 0)) {
                    unit = qty > 0 && amount > 0 ? amount / qty : (amount > 0 ? amount : null);
                }
                if (unit === null || Number.isNaN(unit)) continue;
                points.push({
                    date: t.normDate,
                    unitPrice: Math.round(unit * 100) / 100,
                    vendor: t.vendor || null,
                    quantity: Number.isNaN(qty) ? null : qty,
                    amount: Number.isNaN(amount) ? null : amount,
                    txnId: t.id,
                });
            }
        }
        points.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

        const prices = points.map((p) => p.unitPrice).filter((n) => n > 0);
        const stats = prices.length ? {
            count: prices.length,
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg: Math.round((prices.reduce((s, n) => s + n, 0) / prices.length) * 100) / 100,
            first: prices[0],
            last: prices[prices.length - 1],
            changePct: prices[0] ? Math.round(((prices[prices.length - 1] - prices[0]) / prices[0]) * 10000) / 100 : 0,
        } : { count: 0 };

        res.json({ item, points, stats });
    } catch (error) {
        logger.error(`[ReceiptTxns] price-history failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to build price history' });
    }
});

/**
 * PUT /api/receipt-transactions/:id  body: { location, ...fieldsToUpdate }
 * Review/correct a scanned transaction (vendor, date, totals, lineItems, status).
 */
router.put('/:id', async (req, res) => {
    try {
        const location = (req.body.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const rid = await resolveRestaurantId(location);
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(rid)
            .collection('receiptTransactions').doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Transaction not found' });

        // Only allow known, editable fields.
        const b = req.body;
        const update = {};
        if (b.vendor !== undefined) update.vendor = String(b.vendor || '') || null;
        if (b.date !== undefined) update.date = String(b.date || '') || null;
        if (b.currency !== undefined) update.currency = String(b.currency || '') || null;
        if (b.subtotal !== undefined) update.subtotal = b.subtotal === null ? null : Number(b.subtotal);
        if (b.tax !== undefined) update.tax = b.tax === null ? null : Number(b.tax);
        if (b.total !== undefined) update.total = b.total === null ? null : Number(b.total);
        if (b.paymentMethod !== undefined) update.paymentMethod = String(b.paymentMethod || '') || null;
        if (Array.isArray(b.lineItems)) {
            update.lineItems = b.lineItems.map((li) => ({
                description: String(li.description || ''),
                quantity: li.quantity === null || li.quantity === '' ? null : Number(li.quantity),
                unitPrice: li.unitPrice === null || li.unitPrice === '' ? null : Number(li.unitPrice),
                amount: li.amount === null || li.amount === '' ? null : Number(li.amount),
            }));
        }
        if (b.status !== undefined) update.status = String(b.status || 'scanned');
        update.updatedAt = new Date().toISOString();
        update.updatedBy = req.user?.email || req.user?.uid || 'unknown';

        await ref.update(update);
        const fresh = await ref.get();
        res.json({ success: true, transaction: { id: fresh.id, ...fresh.data() } });
    } catch (error) {
        logger.error(`[ReceiptTxns] update failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to update transaction' });
    }
});

module.exports = router;
