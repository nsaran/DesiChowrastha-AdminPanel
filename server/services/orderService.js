const axios = require('axios');
const NodeCache = require('node-cache');
const { getAccessToken } = require('./authService');
const { toastApiBaseUrl, locations } = require('../config/config');
const { getItemCategoryMap } = require('./menuService');

const timeZoneOptions = { timeZone: 'America/New_York' };

// In-memory cache for the pending-orders result, keyed by location. Fetching
// pending orders hits the Toast API across multiple pages and returns a large
// payload, so caching for a short window keeps repeated polls (auto-refreshing
// Live Orders page, multiple kitchen tablets) from hammering Toast. Purely in
// memory — nothing is written to disk. TTL is 20 seconds.
const PENDING_ORDERS_TTL_SECONDS = 20;
const pendingOrdersCache = new NodeCache({ stdTTL: PENDING_ORDERS_TTL_SECONDS });

// Kitchen categories the Live Orders page should track. Only orders containing
// items from these exact Toast menu groups are shown, so the chef sees only
// food that needs cooking (appetizers, curries, wok, tandoor) and not drinks,
// desserts, or counter items. Values must match the Toast menu group names exactly.
const KITCHEN_CATEGORIES = new Set([
    'Veg Appetizers',
    'Non-Veg Appetizers',
    'Veg Curries',
    'Non-Veg Curries',
    'Indian Wok',
    'Tandoor',
]);

async function getOrders(location) {
    return "orders";
}

async function getOrdersBulk(location, page = 1, businessDate) {
    try {
        const today = new Date();
        const year = today.toLocaleString("default", { ...timeZoneOptions, year: "numeric" });
        const month = today.toLocaleString("default", { ...timeZoneOptions, month: "2-digit" });
        const day = today.toLocaleString("default", { ...timeZoneOptions, day: "2-digit" });
        businessDate = businessDate || year + month + day;

        const accessToken = await getAccessToken(location);
        const { restaurantExternalId } = locations[location];
        
        const response = await axios.get(`${toastApiBaseUrl}/orders/v2/ordersBulk`, {
            headers: {
                'Toast-Restaurant-External-ID': restaurantExternalId,
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                page,
                businessDate
            }
        });

        const orders = response.data.map(order => 
            order.checks.map(check => ({
                orderID: check.guid,
                orderGuid: order.guid,
                orderNumber: check.displayNumber,
                orderDetails: check.selections,
                payments: check.payments
            }))
        ).flat();
        
        return orders;
    } catch (err) {
        console.error(err);
        throw new Error('An error occurred while fetching bulk orders');
    }
}

async function getPendingOrders(location) {
    // Serve from the in-memory cache when a fresh (< TTL) result exists for this
    // location; otherwise fetch from Toast and cache it.
    const cacheKey = `pending:${location}`;
    const cached = pendingOrdersCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const allPending = await fetchPendingOrders(location);

    // Filter to kitchen categories only. Build a name→category map from the
    // cached menu (populated by the menu service; no extra Toast call if already
    // warm). Items whose category doesn't match any KITCHEN_CATEGORIES entry are
    // excluded so the chef sees only food that needs cooking.
    let filtered = allPending;
    try {
        const categoryMap = await getItemCategoryMap(location);
        console.log('[PendingOrders] categoryMap size:', categoryMap.size, 'for', location);
        if (categoryMap.size > 0) {
            const isKitchenCategory = (groupName) => KITCHEN_CATEGORIES.has(groupName);

            filtered = allPending
                .map((order) => ({
                    ...order,
                    items: order.items.filter((item) => {
                        const group = categoryMap.get((item.displayName || '').toLowerCase());
                        return group ? isKitchenCategory(group) : false;
                    }),
                }))
                .filter((order) => order.items.length > 0);
            console.log('[PendingOrders] filtered from', allPending.length, 'to', filtered.length, 'orders');
        }
    } catch (e) {
        console.error('[PendingOrders] category filter failed:', e.message);
        // Category map unavailable — fall back to the unfiltered list so the
        // page still shows something rather than nothing.
    }

    pendingOrdersCache.set(cacheKey, filtered);
    return filtered;
}

