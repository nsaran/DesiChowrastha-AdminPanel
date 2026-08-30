const express = require('express');
const multer = require('multer');
const router = express.Router();
require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { parseBankCsv } = require('../services/bankStatements/csvParser');
const { categorizeTransactions, summarize, CATEGORIES } = require('../services/bankStatements/categorizer');

// Bank statement import/review is owner-only (financial data).
router.use(verifyToken, requireRole(['owner']));

// In-memory upload (CSV files are small).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Resolve the Firestore document id for a location, trying common casings.
 * Returns the id string (defaults to Title-case if none has data yet).
 */
function restaurantDocId(location) {
    if (!location) return location;
    return location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
}

/**
 * GET /api/bank-transactions/categories
 * Returns the canonical category list (for the review UI dropdown).
 */
router.get('/categories', (req, res) => {
    res.json({ categories: CATEGORIES });
});

/**
 * POST /api/bank-transactions/import
 * multipart/form-data: file=<csv>, location=<Nashua|Westborough>, month=<YYYY-MM optional>
 *
 * Parses the BofA CSV, categorizes it, stores under
 * restaurants/{location}/bankTransactions/{month}, and returns the result.
 */
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        const location = (req.body.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

        const csvText = req.file.buffer.toString('utf8');
        const parsed = parseBankCsv(csvText);
        if (parsed.length === 0) {
            return res.status(400).json({ error: 'No transactions found in the CSV. Check the file format.' });
        }

        // Determine the month key: explicit param, else from the first transaction date.
        let month = (req.body.month || '').trim();
        if (!month) {
            const firstDate = parsed.find((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date));
            month = firstDate ? firstDate.date.slice(0, 7) : new Date().toISOString().slice(0, 7);
        }

        const categorized = await categorizeTransactions(parsed);
        const summary = summarize(categorized);

        // Persist to Firestore.
        const docId = restaurantDocId(location);
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId)
            .collection('bankTransactions').doc(month);

        await ref.set({
            location: docId,
            month,
            transactions: categorized.map((t, i) => ({ id: `${month}-${i}`, ...t })),
            summary,
            importedAt: new Date().toISOString(),
            importedBy: req.user?.email || req.user?.uid || 'unknown',
            count: categorized.length,
        });

        logger.info(`[BankTxns] Imported ${categorized.length} txns for ${docId} ${month} by ${req.user?.email || req.user?.uid}`);

        res.json({ success: true, location: docId, month, count: categorized.length, summary, transactions: categorized });
    } catch (error) {
        logger.error(`[BankTxns] import failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Import failed' });
    }
});

/**
 * GET /api/bank-transactions?location=<..>&month=<YYYY-MM>
 * Returns the stored, categorized transactions + summary for a month.
 */
router.get('/', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const month = (req.query.month || '').trim();
        if (!location || !month) return res.status(400).json({ error: 'location and month are required' });

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(docId)
            .collection('bankTransactions').doc(month).get();

        if (!snap.exists) return res.json({ location: docId, month, transactions: [], summary: [], count: 0 });
        res.json(snap.data());
    } catch (error) {
        logger.error(`[BankTxns] get failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to load transactions' });
    }
});

/**
 * GET /api/bank-transactions/months?location=<..>
 * Lists available month keys for a location (most recent first).
 */
router.get('/months', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(docId)
            .collection('bankTransactions').get();

        const months = snap.docs.map((d) => d.id).sort().reverse();
        res.json({ location: docId, months });
    } catch (error) {
        logger.error(`[BankTxns] months failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to list months' });
    }
});

/**
 * PUT /api/bank-transactions/:month/category
 * Body: { location, transactionId, category }
 * Re-categorize a single stored transaction (manual override from the review UI).
 */
router.put('/:month/category', async (req, res) => {
    try {
        const month = req.params.month;
        const { location, transactionId, category } = req.body;
        if (!location || !transactionId || !category) {
            return res.status(400).json({ error: 'location, transactionId, and category are required' });
        }
        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({ error: `Invalid category. Must be one of: ${CATEGORIES.join(', ')}` });
        }

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId)
            .collection('bankTransactions').doc(month);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Month not found' });

        const data = snap.data();
        const transactions = (data.transactions || []).map((t) =>
            t.id === transactionId ? { ...t, category, categorySource: 'manual' } : t
        );
        const summary = summarize(transactions);

        await ref.update({ transactions, summary });
        res.json({ success: true, summary });
    } catch (error) {
        logger.error(`[BankTxns] recategorize failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to update category' });
    }
});

module.exports = router;
