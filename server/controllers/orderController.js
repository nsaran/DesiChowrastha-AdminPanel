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
            // Optional category override so the same page can show a different view.
            // Accepts any of these URL forms:
            //   ?categories=Tandoor&categories=Breads   (repeated param — Express gives an array)
            //   ?categories=Tandoor,Breads              (comma-separated)
            //   ?categories=Tandoor|Breads              (pipe-separated)
            const raw = req.query.categories;
            const categories = (Array.isArray(raw) ? raw : [raw])
                .filter(Boolean)
                .flatMap((v) => String(v).split(/[,|]/))
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
