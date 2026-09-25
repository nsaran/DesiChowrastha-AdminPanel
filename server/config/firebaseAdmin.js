const admin = require('firebase-admin');
const { cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
// Uses service account key file if available, otherwise uses GOOGLE_APPLICATION_CREDENTIALS env var
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

// Storage bucket for uploaded files (receipts, etc.). Defaults to the project's
// default bucket; override with FIREBASE_STORAGE_BUCKET if different.
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
    || `${process.env.FIREBASE_PROJECT_ID || 'desichowrastha-adminpanel'}.appspot.com`;

let app;
if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    app = admin.initializeApp({
        credential: cert(serviceAccount),
        storageBucket
    });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = admin.initializeApp({
        credential: applicationDefault(),
        storageBucket
    });
} else {
    // Fallback: initialize with project ID from env (for environments with implicit credentials)
    app = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'desichowrastha-adminpanel',
        storageBucket
    });
}

// Export admin with auth() helper
module.exports = {
    auth: () => getAuth(app),
    app
};
