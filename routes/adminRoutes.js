const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const os = require('os');
const { BookingService } = require('../services/bookingService');
const { StaffService, ROLES, DEPARTMENTS } = require('../services/staffService');
const { AuthService, requireAuth } = require('../services/authService');
const ExcelService = require('../services/excelService');
const PDFService = require('../services/pdfService');

// Multer temporary storage for excel upload (uses /tmp on serverless environments)
let uploadDir = path.join(os.tmpdir(), 'mvd_uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (_) {
  uploadDir = os.tmpdir();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `bulk_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// Admin Authentication Middleware using high-security AuthService
const checkAdminAuth = requireAuth();

// Admin Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin@mvd2026';

  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    req.session.user = { username, role: 'SuperAdmin' };
    return res.json({
      success: true,
      message: 'Admin authenticated successfully',
      user: { username, role: 'SuperAdmin' },
      token: 'mvd_admin_token'
    });
  }

  return res.status(401).json({ success: false, error: 'Invalid admin username or password.' });
});

// Admin Session Status
router.get('/status', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ success: true, authenticated: true, user: req.session.user });
  }
  return res.json({ success: true, authenticated: false });
});

// Admin Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Dashboard Analytics & KPI stats
router.get('/stats', checkAdminAuth, async (req, res) => {
  try {
    const yatraYear = req.query.year ? parseInt(req.query.year, 10) : null;
    const stats = await BookingService.getDashboardStats(yatraYear);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch all bookings with search and filter
router.get('/bookings', checkAdminAuth, async (req, res) => {
  try {
    const { yatraYear, coachName, travelClass, paymentStatus, search } = req.query;
    const bookings = await BookingService.getBookings({
      yatraYear: yatraYear ? parseInt(yatraYear, 10) : null,
      coachName,
      travelClass,
      paymentStatus,
      search
    });
    res.json({ success: true, total: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update booking details
router.put('/bookings/:id', checkAdminAuth, async (req, res) => {
  try {
    const updated = await BookingService.updateBooking(req.params.id, req.body);
    res.json({ success: true, message: 'Booking updated successfully', booking: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update specific payment info (Admin)
router.put('/bookings/:id/payment', checkAdminAuth, async (req, res) => {
  try {
    const { paymentMode, upiTransactionId, advance, discount } = req.body;
    
    // Use the existing updateBooking to handle recalculations
    const payload = {};
    if (paymentMode !== undefined) payload.paymentMode = paymentMode;
    if (upiTransactionId !== undefined) payload.upiTransactionId = upiTransactionId;
    if (advance !== undefined) payload.advance = advance;
    if (discount !== undefined) payload.discount = discount;
    
    const updated = await BookingService.updateBooking(req.params.id, payload);
    
    // Let's also log this specifically since it's a payment modification
    const { StaffService } = require('../services/StaffService');
    await StaffService.logAudit({
      action: 'PAYMENT_EDIT',
      performedBy: req.user,
      details: `बुकिंग ${updated.bookingId} का भुगतान विवरण अद्यतन किया गया। (Mode: ${paymentMode || updated.paymentMode})`
    });

    res.json({ success: true, message: 'Payment details updated successfully', booking: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark as paid or record partial payment
router.post('/bookings/:id/pay', checkAdminAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    const updated = await BookingService.recordPayment(req.params.id, amount !== undefined ? amount : null);
    res.json({ success: true, message: 'Payment recorded successfully', booking: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify UTR
router.put('/bookings/:id/verify-utr', checkAdminAuth, async (req, res) => {
  try {
    const updated = await BookingService.updateBooking(req.params.id, {
      utrStatus: 'Verified',
      paymentMode: 'UPI'
    });
    // Also mark as paid
    const paymentDetails = {
      method: 'UPI',
      type: 'Admin UTR Verification',
      cashierName: req.user.username || req.user.role || 'Admin',
      utr: updated.utrNumber
    };
    const fullyPaid = await BookingService.recordPayment(req.params.id, null, paymentDetails);
    
    // Log verification
    const { StaffService } = require('../services/staffService');
    await StaffService.logAudit({
      action: 'UTR_VERIFIED',
      performedBy: req.user,
      details: `बुकिंग ${updated.bookingId} का UTR (${updated.utrNumber}) सत्यापित किया गया।`
    });

    res.json({ success: true, message: 'UTR verified and payment marked as Paid', booking: fullyPaid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate Defaulters Report PDF
router.get('/reports/defaulters', checkAdminAuth, async (req, res) => {
  try {
    const { PDFService } = require('../services/pdfService');
    const bookings = await BookingService.getBookings();
    
    // Filter bookings with remainingAmount > 0
    const defaulters = bookings.filter(b => parseFloat(b.remainingAmount) > 0);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="defaulters_report.pdf"');
    
    await PDFService.generateDefaultersReportPDF(defaulters, res);
  } catch (err) {
    res.status(500).send('Error generating defaulters report: ' + err.message);
  }
});

// Cancel Ticket with Refund (Admin)
router.post('/bookings/:id/cancel', checkAdminAuth, async (req, res) => {
  try {
    const { refundAmount, cancellationCharges, cancellationReason, refundMode, utr } = req.body;
    const cancelled = await BookingService.cancelBookingWithRefund(req.params.id, {
      refundAmount,
      cancellationCharges,
      cancellationReason,
      refundMode,
      utr,
      cancelledBy: req.user || { name: 'Admin', role: 'SuperAdmin', username: 'admin' }
    });
    res.json({
      success: true,
      message: `टिकट ${req.params.id} सफलतापूर्वक रद्द किया गया। रिफंड राशि: ₹${cancelled.refundAmount || 0}`,
      booking: cancelled
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Cancel / Delete a booking
router.delete('/bookings/:id', checkAdminAuth, async (req, res) => {
  try {
    await BookingService.deleteBooking(req.params.id);
    res.json({ success: true, message: `Booking ${req.params.id} removed successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export bookings to Excel
router.get('/export-excel', checkAdminAuth, async (req, res) => {
  try {
    const { yatraYear, coachName, paymentStatus } = req.query;
    const bookings = await BookingService.getBookings({
      yatraYear: yatraYear ? parseInt(yatraYear, 10) : null,
      coachName,
      paymentStatus
    });

    const filename = `MVD-Yatra-Bookings-${yatraYear || 'AllYears'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await ExcelService.exportBookingsToExcel(bookings, res);
    res.end();
  } catch (err) {
    console.error('Excel Export Error:', err);
    res.status(500).send('Error exporting Excel: ' + err.message);
  }
});

// Download sample Excel template for bulk upload
router.get('/sample-template', checkAdminAuth, async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="MVD-Bulk-Booking-Sample-Template.xlsx"');
    await ExcelService.generateSampleExcel(res);
    res.end();
  } catch (err) {
    res.status(500).send('Error generating template: ' + err.message);
  }
});

// Bulk upload bookings from Excel
router.post('/bulk-upload', checkAdminAuth, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No Excel file uploaded.' });
    }

    const yatraYear = req.body.yatraYear || 2026;
    const { bookings, errors } = await ExcelService.parseBulkBookingsFromExcel(req.file.path, yatraYear);

    // Save bookings via service
    const saved = [];
    for (const b of bookings) {
      const savedBooking = await BookingService.createBooking(b);
      saved.push(savedBooking);
    }

    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({
      success: true,
      importedCount: saved.length,
      errorsCount: errors.length,
      errors,
      message: `Successfully processed ${saved.length} bookings for Yatra ${yatraYear}.`
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download bulk travel slips in a single multi-page PDF
router.get('/bulk-slips', checkAdminAuth, async (req, res) => {
  try {
    const { yatraYear, coachName } = req.query;
    const bookings = await BookingService.getBookings({
      yatraYear: yatraYear ? parseInt(yatraYear, 10) : null,
      coachName
    });

    if (!bookings || bookings.length === 0) {
      return res.status(404).send('No bookings found for the selected criteria.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="MVD-Bulk-Travel-Slips-${yatraYear || 'All'}.pdf"`);

    await PDFService.generateBulkSlipsPDF(bookings, res);
  } catch (err) {
    console.error('Bulk PDF Error:', err);
    res.status(500).send('Error generating bulk travel slips: ' + err.message);
  }
});

