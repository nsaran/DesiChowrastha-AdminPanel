const express = require('express');
const multer = require('multer');
const router = express.Router();
require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { parseBankCsv } = require('../services/bankStatements/csvParser');
const { categorizeTransactions, summarize, CATEGORIES } = require('../services/bankStatements/categorizer');
const { getMonthlyCashTotal } = require('../services/toastCashService');

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
 * GET /api/bank-transactions/toast-cash?location=<..>&month=<YYYY-MM>
 * Returns the total CASH received for the month from the Toast Orders API
 * (excludes refunds/voids). Used to auto-fill the "Toast Cash Income" row.
 */
router.get('/toast-cash', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const month = (req.query.month || '').trim();
        if (!location || !month) return res.status(400).json({ error: 'location and month are required' });
        if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

        const result = await getMonthlyCashTotal(location, month);
        res.json(result);
    } catch (error) {
        logger.error(`[BankTxns] toast-cash failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to fetch Toast cash total' });
    }
});

/**
 * GET /api/bank-transactions/yearly?location=<..>&year=<YYYY>
 * Read-only yearly roll-up. Aggregates the stored monthly `summary` arrays across
 * every month of the year into:
 *   - categoryTotals: cumulative per-category { credits, debits, net, count }
 *   - matrix: per-category net by month (category rows x 12 month columns)
 *   - months: the month keys (YYYY-MM) that have data, sorted ascending
 *   - grand totals for the year
 */
router.get('/yearly', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const year = (req.query.year || '').trim();
        if (!location || !year) return res.status(400).json({ error: 'location and year are required' });

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(docId)
            .collection('bankTransactions').get();

        // Keep only docs for the requested year (doc id is YYYY-MM).
        const yearDocs = snap.docs
            .filter((d) => d.id.startsWith(`${year}-`))
            .sort((a, b) => a.id.localeCompare(b.id));

        const monthsWithData = yearDocs.map((d) => d.id);

        // Cumulative per-category totals, and a category -> { 'YYYY-MM': net } matrix.
        const categoryTotals = {}; // cat -> { category, credits, debits, net, count }
        const matrix = {};         // cat -> { month -> net }
        let grandCredits = 0, grandDebits = 0;

        for (const d of yearDocs) {
            const data = d.data();
            const monthKey = d.id;
            const summary = Array.isArray(data.summary) ? data.summary : [];
            for (const row of summary) {
                const cat = row.category || 'Uncategorized';
                if (!categoryTotals[cat]) categoryTotals[cat] = { category: cat, credits: 0, debits: 0, net: 0, count: 0 };
                categoryTotals[cat].credits += row.credits || 0;
                categoryTotals[cat].debits += row.debits || 0;
                categoryTotals[cat].net += row.net || 0;
                categoryTotals[cat].count += row.count || 0;

                if (!matrix[cat]) matrix[cat] = {};
                matrix[cat][monthKey] = (matrix[cat][monthKey] || 0) + (row.net || 0);

                grandCredits += row.credits || 0;
                grandDebits += row.debits || 0;
            }
        }

        const round = (n) => Math.round(n * 100) / 100;
        const categoryTotalsArr = Object.values(categoryTotals).map((c) => ({
            ...c,
            credits: round(c.credits),
            debits: round(c.debits),
            net: round(c.net),
        }));
        // Build matrix rows: one per category, with a net value per month key.
        const matrixRows = Object.keys(matrix).map((cat) => {
            const row = { category: cat };
            for (const m of monthsWithData) row[m] = round(matrix[cat][m] || 0);
            row.total = round(monthsWithData.reduce((s, m) => s + (matrix[cat][m] || 0), 0));
            return row;
        });

        res.json({
            location: docId,
            year,
            months: monthsWithData,
            categoryTotals: categoryTotalsArr,
            matrix: matrixRows,
            grand: { credits: round(grandCredits), debits: round(grandDebits), net: round(grandCredits + grandDebits) },
        });
    } catch (error) {
        logger.error(`[BankTxns] yearly failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to build yearly report' });
    }
});

