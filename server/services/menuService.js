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

// Polling interval reference
let stockPollingInterval = null;

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
 * Fetch stock inventory for Westborough and compare with cached version.
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

    // Compare with cached stock
    const newStockString = JSON.stringify(newStockData);
    const cachedStockString = JSON.stringify(westboroughStockCache);

    if (newStockString === cachedStockString) {
        return { changed: false, stockData: newStockData };
    }

    // Stock has changed, update cache
    westboroughStockCache = newStockData;
    return { changed: true, stockData: newStockData };
}

/**
 * Process menu response with stock data to produce filtered menus
 */
function processMenuWithStock(menuResponseData, stockData) {
    const outOfStockItems = (stockData || []).map(item => ({
        guid: item.guid,
        status: item.status
    }));

    const filteredMenus = menuResponseData.menus.map(menu => ({
        name: menu.name,
        menuGroups: menu.menuGroups.map(group => ({
            name: group.name,
            menuItems: group.menuItems.map(item => {
                const itemType = determineItemType(item.name);
                const isNotAvailable = outOfStockItems.some(stockItem => stockItem.guid === item.guid);
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
                // Check stock and decide whether to refresh menu
                const { changed, stockData } = await fetchAndCompareStock(location);

                if (!changed && westboroughMenuCache) {
                    // Stock hasn't changed and we have cached menu — return cached
                    logger.info('Westborough stock unchanged, returning cached menu data');
                    return westboroughMenuCache;
                }

                // Stock changed or no cached menu — fetch fresh menu
                logger.info('Westborough stock changed or no cache, fetching fresh menu data');
                const menuData = await fetchFullMenuData(location, stockData);
                westboroughMenuCache = menuData;
                return menuData;
            } else {
                // Other locations: fetch directly (no stock check)
                const { restaurantExternalId } = locations[location];
                const accessToken = await getAccessToken(location);
                const requestOptions = {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Toast-Restaurant-External-ID': restaurantExternalId
                    }
                };

                const menuResponse = await axios.get(`${toastApiBaseUrl}/menus/v2/menus`, requestOptions);

                // Save debug response
                const debuggingDir = path.resolve(__dirname, '../debugging');
                if (!fs.existsSync(debuggingDir)) {
                    fs.mkdirSync(debuggingDir, { recursive: true });
                }
                const filePath = path.join(debuggingDir, 'response.json');
                fs.writeFileSync(filePath, JSON.stringify(menuResponse.data, null, 2));
                logger.info(`Menu response saved to ${filePath}`);

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
 * Start polling Westborough stock every 5 minutes.
 * If stock changes, automatically refresh the menu cache.
 */
function startStockPolling() {
    if (stockPollingInterval) {
        clearInterval(stockPollingInterval);
    }

    const TWO_MINUTES = 2 * 60 * 1000;

    stockPollingInterval = setInterval(async () => {
        const hour = new Date().getHours();
        if (hour < 10 || hour >= 22) {
            logger.info('Outside operating hours (10am-10pm), skipping stock poll');
            return;
        }

        try {
            logger.info('Polling Westborough stock inventory...');
            const { changed, stockData } = await fetchAndCompareStock('WESTBOROUGH');

            if (changed) {
                logger.info('Westborough stock changed, refreshing menu cache...');
                const menuData = await fetchFullMenuData('WESTBOROUGH', stockData);
                westboroughMenuCache = menuData;
                logger.info('Westborough menu cache updated successfully');
            } else {
                logger.info('Westborough stock unchanged, no menu refresh needed');
            }
        } catch (error) {
            logger.error(`Stock polling error: ${error.message}`);
        }
    }, TWO_MINUTES);

    logger.info('Westborough stock polling started (every 2 minutes)');
}

// Start polling when the service is loaded
startStockPolling();

module.exports = {
    fetchMenuData
};
