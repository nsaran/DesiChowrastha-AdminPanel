module.exports = {
    port: process.env.PORT || 3010,
    toastApiBaseUrl: process.env.TOAST_API_BASE_URL,
    locations: {
        HERNDON: {
            clientId: process.env.HERNDON_CLIENT_ID,
            clientSecret: process.env.HERNDON_CLIENT_SECRET,
            restaurantExternalId: process.env.HERNDON_RESTAURANT_EXTERNAL_ID
        },
        NASHUA: {
            clientId: process.env.NASHUA_CLIENT_ID,
            clientSecret: process.env.NASHUA_CLIENT_SECRET,
            restaurantExternalId: process.env.NASHUA_RESTAURANT_EXTERNAL_ID
        }
    }
};
