require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
