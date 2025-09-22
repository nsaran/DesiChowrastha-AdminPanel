import jsPDF from 'jspdf';
import 'jspdf-autotable';

import dcLogo from '../../../../assets/images/logo.png';
import eSignature from '../../../../assets/images/eSignature.png';
import reviewQR from '../../../../assets/images/qr-code.png';

export const generateInvoicePdf = (order, returnBlob = false) => {
    const invoiceData = {
        invoiceNumber: order.cInvoiceNumber,
        orderDate: order.cOrderDate,
        customerName: order.cName,
        phoneNumber: order.cPhoneNumber,
        partyOrderItems: order.cPartyOrderItems || [],
        partyDate: order.cPartyDate,
        orderDiscount: order.cOrderDiscount,
        orderTotal: order.cOrderTotal,
    };

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const qrMarginLeft = 12; // Define the left margin for the QR code

    // Add Logo
    doc.addImage(dcLogo, 'PNG', 15, 10, 48, 50);

    // Add Restaurant Address and Phone
    doc.setFontSize(14);
    doc.text('274 Daniel Webster Hwy,', pageWidth - 15, 30, { align: 'right' });
    doc.text('Nashua, NH 03060, US', pageWidth - 15, 38, { align: 'right' });
    doc.text('(+1) 603-722-0770', pageWidth - 15, 46, { align: 'right' });

    // Invoice Details and Billing Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice No: #${invoiceData.invoiceNumber}`, 15, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('Bill To:', 15, 80);
    doc.setFontSize(12);
    doc.text(invoiceData.customerName, 15, 90);
    doc.text(`+${invoiceData.phoneNumber}`, 15, 96);

    // Order and Party Dates
    doc.text(`Order Date: ${invoiceData.orderDate}`, pageWidth - 15, 90, { align: 'right' });
    doc.text(`Party Date: ${invoiceData.partyDate}`, pageWidth - 15, 96, { align: 'right' });

    // Table with Order Items
    const columns = ['Item Name', 'Quantity', 'Tray Type', 'Spice Level', 'Item Comments', 'Price'];
    const rows = invoiceData.partyOrderItems.map(item => [
        item.itemName,
        item.qty,
        item.trayType,
        item.spiceLevel,
        item.itemComments || '-',
        `$ ${(Number(item.price) || 0).toFixed(2)}`,
    ]);

    // Adding Total Row
    const total = invoiceData.partyOrderItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
    rows.push(['Total', '', '', '', '', `$${total.toFixed(2)}`]);

    if (invoiceData.orderDiscount > 0) {
        const discountAmount = (invoiceData.orderDiscount / 100) * total;
        const grandTotal = total - discountAmount;
        rows.push([`Discount (${invoiceData.orderDiscount}%)`, '', '', '', '', `-$${discountAmount.toFixed(2)}`]);
        rows.push(['Grand Total', '', '', '', '', `$${grandTotal.toFixed(2)}`]);
    }

    doc.autoTable(columns, rows, { 
        startY: 110,
        styles: { fillColor: [211, 211, 211] }, // grey color
    });

    // Check if content exceeds page height
    let finalY = doc.autoTable.previous.finalY + 10;
    const footerHeight = 20;

    // Thank You Message
    const thankYouMessage = 'Thank you for choosing our restaurant for your dining experience! We appreciate your order and hope you enjoyed our delicious food. We look forward to serving you again soon.';
    const thankYouMessageHeight = doc.getTextDimensions(thankYouMessage).h;

    // Check if content exceeds page height after adding QR code and signature
    if (finalY + footerHeight + thankYouMessageHeight + 10 > pageHeight) {
        doc.addPage();
        finalY = 20; // Reset finalY for new page
    }

    // Authorized Signature and QR Code
    doc.setFontSize(12);
    doc.text('Authorized Signature:', 15, finalY + 15);
    doc.addImage(eSignature, 'PNG', 15, finalY + 20, 50, 25);
    doc.addImage(reviewQR, 'PNG', pageWidth - 65 + qrMarginLeft, finalY + 10, 40, 40);

    finalY += 65;

    // Ensure thank you message and footer fit on the same page
    if (finalY + thankYouMessageHeight + footerHeight + 10 > pageHeight) {
        doc.addPage();
        finalY = 20; // Reset finalY for new page
    }

    // Thank You Message
    doc.setFontSize(12);
    doc.text(thankYouMessage, pageWidth / 2, pageHeight - footerHeight - 10 - thankYouMessageHeight, { align: 'center', maxWidth: pageWidth - 30 });

    // Footer with Background
    const footerY = pageHeight - footerHeight;
    doc.setFillColor(211, 211, 211); // Light grey background
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Black text color
    doc.text('For any inquiries, please contact us at chowrastha.nh@mypi.lic', pageWidth / 2, footerY + footerHeight / 2 + 3, { align: 'center' });

    if (returnBlob) {
        return doc.output('blob');
    }

    doc.save(`Invoice_${invoiceData.invoiceNumber}.pdf`);
};
