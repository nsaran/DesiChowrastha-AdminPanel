require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { summarize } = require('./bankStatements/categorizer');
const logger = require('../utils/logger');

/**
 * Other-cash sync
 *
 * Keeps the Monthly Report "Cash Payment - Others" row in sync with the total of
 * the miscellaneous cash payments entered for that month on the Cash Payments page.
 *
 * Total = sum of item.amount across cashPayments/{YYYY-MM}.items. Written as a
 * negative amount (expense / money out) into the "Cash Payment - Others" row on
 * bankTransactions/{YYYY-MM}.
 */

const OTHER_CASH_DESCRIPTION = 'Cash Payment - Others';

function docId(location) {
    if (!location) return location;
    return location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
}

/**
 * Total of the month's other cash payments.
 * @returns {Promise<number>}
 */
async function getMonthlyOtherCash(location, month) {
    const db = getFirestore();
    const path = `restaurants/${docId(location)}/cashPayments/${month}`;
    const snap = await db.collection('restaurants').doc(docId(location))
        .collection('cashPayments').doc(month).get();
    if (!snap.exists) {
        logger.info(`[OtherCashSync] getMonthlyOtherCash: doc not found at ${path}`);
        return 0;
    }
    const items = Array.isArray(snap.data().items) ? snap.data().items : [];
    const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    logger.info(`[OtherCashSync] getMonthlyOtherCash: ${path} -> ${items.length} items, total ${total}; raw=${JSON.stringify(snap.data().items)}`);
    return Math.round(total * 100) / 100;
}

/**
 * Write the other-cash total into the Monthly Report's "Cash Payment - Others"
 * row (negative) and recompute the summary. No-op (returns false) if the Monthly
 * Report doc for that month doesn't exist yet, or the row is absent.
 * @returns {Promise<boolean>}
 */
async function syncOtherCashToMonthlyReport(location, month) {
    try {
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId(location))
            .collection('bankTransactions').doc(month);
        const snap = await ref.get();
        if (!snap.exists) return false;

        const data = snap.data();
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const idx = transactions.findIndex((t) => t.description === OTHER_CASH_DESCRIPTION);
        if (idx === -1) return false;

        const total = await getMonthlyOtherCash(location, month);
        const updated = transactions.map((t, i) =>
            i === idx ? { ...t, adjustAmount: -Math.abs(total), categorySource: 'otherCash' } : t
        );
        const summary = summarize(updated);

        await ref.update({ transactions: updated, summary });
        logger.info(`[OtherCashSync] Synced ${docId(location)} ${month}: other cash $${total}`);
        return true;
    } catch (error) {
        logger.error(`[OtherCashSync] sync failed for ${location} ${month}: ${error.message}`);
        return false;
    }
}

module.exports = { getMonthlyOtherCash, syncOtherCashToMonthlyReport, OTHER_CASH_DESCRIPTION };
