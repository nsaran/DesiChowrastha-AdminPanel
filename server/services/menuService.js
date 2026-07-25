const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getAccessToken } = require('./authService');
const { toastApiBaseUrl, locations } = require('../config/config');
const logger = require('../utils/logger');

const retryDelay = (retryCount) => Math.pow(2, retryCount) * 1000;

// Cache for Westborough stock and menu data
let westboroughStockCache = null;       // Last known stock response
let westboroughMenuCache = null;        // Last known processed menu response
let westboroughRawMenuCache = null;     // Raw menu response from Toast (fetched once)

// Cache for Nashua menu data
let nashuaMenuCache = null;             // Last known processed menu response
let nashuaRawMenuCache = null;          // Raw menu response from Toast (fetched once)
let nashuaStockCache = null;            // Last known stock response for Nashua

// Webhook-based stock tracking (item GUIDs that are out of stock)
const outOfStockByLocation = {
    WESTBOROUGH: new Set(),
    NASHUA: new Set()
};

function determineItemType(itemName) {
    const nonVegKeywords = ['boneless', 'non-veg', 'chicken', 'mutton', 'goat', 'fish', 'shrimp', 'beef', 'pork', 'keema', 'haleem', 'mandi'];
    const eggKeywords = ['egg', 'omelette'];

    itemName = itemName.toLowerCase();
    if (nonVegKeywords.some(keyword => itemName.includes(keyword))) {
        return 'Non-Veg';
    } else if (eggKeywords.some(keyword => itemName.includes(keyword))) {
        return 'Egg';
    } else {
        return 'Veg';
    }
}

function determineSpiceLevel(itemTags) {
    if (!itemTags) {
        return undefined;
    }
    const spiceTag = itemTags.find(tag => tag.name.toLowerCase() === 'mild' || tag.name.toLowerCase() === 'medium' || tag.name.toLowerCase() === 'spicy');
    return spiceTag ? spiceTag.name : undefined;
}

/**
 * Fetch stock inventory and compare with cached version.
 * Returns { changed: boolean, stockData: array }
 */
async function fetchAndCompareStock(location) {
    const { restaurantExternalId } = locations[location];
    const accessToken = await getAccessToken(location);
    const requestOptions = {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantExternalId
        }
    };

    const stockResponse = await axios.get(`${toastApiBaseUrl}/stock/v1/inventory`, requestOptions);
    const newStockData = stockResponse.data;

    // Get the correct cache based on location
    const cachedStock = location === 'NASHUA' ? nashuaStockCache : westboroughStockCache;

    // Compare with cached stock
    const newStockString = JSON.stringify(newStockData);
    const cachedStockString = JSON.stringify(cachedStock);

    if (newStockString === cachedStockString) {
        return { changed: false, stockData: newStockData };
    }

    // Stock has changed, update cache
    if (location === 'NASHUA') {
        nashuaStockCache = newStockData;
    } else {
        westboroughStockCache = newStockData;
    }
    return { changed: true, stockData: newStockData };
}

/**
 * Handle stock webhook from Toast
 * Receives out_of_stock or in_stock events and updates the local stock tracking
 */
function handleStockWebhook(payload) {
    const { eventType, details } = payload;

    if (!details || !details.itemGuid || !details.restaurantGuid) {
        logger.warn('[StockWebhook] Invalid payload received');
        return;
    }

    // Determine location from restaurantGuid
    const { locations } = require('../config/config');
    let location = null;
    for (const [loc, config] of Object.entries(locations)) {
        if (config.restaurantExternalId === details.restaurantGuid) {
            location = loc;
            break;
        }
    }

    if (!location) {
        logger.warn(`[StockWebhook] Unknown restaurant GUID: ${details.restaurantGuid}`);
        return;
    }

    const itemGuid = details.itemGuid;

    if (eventType === 'out_of_stock' || details.status === 'OUT_OF_STOCK') {
        outOfStockByLocation[location].add(itemGuid);
        logger.info(`[StockWebhook] ${location}: Item ${itemGuid} marked OUT_OF_STOCK`);
    } else if (eventType === 'in_stock' || details.status === 'IN_STOCK') {
        outOfStockByLocation[location].delete(itemGuid);
        logger.info(`[StockWebhook] ${location}: Item ${itemGuid} marked IN_STOCK`);
    }

    // Re-process menu cache with updated stock
    if (location === 'WESTBOROUGH' && westboroughRawMenuCache) {
        const stockData = Array.from(outOfStockByLocation.WESTBOROUGH).map(guid => ({ guid, status: 'OUT_OF_STOCK' }));
        westboroughMenuCache = processMenuWithStock(westboroughRawMenuCache, stockData);
        logger.info(`[StockWebhook] Westborough menu cache updated (${outOfStockByLocation.WESTBOROUGH.size} items out of stock)`);
    } else if (location === 'NASHUA' && nashuaRawMenuCache) {
        const stockData = Array.from(outOfStockByLocation.NASHUA).map(guid => ({ guid, status: 'OUT_OF_STOCK' }));
        nashuaMenuCache = processMenuWithStock(nashuaRawMenuCache, stockData);
        logger.info(`[StockWebhook] Nashua menu cache updated (${outOfStockByLocation.NASHUA.size} items out of stock)`);
    }

    // Send WhatsApp notification for out-of-stock
    if (eventType === 'out_of_stock' || details.status === 'OUT_OF_STOCK') {
        // Find item name from cached menu
        let itemName = itemGuid;
        const rawMenu = location === 'WESTBOROUGH' ? westboroughRawMenuCache : nashuaRawMenuCache;
        if (rawMenu) {
            for (const menu of rawMenu.menus || []) {
                for (const group of menu.menuGroups || []) {
                    const found = (group.menuItems || []).find(item => item.guid === itemGuid);
                    if (found) {
                        itemName = found.name;
                        break;
                    }
                }
            }
        }
        sendOutOfStockNotification([{ guid: itemGuid, name: itemName }]);
    }
}

