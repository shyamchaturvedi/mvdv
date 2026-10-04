const { db } = require('../config/firebase');

const ROLES = {
  SuperAdmin: {
    name: 'ट्रस्ट मुख्य व्यवस्थापक (Super Admin)',
    permissions: ['all', 'staff_manage', 'financial_reconcile', 'audit_view', 'delete_booking', 'export_excel']
  },
  TTE: {
    name: 'चल टिकट परीक्षक (TTE / On-Train Officer)',
    permissions: ['checkin', 'collect_due', 'view_chart', 'print_chart']
  },
  BookingClerk: {
    name: 'काउंटर आरक्षण लिपिक (Booking Clerk)',
    permissions: ['create_booking', 'collect_advance', 'print_slip', 'view_chart']
  },
  FinanceOfficer: {
    name: 'लेखा व कोषाध्यक्ष अधिकारी (Finance Officer)',
    permissions: ['financial_reconcile', 'audit_view', 'verify_payment', 'export_excel']
  },
  StationMaster: {
    name: 'स्टेशन समन्वयक (Station Coordinator)',
    permissions: ['view_chart', 'print_chart', 'view_roster']
  }
};

const DEPARTMENTS = [
  'Running Staff (ट्रेन संचालन)',
  'Booking Counter (टिकट काउंटर)',
  'Accounts & Audit (लेखा व कोषागार)',
  'Trust Executive (ट्रस्ट प्रबंधन)',
  'Station Management (स्टेशन समन्वयन)'
];

class StaffService {
  // Ensure default staff initialization (Seed primary SuperAdmin in Firestore if missing)
  static async initDefaultStaff() {
    try {
      const adminDocRef = db.collection('staffMembers').doc('ADMIN-001');
      const snap = await adminDocRef.get();
      if (!snap.exists) {
        const adminPass = process.env.ADMIN_PASSWORD;
        const defaultAdmin = {
          staffId: 'ADMIN-001',
          name: 'मुख्य ट्रस्ट व्यवस्थापक (Shyam Chaturvedi)',
          username: 'admin',
          email: (process.env.ADMIN_EMAIL || 'iammshyam@gmail.com').trim().toLowerCase(),
          password: adminPass || 'admin@mvd2026',
          department: 'Trust Executive (ट्रस्ट प्रबंधन)',
          role: 'SuperAdmin',
          mobile: '9598023701',
          assignedCoaches: [], // SuperAdmin has NO coach assignment
          assignedStation: 'All Stations',
          status: 'Active',
          totalCollected: 0,
          cashCollected: 0,
          upiCollected: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await adminDocRef.set(defaultAdmin);
        console.log('✅ SuperAdmin ADMIN-001 ensured in Firestore staffMembers.');
      }
    } catch (e) {
      console.warn('⚠️ Error in initDefaultStaff:', e.message);
    }
  }

  // Get all staff members
  static async getStaffList() {
    await this.initDefaultStaff();
    const snap = await db.collection('staffMembers').get();
    const list = [];
    snap.forEach(doc => {
      const data = doc.data();
      list.push({ ...data, id: doc.id });
    });
    return list;
  }

  // Add a new staff member with role, email & department
  static async addStaff(payload) {
    if (!payload.name || (!payload.username && !payload.email) || !payload.password) {
      throw new Error('कर्मचारी नाम, ईमेल आईडी/यूजरनेम और पासवर्ड अनिवार्य हैं।');
    }

    const email = payload.email ? payload.email.trim().toLowerCase() : '';
    const username = payload.username ? payload.username.trim().toLowerCase() : (email ? email.split('@')[0] : '');

    const existingList = await this.getStaffList();
    if (existingList.some(s => s.username && s.username.toLowerCase() === username)) {
      throw new Error(`उपयोगकर्ता नाम (Username) '${username}' पहले से मौजूद है।`);
    }
    if (email && existingList.some(s => s.email && s.email.toLowerCase() === email)) {
      throw new Error(`ईमेल आईडी '${email}' पहले से किसी अन्य कर्मचारी के नाम पर पंजीकृत है।`);
    }

    let dept = payload.department;
    if (!dept || (dept === 'Running Staff (ट्रेन संचालन)' && payload.role !== 'TTE')) {
      if (payload.role === 'TTE') dept = 'Running Staff (ट्रेन संचालन)';
      else if (payload.role === 'BookingClerk') dept = 'Booking Counter (टिकट काउंटर)';
      else if (payload.role === 'FinanceOfficer') dept = 'Accounts & Audit (लेखा व कोषागार)';
      else if (payload.role === 'SuperAdmin') dept = 'Trust Executive (ट्रस्ट प्रबंधन)';
      else if (payload.role === 'StationMaster') dept = 'Station Management (स्टेशन समन्वयन)';
      else dept = 'Trust Executive (ट्रस्ट प्रबंधन)';
    }

    // Coach assignment: ONLY for TTE! For SuperAdmin, BookingClerk, FinanceOfficer, coaches must be empty []
    const assignedCoaches = payload.role === 'TTE'
      ? (Array.isArray(payload.assignedCoaches) && payload.assignedCoaches.length > 0 
          ? payload.assignedCoaches 
          : (payload.assignedCoach ? [payload.assignedCoach] : ['S1']))
      : [];

    const staffId = `STF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newStaff = {
      staffId,
      name: payload.name.trim(),
      username,
      email,
      password: payload.password,
      department: dept,
      role: payload.role || 'BookingClerk',
      mobile: payload.mobile || '',
      assignedCoaches,
      assignedStation: payload.assignedStation || 'New Delhi (NDLS)',
      status: 'Active',
      totalCollected: 0,
      cashCollected: 0,
      upiCollected: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('staffMembers').doc(staffId).set(newStaff);

    // Audit log
    await this.logAudit({
      action: 'STAFF_ADDED',
      performedBy: payload.createdByName || 'Admin',
      details: `नया कर्मचारी जोड़ा गया: ${newStaff.name} (${newStaff.role} - ईमेल: ${newStaff.email || newStaff.username})`,
      targetId: staffId
    });

    return newStaff;
  }

  // Update staff details or status (e.g. deactivate)
  static async updateStaff(staffId, updates) {
    const docRef = db.collection('staffMembers').doc(staffId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Staff with ID ${staffId} not found`);

    const current = snap.data();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await docRef.set(updated);

    await this.logAudit({
      action: 'STAFF_UPDATED',
      performedBy: updates.updatedByName || 'Admin',
      details: `कर्मचारी ${current.name} का विवरण अपडेट किया गया: ${JSON.stringify(updates)}`,
      targetId: staffId
    });

    return updated;
  }

