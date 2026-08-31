require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { summarize } = require('./bankStatements/categorizer');
const { resolveRestaurantId } = require('./resolveRestaurantId');
const logger = require('../utils/logger');

/**
 * Other-cash sync
 *
 * Keeps the Monthly Report "Cash Payment - Others" row in sync with the total of
 * the miscellaneous cash payments entered for that month on the Cash Payments page.
 *
 * Total = sum of item.amount across cashPayments/{YYYY-MM}.items. Written as a
 * negative amount (expense / money out) into the "Cash Payment - Others" row on
 * bankTransactions/{YYYY-MM}. All lookups use the same resolved restaurant id so
 * the page, the save, and this sync always target one Firestore document.
 */

const OTHER_CASH_DESCRIPTION = 'Cash Payment - Others';

/**
 * Total of the month's other cash payments. Accepts either a raw location or an
 * already-resolved restaurant id.
 * @returns {Promise<number>}
 */
async function getMonthlyOtherCash(location, month) {
    const db = getFirestore();
    const rid = await resolveRestaurantId(location);
    const snap = await db.collection('restaurants').doc(rid)
        .collection('cashPayments').doc(month).get();
    if (!snap.exists) {
        logger.info(`[OtherCashSync] getMonthlyOtherCash: no doc at restaurants/${rid}/cashPayments/${month}`);
        return 0;
    }
    const items = Array.isArray(snap.data().items) ? snap.data().items : [];
    const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    logger.info(`[OtherCashSync] getMonthlyOtherCash: restaurants/${rid}/cashPayments/${month} -> ${items.length} items, total ${total}`);
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
        const rid = await resolveRestaurantId(location);
        const ref = db.collection('restaurants').doc(rid)
            .collection('bankTransactions').doc(month);
        const snap = await ref.get();
        if (!snap.exists) {
            logger.info(`[OtherCashSync] sync skipped: no bankTransactions/${month} for ${rid}`);
            return false;
        }

        const data = snap.data();
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const idx = transactions.findIndex((t) => t.description === OTHER_CASH_DESCRIPTION);
        if (idx === -1) {
            logger.info(`[OtherCashSync] sync skipped: no "${OTHER_CASH_DESCRIPTION}" row in ${rid}/${month}`);
            return false;
        }

        // Read cash payments under the SAME resolved restaurant id.
        const cpSnap = await db.collection('restaurants').doc(rid)
            .collection('cashPayments').doc(month).get();
        const items = cpSnap.exists && Array.isArray(cpSnap.data().items) ? cpSnap.data().items : [];
        const total = Math.round(items.reduce((s, it) => s + (Number(it.amount) || 0), 0) * 100) / 100;

        const updated = transactions.map((t, i) =>
            i === idx ? { ...t, adjustAmount: -Math.abs(total), categorySource: 'otherCash' } : t
        );
        const summary = summarize(updated);

        await ref.update({ transactions: updated, summary });
        logger.info(`[OtherCashSync] Synced ${rid} ${month}: other cash $${total} (${items.length} items)`);
        return true;
    } catch (error) {
        logger.error(`[OtherCashSync] sync failed for ${location} ${month}: ${error.message}`);
        return false;
    }
}

module.exports = { getMonthlyOtherCash, syncOtherCashToMonthlyReport, OTHER_CASH_DESCRIPTION };
