require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { fetchMenu } = require('./controllers/menuController');
const { getOrders, getOrdersBulk, getPendingOrders, getCompletedOrders, getNotification, setNotification } = require('./controllers/orderController');
const { sendFeedbackToOwner } = require('./services/feedbackService');
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
        const { feedbackType, name, email, message, phone, location } = req.body;

        if (!feedbackType || !name || !message) {
            return res.status(400).json({ error: 'feedbackType, name, and message are required' });
        }

        const result = await sendFeedbackToOwner({ feedbackType, name, email, message, phone, location });
        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        logger.error('Feedback endpoint error:', error.message);
        res.status(500).json({ error: error.message });
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
});
