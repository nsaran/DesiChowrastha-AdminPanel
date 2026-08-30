const axios = require('axios');
const { getAccessToken } = require('../authService');
const { toastApiBaseUrl, locations } = require('../../config/config');
const { logDailySales, getSubscribers } = require('../googleSheetsService');
const { generateTodaysSpecialImage } = require('../todaysSpecialImage');
const logger = require('../../utils/logger');
require('../../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');

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
        await logDailySales(location, totalOrders, `$${totalSales.toFixed(2)}`);

        // Send today's special notification if items exist for today
        await sendTodaysSpecialNotification(location);

        // Send tomorrow's special image via WhatsApp if items exist
        await sendTomorrowsSpecialImage(location);

        // Reset whatsappOrders cache at end of day
        if (global.whatsappOrders) {
            global.whatsappOrders.length = 0;
            logger.info(`[Scheduler] WhatsApp orders cache reset for end of day`);
        }

        return [totalOrders.toString(), `$${totalSales.toFixed(2)}`];
    } catch (error) {
        logger.error(`[Scheduler] daily_sales_summary error: ${error.message}`);
        // Still try to log to Google Sheets even on error
        try {
            await logDailySales(location, 0, 'Error');
        } catch (sheetErr) {
            logger.error(`[Scheduler] Google Sheets log failed: ${sheetErr.message}`);
        }
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
 * Send tomorrow's special as an image via WhatsApp
 */
async function sendTomorrowsSpecialImage(location) {
    const cache = global.cacheData;
    if (!cache) return;

    const cacheKey = `todaysSpecial_${location.toUpperCase()}`;
    const items = cache.get(cacheKey);
    if (!items || !Array.isArray(items) || items.length === 0) return;

    // Get tomorrow's date in EST
    const tomorrow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Filter items valid for tomorrow
    const tomorrowItems = items.filter(item => tomorrowStr >= item.startDate && tomorrowStr <= item.endDate);

    if (tomorrowItems.length === 0) {
        logger.info(`[Scheduler] No tomorrow's special items for ${location}`);
        return;
    }

    try {
        // Generate image
        const imageBuffer = await generateTodaysSpecialImage(tomorrowItems, location);

        // Upload to a temporary hosting (using the server itself to serve it)
        const fs = require('fs');
        const path = require('path');
        const imageDir = path.resolve(__dirname, '../../..', 'client', 'public', '_images', 'specials');
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }
        const fileName = `tomorrows_special_${location.toLowerCase()}.png`;
        const filePath = path.join(imageDir, fileName);
        fs.writeFileSync(filePath, imageBuffer);

        // Send via WhatsApp media message
        const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
        const WA_TEMPLATE_LANGUAGE = process.env.WA_TEMPLATE_LANGUAGE || 'en';
        const locationKey = location.toUpperCase();
        const phoneNumberId = locationKey === 'NASHUA'
            ? process.env.WA_PHONE_NUMBER_ID_NASHUA
            : (process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID);
        const recipients = (process.env.OWNER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);

        // Use the public URL to serve the image
        const serverUrl = process.env.SERVER_PUBLIC_URL || 'http://96.32.117.226:3000';
        const imageUrl = `${serverUrl}/_images/specials/${fileName}`;

        // Send to owners/managers
        for (const recipient of recipients) {
            try {
                // Send template message with image header
                const WA_TOMORROWS_SPECIAL_TEMPLATE = process.env.WA_TOMORROWS_SPECIAL_TEMPLATE_NAME || 'tomorrows_special';
                const itemsList = tomorrowItems.map(i => `${i.name} - $${parseFloat(i.price).toFixed(2)}`).join(', ');

                await axios.post(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                    messaging_product: 'whatsapp',
                    to: recipient,
                    type: 'template',
                    template: {
                        name: WA_TOMORROWS_SPECIAL_TEMPLATE,
                        language: { code: WA_TEMPLATE_LANGUAGE },
                        components: [
                            {
                                type: 'header',
                                parameters: [
                                    {
                                        type: 'image',
                                        image: { link: imageUrl }
                                    }
                                ]
                            },
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

                logger.info(`[Scheduler] Tomorrow's special image sent to ${recipient} for ${location}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                const errorMsg = error.response?.data?.error?.message || error.message;
                logger.error(`[Scheduler] Failed to send tomorrow's special image to ${recipient}: ${errorMsg}`);
            }
        }

        // Send to subscribed customers
        const subscribers = await getSubscribers(location);
        if (subscribers.length > 0) {
            logger.info(`[Scheduler] Sending tomorrow's special to ${subscribers.length} subscribers for ${location}`);
            const WA_TOMORROWS_SPECIAL_TEMPLATE = process.env.WA_TOMORROWS_SPECIAL_TEMPLATE_NAME || 'tomorrows_special';
            const itemsList = tomorrowItems.map(i => `${i.name} - $${parseFloat(i.price).toFixed(2)}`).join(', ');

            for (const subscriber of subscribers) {
                try {
                    await axios.post(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                        messaging_product: 'whatsapp',
                        to: subscriber.phone,
                        type: 'template',
                        template: {
                            name: WA_TOMORROWS_SPECIAL_TEMPLATE,
                            language: { code: WA_TEMPLATE_LANGUAGE },
                            components: [
                                {
                                    type: 'header',
                                    parameters: [
                                        {
                                            type: 'image',
                                            image: { link: imageUrl }
                                        }
                                    ]
                                },
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

                    logger.info(`[Scheduler] Tomorrow's special sent to subscriber ${subscriber.phone} for ${location}`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    const errorMsg = error.response?.data?.error?.message || error.message;
                    logger.error(`[Scheduler] Failed to send tomorrow's special to subscriber ${subscriber.phone}: ${errorMsg}`);
                }
            }
        } else {
            logger.info(`[Scheduler] No subscribers found for ${location}`);
        }
    } catch (error) {
        logger.error(`[Scheduler] Error generating/sending tomorrow's special image: ${error.message}`);
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

/**
 * Party Orders Monthly CSV Report
 *
 * Runs on the 1st of every month. Pulls the PREVIOUS month's party orders from
 * Firestore (restaurants/{location}/partyOrders, filtered by cPartyDate), builds
 * a CSV matching the client-side export columns, and sends it to the owners via
 * WhatsApp as a document attachment.
 *
 * Uses the existing approved `party_order_invoice` document-header template
 * (Option 3): header = the CSV document, body params = [month label, order count].
 *
 * Returns null so the scheduler skips the default text-template send (this job
 * sends its own WhatsApp document message).
 */
async function party_orders_monthly_csv(job) {
    const location = job.location;
    logger.info(`[Scheduler] Running party_orders_monthly_csv for ${location}`);

    try {
        // ---- Previous month range (America/New_York) ----
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const startYmd = toYmd(firstOfLastMonth); // e.g. 2026-07-01
        const endYmd = toYmd(lastOfLastMonth);    // e.g. 2026-07-31
        const monthLabel = firstOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // ---- Read party orders for this location from Firestore ----
        // The `restaurants` doc id matches the location name used by the client
        // (e.g. "Nashua", "Westborough"). Config locations are upper-cased, so
        // try a few casings for the document id and use the first that has orders.
        const db = getFirestore();
        const candidateIds = [
            location.charAt(0).toUpperCase() + location.slice(1).toLowerCase(), // Nashua
            location,                                                            // NASHUA
            location.toLowerCase(),                                              // nashua
        ].filter((v, i, arr) => arr.indexOf(v) === i);

        let allOrders = [];
        let resolvedId = candidateIds[0];
        for (const candidate of candidateIds) {
            const snap = await db
                .collection('restaurants').doc(candidate)
                .collection('partyOrders').get();
            if (!snap.empty) {
                allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                resolvedId = candidate;
                break;
            }
        }
        const restaurantId = resolvedId;

        // Filter to the previous month by Party Date (string compare on YYYY-MM-DD is safe)
        const orders = allOrders.filter((o) => {
            const pd = (o.cPartyDate || '').slice(0, 10);
            return pd && pd >= startYmd && pd <= endYmd;
        });

        logger.info(`[Scheduler] party_orders_monthly_csv: ${restaurantId} ${monthLabel} -> ${orders.length} orders`);

        // ---- Build CSV (same columns as client export) ----
        const csv = buildPartyOrdersCsv(orders);

        // ---- Send CSV to owners via WhatsApp document (party_order_invoice template) ----
        await sendPartyOrdersCsvToOwners(location, csv, monthLabel, orders.length, job);

        return null; // skip the scheduler's default text send
    } catch (error) {
        logger.error(`[Scheduler] party_orders_monthly_csv error: ${error.message}`);
        return null;
    }
}

/**
 * Build a CSV string for party orders using the same columns/format as the
 * client-side export in client/src/components/Restaurant/PartyOrders/index.js.
 */
function buildPartyOrdersCsv(orders) {
    const headers = [
        'Invoice Number',
        'Customer Name',
        'Phone Number',
        'Order Date',
        'Party Date',
        'Order Delivery Time',
        'Party Order Status',
        'Party Order Payment Status',
        'Order Total',
        'Discount',
        'Payment Details',
        'Amount Due',
    ];

    const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

    // Party orders store cOrderTotal directly, so prefer it and fall back to items.
    const orderTotalOf = (o) => {
        if (o.cOrderTotal !== undefined && o.cOrderTotal !== null && o.cOrderTotal !== '') {
            return num(o.cOrderTotal);
        }
        const items = Array.isArray(o.cPartyOrderItems) ? o.cPartyOrderItems : [];
        return items.reduce((sum, it) => sum + num(it.price) * num(it.qty || it.itemQuantity), 0);
    };

    const amountDueOf = (o, total) => {
        const discountPct = num(o.cOrderDiscount);
        const discounted = total - (total * discountPct) / 100;
        const paid = (Array.isArray(o.cPartyOrderPaymentDetails) ? o.cPartyOrderPaymentDetails : [])
            .reduce((sum, p) => sum + num(p.amountPaid), 0);
        return discounted - paid;
    };

    const esc = (val) => {
        const s = val === undefined || val === null ? '' : String(val);
        // Quote if it contains comma, quote, or newline; escape embedded quotes.
        if (/[",\n]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const rows = orders.map((o) => {
        const total = orderTotalOf(o);
        const paymentDetails = (Array.isArray(o.cPartyOrderPaymentDetails) ? o.cPartyOrderPaymentDetails : [])
            .map((p) => `${p.paymentMode}: $${p.amountPaid}`)
            .join(', ');
        return [
            o.cInvoiceNumber,
            o.cName,
            o.cPhoneNumber,
            o.cOrderDate,
            o.cPartyDate,
            o.cOrderDeliveryTime,
            o.cPartyOrderStatus,
            o.cPartyOrderPaymentStatus,
            `$ ${total.toFixed(2)}`,
            `${num(o.cOrderDiscount)}%`,
            paymentDetails,
            `$ ${amountDueOf(o, total).toFixed(2)}`,
        ].map(esc).join(',');
    });

    return [headers.map(esc).join(','), ...rows].join('\n');
}

/**
 * Upload the CSV to the WhatsApp Media API and send it to the owners as a
 * document using the existing `party_order_invoice` template.
 */
async function sendPartyOrdersCsvToOwners(location, csv, monthLabel, orderCount, job) {
    const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
    const locationKey = location.toUpperCase();
    const phoneNumberId = locationKey === 'NASHUA'
        ? process.env.WA_PHONE_NUMBER_ID_NASHUA
        : (process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID);

    const recipients = (job.recipients && job.recipients.length > 0)
        ? job.recipients
        : (process.env.OWNER_PHONE_NUMBER || '').split(',').map((n) => n.trim()).filter(Boolean);

    if (!WA_ACCESS_TOKEN || !phoneNumberId) {
        logger.error(`[Scheduler] party_orders_monthly_csv: WhatsApp not configured for ${locationKey}`);
        return;
    }
    if (recipients.length === 0) {
        logger.error('[Scheduler] party_orders_monthly_csv: no owner recipients configured');
        return;
    }

    const safeMonth = monthLabel.replace(/\s+/g, '_');
    const fileName = `PartyOrders_${locationKey}_${safeMonth}.csv`;

    // Step 1: upload the CSV as media
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', Buffer.from(csv, 'utf8'), { filename: fileName, contentType: 'text/csv' });
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'text/csv');

    let mediaId;
    try {
        const mediaResponse = await axios.post(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
            form,
            { headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, ...form.getHeaders() } }
        );
        mediaId = mediaResponse.data.id;
    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        logger.error(`[Scheduler] party_orders_monthly_csv: media upload failed: ${msg}`);
        return;
    }

    if (!mediaId) {
        logger.error('[Scheduler] party_orders_monthly_csv: media upload returned no id');
        return;
    }

    const templateName = job.templateName || 'party_order_invoice';
    const templateLanguage = job.templateLanguage || process.env.WA_TEMPLATE_LANGUAGE || 'en';
    const messagesUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    // Step 2: send the template to each owner with the CSV as the document header.
    // party_order_invoice body has 2 text params; we pass [month label, order count].
    for (const recipient of recipients) {
        try {
            await axios.post(messagesUrl, {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: templateLanguage },
                    components: [
                        {
                            type: 'header',
                            parameters: [
                                { type: 'document', document: { id: mediaId, filename: fileName } },
                            ],
                        },
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: `${location} Party Orders - ${monthLabel}` },
                                { type: 'text', text: `${orderCount} orders` },
                            ],
                        },
                    ],
                },
            }, {
                headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            });

            logger.info(`[Scheduler] party_orders_monthly_csv: report sent to ${recipient} for ${location} (${monthLabel})`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
            const msg = error.response?.data?.error?.message || error.message;
            logger.error(`[Scheduler] party_orders_monthly_csv: failed to send to ${recipient}: ${msg}`);
        }
    }
}

/**
 * Bank Statement Upload Reminder
 *
 * Runs on the 1st of every month. Sends owners a WhatsApp reminder to upload the
 * PREVIOUS month's Bank of America statement CSV into the Bank Transactions page.
 *
 * Uses the scheduler's normal text-template path: returns two body params
 * [month label, upload link]. Configure `templateName` in schedulerConfig.json to
 * an approved 2-parameter text template.
 */
async function bank_statement_reminder(job) {
    const location = job.location;
    logger.info(`[Scheduler] Running bank_statement_reminder for ${location}`);

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthLabel = firstOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthKey = `${firstOfLastMonth.getFullYear()}-${String(firstOfLastMonth.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    const restaurantId = location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();

    // Stop reminding once the previous month's statement has been uploaded.
    // The Bank Transactions import stores a doc at
    // restaurants/{location}/bankTransactions/{YYYY-MM}. If it exists, skip.
    try {
        const db = getFirestore();
        const snap = await db
            .collection('restaurants').doc(restaurantId)
            .collection('bankTransactions').doc(monthKey).get();
        if (snap.exists) {
            logger.info(`[Scheduler] bank_statement_reminder: ${restaurantId} ${monthKey} already uploaded; skipping reminder`);
            return null; // scheduler skips the send
        }
    } catch (error) {
        // If the check fails, err on the side of still sending the reminder.
        logger.error(`[Scheduler] bank_statement_reminder: upload check failed (${error.message}); sending reminder anyway`);
    }

    const baseUrl = process.env.SERVER_PUBLIC_URL || 'https://repodepo.io';
    const uploadUrl = `${baseUrl}/dashboard/${restaurantId}/OtherServices/BankTransactions`;

    // Body params: {{1}}=month, {{2}}=upload link
    return [monthLabel, uploadUrl];
}

// ============================================================
// REGISTRY - Maps job IDs to implementation functions
// ============================================================

const jobRegistry = {
    daily_sales_summary,
    weekly_inventory_report,
    monthly_performance,
    yearly_review,
    nashua_daily_sales_summary,
    party_orders_monthly_csv,
    nashua_party_orders_monthly_csv: party_orders_monthly_csv,
    westborough_party_orders_monthly_csv: party_orders_monthly_csv,
    bank_statement_reminder,
    nashua_bank_statement_reminder: bank_statement_reminder,
    westborough_bank_statement_reminder: bank_statement_reminder
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
