const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const fontPath = path.join(__dirname, '../public/fonts/NotoSansDevanagari-Regular.ttf');
const logoPath = path.join(__dirname, '../public/images/logo.jpg');

const TICKET_SECURITY_SECRET = process.env.TICKET_SECURITY_SECRET || 'MVD_SHREE_VAISHNO_DEVI_SECURE_TOKEN_2026';

class PDFService {
  // Shared layout for the travel slip to avoid drift, blank gaps, and fake-stamped branding.
  static renderBookingSlip(doc, booking, { qrBuffer, secHash } = {}) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginX = 16;
    const contentWidth = pageWidth - (marginX * 2);

    const cleanPnr = PDFService.cleanPdfText(booking.bookingId, 'MVD-PNR');
    const cleanBookedBy = PDFService.cleanPdfText(booking.bookedBy, 'Devotee');
    const cleanMobile = PDFService.cleanPdfText(booking.mobile, 'N/A');
    const cleanAadhar = PDFService.cleanPdfText(booking.aadhar, 'Verified at Station');
    const cleanFrom = PDFService.cleanPdfText(booking.fromStation, 'New Delhi (NDLS)');
    const cleanTo = PDFService.cleanPdfText(booking.toStation, 'Shri Mata Vaishno Devi Katra (SVDK)');
    const cleanClass = PDFService.cleanPdfText(booking.travelClass, 'Sleeper');
    const cleanCoach = PDFService.cleanPdfText(booking.coachName, 'S1');
    const seatStr = Array.isArray(booking.seatNumber) && booking.seatNumber.length > 0 ? booking.seatNumber.join(', ') : (booking.seatNumber || 'Allocated');

    const rawPassengers = booking.passengers && booking.passengers.length > 0
      ? booking.passengers
      : [{ name: booking.bookedBy, age: 'N/A', gender: 'N/A', aadhar: booking.aadhar, seatAssigned: seatStr, berthPreference: 'Berth' }];

    const pCount = rawPassengers.length;
    const rowH = pCount > 6 ? 13 : 15;
    const pFontSize = pCount > 6 ? 7 : 7.5;

    // Outer main border
    const totalBoxHeight = pageHeight - 24;
    doc.rect(marginX, 12, contentWidth, totalBoxHeight).lineWidth(1).strokeColor('#0284C7').stroke();

    // Header 1
    doc.rect(marginX, 12, contentWidth, 44).fillColor('#075985').fill();
    doc.fillColor('#FFFFFF').fontSize(12.5).font('Helvetica-Bold').text('SHRI MATA VAISHNO DEVI PUBLIC CHARITABLE TRUST', marginX + 8, 18, { width: contentWidth - 16, align: 'center' });
    doc.fillColor('#BAE6FD').fontSize(8).font('Helvetica').text('YATRA SPECIAL SUPERFAST EXPRESS • ANNUAL PILGRIMAGE SPECIAL TRAIN', marginX + 8, 32, { width: contentWidth - 16, align: 'center' });
    doc.fillColor('#FDE047').fontSize(7.5).font('Helvetica-Bold').text('DIGITAL TRAVEL SLIP • VALID FOR VERIFICATION', marginX + 8, 43, { width: contentWidth - 16, align: 'center' });

    // Header 2
    let y = 58;
    doc.rect(marginX, y, contentWidth, 18).fillColor('#F0F9FF').fill().strokeColor('#BAE6FD').lineWidth(0.5).stroke();
    doc.fillColor('#0C4A6E').fontSize(8).font('Helvetica-Bold').text('PNR / BOOKING ID:', marginX + 10, y + 4.5);
    doc.fillColor('#DC2626').fontSize(9.5).font('Helvetica-Bold').text(cleanPnr, marginX + 110, y + 4);
    doc.fillColor('#0C4A6E').fontSize(8).font('Helvetica-Bold').text('QUOTA:', marginX + 250, y + 4.5);
    doc.fillColor('#0284C7').fontSize(8).font('Helvetica-Bold').text('PILGRIM TRUST (PT)', marginX + 295, y + 4.5);
    doc.fillColor('#0C4A6E').fontSize(8).font('Helvetica-Bold').text('YATRA BATCH:', marginX + 430, y + 4.5);
    doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text(`${booking.yatraYear || '2026'}`, marginX + 500, y + 4.5);

