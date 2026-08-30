const axios = require('axios');
const { getAccessToken } = require('./authService');
const { toastApiBaseUrl, locations } = require('../config/config');
const logger = require('../utils/logger');

/**
 * Toast Cash Service
 *
 * Computes the total CASH received for a location in a given month by paginating
 * the Toast Orders API and summing payments whose type is CASH. Refunded and
 * voided payments are excluded (net cash received).
 */

async function getRequestOptions(location) {
    const { restaurantExternalId } = locations[location];
    const accessToken = await getAccessToken(location);
    return {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantExternalId,
        },
    };
}

// First and last day of a 'YYYY-MM' month as Toast API date strings (EST -0500).
function monthRange(month) {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    const startDate = `${y}-${mm}-01T00:00:00.000-0500`;
    const endDate = `${y}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59.999-0500`;
    return { startDate, endDate };
}

/**
 * Sum of CASH payments for a location in a month, excluding refunds/voids.
 * @returns {Promise<{ location, month, cashTotal, paymentCount, orderCount }>}
 */
async function getMonthlyCashTotal(location, month) {
    const locationKey = String(location).toUpperCase();
    if (!locations[locationKey]) {
        throw new Error(`Unknown location: ${location}`);
    }

    const requestOptions = await getRequestOptions(locationKey);
    const { startDate, endDate } = monthRange(month);

    let allOrders = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
        const url = `${toastApiBaseUrl}/orders/v2/ordersBulk?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&pageSize=100&page=${page}`;
        const response = await axios.get(url, requestOptions);
        const orders = response.data || [];
        allOrders = allOrders.concat(orders);
        if (orders.length < 100) hasMore = false;
        else page++;
    }

    let cashTotal = 0;
    let paymentCount = 0;
    for (const order of allOrders) {
        if (order.voided) continue;
        const checks = Array.isArray(order.checks) ? order.checks : [];
        for (const check of checks) {
            const payments = Array.isArray(check.payments) ? check.payments : [];
            for (const p of payments) {
                // Only CASH payments.
                const type = (p.type || p.paymentType || '').toUpperCase();
                if (type !== 'CASH') continue;
                // Exclude refunded / voided payments.
                const status = (p.paymentStatus || '').toUpperCase();
                if (p.voided || p.refundStatus === 'FULL' || status === 'VOIDED') continue;

                const amount = Number(p.amount) || 0;
                // Net out any partial refund recorded on the payment.
                const refundAmount = Number(p.refund?.refundAmount || 0) || 0;
                cashTotal += amount - refundAmount;
                paymentCount += 1;
            }
        }
    }

    return {
        location: locationKey,
        month,
        cashTotal: Math.round(cashTotal * 100) / 100,
        paymentCount,
        orderCount: allOrders.length,
    };
}

module.exports = { getMonthlyCashTotal };
