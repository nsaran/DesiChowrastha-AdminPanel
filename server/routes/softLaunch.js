const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Soft Launch menu — editable, persisted per location.
 * Stored at server/data/soft-launch.json as { [LOCATION]: [{category, items:[]}] }.
 *
 * GET  /api/soft-launch?location=..   -> public (the display page reads it)
 * PUT  /api/soft-launch               -> owner/manager only (edit)
 */

const DATA_PATH = path.join(__dirname, '..', 'data', 'soft-launch.json');

// Seed used the first time a location has no saved menu.
const DEFAULT_MENU = [
    { category: 'Veg Appetizers', items: ['Pepper Corn Masala', 'Baby Corn Manchuria', 'Gobi 65', 'Chili Garlic Paneer', 'Chowrastha Fried Paneer'] },
    { category: 'Non-Veg Appetizers', items: ['Pepper Chicken', 'Jalapeno Chicken', 'Karam Podi Chicken', 'Chicken 65'] },
    { category: 'Indo-Chinese', items: ['Veg Fried Rice', 'Chicken Fried Rice', 'Veg Noodles', 'Chicken Noodles'] },
    { category: "Biryani's", items: ['Chicken Dum Biryani', 'Goat Dum Biryani', 'Guttivankaya Biryani', 'Paneer Biryani', 'Vijayawada Boneless Chicken Biryani', 'Konaseema Chicken Biryani', 'Kaju Goat Keema Biryani', 'Veg Biryani', 'Pulao'] },
];

function locKey(location) {
    return String(location || '').toUpperCase();
}

function readAll() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) || {};
        }
    } catch (e) {
        logger.error(`[SoftLaunch] read failed: ${e.message}`);
    }
    return {};
}

function writeAll(data) {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// GET — public. Returns the location's menu, seeding defaults if none saved.
router.get('/', (req, res) => {
    const location = locKey(req.query.location);
    if (!location) return res.status(400).json({ error: 'location is required' });
    const all = readAll();
    const menu = all[location] || DEFAULT_MENU;
    res.json({ location, menu });
});

// PUT — owner/manager only. Body: { location, menu: [{category, items:[]}] }
router.put('/', verifyToken, requireRole(['owner', 'manager']), (req, res) => {
    try {
        const location = locKey(req.body.location);
        const menu = Array.isArray(req.body.menu) ? req.body.menu : null;
        if (!location || !menu) return res.status(400).json({ error: 'location and menu are required' });

        // Normalize: keep only categories with a name; trim item strings.
        const clean = menu
            .map((sec) => ({
                category: String(sec.category || '').trim(),
                items: (Array.isArray(sec.items) ? sec.items : [])
                    .map((it) => String(it || '').trim())
                    .filter(Boolean),
            }))
            .filter((sec) => sec.category);

        const all = readAll();
        all[location] = clean;
        writeAll(all);
        logger.info(`[SoftLaunch] Menu updated for ${location}: ${clean.length} categories`);
        res.json({ success: true, location, menu: clean });
    } catch (e) {
        logger.error(`[SoftLaunch] save failed: ${e.message}`);
        res.status(500).json({ error: e.message || 'Failed to save soft launch menu' });
    }
});

module.exports = router;