/**
 * GET /api/bank-transactions/balance-sheet?location=<..>&year=<YYYY>
 * Read-only balance-sheet style roll-up per month for a year:
 *   - income:  sum of credits across all categories EXCEPT 'Capital Investment'
 *   - expense: sum of debits (as positive) across all categories EXCEPT 'Transfers / Owner Draws'
 *   - profitLoss: income - expense (capital movements excluded, per accounting)
 *   - capitalWithdrawal: debits (as positive) of 'Transfers / Owner Draws'
 *   - capitalInvestment: credits of 'Capital Investment'
 * Returns per-month values (keyed by YYYY-MM) plus yearly totals for each metric.
 */
const CAPITAL_WITHDRAWAL_CATEGORY = 'Transfers / Owner Draws';
const CAPITAL_INVESTMENT_CATEGORY = 'Capital Investment';

router.get('/balance-sheet', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const year = (req.query.year || '').trim();
        if (!location || !year) return res.status(400).json({ error: 'location and year are required' });

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(docId)
            .collection('bankTransactions').get();

        const round = (n) => Math.round(n * 100) / 100;

        // Derive income/expense/profitLoss/capital metrics from a stored summary array.
        const metricsFromSummary = (summary) => {
            let income = 0, expense = 0, capitalWithdrawal = 0, capitalInvestment = 0;
            for (const row of (Array.isArray(summary) ? summary : [])) {
                const cat = row.category || 'Uncategorized';
                const credits = row.credits || 0;   // money in (>= 0)
                const debits = row.debits || 0;      // money out (<= 0)
                if (cat === CAPITAL_INVESTMENT_CATEGORY) capitalInvestment += credits;
                else income += credits;
                if (cat === CAPITAL_WITHDRAWAL_CATEGORY) capitalWithdrawal += Math.abs(debits);
                else expense += Math.abs(debits);
            }
            return { income, expense, profitLoss: income - expense, capitalWithdrawal, capitalInvestment };
        };

        // Fetch all docs once and index by month key so we can look up any month
        // (including the previous year's December for January's opening balance).
        const byMonth = {}; // 'YYYY-MM' -> summary array
        snap.docs.forEach((d) => { byMonth[d.id] = d.data().summary; });

        const yearDocs = snap.docs
            .filter((d) => d.id.startsWith(`${year}-`))
            .sort((a, b) => a.id.localeCompare(b.id));

        const months = yearDocs.map((d) => d.id);

        // profitLoss for a given month key (0 if that month has no data).
        const profitLossOf = (monthKey) =>
            byMonth[monthKey] ? metricsFromSummary(byMonth[monthKey]).profitLoss : 0;

        // The calendar-previous month key for a 'YYYY-MM' (Jan -> previous Dec).
        const prevMonthKey = (monthKey) => {
            const [y, m] = monthKey.split('-').map(Number);
            const d = new Date(y, m - 1, 1); // this month
            d.setMonth(d.getMonth() - 1);    // previous month
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        // Per-month metric maps keyed by YYYY-MM.
        const perMonth = {};
        const totals = { openingBalance: 0, income: 0, expense: 0, profitLoss: 0, capitalWithdrawal: 0, capitalInvestment: 0 };

        for (const d of yearDocs) {
            const monthKey = d.id;
            const m = metricsFromSummary(d.data().summary);
            // Opening balance = the previous (calendar) month's profit/loss.
            // For January this reads the previous year's December automatically.
            const openingBalance = profitLossOf(prevMonthKey(monthKey));

            perMonth[monthKey] = {
                openingBalance: round(openingBalance),
                income: round(m.income),
                expense: round(m.expense),
                profitLoss: round(m.profitLoss),
                capitalWithdrawal: round(m.capitalWithdrawal),
                capitalInvestment: round(m.capitalInvestment),
            };

            totals.openingBalance += openingBalance;
            totals.income += m.income;
            totals.expense += m.expense;
            totals.profitLoss += m.profitLoss;
            totals.capitalWithdrawal += m.capitalWithdrawal;
            totals.capitalInvestment += m.capitalInvestment;
        }

        Object.keys(totals).forEach((k) => { totals[k] = round(totals[k]); });

        res.json({ location: docId, year, months, perMonth, totals });
    } catch (error) {
        logger.error(`[BankTxns] balance-sheet failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to build balance sheet' });
    }
});

/**
 * GET /api/bank-transactions/profit-loss?location=<..>&year=<YYYY>
 * Read-only Profit & Loss statement for a year, month-by-month.
 * Categories are grouped into Revenue vs Expense (agreed mapping). Excluded from
 * the P&L: Transfers / Owner Draws, Capital Investment, Uncategorized.
 * Returns per-category lines (with per-month values + line total), section
 * subtotals (revenue/expense) per month + total, and net profit/loss.
 */
const PL_REVENUE_CATEGORIES = ['Sales/Deposits', 'Other Income', 'Catering Order'];
const PL_EXPENSE_CATEGORIES = [
    'Food Supplies', 'Utilities', 'Rent/Lease', 'Payroll', 'Payroll Taxes',
    'Taxes (Govt)', 'Bank & Card Fees', 'Software & Services', 'Insurance',
    'Wages (Direct/Zelle)', 'Cash Paid', 'Credit Card / Loan Payment',
];

router.get('/profit-loss', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const year = (req.query.year || '').trim();
        if (!location || !year) return res.status(400).json({ error: 'location and year are required' });

        const docId = restaurantDocId(location);
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(docId)
            .collection('bankTransactions').get();

        const yearDocs = snap.docs
            .filter((d) => d.id.startsWith(`${year}-`))
            .sort((a, b) => a.id.localeCompare(b.id));

        const months = yearDocs.map((d) => d.id);
        const round = (n) => Math.round(n * 100) / 100;

        // Amount contributed by a category from a month's summary row.
        // Revenue uses credits; Expense uses abs(debits).
        const byMonthCategory = {}; // month -> { category -> {credits, debits} }
        yearDocs.forEach((d) => {
            const summary = Array.isArray(d.data().summary) ? d.data().summary : [];
            const map = {};
            summary.forEach((row) => {
                const cat = row.category || 'Uncategorized';
                map[cat] = { credits: row.credits || 0, debits: row.debits || 0 };
            });
            byMonthCategory[d.id] = map;
        });

        // Build category line rows for a section.
        const buildLines = (categories, kind) => categories.map((cat) => {
            const line = { category: cat };
            let lineTotal = 0;
            months.forEach((m) => {
                const cell = (byMonthCategory[m] || {})[cat];
                const val = cell ? (kind === 'revenue' ? cell.credits : Math.abs(cell.debits)) : 0;
                line[m] = round(val);
                lineTotal += val;
            });
            line.total = round(lineTotal);
            return line;
        }).filter((line) => line.total !== 0 || months.some((m) => line[m] !== 0));

        const revenueLines = buildLines(PL_REVENUE_CATEGORIES, 'revenue');
        const expenseLines = buildLines(PL_EXPENSE_CATEGORIES, 'expense');

        // Section subtotals per month + total, and net per month + total.
        const sumLines = (lines) => {
            const row = {};
            let total = 0;
            months.forEach((m) => {
                const v = lines.reduce((s, l) => s + (l[m] || 0), 0);
                row[m] = round(v);
                total += v;
            });
            row.total = round(total);
            return row;
        };

        const revenueSubtotal = sumLines(revenueLines);
        const expenseSubtotal = sumLines(expenseLines);
        const net = {};
        let netTotal = 0;
        months.forEach((m) => {
            const v = (revenueSubtotal[m] || 0) - (expenseSubtotal[m] || 0);
            net[m] = round(v);
            netTotal += v;
        });
        net.total = round(netTotal);

        res.json({
            location: docId,
            year,
            months,
            revenue: { lines: revenueLines, subtotal: revenueSubtotal },
            expense: { lines: expenseLines, subtotal: expenseSubtotal },
            net,
        });
    } catch (error) {
        logger.error(`[BankTxns] profit-loss failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to build profit & loss' });
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