// -------------------------------------------------------------
// STAFF & ROLE MANAGEMENT (कर्मचारी प्रबंधन)
// -------------------------------------------------------------

// Get all staff members
router.get('/staff', checkAdminAuth, async (req, res) => {
  try {
    const staff = await StaffService.getStaffList();
    res.json({ success: true, staff, roles: ROLES, departments: DEPARTMENTS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a new staff member with role & department
router.post('/staff', checkAdminAuth, async (req, res) => {
  try {
    const creator = req.session?.user?.username || 'Admin';
    const newStaff = await StaffService.addStaff({ ...req.body, createdByName: creator });
    res.status(201).json({ success: true, message: 'कर्मचारी सफलतापूर्वक जोड़ा गया (Staff Added)', staff: newStaff });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update staff status or role
router.put('/staff/:staffId', checkAdminAuth, async (req, res) => {
  try {
    const updater = req.session?.user?.username || 'Admin';
    const updated = await StaffService.updateStaff(req.params.staffId, { ...req.body, updatedByName: updater });
    res.json({ success: true, message: 'कर्मचारी विवरण अपडेट किया गया (Staff Updated)', staff: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Delete a staff member
router.delete('/staff/:staffId', checkAdminAuth, async (req, res) => {
  try {
    const deleter = req.session?.user?.username || 'Admin';
    const result = await StaffService.deleteStaff(req.params.staffId, deleter);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// ANTI-FRAUD AUDIT TRAIL & RECONCILIATION REPORTS
// -------------------------------------------------------------

// Fetch immutable audit logs
router.get('/audit-logs', checkAdminAuth, async (req, res) => {
  try {
    const { limit, action, performedBy } = req.query;
    const logs = await StaffService.getAuditLogs({
      limit: limit ? parseInt(limit, 10) : 200,
      action,
      performedBy
    });
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Comprehensive Anti-Fraud Financial & Attendance Reconciliation Report
router.get('/reconciliation-report', checkAdminAuth, async (req, res) => {
  try {
    const report = await StaffService.getReconciliationReport(req.query.year);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias for /reconcile
router.get('/reconcile', checkAdminAuth, async (req, res) => {
  try {
    const report = await StaffService.getReconciliationReport(req.query.year);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

