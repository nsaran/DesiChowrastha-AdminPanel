const admin = require('firebase-admin');
const { cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
// Uses service account key file if available, otherwise uses GOOGLE_APPLICATION_CREDENTIALS env var
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

let app;
if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    app = admin.initializeApp({
        credential: cert(serviceAccount)
    });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = admin.initializeApp({
        credential: applicationDefault()
    });
} else {
    // Fallback: initialize with project ID from env (for environments with implicit credentials)
    app = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'desichowrastha-adminpanel'
    });
}

// Export admin with auth() helper
module.exports = {
    auth: () => getAuth(app),
    app
};
