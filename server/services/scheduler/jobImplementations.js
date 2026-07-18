const axios = require('axios');
const { getAccessToken } = require('../authService');
const { toastApiBaseUrl, locations } = require('../../config/config');
const { logDailySales } = require('../googleSheetsService');
const logger = require('../../utils/logger');

/**
 * Job Implementation Functions
 * 
 * Each function corresponds to a job ID in schedulerConfig.json.
 * Add your business logic here to:
 * 1. Fetch data from external APIs using the request payload
 * 2. Process the data
 * 3. Return an array of template parameter strings for WhatsApp
 * 
 * @param {Object} job - The job configuration from schedulerConfig.json
 * @returns {Promise<string[]>} - Array of template parameter values
 */

/**
 * Helper: Get authenticated request options for Toast API
 */
async function getToastRequestOptions(location) {
    const { restaurantExternalId } = locations[location];
    const accessToken = await getAccessToken(location);
    return {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantExternalId
        }
    };
}

/**
 * Helper: Get today's date in YYYY-MM-DD format in US Eastern time
 */
function getTodayEST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Helper: Get formatted date string in US Eastern time
 */
function getFormattedDate() {
    return new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================
// JOB IMPLEMENTATIONS
// ============================================================

/**
 * Daily Sales Summary - Westborough
 * Calls orders/v2/ordersBulk with startDate and endDate for today (6PM-10PM window)
 * Iterates through records and sums up totalAmount under "checks"
 */
async function daily_sales_summary(job) {
    const location = job.location;
    logger.info(`[Scheduler] Running daily_sales_summary for ${location}`);

    try {
        const requestOptions = await getToastRequestOptions(location);

        // Build date range: today 10:00 AM to 10:00 PM EST (UTC-5 = -0500)
        const today = getTodayEST(); // YYYY-MM-DD in EST
        const startDate = `${today}T10:00:00.000-0500`;
        const endDate = `${today}T22:00:00.000-0500`;

        // Paginate through all orders (API returns max 100 per page)
        let allOrders = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `${toastApiBaseUrl}/orders/v2/ordersBulk?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&pageSize=100&page=${page}`,
                requestOptions
            );

            const orders = response.data || [];
            allOrders = allOrders.concat(orders);

            if (orders.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        const totalOrders = allOrders.length;

        // Sum totalAmount from all checks across all orders
        let totalSales = 0;
        for (const order of allOrders) {
            if (order.checks && Array.isArray(order.checks)) {
                for (const check of order.checks) {
                    totalSales += check.totalAmount || 0;
                }
            }
        }

        const date = getFormattedDate();

        logger.info(`[Scheduler] daily_sales_summary: ${totalOrders} orders, $${totalSales.toFixed(2)} total sales`);

        // Log to Google Sheets
        logDailySales(location, totalOrders, `$${totalSales.toFixed(2)}`);

        // Send today's special notification if items exist for today
        await sendTodaysSpecialNotification(location);

        // Reset whatsappOrders cache at end of day
        if (global.whatsappOrders) {
            global.whatsappOrders.length = 0;
            logger.info(`[Scheduler] WhatsApp orders cache reset for end of day`);
        }

        return [totalOrders.toString(), `$${totalSales.toFixed(2)}`];
    } catch (error) {
        logger.error(`[Scheduler] daily_sales_summary error: ${error.message}`);
        return ['Error', 'N/A', getFormattedDate()];
    }
}

/**
 * Send today's special items via WhatsApp if any exist for today
 */
async function sendTodaysSpecialNotification(location) {
    const WA_TODAYS_SPECIAL_TEMPLATE = process.env.WA_TODAYS_SPECIAL_TEMPLATE_NAME;
    if (!WA_TODAYS_SPECIAL_TEMPLATE) {
        logger.info(`[Scheduler] WA_TODAYS_SPECIAL_TEMPLATE_NAME not configured, skipping`);
        return;
    }

    const cache = global.cacheData;
    if (!cache) return;

    const cacheKey = `todaysSpecial_${location.toUpperCase()}`;
    const items = cache.get(cacheKey);
    if (!items || !Array.isArray(items) || items.length === 0) {
        logger.info(`[Scheduler] No today's special items configured for ${location}`);
        return;
    }

    // Filter items valid for today
    const today = getTodayEST();
    const validItems = items.filter(item => today >= item.startDate && today <= item.endDate);

    if (validItems.length === 0) {
        logger.info(`[Scheduler] No valid today's special items for ${location} on ${today}`);
        return;
    }

    // Build the items list as a string
    const itemsList = validItems.map(item => {
        const price = item.price ? ` - $${parseFloat(item.price).toFixed(2)}` : '';
        return `${item.name}${price}`;
    }).join(', ');

    // Send via WhatsApp
    const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
    const WA_TEMPLATE_LANGUAGE = process.env.WA_TEMPLATE_LANGUAGE || 'en';
    const locationKey = location.toUpperCase();
    const phoneNumberId = locationKey === 'NASHUA'
        ? process.env.WA_PHONE_NUMBER_ID_NASHUA
        : (process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID);
    const recipients = (process.env.OWNER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    for (const recipient of recipients) {
        try {
            await axios.post(url, {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'template',
                template: {
                    name: WA_TODAYS_SPECIAL_TEMPLATE,
                    language: { code: WA_TEMPLATE_LANGUAGE },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: itemsList }
                            ]
                        }
                    ]
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`[Scheduler] Today's special sent to ${recipient} for ${location}: ${itemsList}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            logger.error(`[Scheduler] Failed to send today's special to ${recipient}: ${errorMsg}`);
        }
    }
}

/**
 * Weekly Inventory Report - Westborough
 * Fetches inventory and reports low/out-of-stock items
 */
async function weekly_inventory_report(job) {
    const location = job.location;
    logger.info(`[Scheduler] Running weekly_inventory_report for ${location}`);

    try {
        const requestOptions = await getToastRequestOptions(location);

        const response = await axios.get(
            `${toastApiBaseUrl}/stock/v1/inventory`,
            requestOptions
        );

        const inventory = response.data || [];
        const outOfStock = inventory.filter(item => item.status === 'OUT_OF_STOCK');
        const outOfStockCount = outOfStock.length.toString();
        const lowStockItems = outOfStock.map(item => item.name || item.guid).slice(0, 10).join(', ') || 'None';

        return [lowStockItems, outOfStockCount];
    } catch (error) {
        logger.error(`[Scheduler] weekly_inventory_report error: ${error.message}`);
        return ['Error fetching data', '0'];
    }
}

/**
 * Monthly Performance Report
 * Calls orders/v2/ordersBulk for the entire previous month (1st to last day)
 * Sums totalAmount from all checks
 */
async function monthly_performance(job) {
    const location = job.location;
    logger.info(`[Scheduler] Running monthly_performance for ${location}`);

    try {
        const requestOptions = await getToastRequestOptions(location);

        // Get previous month's first and last day in EST
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const startYear = firstOfLastMonth.getFullYear();
        const startMonth = String(firstOfLastMonth.getMonth() + 1).padStart(2, '0');
        const startDay = '01';
        const endDay = String(lastOfLastMonth.getDate()).padStart(2, '0');

        const startDate = `${startYear}-${startMonth}-${startDay}T10:00:00.000-0500`;
        const endDate = `${startYear}-${startMonth}-${endDay}T22:00:00.000-0500`;

        // Paginate through all orders
        let allOrders = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `${toastApiBaseUrl}/orders/v2/ordersBulk?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&pageSize=100&page=${page}`,
                requestOptions
            );

            const orders = response.data || [];
            allOrders = allOrders.concat(orders);

            if (orders.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        const totalOrders = allOrders.length;

        // Sum totalAmount from all checks
        let totalSales = 0;
        for (const order of allOrders) {
            if (order.checks && Array.isArray(order.checks)) {
                for (const check of order.checks) {
                    totalSales += check.totalAmount || 0;
                }
            }
        }

        const monthName = firstOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        logger.info(`[Scheduler] monthly_performance: ${monthName} - ${totalOrders} orders, $${totalSales.toFixed(2)} total sales`);

        return [monthName, totalOrders.toString(), `$${totalSales.toFixed(2)}`];
    } catch (error) {
        logger.error(`[Scheduler] monthly_performance error: ${error.message}`);
        return ['Error', '0', '$0.00'];
    }
}

/**
 * Yearly Business Review
 * Fetches annual summary data
 */
async function yearly_review(job) {
    const location = job.location;
    logger.info(`[Scheduler] Running yearly_review for ${location}`);

    try {
        // TODO: Implement actual yearly reporting API call
        const lastYear = (new Date().getFullYear() - 1).toString();

        return [lastYear, 'Data pending', 'N/A'];
    } catch (error) {
        logger.error(`[Scheduler] yearly_review error: ${error.message}`);
        return ['Error', 'N/A', 'N/A'];
    }
}

/**
 * Nashua Daily Sales Summary
 * Same logic as Westborough but for Nashua location
 */
async function nashua_daily_sales_summary(job) {
    return await daily_sales_summary(job);
}

// ============================================================
// REGISTRY - Maps job IDs to implementation functions
// ============================================================

const jobRegistry = {
    daily_sales_summary,
    weekly_inventory_report,
    monthly_performance,
    yearly_review,
    nashua_daily_sales_summary
};

/**
 * Execute a job's implementation function
 * @param {string} jobId - The job ID from config
 * @param {Object} job - The full job configuration
 * @returns {Promise<string[]>} - Template parameters array
 */
async function executeJob(jobId, job) {
    const implementation = jobRegistry[jobId];
    if (!implementation) {
        logger.error(`[Scheduler] No implementation found for job: ${jobId}`);
        throw new Error(`No implementation for job: ${jobId}`);
    }
    return await implementation(job);
}

module.exports = {
    executeJob,
    jobRegistry
};
