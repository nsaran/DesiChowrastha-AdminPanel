const express = require('express');
const multer = require('multer');
const router = express.Router();
require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { parseBankCsv } = require('../services/bankStatements/csvParser');
const { categorizeTransactions, summarize, CATEGORIES } = require('../services/bankStatements/categorizer');

// Bank statement import/review is restricted to owners and accounts managers.
router.use(verifyToken, requireRole(['owner', 'accountsManager']));

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
 * Build the 5 standard manual-entry rows appended to every imported month.
 * Amount is left blank (adjustAmount '') for the user to fill in later.
 * Dated the last day of the given month (YYYY-MM).
 */
function buildStandardRows(month) {
    // Last day of the month for a "YYYY-MM" key.
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
    const date = `${month}-${String(lastDay).padStart(2, '0')}`;

    const defs = [
        { description: 'Cash Payment - Employees', category: 'Wages (Direct/Zelle)' },
        { description: 'Cash Payment - Others', category: 'Cash Paid' },
        { description: 'Catering Order - Payment', category: 'Catering Order' },
        { description: 'Toast Loan Payoff', category: 'Sales/Deposits' },
        { description: 'Toast Cash Income', category: 'Sales/Deposits' },
    ];

    return defs.map((d) => ({
        date,
        description: d.description,
        amount: 0,           // no parsed amount
        adjustAmount: '',    // blank for the user to fill
        type: 'debit',
        runningBalance: null,
        category: d.category,
        categorySource: 'standard',
        comments: '',
    }));
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

        // Append 5 standard manual-entry rows at the end (blank amount; the user
        // fills Adjusted Amount later). Dated the last day of the imported month.
        const standardRows = buildStandardRows(month);
        const allTxns = [...categorized, ...standardRows];

        const summary = summarize(allTxns);

        // Assign stable ids and persist to Firestore.
        const withIds = allTxns.map((t, i) => ({ id: `${month}-${i}`, ...t }));

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId)
            .collection('bankTransactions').doc(month);

        await ref.set({
            location: docId,
            month,
            transactions: withIds,
            summary,
            importedAt: new Date().toISOString(),
            importedBy: req.user?.email || req.user?.uid || 'unknown',
            count: withIds.length,
        });

        logger.info(`[BankTxns] Imported ${categorized.length} txns (+${standardRows.length} standard) for ${docId} ${month} by ${req.user?.email || req.user?.uid}`);

        res.json({ success: true, location: docId, month, count: withIds.length, summary, transactions: withIds });
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

/**
 * PUT /api/bank-transactions/:month/field
 * Body: { location, transactionId, field, value }
 * Update an editable field on a stored transaction. Allowed fields:
 *  - adjustAmount (number) — recomputes the summary using adjusted values
 *  - comments (string)
 */
router.put('/:month/field', async (req, res) => {
    try {
        const month = req.params.month;
        const { location, transactionId, field, value } = req.body;
        const allowed = ['adjustAmount', 'comments'];
        if (!location || !transactionId || !field) {
            return res.status(400).json({ error: 'location, transactionId, and field are required' });
        }
        if (!allowed.includes(field)) {
            return res.status(400).json({ error: `Invalid field. Must be one of: ${allowed.join(', ')}` });
        }

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId)
            .collection('bankTransactions').doc(month);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Month not found' });

        const normalized = field === 'adjustAmount' ? (Number(value) || 0) : String(value ?? '');
        const data = snap.data();
        const transactions = (data.transactions || []).map((t) =>
            t.id === transactionId ? { ...t, [field]: normalized } : t
        );
        const summary = summarize(transactions);

        await ref.update({ transactions, summary });
        res.json({ success: true, summary });
    } catch (error) {
        logger.error(`[BankTxns] field update failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to update field' });
    }
});

module.exports = router;
