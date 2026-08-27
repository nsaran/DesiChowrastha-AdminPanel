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

// Attach auth token to every request
protectedApi.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default protectedApi;
