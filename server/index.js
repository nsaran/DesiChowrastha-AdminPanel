const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const { fetchMenu } = require('./controllers/menuController');
const { getOrders, getOrdersBulk, getPendingOrders, getCompletedOrders, getNotification, setNotification } = require('./controllers/orderController');
const { sendFeedbackToOwner } = require('./services/feedbackService');
const { initializeScheduler, getJobs, upsertJob, deleteJob, triggerJob } = require('./services/scheduler/scheduler');
const { addSubscriber } = require('./services/googleSheetsService');
const NodeCache = require("node-cache");
const logger = require('./utils/logger');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3010;
const cache = new NodeCache({ stdTTL: 0 });
const newOrderCache = new NodeCache({ stdTTL: 0 });

global.cacheData = cache;
global.newOrderCacheData = newOrderCache;

// Force reload menu cache (clears raw menu cache so next request fetches fresh from Toast)
app.post('/api/menu/reload', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    const { clearMenuCache } = require('./services/menuService');
    clearMenuCache(location || null);
    const msg = location ? `Menu cache cleared for ${location}` : 'All menu caches cleared';
    logger.info(msg + ' — will reload from Toast on next request');
    res.json({ success: true, message: msg + '. Will reload on next request.' });
});

// Webhook: Receive stock updates from Toast
const stockSSEClients = [];

app.get('/api/stock/stream', (req, res) => {
    const location = (req.query.location || '').toUpperCase();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const client = { res, location };
    stockSSEClients.push(client);

    req.on('close', () => {
        const index = stockSSEClients.indexOf(client);
        if (index > -1) stockSSEClients.splice(index, 1);
    });
});

