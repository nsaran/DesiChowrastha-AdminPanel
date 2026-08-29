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
const userManagementRoutes = require('./routes/userManagement');

const app = express();
app.set('trust proxy', 1);
app.use(cors({
    origin: [
        'https://repodepo.io',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');

// Custom key generator that safely extracts the client IP, stripping any port.
// Handles cases where req.ip may include a port (e.g. "64.223.204.235:56259")
// or when running behind a proxy that sets X-Forwarded-For.
const ipKeyGenerator = (req) => {
    let ip = req.ip || req.socket?.remoteAddress || '';
    // Take the first IP if X-Forwarded-For has a comma-separated list
    if (ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }
    // Strip IPv4 port (e.g. "1.2.3.4:5678" -> "1.2.3.4"), but leave IPv6 intact
    const isIPv4WithPort = /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip);
    if (isIPv4WithPort) {
        ip = ip.split(':')[0];
    }
    // Normalize IPv6-mapped IPv4 (e.g. "::ffff:1.2.3.4")
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    return ip || 'unknown';
};

// General API rate limit: 100 requests per minute per IP
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: ipKeyGenerator,
    validate: { ip: false, trustProxy: false },
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', generalLimiter);

// User management routes (owner only, protected by Firebase Auth)
app.use('/api/users', userManagementRoutes);

// Strict limit for feedback: 5 per 15 minutes per IP
const feedbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: ipKeyGenerator,
    validate: { ip: false, trustProxy: false },
    message: { error: 'Too many feedback submissions. Please try again later.' }
});
app.use('/api/feedback', feedbackLimiter);

// Strict limit for order status: 20 per minute per IP
const orderStatusLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: ipKeyGenerator,
    validate: { ip: false, trustProxy: false },
    message: { error: 'Too many requests. Please wait a moment.' }
});
app.use('/api/orderStatus', orderStatusLimiter);

// Strict limit for AI chat: 10 questions per 15 minutes per IP
const aiChatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: ipKeyGenerator,
    validate: { ip: false, trustProxy: false },
    message: { error: 'Too many questions. Please try again in a few minutes.' }
});
app.use('/api/menu/ask', aiChatLimiter);

