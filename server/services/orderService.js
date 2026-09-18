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

async function getOrdersBulk(location, page = 1, businessDate, dateRange) {
    try {
        const accessToken = await getAccessToken(location);
        const { restaurantExternalId } = locations[location];

        // Two mutually-exclusive Toast selection modes:
        //  - startDate/endDate (ISO-8601 UTC): orders created OR modified in the
        //    window, by modification time. Used for incremental (delta) refresh.
        //  - businessDate (YYYYMMDD): all of a business day, by creation date.
        const params = { page };
        if (dateRange && dateRange.startDate && dateRange.endDate) {
            params.startDate = dateRange.startDate;
            params.endDate = dateRange.endDate;
        } else {
            const today = new Date();
            const year = today.toLocaleString("default", { ...timeZoneOptions, year: "numeric" });
            const month = today.toLocaleString("default", { ...timeZoneOptions, month: "2-digit" });
            const day = today.toLocaleString("default", { ...timeZoneOptions, day: "2-digit" });
            params.businessDate = businessDate || year + month + day;
        }

        const response = await axios.get(`${toastApiBaseUrl}/orders/v2/ordersBulk`, {
            headers: {
                'Toast-Restaurant-External-ID': restaurantExternalId,
                'Authorization': `Bearer ${accessToken}`
            },
            params
        });

        const orders = response.data.map(order => 
            order.checks.map(check => ({
                orderID: check.guid,
                orderGuid: order.guid,
                orderNumber: check.displayNumber,
                orderDetails: check.selections,
                payments: check.payments,
                // When the order was placed (ISO-8601 UTC). Used to sort the
                // kitchen queue by arrival and compute each order's wait time.
                openedDate: order.openedDate || order.createdDate || check.openedDate || order.modifiedDate || null,
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
            openedDate: order.openedDate || null,
        });
    });
}

// Recursively collect applied modifier/option display names from a selection's
// `modifiers` array. Modifiers can be nested (a modifier can have its own
// modifiers), so we walk the whole tree. Returns a flat array of strings, e.g.
// ["Medium", "Extra Onion"].
function flattenModifiers(modifiers) {
    const names = [];
    const walk = (mods) => {
        if (!Array.isArray(mods)) return;
        for (const m of mods) {
            if (m && m.displayName) names.push(m.displayName);
            if (m && Array.isArray(m.modifiers) && m.modifiers.length) walk(m.modifiers);
        }
    };
    walk(modifiers);
    return names;
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
                openedDate: order.openedDate || null,
                items: pendingItems.map((item) => ({
                    displayName: item.displayName,
                    quantity: item.quantity,
                    status: item.fulfillmentStatus,
                    // Applied modifiers/options (spice level, add-ons, etc.).
                    // Modifiers can be nested arbitrarily deep; flatten to a list
                    // of their display names so the chef sees every option.
                    modifiers: flattenModifiers(item.modifiers),
                })),
            });
        }
    }
    return result;
}

/**
 * @param {string} location
 * @param {string[]} [categoriesOverride] - optional list of Toast menu group
 *   names to filter by. When omitted, the default KITCHEN_CATEGORIES set is used
 *   (Veg/Non-Veg Appetizers, Curries, Indian Wok, Tandoor). Lets the same page
 *   serve other category views (e.g. ?categories=Tandoor,Breads).
 */
async function getPendingOrders(location, categoriesOverride) {
    // Normalize the requested categories into a Set for matching, and a stable
    // string for the cache key so different category views don't collide.
    const hasOverride = Array.isArray(categoriesOverride) && categoriesOverride.length > 0;
    const categorySet = hasOverride ? new Set(categoriesOverride) : KITCHEN_CATEGORIES;
    const catKey = hasOverride
        ? [...categorySet].map((c) => c.toLowerCase()).sort().join('|')
        : 'default';

    // Serve from the short-lived response cache when fresh, so rapid polls don't
    // even trigger a delta fetch. Keyed by location + the category view.
    const cacheKey = `pending:${location}:${catKey}`;
    const cached = pendingOrdersCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const allPending = await refreshPendingWorkingSet(location);

    // Filter to the requested categories, using the menu-derived name→category map.
    let filtered = allPending;
    try {
        const categoryMap = await getItemCategoryMap(location);
        if (categoryMap.size > 0) {
            filtered = allPending
                .map((order) => ({
                    ...order,
                    items: order.items.filter((item) => {
                        const group = categoryMap.get((item.displayName || '').toLowerCase());
                        return group ? categorySet.has(group) : false;
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
 * Return the current pending orders for a location by fetching the full business
 * day fresh each time and deriving the still-SENT items.
 *
 * Why a full-day fetch instead of an incremental delta merge: the live queue's
 * key event is REMOVAL (an item goes SENT -> READY when fulfilled). A delta that
 * only pulls recently-modified orders can't reliably remove an order that was
 * fulfilled outside the delta window, so stale "pending" tickets accumulated and
 * the board looked like it wasn't refreshing. A full-day fetch is the source of
 * truth: fulfilled orders simply aren't SENT anymore and drop off, and new
 * orders appear. The 20s response cache keeps this from hammering Toast even
 * when several kitchen tablets poll at once.
 */
async function refreshPendingWorkingSet(location) {
    const today = currentBusinessDate();
    const ws = { orders: new Map(), lastFetch: new Date(), businessDate: today };
    const dayOrders = await fetchAllPages(location, { businessDate: today });
    upsertOrders(ws, dayOrders);
    pendingWorkingSet[location] = ws; // kept for the webhook-invalidation hook
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
