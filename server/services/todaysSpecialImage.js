const svg2img = require('svg2img');
const logger = require('../utils/logger');

/**
 * Generate a "Tomorrow's Special" image as a PNG buffer.
 * Creates an SVG with chalkboard styling and converts to image.
 * 
 * @param {Array} items - Array of special items [{name, description, price}]
 * @param {string} location - Restaurant location name
 * @returns {Promise<Buffer>} - PNG image buffer
 */
async function generateTodaysSpecialImage(items, location) {
    const width = 800;
    const itemHeight = 100;
    const headerHeight = 180;
    const footerHeight = 80;
    const height = headerHeight + (items.length * itemHeight) + footerHeight;

    // Build item SVGs
    const itemsSvg = items.map((item, index) => {
        const y = headerHeight + (index * itemHeight);
        const price = item.price ? `$ ${parseFloat(item.price).toFixed(2)}` : '';
        return `
            <line x1="60" y1="${y}" x2="740" y2="${y}" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="8,4"/>
            <text x="80" y="${y + 45}" font-family="Georgia, serif" font-size="32" fill="#ffffff" font-weight="bold">${escapeXml(item.name)}</text>
            <text x="720" y="${y + 45}" font-family="Georgia, serif" font-size="30" fill="#ffd700" text-anchor="end">${price}</text>
            ${item.description ? `<text x="80" y="${y + 75}" font-family="Georgia, serif" font-size="18" fill="#aaaaaa" font-style="italic">${escapeXml(item.description)}</text>` : ''}
        `;
    }).join('');

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <!-- Background -->
            <rect width="${width}" height="${height}" fill="#2c2c2c" rx="12"/>
            <rect x="10" y="10" width="${width - 20}" height="${height - 20}" fill="none" stroke="#fd590d" stroke-width="4" rx="8"/>

            <!-- Decorative corners -->
            <text x="30" y="40" font-size="20" fill="rgba(253,89,13,0.4)">✦</text>
            <text x="${width - 40}" y="40" font-size="16" fill="rgba(255,255,255,0.2)">✧</text>

            <!-- Title -->
            <text x="${width / 2}" y="70" font-family="Georgia, serif" font-size="42" fill="#fd590d" text-anchor="middle" font-weight="bold">Tomorrow's Special</text>
            <text x="${width / 2}" y="110" font-family="Georgia, serif" font-size="22" fill="#cccccc" text-anchor="middle" font-style="italic">~ Chef's Recommendation ~</text>

            <!-- Items -->
            ${itemsSvg}

            <!-- Footer -->
            <text x="${width / 2}" y="${height - 30}" font-family="Georgia, serif" font-size="16" fill="rgba(200,200,200,0.5)" text-anchor="middle">~ Desi Chowrastha, ${escapeXml(location)} ~</text>
        </svg>
    `;

    return new Promise((resolve, reject) => {
        svg2img(svg, { format: 'png', width, height }, (error, buffer) => {
            if (error) {
                logger.error(`[TodaysSpecialImage] Error generating image: ${error.message}`);
                reject(error);
            } else {
                logger.info(`[TodaysSpecialImage] Image generated (${buffer.length} bytes) for ${location}`);
                resolve(buffer);
            }
        });
    });
}

/**
 * Escape XML special characters for SVG
 */
function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    generateTodaysSpecialImage
};
