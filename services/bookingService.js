const { db } = require('../config/firebase');

// Fixed pricing per class
const FARES = {
  AC: 4000,
  Sleeper: 3000,
  General: 2000
};

// Available Coaches
const COACH_CONFIG = {
  AC: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'],
  Sleeper: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  General: ['GS1', 'GS2', 'SLR']
};

const { SettingsService } = require('./settingsService');

// Calculate berth type based on Indian Railways standard layout (8-seat bay)
function getBerthType(seatNum, travelClass) {
  const num = parseInt(seatNum, 10);
  if (isNaN(num)) return 'Chair';
  if (travelClass === 'General') return 'General';
  
  const mod = num % 8;
  if (mod === 1 || mod === 4) return 'Lower';
  if (mod === 2 || mod === 5) return 'Middle';
  if (mod === 3 || mod === 6) return 'Upper';
  if (mod === 7) return 'Side Lower';
  if (mod === 0) return 'Side Upper';
  return 'Berth';
}

class BookingService {
  // Generate a distinct PNR format: MVD-YYYY-XXXXX
  static async generateBookingId(yatraYear = 2026) {
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `MVD-${yatraYear}-${timestamp}${random.toString().slice(-2)}`;
  }

  // Get all bookings with optional filters
  static async getBookings(filters = {}) {
    const snapshot = await db.collection('bookings').get();
    let list = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      list.push({ ...data, id: doc.id });
    });

    // Apply filtering
    if (filters.yatraYear) {
      list = list.filter(b => String(b.yatraYear) === String(filters.yatraYear));
    }
    if (filters.coachName) {
      list = list.filter(b => b.coachName === filters.coachName);
    }
    if (filters.travelClass) {
      list = list.filter(b => b.travelClass === filters.travelClass);
    }
    if (filters.paymentStatus) {
      list = list.filter(b => b.paymentStatus === filters.paymentStatus);
    }
    if (filters.status) {
      list = list.filter(b => b.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(b => 
        (b.bookingId && b.bookingId.toLowerCase().includes(q)) ||
        (b.bookedBy && b.bookedBy.toLowerCase().includes(q)) ||
        (b.mobile && b.mobile.includes(q)) ||
        (b.aadhar && b.aadhar.includes(q)) ||
        (b.passengers && b.passengers.some(p => p.name && p.name.toLowerCase().includes(q)))
      );
    }

    // Sort by createdAt descending
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }

  // Get booking by PNR or ID
  static async getBookingByIdOrPNR(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();

    // Check by doc id first
    const doc = await db.collection('bookings').doc(clean).get();
    if (doc.exists) {
      return { ...doc.data(), id: doc.id };
    }

    // Check by bookingId / PNR field
    const query = await db.collection('bookings').where('bookingId', '==', clean).get();
    if (!query.empty) {
      const first = query.docs[0];
      return { ...first.data(), id: first.id };
    }

    return null;
  }

  // Create new booking with passenger array and dynamic fare calculation
  static async createBooking(payload) {
    const yatraYear = payload.yatraYear || 2026;
    const bookingId = payload.bookingId || await this.generateBookingId(yatraYear);

    const passengerCount = parseInt(payload.numberOfPassengers, 10) || (payload.passengers ? payload.passengers.length : 1);
    const travelClass = payload.travelClass || 'Sleeper';
    
    // Dynamically fetch fare from Settings
    let unitPrice = FARES[travelClass] || 3000;
    try {
      const settings = await SettingsService.getSettings();
      if (settings && settings.fares && settings.fares[travelClass]) {
        unitPrice = Number(settings.fares[travelClass]);
      }
    } catch (e) {}

    if (payload.unitPrice) {
      unitPrice = Number(payload.unitPrice);
    }

    const totalAmount = unitPrice * passengerCount;

    const discount = parseFloat(payload.discount) || 0;
    const advance = parseFloat(payload.advancePayment || payload.advance) || 0;
    const remainingAmount = Math.max(0, totalAmount - (advance + discount));

    let paymentStatus = 'Unpaid';
    if (remainingAmount <= 0) {
      paymentStatus = 'Paid';
    } else if (advance > 0) {
      paymentStatus = 'Partial';
    }

    // Format seat numbers
    let seatNumbers = [];
    if (Array.isArray(payload.seatNumber)) {
      seatNumbers = payload.seatNumber;
    } else if (typeof payload.seatNumber === 'string') {
      seatNumbers = payload.seatNumber.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Format passengers
    const passengers = (payload.passengers || []).map((p, idx) => ({
      name: p.name || `Yatri ${idx + 1}`,
      age: parseInt(p.age, 10) || null,
      gender: p.gender || 'Male',
      aadhar: p.aadhar || '',
      mobile: p.mobile || payload.mobile || '',
      berthPreference: p.berthPreference || getBerthType(seatNumbers[idx] || (idx + 1), travelClass),
      seatAssigned: seatNumbers[idx] || `${idx + 1}`
    }));

    const bookingData = {
      bookingId,
      yatraYear: parseInt(yatraYear, 10),
      fromStation: payload.fromStation || 'New Delhi (NDLS)',
      toStation: payload.toStation || 'Shri Mata Vaishno Devi Katra (SVDK)',
      travelClass,
      coachName: payload.coachName || 'S1',
      seatNumber: seatNumbers.length > 0 ? seatNumbers : passengers.map((_, i) => String(i + 1)),
      travelDate: payload.date || payload.travelDate || new Date().toISOString().split('T')[0],
      bookedBy: payload.bookedBy || (passengers[0] ? passengers[0].name : 'Devotee'),
      aadhar: payload.aadhar || (passengers[0] ? passengers[0].aadhar : ''),
      mobile: payload.mobile || '',
      email: payload.email || '',
      address: payload.address || '',
      numberOfPassengers: passengerCount,
      unitPrice,
      totalAmount,
      advance,
      discount,
      remainingAmount,
      paymentStatus,
      status: 'Confirmed', // Confirmed | Cancelled
      paymentMode: payload.paymentMode || 'UPI',
      paymentHistory: advance > 0 ? [{
        id: 'TXN-' + Date.now().toString(),
        date: new Date().toISOString(),
        amount: advance,
        method: payload.paymentMode || 'UPI',
        type: 'Advance Booking',
        cashierName: payload.cashierName || 'System',
        utr: payload.utr || ''
      }] : [],
      notes: payload.notes || 'Mata Vaishno Devi Yatra Special Booking',
      passengers,
      bookedByStaff: payload.bookedByStaff || 'Self',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('bookings').doc(bookingId).set(bookingData);
    return bookingData;
  }

  // Update existing booking
  static async updateBooking(bookingId, updates) {
    const existing = await this.getBookingByIdOrPNR(bookingId);
    if (!existing) throw new Error(`Booking ${bookingId} not found`);

    const updatedData = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Recalculate remaining amount and status if financial values change
    if (updates.totalAmount !== undefined || updates.advance !== undefined || updates.discount !== undefined) {
      const tot = parseFloat(updatedData.totalAmount) || 0;
      const adv = parseFloat(updatedData.advance) || 0;
      const disc = parseFloat(updatedData.discount) || 0;
      updatedData.remainingAmount = Math.max(0, tot - (adv + disc));
      if (updatedData.status !== 'Cancelled') {
        if (updatedData.remainingAmount <= 0) {
          updatedData.paymentStatus = 'Paid';
        } else if (adv > 0) {
          updatedData.paymentStatus = 'Partial';
        } else {
          updatedData.paymentStatus = 'Unpaid';
        }
      }
    }

    await db.collection('bookings').doc(existing.bookingId).set(updatedData);
    return updatedData;
  }

  // Cancel Ticket with Refund
  static async cancelBookingWithRefund(bookingId, cancellationData = {}) {
    const booking = await this.getBookingByIdOrPNR(bookingId);
    if (!booking) throw new Error('आरक्षण (Booking) नहीं मिला।');

    if (booking.status === 'Cancelled') {
      throw new Error('यह टिकट पहले ही रद्द (Cancelled) किया जा चुका है।');
    }

    const totalPaid = Number(booking.advance || 0);
    const refundAmount = cancellationData.refundAmount !== undefined ? Number(cancellationData.refundAmount) : totalPaid;
    const cancellationCharges = cancellationData.cancellationCharges !== undefined ? Number(cancellationData.cancellationCharges) : Math.max(0, totalPaid - refundAmount);
    const cancellationReason = cancellationData.cancellationReason || 'Cancelled on Passenger Request';
    const refundMode = cancellationData.refundMode || 'Admin Bank/UPI Transfer (5-7 Days)';
    
    const staffUser = cancellationData.cancelledBy || { name: 'Chief Admin', username: 'admin', role: 'SuperAdmin' };
    const rawStaffName = typeof staffUser === 'string' ? staffUser : (staffUser.name || staffUser.username || 'Admin');
    const staffRole = typeof staffUser === 'object' ? (staffUser.role || 'Staff') : 'Staff';
    
    // Clean staff name for clean display
    let staffName = String(rawStaffName).trim();
    if (staffName.includes('रमाकांत') || staffName.includes('tt')) staffName = 'Ramakant Sharma (TTE)';
    else if (staffName.includes('व्यवस्थापक') || staffName.includes('admin')) staffName = 'Chief Trust Admin';
    else staffName = staffName.replace(/[^\x20-\x7E]/g, '').trim() || 'Counter Staff';

    const refundAccount = {
      channel: cancellationData.refundChannel || (cancellationData.upiId ? 'UPI' : 'Bank Transfer'),
      upiId: cancellationData.upiId || '',
      accountHolder: cancellationData.accountHolder || booking.bookedBy || '',
      bankName: cancellationData.bankName || '',
      accountNumber: cancellationData.accountNumber || '',
      ifscCode: cancellationData.ifscCode || '',
      status: 'Pending Admin Processing (5-7 Working Days)'
    };

    const paymentHistory = booking.paymentHistory || [];
    if (refundAmount > 0) {
      paymentHistory.push({
        id: 'TXN-REF-' + Date.now().toString(),
        date: new Date().toISOString(),
        amount: -refundAmount,
        refundAmount: refundAmount,
        method: refundMode,
        type: 'Ticket Cancellation Refund',
        cashierName: staffName,
        reason: cancellationReason,
        refundAccount,
        utr: cancellationData.utr || refundAccount.upiId || refundAccount.accountNumber || 'Pending Admin Transfer (5-7 Days)'
      });
    }

    const cancellationRecord = {
      cancelledAt: new Date().toISOString(),
      cancelledBy: staffName,
      cancelledByUsername: typeof staffUser === 'object' ? staffUser.username : staffName,
      cancelledByRole: staffRole,
      cancellationReason,
      refundAmount,
      cancellationCharges,
      refundMode,
      refundAccount,
      originalSeats: booking.seatNumber || [],
      originalCoach: booking.coachName,
      originalAdvance: totalPaid
    };

    const updates = {
      status: 'Cancelled',
      paymentStatus: 'Refunded',
      releasedSeats: booking.seatNumber || [],
      seatNumber: [], // Release seats back to available pool!
      passengers: (booking.passengers || []).map(p => ({ ...p, seatAssigned: 'Cancelled', checkInStatus: 'Cancelled' })),
      refundAmount,
      cancellationCharges,
      cancellationDetails: cancellationRecord,
      paymentHistory,
      updatedAt: new Date().toISOString()
    };

    await db.collection('bookings').doc(booking.bookingId).update(updates);

    // Anti-Fraud Audit Log
    try {
      const { StaffService } = require('./staffService');
      await StaffService.logAudit({
        action: 'TICKET_CANCELLED',
        performedBy: staffUser,
        details: `PNR ${booking.bookingId} (${booking.bookedBy}) का टिकट रद्द किया गया। रिफंड राशि: ₹${refundAmount} (माध्यम: ${refundMode})। रद्दीकरणकर्ता: ${staffName} (${staffRole})। कारण: ${cancellationReason}`
      });
    } catch (e) {}

    return { ...booking, ...updates };
  }

  // Mark booking as fully paid or record a partial payment
  static async recordPayment(bookingId, paidAmount = null, paymentDetails = {}) {
    const booking = await this.getBookingByIdOrPNR(bookingId);
    if (!booking) throw new Error('Booking not found');

    let amountToPay = 0;
    if (paidAmount === null) {
      amountToPay = booking.remainingAmount;
    } else {
      amountToPay = parseFloat(paidAmount);
    }

    if (amountToPay <= 0) return booking; // Nothing to pay

    const newAdvance = booking.advance + amountToPay;
    const remainingAmount = Math.max(0, booking.totalAmount - (newAdvance + booking.discount));
    const paymentStatus = remainingAmount <= 0 ? 'Paid' : (newAdvance > 0 ? 'Partial' : 'Unpaid');

    const paymentHistory = booking.paymentHistory || [];
    const newTxn = {
      id: 'TXN-' + Date.now().toString(),
      date: new Date().toISOString(),
      amount: amountToPay,
      method: paymentDetails.method || 'Cash',
      type: paymentDetails.type || 'Balance Clearance',
      cashierName: paymentDetails.cashierName || 'Admin',
      utr: paymentDetails.utr || ''
    };
    paymentHistory.push(newTxn);

    const updates = {
      advance: newAdvance,
      remainingAmount,
      paymentStatus,
      paymentHistory,
      updatedAt: new Date().toISOString()
    };

    await db.collection('bookings').doc(booking.bookingId).update(updates);
    return { ...booking, ...updates, lastTxn: newTxn };
  }

  // Delete / cancel booking
  static async deleteBooking(bookingId) {
    const booking = await this.getBookingByIdOrPNR(bookingId);
    if (!booking) throw new Error('Booking not found');
    await db.collection('bookings').doc(booking.bookingId).delete();
    return true;
  }

  // Get real-time seat occupancy for a coach in a specific year (excluding cancelled)
  static async getCoachOccupancy(coachName, yatraYear = 2026) {
    const bookings = await this.getBookings({ coachName, yatraYear });
    const bookedSeats = new Set();

    bookings.forEach(b => {
      if (b.status !== 'Cancelled' && Array.isArray(b.seatNumber)) {
        b.seatNumber.forEach(s => bookedSeats.add(String(s).trim()));
      }
    });

    const totalCapacity = coachName.startsWith('A') ? 54 : (coachName.startsWith('B') ? 64 : (coachName.startsWith('S') ? 72 : 80));
    const layout = [];

    for (let i = 1; i <= totalCapacity; i++) {
      const seatStr = String(i);
      const isBooked = bookedSeats.has(seatStr);
      const travelClass = coachName.startsWith('A') || coachName.startsWith('B') ? 'AC' : (coachName.startsWith('S') ? 'Sleeper' : 'General');
      layout.push({
        seatNumber: i,
        berthType: getBerthType(i, travelClass),
        isBooked,
        coachName
      });
    }

    return {
      coachName,
      yatraYear,
      totalCapacity,
      bookedCount: bookedSeats.size,
      availableCount: Math.max(0, totalCapacity - bookedSeats.size),
      layout
    };
  }

  // IRCTC-style Coach Reservation Seating Chart (excluding cancelled)
  static async getCoachSeatingChart(coachName, yatraYear = 2026) {
    const yYear = parseInt(yatraYear, 10);
    const bookings = await this.getBookings({ coachName, yatraYear: yYear });

    const totalCapacity = coachName.startsWith('A') ? 54 : (coachName.startsWith('B') ? 64 : (coachName.startsWith('S') ? 72 : 80));
    const travelClass = coachName.startsWith('A') || coachName.startsWith('B') ? 'AC' : (coachName.startsWith('S') ? 'Sleeper' : 'General');

    // Build map: seatStr -> { booking, passenger }
    const seatMap = {};
    bookings.forEach(b => {
      if (b.status !== 'Cancelled' && Array.isArray(b.passengers)) {
        b.passengers.forEach((p, idx) => {
          const seatNum = String(p.seatAssigned || (b.seatNumber && b.seatNumber[idx]) || '').trim();
          if (seatNum && seatNum !== 'Cancelled') {
            seatMap[seatNum] = {
              bookingId: b.bookingId,
              pnr: b.bookingId,
              bookedBy: b.bookedBy,
              mobile: b.mobile,
              fromStation: b.fromStation,
              toStation: b.toStation,
              travelDate: b.travelDate,
              paymentStatus: b.paymentStatus,
              totalAmount: b.totalAmount,
              advance: b.advance,
              remainingAmount: b.remainingAmount,
              passenger: {
                name: p.name,
                age: p.age,
                gender: p.gender,
                aadhar: p.aadhar,
                berthPreference: p.berthPreference || getBerthType(seatNum, travelClass),
                checkInStatus: p.checkInStatus || 'Pending'
              }
            };
          }
        });
      }
    });

    const rows = [];
    let bookedCount = 0;
    let presentCount = 0;
    let absentCount = 0;
    let totalDuesInCoach = 0;

    for (let i = 1; i <= totalCapacity; i++) {
      const seatStr = String(i);
      const berthType = getBerthType(i, travelClass);
      const bookingInfo = seatMap[seatStr];

      if (bookingInfo) {
        bookedCount++;
        if (bookingInfo.passenger.checkInStatus === 'Present') presentCount++;
        if (bookingInfo.passenger.checkInStatus === 'Absent') absentCount++;
        if (bookingInfo.remainingAmount > 0) totalDuesInCoach += bookingInfo.remainingAmount;

        rows.push({
          seatNumber: i,
          berthType,
          status: 'CNF',
          isBooked: true,
          bookingId: bookingInfo.bookingId,
          pnr: bookingInfo.pnr,
          passengerName: bookingInfo.passenger.name,
          age: bookingInfo.passenger.age,
          gender: bookingInfo.passenger.gender,
          aadhar: bookingInfo.passenger.aadhar,
          fromStation: bookingInfo.fromStation,
          toStation: bookingInfo.toStation,
          travelDate: bookingInfo.travelDate,
          mobile: bookingInfo.mobile,
          bookedBy: bookingInfo.bookedBy,
          paymentStatus: bookingInfo.paymentStatus,
          totalAmount: bookingInfo.totalAmount,
          advance: bookingInfo.advance,
          remainingAmount: bookingInfo.remainingAmount,
          checkInStatus: bookingInfo.passenger.checkInStatus
        });
      } else {
        rows.push({
          seatNumber: i,
          berthType,
          status: 'VACANT',
          isBooked: false,
          bookingId: null,
          pnr: null,
          passengerName: '--- रिक्त (VACANT) ---',
          age: null,
          gender: null,
          aadhar: null,
          fromStation: null,
          toStation: null,
          travelDate: null,
          mobile: null,
          bookedBy: null,
          paymentStatus: 'None',
          totalAmount: 0,
          advance: 0,
          remainingAmount: 0,
          checkInStatus: 'Vacant'
        });
      }
    }

    return {
      coachName,
      yatraYear: yYear,
      travelClass,
      totalCapacity,
      bookedCount,
      vacantCount: Math.max(0, totalCapacity - bookedCount),
      presentCount,
      absentCount,
      pendingCheckInCount: Math.max(0, bookedCount - presentCount - absentCount),
      totalDuesInCoach,
      rows,
      chartPreparedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      trainNumber: '04201 / 04202',
      trainName: 'श्री माता वैष्णो देवी विशेष तीर्थ सुपरफास्ट एक्सप्रेस'
    };
  }

  // Update TTE passenger attendance / check-in
  static async updatePassengerCheckIn(coachName, yatraYear, seatNumber, checkInStatus) {
    const yYear = parseInt(yatraYear, 10);
    const bookings = await this.getBookings({ coachName, yatraYear: yYear });

    const seatStr = String(seatNumber).trim();
    for (const b of bookings) {
      if (b.status !== 'Cancelled' && Array.isArray(b.passengers)) {
        let found = false;
        const updatedPax = b.passengers.map((p, idx) => {
          const s = String(p.seatAssigned || (b.seatNumber && b.seatNumber[idx]) || '').trim();
          if (s === seatStr) {
            found = true;
            return { ...p, checkInStatus };
          }
          return p;
        });

        if (found) {
          await this.updateBooking(b.bookingId, { passengers: updatedPax });
          return { success: true, bookingId: b.bookingId, seatNumber, checkInStatus };
        }
      }
    }
    throw new Error(`Seat ${seatNumber} not found in Coach ${coachName} for Year ${yatraYear}`);
  }

  // Aggregate stats for executive dashboard with Refund & Cancellation Metrics
  static async getDashboardStats(yatraYear = null) {
    const allBookings = await this.getBookings(yatraYear ? { yatraYear } : {});
    
    const activeBookings = allBookings.filter(b => b.status !== 'Cancelled');
    const cancelledBookings = allBookings.filter(b => b.status === 'Cancelled');

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = activeBookings.filter(b => b.createdAt && b.createdAt.startsWith(today));
    const todayCancelled = cancelledBookings.filter(b => b.cancellationDetails?.cancelledAt && b.cancellationDetails.cancelledAt.startsWith(today));

    const totalBookings = activeBookings.length;
    const totalCancelledCount = cancelledBookings.length;

    const totalPassengers = activeBookings.reduce((sum, b) => sum + (b.numberOfPassengers || (b.passengers ? b.passengers.length : 1)), 0);
    const totalCollection = activeBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    const grossAdvance = allBookings.reduce((sum, b) => sum + (Number(b.advance) || 0), 0);
    const totalRefundAmount = cancelledBookings.reduce((sum, b) => sum + (Number(b.refundAmount) || Number(b.cancellationDetails?.refundAmount) || 0), 0);
    const netAdvance = Math.max(0, grossAdvance - totalRefundAmount);

    const totalAdvance = activeBookings.reduce((sum, b) => sum + (Number(b.advance) || 0), 0);
    const totalDiscount = activeBookings.reduce((sum, b) => sum + (Number(b.discount) || 0), 0);
    const totalRemaining = activeBookings.reduce((sum, b) => sum + (Number(b.remainingAmount) || 0), 0);

    const paidCount = activeBookings.filter(b => b.paymentStatus === 'Paid').length;
    const partialCount = activeBookings.filter(b => b.paymentStatus === 'Partial').length;
    const unpaidCount = activeBookings.filter(b => b.paymentStatus === 'Unpaid').length;

    // Coach-wise count
    const coachStats = {};
    activeBookings.forEach(b => {
      const coach = b.coachName || 'Unassigned';
      coachStats[coach] = (coachStats[coach] || 0) + (b.numberOfPassengers || 1);
    });

    // Class breakdown
    const classStats = {
      AC: activeBookings.filter(b => b.travelClass === 'AC').length,
      Sleeper: activeBookings.filter(b => b.travelClass === 'Sleeper').length,
      General: activeBookings.filter(b => b.travelClass === 'General').length
    };

    return {
      yatraYear: yatraYear || 'All Years',
      totalBookings,
      totalActiveBookings: totalBookings,
      totalCancelledCount,
      todayBookings: todayBookings.length,
      todayCancelledCount: todayCancelled.length,
      totalPassengers,
      totalCollection,
      grossAdvance,
      totalRefundAmount,
      netAdvance,
      totalAdvance,
      totalDiscount,
      totalRemaining,
      paidCount,
      partialCount,
      unpaidCount,
      coachStats,
      classStats
    };
  }
}

module.exports = {
  BookingService,
  FARES,
  COACH_CONFIG,
  getBerthType
};