    // Journey detail section
    y += 21;
    doc.rect(marginX, y, contentWidth, 54).fillColor('#FFFFFF').fill().strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text('Train Number & Name', marginX + 10, y + 4);
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text('04201 / MVD YATRA SPECIAL', marginX + 10, y + 14);
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text('Class', marginX + 200, y + 4);
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text(cleanClass, marginX + 200, y + 14);
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text('Coach / Assigned Seats', marginX + 300, y + 4);
    doc.fillColor('#0284C7').fontSize(9).font('Helvetica-Bold').text(`Coach ${cleanCoach} : Berths [ ${seatStr} ]`, marginX + 300, y + 14);
    doc.moveTo(marginX, y + 27).lineTo(marginX + contentWidth, y + 27).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text('From Station', marginX + 10, y + 30);
    doc.fillColor('#C2410C').fontSize(8.5).font('Helvetica-Bold').text(cleanFrom, marginX + 10, y + 40);
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text('To Destination', marginX + 200, y + 30);
    doc.fillColor('#15803D').fontSize(8.5).font('Helvetica-Bold').text(cleanTo, marginX + 200, y + 40, { width: 190, ellipsis: true });
    doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold').text('Date of Journey', marginX + 400, y + 30);
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text(`${booking.travelDate || 'As Scheduled'}`, marginX + 400, y + 40);

    // Contact info row
    y += 57;
    doc.rect(marginX, y, contentWidth, 18).fillColor('#F8FAFC').fill().strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('Booked By:', marginX + 10, y + 4.5);
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold').text(cleanBookedBy, marginX + 65, y + 4.5);
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('Mobile:', marginX + 250, y + 4.5);
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica').text(cleanMobile, marginX + 290, y + 4.5);
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('Aadhaar / ID:', marginX + 400, y + 4.5);
    doc.fillColor('#0F172A').fontSize(8).font('Helvetica').text(cleanAadhar, marginX + 460, y + 4.5);

    // Passenger list
    y += 21;
    doc.fillColor('#0C4A6E').fontSize(8.5).font('Helvetica-Bold').text('PASSENGER DETAILS', marginX, y);
    y += 11;
    doc.rect(marginX, y, contentWidth, 16).fillColor('#0284C7').fill();
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
    doc.text('#', marginX + 8, y + 4);
    doc.text('Passenger Name', marginX + 28, y + 4);
    doc.text('Age / Gender', marginX + 200, y + 4);
    doc.text('Booking Status', marginX + 290, y + 4);
    doc.text('Current Status', marginX + 390, y + 4);
    doc.text('Coach / Berth / Type', marginX + 475, y + 4);
    y += 16;

    rawPassengers.forEach((p, index) => {
      const isEven = index % 2 === 0;
      doc.rect(marginX, y, contentWidth, rowH).fillColor(isEven ? '#FFFFFF' : '#F0F9FF').fill().strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      const assignedSeat = p.seatAssigned || p.seatNumber || (Array.isArray(booking.seatNumber) ? booking.seatNumber[index] : index + 1);
      const isCancelled = booking.status === 'Cancelled';
      const statusText = isCancelled ? 'CANCELLED' : 'CONFIRMED (CNF)';
      const statusColor = isCancelled ? '#DC2626' : '#16A34A';
      const pCleanName = PDFService.cleanPdfText(p.name, 'Passenger');
      const pCleanGender = PDFService.cleanPdfText(p.gender, '-');
      const pCleanBerth = PDFService.cleanPdfText(p.berthPreference, 'Berth');

      doc.fillColor('#334155').fontSize(pFontSize).font('Helvetica').text(String(index + 1), marginX + 8, y + 3);
      doc.fillColor('#0F172A').fontSize(pFontSize).font('Helvetica-Bold').text(pCleanName, marginX + 28, y + 3, { width: 170, ellipsis: true });
      doc.fillColor('#334155').fontSize(pFontSize).font('Helvetica').text(`${p.age || '-'} / ${pCleanGender}`, marginX + 200, y + 3);
      doc.fillColor(statusColor).fontSize(pFontSize).font('Helvetica-Bold').text(statusText, marginX + 290, y + 3);
      doc.fillColor(statusColor).fontSize(pFontSize).font('Helvetica-Bold').text(statusText, marginX + 390, y + 3);
      doc.fillColor('#0284C7').fontSize(pFontSize).font('Helvetica-Bold').text(`${cleanCoach} / ${assignedSeat} / ${pCleanBerth}`, marginX + 475, y + 3);
      y += rowH;
    });

