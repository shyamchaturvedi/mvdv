const { db } = require('../config/firebase');

// Fixed pricing per class
const FARES = {
  AC: 0,
  Sleeper: 3000,
  General: 2000
};

// Available Coaches
const COACH_CONFIG = {
  AC: [],
  Sleeper: Array.from({ length: 18 }, (_, i) => `S${i + 1}`),
  General: ['SLR1', 'SLR2']
};

const { SettingsService } = require('./settingsService');

function normalizeClassKey(cls, coachCode = '') {
  const c = String(cls || '').trim().toUpperCase();
  const code = String(coachCode || '').trim().toUpperCase();
  if (c === 'AC' || c === '3 AC' || c === '2 AC' || c === '1 AC' || c === '3A' || c === '2A' || c === '1A') return 'AC';
  if (c === 'SLEEPER' || c === 'SL') return 'Sleeper';
  if (c === 'GENERAL' || c === '2S' || c === 'GS' || c === 'GUARD / SLR' || c === 'SLR') return 'General';
  if (code.startsWith('A') || code.startsWith('B') || code.startsWith('H')) return 'AC';
  if (code.startsWith('S') && !code.startsWith('SLR')) return 'Sleeper';
  return 'General';
}

async function resolveCoachAndSettings(coachCode, travelClass) {
  let coachMeta = null;
  let settings = null;
  try {
    settings = await SettingsService.getSettings();
  } catch (e) {}
  try {
    const { CoachService } = require('./coachService');
    const all = await CoachService.getAllCoaches();
    const target = String(coachCode || '').trim().toUpperCase();
    coachMeta = all.find(c => String(c.coachCode || '').trim().toUpperCase() === target) || null;
  } catch (e) {}
  const normClass = normalizeClassKey(travelClass || coachMeta?.coachClass, coachCode);
  return { coachMeta, settings, normClass };
}

// IRCTC Standard Coach Berth Engine (Indian Railways PRS Architecture)
function getBerthInfo(seatNum, travelClass = 'Sleeper') {
  const num = parseInt(seatNum, 10);
  if (isNaN(num) || num <= 0) {
    return {
      code: 'BERTH',
      name: 'Berth',
      fullName: 'Berth',
      display: 'Berth',
      bayNumber: 1,
      isSide: false,
      tier: 'Standard'
    };
  }

  const norm = normalizeClassKey(travelClass);
  const is2AC = norm === 'AC' || norm === '2A' || String(travelClass || '').toUpperCase().includes('2A');
  const is1AC = norm === '1A' || String(travelClass || '').toUpperCase().includes('1A');
  const isGeneral = norm === 'General' || norm === '2S' || norm === 'CC';

  if (isGeneral) {
    const mod = num % 6;
    const isWindow = mod === 1 || mod === 0;
    const isAisle = mod === 3 || mod === 4;
    const code = isWindow ? 'WS' : (isAisle ? 'AS' : 'M');
    const name = isWindow ? 'Window' : (isAisle ? 'Aisle' : 'Middle');
    return {
      code,
      name,
      fullName: `${name} (${code})`,
      display: `${name} (${code})`,
      bayNumber: Math.ceil(num / 6),
      isSide: false,
      tier: 'Seater'
    };
  }

  if (is1AC) {
    const isLower = num % 2 === 1;
    const code = isLower ? 'LB' : 'UB';
    const name = isLower ? 'Lower' : 'Upper';
    return {
      code,
      name,
      fullName: `${name} (${code})`,
      display: `${name} (${code})`,
      bayNumber: Math.ceil(num / 4),
      isSide: false,
      tier: isLower ? 'Lower' : 'Upper'
    };
  }

  if (is2AC) {
    const rem = num % 6;
    let code = 'UB';
    let name = 'Upper';
    let isSide = false;
    let tier = 'Upper';

    if (rem === 1 || rem === 3) {
      code = 'LB';
      name = 'Lower';
      tier = 'Lower';
    } else if (rem === 2 || rem === 4) {
      code = 'UB';
      name = 'Upper';
      tier = 'Upper';
    } else if (rem === 5) {
      code = 'SL';
      name = 'Side Lower';
      isSide = true;
      tier = 'Lower';
    } else { // rem === 0
      code = 'SU';
      name = 'Side Upper';
      isSide = true;
      tier = 'Upper';
    }

    return {
      code,
      name,
      fullName: `${name} (${code})`,
      display: `${name} (${code})`,
      bayNumber: Math.ceil(num / 6),
      isSide,
      tier
    };
  }

  // Standard Indian Railways Sleeper & 3AC (8-berth bay)
  const rem = num % 8;
  let code = 'UB';
  let name = 'Upper';
  let isSide = false;
  let tier = 'Upper';

  if (rem === 1 || rem === 4) {
    code = 'LB';
    name = 'Lower';
    tier = 'Lower';
  } else if (rem === 2 || rem === 5) {
    code = 'MB';
    name = 'Middle';
    tier = 'Middle';
  } else if (rem === 3 || rem === 6) {
    code = 'UB';
    name = 'Upper';
    tier = 'Upper';
  } else if (rem === 7) {
    code = 'SL';
    name = 'Side Lower';
    isSide = true;
    tier = 'Lower';
  } else { // rem === 0
    code = 'SU';
    name = 'Side Upper';
    isSide = true;
    tier = 'Upper';
  }

  return {
    code,
    name,
    fullName: `${name} (${code})`,
    display: `${name} (${code})`,
    bayNumber: Math.ceil(num / 8),
    isSide,
    tier
  };
}

function getBerthType(seatNum, travelClass) {
  return getBerthInfo(seatNum, travelClass).display;
}

function getBerthCode(seatNum, travelClass) {
  return getBerthInfo(seatNum, travelClass).code;
}

function getBerthName(seatNum, travelClass) {
  return getBerthInfo(seatNum, travelClass).name;
}

/**
 * Senior Developer IRCTC Smart Seat Allocation Algorithm:
 * 1. Bay Continuity: Allocates family/group in the same 8-berth coupe whenever possible.
 * 2. Senior Citizen & Female Priority: Automatically allocates Lower Berths (LB/SL) to seniors (age >= 60) and females.
 * 3. Modulo Berth Correctness: Guarantees Seat 1 is Lower, Seat 2 is Middle, Seat 3 is Upper (no consecutive upper berths).
 */
