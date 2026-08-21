const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Stock Order WhatsApp Notification Service
 * 
 * Sends order updates to Chef and Purchaser via WhatsApp.
 * Uses a template message with order link.
 * 
 * Env vars:
 * - CHEF_PHONE_NUMBER: comma-separated phone numbers
 * - PURCHASER_PHONE_NUMBER: comma-separated phone numbers
 * - WA_ACCESS_TOKEN: WhatsApp API token
 * - WA_PHONE_NUMBER_ID_NASHUA / WA_PHONE_NUMBER_ID_WESTBOROUGH
 * - WA_STOCK_ORDER_TEMPLATE_NAME: (optional) template name for stock order notifications
 * - SERVER_PUBLIC_URL: public URL for the app (default: https://repodepo.io)
 */

const WA_API_VERSION = 'v21.0';

function getPhoneNumberId(location) {
    const loc = location.toUpperCase();
    if (loc === 'NASHUA') return process.env.WA_PHONE_NUMBER_ID_NASHUA;
    return process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID;
}

function getRecipients(role) {
    const envVar = role === 'chef' ? 'CHEF_PHONE_NUMBER' : 'PURCHASER_PHONE_NUMBER';
    return (process.env[envVar] || '').split(',').map(n => n.trim()).filter(Boolean);
}

function getOrderUrl(location, orderId) {
    const baseUrl = process.env.SERVER_PUBLIC_URL || 'https://repodepo.io';
    return `${baseUrl}/dashboard/${location}/OtherServices/StockOrders?order=${orderId}`;
}

/**
 * Send WhatsApp notification about a stock order
 * @param {string} location - NASHUA or WESTBOROUGH
 * @param {object} order - The order object
 * @param {string} event - Event type: created, submitted, purchased, received, closed
 * @param {string} notifyRole - 'chef', 'purchaser', or 'both'
 */
async function sendStockOrderNotification(location, order, event, notifyRole = 'both') {
    const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = getPhoneNumberId(location);
    const templateName = process.env.WA_STOCK_ORDER_TEMPLATE_NAME;

    if (!WA_ACCESS_TOKEN || !phoneNumberId) {
        logger.warn(`[StockOrderNotify] WhatsApp not configured for ${location}`);
        return;
    }

    const orderUrl = getOrderUrl(location, order.id);
    const itemCount = order.items?.length || 0;
    const orderedBy = order.orderedBy || 'Chef';

    // Determine recipients
    let recipients = [];
    if (notifyRole === 'chef' || notifyRole === 'both') {
        recipients.push(...getRecipients('chef'));
    }
    if (notifyRole === 'purchaser' || notifyRole === 'both') {
        recipients.push(...getRecipients('purchaser'));
    }
    // Deduplicate
    recipients = [...new Set(recipients)];

    if (recipients.length === 0) {
        logger.warn(`[StockOrderNotify] No recipients configured for role: ${notifyRole}`);
        return;
    }

    // Build message text
    let messageText = '';
    switch (event) {
        case 'created':
            messageText = `📦 *New Stock Order Created*\n\n📍 Location: ${location}\n👨‍🍳 By: ${orderedBy}\n📋 Items: ${itemCount}\n\n🔗 View & Edit: ${orderUrl}`;
            break;
        case 'submitted':
            messageText = `📤 *Stock Order Submitted*\n\n📍 Location: ${location}\n👨‍🍳 By: ${orderedBy}\n📋 Items: ${itemCount}\n\nReady for purchase!\n🔗 View Order: ${orderUrl}`;
            break;
        case 'purchased':
            messageText = `🛒 *Stock Order Purchased*\n\n📍 Location: ${location}\n📋 Items: ${itemCount}\n\nItems bought. Awaiting delivery.\n🔗 View Order: ${orderUrl}`;
            break;
        case 'received':
            messageText = `✅ *Stock Order Received*\n\n📍 Location: ${location}\n📋 Items: ${itemCount}\n\nItems received. Please validate and close.\n🔗 View Order: ${orderUrl}`;
            break;
        case 'closed':
            messageText = `🔒 *Stock Order Closed*\n\n📍 Location: ${location}\n👨‍🍳 By: ${orderedBy}\n📋 Items: ${itemCount}\n\nInventory updated.\n🔗 View Order: ${orderUrl}`;
            break;
        default:
            messageText = `📦 *Stock Order Update*\n\n📍 Location: ${location}\n📋 Items: ${itemCount}\n🔗 View: ${orderUrl}`;
    }

    const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`;

    for (const recipient of recipients) {
        try {
            if (templateName) {
                // Use template: stock_order_update with 5 params
                // {{1}}=event, {{2}}=location, {{3}}=orderedBy, {{4}}=item count, {{5}}=url
                await axios.post(url, {
                    messaging_product: 'whatsapp',
                    to: recipient,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: process.env.WA_TEMPLATE_LANGUAGE || 'en' },
                        components: [
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', text: event.toUpperCase() },
                                    { type: 'text', text: location },
                                    { type: 'text', text: orderedBy },
                                    { type: 'text', text: `${itemCount} items` },
                                    { type: 'text', text: orderUrl }
                                ]
                            }
                        ]
                    }
                }, {
                    headers: { 'Authorization': `Bearer ${WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
                });
            } else {
                // Send as plain text message
                await axios.post(url, {
                    messaging_product: 'whatsapp',
                    to: recipient,
                    type: 'text',
                    text: { body: messageText }
                }, {
                    headers: { 'Authorization': `Bearer ${WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
                });
            }

            logger.info(`[StockOrderNotify] ${event} notification sent to ${recipient} for ${location}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between sends
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            logger.error(`[StockOrderNotify] Failed to send to ${recipient}: ${errorMsg}`);
        }
    }
}

module.exports = { sendStockOrderNotification };
