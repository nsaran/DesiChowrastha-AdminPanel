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
 * #const FB_ACCESS_TOKEN = process.env.REACT_APP_FB_ACCESS_TOKEN || 'EAANNxHk4Y4QBRz8jGdlaWGkZAIOBLdOFJHc7JZCaPOc7c4KDr3HfyqBOsCTp8E3U592iUZAIcDGkESmjgCYOAx0jSthR5JAhIyfv9WYaDHGNqQIAnPjlOABOeoiZAiJRfjPDfIbBl1V7RVYFMNajFACZCze29vQ1ayFy6vSSGZB6pMszM9BehKpznuKsZA1oaKZAeXNv';
 */
const FB_ACCESS_TOKEN = process.env.REACT_APP_FB_ACCESS_TOKEN || 'EAANNxHk4Y4QBSVV4Q8HxGkAtZBpB3uPqmvfX0Ah3R2HNDk5cn1B8g3iQ1MRpHoUxx81gSh5cJnbpu8HZAfUapOZB5XvT2bZBJbKZBbxrNcoT1hSdnsPuQoFwaLbneAxvRJOBnOU3xoJ3L3Q5ZCipXAdO7oA2CmYvvTO2uD7F1CZAYuZA96aXzbD9ZCMdFiT0UTXSPSEJdTwZBxpPhjtETv7fc9XYCsraieIis9je2IsyYZD';

const FB_PAGE_ID = process.env.REACT_APP_FB_PAGE_ID || '100541449603228';

const FB_API_VERSION = 'v23.0';

const FB_POSTS_LIMIT = 10;

export { FB_ACCESS_TOKEN, FB_PAGE_ID, FB_API_VERSION, FB_POSTS_LIMIT };
