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
async function generateDescription(itemName, itemType, category) {
    const categoryContext = category ? ` It belongs to the "${category}" section.` : '';
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `You are a food expert at an Indian restaurant. Generate a short, appetizing description (2-3 sentences max) for the given dish. Include key ingredients and flavor profile. Keep it under 50 words.`
            },
            {
                role: 'user',
                content: `Describe this Indian restaurant dish: "${itemName}" (${itemType}).${categoryContext}`
            }
        ],
        max_tokens: 100,
        temperature: 0.7
    });

    return response.choices[0].message.content.trim();
}

/**
 * Generate an image for a menu item using OpenAI gpt-image-1
 */
async function generateImage(itemName, itemId, category) {
    const imagePath = path.join(IMAGE_DIR, `${itemId}.jpg`);

    // Check if image already exists
    if (fs.existsSync(imagePath)) {
        return `/_images/dishes/${itemId}.jpg`;
    }

    try {
        const categoryContext = category ? `, from the "${category}" section` : '';
        const response = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: `A professional food photography shot of "${itemName}"${categoryContext}, an Indian restaurant dish, served on a plate, top-down view, warm lighting, high quality, appetizing, no text or watermarks`,
            n: 1,
            size: '1024x1024'
        });

        const imageData = response.data[0].b64_json;
        const imageBuffer = Buffer.from(imageData, 'base64');

        fs.writeFileSync(imagePath, imageBuffer);
        // Also save to public folder for localhost dev
        fs.writeFileSync(path.join(IMAGE_DIR_PUBLIC, `${itemId}.jpg`), imageBuffer);

        logger.info(`[MenuAI] Image generated for: ${itemName}`);
        return `/_images/dishes/${itemId}.jpg`;
    } catch (error) {
        logger.error(`[MenuAI] Image generation failed for ${itemName}: ${error.message}`);
        return null;
    }
}

/**
 * Get full detail for a menu item (description + image)
 * Uses cache if available, generates if not
 */
async function getMenuItemDetail(itemId, itemName, itemType, category) {
    // Check cache first
    const cached = getCachedDetail(itemId);
    if (cached && cached.description && cached.imageUrl) {
        return cached;
    }

    logger.info(`[MenuAI] Generating detail for: ${itemName} (${itemId})`);

    try {
        // Generate description
        const description = cached?.description || await generateDescription(itemName, itemType || 'dish', category);

        // Generate image
        const imageUrl = cached?.imageUrl || await generateImage(itemName, itemId, category);

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
            const detail = await getMenuItemDetail(item.id, item.name, item.itemType, item.category);
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