  // Delete / Remove staff member
  static async deleteStaff(staffId, deletedByName = 'Admin') {
    const docRef = db.collection('staffMembers').doc(staffId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Staff with ID ${staffId} not found`);

    const staff = snap.data();
    await docRef.delete();

    await this.logAudit({
      action: 'STAFF_DELETED',
      performedBy: deletedByName,
      details: `कर्मचारी हटाया गया: ${staff.name} (${staff.email || staff.username})`,
      targetId: staffId
    });

    return { success: true, message: `Staff ${staff.name} removed.` };
  }

  // Authenticate Staff / TTE / Clerk via Username or Email + Password
  static async authenticateStaff(identifier, password) {
    await this.initDefaultStaff();
    const list = await this.getStaffList();
    const cleanId = (identifier || '').trim().toLowerCase();
    
    // Check by username OR email
    const staff = list.find(s => 
      (s.username && s.username.toLowerCase() === cleanId) ||
      (s.email && s.email.toLowerCase() === cleanId)
    );

    if (!staff) {
      throw new Error('अमान्य ईमेल आईडी/यूजरनेम या पासवर्ड।');
    }

    if (staff.status !== 'Active') {
      throw new Error('यह कर्मचारी खाता निलंबित (Suspended / Inactive) है। कृपया ट्रस्ट व्यवस्थापक से संपर्क करें।');
    }

    if (staff.password !== password) {
      throw new Error('अमान्य पासवर्ड।');
    }

    return {
      staffId: staff.staffId,
      name: staff.name,
      username: staff.username,
      email: staff.email || '',
      role: staff.role,
      department: staff.department,
      mobile: staff.mobile,
      assignedCoaches: staff.assignedCoaches,
      permissions: ROLES[staff.role]?.permissions || ['view_chart']
    };
  }

  // Authenticate Staff via Authorized Google Email
  static async authenticateByGoogle(googleEmail, profile = {}) {
    await this.initDefaultStaff();
    const list = await this.getStaffList();
    const cleanEmail = (googleEmail || '').trim().toLowerCase();

    // STRICT MATCH ONLY: Google email MUST match exact registered staff email
    const staff = list.find(s => s.email && s.email.trim().toLowerCase() === cleanEmail);

    if (!staff) {
      throw new Error(`सुरक्षा चेतावनी: Google ईमेल '${cleanEmail}' अधिकृत ट्रस्ट स्टाफ या एडमिन के रूप में पंजीकृत नहीं है। केवल ट्रस्ट द्वारा पूर्व-पंजीकृत ईमेल आईडी ही लॉगिन कर सकती हैं।`);
    }

    if (staff.status !== 'Active') {
      throw new Error('यह कर्मचारी खाता निष्क्रिय / निलंबित (Suspended) है। कृपया ट्रस्ट व्यवस्थापक से संपर्क करें।');
    }

    return {
      staffId: staff.staffId,
      name: staff.name,
      username: staff.username,
      email: staff.email || cleanEmail,
      role: staff.role,
      department: staff.department,
      mobile: staff.mobile,
      assignedCoaches: staff.assignedCoaches,
      photoUrl: profile.photoUrl || '',
      permissions: ROLES[staff.role]?.permissions || ['view_chart']
    };
  }

  // -------------------------------------------------------------
  // Anti-Fraud Immutable Audit Logging
  // -------------------------------------------------------------
  static async logAudit({ action, performedBy, details, targetId, amount = 0, paymentMode = 'None', coachName = null, seatNumber = null }) {
    try {
      const logId = `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const logEntry = {
        logId,
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        action, // 'PAYMENT_COLLECTED', 'TICKET_BOOKED', 'CHECKIN_PRESENT', 'CHECKIN_ABSENT', 'STAFF_ADDED', etc.
        performedBy: typeof performedBy === 'object' ? performedBy.name || performedBy.username : performedBy,
        actorRole: typeof performedBy === 'object' ? performedBy.role : 'Staff',
        actorUsername: typeof performedBy === 'object' ? performedBy.username : '',
        details: details || '',
        targetId: targetId || '',
        amount: Number(amount) || 0,
        paymentMode: paymentMode || 'None',
        coachName: coachName || '',
        seatNumber: seatNumber !== null ? String(seatNumber) : ''
      };

      await db.collection('auditLogs').doc(logId).set(logEntry);

      // If amount was collected, also increment staff's personal collection counter
      if (amount > 0 && typeof performedBy === 'object' && performedBy.username) {
        const staffList = await this.getStaffList();
        const member = staffList.find(s => s.username === performedBy.username);
        if (member) {
          const newTotal = (member.totalCollected || 0) + Number(amount);
          const isCash = paymentMode.toLowerCase().includes('cash') || paymentMode.toLowerCase().includes('नकद');
          const newCash = (member.cashCollected || 0) + (isCash ? Number(amount) : 0);
          const newUpi = (member.upiCollected || 0) + (!isCash ? Number(amount) : 0);
          await db.collection('staffMembers').doc(member.staffId).set({
            ...member,
            totalCollected: newTotal,
            cashCollected: newCash,
            upiCollected: newUpi
          });
        }
      }

      return logEntry;
    } catch (err) {
      console.warn('Audit log write warning:', err.message);
    }
  }

