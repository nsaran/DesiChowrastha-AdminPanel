require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { fetchMenu } = require('./controllers/menuController');
const { getOrders, getOrdersBulk, getPendingOrders, getCompletedOrders, getNotification, setNotification } = require('./controllers/orderController');
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

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
