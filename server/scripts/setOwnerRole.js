/**
 * One-time script to set the 'owner' role on your Firebase Auth account.
 * 
 * Usage:
 *   node scripts/setOwnerRole.js <email>
 * 
 * Example:
 *   node scripts/setOwnerRole.js owner@desichowrastha.com
 * 
 * Prerequisites:
 *   - serviceAccountKey.json must exist in the server/ folder
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const admin = require('../config/firebaseAdmin');

async function setOwnerRole() {
    const email = process.argv[2];

    if (!email) {
        console.error('Usage: node scripts/setOwnerRole.js <email>');
        console.error('Example: node scripts/setOwnerRole.js owner@desichowrastha.com');
        process.exit(1);
    }

    try {
        // Look up user by email
        const user = await admin.auth().getUserByEmail(email);
        console.log(`Found user: ${user.email} (UID: ${user.uid})`);

        // Set owner role
        await admin.auth().setCustomUserClaims(user.uid, { role: 'owner' });
        console.log(`✓ Role 'owner' set successfully for ${user.email}`);
        console.log('\nThe user needs to log out and log back in for the new role to take effect.');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

setOwnerRole();
