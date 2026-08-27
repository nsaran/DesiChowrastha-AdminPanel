const admin = require('../config/firebaseAdmin');
const logger = require('../utils/logger');

/**
 * Middleware to verify Firebase ID token from Authorization header.
 * Attaches decoded token (including custom claims) to req.user.
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        logger.error('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Middleware factory to check if the authenticated user has one of the allowed roles.
 * Must be used AFTER verifyToken middleware.
 * 
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
const requireRole = (allowedRoles) => (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
};

module.exports = { verifyToken, requireRole };
