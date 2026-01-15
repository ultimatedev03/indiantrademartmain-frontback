import { jsPDF } from 'jspdf';
import crypto from 'crypto';

/**
 * Generate invoice number in format INV-YYYY-MM-XXXXX
 */
export const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INV-${year}-${month}-${random}`;
};

/**
 * Generate PDF invoice for subscription payment
 * @param {Object} paymentData - Payment and vendor details
 * @returns {string} Base64 encoded PDF
 */
export const generateInvoicePDF = (paymentData) => {
  const {
    invoiceNumber,
    invoiceDate,
    dueDate,
    vendor,
    plan,
    amount,
    tax = 0,
    totalAmount,
    paymentMethod = 'Razorpay',
    transactionId,
  } = paymentData;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'A4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Header - Company Info
  pdf.setFontSize(20);
  pdf.setTextColor(41, 128, 185);
  pdf.text('INDIAN TRADE MART', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Invoice for Vendor Subscription', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Invoice Details
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.text(`Invoice #: ${invoiceNumber}`, 20, yPosition);
  yPosition += 8;
  pdf.text(`Date: ${new Date(invoiceDate).toLocaleDateString('en-IN')}`, 20, yPosition);
  yPosition += 8;
  pdf.text(`Due Date: ${new Date(dueDate).toLocaleDateString('en-IN')}`, 20, yPosition);
  yPosition += 15;

  // Vendor Details
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'bold');
  pdf.text('Bill To:', 20, yPosition);
  yPosition += 8;
  pdf.setFont(undefined, 'normal');
  pdf.text(`${vendor?.company_name || 'N/A'}`, 20, yPosition);
  yPosition += 6;
  pdf.text(`Email: ${vendor?.email || 'N/A'}`, 20, yPosition);
  yPosition += 6;
  pdf.text(`Phone: ${vendor?.phone || 'N/A'}`, 20, yPosition);
  yPosition += 6;
  if (vendor?.address) {
    pdf.text(`Address: ${vendor.address}`, 20, yPosition);
    yPosition += 6;
  }
  if (vendor?.gst_number) {
    pdf.text(`GST: ${vendor.gst_number}`, 20, yPosition);
    yPosition += 6;
  }
  yPosition += 8;

  // Line items table
  const tableStartY = yPosition;
  const colWidths = [80, 35, 35, 35];
  const cols = ['Description', 'Quantity', 'Rate', 'Amount'];

  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.setFillColor(230, 230, 230);

  let xPos = 20;
  cols.forEach((col, idx) => {
    pdf.rect(xPos, tableStartY, colWidths[idx], 8, 'F');
    pdf.text(col, xPos + 2, tableStartY + 6);
    xPos += colWidths[idx];
  });

  yPosition = tableStartY + 10;
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);

  // Item row
  const itemName = `${plan?.name || 'Subscription'} Plan`;
  pdf.text(itemName, 22, yPosition);
  pdf.text('1', 100 + 8, yPosition, { align: 'center' });
  pdf.text(`₹${amount.toFixed(2)}`, 135 + 8, yPosition, { align: 'right' });
  pdf.text(`₹${amount.toFixed(2)}`, 170 + 8, yPosition, { align: 'right' });

  yPosition += 15;

  // Totals section
  const totalX = 135;
  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(10);
  pdf.text('Subtotal:', totalX, yPosition);
  pdf.text(`₹${amount.toFixed(2)}`, 170 + 8, yPosition, { align: 'right' });
  yPosition += 8;

  if (tax > 0) {
    pdf.text('Tax (18% GST):', totalX, yPosition);
    pdf.text(`₹${tax.toFixed(2)}`, 170 + 8, yPosition, { align: 'right' });
    yPosition += 8;
  }

  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(11);
  pdf.text('Total Amount:', totalX, yPosition);
  pdf.text(`₹${totalAmount.toFixed(2)}`, 170 + 8, yPosition, { align: 'right' });
  yPosition += 12;

  // Payment Details
  pdf.setFont(undefined, 'bold');
  pdf.setFontSize(10);
  pdf.text('Payment Information:', 20, yPosition);
  yPosition += 8;

  pdf.setFont(undefined, 'normal');
  pdf.setFontSize(9);
  pdf.text(`Payment Method: ${paymentMethod}`, 20, yPosition);
  yPosition += 6;
  if (transactionId) {
    pdf.text(`Transaction ID: ${transactionId}`, 20, yPosition);
    yPosition += 6;
  }
  pdf.text(`Payment Date: ${new Date().toLocaleDateString('en-IN')}`, 20, yPosition);
  yPosition += 12;

  // Terms
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  const termsText = 'This is an electronically generated invoice. No signature is required.';
  pdf.text(termsText, pageWidth / 2, pageHeight - 20, { align: 'center', maxWidth: 150 });

  // Footer
  pdf.setFontSize(8);
  pdf.text('For inquiries, contact support@indiantrademart.com', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return pdf.output('dataurlstring');
};

/**
 * Generate invoice summary for email
 */
export const generateInvoiceSummary = (paymentData) => {
  const { invoiceNumber, vendor, plan, amount, totalAmount } = paymentData;
  return `
    <h3>Invoice: ${invoiceNumber}</h3>
    <p><strong>Vendor:</strong> ${vendor?.company_name || 'N/A'}</p>
    <p><strong>Plan:</strong> ${plan?.name || 'N/A'}</p>
    <p><strong>Amount:</strong> ₹${totalAmount.toFixed(2)}</p>
    <p><strong>Status:</strong> Completed</p>
  `;
};
