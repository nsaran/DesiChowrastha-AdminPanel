const PDFDocument = require('pdfkit');

/**
 * Party Orders snapshot PDF generator.
 *
 * Builds a clean, printable PDF summarizing one or more party orders for a
 * given day (used by the "tomorrow's party orders" WhatsApp notification to
 * chef + manager). Returns a Promise<Buffer> so it can be uploaded directly to
 * the WhatsApp Media API without touching disk.
 */

const COLORS = {
    brand: '#8B0000',      // deep red (DesiChowrastha)
    brandLight: '#F4E1E1',
    text: '#222222',
    muted: '#666666',
    line: '#DDDDDD',
    rowAlt: '#FAF6F6',
    headerBg: '#8B0000',
    headerText: '#FFFFFF',
};

function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

function money(v) {
    return `$${num(v).toFixed(2)}`;
}

/**
 * @param {Object} opts
 * @param {string} opts.location       - e.g. 'NASHUA'
 * @param {string} opts.dateLabel      - human date, e.g. 'Tuesday, Aug 25, 2026'
 * @param {Array}  opts.orders         - party order docs (with cPartyOrderItems etc.)
 * @returns {Promise<Buffer>}
 */
function generatePartyOrdersPdf({ location, dateLabel, orders }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageWidth = doc.page.width;
            const left = doc.page.margins.left;
            const right = pageWidth - doc.page.margins.right;
            const contentWidth = right - left;

            // ---- Header band ----
            doc.rect(0, 0, pageWidth, 90).fill(COLORS.brand);
            doc.fillColor(COLORS.headerText)
                .font('Helvetica-Bold').fontSize(22)
                .text('DesiChowrastha', left, 24);
            doc.font('Helvetica').fontSize(11)
                .text('Party Orders — Kitchen Prep Sheet', left, 52);
            doc.font('Helvetica-Bold').fontSize(11)
                .text(String(location || '').toUpperCase(), left, 24, { width: contentWidth, align: 'right' });
            doc.font('Helvetica').fontSize(10)
                .text(dateLabel || '', left, 52, { width: contentWidth, align: 'right' });

            doc.moveDown();
            let y = 110;

            const orderList = Array.isArray(orders) ? orders : [];

            // ---- Summary line ----
            doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13)
                .text(
                    `${orderList.length} party order${orderList.length === 1 ? '' : 's'} for ${dateLabel || 'the selected day'}`,
                    left, y
                );
            y = doc.y + 10;

            if (orderList.length === 0) {
                doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted)
                    .text('No party orders are scheduled for this day.', left, y);
                doc.end();
                return;
            }

            // ---- Each order block ----
            orderList.forEach((o, idx) => {
                y = renderOrder(doc, o, { left, contentWidth, startY: y, index: idx + 1 });
                y += 16;
                // page break if near bottom
                if (y > doc.page.height - 80) {
                    doc.addPage();
                    y = 50;
                }
            });

            // ---- Footer on the last page ----
            doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
                .text(
                    `Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} • DesiChowrastha Admin`,
                    left, doc.page.height - 50, { width: contentWidth, align: 'center' }
                );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Render a single order card (customer header + items table). Returns new y.
 */
function renderOrder(doc, o, { left, contentWidth, startY, index }) {
    let y = startY;
    const right = left + contentWidth;

    // Order header bar
    doc.rect(left, y, contentWidth, 24).fill(COLORS.brandLight);
    doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(11)
        .text(`#${index}  ${o.cName || 'Customer'}`, left + 8, y + 7, { width: contentWidth - 160 });
    const invoice = o.cInvoiceNumber ? `Inv ${o.cInvoiceNumber}` : '';
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
        .text(invoice, right - 158, y + 8, { width: 150, align: 'right' });
    y += 30;

    // Meta line: phone, delivery time, status
    const meta = [
        o.cPhoneNumber ? `Phone: ${o.cPhoneNumber}` : null,
        o.cOrderDeliveryTime ? `Delivery: ${o.cOrderDeliveryTime}` : null,
        o.cPartyOrderStatus ? `Status: ${o.cPartyOrderStatus}` : null,
    ].filter(Boolean).join('    •    ');
    if (meta) {
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(meta, left + 2, y);
        y = doc.y + 6;
    }
    if (o.cPartyOrderComments) {
        doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(9)
            .text(`Note: ${o.cPartyOrderComments}`, left + 2, y, { width: contentWidth });
        y = doc.y + 6;
    }

    // Items table
    const items = Array.isArray(o.cPartyOrderItems) ? o.cPartyOrderItems : [];
    // Columns: Item | Qty | Tray | Spice | Comments
    const cols = [
        { key: 'itemName', label: 'Item', w: 0.34 },
        { key: 'qty', label: 'Qty', w: 0.08, align: 'center' },
        { key: 'trayType', label: 'Tray', w: 0.16 },
        { key: 'spiceLevel', label: 'Spice', w: 0.16 },
        { key: 'itemComments', label: 'Notes', w: 0.26 },
    ];
    const colX = [];
    let acc = left;
    cols.forEach((c) => { colX.push(acc); acc += c.w * contentWidth; });

    // header row
    const headerH = 18;
    doc.rect(left, y, contentWidth, headerH).fill(COLORS.headerBg);
    doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(9);
    cols.forEach((c, i) => {
        doc.text(c.label, colX[i] + 4, y + 5, { width: c.w * contentWidth - 8, align: c.align || 'left' });
    });
    y += headerH;

    // body rows
    doc.font('Helvetica').fontSize(9);
    items.forEach((it, rIdx) => {
        const rowText = [
            it.itemName || '',
            String(it.qty ?? it.itemQuantity ?? ''),
            it.trayType || '',
            it.spiceLevel || '',
            it.itemComments || '',
        ];
        // measure row height from the tallest wrapped cell
        const heights = cols.map((c, i) =>
            doc.heightOfString(rowText[i], { width: c.w * contentWidth - 8 })
        );
        const rowH = Math.max(16, ...heights) + 6;

        if (rIdx % 2 === 1) {
            doc.rect(left, y, contentWidth, rowH).fill(COLORS.rowAlt);
        }
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);
        cols.forEach((c, i) => {
            doc.text(rowText[i], colX[i] + 4, y + 4, { width: c.w * contentWidth - 8, align: c.align || 'left' });
        });
        // bottom border
        doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor(COLORS.line).lineWidth(0.5).stroke();
        y += rowH;
    });

    if (items.length === 0) {
        doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(9)
            .text('No items listed on this order.', left + 4, y + 4);
        y += 20;
    }

    return y;
}

module.exports = { generatePartyOrdersPdf };
