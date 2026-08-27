const express = require('express');
const router = express.Router();
const admin = require('../config/firebaseAdmin');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// All routes require owner role
router.use(verifyToken, requireRole(['owner']));

/**
 * POST /api/users - Create a new user with a role
 * Body: { email, password, displayName, role, restaurantId }
 */
router.post('/', async (req, res) => {
    try {
        const { email, password, displayName, role, restaurantId } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ error: 'email, password, and role are required' });
        }

        const validRoles = ['owner', 'manager', 'chef'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName || email.split('@')[0]
        });

        // Set custom claims (role and optionally restaurantId)
        const claims = { role };
        if (restaurantId) {
            claims.restaurantId = restaurantId;
        }
        await admin.auth().setCustomUserClaims(userRecord.uid, claims);

        logger.info(`User created: ${email} with role: ${role} (uid: ${userRecord.uid})`);
        res.json({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                role,
                restaurantId: restaurantId || null
            }
        });
    } catch (error) {
        logger.error('Create user error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/users - List all users with their roles
 */
router.get('/', async (req, res) => {
    try {
        const listResult = await admin.auth().listUsers(1000);
        const users = listResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            role: user.customClaims?.role || 'none',
            restaurantId: user.customClaims?.restaurantId || null,
            disabled: user.disabled,
            createdAt: user.metadata.creationTime
        }));

        res.json({ success: true, users });
    } catch (error) {
        logger.error('List users error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/users/:uid/role - Update a user's role
 * Body: { role, restaurantId }
 */
router.put('/:uid/role', async (req, res) => {
    try {
        const { uid } = req.params;
        const { role, restaurantId } = req.body;

        const validRoles = ['owner', 'manager', 'chef'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        // Verify user exists
        const user = await admin.auth().getUser(uid);

        const claims = { role };
        if (restaurantId) {
            claims.restaurantId = restaurantId;
        }
        await admin.auth().setCustomUserClaims(uid, claims);

        logger.info(`User ${user.email} role updated to: ${role}`);
        res.json({ success: true, uid, role, restaurantId: restaurantId || null });
    } catch (error) {
        logger.error('Update role error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/users/:uid - Delete a user
 */
router.delete('/:uid', async (req, res) => {
    try {
        const { uid } = req.params;

        // Prevent self-deletion
        if (uid === req.user.uid) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const user = await admin.auth().getUser(uid);
        await admin.auth().deleteUser(uid);

        logger.info(`User deleted: ${user.email} (uid: ${uid})`);
        res.json({ success: true, message: `User ${user.email} deleted` });
    } catch (error) {
        logger.error('Delete user error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/users/:uid/disable - Disable/enable a user
 * Body: { disabled: true/false }
 */
router.put('/:uid/disable', async (req, res) => {
    try {
        const { uid } = req.params;
        const { disabled } = req.body;

        if (uid === req.user.uid) {
            return res.status(400).json({ error: 'Cannot disable your own account' });
        }

        await admin.auth().updateUser(uid, { disabled: !!disabled });

        logger.info(`User ${uid} ${disabled ? 'disabled' : 'enabled'}`);
        res.json({ success: true, uid, disabled: !!disabled });
    } catch (error) {
        logger.error('Disable user error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/users/:uid/reset-password - Reset a user's password
 * Body: { newPassword }
 */
router.put('/:uid/reset-password', async (req, res) => {
    try {
        const { uid } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await admin.auth().getUser(uid);
        await admin.auth().updateUser(uid, { password: newPassword });

        logger.info(`Password reset for user: ${user.email} (uid: ${uid})`);
        res.json({ success: true, message: `Password reset for ${user.email}` });
    } catch (error) {
        logger.error('Reset password error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/users/:uid/email - Update a user's email
 * Body: { newEmail }
 */
router.put('/:uid/email', async (req, res) => {
    try {
        const { uid } = req.params;
        const { newEmail } = req.body;

        if (!newEmail || !newEmail.includes('@')) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        const user = await admin.auth().getUser(uid);
        const oldEmail = user.email;
        await admin.auth().updateUser(uid, { email: newEmail });

        logger.info(`Email updated for user ${oldEmail} → ${newEmail} (uid: ${uid})`);
        res.json({ success: true, message: `Email updated from ${oldEmail} to ${newEmail}` });
    } catch (error) {
        logger.error('Update email error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