async function fetchPendingOrders(location) {
    let currentPage = 1;
    let pendingOrders = [];
    let dataExists = true;

    while (dataExists) {
        try {
            const orders = await getOrdersBulk(location, currentPage);
            if (orders.length === 0) {
                dataExists = false;
                continue;
            }

            orders.forEach(order => {
                const orderNumber = order.orderNumber;
                const pendingItems = order.orderDetails.filter(item => item.fulfillmentStatus === 'SENT');

                if (pendingItems.length > 0) {
                    pendingOrders.push({
                        orderID: order.orderID,
                        orderNumber,
                        items: pendingItems.map(item => ({
                            displayName: item.displayName,
                            quantity: item.quantity,
                            status: item.fulfillmentStatus
                        }))
                    });
                }
            });
            currentPage++;
        } catch (error) {
            console.error(error);
            throw new Error('An error occurred while fetching pending orders');
        }
    }
    return pendingOrders;
}

async function getCompletedOrders(location, req) {
    let currentPage = 1;
    let completedOrders = [];
    let dataExists = true;
    const alertRequired = req.query.noAlert === undefined;
    let index = 1;
    let completedOrdersList = "";

    while (dataExists) {
        try {
            const orders = await getOrdersBulk(location, currentPage);
            if (orders.length === 0) {
                dataExists = false;
                continue;
            }

            orders.forEach(order => {
                const orderNumber = order.orderNumber;

                // Cache every order's GUID for OrderStatus lookups
                if (!global.cacheData.has(orderNumber)) {
                    global.cacheData.set(orderNumber, { status: "FOUND", guid: order.orderGuid }, 43200);
                }

                const completedItems = order.orderDetails.filter(item => item.fulfillmentStatus === 'READY');

                if (completedItems.length > 0) {
                    completedOrders.push({
                        orderID: order.orderID,
                        orderNumber,
                        items: completedItems.map(item => ({
                            displayName: item.displayName,
                            quantity: item.quantity,
                            status: item.fulfillmentStatus
                        }))
                    });

                    if (alertRequired && !global.newOrderCacheData.has(orderNumber)) {
                        global.newOrderCacheData.set(orderNumber, { status: "READY", guid: order.orderGuid }, 43200);
                        completedOrdersList += `, #${orderNumber}`;
                        // setTimeout(notify, 10000 * index, orderNumber); // Uncomment if notify function is defined
                        index++;
                    }
                }
            });
            currentPage++;
        } catch (error) {
            console.error(error);
            throw new Error('An error occurred while fetching completed orders');
        }
    }

    console.log(completedOrdersList);
    return completedOrders.length ? completedOrders : `The following orders are completed recently: ${completedOrdersList}`;
}

// const getNotification = async (req, res) => {
//     const orderKeys = Array.from(global.newOrderCacheData.keys());

//     if (orderKeys.length > 0) {
//         const orderKey = orderKeys[0];
//         global.cacheData.set(orderKey, "READY", 43200);
//         global.newOrderCacheData.del(orderKey);

//         res.json([{ orderNum: orderKey }]);
//     } else {
//         res.json([]);
//     }
// };

const getNotification = async (req, res) => {
    const orderKeys = Array.from(global.newOrderCacheData.keys());

    if (orderKeys.length > 0) {
        const orders = orderKeys.map(orderKey => {
            const cachedValue = global.newOrderCacheData.get(orderKey);
            const guid = cachedValue?.guid || null;
            global.cacheData.set(orderKey, { status: "READY", guid }, 43200);
            global.newOrderCacheData.del(orderKey);

            return { orderNum: orderKey, guid };
        });

        res.json(orders);
    } else {
        res.json([]);
    }
};

const setNotification = async (req, res) => {
    const orderNumber = req.query.orderNum || '999';
    const guid = req.query.guid || null;
    global.newOrderCacheData.set(orderNumber, { status: "READY", guid }, 43200);

    const responseObject = {
        orderNum: orderNumber,
        guid
    };

    res.json([responseObject]);
};

module.exports = {
    getOrders,
    getOrdersBulk,
    getPendingOrders,
    getCompletedOrders,
    getNotification,
    setNotification
};