function allocateIRCTCBaySeats(passengers = [], availableSeatNumbers = [], travelClass = 'Sleeper') {
  if (!Array.isArray(passengers) || passengers.length === 0) return [];
  const needed = passengers.length;
  const availNums = availableSeatNumbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
  if (availNums.length === 0) return passengers;

  // Group available seats by bay
  const bayMap = new Map();
  const baySize = (normalizeClassKey(travelClass) === 'AC' && String(travelClass || '').toUpperCase().includes('2A')) ? 6 : 8;

  availNums.forEach(num => {
    const bay = Math.ceil(num / baySize);
    if (!bayMap.has(bay)) bayMap.set(bay, []);
    bayMap.get(bay).push(num);
  });

  // Find optimal cluster: preferably single bay with >= needed seats
  let chosenSeats = [];
  for (const [, baySeats] of bayMap.entries()) {
    if (baySeats.length >= needed) {
      chosenSeats = baySeats.slice(0, needed);
      break;
    }
  }

  // Fallback: take first contiguous available seats
  if (chosenSeats.length < needed) {
    chosenSeats = availNums.slice(0, needed);
  }

  // Separate seats by Lower vs Non-Lower
  const lowerSeats = chosenSeats.filter(s => {
    const info = getBerthInfo(s, travelClass);
    return info.tier === 'Lower';
  });
  const otherSeats = chosenSeats.filter(s => {
    const info = getBerthInfo(s, travelClass);
    return info.tier !== 'Lower';
  });

  // Sort passengers: Seniors (>= 60) first, then Females, then others
  const paxWithMeta = passengers.map((p, idx) => ({
    passenger: p,
    originalIdx: idx,
    age: parseInt(p.age, 10) || 0,
    isSenior: (parseInt(p.age, 10) || 0) >= 60,
    isFemale: String(p.gender || '').toLowerCase() === 'female'
  }));

  const prioritizedPax = [...paxWithMeta].sort((a, b) => {
    if (a.isSenior !== b.isSenior) return a.isSenior ? -1 : 1;
    if (a.isFemale !== b.isFemale) return a.isFemale ? -1 : 1;
    return a.originalIdx - b.originalIdx;
  });

  const seatAssignmentMap = new Map();
  const remainingLowers = [...lowerSeats];
  const remainingOthers = [...otherSeats];

  prioritizedPax.forEach(item => {
    let assignedNum;
    if ((item.isSenior || item.isFemale) && remainingLowers.length > 0) {
      assignedNum = remainingLowers.shift();
    } else if (remainingOthers.length > 0) {
      assignedNum = remainingOthers.shift();
    } else if (remainingLowers.length > 0) {
      assignedNum = remainingLowers.shift();
    } else {
      assignedNum = chosenSeats[item.originalIdx] || (item.originalIdx + 1);
    }
    seatAssignmentMap.set(item.originalIdx, assignedNum);
  });

  return passengers.map((p, idx) => {
    const seatNum = seatAssignmentMap.get(idx) || chosenSeats[idx] || (idx + 1);
    const bInfo = getBerthInfo(seatNum, travelClass);
    return {
      ...p,
      seatAssigned: String(seatNum),
      berthPreference: bInfo.name,
      berthCode: bInfo.code,
      berthType: bInfo.fullName
    };
  });
}

function normalizePassengerBerths(passengers = [], travelClass = 'Sleeper') {
  if (!Array.isArray(passengers)) return [];

  return passengers.map((p, index) => {
    const assignedSeat = String(p?.seatAssigned || p?.seatNumber || (index + 1)).trim();
    const safeSeat = assignedSeat || String(index + 1);
    const bInfo = getBerthInfo(safeSeat, travelClass);
    return {
      ...p,
      seatAssigned: safeSeat,
      berthPreference: bInfo.name,
      berthCode: bInfo.code,
      berthType: bInfo.fullName
    };
  });
}

class BookingService {
  static async logAudit(action, performedBy, details, targetId) {
    try {
      await db.collection('auditLogs').add({
        logId: 'AUD-' + Date.now() + '-' + Math.floor(Math.random()*1000),
        timestamp: new Date().toISOString(),
        action,
        performedBy,
        details,
        targetId
      });
    } catch (e) { console.error('Audit Log Error:', e); }
  }
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

  static async getCoachDisplayMap() {
    const map = {};
    try {
      const { CoachService } = require('./coachService');
      const all = await CoachService.getAllCoaches();
      all.forEach(c => {
        const code = String(c.coachCode || '').trim().toUpperCase();
        if (code && c.coachName) {
          map[code] = String(c.coachName).trim();
        }
      });
    } catch (e) {}
    return map;
  }

  static enrichBookingWithCoachDisplay(booking, coachDisplayMap = {}) {
    if (!booking) return booking;
    const code = String(booking.coachName || '').trim().toUpperCase();
    const liveName = coachDisplayMap[code] || booking.coachDisplayName || '';
    const enriched = {
      ...booking,
      coachDisplayName: liveName
    };
    if (booking.cancellationDetails && booking.cancellationDetails.originalCoach) {
      const origCode = String(booking.cancellationDetails.originalCoach).trim().toUpperCase();
      enriched.cancellationDetails = {
        ...booking.cancellationDetails,
        originalCoachDisplayName: coachDisplayMap[origCode] || booking.cancellationDetails.originalCoachDisplayName || liveName
      };
    }
    return enriched;
  }