  // Fetch audit logs with filtering
  static async getAuditLogs({ limit = 200, action = null, performedBy = null } = {}) {
    try {
      const snap = await db.collection('auditLogs').get();
      let logs = [];
      snap.forEach(doc => {
        logs.push(doc.data());
      });

      // Sort descending by timestamp
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (action) {
        logs = logs.filter(l => l.action === action);
      }
      if (performedBy) {
        const q = performedBy.toLowerCase();
        logs = logs.filter(l => (l.performedBy && l.performedBy.toLowerCase().includes(q)) || (l.actorUsername && l.actorUsername.toLowerCase().includes(q)));
      }

      return logs.slice(0, limit);
    } catch (err) {
      console.error('Error reading audit logs:', err);
      return [];
    }
  }

  // Comprehensive Anti-Fraud Financial & Attendance Reconciliation
  static async getReconciliationReport(yatraYear = null) {
    const { BookingService } = require('./bookingService');
    const bookings = await BookingService.getBookings(yatraYear ? { yatraYear: parseInt(yatraYear, 10) } : {});
    const staffList = await this.getStaffList();
    const auditLogs = await this.getAuditLogs({ limit: 500 });

    let totalGrossCollection = 0;
    let totalAdvanceCollected = 0;
    let totalDuesCollectedOnTrain = 0;
    let totalRemainingDues = 0;
    let totalPresentYatris = 0;
    let totalAbsentYatris = 0;
    let totalPendingCheckIn = 0;
    let totalYatris = 0;

    bookings.forEach(b => {
      const adv = Number(b.advance || 0);
      const rem = Number(b.remainingAmount || 0);
      const tot = Number(b.totalAmount || 0);

      totalGrossCollection += (tot - rem);
      totalAdvanceCollected += adv;
      totalRemainingDues += rem;

      if (Array.isArray(b.passengers)) {
        totalYatris += b.passengers.length;
        b.passengers.forEach(p => {
          if (p.checkInStatus === 'Present') totalPresentYatris++;
          else if (p.checkInStatus === 'Absent') totalAbsentYatris++;
          else totalPendingCheckIn++;
        });
      }
    });

    // Calculate staff-wise collections from audit logs
    const staffCollectionMap = {};
    staffList.forEach(s => {
      staffCollectionMap[s.username] = {
        staffId: s.staffId,
        name: s.name,
        role: s.role,
        department: s.department,
        status: s.status,
        totalCollected: 0,
        cashCollected: 0,
        upiCollected: 0,
        transactionCount: 0
      };
    });

    // Parse all payment audit logs
    auditLogs.forEach(log => {
      if (log.amount > 0 && log.actorUsername && staffCollectionMap[log.actorUsername]) {
        const s = staffCollectionMap[log.actorUsername];
        s.totalCollected += log.amount;
        s.transactionCount++;
        const isCash = (log.paymentMode || '').toLowerCase().includes('cash') || (log.paymentMode || '').toLowerCase().includes('नकद');
        if (isCash) s.cashCollected += log.amount;
        else s.upiCollected += log.amount;
      }
    });

    return {
      yatraYear: yatraYear || 'All Years',
      summary: {
        totalBookings: bookings.length,
        totalYatris,
        totalGrossCollection,
        totalAdvanceCollected,
        totalRemainingDues,
        totalPresentYatris,
        totalAbsentYatris,
        totalPendingCheckIn
      },
      staffBreakdown: Object.values(staffCollectionMap),
      roles: ROLES,
      departments: DEPARTMENTS,
      recentLogs: auditLogs.slice(0, 50)
    };
  }

