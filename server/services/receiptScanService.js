const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('../config/firebaseAdmin'); // ensure Admin SDK is initialized
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { resolveRestaurantId } = require('./resolveRestaurantId');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// MIME type from a file extension (for the Storage upload + vision data URL).
function mimeFromExt(ext) {
    switch ((ext || '').toLowerCase()) {
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.heic': return 'image/heic';
        case '.pdf': return 'application/pdf';
        case '.jpg':
        case '.jpeg':
        default: return 'image/jpeg';
    }
}

/**
 * Upload a receipt image to Firebase Storage under
 *   receipts/{LOCATION}/{orderId}/{filename}
 * Returns { storagePath, signedUrl } (signed URL valid ~7 days for quick viewing).
 */
async function uploadReceiptToStorage(location, orderId, filePath, filename) {
    const bucket = getStorage().bucket();
    const ext = path.extname(filename);
    const contentType = mimeFromExt(ext);
    const storagePath = `receipts/${location}/${orderId}/${filename}`;

    await bucket.upload(filePath, {
        destination: storagePath,
        metadata: { contentType },
        resumable: false,
    });

    let signedUrl = null;
    try {
        const [url] = await bucket.file(storagePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        signedUrl = url;
    } catch (e) {
        logger.warn(`[ReceiptScan] signed URL failed: ${e.message}`);
    }
    return { storagePath, signedUrl, contentType };
}

/**
 * Extract structured transaction data from a receipt image using gpt-4o vision.
 * Returns a plain object; fields are best-effort and may be null.
 */
async function extractReceiptData(filePath, contentType) {
    // PDFs aren't supported by the vision image input; skip extraction for those.
    if (contentType === 'application/pdf') {
        return { parseError: 'PDF receipts are not auto-scanned; stored without extraction.' };
    }

    const b64 = fs.readFileSync(filePath).toString('base64');
    const dataUrl = `data:${contentType};base64,${b64}`;

    const systemPrompt =
        'You extract structured data from a restaurant vendor/supplier receipt or invoice image. '
        + 'Return ONLY valid JSON (no markdown) with this exact shape: '
        + '{"vendor": string|null, "date": string|null (ISO YYYY-MM-DD if possible), '
        + '"currency": string|null, "subtotal": number|null, "tax": number|null, '
        + '"total": number|null, "paymentMethod": string|null, '
        + '"lineItems": [{"description": string, "quantity": number|null, "unitPrice": number|null, "amount": number|null}]}. '
        + 'Use numbers (not strings) for money fields. If a value is not present, use null. '
        + 'Extract every line item you can read.';

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Extract the receipt data as JSON.' },
                    { type: 'image_url', image_url: { url: dataUrl } },
                ],
            },
        ],
        max_tokens: 1500,
        temperature: 0,
        response_format: { type: 'json_object' },
    });

    const raw = response.choices?.[0]?.message?.content || '{}';
    try {
        return JSON.parse(raw);
    } catch (e) {
        return { parseError: 'Model returned non-JSON output', raw };
    }
}

/**
 * Full flow for one uploaded receipt: upload to Storage, scan with gpt-4o,
 * save a transaction document to Firestore, and return the saved record.
 * Firestore path: restaurants/{RID}/receiptTransactions/{autoId}
 */
async function scanAndStoreReceipt({ location, orderId, filePath, filename, originalName, size }) {
    const rid = await resolveRestaurantId(location);
    const db = getFirestore();

    // 1) Upload the image to Firebase Storage.
    let storage = { storagePath: null, signedUrl: null, contentType: mimeFromExt(path.extname(filename)) };
    try {
        storage = await uploadReceiptToStorage(location, orderId, filePath, filename);
    } catch (e) {
        logger.error(`[ReceiptScan] Storage upload failed for ${filename}: ${e.message}`);
    }

    // 2) Extract transaction data with gpt-4o vision.
    let extracted = {};
    try {
        extracted = await extractReceiptData(filePath, storage.contentType);
    } catch (e) {
        logger.error(`[ReceiptScan] extraction failed for ${filename}: ${e.message}`);
        extracted = { parseError: e.message };
    }

    // 3) Persist the transaction to Firestore.
    const record = {
        location: rid,
        orderId,
        filename,
        originalName: originalName || filename,
        size: size || null,
        storagePath: storage.storagePath,
        imageUrl: storage.signedUrl,
        contentType: storage.contentType,
        vendor: extracted.vendor ?? null,
        date: extracted.date ?? null,
        currency: extracted.currency ?? null,
        subtotal: extracted.subtotal ?? null,
        tax: extracted.tax ?? null,
        total: extracted.total ?? null,
        paymentMethod: extracted.paymentMethod ?? null,
        lineItems: Array.isArray(extracted.lineItems) ? extracted.lineItems : [],
        parseError: extracted.parseError ?? null,
        status: 'scanned', // 'scanned' -> user can later mark 'reviewed'
        scannedAt: new Date().toISOString(),
    };

    const ref = await db.collection('restaurants').doc(rid)
        .collection('receiptTransactions').add(record);

    logger.info(`[ReceiptScan] ${rid}/${orderId} ${filename}: vendor=${record.vendor} total=${record.total} items=${record.lineItems.length}`);
    return { id: ref.id, ...record };
}

/** List receipt transactions for a location (most recent first). */
async function listReceiptTransactions(location, orderId) {
    const rid = await resolveRestaurantId(location);
    const db = getFirestore();
    let query = db.collection('restaurants').doc(rid).collection('receiptTransactions');
    if (orderId) query = query.where('orderId', '==', orderId);
    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => String(b.scannedAt).localeCompare(String(a.scannedAt)));
    return items;
}

module.exports = { scanAndStoreReceipt, listReceiptTransactions };