/**
 * Process menu response with stock data to produce filtered menus
 */
function processMenuWithStock(menuResponseData, stockData) {
    const outOfStockItems = (stockData || [])
        .filter(item => item.status === 'OUT_OF_STOCK')
        .map(item => item.guid);

    const filteredMenus = menuResponseData.menus.map(menu => ({
        name: menu.name,
        menuGroups: menu.menuGroups.map(group => ({
            name: group.name,
            menuItems: group.menuItems.map(item => {
                const itemType = determineItemType(item.name);
                const isNotAvailable = outOfStockItems.includes(item.guid);
                const spiceLevel = determineSpiceLevel(item.itemTags);

                const menuItem = {
                    id: item.guid,
                    name: item.name,
                    price: item.price,
                    pricingStrategy: item.pricingStrategy,
                    itemType: itemType,
                    isAvailable: !isNotAvailable
                };

                if (spiceLevel !== undefined) {
                    menuItem.spiceLevel = spiceLevel;
                }

                return menuItem;
            })
        }))
    }));

    return filteredMenus;
}

/**
 * Fetch full menu data from Toast API
 */
async function fetchFullMenuData(location, stockData) {
    const { restaurantExternalId } = locations[location];
    const accessToken = await getAccessToken(location);
    const requestOptions = {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantExternalId
        }
    };

    const menuResponse = await axios.get(`${toastApiBaseUrl}/menus/v2/menus`, requestOptions);

    // Save full response to debugging/response.json
    const debuggingDir = path.resolve(__dirname, '../debugging');
    if (!fs.existsSync(debuggingDir)) {
        fs.mkdirSync(debuggingDir, { recursive: true });
    }
    const filePath = path.join(debuggingDir, 'response.json');
    fs.writeFileSync(filePath, JSON.stringify(menuResponse.data, null, 2));
    logger.info(`Menu response saved to ${filePath}`);

    return processMenuWithStock(menuResponse.data, stockData);
}

/**
 * Main function to fetch menu data for a location.
 * For Westborough: uses cached stock comparison to avoid unnecessary menu API calls.
 * For other locations: fetches menu directly.
 */
