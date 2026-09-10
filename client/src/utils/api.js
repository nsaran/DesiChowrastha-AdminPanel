import axios from 'axios';
import { auth } from '../config/firebase';
import API_BASE_URL from '../config/api';

/**
 * Axios instance with automatic Firebase auth token injection.
 * Use this for all protected API calls.
 */
const protectedApi = axios.create({
    baseURL: API_BASE_URL
});

// Track when we last force-refreshed the ID token so we pick up custom-claim
// changes (e.g. a newly assigned `accountsManager` role) without waiting for
// Firebase's ~1h cache to expire, while still avoiding a network round-trip on
// every single request.
let lastForceRefresh = 0;
const FORCE_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Attach auth token to every request
protectedApi.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const now = Date.now();
        const forceRefresh = now - lastForceRefresh > FORCE_REFRESH_INTERVAL_MS;
        if (forceRefresh) {
            lastForceRefresh = now;
        }
        const token = await user.getIdToken(forceRefresh);
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// If a request fails with 403 (Insufficient permissions), the cached token may
// carry stale custom claims. Force-refresh the token once and retry the request
// so a freshly assigned role (e.g. accountsManager) takes effect immediately.
protectedApi.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const status = error.response?.status;
        if (status === 403 && original && !original._retriedAfterRefresh) {
            const user = auth.currentUser;
            if (user) {
                original._retriedAfterRefresh = true;
                try {
                    const token = await user.getIdToken(true); // force refresh
                    lastForceRefresh = Date.now();
                    original.headers.Authorization = `Bearer ${token}`;
                    return protectedApi(original);
                } catch (refreshErr) {
                    return Promise.reject(refreshErr);
                }
            }
        }
        return Promise.reject(error);
    }
);

export default protectedApi;
