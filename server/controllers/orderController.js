const { getOrders, getOrdersBulk, getPendingOrders, getCompletedOrders, getNotification, setNotification } = require('../services/orderService');

module.exports = {
    getOrders: async (req, res) => {
        try {
            const location = req.query.location.toUpperCase();
            const orders = await getOrders(location);
            res.send(orders);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred');
        }
    },
    getOrdersBulk: async (req, res) => {
        try {
            const location = req.query.location.toUpperCase();
            const page = req.query.page;
            const date = req.query.date;
            const ordersBulk = await getOrdersBulk(location, page, date);
            res.send(ordersBulk);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred');
        }
    },
    getPendingOrders: async (req, res) => {
        try {
            const location = req.query.location.toUpperCase();
            // Optional ?categories=Tandoor,Breads to override the default kitchen
            // categories, so the same endpoint/page can show a different view.
            const categories = (req.query.categories || '')
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            const pendingOrders = await getPendingOrders(location, categories);
            res.send(pendingOrders);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred');
        }
    },
    getCompletedOrders: async (req, res) => {
        try {
            const location = req.query.location.toUpperCase();
            const completedOrders = await getCompletedOrders(location, req);
            res.send(completedOrders);
        } catch (err) {
            console.error(err);
            res.status(500).send('An error occurred');
        }
    },
    getNotification,
    setNotification
};
