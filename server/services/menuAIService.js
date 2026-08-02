const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CACHE_DIR = path.resolve(__dirname, '../cache/menu-details');
const IMAGE_DIR = path.resolve(__dirname, '../../client/build/_images/dishes');

// Ensure directories exist
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

// Also save to public folder for future builds
const IMAGE_DIR_PUBLIC = path.resolve(__dirname, '../../client/public/_images/dishes');
if (!fs.existsSync(IMAGE_DIR_PUBLIC)) fs.mkdirSync(IMAGE_DIR_PUBLIC, { recursive: true });

/**
 * Get cached detail for a menu item
 */
function getCachedDetail(itemId) {
    const filePath = path.join(CACHE_DIR, `${itemId}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
}

/**
 * Save detail to cache
 */
function saveCachedDetail(itemId, detail) {
    const filePath = path.join(CACHE_DIR, `${itemId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(detail, null, 2));
}

/**
 * Generate a description for a menu item using OpenAI
 */
async function generateDescription(itemName, itemType) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are a food expert at an Indian restaurant. Generate a short, appetizing description (2-3 sentences max) for the given dish. Include key ingredients and flavor profile. Keep it under 50 words.'
            },
            {
                role: 'user',
                content: `Describe this Indian restaurant dish: "${itemName}" (${itemType})`
            }
        ],
        max_tokens: 100,
        temperature: 0.7
    });

    return response.choices[0].message.content.trim();
}

/**
 * Find a food image for a menu item using Unsplash API
 */
async function generateImage(itemName, itemId) {
    const imagePath = path.join(IMAGE_DIR, `${itemId}.jpg`);

    // Check if image already exists
    if (fs.existsSync(imagePath)) {
        return `/_images/dishes/${itemId}.jpg`;
    }

    const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashAccessKey) {
        logger.warn('[MenuAI] UNSPLASH_ACCESS_KEY not set, skipping image');
        return null;
    }

    const axios = require('axios');
    const searchQuery = `${itemName} indian food dish`;

    const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
            query: searchQuery,
            per_page: 1,
            orientation: 'squarish'
        },
        headers: {
            'Authorization': `Client-ID ${unsplashAccessKey}`
        }
    });

    if (response.data.results.length === 0) {
        // Fallback: search with simpler query
        const fallbackResponse = await axios.get('https://api.unsplash.com/search/photos', {
            params: {
                query: `${itemName} food`,
                per_page: 1,
                orientation: 'squarish'
            },
            headers: {
                'Authorization': `Client-ID ${unsplashAccessKey}`
            }
        });

        if (fallbackResponse.data.results.length === 0) {
            return null;
        }
        response.data.results = fallbackResponse.data.results;
    }

    const imageUrl = response.data.results[0].urls.regular;

    // Download and save the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(imagePath, imageResponse.data);
    // Also save to public folder for localhost dev
    fs.writeFileSync(path.join(IMAGE_DIR_PUBLIC, `${itemId}.jpg`), imageResponse.data);

    logger.info(`[MenuAI] Image found for: ${itemName}`);
    return `/_images/dishes/${itemId}.jpg`;
}

/**
 * Get full detail for a menu item (description + image)
 * Uses cache if available, generates if not
 */
async function getMenuItemDetail(itemId, itemName, itemType) {
    // Check cache first
    const cached = getCachedDetail(itemId);
    if (cached && cached.description && cached.imageUrl) {
        return cached;
    }

    logger.info(`[MenuAI] Generating detail for: ${itemName} (${itemId})`);

    try {
        // Generate description
        const description = cached?.description || await generateDescription(itemName, itemType || 'dish');

        // Generate image
        const imageUrl = cached?.imageUrl || await generateImage(itemName, itemId);

        const detail = {
            itemId,
            itemName,
            itemType,
            description,
            imageUrl,
            generatedAt: new Date().toISOString()
        };

        // Cache it
        saveCachedDetail(itemId, detail);

        return detail;
    } catch (error) {
        logger.error(`[MenuAI] Error generating detail for ${itemName}: ${error.message}`);
        return {
            itemId,
            itemName,
            itemType,
            description: null,
            imageUrl: null,
            error: error.message
        };
    }
}

/**
 * Batch generate details for all menu items
 * Call this to pre-generate descriptions and images for all items
 */
async function batchGenerateDetails(menuItems) {
    const results = [];
    let generated = 0;
    let cached = 0;

    for (const item of menuItems) {
        const existingCache = getCachedDetail(item.id);
        if (existingCache && existingCache.description && existingCache.imageUrl) {
            cached++;
            results.push(existingCache);
            continue;
        }

        try {
            const detail = await getMenuItemDetail(item.id, item.name, item.itemType);
            results.push(detail);
            generated++;

            // Rate limit: wait 2 seconds between API calls
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            logger.error(`[MenuAI] Batch error for ${item.name}: ${error.message}`);
            results.push({ itemId: item.id, itemName: item.name, error: error.message });
        }
    }

    logger.info(`[MenuAI] Batch complete: ${generated} generated, ${cached} from cache`);
    return { generated, cached, results };
}

module.exports = {
    getMenuItemDetail,
    batchGenerateDetails
};
