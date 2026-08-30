require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { summarize } = require('./bankStatements/categorizer');
const logger = require('../utils/logger');

/**
 * Salary-cash sync
 *
 * Keeps the Monthly Report "Cash Payment - Employees" row in sync with the total
 * CASH salary recorded in the Salary Ledger for the same month.
 *
 * Cash salary total = sum of (p1Cash + p16Cash) across all employees in
 * salaryPayments/{YYYY-MM}. That value is written into the "Cash Payment -
 * Employees" transaction row's adjustAmount on the Monthly Report doc
 * (bankTransactions/{YYYY-MM}), and the doc summary is recomputed.
 */

const CASH_EMPLOYEE_DESCRIPTION = 'Cash Payment - Employees';

function docId(location) {
    if (!location) return location;
    return location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
}

/**
 * Compute total cash salary for a location + month from the Salary Ledger.
 * @returns {Promise<number>}
 */
async function getMonthlyCashSalary(location, month) {
    const db = getFirestore();
    const snap = await db.collection('restaurants').doc(docId(location))
        .collection('salaryPayments').doc(month).get();
    if (!snap.exists) return 0;
    const rows = snap.data().rows || {};
    let total = 0;
    Object.keys(rows).forEach((empId) => {
        const r = rows[empId] || {};
        total += (Number(r.p1Cash) || 0) + (Number(r.p16Cash) || 0);
    });
    return Math.round(total * 100) / 100;
}

/**
 * Write the cash-salary total into the Monthly Report's "Cash Payment - Employees"
 * row and recompute the summary. No-op (returns false) if the Monthly Report doc
 * for that month doesn't exist yet, or if the row isn't present.
 * @returns {Promise<boolean>} whether the Monthly Report doc was updated
 */
async function syncCashSalaryToMonthlyReport(location, month) {
    try {
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId(location))
            .collection('bankTransactions').doc(month);
        const snap = await ref.get();
        if (!snap.exists) return false; // no statement imported for this month yet

        const data = snap.data();
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const idx = transactions.findIndex((t) => t.description === CASH_EMPLOYEE_DESCRIPTION);
        if (idx === -1) return false; // standard row not present

        const cashSalary = await getMonthlyCashSalary(location, month);
        // Expense row: stored as a negative amount so it counts as money out.
        const updated = transactions.map((t, i) =>
            i === idx ? { ...t, adjustAmount: -Math.abs(cashSalary), categorySource: 'salaryLedger' } : t
        );
        const summary = summarize(updated);

        await ref.update({ transactions: updated, summary });
        logger.info(`[SalaryCashSync] Synced ${docId(location)} ${month}: cash salary $${cashSalary}`);
        return true;
    } catch (error) {
        logger.error(`[SalaryCashSync] sync failed for ${location} ${month}: ${error.message}`);
        return false;
    }
}

module.exports = { getMonthlyCashSalary, syncCashSalaryToMonthlyReport, CASH_EMPLOYEE_DESCRIPTION };