app.post('/api/stock/webhook', (req, res) => {
    try {
        const payload = req.body;
        const { handleStockWebhook, getOutOfStockLocation } = require('./services/menuService');
        const locationInfo = handleStockWebhook(payload);

        // Push stock update to connected SSE clients
        if (locationInfo) {
            stockSSEClients.forEach(client => {
                if (!client.location || client.location === locationInfo.location) {
                    client.res.write(`data: ${JSON.stringify({
                        type: locationInfo.eventType,
                        itemGuid: locationInfo.itemGuid,
                        itemName: locationInfo.itemName,
                        location: locationInfo.location
                    })}\n\n`);
                }
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Stock webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/menu', fetchMenu);
app.get('/api/orders', getOrders);
app.get('/api/bulkOrders', getOrdersBulk);
app.get('/api/pendingOrders', getPendingOrders);
app.get('/api/completedOrders', getCompletedOrders);
app.get('/api/completedOrders/notify', getNotification);
app.get('/api/completedOrders/setNotify', setNotification);

// Feedback endpoint - sends customer feedback to owner via WhatsApp
app.post('/api/feedback', async (req, res) => {
    try {
        const { feedbackType, name, email, message, phone, subscribePromo, location } = req.body;

        if (!feedbackType || !name || !message) {
            return res.status(400).json({ error: 'feedbackType, name, and message are required' });
        }

        // If customer opted in for promotions, save their contact
        if (subscribePromo && (email || phone)) {
            const locationKey = (location || 'WESTBOROUGH').toUpperCase();
            const subscribersKey = `promo_subscribers_${locationKey}`;
            const existing = cache.get(subscribersKey) || [];
            existing.push({
                name: name,
                email: email || '',
                phone: phone || '',
                subscribedAt: new Date().toISOString(),
                location: locationKey
            });
            cache.set(subscribersKey, existing);
            logger.info(`New promo subscriber: ${name} (${email || phone}) for ${locationKey}`);

            // Save to Google Sheets
            addSubscriber({ name, email: email || '', phone: phone || '', location: locationKey });
        }

        const result = await sendFeedbackToOwner({ feedbackType, name, email, message, phone, location });
        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        logger.error('Feedback endpoint error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get promotion subscribers for a location
app.get('/api/subscribers', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    const subscribersKey = `promo_subscribers_${location}`;
    const subscribers = cache.get(subscribersKey) || [];
    res.json(subscribers);
});

// Today's Special endpoint - returns only items within their validity period
app.get('/api/todaysSpecial', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    const showAll = req.query.all === 'true';
    const cacheKey = `todaysSpecial_${location}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        // If all=true (admin view), return all items regardless of dates
        if (showAll) {
            return res.json(cached);
        }
        // Otherwise filter by validity period
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const validItems = cached.filter(item => {
            return today >= item.startDate && today <= item.endDate;
        });
        return res.json(validItems);
    }

    // Return empty array if no specials set yet
    return res.json([]);
});

// Set Today's Special items (POST)
// Each item must have: name, price, startDate, endDate
// startDate and endDate are in YYYY-MM-DD format
app.post('/api/todaysSpecial', (req, res) => {
    const { location, items } = req.body;

    if (!location || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'location and items array are required' });
    }

    if (items.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 special items allowed' });
    }

    // Validate that each item has startDate and endDate
    for (const item of items) {
        if (!item.startDate || !item.endDate) {
            return res.status(400).json({ error: `Each item must have startDate and endDate. Missing for: ${item.name || 'unnamed item'}` });
        }
        if (item.endDate < item.startDate) {
            return res.status(400).json({ error: `endDate must be on or after startDate for: ${item.name || 'unnamed item'}` });
        }
    }

    const cacheKey = `todaysSpecial_${location.toUpperCase()}`;
    cache.set(cacheKey, items);
    logger.info(`Today's special updated for ${location}: ${items.map(i => `${i.name} (${i.startDate} to ${i.endDate})`).join(', ')}`);
    res.json({ success: true, items });
});

// WhatsApp Orders - receive and manage orders
const whatsappOrders = [];
global.whatsappOrders = whatsappOrders;
const sseClients = []; // Store SSE connections

// SSE endpoint - clients subscribe for real-time order updates
app.get('/api/whatsappOrders/stream', (req, res) => {
    const location = (req.query.location || '').toUpperCase();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const client = { res, location };
    sseClients.push(client);

    // Remove client on disconnect
    req.on('close', () => {
        const index = sseClients.indexOf(client);
        if (index > -1) sseClients.splice(index, 1);
    });
});

// Notify SSE clients of new/updated orders
function notifyClients(orderData, eventType) {
    sseClients.forEach(client => {
        if (!client.location || client.location === orderData.location) {
            client.res.write(`data: ${JSON.stringify({ type: eventType, order: orderData })}\n\n`);
        }
    });
}

// Receive WhatsApp order webhook
app.post('/api/whatsappOrders', (req, res) => {
    try {
        const payload = req.body;

        // Extract order details from the WhatsApp payload
        const interactive = payload.interactive || {};
        const action = interactive.action || {};
        const params = action.parameters || {};
        const order = params.order || {};
        const location = (payload.location || req.query.location || 'WESTBOROUGH').toUpperCase();

        const orderData = {
            id: params.reference_id || `ORD-${Date.now()}`,
            customerPhone: payload.to || 'Unknown',
            location: location,
            status: 'pending',
            items: (order.items || []).map(item => ({
                name: item.name,
                quantity: item.quantity,
                amount: item.amount ? (item.amount.value / (item.amount.offset || 100)).toFixed(2) : '0.00',
                retailerId: item.retailer_id
            })),
            subtotal: order.subtotal ? (order.subtotal.value / (order.subtotal.offset || 100)).toFixed(2) : '0.00',
            tax: order.tax ? (order.tax.value / (order.tax.offset || 100)).toFixed(2) : '0.00',
            shipping: order.shipping ? (order.shipping.value / (order.shipping.offset || 100)).toFixed(2) : '0.00',
            discount: order.discount ? (order.discount.value / (order.discount.offset || 100)).toFixed(2) : '0.00',
            totalAmount: params.total_amount ? (params.total_amount.value / (params.total_amount.offset || 100)).toFixed(2) : '0.00',
            currency: params.currency || 'USD',
            paymentType: params.payment_type || 'unknown',
            receivedAt: new Date().toISOString(),
            completedAt: null
        };

        whatsappOrders.push(orderData);
        notifyClients(orderData, 'new_order');
        logger.info(`WhatsApp order received for ${location}: ${orderData.id} - ${orderData.items.length} items, total: ${orderData.totalAmount}`);
        res.json({ success: true, order: orderData });
    } catch (error) {
        logger.error('WhatsApp order error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get WhatsApp orders filtered by location
app.get('/api/whatsappOrders', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    if (location) {
        res.json(whatsappOrders.filter(o => o.location === location));
    } else {
        res.json(whatsappOrders);
    }
});

// Mark an order as in preparation
app.post('/api/whatsappOrders/:orderId/preparation', (req, res) => {
    const order = whatsappOrders.find(o => o.id === req.params.orderId);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    order.status = 'preparation';
    order.preparationAt = new Date().toISOString();
    notifyClients(order, 'order_preparation');
    logger.info(`WhatsApp order in preparation: ${order.id}`);
    res.json({ success: true, order });
});

// Update toast order number on an order
app.post('/api/whatsappOrders/:orderId/toastOrder', (req, res) => {
    const order = whatsappOrders.find(o => o.id === req.params.orderId);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    const { toastOrderNumber } = req.body;
    order.toastOrderNumber = toastOrderNumber || '';
    notifyClients(order, 'order_updated');
    logger.info(`WhatsApp order ${order.id} linked to Toast order: ${toastOrderNumber}`);
    res.json({ success: true, order });
});

// Mark an order as completed
app.post('/api/whatsappOrders/:orderId/complete', (req, res) => {
    const order = whatsappOrders.find(o => o.id === req.params.orderId);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }
    order.status = 'completed';
    order.completedAt = new Date().toISOString();
    notifyClients(order, 'order_completed');
    logger.info(`WhatsApp order completed: ${order.id}`);
    res.json({ success: true, order });
});

// Order Status - find status of an order by order number (looks up guid from cache, then calls Toast API)
app.get('/api/orderStatus', async (req, res) => {
    const orderNumber = req.query.orderNum;
    const location = (req.query.location || 'WESTBOROUGH').toUpperCase();

    if (!orderNumber) {
        return res.status(400).json({ error: 'orderNum query parameter is required' });
    }

    // Look up guid from both caches
    let cachedValue = global.cacheData.get(orderNumber);
    if (!cachedValue) {
        cachedValue = global.newOrderCacheData.get(orderNumber);
    }
    let guid = cachedValue?.guid || null;

    // If not in cache, search today's orders
    if (!guid) {
        try {
            const { getAccessToken } = require('./services/authService');
            const { toastApiBaseUrl, locations } = require('./config/config');

            const accessToken = await getAccessToken(location);
            const { restaurantExternalId } = locations[location];

            let page = 1;
            let found = false;
            const today = new Date();
            const businessDate = today.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');

            while (!found) {
                const bulkResponse = await axios.get(`${toastApiBaseUrl}/orders/v2/ordersBulk`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Toast-Restaurant-External-ID': restaurantExternalId
                    },
                    params: { page, businessDate }
                });

                const orders = bulkResponse.data || [];
                if (orders.length === 0) break;

                for (const order of orders) {
                    for (const check of (order.checks || [])) {
                        if (check.displayNumber === orderNumber) {
                            guid = order.guid;
                            // Cache it for future lookups
                            global.cacheData.set(orderNumber, { status: "FOUND", guid }, 43200);
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
                page++;
            }
        } catch (searchError) {
            logger.error(`Order search error: ${searchError.message}`);
        }
    }

    if (!guid) {
        return res.status(404).json({ error: `Order #${orderNumber} not found. It may not exist for today.` });
    }

    try {
        const { getAccessToken } = require('./services/authService');
        const { toastApiBaseUrl, locations } = require('./config/config');

        const accessToken = await getAccessToken(location);
        const { restaurantExternalId } = locations[location];

        const response = await axios.get(`${toastApiBaseUrl}/orders/v2/orders/${guid}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Toast-Restaurant-External-ID': restaurantExternalId
            }
        });

        const order = response.data;
        const checks = (order.checks || []).map(check => ({
            orderNumber: check.displayNumber,
            status: check.paymentStatus,
            totalAmount: check.totalAmount,
            items: (check.selections || []).map(item => ({
                name: item.displayName,
                quantity: item.quantity,
                price: item.price,
                fulfillmentStatus: item.fulfillmentStatus
            }))
        }));

        res.json({
            guid: order.guid,
            orderNumber,
            displayNumber: order.displayNumber,
            source: order.source,
            status: (() => {
                const allItems = checks.flatMap(c => c.items);
                const allReady = allItems.length > 0 && allItems.every(item => item.fulfillmentStatus === 'READY');
                const hasSent = allItems.some(item => item.fulfillmentStatus === 'SENT');
                if (order.voided) return 'VOIDED';
                if (hasSent) return 'IN PROGRESS';
                if (allReady) return 'COMPLETED';
                return order.closedDate ? 'CLOSED' : 'OPEN';
            })(),
            openedDate: order.openedDate,
            closedDate: order.closedDate,
            checks
        });
    } catch (error) {
        logger.error(`Order status error: ${error.message}`);
        res.status(500).json({ error: `Failed to fetch order status: ${error.message}` });
    }
});

// Serve promo images list from _images/promos directory
app.get('/api/promos', (req, res) => {
    const promosDir = path.join(__dirname, '..', 'client', 'public', '_images', 'promos');
    fs.readdir(promosDir, (err, files) => {
        if (err) {
            logger.error('Error reading promos directory:', err);
            return res.status(500).json({ error: 'Unable to read promos directory' });
        }
        const jpgFiles = files.filter(file => /\.(jpg|jpeg)$/i.test(file));
        res.json(jpgFiles);
    });
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    // Initialize the scheduler after server starts
    initializeScheduler();
});

// ============================================================
// Scheduler API Endpoints
// ============================================================

// Get all scheduled jobs
app.get('/api/scheduler/jobs', (req, res) => {
    const jobs = getJobs();
    res.json(jobs);
});

// Create or update a job
app.post('/api/scheduler/jobs', (req, res) => {
    try {
        const jobData = req.body;
        if (!jobData.id || !jobData.name || !jobData.cronExpression || !jobData.templateName || !jobData.location) {
            return res.status(400).json({ error: 'id, name, cronExpression, templateName, and location are required' });
        }
        const job = upsertJob(jobData);
        res.json({ success: true, job });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a job
app.delete('/api/scheduler/jobs/:jobId', (req, res) => {
    try {
        deleteJob(req.params.jobId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manually trigger a job (for testing)
app.post('/api/scheduler/jobs/:jobId/trigger', async (req, res) => {
    try {
        await triggerJob(req.params.jobId);
        res.json({ success: true, message: `Job ${req.params.jobId} triggered` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
