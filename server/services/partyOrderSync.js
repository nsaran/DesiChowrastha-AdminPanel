require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { summarize } = require('./bankStatements/categorizer');
const logger = require('../utils/logger');

/**
 * Party-order sync
 *
 * Keeps the Monthly Report "Catering Order - Payment" row in sync with the total
 * amount PAID on party orders whose Party Date falls in that month.
 *
 * Amount = sum of cPartyOrderPaymentDetails[].amountPaid across all party orders
 * with cPartyDate in the month. Written as a positive credit (revenue) into the
 * "Catering Order - Payment" transaction row on bankTransactions/{YYYY-MM}.
 */

const CATERING_DESCRIPTION = 'Catering Order - Payment';

function docId(location) {
    if (!location) return location;
    return location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
}

/**
 * Total amount paid on party orders for a location + month (by Party Date).
 * @returns {Promise<number>}
 */
async function getMonthlyPartyOrderTotal(location, month) {
    const db = getFirestore();
    const snap = await db.collection('restaurants').doc(docId(location))
        .collection('partyOrders').get();

    let total = 0;
    snap.docs.forEach((d) => {
        const o = d.data();
        const partyDate = (o.cPartyDate || '').slice(0, 7); // YYYY-MM
        if (partyDate !== month) return;
        const payments = Array.isArray(o.cPartyOrderPaymentDetails) ? o.cPartyOrderPaymentDetails : [];
        payments.forEach((p) => { total += Number(p.amountPaid) || 0; });
    });
    return Math.round(total * 100) / 100;
}

/**
 * Write the party-order paid total into the Monthly Report's "Catering Order -
 * Payment" row (positive credit) and recompute the summary. No-op (returns false)
 * if the Monthly Report doc for that month doesn't exist yet, or the row is absent.
 * @returns {Promise<boolean>}
 */
async function syncPartyOrderToMonthlyReport(location, month) {
    try {
        const db = getFirestore();
        const ref = db.collection('restaurants').doc(docId(location))
            .collection('bankTransactions').doc(month);
        const snap = await ref.get();
        if (!snap.exists) return false;

        const data = snap.data();
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const idx = transactions.findIndex((t) => t.description === CATERING_DESCRIPTION);
        if (idx === -1) return false;

        const paidTotal = await getMonthlyPartyOrderTotal(location, month);
        // Revenue row: positive credit.
        const updated = transactions.map((t, i) =>
            i === idx ? { ...t, adjustAmount: Math.abs(paidTotal), categorySource: 'partyOrders' } : t
        );
        const summary = summarize(updated);

        await ref.update({ transactions: updated, summary });
        logger.info(`[PartyOrderSync] Synced ${docId(location)} ${month}: catering paid $${paidTotal}`);
        return true;
    } catch (error) {
        logger.error(`[PartyOrderSync] sync failed for ${location} ${month}: ${error.message}`);
        return false;
    }
}

module.exports = { getMonthlyPartyOrderTotal, syncPartyOrderToMonthlyReport, CATERING_DESCRIPTION };