// Prevent caching on API responses
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
});

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
        // Verify webhook signature
        const crypto = require('crypto');
        const webhookSecret = process.env.TOAST_WEBHOOK_SECRET;

        if (webhookSecret) {
            const signature = req.headers['toast-signature'] || req.headers['x-toast-signature'] || '';
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(req.body))
                .digest('hex');

            if (signature !== expectedSignature) {
                logger.warn('Stock webhook rejected: invalid signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        const payload = req.body;
        const { handleStockWebhook } = require('./services/menuService');
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

// Order webhook - receive order status updates from Toast
const orderSSEClients = [];

app.get('/api/orders/stream', (req, res) => {
    const location = (req.query.location || '').toUpperCase();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const client = { res, location };
    orderSSEClients.push(client);

    req.on('close', () => {
        const index = orderSSEClients.indexOf(client);
        if (index > -1) orderSSEClients.splice(index, 1);
    });
});

app.post('/api/orders/webhook', (req, res) => {
    try {
        const payload = req.body;
        const { locations } = require('./config/config');

        // Extract order info from Toast webhook
        const orderGuid = payload.orderGuid || payload.guid || payload.details?.orderGuid;
        const eventType = payload.eventType || '';
        const restaurantGuid = payload.restaurantGuid || payload.details?.restaurantGuid;
        const status = payload.status || payload.details?.status || '';
        const displayNumber = payload.displayNumber || payload.details?.displayNumber || '';

        // Determine location
        let location = null;
        for (const [loc, config] of Object.entries(locations)) {
            if (config.restaurantExternalId === restaurantGuid) {
                location = loc;
                break;
            }
        }

        logger.info(`[OrderWebhook] ${location || 'UNKNOWN'}: Order ${displayNumber || orderGuid} - ${eventType} (${status})`);

        // Push to SSE clients if order is ready/completed
        const isReady = status === 'READY' || status === 'COMPLETED' ||
            eventType === 'ORDER_FULFILLMENT_UPDATE' ||
            eventType === 'ORDER_COMPLETED';

        if (isReady && location) {
            // Only push if this order hasn't been notified already
            const alreadyNotified = displayNumber && global.newOrderCacheData.has(displayNumber);
            
            if (!alreadyNotified) {
                orderSSEClients.forEach(client => {
                    if (!client.location || client.location === location) {
                        client.res.write(`data: ${JSON.stringify({
                            type: 'order_ready',
                            orderGuid,
                            orderNumber: displayNumber,
                            location,
                            status,
                            eventType
                        })}\n\n`);
                    }
                });
            }

            // Also cache the order number for the notify endpoint
            if (displayNumber) {
                global.newOrderCacheData.set(displayNumber, { status: "READY", guid: orderGuid }, 43200);
                global.cacheData.set(displayNumber, { status: "READY", guid: orderGuid }, 43200);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Order webhook error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/menu', fetchMenu);

// AI-powered menu item details (description + image)
app.get('/api/menu/item/:itemId', async (req, res) => {
    try {
        const { getMenuItemDetail } = require('./services/menuAIService');
        const { itemId } = req.params;
        const itemName = req.query.name || 'Unknown Dish';
        const itemType = req.query.type || 'dish';
        const category = req.query.category || '';

        const detail = await getMenuItemDetail(itemId, itemName, itemType, category);
        res.json(detail);
    } catch (error) {
        logger.error('Menu item detail error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Batch generate AI details for all menu items
app.post('/api/menu/generate-details', async (req, res) => {
    try {
        const { batchGenerateDetails } = require('./services/menuAIService');
        const { fetchMenuData } = require('./services/menuService');
        const location = (req.query.location || 'WESTBOROUGH').toUpperCase();

        const menuData = await fetchMenuData(location);
        const allItems = menuData.flatMap(menu =>
            (menu.menuGroups || []).flatMap(group => 
                (group.menuItems || []).map(item => ({ ...item, category: group.name }))
            )
        );

        logger.info(`[MenuAI] Starting batch generation for ${location}: ${allItems.length} items`);
        const result = await batchGenerateDetails(allItems);
        res.json(result);
    } catch (error) {
        logger.error('Batch generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// AI-powered menu Q&A
app.post('/api/menu/ask', async (req, res) => {
    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const { question, location } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // Get menu items for context
        const { fetchMenuData } = require('./services/menuService');
        const menuData = await fetchMenuData((location || 'WESTBOROUGH').toUpperCase());
        const menuItems = menuData.flatMap(menu =>
            (menu.menuGroups || []).flatMap(group =>
                (group.menuItems || []).map(item => `${item.name} ($${item.price}) [${item.itemType}]${item.isAvailable === false ? ' - SOLD OUT' : ''}`)
            )
        ).join('\n');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant at Desi Chowrastha Indian restaurant (${location} location). Answer questions about the menu briefly and helpfully. Here are the current menu items:\n\n${menuItems}\n\nKeep answers concise (2-3 sentences). If asked about allergens or ingredients, provide general Indian food knowledge. Be friendly and enthusiastic about the food.`
                },
                { role: 'user', content: question }
            ],
            max_tokens: 150,
            temperature: 0.7
        });

        res.json({ answer: response.choices[0].message.content.trim() });
    } catch (error) {
        logger.error('Menu ask error:', error.message);
        res.status(500).json({ error: error.message, answer: 'Sorry, I am unable to answer right now. Please ask our staff!' });
    }
});

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
    // Assign IDs to items that don't have one (for image caching)
    const itemsWithIds = items.map(item => ({
        ...item,
        id: item.id || `special-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    }));
    cache.set(cacheKey, itemsWithIds);
    logger.info(`Today's special updated for ${location}: ${itemsWithIds.map(i => `${i.name} (${i.startDate} to ${i.endDate})`).join(', ')}`);
    res.json({ success: true, items: itemsWithIds });
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

// ─── Facebook Posts (server-side proxy) ──────────────────────────────────────
// Fetches recent Facebook page posts using a server-side Page Access Token
// (kept secret in server/.env). Results are cached to avoid hitting the
// Graph API rate limits and to keep the TV displays fast.
//
// Required env vars:
//   FB_ACCESS_TOKEN  - a long-lived / never-expiring Page Access Token
//   FB_PAGE_ID       - the Facebook Page ID (default: Chowrastha Nashua)
//   FB_API_VERSION   - Graph API version (default: v23.0)
app.get('/api/facebook-posts', async (req, res) => {
    const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
    const FB_PAGE_ID = process.env.FB_PAGE_ID || '100541449603228';
    const FB_API_VERSION = process.env.FB_API_VERSION || 'v23.0';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 25);

    if (!FB_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'Facebook access token not configured on server' });
    }

    const cacheKey = `fb_posts_${FB_PAGE_ID}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json({ images: cached, cached: true });
    }

    try {
        const url = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/posts?fields=full_picture&limit=${limit}&access_token=${FB_ACCESS_TOKEN}`;
        const response = await axios.get(url);
        const images = (response.data.data || [])
            .filter(post => post.full_picture)
            .map(post => post.full_picture);

        // Cache for 1 hour (posts don't change often; TVs refresh periodically)
        cache.set(cacheKey, images, 60 * 60);
        res.json({ images, cached: false });
    } catch (error) {
        const fbError = error.response?.data?.error;
        logger.error('Facebook posts fetch failed:', fbError?.message || error.message);
        // Return empty list so the client falls back to local promos gracefully
        res.status(200).json({ images: [], error: fbError?.message || 'Failed to fetch Facebook posts' });
    }
});

// ─── Party Order Delete (owner only, server-enforced) ────────────────────────
// Soft-deletes a party order: copies it to `deletedPartyOrders`, then removes it
// from `partyOrders`. Protected so ONLY authenticated users with the 'owner'
// custom claim can perform the deletion (enforced on the server, not just the UI).
const partyOrderAuth = require('./middleware/auth');
const { getFirestore: getFirestoreForPartyOrders } = require('firebase-admin/firestore');
require('./config/firebaseAdmin'); // ensure Admin SDK is initialized

app.delete(
    '/api/party-orders/:restaurantId/:orderId',
    partyOrderAuth.verifyToken,
    partyOrderAuth.requireRole(['owner']),
    async (req, res) => {
        const { restaurantId, orderId } = req.params;
        try {
            const db = getFirestoreForPartyOrders();
            const orderRef = db
                .collection('restaurants').doc(restaurantId)
                .collection('partyOrders').doc(orderId);

            const snap = await orderRef.get();
            if (!snap.exists) {
                return res.status(404).json({ error: 'Party order not found' });
            }

            const orderData = snap.data();

            // Archive to deletedPartyOrders (soft delete), then remove the original
            await db
                .collection('restaurants').doc(restaurantId)
                .collection('deletedPartyOrders').doc(orderId)
                .set({ ...orderData, deletedAt: new Date().toISOString(), deletedBy: req.user.email || req.user.uid });

            await orderRef.delete();

            logger.info(`Party order ${orderId} deleted for ${restaurantId} by ${req.user.email || req.user.uid}`);
            res.json({ success: true });
        } catch (error) {
            logger.error('Party order delete failed:', error.message);
            res.status(500).json({ error: error.message });
        }
    }
);

// ─── Stock Order & Inventory Endpoints ───────────────────────────────────────

const stockOrderService = require('./services/stockOrderService');
const { sendStockOrderNotification } = require('./services/stockOrderNotification');

// Master stock list
app.get('/api/stock-orders/master', (req, res) => {
    res.json(stockOrderService.getMasterList());
});

app.put('/api/stock-orders/master', (req, res) => {
    stockOrderService.saveMasterList(req.body);
    res.json({ success: true });
});

app.post('/api/stock-orders/master/item', (req, res) => {
    const { category, itemName } = req.body;
    if (!category || !itemName) return res.status(400).json({ error: 'category and itemName required' });
    const master = stockOrderService.addItemToMaster(category, itemName);
    res.json({ success: true, master });
});

app.delete('/api/stock-orders/master/item', (req, res) => {
    const { category, itemName } = req.body;
    if (!category || !itemName) return res.status(400).json({ error: 'category and itemName required' });
    const master = stockOrderService.removeItemFromMaster(category, itemName);
    res.json({ success: true, master });
});

// Purchase orders
app.get('/api/stock-orders', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    if (!location) return res.status(400).json({ error: 'location required' });
    res.json(stockOrderService.getOrders(location));
});

app.post('/api/stock-orders', (req, res) => {
    const { location, orderedBy, items } = req.body;
    if (!location) return res.status(400).json({ error: 'location required' });
    const order = stockOrderService.createOrder(location, { orderedBy, items });
    // Notify chef and purchaser
    sendStockOrderNotification(location, order, 'created', 'both');
    res.json({ success: true, order });
});

app.get('/api/stock-orders/:orderId', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    if (!location) return res.status(400).json({ error: 'location required' });
    const order = stockOrderService.getOrderById(location, req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
});

app.put('/api/stock-orders/:orderId', (req, res) => {
    const location = (req.query.location || req.body.location || '').toUpperCase();
    if (!location) return res.status(400).json({ error: 'location required' });
    const order = stockOrderService.updateOrder(location, req.params.orderId, req.body);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Notify on status change
    if (req.body.status) {
        const notifyRole = req.body.status === 'submitted' ? 'purchaser' :
                           req.body.status === 'purchased' ? 'chef' :
                           req.body.status === 'received' ? 'chef' : 'both';
        sendStockOrderNotification(location, order, req.body.status, notifyRole);
    }
    res.json({ success: true, order });
});

app.post('/api/stock-orders/:orderId/close', (req, res) => {
    const location = (req.query.location || req.body.location || '').toUpperCase();
    if (!location) return res.status(400).json({ error: 'location required' });
    const order = stockOrderService.closeOrder(location, req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Notify both
    sendStockOrderNotification(location, order, 'closed', 'both');
    res.json({ success: true, order });
});

app.delete('/api/stock-orders/:orderId', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    if (!location) return res.status(400).json({ error: 'location required' });
    stockOrderService.deleteOrder(location, req.params.orderId);
    res.json({ success: true });
});

// Receipt upload
const multer = require('multer');
const RECEIPTS_DIR = path.join(__dirname, 'data', 'receipts');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const receiptStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const orderId = req.params.orderId;
        const orderDir = path.join(RECEIPTS_DIR, orderId);
        if (!fs.existsSync(orderDir)) fs.mkdirSync(orderDir, { recursive: true });
        cb(null, orderDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `receipt-${timestamp}${ext}`);
    }
});
const receiptUpload = multer({ storage: receiptStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// Upload receipt(s) for an order
app.post('/api/stock-orders/:orderId/receipts', receiptUpload.array('receipts', 5), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    const files = req.files.map(f => ({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        uploadedAt: new Date().toISOString()
    }));
    logger.info(`[Receipts] ${files.length} receipt(s) uploaded for order ${req.params.orderId}`);
    res.json({ success: true, files });
});

// List receipts for an order
app.get('/api/stock-orders/:orderId/receipts', (req, res) => {
    const orderDir = path.join(RECEIPTS_DIR, req.params.orderId);
    if (!fs.existsSync(orderDir)) {
        return res.json([]);
    }
    const files = fs.readdirSync(orderDir).map(filename => {
        const stats = fs.statSync(path.join(orderDir, filename));
        return {
            filename,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            url: `/api/stock-orders/${req.params.orderId}/receipts/${filename}`
        };
    });
    res.json(files);
});

// Serve a specific receipt file
app.get('/api/stock-orders/:orderId/receipts/:filename', (req, res) => {
    const filePath = path.join(RECEIPTS_DIR, req.params.orderId, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
});

// Inventory
app.get('/api/inventory', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    if (!location) return res.status(400).json({ error: 'location required' });
    res.json(stockOrderService.getLocationInventory(location));
});

app.post('/api/inventory/usage', (req, res) => {
    const { location, itemName, quantity, note } = req.body;
    if (!location || !itemName || !quantity) return res.status(400).json({ error: 'location, itemName, quantity required' });
    stockOrderService.logUsage(location, itemName, quantity, note);
    res.json({ success: true });
});

// ─── Digital Signage Endpoints ───────────────────────────────────────────────

const signageSSEClients = [];
const SIGNAGE_DATA_PATH = path.join(__dirname, 'data', 'signage-playlists.json');

// Load playlists from disk into cache on startup
function loadSignagePlaylists() {
    try {
        if (fs.existsSync(SIGNAGE_DATA_PATH)) {
            const data = JSON.parse(fs.readFileSync(SIGNAGE_DATA_PATH, 'utf8'));
            if (Array.isArray(data)) {
                data.forEach(playlist => {
                    const cacheKey = `signage_${playlist.location}_${playlist.tvId}`;
                    cache.set(cacheKey, playlist, 0);
                });
                logger.info(`[Signage] Loaded ${data.length} playlists from disk`);
            }
        }
    } catch (e) {
        logger.error(`[Signage] Error loading playlists from disk: ${e.message}`);
    }
}

// Save all playlists from cache to disk
function saveSignagePlaylists() {
    try {
        const keys = cache.keys().filter(k => k.startsWith('signage_'));
        const playlists = keys.map(k => cache.get(k)).filter(Boolean);
        const dir = path.dirname(SIGNAGE_DATA_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SIGNAGE_DATA_PATH, JSON.stringify(playlists, null, 2));
    } catch (e) {
        logger.error(`[Signage] Error saving playlists to disk: ${e.message}`);
    }
}

loadSignagePlaylists();

// Get playlist for a specific TV
app.get('/api/signage/playlist', (req, res) => {
    const tvId = req.query.tvId || 'default';
    const location = (req.query.location || '').toUpperCase();
    const cacheKey = `signage_${location}_${tvId}`;
    const playlist = cache.get(cacheKey);
    res.json(playlist || { tvId, location, items: [] });
});

// Save/update playlist for a specific TV
app.post('/api/signage/playlist', (req, res) => {
    const { tvId, location, items } = req.body;
    if (!tvId || !location) {
        return res.status(400).json({ error: 'tvId and location are required' });
    }
    const cacheKey = `signage_${location.toUpperCase()}_${tvId}`;
    const playlist = { tvId, location: location.toUpperCase(), items: items || [] };
    cache.set(cacheKey, playlist, 0); // No expiry
    logger.info(`[Signage] Playlist updated for ${location}/${tvId}: ${items.length} items`);
    saveSignagePlaylists();

    // Notify connected SSE clients for this TV
    signageSSEClients.forEach(client => {
        if (client.tvId === tvId && client.location === location.toUpperCase()) {
            client.res.write(`data: ${JSON.stringify({ type: 'playlist_update', playlist })}\n\n`);
        }
    });

    res.json({ success: true, playlist });
});

// List all playlists for a location
app.get('/api/signage/playlists', (req, res) => {
    const location = (req.query.location || '').toUpperCase();
    const keys = cache.keys().filter(k => k.startsWith(`signage_${location}_`));
    const playlists = keys.map(k => cache.get(k)).filter(Boolean);
    res.json(playlists);
});

// Delete a playlist
app.delete('/api/signage/playlist', (req, res) => {
    const tvId = req.query.tvId;
    const location = (req.query.location || '').toUpperCase();
    if (!tvId || !location) {
        return res.status(400).json({ error: 'tvId and location are required' });
    }
    const cacheKey = `signage_${location}_${tvId}`;
    cache.del(cacheKey);
    logger.info(`[Signage] Playlist deleted for ${location}/${tvId}`);
    saveSignagePlaylists();
    res.json({ success: true });
});

// SSE stream for signage player - receives live playlist updates
app.get('/api/signage/stream', (req, res) => {
    const tvId = req.query.tvId || 'default';
    const location = (req.query.location || '').toUpperCase();

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', tvId, location })}\n\n`);

    const client = { res, tvId, location };
    signageSSEClients.push(client);

    req.on('close', () => {
        const index = signageSSEClients.indexOf(client);
        if (index > -1) signageSSEClients.splice(index, 1);
    });
});

// Send invoice PDF to customer via WhatsApp Business API
const invoiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const { verifyToken, requireRole } = require('./middleware/auth');

app.post('/api/send-invoice-whatsapp', verifyToken, requireRole(['owner']), invoiceUpload.single('pdf'), async (req, res) => {
    try {
        const { phoneNumber, customerName, invoiceNumber, location, recipient } = req.body;

        if (!phoneNumber || !location || !req.file) {
            return res.status(400).json({ error: 'phoneNumber, location, and pdf file are required' });
        }

        const locationKey = location.toUpperCase();
        const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
        const phoneNumberId = locationKey === 'NASHUA'
            ? process.env.WA_PHONE_NUMBER_ID_NASHUA
            : (process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID);

        if (!WA_ACCESS_TOKEN || !phoneNumberId) {
            logger.error(`WhatsApp API not configured for location: ${locationKey}`);
            return res.status(500).json({ error: `WhatsApp API not configured for ${locationKey}` });
        }

        // Step 1: Upload PDF to WhatsApp Media API
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: `Invoice_${invoiceNumber || 'DC'}.pdf`,
            contentType: 'application/pdf'
        });
        formData.append('messaging_product', 'whatsapp');
        formData.append('type', 'application/pdf');

        const mediaResponse = await axios.post(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
                    ...formData.getHeaders()
                }
            }
        );

        const mediaId = mediaResponse.data.id;
        if (!mediaId) {
            return res.status(500).json({ error: 'Failed to upload PDF to WhatsApp Media API' });
        }

        logger.info(`Invoice PDF uploaded to WhatsApp Media. Media ID: ${mediaId}`);

        // Step 2: Determine recipient phone number(s)
        let recipients = [];
        if (recipient === 'owner') {
            const ownerNumbers = (process.env.OWNER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);
            if (ownerNumbers.length === 0) {
                return res.status(400).json({ error: 'OWNER_PHONE_NUMBER not configured' });
            }
            recipients = ownerNumbers;
        } else {
            recipients = [phoneNumber];
        }

        // Step 3: Send template message with media_id
        const messagesUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
        const results = [];

        for (const recipientPhone of recipients) {
            const payload = {
                messaging_product: 'whatsapp',
                to: recipientPhone,
                type: 'template',
                template: {
                    name: 'party_order_invoice',
                    language: { code: process.env.WA_TEMPLATE_LANGUAGE || 'en' },
                    components: [
                        {
                            type: 'header',
                            parameters: [
                                {
                                    type: 'document',
                                    document: {
                                        id: mediaId,
                                        filename: `Invoice_${invoiceNumber || 'DC'}.pdf`
                                    }
                                }
                            ]
                        },
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: customerName || 'Customer' },
                                { type: 'text', text: invoiceNumber || '' }
                            ]
                        }
                    ]
                }
            };

            try {
                const response = await axios.post(messagesUrl, payload, {
                    headers: {
                        'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });
                const messageId = response.data.messages?.[0]?.id;
                logger.info(`Invoice WhatsApp sent to ${recipientPhone} for invoice #${invoiceNumber}. Message ID: ${messageId}`);
                results.push({ phone: recipientPhone, success: true, messageId });
            } catch (sendError) {
                const errorMsg = sendError.response?.data?.error?.message || sendError.message;
                logger.error(`Failed to send invoice to ${recipientPhone}: ${errorMsg}`);
                results.push({ phone: recipientPhone, success: false, error: errorMsg });
            }
        }

        const successCount = results.filter(r => r.success).length;
        if (successCount === 0) {
            return res.status(500).json({ error: 'Failed to send invoice to all recipients' });
        }

        res.json({ success: true, results });
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        logger.error(`Failed to send invoice via WhatsApp: ${errorMsg}`);
        res.status(500).json({ error: errorMsg });
    }
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
