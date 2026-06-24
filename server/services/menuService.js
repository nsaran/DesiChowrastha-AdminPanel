const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getAccessToken } = require('./authService');
const { toastApiBaseUrl, locations } = require('../config/config');
const logger = require('../utils/logger');

const retryDelay = (retryCount) => Math.pow(2, retryCount) * 1000;

function determineItemType(itemName) {
    const vegKeywords = ['paneer', 'veg', 'vegetable', 'dal', 'upma', 'idly', 'dosa', 'samosa', 'pulao', 'chaat', 'bhel', 'aloo', 'pav', 'utappam', 'gobi', 'manchuria', 'masala', 'pakora'];
    const eggKeywords = ['egg', 'omelette'];
    const nonVegKeywords = ['chicken', 'mutton', 'goat', 'fish', 'shrimp', 'beef', 'pork', 'keema', 'haleem', 'mandi'];

    itemName = itemName.toLowerCase();
    if (eggKeywords.some(keyword => itemName.includes(keyword))) {
        return 'Egg';
    }
    if (nonVegKeywords.some(keyword => itemName.includes(keyword))) {
        return 'Non-Veg';
    }
    if (vegKeywords.some(keyword => itemName.includes(keyword))) {
        return 'Veg';
    }
    return 'Undefined';
}

function determineAvailability(itemTags) {
    if (!itemTags) {
        return undefined;
    }
    return itemTags.some(tag => tag.name.toLowerCase() === 'false') ? false : true;
}

function determineSpiceLevel(itemTags) {
    if (!itemTags) {
        return undefined;
    }
    const spiceTag = itemTags.find(tag => tag.name.toLowerCase() === 'mild' || tag.name.toLowerCase() === 'medium' || tag.name.toLowerCase() === 'spicy');
    return spiceTag ? spiceTag.name : undefined;
}

async function fetchMenuData(location) {
    const { restaurantExternalId } = locations[location];
    const accessToken = await getAccessToken(location);
    const requestOptions = {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantExternalId
        }
    };

    for (let retry = 0; retry < 3; retry++) {
        try {
            const stockResponse = await axios.get(`${toastApiBaseUrl}/stock/v1/inventory`, requestOptions);
            const menuResponse = await axios.get(`${toastApiBaseUrl}/menus/v2/menus`, requestOptions);
            //console.log(stockResponse.data);
            // Save full response to debugging/response.json
            const debuggingDir = path.resolve(__dirname, '../debugging');
            if (!fs.existsSync(debuggingDir)) {
                fs.mkdirSync(debuggingDir, { recursive: true });
            }
            const filePath = path.join(debuggingDir, 'response.json');
            fs.writeFileSync(filePath, JSON.stringify(menuResponse.data, null, 2));
            logger.info(`Menu response saved to ${filePath}`);

            const outOfStockItems = stockResponse.data.map(item => ({
                guid: item.guid,
                status: item.status
            }));

            const filteredMenus = menuResponse.data.menus.map(menu => ({
                name: menu.name,
                menuGroups: menu.menuGroups.map(group => ({
                    name: group.name,
                    menuItems: group.menuItems.map(item => {
                        const itemType = determineItemType(item.name);
                        //const isAvailable = determineAvailability(item.itemTags);
                        const isNotAvailable = outOfStockItems.some(item1 => item1.guid === item.guid);

                        const spiceLevel = determineSpiceLevel(item.itemTags);

                        const menuItem = {
                            id: item.guid,
                            name: item.name,
                            price: item.price,
                            pricingStrategy: item.pricingStrategy,
                            itemType: itemType
                        };

                        menuItem.isAvailable = true;
                        if (isNotAvailable) {
                            menuItem.isAvailable = false;
                        }
                        
                        if (spiceLevel !== undefined) {
                            menuItem.spiceLevel = spiceLevel;
                        }

                        return menuItem;
                    })
                }))
            }));
            return filteredMenus;
        } catch (error) {
            const retryAfter = error.response?.headers['retry-after'] ? parseInt(error.response.headers['retry-after']) * 1000 : retryDelay(retry);
            logger.error(`Error fetching menu, retrying in ${retryAfter / 1000} seconds: ${error.message}`);
            if (retry === 2) {
                throw new Error("Failed to fetch menu after several attempts");
            }
            await new Promise(resolve => setTimeout(resolve, retryAfter));
        }
    }
}

module.exports = {
    fetchMenuData
};