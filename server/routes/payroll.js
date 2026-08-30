const express = require('express');
const router = express.Router();
require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Payroll (employees + salary ledger) is owner / accounts-manager only.
router.use(verifyToken, requireRole(['owner', 'accountsManager']));

function restaurantDocId(location) {
    if (!location) return location;
    return location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
}

// ─── Employees (roster CRUD) ─────────────────────────────────────────────────

const EMPLOYEE_FIELDS = [
    'firstName', 'lastName', 'dateOfBirth', 'joiningDate', 'terminationDate',
    'employmentStatus', 'basePay', 'payFrequency', 'role',
];

function pickEmployee(body) {
    const out = {};
    EMPLOYEE_FIELDS.forEach((f) => { if (body[f] !== undefined) out[f] = body[f]; });
    return out;
}

/** GET /api/payroll/employees?location=.. */
router.get('/employees', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('employees').get();
        const employees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json({ employees });
    } catch (error) {
        logger.error(`[Payroll] list employees failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to load employees' });
    }
});

/** POST /api/payroll/employees  body: { location, ...fields } */
router.post('/employees', async (req, res) => {
    try {
        const location = (req.body.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const data = pickEmployee(req.body);
        if (!data.firstName || !data.lastName) return res.status(400).json({ error: 'firstName and lastName are required' });
        const db = getFirestore();
        const ref = await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('employees').add({ ...data, createdAt: new Date().toISOString() });
        res.json({ success: true, id: ref.id });
    } catch (error) {
        logger.error(`[Payroll] create employee failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to create employee' });
    }
});

/** PUT /api/payroll/employees/:id  body: { location, ...fields } */
router.put('/employees/:id', async (req, res) => {
    try {
        const location = (req.body.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const data = pickEmployee(req.body);
        const db = getFirestore();
        await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('employees').doc(req.params.id).update(data);
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Payroll] update employee failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to update employee' });
    }
});

/** DELETE /api/payroll/employees/:id?location=.. */
router.delete('/employees/:id', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        if (!location) return res.status(400).json({ error: 'location is required' });
        const db = getFirestore();
        await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('employees').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Payroll] delete employee failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to delete employee' });
    }
});

// ─── Salary Ledger ───────────────────────────────────────────────────────────
// Stored one doc per month at restaurants/{location}/salaryPayments/{YYYY-MM}.
// Shape: { month, rows: { [employeeId]: { p1Cash, p1Bank, p16Cash, p16Bank } }, updatedAt, updatedBy }

/** GET /api/payroll/salary?location=..&month=YYYY-MM */
router.get('/salary', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const month = (req.query.month || '').trim();
        if (!location || !month) return res.status(400).json({ error: 'location and month are required' });
        const db = getFirestore();
        const snap = await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('salaryPayments').doc(month).get();
        res.json(snap.exists ? snap.data() : { month, rows: {} });
    } catch (error) {
        logger.error(`[Payroll] get salary failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to load salary ledger' });
    }
});

/**
 * PUT /api/payroll/salary  body: { location, month, rows }
 * Batch-saves the whole month at once (one write) to protect the read/write quota.
 */
router.put('/salary', async (req, res) => {
    try {
        const location = (req.body.location || '').trim();
        const month = (req.body.month || '').trim();
        const rows = req.body.rows || {};
        if (!location || !month) return res.status(400).json({ error: 'location and month are required' });
        if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

        // Normalize numbers.
        const clean = {};
        Object.keys(rows).forEach((empId) => {
            const r = rows[empId] || {};
            clean[empId] = {
                p1Cash: Number(r.p1Cash) || 0,
                p1Bank: Number(r.p1Bank) || 0,
                p16Cash: Number(r.p16Cash) || 0,
                p16Bank: Number(r.p16Bank) || 0,
            };
        });

        const db = getFirestore();
        await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('salaryPayments').doc(month)
            .set({
                month,
                rows: clean,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user?.email || req.user?.uid || 'unknown',
            });
        res.json({ success: true });
    } catch (error) {
        logger.error(`[Payroll] save salary failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to save salary ledger' });
    }
});