  // Date-wise personal & staff collection report
  // Advanced Date-to-Date & Staff MIS Collection Report
  static async getDailyCollectionReport({ date = null, startDate = null, endDate = null, username = null, role = null, yatraYear = null } = {}) {
    const { BookingService } = require('./bookingService');
    const bookings = await BookingService.getBookings(yatraYear ? { yatraYear: parseInt(yatraYear, 10) } : {});
    const staffList = await this.getStaffList();
    const auditLogs = await this.getAuditLogs({ limit: 2000 });

    const cleanDate = (date && date !== 'all') ? date.trim() : null;
    const startD = startDate ? startDate.trim() : null;
    const endD = endDate ? endDate.trim() : null;

    // Helper date matcher
    const isDateMatch = (timestampOrDate) => {
      if (!timestampOrDate) return false;
      const dStr = timestampOrDate.slice(0, 10);
      if (cleanDate) {
        return dStr === cleanDate || timestampOrDate.includes(cleanDate);
      }
      if (startD && endD) {
        return dStr >= startD && dStr <= endD;
      }
      if (startD) {
        return dStr >= startD;
      }
      if (endD) {
        return dStr <= endD;
      }
      return true; // all dates
    };

    // Filter audit logs and bookings
    const filteredLogs = auditLogs.filter(l => isDateMatch(l.timestamp) || isDateMatch(l.formattedTime));
    const filteredBookings = bookings.filter(b => isDateMatch(b.createdAt) || isDateMatch(b.travelDate));

    const targetStaff = username ? staffList.find(s => s.username === username || s.staffId === username) : null;

    let personalTotalCollected = 0;
    let personalCashCollected = 0;
    let personalUpiCollected = 0;
    let personalTransactions = [];
    let personalBookingsCount = 0;
    let personalDiscountsGiven = 0;
    let personalPendingDues = 0;
    let personalYatrisHandled = 0;

    const staffBreakdownMap = {};
    staffList.forEach(s => {
      staffBreakdownMap[s.username] = {
        staffId: s.staffId,
        name: s.name,
        username: s.username,
        role: s.role,
        department: s.department,
        status: s.status,
        totalCollected: 0,
        cashCollected: 0,
        upiCollected: 0,
        transactionCount: 0,
        bookingsCount: 0,
        grossBookedAmount: 0,
        discountsGiven: 0,
        pendingDues: 0,
        passengersCount: 0
      };
    });

    if (!staffBreakdownMap['admin']) {
      staffBreakdownMap['admin'] = {
        staffId: 'ADMIN-001',
        name: 'मुख्य ट्रस्ट व्यवस्थापक (Chief Admin)',
        username: 'admin',
        role: 'SuperAdmin',
        department: 'Trust Executive',
        status: 'Active',
        totalCollected: 0,
        cashCollected: 0,
        upiCollected: 0,
        transactionCount: 0,
        bookingsCount: 0,
        grossBookedAmount: 0,
        discountsGiven: 0,
        pendingDues: 0,
        passengersCount: 0
      };
    }

    // Date-wise bucket map for graphs / time-series MIS
    const dateWiseBuckets = {};

    filteredBookings.forEach(b => {
      const staffUser = b.bookedByStaff?.username || (b.bookedByStaff?.role === 'BookingClerk' ? 'clerk1' : 'admin');
      const discount = Number(b.discount || 0);
      const remaining = Number(b.remainingAmount || 0);
      const gross = Number(b.totalAmount || 0);
      const advance = Number(b.advance || 0);
      const paxCount = Array.isArray(b.passengers) ? b.passengers.length : 1;
      const bDate = (b.createdAt || new Date().toISOString()).slice(0, 10);

      // Populate dateWise bucket
      if (!dateWiseBuckets[bDate]) {
        dateWiseBuckets[bDate] = {
          date: bDate,
          bookingsCount: 0,
          yatrisCount: 0,
          grossAmount: 0,
          collectedAmount: 0,
          cashAmount: 0,
          upiAmount: 0,
          duesAmount: 0,
          discountsAmount: 0
        };
      }
      dateWiseBuckets[bDate].bookingsCount += 1;
      dateWiseBuckets[bDate].yatrisCount += paxCount;
      dateWiseBuckets[bDate].grossAmount += gross;
      dateWiseBuckets[bDate].duesAmount += remaining;
      dateWiseBuckets[bDate].discountsAmount += discount;
      dateWiseBuckets[bDate].collectedAmount += advance;

      if (b.paymentMode?.toLowerCase().includes('upi')) {
        dateWiseBuckets[bDate].upiAmount += advance;
      } else {
        dateWiseBuckets[bDate].cashAmount += advance;
      }

      if (staffBreakdownMap[staffUser]) {
        staffBreakdownMap[staffUser].bookingsCount++;
        staffBreakdownMap[staffUser].grossBookedAmount += gross;
        staffBreakdownMap[staffUser].discountsGiven += discount;
        staffBreakdownMap[staffUser].pendingDues += remaining;
        staffBreakdownMap[staffUser].passengersCount += paxCount;
      }

      if (username && (staffUser === username || username === 'admin')) {
        personalBookingsCount++;
        personalDiscountsGiven += discount;
        personalPendingDues += remaining;
        personalYatrisHandled += paxCount;
      }
    });

    filteredLogs.forEach(log => {
      const actor = log.actorUsername || (log.performedBy && typeof log.performedBy === 'string' ? log.performedBy : '');
      const amt = Number(log.amount || 0);
      const isCash = (log.paymentMode || '').toLowerCase().includes('cash') || (log.paymentMode || '').toLowerCase().includes('नकद');
      const logDate = (log.timestamp || new Date().toISOString()).slice(0, 10);

      if (staffBreakdownMap[actor]) {
        staffBreakdownMap[actor].transactionCount++;
        if (amt > 0) {
          staffBreakdownMap[actor].totalCollected += amt;
          if (isCash) staffBreakdownMap[actor].cashCollected += amt;
          else staffBreakdownMap[actor].upiCollected += amt;
        }
      }

      if (username && (actor === username || username === 'admin')) {
        if (amt > 0) {
          personalTotalCollected += amt;
          if (isCash) personalCashCollected += amt;
          else personalUpiCollected += amt;
        }
        personalTransactions.push(log);
      }
    });

    // Aggregate overall numbers
    let overallGross = 0;
    let overallAdvance = 0;
    let overallDues = 0;
    let overallDiscounts = 0;
    let overallYatris = 0;

    filteredBookings.forEach(b => {
      overallGross += Number(b.totalAmount || 0);
      overallAdvance += Number(b.advance || 0);
      overallDues += Number(b.remainingAmount || 0);
      overallDiscounts += Number(b.discount || 0);
      overallYatris += (Array.isArray(b.passengers) ? b.passengers.length : 1);
    });

    const overallTotalCollected = Object.values(staffBreakdownMap).reduce((acc, s) => acc + s.totalCollected, 0) || overallAdvance;
    const overallCashCollected = Object.values(staffBreakdownMap).reduce((acc, s) => acc + s.cashCollected, 0);
    const overallUpiCollected = Object.values(staffBreakdownMap).reduce((acc, s) => acc + s.upiCollected, 0);

    // Build chronological date-wise breakdown array for UI graphs
    const dateWiseBreakdown = Object.values(dateWiseBuckets).sort((a, b) => a.date.localeCompare(b.date));

    // Role-wise aggregation
    const roleBreakdown = {
      SuperAdmin: { roleName: 'मुख्य व्यवस्थापक', bookings: 0, collected: 0, cash: 0, upi: 0, dues: 0, discounts: 0 },
      BookingClerk: { roleName: 'काउंटर लिपिक', bookings: 0, collected: 0, cash: 0, upi: 0, dues: 0, discounts: 0 },
      TTE: { roleName: 'चल टिकट परीक्षक (TTE)', bookings: 0, collected: 0, cash: 0, upi: 0, dues: 0, discounts: 0 },
      FinanceOfficer: { roleName: 'लेखा व कोषाध्यक्ष', bookings: 0, collected: 0, cash: 0, upi: 0, dues: 0, discounts: 0 },
      StationMaster: { roleName: 'स्टेशन समन्वयक', bookings: 0, collected: 0, cash: 0, upi: 0, dues: 0, discounts: 0 }
    };

    Object.values(staffBreakdownMap).forEach(s => {
      const rKey = s.role || 'Staff';
      if (roleBreakdown[rKey]) {
        roleBreakdown[rKey].bookings += s.bookingsCount;
        roleBreakdown[rKey].collected += s.totalCollected;
        roleBreakdown[rKey].cash += s.cashCollected;
        roleBreakdown[rKey].upi += s.upiCollected;
        roleBreakdown[rKey].dues += s.pendingDues;
        roleBreakdown[rKey].discounts += s.discountsGiven;
      }
    });

    return {
      date: cleanDate || (startD && endD ? `${startD} से ${endD}` : 'समस्त तिथियां (All Time)'),
      startDate: startD,
      endDate: endD,
      username: username || 'All Staff',
      role: role || (targetStaff ? targetStaff.role : 'Staff'),
      personalStats: {
        staffName: targetStaff ? targetStaff.name : (username === 'admin' ? 'मुख्य व्यवस्थापक' : username),
        role: targetStaff ? targetStaff.role : (username === 'admin' ? 'SuperAdmin' : 'Staff'),
        department: targetStaff ? targetStaff.department : 'General',
        totalCollected: personalTotalCollected || overallAdvance,
        cashCollected: personalCashCollected,
        upiCollected: personalUpiCollected,
        bookingsCount: personalBookingsCount || filteredBookings.length,
        grossBookedAmount: personalBookingsCount ? filteredBookings.reduce((a, b) => a + Number(b.totalAmount || 0), 0) : overallGross,
        discountsGiven: personalDiscountsGiven,
        pendingDues: personalPendingDues,
        yatrisHandled: personalYatrisHandled || overallYatris,
        transactions: personalTransactions.slice(0, 100)
      },
      overallStats: {
        totalBookings: filteredBookings.length,
        totalYatris: overallYatris,
        totalGrossAmount: overallGross,
        totalCollected: overallTotalCollected,
        cashCollected: overallCashCollected,
        upiCollected: overallUpiCollected,
        totalDiscounts: overallDiscounts,
        totalPendingDues: overallDues,
        totalTransactions: filteredLogs.length,
        reconciliationBalanced: (overallGross === (overallAdvance + overallDues + overallDiscounts))
      },
      dateWiseBreakdown,
      roleBreakdown,
      staffBreakdown: Object.values(staffBreakdownMap),
      cancellationSummary: {
        totalCancelled: filteredBookings.filter(b => b.status === 'Cancelled').length,
        totalRefundAmount: filteredBookings.filter(b => b.status === 'Cancelled').reduce((acc, b) => acc + (Number(b.refundAmount) || Number(b.cancellationDetails?.refundAmount) || 0), 0),
        cancelledBookings: filteredBookings.filter(b => b.status === 'Cancelled').map(b => ({
          bookingId: b.bookingId,
          bookedBy: b.bookedBy,
          mobile: b.mobile,
          cancelledAt: b.cancellationDetails?.cancelledAt || b.updatedAt,
          cancelledBy: b.cancellationDetails?.cancelledBy || 'Staff',
          cancelledByRole: b.cancellationDetails?.cancelledByRole || 'Staff',
          refundAmount: b.refundAmount || b.cancellationDetails?.refundAmount || 0,
          refundMode: b.cancellationDetails?.refundMode || 'Cash',
          reason: b.cancellationDetails?.cancellationReason || 'यात्री अनुरोध'
        }))
      },
      recentLogs: filteredLogs.slice(0, 50)
    };
  }
  // -------------------------------------------------------------
  // Change Password (Staff Self-Service OR SuperAdmin Override)
  // -------------------------------------------------------------
  static async updatePassword(usernameOrId, oldPassword, newPassword, performedBy = null) {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new Error('नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
    }

    const list = await this.getStaffList();
    const cleanId = (usernameOrId || '').trim().toLowerCase();

    const staff = list.find(s =>
      (s.username && s.username.toLowerCase() === cleanId) ||
      (s.email && s.email.toLowerCase() === cleanId) ||
      s.staffId === usernameOrId
    );

    if (!staff) {
      throw new Error('कर्मचारी नहीं मिला।');
    }

    // SuperAdmin bypass: no old password required if performedBy is SuperAdmin
    const isSuperAdminOverride = performedBy && (performedBy.role === 'SuperAdmin' || (performedBy.permissions && performedBy.permissions.includes('all')));

    if (!isSuperAdminOverride) {
      // Self-service: old password must match
      if (!oldPassword) {
        throw new Error('पासवर्ड बदलने के लिए पुराना पासवर्ड अनिवार्य है।');
      }
      if (staff.password !== oldPassword) {
        throw new Error('पुराना पासवर्ड गलत है।');
      }
    }

    const updatedStaff = {
      ...staff,
      password: newPassword.trim(),
      updatedAt: new Date().toISOString(),
      passwordChangedAt: new Date().toISOString()
    };

    await db.collection('staffMembers').doc(staff.staffId).set(updatedStaff);

    await this.logAudit({
      action: 'PASSWORD_CHANGED',
      performedBy: performedBy || { name: staff.name, username: staff.username, role: staff.role },
      details: isSuperAdminOverride
        ? `SuperAdmin द्वारा ${staff.name} (${staff.username}) का पासवर्ड रीसेट किया गया।`
        : `${staff.name} (${staff.username}) ने स्वयं अपना पासवर्ड बदला।`,
      targetId: staff.staffId
    });

    return { success: true, message: 'पासवर्ड सफलतापूर्वक अपडेट किया गया।' };
  }
}

module.exports = { StaffService, ROLES, DEPARTMENTS };
