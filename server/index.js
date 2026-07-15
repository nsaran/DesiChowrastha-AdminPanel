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