async function fetchMenuData(location) {
    for (let retry = 0; retry < 3; retry++) {
        try {
            if (location === 'WESTBOROUGH') {
                // Westborough: use webhook-based stock data only (no stock API call)
                if (westboroughMenuCache) {
                    logger.info('Westborough returning cached menu data');
                    return westboroughMenuCache;
                }

                // Fetch raw menu from Toast only if we don't have it cached
                if (!westboroughRawMenuCache) {
                    logger.info('Westborough fetching menu from Toast (first time)');
                    const { restaurantExternalId } = locations[location];
                    const accessToken = await getAccessToken(location);
                    const requestOptions = {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Toast-Restaurant-External-ID': restaurantExternalId
                        }
                    };
                    const menuResponse = await axios.get(`${toastApiBaseUrl}/menus/v2/menus`, requestOptions);
                    westboroughRawMenuCache = menuResponse.data;

                    const debuggingDir = path.resolve(__dirname, '../debugging');
                    if (!fs.existsSync(debuggingDir)) {
                        fs.mkdirSync(debuggingDir, { recursive: true });
                    }
                    fs.writeFileSync(path.join(debuggingDir, 'response.json'), JSON.stringify(menuResponse.data, null, 2));
                }

                // Process cached raw menu with webhook stock data
                logger.info('Westborough processing menu with webhook stock data');
                const webhookStock = Array.from(outOfStockByLocation.WESTBOROUGH).map(guid => ({ guid, status: 'OUT_OF_STOCK' }));
                const menuData = processMenuWithStock(westboroughRawMenuCache, webhookStock);
                westboroughMenuCache = menuData;
                return menuData;
            } else {
                // Nashua: use webhook-based stock data only (no stock API call)
                if (location === 'NASHUA') {
                    if (nashuaMenuCache) {
                        logger.info('Nashua returning cached menu data');
                        return nashuaMenuCache;
                    }

                    // Fetch raw menu only if not cached
                    if (!nashuaRawMenuCache) {
                        logger.info('Nashua fetching menu from Toast (first time)');
                        const { restaurantExternalId } = locations[location];
                        const accessToken = await getAccessToken(location);
                        const requestOptions = {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Toast-Restaurant-External-ID': restaurantExternalId
                            }
                        };
                        const menuResponse = await axios.get(`${toastApiBaseUrl}/menus/v2/menus`, requestOptions);
                        nashuaRawMenuCache = menuResponse.data;
                    }

                    logger.info('Nashua processing menu with webhook stock data');
                    const webhookStock = Array.from(outOfStockByLocation.NASHUA).map(guid => ({ guid, status: 'OUT_OF_STOCK' }));
                    const menuData = processMenuWithStock(nashuaRawMenuCache, webhookStock);
                    nashuaMenuCache = menuData;
                    return menuData;
                }

                // Other locations: fetch directly
                const { restaurantExternalId } = locations[location];
                const accessToken = await getAccessToken(location);
                const requestOptions = {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Toast-Restaurant-External-ID': restaurantExternalId
                    }
                };

                const menuResponse = await axios.get(`${toastApiBaseUrl}/menus/v2/menus`, requestOptions);
                return processMenuWithStock(menuResponse.data, []);
            }
        } catch (error) {
            const retryAfter = error.response?.headers['retry-after'] ? parseInt(error.response.headers['retry-after']) * 1000 : retryDelay(retry);
            logger.error(`Error fetching menu, retrying in ${retryAfter / 1000} seconds: ${error.message}`);
            if (retry === 2) {
                // On final failure, return cached data if available
                if (location === 'WESTBOROUGH' && westboroughMenuCache) {
                    logger.warn('All retries failed for Westborough, returning cached menu data');
                    return westboroughMenuCache;
                }
                throw new Error("Failed to fetch menu after several attempts");
            }
            await new Promise(resolve => setTimeout(resolve, retryAfter));
        }
    }
}

/**
 * Send out-of-stock notification to managers via WhatsApp
 */
async function sendOutOfStockNotification(outOfStockItems) {
    const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID;
    const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
    const OWNER_PHONE_NUMBERS = (process.env.OWNER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);
    const MANAGER_PHONE_NUMBERS = (process.env.MANAGER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);
    const ALL_RECIPIENTS = [...new Set([...OWNER_PHONE_NUMBERS, ...MANAGER_PHONE_NUMBERS])];
    const WA_OUT_OF_STOCK_TEMPLATE = process.env.WA_OUT_OF_STOCK_TEMPLATE_NAME;
    const WA_TEMPLATE_LANGUAGE = process.env.WA_TEMPLATE_LANGUAGE || 'en_US';

    if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN || !WA_OUT_OF_STOCK_TEMPLATE || ALL_RECIPIENTS.length === 0) {
        logger.warn('Out-of-stock WhatsApp notification not configured. Skipping.');
        return;
    }

    const itemsList = outOfStockItems.map(item => item.name || item.guid).join(', ');
    const url = `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`;

    for (const phoneNumber of ALL_RECIPIENTS) {
        try {
            const payload = {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'template',
                template: {
                    name: WA_OUT_OF_STOCK_TEMPLATE,
                    language: { code: WA_TEMPLATE_LANGUAGE },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: itemsList }
                            ]
                        }
                    ]
                }
            };

            await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`Out-of-stock notification sent to ${phoneNumber}`);
            // Delay between sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            logger.error(`Failed to send out-of-stock notification to ${phoneNumber}: ${errorMsg}`);
        }
    }
}

// Stock polling removed — both locations now use webhooks for stock updates
// Webhook endpoint: POST /api/stock/webhook

/**
 * Clear menu caches to force a fresh reload from Toast on next request
 */
function clearMenuCache(location) {
    if (!location || location === 'WESTBOROUGH') {
        westboroughRawMenuCache = null;
        westboroughMenuCache = null;
        logger.info('Westborough menu caches cleared');
    }
    if (!location || location === 'NASHUA') {
        nashuaRawMenuCache = null;
        nashuaMenuCache = null;
        logger.info('Nashua menu caches cleared');
    }
}

module.exports = {
    fetchMenuData,
    clearMenuCache,
    handleStockWebhook
};
