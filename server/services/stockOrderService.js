const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MASTER_PATH = path.join(DATA_DIR, 'stock-master.json');
const ORDERS_DIR = path.join(DATA_DIR, 'stock-orders');
const INVENTORY_PATH = path.join(DATA_DIR, 'inventory.json');

// Ensure directories exist
if (!fs.existsSync(ORDERS_DIR)) fs.mkdirSync(ORDERS_DIR, { recursive: true });

// ─── Master Stock List ───────────────────────────────────────────────────────

function getMasterList() {
    try {
        return JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));
    } catch (e) {
        return { categories: [] };
    }
}

function saveMasterList(data) {
    fs.writeFileSync(MASTER_PATH, JSON.stringify(data, null, 2));
}

function addItemToMaster(category, itemName) {
    const master = getMasterList();
    const cat = master.categories.find(c => c.name === category);
    if (cat) {
        if (!cat.items.includes(itemName)) {
            cat.items.push(itemName);
            saveMasterList(master);
        }
    } else {
        master.categories.push({ name: category, items: [itemName] });
        saveMasterList(master);
    }
    return master;
}

function removeItemFromMaster(category, itemName) {
    const master = getMasterList();
    const cat = master.categories.find(c => c.name === category);
    if (cat) {
        cat.items = cat.items.filter(i => i !== itemName);
        saveMasterList(master);
    }
    return master;
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────

function getOrdersFilePath(location) {
    return path.join(ORDERS_DIR, `${location.toLowerCase()}-orders.json`);
}

function getOrders(location) {
    const filePath = getOrdersFilePath(location);
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveOrders(location, orders) {
    const filePath = getOrdersFilePath(location);
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
}

function createOrder(location, orderData) {
    const orders = getOrders(location);
    const order = {
        id: crypto.randomBytes(4).toString('hex'),
        location: location.toUpperCase(),
        status: 'draft', // draft, submitted, purchased, received, closed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        orderedBy: orderData.orderedBy || '',
        receivedBy: '',
        items: (orderData.items || []).map(item => ({
            name: item.name,
            category: item.category,
            ordered: item.ordered || '',
            received: '',
            remarks: ''
        }))
    };
    orders.unshift(order);
    saveOrders(location, orders);
    logger.info(`[StockOrder] Created order ${order.id} for ${location}`);
    return order;
}

function getOrderById(location, orderId) {
    const orders = getOrders(location);
    return orders.find(o => o.id === orderId) || null;
}

function updateOrder(location, orderId, updates) {
    const orders = getOrders(location);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;

    const order = orders[idx];

    // Update allowed fields based on status
    if (updates.status) order.status = updates.status;
    if (updates.orderedBy) order.orderedBy = updates.orderedBy;
    if (updates.receivedBy) order.receivedBy = updates.receivedBy;
    if (updates.items) order.items = updates.items;
    order.updatedAt = new Date().toISOString();

    orders[idx] = order;
    saveOrders(location, orders);
    logger.info(`[StockOrder] Updated order ${orderId} for ${location} → ${order.status}`);
    return order;
}

function closeOrder(location, orderId) {
    const orders = getOrders(location);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;

    const order = orders[idx];
    order.status = 'closed';
    order.closedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    orders[idx] = order;
    saveOrders(location, orders);

    // Add received items to inventory
    addToInventory(location, order);

    logger.info(`[StockOrder] Closed order ${orderId} for ${location}`);
    return order;
}

function deleteOrder(location, orderId) {
    let orders = getOrders(location);
    orders = orders.filter(o => o.id !== orderId);
    saveOrders(location, orders);
    logger.info(`[StockOrder] Deleted order ${orderId} for ${location}`);
}

// ─── Inventory Tracking ──────────────────────────────────────────────────────

function getInventory() {
    try {
        return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveInventory(data) {
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(data, null, 2));
}

function addToInventory(location, order) {
    const inventory = getInventory();
    const key = location.toUpperCase();

    if (!inventory[key]) inventory[key] = {};

    order.items.forEach(item => {
        if (!item.received) return; // Skip items not received

        if (!inventory[key][item.name]) {
            inventory[key][item.name] = {
                category: item.category,
                totalReceived: item.received,
                history: []
            };
        } else {
            inventory[key][item.name].totalReceived += ` + ${item.received}`;
        }

        inventory[key][item.name].history.push({
            orderId: order.id,
            date: order.closedAt || new Date().toISOString(),
            ordered: item.ordered,
            received: item.received,
            remarks: item.remarks
        });
    });

    saveInventory(inventory);
}

function getLocationInventory(location) {
    const inventory = getInventory();
    return inventory[location.toUpperCase()] || {};
}

function logUsage(location, itemName, quantity, note) {
    const inventory = getInventory();
    const key = location.toUpperCase();

    if (!inventory[key]) inventory[key] = {};
    if (!inventory[key][itemName]) {
        inventory[key][itemName] = { category: '', totalReceived: '0', history: [] };
    }

    inventory[key][itemName].history.push({
        type: 'usage',
        date: new Date().toISOString(),
        quantity,
        note
    });

    saveInventory(inventory);
}

module.exports = {
    getMasterList,
    saveMasterList,
    addItemToMaster,
    removeItemFromMaster,
    getOrders,
    createOrder,
    getOrderById,
    updateOrder,
    closeOrder,
    deleteOrder,
    getLocationInventory,
    logUsage
};
