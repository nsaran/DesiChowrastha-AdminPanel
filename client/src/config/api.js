/**
 * API Configuration
 * 
 * Set the base URL for all API calls.
 * - Development: http://localhost:3010
 * - Production: https://desichowrastha-admin.azurewebsites.net
 * 
 * Uses REACT_APP_API_BASE_URL environment variable if set,
 * otherwise falls back to the default below.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://71.83.55.46:3010';

export default API_BASE_URL;