    // Fare block + QR card
    y += 8;
    const paymentBoxWidth = 380;
    const fareCardH = 92;
    doc.rect(marginX, y, paymentBoxWidth, fareCardH).fillColor('#F8FAFC').fill().strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.rect(marginX, y, paymentBoxWidth, 16).fillColor('#0F172A').fill();
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold').text('FARE SUMMARY', marginX + 8, y + 4);

    let py = y + 21;
    const printRow = (label, val, isBold = false, color = '#334155') => {
      doc.fillColor(color).fontSize(7.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(label, marginX + 10, py);
      doc.text(`Rs. ${parseFloat(val || 0).toFixed(2)}`, marginX + 250, py, { align: 'right', width: 115 });
      py += 12;
    };

    printRow('Ticket Fare Amount:', booking.totalAmount);
    printRow('Trust Discount / Concession:', booking.discount);
    printRow('Advance Paid:', booking.advance, false, '#16A34A');
    printRow('Balance Due at Boarding:', booking.remainingAmount, true, booking.remainingAmount > 0 ? '#DC2626' : '#16A34A');

    doc.rect(marginX + 8, y + 71, 150, 14).fillColor('#0F172A').fill();
    doc.fillColor('#FFFFFF').fontSize(6.7).font('Helvetica-Bold').text('DIGITAL SIGNAGE SLIP', marginX + 8, y + 74.5, { width: 150, align: 'center' });

    const qrBoxX = marginX + paymentBoxWidth + 8;
    const qrBoxWidth = contentWidth - paymentBoxWidth - 8;
    doc.rect(qrBoxX, y, qrBoxWidth, fareCardH).fillColor('#FFFFFF').fill().strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    if (qrBuffer) {
      doc.image(qrBuffer, qrBoxX + (qrBoxWidth / 2) - 32, y + 4, { width: 64, height: 64 });
    }
    doc.fillColor('#DC2626').fontSize(6).font('Helvetica-Bold').text('ANTI-TAMPER SEC HASH:', qrBoxX + 4, y + 72, { width: qrBoxWidth - 8, align: 'center' });
    doc.fillColor('#0F172A').fontSize(6.5).font('Courier-Bold').text(`MVD-${secHash}`, qrBoxX + 4, y + 80, { width: qrBoxWidth - 8, align: 'center' });
    doc.fillColor('#475569').fontSize(5.8).font('Helvetica').text('SIGNATURE NOT REQUIRED • DIGITAL TICKET', qrBoxX + 4, y + 88, { width: qrBoxWidth - 8, align: 'center' });

    // Guidelines section: concise and neutral
    y += fareCardH + 6;
    const guideH = Math.min(54, pageHeight - y - 52);
    doc.rect(marginX, y, contentWidth, guideH).fillColor('#FFFBEB').fill().strokeColor('#FDE68A').lineWidth(0.5).stroke();
    doc.fillColor('#92400E').fontSize(7.5).font('Helvetica-Bold').text('IMPORTANT TRAVEL GUIDELINES:', marginX + 8, y + 4);
    doc.fillColor('#451A03').fontSize(6.8).font('Helvetica');
    const guidelines = [
      '1. Carry this digital travel slip along with a valid Government ID during travel.',
      '2. Reach the boarding point at least 45 minutes before departure.',
      '3. Keep the QR/unique security hash ready for verification at the station.',
      '4. Clear any remaining balance before boarding.',
      '5. Contact the Trust helpline for assistance if required.'
    ];
    let gy = y + 14;
    guidelines.forEach(g => {
      doc.text(g, marginX + 8, gy, { width: contentWidth - 16 });
      gy += 8.5;
    });

    // Footer, reduced and neutral; no fake official seal
    const footerY = Math.min(760, pageHeight - 52);
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(marginX, footerY).lineTo(marginX + contentWidth, footerY).stroke();
    doc.fillColor('#475569').fontSize(6.5).font('Helvetica').text('Helpline: +91 7398959993 • Support: iammshyam@gmail.com', marginX + 8, footerY + 4);
    doc.fillColor('#0284C7').fontSize(6.2).font('Helvetica-Bold').text('Digital Signage Slip • No physical signature required', marginX, footerY + 14, { align: 'center', width: contentWidth });
    doc.fillColor('#64748B').fontSize(6).font('Helvetica').text('MVD Travel Slip • Valid for QR verification • Generated in system', marginX, footerY + 22, { align: 'center', width: contentWidth });

    if (booking.status === 'Cancelled') {
      doc.save();
      doc.rotate(-25, { origin: [pageWidth / 2, pageHeight / 2] });
      doc.fontSize(50).fillColor('#EF4444', 0.25).font('Helvetica-Bold').text('CANCELLED / RADD', pageWidth / 2 - 240, pageHeight / 2 - 25, { align: 'center', width: 480 });
      doc.restore();
    }
  }

