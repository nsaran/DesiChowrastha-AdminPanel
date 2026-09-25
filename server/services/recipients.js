const logger = require('../utils/logger');

/**
 * Centralized recipient phone-number resolution for WhatsApp notifications.
 *
 * Roles: owner, manager, chef, purchaser
 *
 * Env var convention (all values are comma-separated phone numbers in
 * international format, e.g. 16039157030):
 *
 *   Global (fallback, backward compatible):
 *     OWNER_PHONE_NUMBER
 *     MANAGER_PHONE_NUMBER
 *     CHEF_PHONE_NUMBER
 *     PURCHASER_PHONE_NUMBER
 *
 *   Per-location overrides (optional):
 *     OWNER_PHONE_NUMBER_NASHUA / OWNER_PHONE_NUMBER_WESTBOROUGH
 *     MANAGER_PHONE_NUMBER_NASHUA / MANAGER_PHONE_NUMBER_WESTBOROUGH
 *     CHEF_PHONE_NUMBER_NASHUA / CHEF_PHONE_NUMBER_WESTBOROUGH
 *     PURCHASER_PHONE_NUMBER_NASHUA / PURCHASER_PHONE_NUMBER_WESTBOROUGH
 *
 * Resolution rule: if a location-specific var is set for the role, use it;
 * otherwise fall back to the global var for that role. This keeps every
 * existing caller working even before per-location values are filled in.
 */

const ROLE_ENV = {
    owner: 'OWNER_PHONE_NUMBER',
    manager: 'MANAGER_PHONE_NUMBER',
    chef: 'CHEF_PHONE_NUMBER',
    purchaser: 'PURCHASER_PHONE_NUMBER',
};

function parseList(value) {
    return (value || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
}

function normalizeLocation(location) {
    return (location || '').toString().trim().toUpperCase();
}

/**
 * Get the phone numbers for a single role, optionally scoped to a location.
 * @param {('owner'|'manager'|'chef'|'purchaser')} role
 * @param {string} [location] - e.g. 'NASHUA' or 'WESTBOROUGH' (case-insensitive)
 * @returns {string[]} deduplicated list of phone numbers
 */
function getRecipients(role, location) {
    const baseVar = ROLE_ENV[role];
    if (!baseVar) {
        logger.warn(`[recipients] Unknown role requested: ${role}`);
        return [];
    }

    const loc = normalizeLocation(location);
    if (loc) {
        const scoped = parseList(process.env[`${baseVar}_${loc}`]);
        if (scoped.length > 0) {
            return [...new Set(scoped)];
        }
    }
    // Fallback to global list
    return [...new Set(parseList(process.env[baseVar]))];
}

/**
 * Get the combined, deduplicated phone numbers for multiple roles.
 * @param {Array<'owner'|'manager'|'chef'|'purchaser'>} roles
 * @param {string} [location]
 * @returns {string[]}
 */
function getRecipientsForRoles(roles, location) {
    const all = (roles || []).flatMap((role) => getRecipients(role, location));
    return [...new Set(all)];
}

module.exports = { getRecipients, getRecipientsForRoles };