  // Get all bookings with optional filters
  static async getBookings(filters = {}) {
    const [snapshot, coachDisplayMap] = await Promise.all([
      db.collection('bookings').get(),
      this.getCoachDisplayMap()
    ]);
    let list = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      list.push(this.enrichBookingWithCoachDisplay({ ...data, id: doc.id }, coachDisplayMap));
    });

    // Apply filtering
    if (filters.yatraYear) {
      list = list.filter(b => String(b.yatraYear) === String(filters.yatraYear));
    }
    if (filters.coachName) {
      const targetCoach = String(filters.coachName).trim().toUpperCase();
      list = list.filter(b => String(b.coachName || '').trim().toUpperCase() === targetCoach);
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
        (b.offlineReceiptNo && b.offlineReceiptNo.toLowerCase().includes(q)) ||
        (b.coachDisplayName && b.coachDisplayName.toLowerCase().includes(q)) ||
        (b.passengers && b.passengers.some(p => p.name && p.name.toLowerCase().includes(q)))
      );
    }

    list = list.map(b => ({
      ...b,
      passengers: normalizePassengerBerths(b.passengers || [], b.travelClass || 'Sleeper')
    }));

    // Sort by createdAt descending
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }

  // Get booking by PNR or ID
  static async getBookingByIdOrPNR(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();
    const enrich = async (raw) => this.enrichBookingWithCoachDisplay(raw, await this.getCoachDisplayMap());

    // Check by doc id first
    const doc = await db.collection('bookings').doc(clean).get();
    if (doc.exists) {
      const data = { ...doc.data(), id: doc.id };
      const withNormPax = { ...data, passengers: normalizePassengerBerths(data.passengers || [], data.travelClass || 'Sleeper') };
      return enrich(withNormPax);
    }

    // Check by bookingId / PNR field
    const query = await db.collection('bookings').where('bookingId', '==', clean).get();
    if (!query.empty) {
      const first = query.docs[0];
      const data = { ...first.data(), id: first.id };
      const withNormPax = { ...data, passengers: normalizePassengerBerths(data.passengers || [], data.travelClass || 'Sleeper') };
      return enrich(withNormPax);
    }

    // Check by offline receipt number (exact match)
    if (clean) {
      const receiptQuery = await db.collection('bookings').where('offlineReceiptNo', '==', clean).get();
      if (!receiptQuery.empty) {
        const first = receiptQuery.docs[0];
        const data = { ...first.data(), id: first.id };
        const withNormPax = { ...data, passengers: normalizePassengerBerths(data.passengers || [], data.travelClass || 'Sleeper') };
        return enrich(withNormPax);
      }

      // Case-insensitive / whitespace-tolerant fallback for offline receipt number
      const needle = clean.toLowerCase();
      const allSnap = await db.collection('bookings').get();
      const matchDoc = allSnap.docs.find(d => {
        const val = d.data().offlineReceiptNo;
        return val && String(val).trim().toLowerCase() === needle;
      });
      if (matchDoc) {
        const data = { ...matchDoc.data(), id: matchDoc.id };
        const withNormPax = { ...data, passengers: normalizePassengerBerths(data.passengers || [], data.travelClass || 'Sleeper') };
        return enrich(withNormPax);
      }
    }

    return null;
  }

  // Create new booking with passenger array, seat validation, and dynamic fare calculation
  static async createBooking(payload) {
    const yatraYear = parseInt(payload.yatraYear, 10) || 2026;
    const bookingId = payload.bookingId || await this.generateBookingId(yatraYear);

    const coachCode = String(payload.coachName || 'S1').trim().toUpperCase();
    const passengerCount = parseInt(payload.numberOfPassengers, 10) || (Array.isArray(payload.passengers) ? payload.passengers.length : 1) || 1;
    const travelClass = payload.travelClass || 'Sleeper';

    const { coachMeta, settings, normClass } = await resolveCoachAndSettings(coachCode, travelClass);
    const coachCapacity = coachMeta ? Number(coachMeta.totalSeats || 0) : (normClass === 'AC' ? 64 : normClass === 'General' ? 18 : 72);

    // Build set of currently occupied seats in this coach & year (active bookings only)
    const yearCoachBookings = await this.getBookings({ coachName: coachCode, yatraYear });
    const occupiedSeats = new Set();
    yearCoachBookings.forEach(b => {
      if (b.status !== 'Cancelled') {
        if (Array.isArray(b.seatNumber)) {
          b.seatNumber.forEach(s => occupiedSeats.add(String(s).trim()));
        }
        if (Array.isArray(b.passengers)) {
          b.passengers.forEach(p => {
            if (p.seatAssigned && p.seatAssigned !== 'Cancelled') {
              occupiedSeats.add(String(p.seatAssigned).trim());
            }
          });
        }
      }
    });

    // Determine requested seat numbers or auto-assign vacant seats
    let seatNumbers = [];
    if (Array.isArray(payload.seatNumber)) {
      seatNumbers = payload.seatNumber.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof payload.seatNumber === 'string' && payload.seatNumber.trim()) {
      seatNumbers = payload.seatNumber.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(payload.passengers)) {
      seatNumbers = payload.passengers.map(p => String(p.seatAssigned || '').trim()).filter(Boolean);
    }

    if (seatNumbers.length > 0) {
      const seenRequested = new Set();
      for (const s of seatNumbers) {
        if (seenRequested.has(s)) {
          throw new Error(`सीट नंबर ${s} एक से अधिक यात्रियों को आवंटित नहीं किया जा सकता।`);
        }
        seenRequested.add(s);
        if (occupiedSeats.has(s)) {
          throw new Error(`सीट नंबर ${s} कोच ${coachCode} (${yatraYear}) में पहले से आरक्षित है। कृपया अन्य खाली सीट चुनें।`);
        }
        const n = parseInt(s, 10);
        if (coachCapacity > 0 && (!isNaN(n) && (n < 1 || n > coachCapacity))) {
          throw new Error(`कोच ${coachCode} में अधिकतम ${coachCapacity} सीटें हैं (अमान्य सीट: ${s})।`);
        }
      }
    } else {
      const cap = coachCapacity > 0 ? coachCapacity : 72;
      for (let i = 1; i <= cap && seatNumbers.length < passengerCount; i++) {
        const s = String(i);
        if (!occupiedSeats.has(s)) {
          seatNumbers.push(s);
        }
      }
      if (seatNumbers.length < passengerCount) {
        throw new Error(`कोच ${coachCode} में ${passengerCount} रिक्त सीटें उपलब्ध नहीं हैं।`);
      }
    }

    // Dynamically fetch fare from Coach Master / Settings
    let unitPrice = FARES[normClass] !== undefined ? FARES[normClass] : 3000;
    if (coachMeta && coachMeta.fare !== undefined && Number(coachMeta.fare) > 0) {
      unitPrice = Number(coachMeta.fare);
    }
    if (settings && settings.fares && settings.fares[normClass] !== undefined && Number(settings.fares[normClass]) > 0) {
      unitPrice = Number(settings.fares[normClass]);
    }
    if (payload.unitPrice !== undefined && payload.unitPrice !== '') {
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

    // Format passengers
    const passengers = (payload.passengers || []).map((p, idx) => {
      const assigned = String(seatNumbers[idx] || p.seatAssigned || p.seatNumber || (idx + 1)).trim();
      const bInfo = getBerthInfo(assigned, normClass);
      return {
        name: p.name || `Yatri ${idx + 1}`,
        age: parseInt(p.age, 10) || null,
        gender: p.gender || 'Male',
        aadhar: p.aadhar || '',
        mobile: p.mobile || payload.mobile || '',
        berthPreference: bInfo.name,
        berthCode: bInfo.code,
        berthType: bInfo.fullName,
        seatAssigned: assigned,
        checkInStatus: p.checkInStatus || 'Pending'
      };
    });

    const finalSeats = seatNumbers.length > 0 ? seatNumbers : passengers.map(p => String(p.seatAssigned));

    const bookingData = {
      bookingId,
      yatraYear,
      fromStation: payload.fromStation || 'New Delhi (NDLS)',
      toStation: payload.toStation || 'Shri Mata Vaishno Devi Katra (SVDK)',
      travelClass: normClass,
      coachName: coachCode,
      coachDisplayName: coachMeta?.coachName || '',
      seatNumber: finalSeats,
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
      utrNumber: payload.utr || payload.utrNumber || payload.transactionRef || '',
      cardLast4: payload.cardLast4 || '',
      transactionRef: payload.transactionRef || payload.utr || '',
      utrStatus: (payload.utr || payload.transactionRef || payload.cardLast4) ? 'Pending' : 'N/A',
      paymentHistory: advance > 0 ? [{
        id: await BookingService.generateReceiptId(yatraYear),
        date: new Date().toISOString(),
        amount: advance,
        method: payload.paymentMode || 'UPI',
        type: 'Advance Booking',
        cashierName: payload.cashierName || 'System',
        utr: payload.utr || payload.utrNumber || payload.transactionRef || (payload.cardLast4 ? `Card ****${payload.cardLast4}` : '')
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

  // Update existing booking (supports Add/Delete/Edit Yatris, coach transfer, seat collision guard, and fare recalculation)
  static async updateBooking(bookingId, updates = {}, adminName = 'System') {
    const existing = await this.getBookingByIdOrPNR(bookingId);
    if (!existing) throw new Error(`Booking ${bookingId} not found`);

    const actorName = typeof adminName === 'object' ? (adminName.name || adminName.username || 'Admin') : (adminName || 'System');
    const prevPaxCount = Number(existing.numberOfPassengers) || (Array.isArray(existing.passengers) ? existing.passengers.length : 1) || 1;
    const prevCoach = String(existing.coachName || 'S1').trim().toUpperCase();
    const prevSeats = Array.isArray(existing.seatNumber) ? existing.seatNumber : (existing.seatNumber ? [existing.seatNumber] : []);

    const targetYear = updates.yatraYear !== undefined ? (parseInt(updates.yatraYear, 10) || existing.yatraYear) : existing.yatraYear;
    const targetCoach = updates.coachName !== undefined ? String(updates.coachName).trim().toUpperCase() : prevCoach;
    const targetClassRaw = updates.travelClass !== undefined ? updates.travelClass : existing.travelClass;
    const targetStatus = updates.status !== undefined ? updates.status : existing.status;

    const { coachMeta, settings, normClass } = await resolveCoachAndSettings(targetCoach, targetClassRaw);
    const coachCapacity = coachMeta ? Number(coachMeta.totalSeats || 0) : 0;

    // Build set of occupied seats from ALL OTHER active bookings in the target (coach, year)
    const needsSeatCheck = targetStatus !== 'Cancelled' && (
      updates.passengers !== undefined ||
      updates.seatNumber !== undefined ||
      updates.coachName !== undefined ||
      updates.yatraYear !== undefined
    );

    const otherOccupiedSeats = new Set();
    if (needsSeatCheck) {
      const cohortBookings = await this.getBookings({ coachName: targetCoach, yatraYear: targetYear });
      cohortBookings.forEach(b => {
        if (b.bookingId !== existing.bookingId && b.status !== 'Cancelled') {
          if (Array.isArray(b.seatNumber)) {
            b.seatNumber.forEach(s => otherOccupiedSeats.add(String(s).trim()));
          }
          if (Array.isArray(b.passengers)) {
            b.passengers.forEach(p => {
              if (p.seatAssigned && p.seatAssigned !== 'Cancelled') {
                otherOccupiedSeats.add(String(p.seatAssigned).trim());
              }
            });
          }
        }
      });
    }

    const updatedData = {
      ...existing,
      ...updates,
      yatraYear: targetYear,
      coachName: targetCoach,
      coachDisplayName: coachMeta?.coachName || existing.coachDisplayName || '',
      travelClass: normClass,
      updatedAt: new Date().toISOString()
    };
    delete updatedData.recalculateFare;

    let passengerMutationNote = '';

    // Handle full passenger array update (Add Yatri / Delete Yatri / Edit Yatri / Attendance Check-In)
    if (updates.passengers !== undefined) {
      if (!Array.isArray(updates.passengers)) {
        throw new Error('यात्रियों की सूची (passengers) अमान्य है।');
      }
      if (targetStatus !== 'Cancelled' && updates.passengers.length === 0) {
        throw new Error('कम से कम 1 यात्री होना अनिवार्य है। पूरी बुकिंग समाप्त करने के लिए Cancel / Delete विकल्प चुनें।');
      }

      const fallbackSeats = Array.isArray(updates.seatNumber)
        ? updates.seatNumber.map(s => String(s).trim())
        : (typeof updates.seatNumber === 'string' ? updates.seatNumber.split(',').map(s => s.trim()).filter(Boolean) : []);

      const seenInBooking = new Set();
      const normalizedPassengers = updates.passengers.map((p, idx) => {
        const cleanName = String(p?.name || '').trim();
        if (!cleanName && targetStatus !== 'Cancelled') {
          throw new Error(`यात्री #${idx + 1} का पूरा नाम भरना अनिवार्य है।`);
        }

        const rawCheckIn = String(p?.checkInStatus || '').trim();
        const isPaxCancelled = rawCheckIn === 'Cancelled' || String(p?.seatAssigned || '').toUpperCase() === 'CANCELLED' || targetStatus === 'Cancelled';
        const checkInStatus = isPaxCancelled ? 'Cancelled' : (['Present', 'Absent', 'Pending'].includes(rawCheckIn) ? rawCheckIn : 'Pending');

        let seatStr = isPaxCancelled ? 'Cancelled' : String(p?.seatAssigned ?? p?.seat ?? p?.seatNumber ?? fallbackSeats[idx] ?? '').trim();
        if (targetStatus !== 'Cancelled' && !isPaxCancelled) {
          if (!seatStr || seatStr.toUpperCase() === 'AUTO') {
            const capLimit = coachCapacity > 0 ? coachCapacity : 72;
            let assignedAuto = '';
            for (let s = 1; s <= capLimit; s++) {
              const cand = String(s);
              if (!otherOccupiedSeats.has(cand) && !seenInBooking.has(cand)) {
                assignedAuto = cand;
                break;
              }
            }
            if (!assignedAuto) {
              throw new Error(`कोच ${targetCoach} में यात्री #${idx + 1} के लिए कोई खाली सीट उपलब्ध नहीं है।`);
            }
            seatStr = assignedAuto;
          }

          if (seenInBooking.has(seatStr)) {
            throw new Error(`सीट नंबर ${seatStr} एक ही बुकिंग के दो यात्रियों को आवंटित नहीं की जा सकती।`);
          }
          if (otherOccupiedSeats.has(seatStr)) {
            throw new Error(`सीट नंबर ${seatStr} कोच ${targetCoach} (${targetYear}) में पहले से किसी अन्य टिकट पर आरक्षित है। कृपया खाली सीट चुनें।`);
          }
          const seatNum = parseInt(seatStr, 10);
          if (coachCapacity > 0 && (isNaN(seatNum) || seatNum < 1 || seatNum > coachCapacity)) {
            throw new Error(`कोच ${targetCoach} में केवल 1 से ${coachCapacity} तक सीटें उपलब्ध हैं (अमान्य सीट: ${seatStr})।`);
          }
          seenInBooking.add(seatStr);
        } else if (isPaxCancelled) {
          seatStr = 'Cancelled';
        }

        const bInfo = isPaxCancelled ? null : getBerthInfo(seatStr, normClass);
        return {
          name: cleanName || existing.bookedBy || `Yatri ${idx + 1}`,
          age: p?.age !== undefined && p?.age !== '' && p?.age !== null ? (parseInt(p.age, 10) || null) : null,
          gender: p?.gender || 'Male',
          aadhar: String(p?.aadhar || '').trim(),
          mobile: String(p?.mobile || updatedData.mobile || existing.mobile || '').trim(),
          berthPreference: isPaxCancelled ? 'Cancelled' : bInfo.name,
          berthCode: isPaxCancelled ? 'CAN' : bInfo.code,
          berthType: isPaxCancelled ? 'Cancelled' : bInfo.fullName,
          seatAssigned: isPaxCancelled ? 'Cancelled' : seatStr,
          checkInStatus
        };
      });

      updatedData.passengers = normalizedPassengers;
      const activePaxList = normalizedPassengers.filter(p => p.seatAssigned !== 'Cancelled' && p.checkInStatus !== 'Cancelled');
      updatedData.numberOfPassengers = activePaxList.length;
      updatedData.seatNumber = targetStatus === 'Cancelled' ? [] : activePaxList.map(p => String(p.seatAssigned));

      if (activePaxList.length === 0 && targetStatus !== 'Cancelled') {
        updatedData.status = 'Cancelled';
      }

      if (normalizedPassengers.length !== prevPaxCount || prevCoach !== targetCoach || prevSeats.join(',') !== updatedData.seatNumber.join(',')) {
        passengerMutationNote = ` [यात्री: ${prevPaxCount} → ${normalizedPassengers.length}, कोच: ${prevCoach} → ${targetCoach}, सीटें: ${prevSeats.join(',')} → ${updatedData.seatNumber.join(',')}]`;
      }
    } else if (needsSeatCheck) {
      // Coach/Year/SeatNumber changed directly without passing passengers array
      const seatList = Array.isArray(updatedData.seatNumber)
        ? updatedData.seatNumber.map(s => String(s).trim()).filter(Boolean)
        : (typeof updatedData.seatNumber === 'string' ? updatedData.seatNumber.split(',').map(s => s.trim()).filter(Boolean) : prevSeats);

      const seen = new Set();
      for (const s of seatList) {
        if (seen.has(s)) throw new Error(`सीट नंबर ${s} दोहराया नहीं जा सकता।`);
        seen.add(s);
        if (otherOccupiedSeats.has(s)) {
          throw new Error(`सीट नंबर ${s} कोच ${targetCoach} (${targetYear}) में पहले से आरक्षित है।`);
        }
        const n = parseInt(s, 10);
        if (coachCapacity > 0 && !isNaN(n) && (n < 1 || n > coachCapacity)) {
          throw new Error(`कोच ${targetCoach} में केवल 1 से ${coachCapacity} तक सीटें उपलब्ध हैं।`);
        }
      }
      updatedData.seatNumber = seatList;
      if (Array.isArray(updatedData.passengers)) {
        updatedData.passengers = updatedData.passengers.map((p, idx) => {
          const s = seatList[idx] || String(p.seatAssigned || idx + 1);
          const bInfo = getBerthInfo(s, normClass);
          return {
            ...p,
            seatAssigned: s,
            berthPreference: bInfo.name,
            berthCode: bInfo.code,
            berthType: bInfo.fullName
          };
        });
      }
    }

    // Fare & payment recalculation
    const activePaxForFare = (updatedData.passengers || []).filter(p => p.seatAssigned !== 'Cancelled' && p.checkInStatus !== 'Cancelled');
    const newPaxCount = activePaxForFare.length > 0 ? activePaxForFare.length : (Number(updatedData.numberOfPassengers) || 1);
    let effectiveUnitPrice = Number(existing.unitPrice) || Math.round((Number(existing.totalAmount) || 0) / Math.max(1, prevPaxCount)) || 3000;
    if (updates.unitPrice !== undefined && updates.unitPrice !== '') {
      effectiveUnitPrice = Number(updates.unitPrice);
    } else if (updates.coachName !== undefined || updates.travelClass !== undefined) {
      if (coachMeta && coachMeta.fare !== undefined && Number(coachMeta.fare) > 0) {
        effectiveUnitPrice = Number(coachMeta.fare);
      } else if (settings && settings.fares && settings.fares[normClass] !== undefined && Number(settings.fares[normClass]) > 0) {
        effectiveUnitPrice = Number(settings.fares[normClass]);
      } else if (FARES[normClass] !== undefined) {
        effectiveUnitPrice = Number(FARES[normClass]);
      }
    }
    updatedData.unitPrice = effectiveUnitPrice;

    const shouldAutoRecalcTotal = updates.recalculateFare === false
      ? false
      : (updates.recalculateFare === true ||
        (updates.totalAmount === undefined && (newPaxCount !== prevPaxCount || updates.coachName !== undefined || updates.travelClass !== undefined || updates.unitPrice !== undefined)));

    if (shouldAutoRecalcTotal) {
      updatedData.totalAmount = effectiveUnitPrice * newPaxCount;
    } else if (updates.totalAmount !== undefined && updates.totalAmount !== '') {
      updatedData.totalAmount = Number(updates.totalAmount);
    }

    if (
      shouldAutoRecalcTotal ||
      updates.totalAmount !== undefined ||
      updates.advance !== undefined ||
      updates.discount !== undefined
    ) {
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
    await this.logAudit('BOOKING_EDIT', actorName, `Booking ${existing.bookingId} was edited.${passengerMutationNote}`, existing.bookingId);
    try {
      const { StaffService } = require('./staffService');
      await StaffService.logAudit({
        action: 'BOOKING_EDIT',
        performedBy: typeof adminName === 'object' ? adminName : { name: actorName, role: 'Admin', username: actorName },
        details: `PNR ${existing.bookingId} (${updatedData.bookedBy}) का विवरण अपडेट किया गया।${passengerMutationNote}`,
        targetId: existing.bookingId,
        coachName: updatedData.coachName
      });
    } catch (e) {}

    return updatedData;
  }

  // Cancel Ticket with Unified Refund, Mandatory IRCTC Reason, Remarks, and Anti-Fraud Audit
  static async cancelBookingWithRefund(bookingId, cancellationData = {}, adminName = 'System') {
    const booking = await this.getBookingByIdOrPNR(bookingId);
    if (!booking) throw new Error('आरक्षण (Booking) नहीं मिला।');

    if (booking.status === 'Cancelled') {
      throw new Error('यह टिकट पहले ही रद्द (Cancelled) किया जा चुका है।');
    }

    const totalPaid = Number(booking.advance || 0);
    let refundAmount = cancellationData.refundAmount !== undefined ? Number(cancellationData.refundAmount) : totalPaid;
    let cancellationCharges = cancellationData.cancellationCharges !== undefined ? Number(cancellationData.cancellationCharges) : Math.max(0, totalPaid - refundAmount);

    // Strict Anti-Cheating Mathematical Verification: Advance Paid = Refund Amount + Cancellation Charges
    if (refundAmount < 0) refundAmount = 0;
    if (cancellationCharges < 0) cancellationCharges = 0;
    if (refundAmount > totalPaid) refundAmount = totalPaid;
    cancellationCharges = Math.max(0, totalPaid - refundAmount);

    const cancellationReason = cancellationData.cancellationReason || 'यात्री के अनुरोध पर रद्दीकरण (Cancelled on Passenger Request)';
    const remarks = cancellationData.remarks || cancellationData.cancellationRemarks || cancellationData.notes || 'रद्दीकरण एवं रिफंड प्रक्रिया पूर्ण की गई';
    const refundMode = cancellationData.refundMode || (cancellationData.refundChannel === 'Cash' ? 'Cash (Counter Cash Refund)' : 'Admin Bank/UPI Transfer (5-7 Days)');

    const staffUser = cancellationData.cancelledBy || { name: 'Chief Admin', username: 'admin', role: 'SuperAdmin' };
    const rawStaffName = typeof staffUser === 'string' ? staffUser : (staffUser.name || staffUser.username || 'Admin');
    const staffRole = typeof staffUser === 'object' ? (staffUser.role || 'Staff') : 'Staff';

    // Clean staff name for clean display
    let staffName = String(rawStaffName).trim();
    if (staffName.includes('रमाकांत') || staffName.includes('tt')) staffName = 'Ramakant Sharma (TTE)';
    else if (staffName.includes('व्यवस्थापक') || staffName.includes('admin')) staffName = 'Chief Trust Admin';
    else staffName = staffName.replace(/[^ -\u007E]/g, '').trim() || 'Counter Staff';

    const refundAccount = {
      channel: cancellationData.refundChannel || (refundMode.includes('Cash') ? 'Cash' : (cancellationData.upiId ? 'UPI' : 'Bank Transfer')),
      upiId: cancellationData.upiId || '',
      accountHolder: cancellationData.accountHolder || booking.bookedBy || '',
      bankName: cancellationData.bankName || '',
      accountNumber: cancellationData.accountNumber || '',
      ifscCode: cancellationData.ifscCode || '',
      status: refundMode.includes('Cash') ? 'Completed at Counter' : 'Pending Admin Processing (5-7 Working Days)'
    };

    const paymentHistory = booking.paymentHistory || [];
    // Always generate official refund voucher ID so there is an immutable audit slip
    const refundReceiptId = await BookingService.generateReceiptId(booking.yatraYear || 2026, true);
    paymentHistory.push({
      id: refundReceiptId,
      date: new Date().toISOString(),
      amount: -refundAmount,
      refundAmount: refundAmount,
      cancellationCharges: cancellationCharges,
      originalAdvance: totalPaid,
      method: refundMode,
      type: 'Ticket Cancellation Refund',
      cashierName: staffName,
      reason: cancellationReason,
      remarks: remarks,
      refundAccount,
      utr: cancellationData.utr || refundAccount.upiId || refundAccount.accountNumber || (refundMode.includes('Cash') ? 'Counter Cash Handover' : 'Pending Admin Transfer (5-7 Days)')
    });

    const cancellationRecord = {
      cancelledAt: new Date().toISOString(),
      cancelledBy: staffName,
      cancelledByUsername: typeof staffUser === 'object' ? staffUser.username : staffName,
      cancelledByRole: staffRole,
      cancellationReason,
      remarks,
      refundVoucherId: refundReceiptId,
      refundAmount,
      cancellationCharges,
      refundMode,
      refundAccount,
      originalSeats: booking.seatNumber || [],
      originalCoach: booking.coachName,
      originalCoachDisplayName: booking.coachDisplayName || '',
      originalAdvance: totalPaid
    };

    const updates = {
      status: 'Cancelled',
      paymentStatus: 'Refunded',
      releasedSeats: booking.seatNumber || [],
      seatNumber: [], // Release seats back to available pool!
      passengers: (booking.passengers || []).map(p => ({ ...p, seatAssigned: 'Cancelled', checkInStatus: 'Cancelled', berthPreference: 'Cancelled', berthCode: 'CAN', berthType: 'Cancelled' })),
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
        details: `PNR ${booking.bookingId} (${booking.bookedBy}) का टिकट रद्द किया गया। कुल अग्रिम: ₹${totalPaid}, रिफंड राशि: ₹${refundAmount}, कटौती शुल्क: ₹${cancellationCharges}, माध्यम: ${refundMode}, कारण: ${cancellationReason}, टिप्पणी: ${remarks}`,
        targetId: booking.bookingId
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
  static async deleteBooking(bookingId, adminName = 'System') {
    const booking = await this.getBookingByIdOrPNR(bookingId);
    if (!booking) throw new Error('Booking not found');
    await db.collection('bookings').doc(booking.bookingId).delete();
    return true;
  }

  // Get real-time seat occupancy for a coach in a specific year (excluding cancelled)
  static async getCoachOccupancy(coachName, yatraYear = 2026) {
    const cleanCoach = String(coachName || 'S1').trim().toUpperCase();
    const { coachMeta, normClass } = await resolveCoachAndSettings(cleanCoach);
    const bookings = await this.getBookings({ coachName: cleanCoach, yatraYear });
    const bookedSeats = new Set();
    const seatOwnerMap = {};

    bookings.forEach(b => {
      if (b.status !== 'Cancelled') {
        const owner = { bookingId: b.bookingId, bookedBy: b.bookedBy };
        if (Array.isArray(b.seatNumber)) {
          b.seatNumber.forEach(s => {
            const seatStr = String(s).trim();
            if (seatStr) {
              bookedSeats.add(seatStr);
              seatOwnerMap[seatStr] = owner;
            }
          });
        }
        if (Array.isArray(b.passengers)) {
          b.passengers.forEach(p => {
            if (p.seatAssigned && p.seatAssigned !== 'Cancelled') {
              const seatStr = String(p.seatAssigned).trim();
              if (seatStr) {
                bookedSeats.add(seatStr);
                if (!seatOwnerMap[seatStr]) seatOwnerMap[seatStr] = owner;
              }
            }
          });
        }
      }
    });

    const isSLR = cleanCoach.startsWith('SLR');
    const isSleeper = cleanCoach.startsWith('S') && !isSLR;
    const isAC = cleanCoach.startsWith('A') || cleanCoach.startsWith('B');
    const fallbackCapacity = isSLR ? 18 : (isSleeper ? 72 : (isAC ? (cleanCoach.startsWith('A') ? 54 : 64) : 80));
    const totalCapacity = coachMeta && coachMeta.totalSeats !== undefined ? Number(coachMeta.totalSeats) : fallbackCapacity;
    const travelClass = coachMeta ? normalizeClassKey(coachMeta.coachClass, cleanCoach) : (isAC ? 'AC' : (isSleeper ? 'Sleeper' : 'General'));
    const coachDisplayName = coachMeta?.coachName || '';
    const layout = [];

    for (let i = 1; i <= totalCapacity; i++) {
      const seatStr = String(i);
      const isBooked = bookedSeats.has(seatStr);
      const owner = isBooked ? (seatOwnerMap[seatStr] || null) : null;
      layout.push({
        seatNumber: i,
        berthType: getBerthType(i, travelClass),
        isBooked,
        coachName: cleanCoach,
        coachDisplayName,
        bookingId: owner ? owner.bookingId : null,
        booking: owner
      });
    }

    return {
      coachName: cleanCoach,
      coachDisplayName,
      coachClass: coachMeta?.coachClass || travelClass,
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
    const isAllCoaches = !coachName || coachName.toLowerCase() === 'all';

    if (isAllCoaches) {
      const { CoachService } = require('./coachService');
      const allCoaches = await CoachService.getAllCoaches();
      const bookableCoaches = allCoaches.filter(c => c.status !== 'Inactive' && c.isBookable !== false && Number(c.totalSeats) > 0);

      const coachesToProcess = bookableCoaches.length > 0
        ? bookableCoaches
        : ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'GS1', 'GS2', 'SLR1'].map(code => ({ coachCode: code, totalSeats: 72, coachClass: code.startsWith('A') || code.startsWith('B') ? 'AC' : code.startsWith('S') ? 'Sleeper' : 'General' }));

      let totalCapacity = 0;
      let bookedCount = 0;
      let presentCount = 0;
      let absentCount = 0;
      let totalDuesInCoach = 0;
      let allRows = [];

      for (const coach of coachesToProcess) {
        const cChart = await this.getCoachSeatingChart(coach.coachCode || coach, yYear);
        totalCapacity += cChart.totalCapacity;
        bookedCount += cChart.bookedCount;
        presentCount += cChart.presentCount;
        absentCount += cChart.absentCount;
        totalDuesInCoach += cChart.totalDuesInCoach;

        const annotatedRows = cChart.rows.map(r => ({
          ...r,
          coachName: coach.coachCode || coach,
          coachDisplayName: coach.coachName || cChart.coachDisplayName || '',
          displaySeat: `${coach.coachCode || coach}-${r.seatNumber}`
        }));
        allRows.push(...annotatedRows);
      }

      return {
        coachName: 'ALL (सभी कोच)',
        coachDisplayName: 'सम्पूर्ण ट्रेन संरचना (All Active Coaches)',
        yatraYear: yYear,
        travelClass: 'All Classes (सम्पूर्ण ट्रेन)',
        totalCapacity,
        bookedCount,
        vacantCount: Math.max(0, totalCapacity - bookedCount),
        presentCount,
        absentCount,
        pendingCheckInCount: Math.max(0, bookedCount - presentCount - absentCount),
        totalDuesInCoach,
        rows: allRows,
        chartPreparedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        trainNumber: '04201 / 04202',
        trainName: 'श्री माता वैष्णो देवी विशेष तीर्थ सुपरफास्ट एक्सप्रेस'
      };
    }

    const cleanCoach = String(coachName).trim().toUpperCase();
    const { coachMeta } = await resolveCoachAndSettings(cleanCoach);
    const bookings = await this.getBookings({ coachName: cleanCoach, yatraYear: yYear });

    const isSLR = cleanCoach.startsWith('SLR');
    const isSleeper = cleanCoach.startsWith('S') && !isSLR;
    const isAC = cleanCoach.startsWith('A') || cleanCoach.startsWith('B');
    const fallbackCapacity = isSLR ? 18 : (isSleeper ? 72 : (isAC ? (cleanCoach.startsWith('A') ? 54 : 64) : 80));
    const totalCapacity = coachMeta && coachMeta.totalSeats !== undefined ? Number(coachMeta.totalSeats) : fallbackCapacity;
    const travelClass = coachMeta ? (coachMeta.coachClass || normalizeClassKey(coachMeta.coachClass, cleanCoach)) : (isAC ? 'AC' : (isSleeper ? 'Sleeper' : 'General'));

    const seatMap = {};
    const coachBookingsMap = new Map();

    bookings.forEach(b => {
      if (b.status !== 'Cancelled' && Array.isArray(b.passengers)) {
        coachBookingsMap.set(b.bookingId, b);
        const paxCount = b.passengers.length || 1;
        const perPaxRemaining = Math.round((Number(b.remainingAmount) || 0) / paxCount);

        b.passengers.forEach((p, idx) => {
          const seatNum = String(p.seatAssigned || (b.seatNumber && b.seatNumber[idx]) || '').trim();
          if (seatNum && seatNum !== 'Cancelled') {
            const berthPreference = getBerthType(seatNum, travelClass);
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
              remainingAmount: perPaxRemaining,
              bookingRemainingTotal: Number(b.remainingAmount) || 0,
              passenger: {
                name: p.name,
                age: p.age,
                gender: p.gender,
                aadhar: p.aadhar,
                berthPreference,
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
    const totalDuesInCoach = Array.from(coachBookingsMap.values()).reduce((sum, b) => sum + (Number(b.remainingAmount) || 0), 0);

    for (let i = 1; i <= totalCapacity; i++) {
      const seatStr = String(i);
      const berthType = getBerthType(i, travelClass);
      const bookingInfo = seatMap[seatStr];

      if (bookingInfo) {
        bookedCount++;
        if (bookingInfo.passenger.checkInStatus === 'Present') presentCount++;
        if (bookingInfo.passenger.checkInStatus === 'Absent') absentCount++;

        rows.push({
          coachName: cleanCoach,
          coachDisplayName: coachMeta?.coachName || '',
          displaySeat: `${cleanCoach}-${i}`,
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
          coachName: cleanCoach,
          coachDisplayName: coachMeta?.coachName || '',
          displaySeat: `${cleanCoach}-${i}`,
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
      coachName: cleanCoach,
      coachDisplayName: coachMeta?.coachName || '',
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
            return { ...p, checkInStatus, berthPreference: getBerthType(s, b.travelClass || 'Sleeper') };
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
      const coach = String(b.coachName || 'UNASSIGNED').trim().toUpperCase();
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
      .filter(c => Number(c.totalSeats) > 0 && c.coachCode !== 'ENG' && c.isBookable !== false)
      .map(c => {
        const code = String(c.coachCode || '').trim().toUpperCase();
        const booked = coachStats[code] || 0;
        const capacity = Number(c.totalSeats) || 72;
        const available = Math.max(0, capacity - booked);
        const occupancy = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
        return {
          coachCode: c.coachCode,
          coachName: c.coachName,
          coachClass: c.coachClass,
          normClass: normalizeClassKey(c.coachClass, c.coachCode),
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
      AC: coachMatrix.filter(c => c.normClass === 'AC').reduce((s, c) => s + c.capacity, 0),
      Sleeper: coachMatrix.filter(c => c.normClass === 'Sleeper').reduce((s, c) => s + c.capacity, 0),
      General: coachMatrix.filter(c => c.normClass === 'General').reduce((s, c) => s + c.capacity, 0)
    };

    const classStats = {
      AC: {
        booked: activeBookings.filter(b => normalizeClassKey(b.travelClass, b.coachName) === 'AC').reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
        capacity: classCapacities.AC,
        revenue: activeBookings.filter(b => normalizeClassKey(b.travelClass, b.coachName) === 'AC').reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
      },
      Sleeper: {
        booked: activeBookings.filter(b => normalizeClassKey(b.travelClass, b.coachName) === 'Sleeper').reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
        capacity: classCapacities.Sleeper,
        revenue: activeBookings.filter(b => normalizeClassKey(b.travelClass, b.coachName) === 'Sleeper').reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
      },
      General: {
        booked: activeBookings.filter(b => normalizeClassKey(b.travelClass, b.coachName) === 'General').reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
        capacity: classCapacities.General,
        revenue: activeBookings.filter(b => normalizeClassKey(b.travelClass, b.coachName) === 'General').reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
      }
    };

    // Staff Performance Leaderboard & Graph
    const staffMap = {};
    activeBookings.forEach(b => {
      const staffObj = (b.bookedByStaff && typeof b.bookedByStaff === 'object') ? b.bookedByStaff : null;
      const staffName = String(
        staffObj?.name ||
        (typeof b.bookedByStaff === 'string' && b.bookedByStaff !== 'Self' ? b.bookedByStaff : '') ||
        b.bookedByName ||
        b.createdByName ||
        'ऑनलाइन / काउंटर'
      ).trim();
      if (!staffMap[staffName]) {
        staffMap[staffName] = {
          name: staffName,
          role: staffObj?.role || b.bookedByRole || (staffName.toLowerCase().includes('admin') ? 'SuperAdmin' : 'BookingClerk'),
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

    // Check-in & Journey Attendance (per-passenger first, booking fallback)
    let presentCount = 0, absentCount = 0, pendingCheckinCount = 0;
    activeBookings.forEach(b => {
      if (Array.isArray(b.passengers) && b.passengers.length > 0) {
        b.passengers.forEach(p => {
          const st = p.checkInStatus || b.checkinStatus || 'Pending';
          if (st === 'Present' || st === 'Boarded') presentCount++;
          else if (st === 'Absent') absentCount++;
          else pendingCheckinCount++;
        });
      } else {
        const pCount = Number(b.numberOfPassengers) || 1;
        if (b.checkinStatus === 'Present' || b.checkinStatus === 'Boarded') {
          presentCount += pCount;
        } else if (b.checkinStatus === 'Absent') {
          absentCount += pCount;
        } else {
          pendingCheckinCount += pCount;
        }
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
  getBerthInfo,
  getBerthType,
  getBerthCode,
  getBerthName,
  allocateIRCTCBaySeats,
  normalizePassengerBerths
};
