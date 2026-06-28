/**
 * Facebook Graph API Configuration
 * 
 * Configure the access token and page ID for fetching Facebook posts.
 * The access_token changes periodically - update it here or via environment variable.
 * 
 * Uses REACT_APP_FB_ACCESS_TOKEN environment variable if set,
 * otherwise falls back to the default below.
 * 
 * Uses REACT_APP_FB_PAGE_ID environment variable if set,
 * otherwise falls back to the default below.
 */

const FB_ACCESS_TOKEN = process.env.REACT_APP_FB_ACCESS_TOKEN || 'EAANNxHk4Y4QBR8FLMBQQmOQfgRVxVjDLT2JAVZCeJQgsUzX5SM8wfFpcSgCsfoCWxfqtimAXKzwEL0Ck4wfFAsVVfqnRV5rrLXumDurqcLG6gukkauPPd7lqLEB8SWxv3Bx4bcZAMxgQtYhaR7GrruWp7LuMpRpifgdR7lZAptpZCeidI2hyxE8NKJVbGzKL4y0YcJl8qtkZAhXrOSf7FGZB0Nws1UmdfRonxnmFapXVElSNhGkIIPuaps2gpRjYRWwp7ZASVzEGdYZBO9ZAp8xkZD';

const FB_PAGE_ID = process.env.REACT_APP_FB_PAGE_ID || '100541449603228';

const FB_API_VERSION = 'v25.0';

const FB_POSTS_LIMIT = 20;

export { FB_ACCESS_TOKEN, FB_PAGE_ID, FB_API_VERSION, FB_POSTS_LIMIT };
