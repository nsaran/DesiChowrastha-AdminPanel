const axios = require('axios');
const { getAccessToken } = require('./authService');
const { toastApiBaseUrl, locations } = require('../config/config');

const timeZoneOptions = { timeZone: 'America/New_York' };

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
                    global.cacheData.set(orderNumber, { status: "FOUND", guid: order.orderID }, 43200);
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
                        global.newOrderCacheData.set(orderNumber, { status: "READY", guid: order.orderID }, 43200);
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
