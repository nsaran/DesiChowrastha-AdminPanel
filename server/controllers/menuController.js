const { fetchMenuData } = require('../services/menuService');

async function fetchMenu(req, res) {
    try {
        const location = req.query.location.toUpperCase();
        const menuData = await fetchMenuData(location);
        res.json(menuData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    fetchMenu
};