  // Cryptographic HMAC-SHA256 anti-fraud hash over all immutable ticket attributes
  static computeSecurityHash(booking) {
    const seatStr = Array.isArray(booking.seatNumber) ? booking.seatNumber.slice().sort().join(',') : String(booking.seatNumber || '');
    const pNames = (booking.passengers || []).map(p => `${(p.name || '').trim().toLowerCase()}:${p.seatAssigned || ''}`).sort().join(';');
    const payload = [
      booking.bookingId,
      booking.yatraYear || '2026',
      (booking.bookedBy || '').trim().toLowerCase(),
      (booking.coachName || '').trim().toUpperCase(),
      seatStr,
      parseFloat(booking.totalAmount || 0).toFixed(2),
      parseFloat(booking.remainingAmount || 0).toFixed(2),
      pNames
    ].join('|');
    return crypto.createHmac('sha256', TICKET_SECURITY_SECRET).update(payload).digest('hex').substring(0, 16).toUpperCase();
  }

  // Generate a single A4 Official Travel Slip / e-Ticket in IRCTC ERS format (Strict 1-Page Layout)
  static async generateTicketPDF(booking, stream) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 12, bottom: 8, left: 16, right: 16 },
      info: {
        Title: `IRCTC E-Ticket - ${booking.bookingId}`,
        Author: 'Shri Mata Vaishno Devi Public Charitable Trust'
      }
    });

    doc.pipe(stream);

    const secHash = PDFService.computeSecurityHash(booking);
    const baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://mvdv.vercel.app');
    const verifyUrl = `${baseUrl}/verify-ticket.html?pnr=${encodeURIComponent(booking.bookingId)}&sec=${secHash}`;
    const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 85, margin: 1 });

    PDFService.renderBookingSlip(doc, booking, { qrBuffer, secHash });
    doc.end();
  }

  // Generate Bulk Slips into a single PDF (IRCTC ERS style, strictly 1 page per booking)
  static async generateBulkSlipsPDF(bookings, stream) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 12, bottom: 8, left: 16, right: 16 },
      autoFirstPage: false
    });

    doc.pipe(stream);

    const baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://mvdv.vercel.app');

    for (const booking of bookings) {
      doc.addPage();
      const secHash = PDFService.computeSecurityHash(booking);
      const verifyUrl = `${baseUrl}/verify-ticket.html?pnr=${encodeURIComponent(booking.bookingId)}&sec=${secHash}`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 85, margin: 1 });
      PDFService.renderBookingSlip(doc, booking, { qrBuffer, secHash });
    }

    doc.end();
  }

  // Helper: Number to Words (Indian Currency Format)
  static numberToWords(num) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    function inWords(n) {
      if ((n = n.toString()).length > 9) return 'overflow';
      let n_arr = ('000000000' + n).substr(-9).match(/^((\d{2})(\d{2})(\d{2})(\d{1})(\d{2}))$/);
      if (!n_arr) return '';
      let str = '';
      str += (n_arr[1] != 0) ? (a[Number(n_arr[1])] || b[n_arr[1][0]] + ' ' + a[n_arr[1][1]]) + ' Crore ' : '';
      str += (n_arr[2] != 0) ? (a[Number(n_arr[2])] || b[n_arr[2][0]] + ' ' + a[n_arr[2][1]]) + ' Lakh ' : '';
      str += (n_arr[3] != 0) ? (a[Number(n_arr[3])] || b[n_arr[3][0]] + ' ' + a[n_arr[3][1]]) + ' Thousand ' : '';
      str += (n_arr[4] != 0) ? (a[Number(n_arr[4])] || b[n_arr[4][0]] + ' ' + a[n_arr[4][1]]) + ' Hundred ' : '';
      str += (n_arr[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_arr[5])] || b[n_arr[5][0]] + ' ' + a[n_arr[5][1]]) + ' ' : '';
      return str.trim();
    }
    const val = parseInt(num, 10);
    if (isNaN(val) || val === 0) return 'Zero Rupees Only';
    return (inWords(val) + ' Rupees Only');
  }

  // Helper to safely clean strings for standard PDFKit fonts (WinAnsiEncoding)
  static cleanPdfText(str, fallback = 'N/A') {
    if (!str) return fallback;
    let s = String(str).trim();
    // Transliterate common Hindi names/roles
    s = s.replace(/श्री\s*/gi, 'Shri ')
         .replace(/श्रीमती\s*/gi, 'Smt. ')
         .replace(/रमाकांत/gi, 'Ramakant')
         .replace(/शर्मा/gi, 'Sharma')
         .replace(/व्यवस्थापक/gi, 'Chief Admin')
         .replace(/मुख्य\s*ट्रस्ट\s*व्यवस्थापक/gi, 'Chief Trust Admin')
         .replace(/रिफंड\s*वापसी/gi, 'Refund Return')
         .replace(/अग्रिम\s*बुकिंग/gi, 'Advance Booking')
         .replace(/कटड़ा/gi, 'Katra')
         .replace(/वार्षिक\s*स्पेशल\s*ट्रेन/gi, 'Special Train')
         .replace(/तीर्थ\s*यात्रा/gi, 'Yatra');

    // Strip non-ASCII characters to prevent PDFKit fontkit mojibake
    s = s.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
    return s || fallback;
  }

  // Generate an authentic official Mandir / Charitable Trust Payment Receipt PDF in A4-HALF (A5 Landscape) Format
  static async generatePaymentSlipPDF(booking, txn, stream) {
    const fs = require('fs');
    const logoPath = path.join(__dirname, '../public/images/logo.jpg');

    // Exact A4 Half Page: Width = 595.28 pt (A4 width), Height = 420.94 pt (half of A4 841.89 pt)
    const doc = new PDFDocument({
      size: [595.28, 420.94],
      margins: { top: 10, bottom: 10, left: 16, right: 16 },
      info: {
        Title: `Payment Receipt (A4-Half) - ${booking.bookingId} - ${txn.id}`,
        Author: 'Shri Mata Vaishno Devi Public Charitable Trust'
      }
    });

    doc.pipe(stream);

    const isRefund = (parseFloat(txn.amount) < 0) || String(txn.type || '').toLowerCase().includes('refund');
    const rawAmount = parseFloat(txn.amount) || 0;
    const absAmount = Math.abs(rawAmount);
    const amountWords = PDFService.numberToWords(absAmount);

    const cleanPnr = PDFService.cleanPdfText(booking.bookingId, 'MVD-PNR');
    const cleanTxnId = PDFService.cleanPdfText(txn.id, 'R2026000001');
    const cleanBookedBy = PDFService.cleanPdfText(booking.bookedBy, 'Devotee');
    const cleanMobile = PDFService.cleanPdfText(booking.mobile, 'N/A');
    const cleanAadhar = PDFService.cleanPdfText(booking.aadhar, 'Verified');
    const cleanFromStation = PDFService.cleanPdfText(booking.fromStation, 'New Delhi (NDLS)');
    const cleanCoach = PDFService.cleanPdfText(booking.coachName, 'S1');
    const cleanClass = PDFService.cleanPdfText(booking.travelClass, 'Sleeper');
    const cleanCashier = PDFService.cleanPdfText(txn.cashierName, 'Trust Authorized Staff');
    const cleanMethod = PDFService.cleanPdfText(txn.method, isRefund ? 'Admin Bank/UPI Transfer' : 'Cash');
    const cleanUtr = PDFService.cleanPdfText(txn.utr, '');

    const seatStr = Array.isArray(booking.seatNumber) && booking.seatNumber.length > 0 
      ? booking.seatNumber.join(', ') 
      : (booking.seatNumber || (isRefund ? 'Released' : 'Allocated'));

    // Outer Decorative Border
    doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).lineWidth(1.5).strokeColor('#C2410C').stroke();
    doc.rect(12, 12, doc.page.width - 24, doc.page.height - 24).lineWidth(0.5).strokeColor('#F59E0B').stroke();

    // Top Header Banner
    doc.rect(14, 14, doc.page.width - 28, 50).fillColor('#FEF3C7').fill();

    // Round Temple Logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 20, 18, { width: 42, height: 42 });
    }

    // Header Typography
    doc.fillColor('#C2410C').fontSize(8).font('Helvetica-Bold').text('|| OM SARVA MANGAL MANGALYE SHIVE SARVARTHA SADHIKE ||', 68, 17, { width: doc.page.width - 85, align: 'center' });
    doc.fillColor('#7C2D12').fontSize(12.5).font('Helvetica-Bold').text('SHRI MATA VAISHNO DEVI PUBLIC CHARITABLE TRUST', 68, 28, { width: doc.page.width - 85, align: 'center' });
    doc.fillColor('#9A3412').fontSize(7.5).font('Helvetica').text('Mata Vaishno Devi Mandir, Nagla Deena, Bholepur, Fatehgarh, Uttar Pradesh - 209601 | Helpline: +91 7398959993', 68, 44, { width: doc.page.width - 85, align: 'center' });

    // Official Receipt Ribbon
    const ribbonTitle = isRefund 
      ? 'OFFICIAL REFUND ADVICE & RECEIPT / RIFAND BHUGTAN RASEED (A4-HALF SHEET)' 
      : 'OFFICIAL PAYMENT RECEIPT / BHUGTAN RASEED (A4-HALF SHEET)';
    const ribbonColor = isRefund ? '#B91C1C' : '#EA580C';

    doc.rect(14, 65, doc.page.width - 28, 18).fillColor(ribbonColor).fill();
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text(ribbonTitle, 20, 69, { align: 'center' });

    // Receipt Meta Details Table
    let y = 86;
    doc.rect(18, y, doc.page.width - 36, 36).fillColor('#FFFBEB').fill().strokeColor('#FDE68A').stroke();

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text(isRefund ? 'Refund Voucher No:' : 'Receipt No:', 26, y + 6);
    doc.fillColor('#DC2626').fontSize(8.5).font('Helvetica-Bold').text(`${cleanTxnId}`, 110, y + 6);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Booking PNR:', 230, y + 6);
    doc.fillColor('#C2410C').fontSize(8.5).font('Helvetica-Bold').text(`${cleanPnr}`, 295, y + 6);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Date & Time:', 400, y + 6);
    doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(`${new Date(txn.date || Date.now()).toLocaleString('en-IN')}`, 455, y + 6);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Yatra Special:', 26, y + 20);
    doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(`Special Train ${booking.yatraYear || 2026}`, 88, y + 20);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Class & Coach:', 230, y + 20);
    doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(`${cleanClass} (Coach ${cleanCoach})`, 295, y + 20);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Seat No(s):', 400, y + 20);
    doc.fillColor('#1E40AF').fontSize(8.5).font('Helvetica-Bold').text(`${seatStr}`, 455, y + 20);

    // Devotee Details Box
    y += 40;
    doc.rect(18, y, doc.page.width - 36, 32).fillColor('#F9FAFB').fill().strokeColor('#E5E7EB').stroke();
    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Beneficiary / Devotee:', 26, y + 6);
    doc.fillColor('#111827').fontSize(9.5).font('Helvetica-Bold').text(`Shri / Smt. ${cleanBookedBy}`, 130, y + 5);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Mobile:', 380, y + 6);
    doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(`${cleanMobile}`, 418, y + 6);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Aadhaar / ID:', 26, y + 18);
    doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(`${cleanAadhar}`, 90, y + 18);

    doc.fillColor('#4B5563').fontSize(8).font('Helvetica-Bold').text('Journey Route:', 230, y + 18);
    doc.fillColor('#1F2937').fontSize(8).font('Helvetica').text(`${cleanFromStation} -> Katra (SVDK)`, 295, y + 18, { width: 240, ellipsis: true });

    // Payment Amount Highlight Card
    y += 36;
    const amtBoxBg = isRefund ? '#FEF2F2' : '#ECFDF5';
    const amtBoxBorder = isRefund ? '#FECACA' : '#A7F3D0';
    const amtLabelColor = isRefund ? '#991B1B' : '#065F46';
    const amtValColor = isRefund ? '#DC2626' : '#047857';

    doc.rect(18, y, doc.page.width - 36, 46).fillColor(amtBoxBg).fill().strokeColor(amtBoxBorder).stroke();

    const amtLabel = isRefund ? 'REFUND PROCESSED (REFUND DEYA RASHI):' : 'AMOUNT RECEIVED (PRAPT RASHI):';
    const amtSuffix = isRefund ? ' (Credit in 5-7 Working Days)' : '';

    doc.fillColor(amtLabelColor).fontSize(8).font('Helvetica-Bold').text(amtLabel, 26, y + 6);
    doc.fillColor(amtValColor).fontSize(13).font('Helvetica-Bold').text(`Rs. ${absAmount.toFixed(2)}${amtSuffix}`, 215, y + 4);

    doc.fillColor(amtLabelColor).fontSize(8).font('Helvetica-Bold').text('Amount In Words:', 26, y + 20);
    doc.fillColor(amtValColor).fontSize(8).font('Helvetica-Bold').text(amountWords, 110, y + 20, { width: 440, ellipsis: true });

    const modeText = isRefund 
      ? `Refund Channel: ${cleanMethod} ${cleanUtr ? `(Ref/UTR: ${cleanUtr})` : ''} | Processed by Trust Admin directly to Bank/UPI`
      : `Payment Mode: ${cleanMethod} ${cleanUtr ? `(UTR: ${cleanUtr})` : ''} | Type: Advance/Balance Payment | ID: ${cleanTxnId}`;

    doc.fillColor('#374151').fontSize(7.5).font('Helvetica').text(modeText, 26, y + 32, { width: doc.page.width - 52, ellipsis: true });

    // Account Summary Table (3 Columns)
    y += 50;
    doc.rect(18, y, doc.page.width - 36, 28).fillColor('#F3F4F6').fill().strokeColor('#D1D5DB').stroke();

    doc.fillColor('#4B5563').fontSize(7.5).font('Helvetica-Bold').text('Total Journey Fare', 30, y + 4);
    doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold').text(`Rs. ${parseFloat(booking.totalAmount || 0).toFixed(2)}`, 30, y + 15);

    doc.fillColor('#4B5563').fontSize(7.5).font('Helvetica-Bold').text(isRefund ? 'Advance Refunded' : 'Total Paid Till Date', 210, y + 4);
    doc.fillColor(isRefund ? '#DC2626' : '#059669').fontSize(8.5).font('Helvetica-Bold').text(`Rs. ${parseFloat(isRefund ? absAmount : (booking.advance || 0)).toFixed(2)}`, 210, y + 15);

    doc.fillColor('#4B5563').fontSize(7.5).font('Helvetica-Bold').text('Ticket Status', 390, y + 4);
    const statusLabel = isRefund ? 'CANCELLED & REFUND INITIATED' : ((booking.remainingAmount || 0) > 0 ? `Rs. ${parseFloat(booking.remainingAmount).toFixed(2)} (PENDING)` : 'PAID IN FULL');
    doc.fillColor(isRefund ? '#DC2626' : ((booking.remainingAmount || 0) > 0 ? '#EA580C' : '#059669')).fontSize(8).font('Helvetica-Bold').text(statusLabel, 390, y + 15);

    // Cashier & Authorization Stamp Section
    y += 32;
    doc.rect(18, y, doc.page.width - 36, 36).fillColor('#FFFFFF').fill().strokeColor('#E5E7EB').stroke();

    doc.fillColor('#4B5563').fontSize(7.5).font('Helvetica-Bold').text(isRefund ? 'Cancelled By Staff:' : 'Cashier / Counter Staff:', 26, y + 5);
    doc.fillColor('#1F2937').fontSize(8.5).font('Helvetica-Bold').text(`${cleanCashier}`, 26, y + 15);
    doc.fillColor('#9CA3AF').fontSize(6.5).font('Helvetica').text('System Verified & Logged', 26, y + 25);

    doc.fillColor('#4B5563').fontSize(7.5).font('Helvetica-Bold').text('Authorized Signatory:', 380, y + 5);
    doc.fillColor('#7C2D12').fontSize(8).font('Helvetica-Bold').text('For Shri Mata Vaishno Devi Trust', 380, y + 15);
    doc.fillColor('#9CA3AF').fontSize(6.5).font('Helvetica').text('Official Computer Generated Receipt', 380, y + 25);

    // Blessing & Developer Branding Banner
    y += 40;
    doc.rect(14, y, doc.page.width - 28, 14).fillColor('#FEF3C7').fill();
    doc.fillColor('#C2410C').fontSize(8).font('Helvetica-Bold').text('JAI MATA DI - SHRI MATA VAISHNO DEVI JI BLESSINGS & BEST WISHES', 20, y + 3, { align: 'center' });

    y += 16;
    doc.fillColor('#6B7280').fontSize(6.5).font('Helvetica').text('Software Developed by: ArovenTech (www.aroventech.site | +91 9598023701) | Support: iammshyam@gmail.com', 20, y, { align: 'center', width: doc.page.width - 40 });

    doc.end();
  }

  // Generate Defaulters Report PDF
  static async generateDefaultersReportPDF(bookings, stream) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 36, left: 36, right: 36 }
    });

    doc.pipe(stream);

    doc.fillColor('#9A3412').fontSize(18).font('Helvetica-Bold').text('PENDING DUES & DEFAULTERS REPORT', { align: 'center' });
    doc.fillColor('#555555').fontSize(10).font('Helvetica').text('Mata Vaishno Devi Yatra Special Train', { align: 'center' });
    doc.moveDown();
    
    let totalPending = 0;
    
    bookings.forEach((b, i) => {
      const pending = parseFloat(b.remainingAmount) || 0;
      totalPending += pending;
      doc.fillColor('#333').fontSize(10).font('Helvetica');
      doc.text(`${i + 1}. PNR: ${b.bookingId} | Name: ${b.bookedBy} | Mobile: ${b.mobile || 'N/A'}`);
      doc.text(`    Coach: ${b.coachName} | Seats: ${Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber} | Dues: Rs. ${pending.toFixed(2)}`);
      doc.moveDown(0.5);
    });
    
    doc.moveDown();
    doc.fillColor('#DC2626').fontSize(12).font('Helvetica-Bold').text(`Total Pending Amount: Rs. ${totalPending.toFixed(2)}`);

    doc.end();
  }
}

module.exports = PDFService;
