const { google } = require('googleapis');
const logger = require('../utils/logger');

/**
 * Google Sheets Service
 * 
 * Handles writing promo subscribers and daily sales summaries to Google Sheets.
 * 
 * Required environment variables:
 * - GOOGLE_SHEETS_CLIENT_EMAIL: Service account email
 * - GOOGLE_SHEETS_PRIVATE_KEY: Service account private key
 * - GOOGLE_SHEETS_SPREADSHEET_ID: The spreadsheet ID
 * 
 * Sheet structure:
 * - Sheet "Subscribers": Name, Email, Phone, Location, Date
 * - Sheet "Daily Sales": Date, Location, Total Orders, Total Sales
 */

let sheetsClient = null;

/**
 * Initialize Google Sheets client
 */
function getClient() {
    if (sheetsClient) return sheetsClient;

    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
        logger.warn('[GoogleSheets] Not configured. Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID in .env');
        return null;
    }

    const auth = new google.auth.JWT(
        clientEmail,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

/**
 * Append a row to a specific sheet
 */
async function appendRow(sheetName, values) {
    const client = getClient();
    if (!client) return;

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    try {
        await client.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values]
            }
        });
        logger.info(`[GoogleSheets] Row added to ${sheetName}`);
    } catch (error) {
        logger.error(`[GoogleSheets] Error writing to ${sheetName}: ${error.message}`);
    }
}

/**
 * Add a promo subscriber to the "Subscribers" sheet
 * Columns: Name, Email, Phone, Location, Subscribed Date
 */
async function addSubscriber(subscriber) {
    const { name, email, phone, location } = subscriber;
    const date = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    await appendRow('Subscribers', [name, email, phone, location, date]);
}

/**
 * Log daily sales summary to the "Daily Sales" sheet
 * Columns: Date, Location, Total Orders, Total Sales
 * If a record for the same date and location already exists, update it instead of adding a new row.
 */
async function logDailySales(location, totalOrders, totalSales) {
    const client = getClient();
    if (!client) return;

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    try {
        // Read existing data to check for duplicate date+location
        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range: 'Daily Sales!A:D',
        });

        const rows = response.data.values || [];
        let existingRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === date && rows[i][1] === location) {
                existingRowIndex = i;
                break;
            }
        }

        if (existingRowIndex >= 0) {
            // Update existing row (1-indexed for Sheets API)
            const rowNumber = existingRowIndex + 1;
            await client.spreadsheets.values.update({
                spreadsheetId,
                range: `Daily Sales!A${rowNumber}:D${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[date, location, totalOrders, totalSales]]
                }
            });
            logger.info(`[GoogleSheets] Updated existing Daily Sales row ${rowNumber} for ${date} - ${location}`);
        } else {
            // Append new row
            await appendRow('Daily Sales', [date, location, totalOrders, totalSales]);
        }
    } catch (error) {
        logger.error(`[GoogleSheets] Error logging daily sales: ${error.message}`);
    }
}

/**
 * Get all promo subscribers from the "Subscribers" sheet
 * Returns array of { name, email, phone, location, date }
 * Optionally filter by location
 */
async function getSubscribers(location) {
    const client = getClient();
    if (!client) return [];

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    try {
        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range: 'Subscribers!A:E',
        });

        const rows = response.data.values || [];
        if (rows.length <= 1) return []; // Only header or empty

        const subscribers = rows.slice(1).map(row => ({
            name: row[0] || '',
            email: row[1] || '',
            phone: row[2] || '',
            location: row[3] || '',
            date: row[4] || ''
        }));

        if (location) {
            return subscribers.filter(s => s.phone && s.location.toUpperCase() === location.toUpperCase());
        }

        return subscribers.filter(s => s.phone);
    } catch (error) {
        logger.error(`[GoogleSheets] Error reading subscribers: ${error.message}`);
        return [];
    }
}

module.exports = {
    addSubscriber,
    logDailySales,
    getSubscribers
};
