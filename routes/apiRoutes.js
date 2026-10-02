const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { BookingService, FARES, COACH_CONFIG } = require('../services/bookingService');
const { StaffService } = require('../services/staffService');
const { CoachService } = require('../services/coachService');
const { SettingsService } = require('../services/settingsService');
const { AuthService, requireAuth } = require('../services/authService');
const PDFService = require('../services/pdfService');

// Unified Staff & Admin Authentication Login (Gmail ID / Username + Password)
router.post('/auth/login', async (req, res) => {
  try {
    const identifier = req.body.email || req.body.username || req.body.identifier;
    const { password } = req.body;
    const authResult = await AuthService.login(identifier, password);
    if (req.session) {
      req.session.staffUser = authResult.user;
      req.session.token = authResult.token;
      if (authResult.user.role === 'SuperAdmin') req.session.isAdmin = true;
    }
    res.json(authResult);
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Google Sign-In Route for Admin & Registered Staff
router.post('/auth/google-login', async (req, res) => {
  try {
    const { email, name, photoUrl, idToken } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Google ईमेल पता आवश्यक है।' });
    }
    const authResult = await AuthService.loginWithGoogle(email, { name, photoUrl, idToken });
    if (req.session) {
      req.session.staffUser = authResult.user;
      req.session.token = authResult.token;
      if (authResult.user.role === 'SuperAdmin') req.session.isAdmin = true;
    }
    res.json(authResult);
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Check current session
router.get('/auth/me', (req, res) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7).trim();
  if (!token && req.headers['x-staff-token']) token = req.headers['x-staff-token'].trim();
  if (!token && req.query.token) token = req.query.token.trim();
  if (!token && req.session && req.session.token) token = req.session.token;

  const user = AuthService.validateToken(token);
  if (!user) {
    return res.status(401).json({ success: false, authenticated: false });
  }
  res.json({ success: true, authenticated: true, user, token });
});

// Logout
router.post('/auth/logout', (req, res) => {
  let token = req.body.token || req.headers['x-staff-token'] || (req.session ? req.session.token : null);
  if (token) AuthService.logout(token);
  if (req.session) req.session.destroy();
  res.json({ success: true, message: 'लॉगआउट सफल।' });
});

// Update Password
router.put('/auth/update-password', requireAuth(), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;
    
    await StaffService.updatePassword(user.username, oldPassword, newPassword);
    res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक अपडेट किया गया।' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Dashboard Analytics & KPI stats
router.get('/stats', requireAuth(), async (req, res) => {
  try {
    const yatraYear = req.query.year ? parseInt(req.query.year, 10) : null;
    const stats = await BookingService.getDashboardStats(yatraYear);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get current yatra editions and system config
router.get('/config', async (req, res) => {
  try {
    const settings = await SettingsService.getSettings();
    const coachesMap = await CoachService.getBookableCoachesMap();
    res.json({
      success: true,
      activeYear: settings.activeYatraYear || 2026,
      years: settings.availableYears || [2024, 2025, 2026, 2027, 2028],
      defaultTravelDate: settings.defaultTravelDate || settings.journeyDate || '2026-10-15',
      journeyDate: settings.defaultTravelDate || settings.journeyDate || '2026-10-15',
      returnTravelDate: settings.returnTravelDate || '2026-10-22',
      settings,
      trainDetails: {
        name: 'Mata Vaishno Devi Yatra Special Superfast Express',
        number: '04201 / 04202',
        origin: 'Lucknow / New Delhi / Kanpur / Fatehgarh',
        destination: 'Shri Mata Vaishno Devi Katra (SVDK)',
        departureDate: settings.defaultTravelDate || settings.journeyDate || '2026-10-15',
        departureTime: '18:30 IST',
        trustName: settings.trustName || 'श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट',
        helpline: settings.helplineNumber || '+91 7398959993',
        email: settings.officialEmail || 'infomatavaishnodevi@gmail.com',
        address: settings.officeAddress || 'Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India'
      },
      fares: settings.fares || FARES,
      coaches: coachesMap || COACH_CONFIG,
      stations: settings.routeStations && settings.routeStations.length > 0 ? settings.routeStations : [
        'Lucknow Charbagh (LKO)',
        'Sandila (SAN)',
        'Balamau Junction (BLM)',
        'Hardoi (HRI)',
        'Anjhi Shahabad (AJI)',
        'Roza Junction (ROZA)',
        'Shahjahanpur (SPN)',
        'Tilhar (TLH)',
        'Fatehganj West (FGW)',
        'Bareilly Junction (BE)',
        'Rampur Junction (RMU)',
        'Moradabad Junction (MB)',
        'Hapur Junction (HPU)',
        'Ghaziabad Junction (GZB)',
        'New Delhi (NDLS)',
        'Delhi Safdarjung (DSJ)',
        'Kanpur Central (CNB)',
        'Fatehgarh (FGR)',
        'Farrukhabad (FBD)',
        'Meerut City (MTC)',
        'Muzaffarnagar (MOZ)',
        'Deoband (DBD)',
        'Saharanpur Junction (SRE)',
        'Yamunanagar Jagadhri (YJUD)',
        'Ambala Cantt (UMB)',
        'Ludhiana Junction (LDH)',
        'Phagwara (PGW)',
        'Jalandhar Cantt (JRC)',
        'Beas Junction (BEAS)',
        'Mukerian (MEX)',
        'Pathankot Cantt (PTKC)',
        'Kathua (KTHU)',
        'Hiranagar (HRNR)',
        'Samba (SMBX)',
        'Jammu Tawi (JAT)',
        'Manwal (MNWL)',
        'Udhampur (UHP)',
        'Shri Mata Vaishno Devi Katra (SVDK)'
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Project & Trust Settings Management (SuperAdmin)
router.get('/admin/settings', requireAuth('SuperAdmin'), async (req, res) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/settings', requireAuth('SuperAdmin'), async (req, res) => {
  try {
    const updated = await SettingsService.updateSettings(req.body, req.user?.name || req.user?.username || 'SuperAdmin');
    res.json({ success: true, message: 'प्रोजेक्ट सेटिंग्स सफलतापूर्वक अपडेट की गई।', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Train Composition & Coach Position Viewer (Public Devotees & Staff)
router.get('/coaches/train-composition', async (req, res) => {
  try {
    const yatraYear = parseInt(req.query.year, 10) || 2026;
    const composition = await CoachService.getTrainCompositionWithStats(yatraYear);
    res.json({ success: true, ...composition });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin & Staff Coach Management Routes
router.get('/admin/coaches', async (req, res) => {
  try {
    const coaches = await CoachService.getAllCoaches();
    res.json({ success: true, coaches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/coaches', requireAuth(), async (req, res) => {
  try {
    const newCoach = await CoachService.addCoach(req.body);
    await StaffService.logAudit({
      action: 'COACH_ADD',
      performedBy: req.user,
      details: `नया कोच जोड़ा गया: ${newCoach.coachCode} (${newCoach.coachName}) - स्थान क्रम: #${newCoach.position}`
    });
    res.json({ success: true, message: `कोच ${newCoach.coachCode} सफलतापूर्वक जोड़ा गया।`, coach: newCoach });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/admin/coaches/:id', requireAuth(), async (req, res) => {
  try {
    const updated = await CoachService.updateCoach(req.params.id, req.body);
    await StaffService.logAudit({
      action: 'COACH_UPDATE',
      performedBy: req.user,
      details: `कोच विवरण अपडेट किया गया: ${updated.coachCode} (${updated.coachName})`
    });
    res.json({ success: true, message: `कोच ${updated.coachCode} अपडेट किया गया।`, coach: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/admin/coaches/:id', requireAuth(), async (req, res) => {
  try {
    await CoachService.deleteCoach(req.params.id);
    await StaffService.logAudit({
      action: 'COACH_DELETE',
      performedBy: req.user,
      details: `कोच हटाया गया (ID: ${req.params.id})`
    });
    res.json({ success: true, message: 'कोच सफलतापूर्वक हटा दिया गया।' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/admin/coaches/reorder', requireAuth(), async (req, res) => {
  try {
    const { orderedIds } = req.body;
    const result = await CoachService.reorderCoaches(orderedIds);
    await StaffService.logAudit({
      action: 'COACH_REORDER',
      performedBy: req.user,
      details: `ट्रेन कोच अनुक्रम / स्थिति पुनः व्यवस्थित की गई। (${orderedIds?.length || 0} कोच)`
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/admin/coaches/reset-default', requireAuth('SuperAdmin'), async (req, res) => {
  try {
    const result = await CoachService.resetDefaultRake();
    const user = req.user || { name: 'Admin', role: 'SuperAdmin' };
    await StaffService.logAudit({
      action: 'COACH_RESET',
      performedBy: user,
      details: 'ट्रेन की मानक 18-बोगी संरचना (Default Rake) रीसेट की गई।'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel Ticket with Refund (Booking Counter & Admin)
router.post('/bookings/:id/cancel', requireAuth(), async (req, res) => {
  try {
    const { refundAmount, cancellationCharges, cancellationReason, refundMode, utr } = req.body;
    const cancelled = await BookingService.cancelBookingWithRefund(req.params.id, {
      refundAmount,
      cancellationCharges,
      cancellationReason,
      refundMode,
      utr,
      cancelledBy: req.user
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

router.post('/admin/bookings/:id/cancel', requireAuth(), async (req, res) => {
  try {
    const { refundAmount, cancellationCharges, cancellationReason, refundMode, utr } = req.body;
    const cancelled = await BookingService.cancelBookingWithRefund(req.params.id, {
      refundAmount,
      cancellationCharges,
      cancellationReason,
      refundMode,
      utr,
      cancelledBy: req.user
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

// Real-time coach seat layout & booked seats
router.get('/coaches/:coachName/layout', async (req, res) => {
  try {
    const coachName = req.params.coachName.toUpperCase();
    const yatraYear = parseInt(req.query.year, 10) || 2026;
    const occupancy = await BookingService.getCoachOccupancy(coachName, yatraYear);
    res.json({ success: true, ...occupancy });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a new booking (Authorized Staff, Admin & Devotee Booking)
router.post('/bookings', async (req, res) => {
  try {
    const {
      yatraYear,
      bookedBy,
      mobile,
      aadhar,
      email,
      fromStation,
      toStation,
      travelClass,
      coachName,
      seatNumber,
      travelDate,
      advancePayment,
      discount,
      passengers,
      notes
    } = req.body;

    if (!bookedBy || !mobile) {
      return res.status(400).json({ success: false, error: 'Booked By and Mobile Number are required.' });
    }

    if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one passenger must be added.' });
    }

    // Extract auth user if token provided
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7).trim();
    if (!token && req.headers['x-staff-token']) token = req.headers['x-staff-token'].trim();
    if (!token && req.query.token) token = req.query.token.trim();
    if (!token && req.session && req.session.token) token = req.session.token;

    const user = token ? AuthService.validateToken(token) : null;

    const booking = await BookingService.createBooking({
      yatraYear: yatraYear || 2026,
      bookedBy,
      mobile,
      aadhar,
      email,
      fromStation: fromStation || 'New Delhi (NDLS)',
      toStation: toStation || 'Shri Mata Vaishno Devi Katra (SVDK)',
      travelClass: travelClass || 'Sleeper',
      coachName: coachName || 'S1',
      seatNumber,
      travelDate,
      advancePayment,
      discount,
      passengers,
      notes
    });

    // Anti-Fraud Audit Log for every booking
    await StaffService.logAudit({
      action: 'TICKET_BOOKED',
      performedBy: user || req.body.bookedByStaff || { name: bookedBy, role: 'Counter / Devotee', username: 'online_devotee' },
      details: `PNR ${booking.bookingId} booked for ${booking.numberOfPassengers} passengers in Coach ${booking.coachName}`,
      targetId: booking.bookingId,
      amount: booking.advance,
      paymentMode: booking.paymentMode || 'UPI',
      coachName: booking.coachName
    });

    res.status(201).json({
      success: true,
      message: 'Mata Vaishno Devi Yatra Train Ticket booked successfully!',
      booking
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PNR live search & ticket lookup
router.get('/bookings/pnr/:pnr', async (req, res) => {
  try {
    const booking = await BookingService.getBookingByIdOrPNR(req.params.pnr);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'PNR / Booking ID not found. Please check and try again.' });
    }
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate dynamic UPI payment QR code for advance or remaining amount
router.get('/bookings/:id/upi-qr', async (req, res) => {
  try {
    const booking = await BookingService.getBookingByIdOrPNR(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    const type = req.query.type || 'remaining'; // 'remaining' or 'advance' or 'total'
    let amount = booking.remainingAmount;
    if (type === 'advance') amount = booking.advance > 0 ? booking.advance : booking.totalAmount;
    if (type === 'total') amount = booking.totalAmount;

    const settings = await SettingsService.getSettings();
    const trustUpi = (settings && settings.upiId) ? settings.upiId : (process.env.TRUST_UPI_ID || '7398959993@okbizaxis');
    const trustName = encodeURIComponent((settings && settings.upiPayeeName) ? settings.upiPayeeName : (process.env.TRUST_NAME || 'Shri Mata Vaishno Devi Trust'));
    const note = encodeURIComponent(`Yatra Ticket ${booking.bookingId}`);
    
    // Standard NPCI UPI URI Scheme
    const upiUri = `upi://pay?pa=${trustUpi}&pn=${trustName}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
    const qrDataUrl = await QRCode.toDataURL(upiUri, { width: 300, margin: 2 });

    res.json({
      success: true,
      bookingId: booking.bookingId,
      amount,
      type,
      upiId: trustUpi,
      payeeName: (settings && settings.upiPayeeName) || 'Shri Mata Vaishno Devi Trust',
      upiUri,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit UTR for verification
router.put('/bookings/:id/utr', async (req, res) => {
  try {
    const { utrNumber } = req.body;
    if (!utrNumber || utrNumber.trim() === '') {
      return res.status(400).json({ success: false, error: 'UTR number is required' });
    }
    
    // Update the booking in firestore via BookingService
    await BookingService.updateBooking(req.params.id, {
      utrNumber: utrNumber.trim(),
      utrStatus: 'Pending',
      utrSubmittedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'UTR submitted successfully. Pending admin verification.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download high-resolution PDF official Travel Slip (Public)
router.get('/bookings/:id/pdf', async (req, res) => {
  try {
    const booking = await BookingService.getBookingByIdOrPNR(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'बुकिंग विवरण नहीं मिला।' });
    }

    const token = (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))
      ? req.headers.authorization.slice(7)
      : (req.query.token || req.cookies?.staffToken);
    
    const user = AuthService.validateToken(token);
    
    await StaffService.logAudit({
      action: 'SLIP_PRINTED',
      performedBy: user || { name: booking.bookedBy, role: 'Devotee', username: 'online_devotee' },
      details: `यात्रा पर्ची डाउनलोड/मुद्रित की गई: PNR ${booking.bookingId}`,
      targetId: booking.bookingId,
      coachName: booking.coachName
    });

    // Mark as downloaded
    if (booking.status !== 'Downloaded') {
      await BookingService.updateBooking(booking.bookingId, { status: 'Downloaded' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="MVD-Travel-Slip-${booking.bookingId}.pdf"`);

    await PDFService.generateTicketPDF(booking, res);
  } catch (err) {
    res.status(500).send('Error generating PDF: ' + err.message);
  }
});

// Download Payment Receipt
router.get('/bookings/:id/receipt/:txId', async (req, res) => {
  try {
    const booking = await BookingService.getBookingByIdOrPNR(req.params.id);
    if (!booking) {
      return res.status(404).send('Booking not found');
    }
    
    const txId = req.params.txId;
    let txn = (booking.paymentHistory || []).find(t => t.id === txId);
    
    // Graceful fallback for initial advance payment receipt or custom IDs
    if (!txn) {
      if (txId.startsWith('REC-ADV-') || txId === 'advance' || (booking.advance && booking.advance > 0)) {
        txn = {
          id: txId,
          amount: booking.advance || 0,
          date: booking.createdAt || new Date().toISOString(),
          type: 'Advance Booking',
          method: booking.paymentMode || 'Cash/Counter',
          cashierName: booking.cashierName || 'Counter Staff',
          balanceRemaining: Math.max(0, (booking.totalAmount || 0) - (booking.advance || 0))
        };
      } else {
        return res.status(404).send('Transaction not found');
      }
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="MVD-Receipt-${booking.bookingId}-${txId}.pdf"`);

    await PDFService.generatePaymentSlipPDF(booking, txn, res);
  } catch (err) {
    res.status(500).send('Error generating receipt: ' + err.message);
  }
});

// Instant Anti-Fraud Live Verification (Scanned via mobile QR or TTE)
router.get('/verify-slip', async (req, res) => {
  try {
    const pnr = (req.query.pnr || req.query.id || '').trim();
    const sec = (req.query.sec || req.query.hash || '').trim().toUpperCase();

    if (!pnr) {
      return res.status(400).json({ success: false, isGenuine: false, error: 'पीएनआर / बुकिंग आईडी अनिवार्य है।' });
    }

    const booking = await BookingService.getBookingByIdOrPNR(pnr);
    if (!booking) {
      await StaffService.logAudit({
        action: 'FORGERY_ATTEMPT_DETECTED',
        performedBy: { name: 'Automated QR Scanner', role: 'Security' },
        details: `अमान्य / फर्जी पीएनआर सत्यापन प्रयास: ${pnr}`,
        targetId: pnr
      });
      return res.json({
        success: false,
        isGenuine: false,
        status: 'NOT_FOUND',
        title: '🚨 फर्जी / अमान्य टिकट चेतावनी',
        message: 'यह पीएनआर नंबर रेलवे व ट्रस्ट के अधिकृत डेटाबेस में मौजूद नहीं है। यह टिकट पूर्णतः फर्जी / जाली है। टीटीई या सुरक्षाकर्मी तुरंत यात्री से पूछताछ करें।',
        pnr
      });
    }

    const expectedHash = PDFService.computeSecurityHash(booking);

    if (sec && sec !== expectedHash && sec !== `MVD-${expectedHash}`) {
      await StaffService.logAudit({
        action: 'FORGERY_ATTEMPT_DETECTED',
        performedBy: { name: 'Automated QR Scanner', role: 'Security' },
        details: `छेड़छाड़ / रूपांतरित टिकट का पता चला: PNR ${pnr}, अवैध हैश: ${sec}, अपेक्षित: ${expectedHash}`,
        targetId: pnr,
        coachName: booking.coachName
      });
      return res.json({
        success: false,
        isGenuine: false,
        status: 'TAMPERED',
        title: '🚨 रूपांतरित / जाली पर्ची पकड़ी गई (FORGED / TAMPERED TICKET)',
        message: 'सावधान! इस टिकट पर्ची के साथ कंप्यूटर द्वारा हेर-फेर या फोटोशॉप संपादन किया गया है। सर्वर का मूल आधिकारिक रिकॉर्ड नीचे दिया गया है:',
        tamperedFields: 'यात्री नाम, सीट, कोच या देय राशि में बदलाव',
        expectedSecurityHash: `MVD-${expectedHash}`,
        providedSecurityHash: sec,
        authenticData: {
          bookingId: booking.bookingId,
          yatraYear: booking.yatraYear,
          bookedBy: booking.bookedBy,
          mobile: booking.mobile,
          coachName: booking.coachName,
          seatNumber: booking.seatNumber,
          travelClass: booking.travelClass,
          fromStation: booking.fromStation,
          toStation: booking.toStation,
          travelDate: booking.travelDate,
          totalAmount: booking.totalAmount,
          advance: booking.advance,
          remainingAmount: booking.remainingAmount,
          paymentStatus: booking.paymentStatus,
          passengers: booking.passengers
        }
      });
    }

    return res.json({
      success: true,
      isGenuine: true,
      status: 'GENUINE',
      title: '✅ प्रमाणित आधिकारिक डिजिटल यात्रा पर्ची (GENUINE & AUTHENTIC)',
      message: 'यह यात्रा पर्ची श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट एवं रेलवे आरक्षण प्रणाली द्वारा अधिकृत व पूर्णतः मान्य है।',
      securityHash: `MVD-${expectedHash}`,
      booking: {
        bookingId: booking.bookingId,
        yatraYear: booking.yatraYear,
        bookedBy: booking.bookedBy,
        mobile: booking.mobile,
        coachName: booking.coachName,
        seatNumber: booking.seatNumber,
        travelClass: booking.travelClass,
        fromStation: booking.fromStation,
        toStation: booking.toStation,
        travelDate: booking.travelDate,
        totalAmount: booking.totalAmount,
        advance: booking.advance,
        remainingAmount: booking.remainingAmount,
        paymentStatus: booking.paymentStatus,
        passengers: booking.passengers,
        createdAt: booking.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, isGenuine: false, error: err.message });
  }
});

// Date-wise personal & departmental collection report (Staff & Admin)
router.get('/staff/daily-collection', async (req, res) => {
  try {
    const token = (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))
      ? req.headers.authorization.slice(7)
      : (req.query.token || req.cookies?.staffToken);

    const user = AuthService.validateToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: 'अनधिकृत: कृपया वैध कर्मचारी टोकन प्रदान करें।' });
    }

    const date = req.query.date || null;
    const startDate = req.query.startDate || req.query.from || null;
    const endDate = req.query.endDate || req.query.to || null;
    const targetUsername = (user.role === 'SuperAdmin' && req.query.username) ? req.query.username : user.username;

    const report = await StaffService.getDailyCollectionReport({
      date: date === 'all' ? null : date,
      startDate,
      endDate,
      username: targetUsername,
      role: user.role,
      yatraYear: req.query.year
    });

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TTE / Staff Authentication Login
router.post('/tte/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const staff = await StaffService.authenticateStaff(username, password);

    // Audit log staff login
    await StaffService.logAudit({
      action: 'STAFF_LOGIN',
      performedBy: staff,
      details: `${staff.name} (${staff.role} - ${staff.department}) logged in successfully`
    });

    return res.json({
      success: true,
      message: 'Staff authenticated successfully',
      tte: staff,
      token: 'mvd_tte_session_token'
    });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Fetch IRCTC-style Seating / Reservation Chart JSON (Staff Only)
router.get('/chart/:coachName', requireAuth('view_chart'), async (req, res) => {
  try {
    const { coachName } = req.params;
    const yatraYear = req.query.year || 2026;
    const chart = await BookingService.getCoachSeatingChart(coachName, yatraYear);
    res.json({ success: true, chart });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TTE Check-in: Mark Present (Turned Up) / Absent (No-Show) (TTE / Admin Only)
router.post('/tte/checkin', requireAuth('checkin'), async (req, res) => {
  try {
    const { coachName, yatraYear, seatNumber, status, staffName, staffUsername } = req.body;
    if (!coachName || !seatNumber || !status) {
      return res.status(400).json({ success: false, error: 'coachName, seatNumber and status are required' });
    }
    const result = await BookingService.updatePassengerCheckIn(coachName, yatraYear || 2026, seatNumber, status);

    // Anti-Fraud Audit Log for every attendance mark
    await StaffService.logAudit({
      action: status === 'Present' ? 'CHECKIN_PRESENT' : 'CHECKIN_ABSENT',
      performedBy: { name: staffName || 'TTE Officer', role: 'TTE', username: staffUsername || 'tt' },
      details: `Seat ${seatNumber} marked as ${status} in Coach ${coachName} (Year ${yatraYear || 2026})`,
      targetId: result.bookingId,
      coachName,
      seatNumber
    });

    res.json({ success: true, message: `Seat ${seatNumber} marked as ${status}`, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TTE On-Train Cash / UPI Due Clearance with Anti-Fraud Audit (TTE / Admin Only)
router.post('/tte/collect-due', requireAuth('collect_due'), async (req, res) => {
  try {
    const { bookingId, amount, staffName, staffUsername, paymentMode, utr } = req.body;
    
    const cashierName = req.user ? (req.user.username || req.user.role) : (staffName || 'TTE Officer');
    
    const paymentDetails = {
      method: paymentMode || 'Cash',
      type: 'On-Spot Collection',
      cashierName: cashierName,
      utr: utr || ''
    };
    
    const updated = await BookingService.recordPayment(bookingId, amount ? Number(amount) : null, paymentDetails);

    // Anti-Fraud Audit Log for every rupee collected
    await StaffService.logAudit({
      action: 'DUE_PAYMENT_COLLECTED',
      performedBy: req.user || { name: staffName || 'TTE Officer', role: 'TTE', username: staffUsername || 'tt' },
      details: `On-train remaining payment of ₹${amount} collected for PNR ${bookingId} via ${paymentMode || 'Cash'}`,
      targetId: bookingId,
      amount: Number(amount),
      paymentMode: paymentMode || 'Cash'
    });

    res.json({ success: true, message: 'ड्यू राशि सफलतापूर्वक जमा की गई (Payment Cleared & Logged)', booking: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Online Transactions & UTR Matching Desk (SuperAdmin, FinanceOfficer)
router.get('/admin/online-transactions', async (req, res) => {
  try {
    const { status, search, year } = req.query;
    const bookings = await BookingService.getBookings(year ? { yatraYear: parseInt(year, 10) } : {});
    
    let txns = [];
    bookings.forEach(b => {
      const pHistory = Array.isArray(b.paymentHistory) && b.paymentHistory.length > 0 ? b.paymentHistory : [];
      if (pHistory.length === 0 && (b.advance > 0 || b.utrNumber)) {
        txns.push({
          id: 'TXN-ADV-' + b.bookingId,
          bookingId: b.bookingId,
          pnr: b.bookingId,
          devoteeName: b.bookedBy,
          mobile: b.mobile,
          yatraYear: b.yatraYear,
          coachName: b.coachName,
          seatNumber: Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber,
          travelClass: b.travelClass,
          amount: b.advance || b.totalAmount,
          method: b.paymentMode || 'UPI',
          utrNumber: b.utrNumber || '',
          date: b.createdAt || new Date().toISOString(),
          cashierName: b.bookedByStaff?.name || 'Counter Staff',
          status: b.utrStatus || (b.utrNumber ? 'Pending' : 'Pending'),
          verifiedBy: b.utrVerifiedBy || null,
          verifiedAt: b.utrVerifiedAt || null,
          remarks: b.utrRemarks || '',
          remainingAmount: b.remainingAmount,
          totalAmount: b.totalAmount
        });
      } else {
        pHistory.forEach(tx => {
          const isOnline = (tx.method && tx.method.toLowerCase().includes('upi')) || 
                           (tx.method && tx.method.toLowerCase().includes('online')) || 
                           (tx.method && tx.method.toLowerCase().includes('gpay')) ||
                           (tx.method && tx.method.toLowerCase().includes('phonepe')) ||
                           (tx.method && tx.method.toLowerCase().includes('paytm')) ||
                           Boolean(tx.utr) || Boolean(b.utrNumber);
          if (isOnline || !status || status === 'All') {
            txns.push({
              id: tx.id || 'TXN-' + Math.random().toString().slice(2, 8),
              bookingId: b.bookingId,
              pnr: b.bookingId,
              devoteeName: b.bookedBy,
              mobile: b.mobile,
              yatraYear: b.yatraYear,
              coachName: b.coachName,
              seatNumber: Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber,
              travelClass: b.travelClass,
              amount: tx.amount,
              method: tx.method || 'UPI',
              utrNumber: tx.utr || b.utrNumber || '',
              date: tx.date || b.createdAt || new Date().toISOString(),
              cashierName: tx.cashierName || b.bookedByStaff?.name || 'Staff',
              status: tx.status || b.utrStatus || (tx.utr || b.utrNumber ? 'Pending' : 'Pending'),
              verifiedBy: tx.verifiedBy || b.utrVerifiedBy || null,
              verifiedAt: tx.verifiedAt || b.utrVerifiedAt || null,
              remarks: tx.remarks || b.utrRemarks || '',
              remainingAmount: b.remainingAmount,
              totalAmount: b.totalAmount
            });
          }
        });
      }
    });

    // Filter by verification status if supplied
    if (status && status !== 'All') {
      txns = txns.filter(t => (t.status || 'Pending').toLowerCase() === status.toLowerCase());
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase().trim();
      txns = txns.filter(t => 
        (t.pnr && t.pnr.toLowerCase().includes(q)) ||
        (t.devoteeName && t.devoteeName.toLowerCase().includes(q)) ||
        (t.mobile && t.mobile.includes(q)) ||
        (t.utrNumber && t.utrNumber.toLowerCase().includes(q)) ||
        (t.id && t.id.toLowerCase().includes(q))
      );
    }

    // Sort descending by date
    txns.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      count: txns.length,
      summary: {
        total: txns.length,
        verified: txns.filter(t => t.status === 'Verified').length,
        pending: txns.filter(t => t.status === 'Pending').length,
        rejected: txns.filter(t => t.status === 'Rejected').length,
        totalAmount: txns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
      },
      transactions: txns
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin UTR Matching & Approval Action
router.put('/admin/transactions/verify-utr', async (req, res) => {
  try {
    const { bookingId, txnId, status, utrNumber, remarks, adminName } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'bookingId is required' });
    }

    const booking = await BookingService.getBookingByIdOrPNR(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const adminUser = req.user?.name || req.user?.username || adminName || 'SuperAdmin';
    const updatedHistory = (booking.paymentHistory || []).map(tx => {
      if (txnId && tx.id === txnId) {
        return {
          ...tx,
          status: status || tx.status || 'Verified',
          utr: utrNumber !== undefined ? utrNumber.trim() : tx.utr,
          remarks: remarks || tx.remarks || '',
          verifiedBy: adminUser,
          verifiedAt: new Date().toISOString()
        };
      }
      return tx;
    });

    const updates = {
      paymentHistory: updatedHistory,
      utrStatus: status || 'Verified',
      utrVerifiedBy: adminUser,
      utrVerifiedAt: new Date().toISOString(),
      ...(utrNumber ? { utrNumber: utrNumber.trim() } : {}),
      ...(remarks ? { utrRemarks: remarks } : {})
    };

    await BookingService.updateBooking(booking.bookingId, updates);

    await StaffService.logAudit({
      action: status === 'Verified' ? 'UTR_VERIFIED' : (status === 'Rejected' ? 'UTR_REJECTED' : 'UTR_UPDATED'),
      performedBy: req.user || { name: adminUser, role: 'SuperAdmin' },
      details: `PNR ${booking.bookingId} के लेनदेन UTR (${utrNumber || booking.utrNumber || 'N/A'}) की स्थिति '${status}' के रूप में सत्यापित की गई।`,
      targetId: booking.bookingId,
      amount: booking.advance,
      paymentMode: booking.paymentMode || 'UPI'
    });

    res.json({
      success: true,
      message: `UTR लेनदेन सफलतापूर्वक '${status === 'Verified' ? 'सत्यापित (Approved)' : (status === 'Rejected' ? 'अस्वीकृत (Rejected)' : status)}' किया गया।`,
      bookingId: booking.bookingId,
      status,
      utrNumber: utrNumber || booking.utrNumber
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// IRCTC-Style Printable Coach Seating Chart (A4 Landscape Print View - Staff Only)
router.get('/chart/:coachName/print', requireAuth('print_chart'), async (req, res) => {
  try {
    const { coachName } = req.params;
    const yatraYear = req.query.year || 2026;
    const chart = await BookingService.getCoachSeatingChart(coachName, yatraYear);

    const html = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>IRCTC RESERVATION CHART - COACH ${chart.coachName} (${chart.yatraYear})</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace, Arial, sans-serif;
      margin: 0;
      padding: 12px;
      color: #000;
      background: #fff;
      font-size: 11px;
    }
    .print-controls {
      background: #FFF0E5;
      border: 2px solid #E65100;
      padding: 10px 16px;
      margin-bottom: 15px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn {
      background: #E65100;
      color: #fff;
      font-weight: bold;
      border: none;
      padding: 8px 20px;
      font-size: 14px;
      cursor: pointer;
      border-radius: 4px;
    }
    .header-box {
      border: 2px solid #000;
      padding: 8px 12px;
      text-align: center;
      margin-bottom: 6px;
    }
    .header-box h1 { margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
    .header-box h3 { margin: 3px 0 0; font-size: 12px; font-weight: normal; }
    
    .meta-table {
      width: 100%;
      border: 1px solid #000;
      margin-bottom: 6px;
      border-collapse: collapse;
      font-size: 10.5px;
      font-weight: bold;
    }
    .meta-table td { padding: 4px 8px; border: 1px solid #000; }
    
    .chart-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .chart-table th, .chart-table td {
      border: 1px solid #000;
      padding: 4px 5px;
      text-align: left;
    }
    .chart-table th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
      font-size: 10px;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .vacant-row {
      color: #777;
      font-style: italic;
    }
    .badge-cnf {
      background: #000;
      color: #fff;
      padding: 1px 4px;
      font-size: 9px;
      border-radius: 2px;
    }
    .status-present { font-weight: bold; color: #047857; }
    .status-absent { font-weight: bold; color: #B91C1C; }
    .status-pending { color: #555; }
    
    .summary-box {
      margin-top: 10px;
      border: 1px solid #000;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 10.5px;
      background: #fafafa;
    }

    .sign-box {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      padding: 0 30px;
      font-size: 11px;
      font-weight: bold;
    }
    .sign-col { text-align: center; border-top: 1px dotted #000; width: 220px; padding-top: 5px; }

    @media print {
      .print-controls { display: none; }
      body { padding: 0; }
      .chart-table tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-controls">
    <div>
      <strong style="color: #9A3412; font-size: 14px;">🇮🇳 IRCTC / MVD विशेष आरक्षण चार्ट - कोच ${chart.coachName} (${chart.yatraYear})</strong>
      <span style="margin-left: 12px; color: #666; font-size: 12px;">प्रिंट करने के लिए 'चार्ट प्रिंट करें' पर क्लिक करें</span>
    </div>
    <div>
      <button class="print-btn" onclick="window.print()">🖨️ आरक्षण चार्ट प्रिंट करें (Print Chart)</button>
      <button class="print-btn" style="background: #333; margin-left: 8px;" onclick="window.close()">✕ बंद करें</button>
    </div>
  </div>

  <div class="header-box">
    <h1>INDIAN RAILWAYS / SHRI MATA VAISHNO DEVI CHARITABLE TRUST</h1>
    <h3>CURRENT RESERVATION CHART / वर्तमान यात्री आरक्षण सूची • विशेष तीर्थ यात्रा ${chart.yatraYear}</h3>
  </div>

  <table class="meta-table">
    <tr>
      <td><strong>ट्रेन नं एवं नाम:</strong> 04201 - MVD SPECIAL SF EXP</td>
      <td><strong>कोच नंबर:</strong> ${chart.coachName} (${chart.travelClass})</td>
      <td><strong>यात्रा तिथि:</strong> ${chart.rows[0]?.travelDate || '14-10-2026'}</td>
      <td><strong>चार्ट निर्माण समय:</strong> ${chart.chartPreparedAt}</td>
    </tr>
    <tr>
      <td><strong>प्रस्थान:</strong> NEW DELHI (NDLS) / LKO / BSB</td>
      <td><strong>गंतव्य:</strong> SH. MATA VAISHNO DEVI KATRA (SVDK)</td>
      <td><strong>कुल बर्थ क्षमता:</strong> ${chart.totalCapacity}</td>
      <td><strong>आरक्षित सीटें:</strong> ${chart.bookedCount} | <strong>रिक्त:</strong> ${chart.vacantCount}</td>
    </tr>
  </table>

  <table class="chart-table">
    <thead>
      <tr>
        <th style="width: 35px;">क्र.</th>
        <th style="width: 45px;">सीट</th>
        <th style="width: 40px;">बर्थ</th>
        <th style="width: 110px;">PNR क्रमांक</th>
        <th style="width: 170px;">यात्री का नाम (NAME)</th>
        <th style="width: 50px;">आयु/लिंग</th>
        <th style="width: 90px;">आधार / संपर्क</th>
        <th style="width: 120px;">कहाँ से - कहाँ तक</th>
        <th style="width: 50px;">स्थिति</th>
        <th style="width: 90px;">किराया स्थिति</th>
        <th style="width: 80px;">TTE अटेंडेंस</th>
        <th style="width: 80px;">हस्ताक्षर</th>
      </tr>
    </thead>
    <tbody>
      ${chart.rows.map((r, i) => `
        <tr class="${r.isBooked ? '' : 'vacant-row'}">
          <td class="text-center">${i + 1}</td>
          <td class="text-center"><strong>${r.seatNumber}</strong></td>
          <td class="text-center">${r.berthType.substring(0, 2).toUpperCase()}</td>
          <td class="text-center">${r.pnr ? '<strong>' + r.pnr + '</strong>' : '-'}</td>
          <td>${r.isBooked ? '<strong>' + r.passengerName.toUpperCase() + '</strong>' : r.passengerName}</td>
          <td class="text-center">${r.age ? r.age + '/' + (r.gender === 'Female' ? 'F' : 'M') : '-'}</td>
          <td>${r.mobile || r.aadhar || '-'}</td>
          <td>${r.fromStation ? r.fromStation.split(' ')[0] + ' -> SVDK' : '-'}</td>
          <td class="text-center">${r.isBooked ? '<span class="badge-cnf">CNF</span>' : '-'}</td>
          <td class="text-center">${r.isBooked ? (r.remainingAmount > 0 ? 'DUE ₹' + r.remainingAmount : 'PAID') : '-'}</td>
          <td class="text-center">
            ${r.isBooked ? (
              r.checkInStatus === 'Present' ? '<span class="status-present">✓ उप.</span>' :
              r.checkInStatus === 'Absent' ? '<span class="status-absent">✗ अनु.</span>' :
              '<span class="status-pending">[ ] जाँचना</span>'
            ) : '-'}
          </td>
          <td></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary-box">
    <span>कुल बर्थ: ${chart.totalCapacity}</span>
    <span>कन्फर्म यात्री: ${chart.bookedCount}</span>
    <span>रिक्त सीटें: ${chart.vacantCount}</span>
    <span>उपस्थित (Present): ${chart.presentCount}</span>
    <span>अनुपस्थित (Absent): ${chart.absentCount}</span>
    <span>कोच में बकाया (Total Dues): ₹ ${chart.totalDuesInCoach.toLocaleString()}</span>
  </div>

  <div class="sign-box">
    <div class="sign-col">
      हस्ताक्षर चार्ट लिपिक / बुकिंग क्लर्क
    </div>
    <div class="sign-col">
      हस्ताक्षर मुख्य चल टिकट परीक्षक (TTE)
    </div>
    <div class="sign-col">
      स्टेशन अधीक्षक / ट्रस्ट कोषाध्यक्ष
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error generating print chart: ' + err.message);
  }
});

module.exports = router;

