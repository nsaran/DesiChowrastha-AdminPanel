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

// Per-location working set of orders for incremental (delta) refresh.
// Instead of re-pulling the whole business day on every poll, we seed once with
// the full day, then fetch only orders modified since the last poll and merge
// them in. Each entry: location -> { orders: Map<orderID, orderSnapshot>,
// lastFetch: Date, businessDate: 'YYYYMMDD' }. In memory only.
const pendingWorkingSet = {};

// A small look-back added to the delta window so we never miss an order that was
// modified between fetches due to clock skew / processing lag.
const DELTA_OVERLAP_MS = 60 * 1000; // 1 minute

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

// Today's business date (YYYYMMDD) in the restaurant timezone.
function currentBusinessDate() {
    const today = new Date();
    const year = today.toLocaleString('default', { ...timeZoneOptions, year: 'numeric' });
    const month = today.toLocaleString('default', { ...timeZoneOptions, month: '2-digit' });
    const day = today.toLocaleString('default', { ...timeZoneOptions, day: '2-digit' });
    return `${year}${month}${day}`;
}

// Fetch ALL pages of orders for a given selection (business day or delta window)
// and return the raw flattened order snapshots.
async function fetchAllPages(location, { businessDate, dateRange } = {}) {
    let page = 1;
    const all = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const orders = await getOrdersBulk(location, page, businessDate, dateRange);
        if (!orders || orders.length === 0) break;
        all.push(...orders);
        page++;
    }
    return all;
}

// Merge order snapshots into the working set (keyed by orderID). Newer snapshots
// replace older ones, so a status change (e.g. SENT -> READY) overwrites the
// stale copy.
function upsertOrders(ws, orders) {
    orders.forEach((order) => {
        ws.orders.set(order.orderID, {
            orderID: order.orderID,
            orderGuid: order.orderGuid,
            orderNumber: order.orderNumber,
            orderDetails: order.orderDetails || [],
        });
    });
}

// Derive the list of orders that still have SENT (pending) items, from a
// working set. Fulfilled orders (no SENT items left) are naturally excluded.
function derivePending(ws) {
    const result = [];
    for (const order of ws.orders.values()) {
        const pendingItems = (order.orderDetails || []).filter((item) => item.fulfillmentStatus === 'SENT');
        if (pendingItems.length > 0) {
            result.push({
                orderID: order.orderID,
                orderNumber: order.orderNumber,
                items: pendingItems.map((item) => ({
                    displayName: item.displayName,
                    quantity: item.quantity,
                    status: item.fulfillmentStatus,
                })),
            });
        }
    }
    return result;
}

async function getPendingOrders(location) {
    // Serve from the short-lived response cache when fresh, so rapid polls don't
    // even trigger a delta fetch.
    const cacheKey = `pending:${location}`;
    const cached = pendingOrdersCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const allPending = await refreshPendingWorkingSet(location);

    // Filter to kitchen categories only, using the menu-derived name→category map.
    let filtered = allPending;
    try {
        const categoryMap = await getItemCategoryMap(location);
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
        }
    } catch (e) {
        // Category map unavailable — fall back to the unfiltered list.
    }

    pendingOrdersCache.set(cacheKey, filtered);
    return filtered;
}

/**
 * Refresh the per-location working set and return the current pending orders.
 * - Cold start (or new business day): seed with a full-day fetch.
 * - Warm: fetch only orders modified since the last poll (delta) and merge.
 * Returns the derived pending list (orders with SENT items).
 */
async function refreshPendingWorkingSet(location) {
    const today = currentBusinessDate();
    let ws = pendingWorkingSet[location];

    // (Re)seed on cold start or when the business day rolls over.
    if (!ws || ws.businessDate !== today) {
        ws = { orders: new Map(), lastFetch: null, businessDate: today };
        const dayOrders = await fetchAllPages(location, { businessDate: today });
        upsertOrders(ws, dayOrders);
        ws.lastFetch = new Date();
        pendingWorkingSet[location] = ws;
        return derivePending(ws);
    }

    // Warm: pull only what changed since the last fetch (minus a small overlap).
    const startDate = new Date(ws.lastFetch.getTime() - DELTA_OVERLAP_MS).toISOString();
    const endDate = new Date().toISOString();
    try {
        const delta = await fetchAllPages(location, { dateRange: { startDate, endDate } });
        upsertOrders(ws, delta);
        ws.lastFetch = new Date();
    } catch (e) {
        // On a delta failure, keep serving the existing working set rather than
        // failing the whole request.
        console.error('[PendingOrders] delta refresh failed:', e.message);
    }
    return derivePending(ws);
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

/**
 * Called when an order webhook (created/updated/fulfilled) arrives for a
 * location. Invalidates the short-lived response cache and forces the next
 * getPendingOrders() call to run a delta fetch immediately, so the Live Orders
 * prep summary reflects the change in near real time instead of waiting for the
 * next scheduled poll.
 */
function invalidatePendingOrders(location) {
    if (!location) return;
    pendingOrdersCache.del(`pending:${location}`);
    const ws = pendingWorkingSet[location];
    if (ws) {
        // Rewind lastFetch so the next refresh pulls a fresh delta window that
        // definitely includes this change.
        ws.lastFetch = new Date(Date.now() - DELTA_OVERLAP_MS);
    }
}

module.exports = {
    getOrders,
    getOrdersBulk,
    getPendingOrders,
    getCompletedOrders,
    getNotification,
    setNotification,
    invalidatePendingOrders
};
