const axios = require('axios');
const { toastApiBaseUrl, locations } = require('../config/config');
let tokens = {};

async function fetchAccessToken(location) {
    const { clientId, clientSecret, restaurantExternalId } = locations[location];
    const response = await axios.post(`${toastApiBaseUrl}/authentication/v1/authentication/login`, {
        clientId: clientId,
        clientSecret: clientSecret,
        userAccessType: "TOAST_MACHINE_CLIENT"
    });

    const accessToken = response.data.token.accessToken;
    const expiresIn = response.data.token.expiresIn * 1000;

    tokens[restaurantExternalId] = {
        accessToken: accessToken,
        expiry: Date.now() + expiresIn
    };

    return accessToken;
}

async function getAccessToken(location) {
    const { restaurantExternalId } = locations[location];
    if (!tokens[restaurantExternalId] || Date.now() >= tokens[restaurantExternalId].expiry) {
        return await fetchAccessToken(location);
    }
    return tokens[restaurantExternalId].accessToken;
}

module.exports = {
    getAccessToken
};
