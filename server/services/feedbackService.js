const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Send customer feedback to the restaurant owner via WhatsApp
 * using Facebook's WhatsApp Business Cloud API with a template message.
 * 
 * Required environment variables:
 * - WA_PHONE_NUMBER_ID_WESTBOROUGH: WhatsApp Business phone number ID for Westborough
 * - WA_PHONE_NUMBER_ID_NASHUA: WhatsApp Business phone number ID for Nashua
 * - WA_ACCESS_TOKEN: Facebook/Meta access token for WhatsApp API
 * - OWNER_PHONE_NUMBER: Comma-separated owner phone numbers in international format
 * - WA_TEMPLATE_NAME: Name of the approved WhatsApp template (default: 'customer_feedback')
 */

const WA_PHONE_NUMBER_IDS = {
    WESTBOROUGH: process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID,
    NASHUA: process.env.WA_PHONE_NUMBER_ID_NASHUA
};
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const OWNER_PHONE_NUMBERS = (process.env.OWNER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);
const WA_FEEDBACK_TEMPLATE_NAME = process.env.WA_FEEDBACK_TEMPLATE_NAME || 'customer_feedback';
const WA_TEMPLATE_LANGUAGE = process.env.WA_TEMPLATE_LANGUAGE || 'en_US';
const WA_API_VERSION = 'v21.0';

/**
 * Send feedback notification to the owner via WhatsApp template message
 * 
 * @param {Object} feedback - The feedback data
 * @param {string} feedback.feedbackType - Type: complaint, suggestion, review, compliment
 * @param {string} feedback.name - Customer name
 * @param {string} feedback.email - Customer email (optional)
 * @param {string} feedback.phone - Customer phone (optional)
 * @param {string} feedback.message - Feedback message
 * @param {string} feedback.location - Restaurant location: 'Westborough' or 'Nashua'
 */
async function sendFeedbackToOwner(feedback) {
    const { feedbackType, name, email, message, phone, location } = feedback;

    // Determine the correct WA phone number ID based on location
    const locationKey = (location || 'WESTBOROUGH').toUpperCase();
    const phoneNumberId = WA_PHONE_NUMBER_IDS[locationKey] || WA_PHONE_NUMBER_IDS.WESTBOROUGH;

    if (!phoneNumberId || !WA_ACCESS_TOKEN || OWNER_PHONE_NUMBERS.length === 0) {
        logger.error(`WhatsApp API credentials not configured for ${locationKey}. Check WA_PHONE_NUMBER_ID_${locationKey}, WA_ACCESS_TOKEN, and OWNER_PHONE_NUMBER in .env`);
        throw new Error('WhatsApp API not configured');
    }

    const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`;
    const results = [];

    for (const ownerPhone of OWNER_PHONE_NUMBERS) {
        const payload = {
            messaging_product: 'whatsapp',
            to: ownerPhone,
            type: 'template',
            template: {
                name: WA_FEEDBACK_TEMPLATE_NAME,
                language: {
                    code: WA_TEMPLATE_LANGUAGE
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: feedbackType || 'General' },
                            { type: 'text', text: name || 'Anonymous' },
                            { type: 'text', text: message || 'No message provided' },
                            { type: 'text', text: email || 'Not provided' },
                            { type: 'text', text: phone || 'Not provided' }
                        ]
                    }
                ]
            }
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`[${locationKey}] WhatsApp feedback sent to ${ownerPhone}. Message ID: ${response.data.messages?.[0]?.id}`);
            results.push({ phoneNumber: ownerPhone, success: true, messageId: response.data.messages?.[0]?.id });
            // Delay between sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            logger.error(`[${locationKey}] Failed to send WhatsApp feedback to ${ownerPhone}: ${errorMsg}`);
            results.push({ phoneNumber: ownerPhone, success: false, error: errorMsg });
        }
    }

    const successCount = results.filter(r => r.success).length;
    if (successCount === 0) {
        throw new Error('Failed to send WhatsApp message to all recipients');
    }

    return { success: true, results };
}

module.exports = {
    sendFeedbackToOwner
};