/**
 * GET /api/payroll/salary/year?location=..&year=YYYY
 * Read-only year rollup: per-month period totals (cash/bank) and per-employee
 * yearly totals across all 12 months.
 */
router.get('/salary/year', async (req, res) => {
    try {
        const location = (req.query.location || '').trim();
        const year = (req.query.year || '').trim();
        if (!location || !year) return res.status(400).json({ error: 'location and year are required' });

        const db = getFirestore();
        const round = (n) => Math.round(n * 100) / 100;
        const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

        // month -> { p1Cash, p1Bank, p16Cash, p16Bank, total }
        const perMonth = {};
        // employeeId -> total for the year
        const perEmployee = {};
        // employeeId -> { month -> total } (per-employee per-month breakdown)
        const employeeMonth = {};
        const yearTotals = { p1Cash: 0, p1Bank: 0, p16Cash: 0, p16Bank: 0, cash: 0, bank: 0, total: 0 };

        for (const m of months) {
            const snap = await db.collection('restaurants').doc(restaurantDocId(location))
                .collection('salaryPayments').doc(m).get();
            const rows = snap.exists ? (snap.data().rows || {}) : {};
            const agg = { p1Cash: 0, p1Bank: 0, p16Cash: 0, p16Bank: 0 };
            Object.keys(rows).forEach((empId) => {
                const r = rows[empId] || {};
                agg.p1Cash += Number(r.p1Cash) || 0;
                agg.p1Bank += Number(r.p1Bank) || 0;
                agg.p16Cash += Number(r.p16Cash) || 0;
                agg.p16Bank += Number(r.p16Bank) || 0;
                const empTotal = (Number(r.p1Cash) || 0) + (Number(r.p1Bank) || 0) + (Number(r.p16Cash) || 0) + (Number(r.p16Bank) || 0);
                perEmployee[empId] = round((perEmployee[empId] || 0) + empTotal);
                if (!employeeMonth[empId]) employeeMonth[empId] = {};
                employeeMonth[empId][m] = round((employeeMonth[empId][m] || 0) + empTotal);
            });
            const cash = agg.p1Cash + agg.p16Cash;
            const bank = agg.p1Bank + agg.p16Bank;
            const total = cash + bank;
            perMonth[m] = {
                p1Cash: round(agg.p1Cash), p1Bank: round(agg.p1Bank),
                p16Cash: round(agg.p16Cash), p16Bank: round(agg.p16Bank),
                cash: round(cash), bank: round(bank), total: round(total),
            };
            yearTotals.p1Cash += agg.p1Cash; yearTotals.p1Bank += agg.p1Bank;
            yearTotals.p16Cash += agg.p16Cash; yearTotals.p16Bank += agg.p16Bank;
            yearTotals.cash += cash; yearTotals.bank += bank; yearTotals.total += total;
        }
        Object.keys(yearTotals).forEach((k) => { yearTotals[k] = round(yearTotals[k]); });

        // Resolve employee names for the per-employee per-month matrix.
        const empSnap = await db.collection('restaurants').doc(restaurantDocId(location))
            .collection('employees').get();
        const nameById = {};
        empSnap.docs.forEach((d) => {
            const e = d.data();
            nameById[d.id] = `${e.firstName || ''} ${e.lastName || ''}`.trim() || d.id;
        });

        // Build one matrix row per employee that has any salary data this year.
        const employeeMatrix = Object.keys(employeeMonth).map((empId) => {
            const row = { employeeId: empId, name: nameById[empId] || empId };
            let rowTotal = 0;
            months.forEach((m) => {
                const v = employeeMonth[empId][m] || 0;
                row[m] = round(v);
                rowTotal += v;
            });
            row.total = round(rowTotal);
            return row;
        }).sort((a, b) => a.name.localeCompare(b.name));

        res.json({ location: restaurantDocId(location), year, months, perMonth, perEmployee, employeeMatrix, yearTotals });
    } catch (error) {
        logger.error(`[Payroll] salary year failed: ${error.message}`);
        res.status(500).json({ error: error.message || 'Failed to build salary year view' });
    }
});

module.exports = router;
