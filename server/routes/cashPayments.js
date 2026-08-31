const express = require('express');
const router = express.Router();
require('../config/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { syncOtherCashToMonthlyReport } = require('../services/otherCashSync');
const { resolveRestaurantId } = require('../services/resolveRestaurantId');

// Owner / accounts-manager only.
router.use(verifyToken, requireRole(['owner', 'accountsManager']));

/** GET /api/cash-payments?location=..&month=YYYY-MM -> { month, items: [] } */
router.get('/', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const month = (req.query.month || '').trim();
        if (!location || !month) return res.status(400).json({ error: 'location and month are required' });
        const db = getFirestore();
        const rid = await resolveRestaurantId(location);
        const snap = await db.collection('restaurants').doc(rid)
            .collection('cashPayments').doc(month).get();
        res.json(snap.exists ? snap.data() : { month, items: [] });
    } catch (error) {
        logger.error(`[CashPayments] get failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to load cash payments' });
    }
});

/**
 * PUT /api/cash-payments  body: { location, month, items:[{id,date,description,amount,note}] }
 * Batch-saves the whole month at once (single write). Then syncs the Monthly
 * Report "Cash Payment - Others" row.
 */
router.put('/', async (req, res) => {
    try {
        const location = (req.body.location || '').trim();
        const month = (req.body.month || '').trim();
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (!location || !month) return res.status(400).json({ error: 'location and month are required' });
        if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

        const clean = items.map((it, i) => ({
            id: it.id || `${month}-${i}-${Date.now()}`,
            date: String(it.date || ''),
            description: String(it.description || ''),
            amount: Number(it.amount) || 0,
            note: String(it.note || ''),
        }));

        const db = getFirestore();
        const rid = await resolveRestaurantId(location);
        await db.collection('restaurants').doc(rid)
            .collection('cashPayments').doc(month)
            .set({
                month,
                items: clean,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user?.email || req.user?.uid || 'unknown',
            });

        // Sync using the SAME resolved restaurant id so save + sync target one doc.
        const synced = await syncOtherCashToMonthlyReport(rid, month);
        res.json({ success: true, monthlyReportSynced: synced });
    } catch (error) {
        logger.error(`[CashPayments] save failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to save cash payments' });
    }
});

module.exports = router;
