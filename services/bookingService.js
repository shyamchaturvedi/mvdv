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
  // Generate sequential PNR format: MVD-YYYY-000001, MVD-YYYY-000002...
  static async generateBookingId(yatraYear = 2026) {
    const yr = parseInt(yatraYear, 10) || 2026;
    const counterRef = db.collection('counters').doc(`pnr_${yr}`);

    // If Firebase Admin SDK with runTransaction
    if (db.runTransaction) {
      try {
        const nextNum = await db.runTransaction(async (t) => {
          const doc = await t.get(counterRef);
          let current = 0;
          if (doc.exists) {
            current = doc.data().lastNumber || 0;
          } else {
            // Count any existing bookings in case of counter sync
            const snap = await db.collection('bookings').get();
            let maxFound = 0;
            snap.forEach(d => {
              const b = d.data();
              if (b.bookingId && b.bookingId.startsWith(`MVD-${yr}-`)) {
                const parts = b.bookingId.split('-');
                const num = parseInt(parts[2], 10);
                if (!isNaN(num) && num > maxFound) maxFound = num;
              }
            });
            current = maxFound;
          }
          const next = current + 1;
          t.set(counterRef, {
            yatraYear: yr,
            lastNumber: next,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          return next;
        });

        const padded = String(nextNum).padStart(6, '0');
        return `MVD-${yr}-${padded}`;
      } catch (err) {
        console.warn('Transaction counter error, running fallback:', err.message);
      }
    }

    // Fallback if runTransaction not available
    const snapshot = await db.collection('bookings').get();
    let max = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      const bId = data.bookingId || doc.id;
      if (bId && bId.startsWith(`MVD-${yr}-`)) {
        const parts = bId.split('-');
        if (parts.length >= 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > max) max = num;
        }
      }
    });
    const next = max + 1;
    try {
      await counterRef.set({ yatraYear: yr, lastNumber: next, updatedAt: new Date().toISOString() });
    } catch (_) {}
    const padded = String(next).padStart(6, '0');
    return `MVD-${yr}-${padded}`;
  }

  // Generate sequential Receipt ID format: R2026000001, R2026000002... (or with -REF for refunds)
  static async generateReceiptId(yatraYear = 2026, isRefund = false) {
    const yr = parseInt(yatraYear, 10) || 2026;
    const counterRef = db.collection('counters').doc(`receipt_${yr}`);

    if (db.runTransaction) {
      try {
        const nextNum = await db.runTransaction(async (t) => {
          const doc = await t.get(counterRef);
          let current = 0;
          if (doc.exists) {
            current = doc.data().lastNumber || 0;
          } else {
            // Count any existing receipts across bookings
            const snap = await db.collection('bookings').get();
            let maxFound = 0;
            snap.forEach(d => {
              const b = d.data();
              const history = b.paymentHistory || [];
              history.forEach(tx => {
                if (tx && tx.id) {
                  const match = tx.id.match(new RegExp(`^R${yr}(\\d+)`));
                  if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > maxFound) maxFound = num;
                  }
                }
              });
            });
            current = maxFound;
          }
          const next = current + 1;
          t.set(counterRef, {
            yatraYear: yr,
            lastNumber: next,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          return next;
        });

        const padded = String(nextNum).padStart(6, '0');
        return isRefund ? `R${yr}${padded}-REF` : `R${yr}${padded}`;
      } catch (err) {
        console.warn('Transaction receipt counter error, running fallback:', err.message);
      }
    }

    // Fallback if runTransaction not available
    const snapshot = await db.collection('bookings').get();
    let max = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      const history = data.paymentHistory || [];
      history.forEach(tx => {
        if (tx && tx.id) {
          const match = tx.id.match(new RegExp(`^R${yr}(\\d+)`));
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > max) max = num;
          }
        }
      });
    });
    const next = max + 1;
    try {
      await counterRef.set({ yatraYear: yr, lastNumber: next, updatedAt: new Date().toISOString() });
    } catch (_) {}
    const padded = String(next).padStart(6, '0');
    return isRefund ? `R${yr}${padded}-REF` : `R${yr}${padded}`;
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
        id: await BookingService.generateReceiptId(yatraYear),
        date: new Date().toISOString(),
        amount: advance,
        method: payload.paymentMode || 'UPI',
        type: 'Advance Booking',
        cashierName: payload.cashierName || 'System',
        utr: payload.utr || ''
      }] : [],
      notes: payload.notes || 'Mata Vaishno Devi Yatra Special Booking',
      offlineReceiptNo: payload.offlineReceiptNo || '',
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
      const refundReceiptId = await BookingService.generateReceiptId(booking.yatraYear || 2026, true);
      paymentHistory.push({
        id: refundReceiptId,
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
    const receiptId = await BookingService.generateReceiptId(booking.yatraYear || 2026);
    const newTxn = {
      id: receiptId,
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

  // Aggregate stats for executive dashboard with Comprehensive Progress, Collections, Discounts, Staff & Coach Analytics
  static async getDashboardStats(yatraYear = null) {
    const allBookings = await this.getBookings(yatraYear ? { yatraYear } : {});
    
    const activeBookings = allBookings.filter(b => b.status !== 'Cancelled');
    const cancelledBookings = allBookings.filter(b => b.status === 'Cancelled');

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = activeBookings.filter(b => b.createdAt && b.createdAt.startsWith(today));
    const todayCancelled = cancelledBookings.filter(b => b.cancellationDetails?.cancelledAt && b.cancellationDetails.cancelledAt.startsWith(today));

    const totalBookings = activeBookings.length;
    const totalCancelledCount = cancelledBookings.length;

    const totalPassengers = activeBookings.reduce((sum, b) => sum + (Number(b.numberOfPassengers) || (b.passengers ? b.passengers.length : 1)), 0);
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

    // Payment Modes Split (Cash vs UPI vs Bank/Other)
    let cashAmount = 0, cashCount = 0;
    let upiAmount = 0, upiCount = 0;
    let otherAmount = 0, otherCount = 0;

    activeBookings.forEach(b => {
      const mode = (b.paymentMode || b.advancePaymentMode || '').toUpperCase();
      const adv = Number(b.advance) || 0;
      if (mode.includes('CASH') || mode.includes('नकद')) {
        cashAmount += adv;
        cashCount++;
      } else if (mode.includes('UPI') || mode.includes('QR') || mode.includes('GPAY') || mode.includes('PHONEPE')) {
        upiAmount += adv;
        upiCount++;
      } else {
        otherAmount += adv;
        otherCount++;
      }
    });

    // Coach Capacities & Coach-wise stats
    let coachList = [];
    try {
      const { CoachService } = require('./coachService');
      coachList = await CoachService.getAllCoaches();
    } catch (e) {
      coachList = [];
    }

    const coachStats = {};
    activeBookings.forEach(b => {
      const coach = b.coachName || 'Unassigned';
      coachStats[coach] = (coachStats[coach] || 0) + (Number(b.numberOfPassengers) || 1);
    });

    // Deep Coach Utilization Matrix
    const defaultRakeCoaches = [
      { coachCode: 'S1', coachName: 'स्लीपर कोच S1', coachClass: 'Sleeper', totalSeats: 72 },
      { coachCode: 'S2', coachName: 'स्लीपर कोच S2', coachClass: 'Sleeper', totalSeats: 72 },
      { coachCode: 'S3', coachName: 'स्लीपर कोच S3', coachClass: 'Sleeper', totalSeats: 72 },
      { coachCode: 'S4', coachName: 'स्लीपर कोच S4', coachClass: 'Sleeper', totalSeats: 72 },
      { coachCode: 'S5', coachName: 'स्लीपर कोच S5', coachClass: 'Sleeper', totalSeats: 72 },
      { coachCode: 'S6', coachName: 'स्लीपर कोच S6', coachClass: 'Sleeper', totalSeats: 72 },
      { coachCode: 'B1', coachName: 'थर्ड एसी B1', coachClass: 'AC', totalSeats: 72 },
      { coachCode: 'B2', coachName: 'थर्ड एसी B2', coachClass: 'AC', totalSeats: 72 },
      { coachCode: 'B3', coachName: 'थर्ड एसी B3', coachClass: 'AC', totalSeats: 72 },
      { coachCode: 'A1', coachName: 'सेकंड एसी A1', coachClass: 'AC', totalSeats: 54 },
      { coachCode: 'A2', coachName: 'सेकंड एसी A2', coachClass: 'AC', totalSeats: 54 },
      { coachCode: 'A3', coachName: 'सेकंड एसी A3', coachClass: 'AC', totalSeats: 54 },
      { coachCode: 'GS1', coachName: 'जनरल GS1', coachClass: 'General', totalSeats: 80 },
      { coachCode: 'GS2', coachName: 'जनरल GS2', coachClass: 'General', totalSeats: 80 },
      { coachCode: 'SLR1', coachName: 'एसएलआर 1', coachClass: 'General', totalSeats: 20 },
      { coachCode: 'SLR2', coachName: 'एसएलआर 2', coachClass: 'General', totalSeats: 20 }
    ];

    const sourceCoaches = (coachList && coachList.length > 0) ? coachList : defaultRakeCoaches;

    const coachMatrix = sourceCoaches
      .filter(c => Number(c.totalSeats) > 0 && c.coachCode !== 'ENG')
      .map(c => {
        const booked = coachStats[c.coachCode] || 0;
        const capacity = Number(c.totalSeats) || 72;
        const available = Math.max(0, capacity - booked);
        const occupancy = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
        return {
          coachCode: c.coachCode,
          coachName: c.coachName,
          coachClass: c.coachClass,
          capacity,
          booked,
          available,
          occupancy
        };
      });

    const totalTrainCapacity = coachMatrix.reduce((sum, c) => sum + c.capacity, 0) || 1000;
    const overallOccupancyPercent = totalTrainCapacity > 0 ? Math.min(100, Math.round((totalPassengers / totalTrainCapacity) * 100)) : 0;

    // Class Breakdown & Capacities
    const classCapacities = {
      AC: coachMatrix.filter(c => c.coachClass === 'AC').reduce((s, c) => s + c.capacity, 0) || 378,
      Sleeper: coachMatrix.filter(c => c.coachClass === 'Sleeper').reduce((s, c) => s + c.capacity, 0) || 432,
      General: coachMatrix.filter(c => c.coachClass === 'General').reduce((s, c) => s + c.capacity, 0) || 200
    };

    const classStats = {
      AC: {
        booked: activeBookings.filter(b => b.travelClass === 'AC').reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
        capacity: classCapacities.AC,
        revenue: activeBookings.filter(b => b.travelClass === 'AC').reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
      },
      Sleeper: {
        booked: activeBookings.filter(b => b.travelClass === 'Sleeper').reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
        capacity: classCapacities.Sleeper,
        revenue: activeBookings.filter(b => b.travelClass === 'Sleeper').reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
      },
      General: {
        booked: activeBookings.filter(b => b.travelClass === 'General').reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
        capacity: classCapacities.General,
        revenue: activeBookings.filter(b => b.travelClass === 'General').reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
      }
    };

    // Staff Performance Leaderboard & Graph
    const staffMap = {};
    activeBookings.forEach(b => {
      const staffName = (b.bookedByName || b.createdByName || b.bookedBy || 'काउंटर लिपिक').trim();
      if (!staffMap[staffName]) {
        staffMap[staffName] = {
          name: staffName,
          role: b.bookedByRole || (staffName.toLowerCase() === 'admin' ? 'SuperAdmin' : 'BookingClerk'),
          bookingsCount: 0,
          passengersCount: 0,
          grossCollection: 0,
          advanceCollected: 0,
          discountGiven: 0,
          cashAmount: 0,
          upiAmount: 0
        };
      }
      const st = staffMap[staffName];
      st.bookingsCount += 1;
      st.passengersCount += (Number(b.numberOfPassengers) || 1);
      st.grossCollection += (Number(b.totalAmount) || 0);
      st.advanceCollected += (Number(b.advance) || 0);
      st.discountGiven += (Number(b.discount) || 0);
      const mode = (b.paymentMode || b.advancePaymentMode || '').toUpperCase();
      if (mode.includes('CASH') || mode.includes('नकद')) {
        st.cashAmount += (Number(b.advance) || 0);
      } else {
        st.upiAmount += (Number(b.advance) || 0);
      }
    });

    const staffLeaderboard = Object.values(staffMap).sort((a, b) => b.grossCollection - a.grossCollection);

    // Timeline / Daily Collection Progress (Chronological timeline)
    const dateMap = {};
    activeBookings.forEach(b => {
      const d = (b.createdAt ? b.createdAt.slice(0, 10) : today);
      if (!dateMap[d]) {
        dateMap[d] = { date: d, bookings: 0, passengers: 0, advance: 0, gross: 0, discount: 0, remaining: 0 };
      }
      dateMap[d].bookings += 1;
      dateMap[d].passengers += (Number(b.numberOfPassengers) || 1);
      dateMap[d].advance += (Number(b.advance) || 0);
      dateMap[d].gross += (Number(b.totalAmount) || 0);
      dateMap[d].discount += (Number(b.discount) || 0);
      dateMap[d].remaining += (Number(b.remainingAmount) || 0);
    });

    const timelineData = Object.keys(dateMap).sort().map(d => ({
      ...dateMap[d],
      label: d.slice(5).replace('-', '/') // MM/DD
    }));

    // Boarding Station Distribution
    const stationMap = {};
    activeBookings.forEach(b => {
      const stn = (b.boardingStation || b.fromStation || 'Fatehgarh (FGR)').trim();
      stationMap[stn] = (stationMap[stn] || 0) + (Number(b.numberOfPassengers) || 1);
    });
    const boardingStations = Object.keys(stationMap).map(stn => ({
      station: stn,
      passengers: stationMap[stn],
      percentage: totalPassengers > 0 ? Math.round((stationMap[stn] / totalPassengers) * 100) : 0
    })).sort((a, b) => b.passengers - a.passengers);

    // Check-in & Journey Attendance
    let presentCount = 0, absentCount = 0, pendingCheckinCount = 0;
    activeBookings.forEach(b => {
      const pCount = (Number(b.numberOfPassengers) || (b.passengers ? b.passengers.length : 1));
      if (b.checkinStatus === 'Present' || b.checkinStatus === 'Boarded') {
        presentCount += pCount;
      } else if (b.checkinStatus === 'Absent') {
        absentCount += pCount;
      } else {
        pendingCheckinCount += pCount;
      }
    });

    // Discount Analytics
    const discountedBookings = activeBookings.filter(b => Number(b.discount) > 0);
    const discountStats = {
      totalDiscount,
      discountedTicketsCount: discountedBookings.length,
      avgDiscount: discountedBookings.length > 0 ? Math.round(totalDiscount / discountedBookings.length) : 0,
      discountRate: totalCollection > 0 ? ((totalDiscount / (totalCollection + totalDiscount)) * 100).toFixed(1) : '0'
    };

    return {
      yatraYear: yatraYear || '2026',
      totalBookings,
      totalActiveBookings: totalBookings,
      totalCancelledCount,
      todayBookings: todayBookings.length,
      todayCancelledCount: todayCancelled.length,
      totalPassengers,
      totalTrainCapacity,
      overallOccupancyPercent,
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
      paymentModes: {
        cash: { amount: cashAmount, count: cashCount, percent: totalAdvance > 0 ? Math.round((cashAmount / totalAdvance) * 100) : 0 },
        upi: { amount: upiAmount, count: upiCount, percent: totalAdvance > 0 ? Math.round((upiAmount / totalAdvance) * 100) : 0 },
        other: { amount: otherAmount, count: otherCount, percent: totalAdvance > 0 ? Math.round((otherAmount / totalAdvance) * 100) : 0 }
      },
      coachStats,
      coachMatrix,
      classStats,
      staffLeaderboard,
      timelineData,
      boardingStations,
      checkinStats: {
        present: presentCount,
        absent: absentCount,
        pending: pendingCheckinCount,
        boardedPercent: totalPassengers > 0 ? Math.round((presentCount / totalPassengers) * 100) : 0
      },
      discountStats
    };
  }
}

module.exports = {
  BookingService,
  FARES,
  COACH_CONFIG,
  getBerthType
};
