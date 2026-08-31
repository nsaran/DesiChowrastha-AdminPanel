require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');

/**
 * Resolve the actual Firestore `restaurants` document id for a location, trying
 * common casings and returning the first that exists. Falls back to Title-case.
 *
 * This avoids silent mismatches where one feature writes to `restaurants/Nashua`
 * while another reads `restaurants/NASHUA`.
 */
async function resolveRestaurantId(location) {
    if (!location) return location;
    const title = location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
    const candidates = [title, location, String(location).toUpperCase(), String(location).toLowerCase()]
        .filter((v, i, arr) => v && arr.indexOf(v) === i);

    const db = getFirestore();
    for (const rid of candidates) {
        const snap = await db.collection('restaurants').doc(rid).get();
        if (snap.exists) return rid;
    }
    return title; // default if none exist yet
}

module.exports = { resolveRestaurantId };
