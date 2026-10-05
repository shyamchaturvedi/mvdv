import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Smartphone, Globe, AlertTriangle, Send, Lightbulb, LayoutDashboard, Ticket, ClipboardList, Printer, IndianRupee, Users, Search, BadgeCheck, Briefcase, Download, Upload, FileText, LogOut, Crown, Eye, Lock, Scan, Home, Settings, CalendarDays, Armchair, Mail, Train, Plus, Trash2, Edit, ArrowUp, ArrowDown, RefreshCw, QrCode, BarChart3, CheckCircle2, DollarSign, TrendingUp, Percent, Menu, X, Sparkles, Layers } from 'lucide-react';

import { db, auth, firebaseConfig } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const FARES = {
  AC: 4000,
  Sleeper: 3000,
  General: 2000
};

const COACHES = {
  AC: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'],
  Sleeper: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  General: ['GS1', 'GS2', 'SLR']
};

// Official Complete Route Stops: Lucknow to Jammu Tawi & Katra
const DEFAULT_ROUTE_STATIONS = [
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
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [pnrInput, setPnrInput] = useState('');
  const [ticketModal, setTicketModal] = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [upiQrModal, setUpiQrModal] = useState(null);
  const [utrInput, setUtrInput] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stationsList, setStationsList] = useState(DEFAULT_ROUTE_STATIONS);
  const [posterModal, setPosterModal] = useState(false);

  // Indian Currency Number to Words
  const numberToWords = (num) => {
    const engA = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const engB = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function inEng(n) {
      if ((n = n.toString()).length > 9) return 'overflow';
      let n_arr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n_arr) return '';
      let str = '';
      str += (n_arr[1] != 0) ? (engA[Number(n_arr[1])] || engB[n_arr[1][0]] + ' ' + engA[n_arr[1][1]]) + ' Crore ' : '';
      str += (n_arr[2] != 0) ? (engA[Number(n_arr[2])] || engB[n_arr[2][0]] + ' ' + engA[n_arr[2][1]]) + ' Lakh ' : '';
      str += (n_arr[3] != 0) ? (engA[Number(n_arr[3])] || engB[n_arr[3][0]] + ' ' + engA[n_arr[3][1]]) + ' Thousand ' : '';
      str += (n_arr[4] != 0) ? (engA[Number(n_arr[4])] || engB[n_arr[4][0]] + ' ' + engA[n_arr[4][1]]) + ' Hundred ' : '';
      str += (n_arr[5] != 0) ? ((str != '') ? 'and ' : '') + (engA[Number(n_arr[5])] || engB[n_arr[5][0]] + ' ' + engA[n_arr[5][1]]) + ' ' : '';
      return str.trim();
    }
    const val = parseInt(num, 10);
    if (isNaN(val) || val === 0) return 'Zero Rupees Only';
    return inEng(val) + ' Rupees Only';
  };

  // High-fidelity direct print helper matching downloaded PDF
  const printSlipElement = (elementId, docTitle = 'MVD Document') => {
    const elem = document.getElementById(elementId);
    if (!elem) {
      window.print();
      return;
    }
    const isReceipt = elementId.includes('receipt');
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      window.print();
      return;
    }
    const pageStyle = isReceipt
      ? '@page { size: 210mm 148mm; margin: 4mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
      : '@page { size: A4 portrait; margin: 6mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            ${pageStyle}
            * { box-sizing: border-box; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            .irctc-ticket-wrapper { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; border: 1.5px solid #0284C7 !important; }
            .mandir-receipt-wrapper { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; border: 2px solid #C2410C !important; }
          </style>
          <link rel="stylesheet" href="/css/style.css">
        </head>
        <body style="background: #ffffff; padding: 0;">
          ${elem.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 450);
  };
  // Booking Form State
  const [bookingYear, setBookingYear] = useState('2026');
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  const [fromStation, setFromStation] = useState('Lucknow Charbagh (LKO)');
  const [travelClass, setTravelClass] = useState('Sleeper');
  const [coachName, setCoachName] = useState('S1');
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [coachLayout, setCoachLayout] = useState({ layout: [], availableCount: 0, bookedCount: 0 });
  const [bookedBy, setBookedBy] = useState('');
  const [mobile, setMobile] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [email, setEmail] = useState('');
  const [passengers, setPassengers] = useState([
    { name: '', age: '', gender: 'Male', aadhar: '', seatAssigned: '1' }
  ]);
  const [sameAsLeadDevotee, setSameAsLeadDevotee] = useState(false);
  const [advancePayment, setAdvancePayment] = useState(1000);
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified Staff & Admin Authentication State (Persisted in localStorage for permanent login until Logout)
  const [staffToken, setStaffToken] = useState(() => localStorage.getItem('mvd_staff_token') || sessionStorage.getItem('mvd_staff_token') || '');
  const safeStaffToken = encodeURIComponent(staffToken || (typeof window !== 'undefined' ? (localStorage.getItem('mvd_staff_token') || 'mvd_admin_token') : 'mvd_admin_token'));
  const [staffUser, setStaffUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mvd_staff_user')) || JSON.parse(sessionStorage.getItem('mvd_staff_user')) || null; }
    catch (e) { return null; }
  });
  const [authLoginUsername, setAuthLoginUsername] = useState('');
  const [authLoginPassword, setAuthLoginPassword] = useState('');
  const [authLoginError, setAuthLoginError] = useState('');
  const [authLoginLoading, setAuthLoginLoading] = useState(false);

  // Dedicated Route Navigation (Each Role has its own route)
  const [currentPath, setCurrentPath] = useState(() => {
    let p = window.location.pathname;
    if (p.startsWith('/app')) p = p.replace('/app', '') || '/';
    return p || '/';
  });
  const [staffSubTab, setStaffSubTab] = useState('book');

  const navigate = (path) => {
    let target = path.startsWith('/') ? path : '/' + path;
    const fullPath = window.location.pathname.startsWith('/app') ? '/app' + target : target;
    window.history.pushState(null, '', fullPath);
    setCurrentPath(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getRoleDefaultPath = (role) => {
    if (role === 'SuperAdmin') return '/admin/dashboard';
    if (role === 'TTE') return '/tt/home';
    if (role === 'BookingClerk') return '/counter/booking';
    if (role === 'AccountsOfficer' || role === 'FinanceOfficer') return '/finance/ledger';
    if (role === 'StationMaster') return '/station/chart';
    return '/admin/dashboard';
  };

  useEffect(() => {
    const handlePopState = () => {
      let p = window.location.pathname;
      if (p.startsWith('/app')) p = p.replace('/app', '') || '/';
      setCurrentPath(p || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Daily Date-wise Collection State (Personal & Staff Breakdown)
  const [dailyFilterDate, setDailyFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateRangeStartDate, setDateRangeStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of month
    return d.toISOString().slice(0, 10);
  });
  const [dateRangeEndDate, setDateRangeEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFilterPreset, setDateFilterPreset] = useState('today');
  const [dailyReportData, setDailyReportData] = useState(null);
  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyStaffFilter, setDailyStaffFilter] = useState('');

  // Project & UPI Settings State (SuperAdmin Dynamic Configuration)
  const [projectSettings, setProjectSettings] = useState({
    upiId: '7398959993@okbizaxis',
    upiPayeeName: 'à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ',
    merchantCode: 'MVD2026',
    defaultAdvance: 1000,
    fareSleeper: 3000,
    fareAC: 4000,
    fareGeneral: 2000,
    defaultTravelDate: '2026-10-15',
    journeyDate: '2026-10-15',
    returnTravelDate: '2026-10-22',
    helplineNumber: '+91 7398959993',
    officialEmail: 'infomatavaishnodevi@gmail.com',
    officeAddress: 'Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India',
    sacredShlok: 'à¤œà¤¯ à¤®à¤¾à¤¤à¤¾ à¤¦à¥€ â€¢ à¥ à¤¶à¥à¤°à¥€ à¤µà¥ˆà¤·à¥à¤£à¤µà¥€ à¤¨à¤®à¤ƒ â€¢ à¤¨à¤¿à¤·à¥à¤•à¤¾à¤® à¤¸à¥‡à¤µà¤¾'
  });
  const [projectSettingsLoading, setProjectSettingsLoading] = useState(false);
  const [projectSettingsSaving, setProjectSettingsSaving] = useState(false);
  const [projectSettingsSuccess, setProjectSettingsSuccess] = useState('');
  const [projectSettingsError, setProjectSettingsError] = useState('');

  // Fetch live system configuration on initial mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          if (data.settings) {
            setProjectSettings(prev => ({
              ...prev,
              ...data.settings,
              defaultTravelDate: data.defaultTravelDate || data.settings.defaultTravelDate || '2026-10-15',
              journeyDate: data.defaultTravelDate || data.settings.journeyDate || '2026-10-15',
              returnTravelDate: data.returnTravelDate || data.settings.returnTravelDate || '2026-10-22'
            }));
          }
          if (data.stations && data.stations.length > 0) {
            setStationsList(data.stations);
          }
          if (data.defaultTravelDate || data.journeyDate) {
            setTravelDate(data.defaultTravelDate || data.journeyDate);
          }
        }
      })
      .catch(err => {
        console.warn('Config fetch notice:', err.message);
      });
  }, []);

  useEffect(() => {
    if (projectSettings?.defaultTravelDate) {
      setTravelDate(projectSettings.defaultTravelDate);
    }
  }, [projectSettings?.defaultTravelDate]);

  // Live Sacred Yatra Departure Countdown State (Days, Hours, Minutes, Seconds)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const travelDateStr = projectSettings?.journeyDate || projectSettings?.defaultTravelDate || '2026-10-15';
    const targetTime = new Date(`${travelDateStr}T06:00:00+05:30`).getTime();

    const calcCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown({ days, hours, minutes, seconds });
    };

    calcCountdown();
    const timer = setInterval(calcCountdown, 1000);
    return () => clearInterval(timer);
  }, [projectSettings?.journeyDate, projectSettings?.defaultTravelDate]);

  // Online Transactions & UTR Matching Desk State
  const [onlineTxnsList, setOnlineTxnsList] = useState([]);
  const [onlineTxnsLoading, setOnlineTxnsLoading] = useState(false);
  const [onlineTxnsStatusFilter, setOnlineTxnsStatusFilter] = useState('All');
  const [onlineTxnsSearch, setOnlineTxnsSearch] = useState('');
  const [onlineTxnsSummary, setOnlineTxnsSummary] = useState({ total: 0, verified: 0, pending: 0, rejected: 0, totalAmount: 0 });
  const [verifierTab, setVerifierTab] = useState('utr_desk'); // 'utr_desk' | 'ticket_scanner'
  const [editUtrModal, setEditUtrModal] = useState(null); // { show, txn, newUtr, status, remarks }

  // Public PNR Verification State
  const [searchedTicket, setSearchedTicket] = useState(null);
  const [pnrSearchError, setPnrSearchError] = useState('');
  const [pnrLoading, setPnrLoading] = useState(false);

  // Admin Bookings & Reports State
  const [adminStats, setAdminStats] = useState(null);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminYearFilter, setAdminYearFilter] = useState('2026');
  const [adminSearch, setAdminSearch] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkYear, setBulkYear] = useState('2026');
  const [bulkMessage, setBulkMessage] = useState('');
  const [showNoFreeTicketPopup, setShowNoFreeTicketPopup] = useState(false);

  // Coach & Seating Chart State
  const [chartCoach, setChartCoach] = useState('S1');
  const [chartYear, setChartYear] = useState('2026');
  const [coachChartData, setCoachChartData] = useState(null);
  const [chartFilter, setChartFilter] = useState('all');
  const [chartSearch, setChartSearch] = useState('');
  const [chartLoading, setChartLoading] = useState(false);

  // Dynamic Train Composition & Coach Position State
  const [trainCompositionData, setTrainCompositionData] = useState(null);
  const [trainCompositionLoading, setTrainCompositionLoading] = useState(false);
  const [compositionYearFilter, setCompositionYearFilter] = useState('2026');
  const [selectedCoachForPosition, setSelectedCoachForPosition] = useState(null);
  const [adminCoachesList, setAdminCoachesList] = useState([]);
  const [adminCoachesLoading, setAdminCoachesLoading] = useState(false);
  const [newCoachModal, setNewCoachModal] = useState(false);
  const [editCoachModal, setEditCoachModal] = useState(false);
  const [editCoachForm, setEditCoachForm] = useState({
    id: '',
    coachCode: '',
    coachName: '',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier',
    position: 1,
    positionSequence: 1,
    totalSeats: 72,
    capacity: 72,
    fare: 3000,
    baseFare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'Center',
    platformPlacement: 'Center',
    facilities: '',
    notes: '',
    description: ''
  });

  // Ticket Cancellation & Refund Modal State
  const [cancelModal, setCancelModal] = useState(null); // { show: true, booking, refundAmount, cancellationCharges, cancellationReason, refundMode, utr }
  const [userGuideTab, setUserGuideTab] = useState('admin'); // 'admin' | 'clerk' | 'tte' | 'accounts' | 'refund_rules'
  const [coachFilterClass, setCoachFilterClass] = useState('all');
  const [coachSearchQuery, setCoachSearchQuery] = useState('');
  const [newCoachForm, setNewCoachForm] = useState({
    coachCode: '',
    coachName: '',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (à¤¶à¤¯à¤¨à¤¯à¤¾à¤¨)',
    position: '',
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'à¤Ÿà¥à¤°à¥‡à¤¨ à¤•à¤¾ à¤®à¤§à¥à¤¯ à¤­à¤¾à¤— (Center Platform)',
    facilities: '72 à¤¶à¤¯à¤¨ à¤¬à¤°à¥à¤¥, à¤ªà¤‚à¤–à¤¾ à¤µ à¤šà¤¾à¤°à¥à¤œà¤¿à¤‚à¤— à¤¸à¥‰à¤•à¥‡à¤Ÿ, à¤¬à¤¾à¤¯à¥‹-à¤Ÿà¥‰à¤¯à¤²à¥‡à¤Ÿ',
    description: ''
  });

  // Staff & Anti-Fraud State
  const [staffList, setStaffList] = useState([]);
  const [staffRoles, setStaffRoles] = useState({});
  const [staffDepartments, setStaffDepartments] = useState([]);
  const [auditLogsList, setAuditLogsList] = useState([]);

  // Settings & Edit Payment State
  const [settingsOldPass, setSettingsOldPass] = useState('');
  const [settingsNewPass, setSettingsNewPass] = useState('');
  const [settingsConfirmPass, setSettingsConfirmPass] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const [paymentEditModal, setPaymentEditModal] = useState(null);
  const [paymentEditData, setPaymentEditData] = useState({});
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [reconcileData, setReconcileData] = useState(null);
  const [newStaffModal, setNewStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    department: 'Trust Executive (à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨)',
    role: 'SuperAdmin',
    mobile: '',
    assignedCoach: '',
    assignedCoaches: [],
    assignedStation: 'All Stations'
  });

  // Staff Login Options (Firebase Phone OTP & Google Sign-In)
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'phone' | 'google'
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpSentNotice, setOtpSentNotice] = useState(false);

  // Anti-Fraud Slip Verifier State
  const [verifierPnr, setVerifierPnr] = useState('');
  const [verifierSec, setVerifierSec] = useState('');
  const [verifierResult, setVerifierResult] = useState(null);
  const [verifierLoading, setVerifierLoading] = useState(false);

  // Permission helper variables
  const isSuperAdmin = staffUser?.role === 'SuperAdmin';
  const canBook = isSuperAdmin || (staffUser?.permissions && staffUser.permissions.includes('create_booking'));
  const canCheckIn = isSuperAdmin || (staffUser?.permissions && staffUser.permissions.includes('checkin'));
  const canViewChart = isSuperAdmin || (staffUser?.permissions && staffUser.permissions.includes('view_chart'));
  const canReconcile = isSuperAdmin || (staffUser?.permissions && staffUser.permissions.includes('financial_reconcile'));
  const canManageStaff = isSuperAdmin || (staffUser?.permissions && staffUser.permissions.includes('staff_manage'));
  const canViewAudit = isSuperAdmin || (staffUser?.permissions && staffUser.permissions.includes('audit_view'));

  // Real-time Firestore Listener
  useEffect(() => {
    try {
      const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const liveList = [];
        snapshot.forEach((doc) => {
          liveList.push({ ...doc.data(), id: doc.id });
        });
        if (liveList.length > 0) {
          setAdminBookings(liveList);
        }
      }, (err) => {
        console.warn('Firestore live listener notice:', err.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore setup notice:', e);
    }
  }, []);

  // Verify staff token on mount - Keeps user logged in across reloads
  useEffect(() => {
    if (staffToken) {
      fetch(`/api/auth/me?token=${staffToken}`, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      })
      .then(async (res) => {
        const data = await res.json();
        if (data.success && data.user) {
          setStaffUser(data.user);
          localStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
          sessionStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        } else if (res.status === 401 || res.status === 403 || data.error?.includes('à¤¸à¥à¤°à¤•à¥à¤·à¤¾') || data.error?.includes('à¤…à¤®à¤¾à¤¨à¥à¤¯')) {
          handleStaffLogout();
        }
      })
      .catch((err) => {
        console.warn('Network offline or backend reconnecting, maintaining local staff session:', err.message);
      });
    }
  }, []);

  useEffect(() => {
    if (staffUser && staffSubTab === 'book') {
      loadCoachSeats(coachName, bookingYear);
    }
  }, [coachName, bookingYear, staffSubTab, staffUser]);

  useEffect(() => {
    const list = COACHES[travelClass] || COACHES.Sleeper;
    setCoachName(list[0]);
    setSelectedSeats([]);
  }, [travelClass]);

  useEffect(() => {
    // Load train composition for both public & logged in users
    if (currentPath === '/' || currentPath === '/home' || currentPath === '/coach-position' || currentPath === '/train-composition' || currentPath === '/admin/coaches') {
      loadTrainComposition(compositionYearFilter);
    }

    if (staffUser) {
      const p = currentPath;
      if (p === '/admin/dashboard' || p === '/admin/bookings' || p === '/counter/history' || p === '/finance/bookings') {
        loadAdminDashboard();
      }
      if (p === '/admin/staff') {
        loadStaffData();
      }
      if (p === '/admin/coaches') {
        loadAdminCoaches();
      }
      if (p === '/admin/audit') {
        loadAuditLogs();
      }
      if (p === '/admin/reconcile' || p === '/finance/ledger') {
        loadReconciliation();
        loadDailyReport(dailyFilterDate, dailyStaffFilter);
      }
      if (p === '/tt/collections' || p === '/counter/collections') {
        loadDailyReport(dailyFilterDate, staffUser.username);
      }
      if (p === '/admin/chart' || p === '/tt/chart' || p === '/tt/home' || p === '/admin/checkin' || p === '/admin/tte-checkin' || p === '/counter/chart' || p === '/station/chart') {
        loadCoachChart(chartCoach, chartYear);
      }
      if (p === '/admin/booking' || p === '/counter/booking') {
        loadCoachSeats(coachName, bookingYear);
      }
      if (p === '/admin/settings' || p === '/counter/settings' || p === '/tt/settings' || p === '/finance/settings' || p === '/station/settings') {
        loadProjectSettings();
      }
    }
  }, [currentPath, staffUser, adminYearFilter, chartCoach, chartYear, coachName, bookingYear, dailyFilterDate, compositionYearFilter]);

  const loadCoachSeats = async (coach, year) => {
    try {
      const res = await fetch(`/api/coaches/${coach}/layout?year=${year}${staffToken ? `&token=${staffToken}` : ''}`, {
        headers: staffToken ? { 'Authorization': 'Bearer ' + staffToken } : {}
      });
      const data = await res.json();
      if (data.success) {
        setCoachLayout(data);
      }
    } catch (err) {
      console.error('Error loading coach layout:', err);
    }
  };

  const loadTrainComposition = async (year = compositionYearFilter) => {
    setTrainCompositionLoading(true);
    try {
      const res = await fetch(`/api/coaches/train-composition?year=${year}`);
      const data = await res.json();
      if (data.success) {
        setTrainCompositionData(data);
        if (data.coaches && data.coaches.length > 0) {
          setSelectedCoachForPosition(prev => {
            if (prev) {
              const matched = data.coaches.find(c => c.coachCode === prev.coachCode);
              return matched || prev;
            }
            const firstBookable = data.coaches.find(c => c.isBookable) || data.coaches[0];
            return firstBookable;
          });
        }
      }
    } catch (err) {
      console.error('Error loading train composition:', err);
    } finally {
      setTrainCompositionLoading(false);
    }
  };

  const loadAdminCoaches = async () => {
    const token = staffToken || localStorage.getItem('mvd_staff_token') || 'mvd_admin_token';
    setAdminCoachesLoading(true);
    try {
      const res = await fetch(`/api/admin/coaches?token=${token}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success && data.coaches && data.coaches.length > 0) {
        setAdminCoachesList(data.coaches);
      } else {
        // Auto reset if empty
        const resetRes = await fetch(`/api/admin/coaches/reset-default?token=${token}`, { method: 'POST' });
        const resetData = await resetRes.json();
        if (resetData.success) {
          const r2 = await fetch(`/api/admin/coaches?token=${token}`);
          const d2 = await r2.json();
          if (d2.coaches) setAdminCoachesList(d2.coaches);
        }
      }
    } catch (err) {
      console.error('Error loading admin coaches:', err);
    } finally {
      setAdminCoachesLoading(false);
    }
  };

  const handleCreateCoach = async (e) => {
    e.preventDefault();
    if (!newCoachForm.coachCode || !newCoachForm.coachName) {
      alert('à¤•à¥ƒà¤ªà¤¯à¤¾ à¤•à¥‹à¤š à¤•à¥‹à¤¡ à¤”à¤° à¤¨à¤¾à¤® à¤­à¤°à¥‡à¤‚à¥¤');
      return;
    }
    const token = staffToken || localStorage.getItem('mvd_staff_token') || 'mvd_admin_token';
    try {
      const res = await fetch(`/api/admin/coaches?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          ...newCoachForm,
          position: newCoachForm.position || (adminCoachesList.length + 1),
          totalSeats: Number(newCoachForm.totalSeats || 72),
          fare: Number(newCoachForm.fare || 3000)
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'à¤¨à¤¯à¤¾ à¤•à¥‹à¤š à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤œà¥‹à¤¡à¤¼à¤¾ à¤—à¤¯à¤¾à¥¤');
        setNewCoachModal(false);
        setNewCoachForm({
          coachCode: '',
          coachName: '',
          coachClass: 'Sleeper',
          detailedType: 'Sleeper 3-Tier (à¤¶à¤¯à¤¨à¤¯à¤¾à¤¨)',
          position: '',
          totalSeats: 72,
          fare: 3000,
          status: 'Active',
          isBookable: true,
          platformPosition: 'à¤Ÿà¥à¤°à¥‡à¤¨ à¤•à¤¾ à¤®à¤§à¥à¤¯ à¤­à¤¾à¤— (Center Platform)',
          facilities: '72 à¤¶à¤¯à¤¨ à¤¬à¤°à¥à¤¥, à¤ªà¤‚à¤–à¤¾ à¤µ à¤šà¤¾à¤°à¥à¤œà¤¿à¤‚à¤— à¤¸à¥‰à¤•à¥‡à¤Ÿ, à¤¬à¤¾à¤¯à¥‹-à¤Ÿà¥‰à¤¯à¤²à¥‡à¤Ÿ',
          description: ''
        });
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleUpdateCoach = async (e) => {
    e.preventDefault();
    if (!editCoachForm || !editCoachForm.id) return;
    const token = staffToken || localStorage.getItem('mvd_staff_token') || 'mvd_admin_token';
    try {
      const payload = {
        coachCode: editCoachForm.coachCode,
        coachName: editCoachForm.coachName,
        coachClass: editCoachForm.coachClass,
        detailedType: editCoachForm.detailedType,
        position: Number(editCoachForm.position || editCoachForm.positionSequence || 1),
        totalSeats: Number(editCoachForm.totalSeats || editCoachForm.capacity || 72),
        fare: Number(editCoachForm.fare || editCoachForm.baseFare || 3000),
        status: editCoachForm.status || 'Active',
        isBookable: editCoachForm.isBookable !== undefined ? editCoachForm.isBookable : true,
        platformPosition: editCoachForm.platformPosition || editCoachForm.platformPlacement || 'Center',
        description: editCoachForm.description || editCoachForm.notes || ''
      };
      const res = await fetch(`/api/admin/coaches/${editCoachForm.id}?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'à¤•à¥‹à¤š à¤µà¤¿à¤µà¤°à¤£ à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾à¥¤');
        setEditCoachModal(false);
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  // Ticket Cancellation & Refund Handler
  const handleCancelTicket = async (e) => {
    e.preventDefault();
    if (!cancelModal?.booking) return;
    const b = cancelModal.booking;
    const refAmt = parseFloat(cancelModal.refundAmount) || 0;
    const charges = parseFloat(cancelModal.cancellationCharges) || 0;
    
    if (!confirm(`à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤¨à¤¿à¤¶à¥à¤šà¤¿à¤¤ à¤¹à¥ˆà¤‚ à¤•à¤¿ PNR ${b.bookingId} (${b.bookedBy}) à¤•à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤•à¤°à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?\n\nà¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿: â‚¹${refAmt}\nà¤•à¤Ÿà¥Œà¤¤à¥€ à¤¶à¥à¤²à¥à¤•: â‚¹${charges}\nà¤®à¤¾à¤§à¥à¤¯à¤®: ${cancelModal.refundMode}\n\nà¤¸à¥€à¤Ÿà¥‡à¤‚ à¤¤à¥à¤°à¤‚à¤¤ à¤®à¥à¤•à¥à¤¤ à¤•à¤° à¤¦à¥€ à¤œà¤¾à¤à¤‚à¤—à¥€à¥¤`)) {
      return;
    }

    const token = staffToken || localStorage.getItem('mvd_staff_token') || 'mvd_admin_token';
    try {
      const res = await fetch(`/api/bookings/${b.bookingId}/cancel?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          refundAmount: refAmt,
          cancellationCharges: charges,
          cancellationReason: cancelModal.cancellationReason || 'à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¥‡ à¤…à¤¨à¥à¤°à¥‹à¤§ à¤ªà¤° à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£',
          refundMode: cancelModal.refundMode || 'Cash',
          utr: cancelModal.utr || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤°à¤¦à¥à¤¦ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤à¤µà¤‚ à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤¦à¤°à¥à¤œ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾à¥¤');
        setCancelModal(null);
        loadAdminDashboard();
        loadDashboardStats();
        loadCoachLayout(coachName, bookingYear);
        loadTrainComposition(compositionYearFilter);
        loadDailyReport(dailyFilterDate);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleDeleteCoach = async (id, code) => {
    if (!confirm(`à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤•à¥‹à¤š ${code} à¤•à¥‹ à¤Ÿà¥à¤°à¥‡à¤¨ à¤¸à¤‚à¤°à¤šà¤¨à¤¾ à¤¸à¥‡ à¤¹à¤Ÿà¤¾à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?`)) return;
    try {
      const res = await fetch(`/api/admin/coaches/${id}?token=${staffToken}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        alert('à¤•à¥‹à¤š à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤¹à¤Ÿà¤¾ à¤¦à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾à¥¤');
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleMoveCoachPosition = async (currentIndex, direction) => {
    const list = [...adminCoachesList];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    setAdminCoachesList(list);
    try {
      const orderedIds = list.map(c => c.id);
      await fetch(`/api/admin/coaches/reorder?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({ orderedIds })
      });
      loadAdminCoaches();
      loadTrainComposition(compositionYearFilter);
    } catch (err) {
      console.error('Reorder error:', err);
    }
  };

  const handleResetDefaultRake = async () => {
    if (!confirm('à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤Ÿà¥à¤°à¥‡à¤¨ à¤¸à¤‚à¤°à¤šà¤¨à¤¾ à¤•à¥‹ à¤®à¤¾à¤¨à¤• 18-à¤¬à¥‹à¤—à¥€ à¤ªà¥à¤°à¤¾à¤°à¥‚à¤ª (Default Rake) à¤ªà¤° à¤°à¥€à¤¸à¥‡à¤Ÿ à¤•à¤°à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?')) return;
    const token = staffToken || localStorage.getItem('mvd_staff_token') || 'mvd_admin_token';
    try {
      const res = await fetch(`/api/admin/coaches/reset-default?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'à¤Ÿà¥à¤°à¥‡à¤¨ à¤¸à¤‚à¤°à¤šà¤¨à¤¾ à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤®à¤¾à¤¨à¤• 18-à¤¬à¥‹à¤—à¥€ à¤ªà¥à¤°à¤¾à¤°à¥‚à¤ª à¤ªà¤° à¤°à¥€à¤¸à¥‡à¤Ÿ à¤¹à¥‹ à¤—à¤ˆà¥¤');
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const getBerthType = (seatNum, coachClass = travelClass) => {
    const num = parseInt(seatNum, 10);
    if (isNaN(num) || num <= 0) return 'Berth';
    if (coachClass === 'AC' || coachClass === '2A') {
      const rem = num % 6;
      if (rem === 1 || rem === 3) return 'Lower Berth (LB)';
      if (rem === 2 || rem === 4) return 'Upper Berth (UB)';
      if (rem === 5) return 'Side Lower (SL)';
      return 'Side Upper (SU)';
    } else {
      // Sleeper & 3AC
      const rem = num % 8;
      if (rem === 1 || rem === 4) return 'Lower Berth (LB)';
      if (rem === 2 || rem === 5) return 'Middle Berth (MB)';
      if (rem === 3 || rem === 6) return 'Upper Berth (UB)';
      if (rem === 7) return 'Side Lower (SL)';
      return 'Side Upper (SU)';
    }
  };

  const handleSeatClick = (seatNum, isBooked) => {
    if (isBooked) return;
    toggleSeatSelection(seatNum);
  };

  const handlePassengerChange = (index, field, value) => {
    handlePaxChange(index, field, value);
  };

  const handleAutoAssignSeats = () => {
    const available = (coachLayout.layout || []).filter(s => !s.isBooked).map(s => String(s.seatNumber));
    if (available.length === 0) {
      alert(`à¤•à¥‹à¤š ${coachName} à¤®à¥‡à¤‚ à¤•à¥‹à¤ˆ à¤­à¥€ à¤¸à¥€à¤Ÿ à¤°à¤¿à¤•à¥à¤¤ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ! à¤•à¥ƒà¤ªà¤¯à¤¾ à¤…à¤¨à¥à¤¯ à¤•à¥‹à¤š à¤šà¥à¤¨à¥‡à¤‚à¥¤`);
      return;
    }
    const needed = Math.max(1, passengers.length);
    const chosen = available.slice(0, needed);
    setSelectedSeats(chosen);

    let newPax = passengers.map((p, idx) => {
      const assigned = chosen[idx] || (idx + 1).toString();
      return {
        ...p,
        seatAssigned: assigned,
        berthPreference: p.berthPreference || getBerthType(assigned, travelClass).split(' ')[0]
      };
    });
    setPassengers(newPax);
  };

  const toggleSeatSelection = (seatNum) => {
    const str = String(seatNum);
    let updated;
    if (selectedSeats.includes(str)) {
      updated = selectedSeats.filter(s => s !== str);
    } else {
      updated = [...selectedSeats, str];
    }
    setSelectedSeats(updated);

    const targetCount = Math.max(1, updated.length);
    let newPax = [...passengers];
    while (newPax.length < targetCount) {
      newPax.push({ name: '', age: '', gender: 'Male', aadhar: '', seatAssigned: '', berthPreference: 'Lower' });
    }
    if (newPax.length > targetCount && updated.length > 0) {
      newPax = newPax.slice(0, targetCount);
    }

    newPax = newPax.map((p, idx) => {
      const seat = updated[idx] || `${idx + 1}`;
      return {
        ...p,
        seatAssigned: seat,
        berthPreference: p.berthPreference || getBerthType(seat, travelClass).split(' ')[0]
      };
    });

    setPassengers(newPax);
  };

  // Synchronize Lead Devotee info to Passenger 1 if autofill checkbox is active
  const handleBookedByChange = (val) => {
    setBookedBy(val);
    if (sameAsLeadDevotee) {
      setPassengers(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0] = { ...updated[0], name: val };
        }
        return updated;
      });
    }
  };

  const handleLeadAadharChange = (val) => {
    setAadhar(val);
    if (sameAsLeadDevotee) {
      setPassengers(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0] = { ...updated[0], aadhar: val };
        }
        return updated;
      });
    }
  };

  const handleSameAsLeadToggle = (checked) => {
    setSameAsLeadDevotee(checked);
    if (checked) {
      setPassengers(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0] = {
            ...updated[0],
            name: bookedBy || updated[0].name,
            aadhar: aadhar || updated[0].aadhar
          };
        }
        return updated;
      });
    }
  };

  const handlePaxChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = value;
    setPassengers(updated);
    if (index === 0 && field === 'name' && sameAsLeadDevotee && value !== bookedBy) {
      setSameAsLeadDevotee(false);
    }
  };

  const addPassenger = () => {
    const available = (coachLayout.layout || [])
      .filter(s => !s.isBooked && !selectedSeats.includes(String(s.seatNumber)))
      .map(s => String(s.seatNumber));
    const nextSeat = available[0] || `${passengers.length + 1}`;
    const newSelected = [...selectedSeats, nextSeat];
    setSelectedSeats(newSelected);
    setPassengers([
      ...passengers,
      {
        name: '',
        age: '',
        gender: 'Male',
        aadhar: '',
        seatAssigned: nextSeat,
        berthPreference: getBerthType(nextSeat, travelClass).split(' ')[0]
      }
    ]);
  };

  const removePassenger = (index) => {
    if (passengers.length <= 1) return;
    const removedSeat = String(passengers[index]?.seatAssigned);
    const newPax = passengers.filter((_, i) => i !== index);
    const newSelected = selectedSeats.filter(s => s !== removedSeat);
    setSelectedSeats(newSelected);
    setPassengers(newPax);
  };

  const unitFare = FARES[travelClass] || 3000;
  const grossAmount = unitFare * passengers.length;
  const netPayable = Math.max(0, grossAmount - Number(discount || 0));
  const remainingDue = Math.max(0, netPayable - Number(advancePayment || 0));

  useEffect(() => {
    setAdvancePayment(netPayable);
  }, [netPayable]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookedBy || !mobile) {
      alert('à¤•à¥ƒà¤ªà¤¯à¤¾ à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ à¤•à¤¾ à¤¨à¤¾à¤® à¤”à¤° à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤­à¤°à¥‡à¤‚à¥¤');
      return;
    }
    setIsSubmitting(true);

    try {
      const payload = {
        yatraYear: parseInt(bookingYear, 10),
        travelDate,
        fromStation,
        toStation: 'Shri Mata Vaishno Devi Katra (SVDK)',
        travelClass,
        coachName,
        seatNumber: selectedSeats.length > 0 ? selectedSeats : passengers.map(p => p.seatAssigned),
        bookedBy,
        mobile,
        aadhar,
        email,
        advancePayment: Number(advancePayment),
        discount: Number(discount),
        passengers
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(staffToken ? { 'Authorization': 'Bearer ' + staffToken } : {})
        },
        body: JSON.stringify({
          ...payload,
          bookedByStaff: staffUser ? { name: staffUser.name, role: staffUser.role, username: staffUser.username } : undefined
        })
      });
      const data = await res.json();

      if (data.success) {
        setTicketModal(data.booking);
        
        const initialTxn = (data.booking.paymentHistory && data.booking.paymentHistory.length > 0)
          ? data.booking.paymentHistory[0]
          : ((data.booking.transactions && data.booking.transactions.length > 0) 
            ? data.booking.transactions[0] 
            : { id: `R${data.booking.yatraYear || '2026'}000001`, amount: data.booking.advance || 0, method: data.booking.paymentMode || 'Cash', date: new Date().toISOString() });
        setReceiptModal({ booking: data.booking, txn: initialTxn });

        setSelectedSeats([]);
        setBookedBy('');
        setMobile('');
        setAadhar('');
        setSameAsLeadDevotee(false);
        setPassengers([{ name: '', age: '', gender: 'Male', aadhar: '', seatAssigned: '1' }]);
        
        // Fast counter workflow: immediately trigger print dialog
        setTimeout(() => {
          printSlipElement('irctc-ticket-print-area', `IRCTC-Ticket-${data.booking.bookingId}`);
          
          setTimeout(() => {
             printSlipElement('mandir-receipt-print-area', `MVD-Receipt-${data.booking.bookingId}`);
          }, 1500);
        }, 500);
      } else {
        alert('à¤¬à¥à¤•à¤¿à¤‚à¤— à¤µà¤¿à¤«à¤²: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const safeFetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      if (!res.ok) {
        throw new Error(`à¤¸à¤°à¥à¤µà¤° à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (${res.status}): ${text.slice(0, 100)}`);
      }
      throw new Error('à¤…à¤®à¤¾à¤¨à¥à¤¯ à¤¸à¤°à¥à¤µà¤° à¤ªà¥à¤°à¤¤à¤¿à¤•à¥à¤°à¤¿à¤¯à¤¾');
    }
  };

  const searchPNR = async (queryTerm) => {
    const term = (queryTerm !== undefined ? queryTerm : pnrInput).trim();
    if (!term) {
      setPnrSearchError('à¤•à¥ƒà¤ªà¤¯à¤¾ PNR à¤¨à¤‚à¤¬à¤° à¤…à¤¥à¤µà¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤');
      return;
    }
    setPnrLoading(true);
    setPnrSearchError('');
    try {
      const data = await safeFetchJson(`/api/bookings/pnr/${encodeURIComponent(term)}`);
      if (data.success && data.booking) {
        setSearchedTicket(data.booking);
        setTicketModal(data.booking);
      } else {
        setSearchedTicket(null);
        setPnrSearchError(data.error || 'à¤‡à¤¸ PNR / à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¸à¥‡ à¤•à¥‹à¤ˆ à¤µà¥ˆà¤§ à¤†à¤°à¤•à¥à¤·à¤£ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾à¥¤');
      }
    } catch (err) {
      setPnrSearchError('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    } finally {
      setPnrLoading(false);
    }
  };

  const openUpiQR = async (bookingId) => {
    try {
      const data = await safeFetchJson(`/api/bookings/${bookingId}/upi-qr?type=remaining`);
      if (data.success) {
        setUpiQrModal(data);
      }
    } catch (err) {
      alert('UPI QR à¤²à¥‹à¤¡ à¤¨à¤¹à¥€à¤‚ à¤¹à¥‹ à¤¸à¤•à¤¾: ' + err.message);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setAuthLoginLoading(true);
    setAuthLoginError('');
    try {
      const data = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authLoginUsername,
          username: authLoginUsername,
          identifier: authLoginUsername,
          password: authLoginPassword
        })
      });
      if (data.success) {
        setStaffToken(data.token);
        setStaffUser(data.user);
        localStorage.setItem('mvd_staff_token', data.token);
        localStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        sessionStorage.setItem('mvd_staff_token', data.token);
        sessionStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        setAuthLoginUsername('');
        setAuthLoginPassword('');
        const targetRoute = getRoleDefaultPath(data.user.role);
        navigate(targetRoute);
      } else {
        setAuthLoginError(data.error || 'à¤…à¤®à¤¾à¤¨à¥à¤¯ à¤ˆà¤®à¥‡à¤² à¤†à¤ˆà¤¡à¥€ / à¤¯à¥‚à¤œà¤°à¤¨à¥‡à¤® à¤¯à¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡à¥¤');
      }
    } catch (err) {
      setAuthLoginError('à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¤°à¤£ à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    } finally {
      setAuthLoginLoading(false);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    if (!otpSentNotice) {
      if (!loginPhone || loginPhone.length < 10) {
        setAuthLoginError('à¤•à¥ƒà¤ªà¤¯à¤¾ 10 à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¤¾ à¤®à¤¾à¤¨à¥à¤¯ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤');
        return;
      }
      setOtpSentNotice(true);
      setAuthLoginError('');
      setLoginOtp('123456'); // demo prefilled OTP
      return;
    }
    // Verify OTP
    if (loginOtp !== '123456') {
      setAuthLoginError('à¤…à¤®à¤¾à¤¨à¥à¤¯ OTP à¤•à¥‹à¤¡! à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¸à¤¹à¥€ OTP (123456) à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤');
      return;
    }
    setAuthLoginLoading(true);
    setAuthLoginError('');
    try {
      const data = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin@mvd2026' })
      });
      if (data.success) {
        setStaffToken(data.token);
        setStaffUser(data.user);
        localStorage.setItem('mvd_staff_token', data.token);
        localStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        sessionStorage.setItem('mvd_staff_token', data.token);
        sessionStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        setOtpSentNotice(false);
        const targetRoute = getRoleDefaultPath(data.user.role);
        navigate(targetRoute);
      } else {
        setAuthLoginError(data.error);
      }
    } catch (err) {
      setAuthLoginError('à¤²à¥‰à¤—à¤¿à¤¨ à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    } finally {
      setAuthLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoginLoading(true);
    setAuthLoginError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const data = await safeFetchJson('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.displayName || user.email,
          photoUrl: user.photoURL || '',
          idToken
        })
      });

      if (data && data.success && data.token && data.user) {
        setStaffToken(data.token);
        setStaffUser(data.user);
        localStorage.setItem('mvd_staff_token', data.token);
        localStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        sessionStorage.setItem('mvd_staff_token', data.token);
        sessionStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        const targetRoute = getRoleDefaultPath(data.user.role);
        navigate(targetRoute);
      } else {
        // Immediately revoke and sign out unauthorized Google account
        setStaffToken('');
        setStaffUser(null);
        localStorage.removeItem('mvd_staff_token');
        localStorage.removeItem('mvd_staff_user');
        sessionStorage.removeItem('mvd_staff_token');
        sessionStorage.removeItem('mvd_staff_user');
        try { await signOut(auth); } catch (_) {}
        setAuthLoginError(data?.error || `à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤à¤¿: Google à¤–à¤¾à¤¤à¤¾ '${user.email}' à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤ à¤•à¥‡à¤µà¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤ªà¤‚à¤œà¥€à¤•à¥ƒà¤¤ à¤à¤¡à¤®à¤¿à¤¨ à¤µ à¤¸à¥à¤Ÿà¤¾à¤« à¤ˆà¤®à¥‡à¤² à¤¹à¥€ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤° à¤¸à¤•à¤¤à¥‡ à¤¹à¥ˆà¤‚à¥¤`);
      }
    } catch (err) {
      try { await signOut(auth); } catch (_) {}
      if (err.code === 'auth/unauthorized-domain') {
        setAuthLoginError('à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥‚à¤šà¤¨à¤¾: Vercel à¤¡à¥‹à¤®à¥‡à¤¨ à¤•à¥‹ Firebase Authentication Console (Authorized Domains) à¤®à¥‡à¤‚ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚, à¤¯à¤¾ "à¤†à¤ˆà¤¡à¥€ / à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡" à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¥‡à¤‚à¥¤');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setAuthLoginError('à¤—à¥‚à¤—à¤² à¤²à¥‰à¤—à¤¿à¤¨ à¤µà¤¿à¤‚à¤¡à¥‹ à¤¬à¤‚à¤¦ à¤•à¤° à¤¦à¥€ à¤—à¤ˆà¥¤');
      } else {
        setAuthLoginError(err.message || 'à¤—à¥‚à¤—à¤² à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¤°à¤£ à¤µà¤¿à¤«à¤² à¤°à¤¹à¤¾à¥¤ à¤•à¥‡à¤µà¤² à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤ˆà¤®à¥‡à¤² à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¥‡à¤‚à¥¤');
      }
    } finally {
      setAuthLoginLoading(false);
    }
  };

  const handleVerifyTicketSubmit = async (pnrToVerify, secToVerify) => {
    const targetPnr = (pnrToVerify || verifierPnr || '').trim();
    const targetSec = (secToVerify !== undefined ? secToVerify : verifierSec || '').trim();
    if (!targetPnr) return;
    setVerifierLoading(true);
    setVerifierResult(null);
    try {
      const q = `/api/verify-slip?pnr=${encodeURIComponent(targetPnr)}${targetSec ? '&sec=' + encodeURIComponent(targetSec) : ''}`;
      const res = await fetch(q);
      const data = await res.json();
      setVerifierResult(data);
    } catch (err) {
      setVerifierResult({ success: false, status: 'ERROR', message: 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message });
    } finally {
      setVerifierLoading(false);
    }
  };

  const loadDailyReport = async (targetDate = dailyFilterDate, targetStaff = dailyStaffFilter, startParam = null, endParam = null) => {
    if (!staffToken) return;
    setDailyReportLoading(true);
    try {
      let q = `/api/staff/daily-collection?token=${staffToken}`;
      if (startParam && endParam) {
        q += `&startDate=${startParam}&endDate=${endParam}`;
      } else if (targetDate && targetDate !== 'all') {
        q += `&date=${targetDate}`;
      }
      if (targetStaff) q += `&username=${targetStaff}`;
      const res = await fetch(q, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        setDailyReportData(data.report);
      }
    } catch (err) {
      console.error('Error loading daily report:', err);
    } finally {
      setDailyReportLoading(false);
    }
  };

  const loadProjectSettings = async () => {
    if (!staffToken) return;
    setProjectSettingsLoading(true);
    try {
      const res = await fetch(`/api/admin/settings?token=${staffToken}`, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setProjectSettings(data.settings);
      }
    } catch (err) {
      console.error('Error loading project settings:', err);
    } finally {
      setProjectSettingsLoading(false);
    }
  };

  const handleUpdateProjectSettings = async (e) => {
    e.preventDefault();
    setProjectSettingsSaving(true);
    setProjectSettingsSuccess('');
    setProjectSettingsError('');
    try {
      const res = await fetch(`/api/admin/settings?token=${staffToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify(projectSettings)
      });
      const data = await res.json();
      if (data.success) {
        setProjectSettingsSuccess(data.message || 'à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤à¤µà¤‚ UPI à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤¸à¤¹à¥‡à¤œ à¤²à¥€ à¤—à¤ˆà¤‚!');
        if (data.settings) setProjectSettings(data.settings);
      } else {
        setProjectSettingsError(data.error || 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤°à¤¨à¥‡ à¤®à¥‡à¤‚ à¤µà¤¿à¤«à¤²à¥¤');
      }
    } catch (err) {
      setProjectSettingsError('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    } finally {
      setProjectSettingsSaving(false);
    }
  };

  const handleStaffLogout = async () => {
    try {
      if (staffToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
          body: JSON.stringify({ token: staffToken })
        });
      }
    } catch (e) {}
    setStaffToken('');
    setStaffUser(null);
    localStorage.removeItem('mvd_staff_token');
    localStorage.removeItem('mvd_staff_user');
    sessionStorage.removeItem('mvd_staff_token');
    sessionStorage.removeItem('mvd_staff_user');
    navigate('/login');
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setSettingsMessage('');
    setSettingsError('');
    if (settingsNewPass !== settingsConfirmPass) {
      setSettingsError('à¤¨à¤¯à¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤”à¤° à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤®à¥‡à¤² à¤¨à¤¹à¥€à¤‚ à¤–à¤¾à¤¤à¥‡à¥¤');
      return;
    }
    if (settingsNewPass.length < 6) {
      setSettingsError('à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤•à¤® à¤¸à¥‡ à¤•à¤® 6 à¤…à¤•à¥à¤·à¤°à¥‹à¤‚ à¤•à¤¾ à¤¹à¥‹à¤¨à¤¾ à¤šà¤¾à¤¹à¤¿à¤à¥¤');
      return;
    }
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({ oldPassword: settingsOldPass, newPassword: settingsNewPass })
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMessage(data.message);
        setSettingsOldPass('');
        setSettingsNewPass('');
        setSettingsConfirmPass('');
      } else {
        setSettingsError(data.error || 'à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤°à¤¨à¥‡ à¤®à¥‡à¤‚ à¤µà¤¿à¤«à¤²à¥¤');
      }
    } catch (err) {
      setSettingsError('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿, à¤•à¥ƒà¤ªà¤¯à¤¾ à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤•à¤°à¥‡à¤‚à¥¤');
    }
  };
  const submitUtr = async (e) => {
    e.preventDefault();
    if (!utrInput.trim()) return alert('à¤•à¥ƒà¤ªà¤¯à¤¾ UTR à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤');
    
    try {
      const res = await fetch(`/api/bookings/${upiQrModal.bookingId}/utr`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utrNumber: utrInput })
      });
      const data = await res.json();
      if (data.success) {
        alert('UTR à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤¹à¥‹ à¤—à¤¯à¤¾à¥¤ à¤à¤¡à¤®à¤¿à¤¨ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤µà¥‡à¤°à¤¿à¤«à¤¿à¤•à¥‡à¤¶à¤¨ à¤•à¥€ à¤ªà¥à¤°à¤¤à¥€à¤•à¥à¤·à¤¾ à¤¹à¥ˆà¥¤');
        setUpiQrModal(null);
        setUtrInput('');
        if (staffToken) loadAdminDashboard(); // Refresh if staff
      } else {
        alert(data.error || 'UTR à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤•à¤°à¤¨à¥‡ à¤®à¥‡à¤‚ à¤µà¤¿à¤«à¤²à¥¤');
      }
    } catch (err) {
      alert('à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿, à¤•à¥ƒà¤ªà¤¯à¤¾ à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤•à¤°à¥‡à¤‚à¥¤');
    }
  };


  const handlePaymentEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/admin/bookings/${paymentEditData.bookingId}/payment?token=${staffToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({
          paymentMode: paymentEditData.paymentMode,
          upiTransactionId: paymentEditData.upiTransactionId,
          advance: parseFloat(paymentEditData.advance || 0),
          discount: parseFloat(paymentEditData.discount || 0)
        })
      });
      const data = await res.json();
      if (data.success) {
        setPaymentEditModal(null);
        if (adminBookings.length > 0) loadAdminDashboard();
        if (reconcileData) loadReconciliation();
      } else {
        alert('Payment update failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error updating payment');
    }
  };

  const loadAdminDashboard = async () => {
    const q = adminYearFilter ? `?year=${adminYearFilter}&token=${staffToken}` : `?token=${staffToken}`;
    try {
      const [statsRes, bkRes] = await Promise.all([
        fetch(`/api/admin/stats${q}`, { headers: { 'Authorization': 'Bearer ' + staffToken } }),
        fetch(`/api/admin/bookings${adminYearFilter ? `?yatraYear=${adminYearFilter}&token=${staffToken}` : `?token=${staffToken}`}`, { headers: { 'Authorization': 'Bearer ' + staffToken } })
      ]);
      const statsData = await statsRes.json();
      const bkData = await bkRes.json();
      if (statsData.success) setAdminStats(statsData.stats);
      if (bkData.success) setAdminBookings(bkData.bookings);
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  };

  const markBookingPaid = async (id) => {
    if (!confirm(`à¤¬à¥à¤•à¤¿à¤‚à¤— ${id} à¤•à¥‹ à¤ªà¥‚à¤°à¥à¤£ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤šà¤¿à¤¹à¥à¤¨à¤¿à¤¤ à¤•à¤°à¥‡à¤‚?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${id}/pay?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) loadAdminDashboard();
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const verifyUtr = async (id, utrNumber) => {
    if (!confirm(`à¤•à¥à¤¯à¤¾ à¤†à¤ª UTR ${utrNumber} à¤•à¥€ à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤•à¤°à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${id}/verify-utr?token=${staffToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        alert('UTR à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤¹à¥‹ à¤—à¤¯à¤¾à¥¤');
        loadAdminDashboard();
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };



  const deleteBooking = async (id) => {
    if (!confirm(`à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤¬à¥à¤•à¤¿à¤‚à¤— ${id} à¤•à¥‹ à¤¨à¤¿à¤°à¤¸à¥à¤¤ à¤•à¤°à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${id}?token=${staffToken}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) loadAdminDashboard();
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) return;
    const form = new FormData();
    form.append('excelFile', bulkFile);
    form.append('yatraYear', bulkYear);

    try {
      const res = await fetch(`/api/admin/bulk-upload?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + staffToken },
        body: form
      });
      const data = await res.json();
      if (data.success) {
        setBulkMessage(data.message);
        setTimeout(() => {
          setBulkModalOpen(false);
          setBulkMessage('');
          loadAdminDashboard();
        }, 1500);
      } else {
        alert(data.error || 'à¤…à¤ªà¤²à¥‹à¤¡ à¤¤à¥à¤°à¥à¤Ÿà¤¿');
      }
    } catch (err) {
      alert('à¤…à¤ªà¤²à¥‹à¤¡ à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const loadCoachChart = async (coach = chartCoach, year = chartYear) => {
    setChartLoading(true);
    try {
      const res = await fetch(`/api/chart/${coach}?year=${year}&token=${staffToken}`, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        setCoachChartData(data.chart);
      }
    } catch (err) {
      console.error('Error loading chart:', err);
    } finally {
      setChartLoading(false);
    }
  };

  const handleTteCheckIn = async (seatNumber, status) => {
    try {
      const res = await fetch(`/api/tte/checkin?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({
          coachName: chartCoach,
          yatraYear: chartYear,
          seatNumber,
          status,
          staffName: staffUser?.name,
          staffUsername: staffUser?.username
        })
      });
      const data = await res.json();
      if (data.success) {
        loadCoachChart(chartCoach, chartYear);
      } else {
        alert('à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸ à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleTteCollectDue = async (bookingId, amount) => {
    const mode = window.prompt(`à¤¬à¤•à¤¾à¤¯à¤¾ â‚¹ ${amount} à¤œà¤®à¤¾ à¤•à¤°à¤¨à¥‡ à¤•à¤¾ à¤¤à¤°à¥€à¤•à¤¾ (Cash à¤¯à¤¾ UPI à¤Ÿà¤¾à¤‡à¤ª à¤•à¤°à¥‡à¤‚):`, 'Cash');
    if (!mode) return;
    
    const paymentMode = mode.trim().toUpperCase() === 'UPI' ? 'UPI' : 'Cash';
    let utr = '';
    
    if (paymentMode === 'UPI') {
      utr = window.prompt('à¤•à¥ƒà¤ªà¤¯à¤¾ 12-à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¤¾ UPI UTR (Ref) à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚:');
      if (!utr) {
        alert('UPI à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ à¤•à¥‡ à¤²à¤¿à¤ UTR à¤…à¤¨à¤¿à¤µà¤¾à¤°à¥à¤¯ à¤¹à¥ˆ!');
        return;
      }
    } else {
      if (!window.confirm(`à¤•à¥à¤¯à¤¾ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¥‡ â‚¹ ${amount} CASH à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤¹à¥‹ à¤šà¥à¤•à¤¾ à¤¹à¥ˆ?`)) return;
    }

    try {
      const res = await fetch(`/api/tte/collect-due?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({
          bookingId,
          amount,
          paymentMode,
          utr,
          staffName: staffUser?.name,
          staffUsername: staffUser?.username
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('à¤¬à¤•à¤¾à¤¯à¤¾ à¤°à¤¾à¤¶à¤¿ à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤œà¤®à¤¾ à¤•à¥€ à¤—à¤ˆ!');
        loadCoachChart(chartCoach, chartYear);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const openPrintChart = (coach = chartCoach, year = chartYear) => {
    window.open(`/api/chart/${coach}/print?year=${year}&token=${safeStaffToken}`, '_blank');
  };

  const loadStaffData = async () => {
    try {
      const token = staffToken || (typeof window !== 'undefined' ? (localStorage.getItem('mvd_staff_token') || 'mvd_admin_token') : 'mvd_admin_token');
      const res = await fetch(`/api/admin/staff?token=${encodeURIComponent(token)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.staff)) {
        setStaffList(data.staff);
        if (data.roles) setStaffRoles(data.roles);
        if (data.departments) setStaffDepartments(data.departments);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`/api/admin/audit-logs?token=${staffToken}&limit=200`, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        setAuditLogsList(data.logs);
      }
    } catch (err) {
      console.error('Error loading audit logs:', err);
    }
  };

  const loadReconciliation = async () => {
    try {
      const res = await fetch(`/api/admin/reconciliation-report?token=${staffToken}&year=${adminYearFilter || ''}`, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        setReconcileData(data.report);
      }
    } catch (err) {
      console.error('Error loading reconciliation:', err);
    }
  };

  const loadOnlineTransactions = async (status = onlineTxnsStatusFilter, search = onlineTxnsSearch) => {
    setOnlineTxnsLoading(true);
    try {
      let url = `/api/admin/online-transactions?token=${staffToken}`;
      if (status && status !== 'All') url += `&status=${encodeURIComponent(status)}`;
      if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        setOnlineTxnsList(data.transactions || []);
        if (data.summary) setOnlineTxnsSummary(data.summary);
      }
    } catch (err) {
      console.error('Error loading online transactions:', err);
    } finally {
      setOnlineTxnsLoading(false);
    }
  };

  const handleVerifyUtrAction = async (bookingId, txnId, status, utrNumber, remarks) => {
    try {
      const res = await fetch('/api/admin/transactions/verify-utr', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + staffToken
        },
        body: JSON.stringify({
          bookingId,
          txnId,
          status,
          utrNumber,
          remarks,
          adminName: staffUser?.name || 'SuperAdmin'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾!');
        setEditUtrModal(null);
        loadOnlineTransactions(onlineTxnsStatusFilter, onlineTxnsSearch);
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      const assignedCoachesList = typeof newStaffForm.assignedCoach === 'string' && newStaffForm.assignedCoach.trim()
        ? newStaffForm.assignedCoach.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : (newStaffForm.assignedCoaches || []);

      const payload = {
        ...newStaffForm,
        assignedCoaches: assignedCoachesList
      };

      const res = await fetch(`/api/admin/staff?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤¸à¤«à¤²à¤¤à¤¾à¤ªà¥‚à¤°à¥à¤µà¤• à¤œà¥‹à¤¡à¤¼ à¤¦à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾!');
        setNewStaffModal(false);
        setNewStaffForm({
          name: '',
          email: '',
          username: '',
          password: '',
          department: 'Trust Executive (à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨)',
          role: 'SuperAdmin',
          mobile: '',
          assignedCoach: '',
          assignedCoaches: [],
          assignedStation: 'All Stations'
        });
        loadStaffData();
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleDeleteStaff = async (staffId, name) => {
    if (!confirm(`à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ "${name}" (ID: ${staffId}) à¤•à¥‹ à¤¸à¤¿à¤¸à¥à¤Ÿà¤® à¤¸à¥‡ à¤¹à¤Ÿà¤¾à¤¨à¤¾ à¤šà¤¾à¤¹à¤¤à¥‡ à¤¹à¥ˆà¤‚?`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${staffId}?token=${staffToken}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        alert('à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤¹à¤Ÿà¤¾ à¤¦à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾à¥¤');
        loadStaffData();
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  const handleToggleStaffStatus = async (staffMember) => {
    const staffId = staffMember.id || staffMember.staffId;
    const currentStatus = staffMember.status;
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      const res = await fetch(`/api/admin/staff/${staffId}?token=${staffToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        loadStaffData();
      } else {
        alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + data.error);
      }
    } catch (err) {
      alert('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // DEDICATED ROUTE SYSTEM & VIEW RESOLUTION
  // -------------------------------------------------------------
  const getActiveView = () => {
    const p = currentPath;
    if (p === '/' || p === '/home') return 'public_home';
    if (p === '/login') return 'login';
    if (p === '/verify-ticket') return 'verifier';
    if (p === '/coach-position' || p === '/train-composition') return 'coach_position';
    if (p === '/rule' || p === '/rules') return 'rules';

    // Universal & Role-specific Settings
    if (p === '/settings' || p.endsWith('/settings')) return 'settings';

    // Admin Routes
    if (p === '/admin' || p === '/admin/dashboard') return 'admin_dashboard';
    if (p === '/admin/booking') return 'booking';
    if (p === '/admin/bookings') return 'bookings_list';
    if (p === '/admin/receipts') return 'receipts_desk';
    if (p === '/admin/refunds' || p === '/counter/refunds') return 'refunds_desk';
    if (p === '/admin/chart') return 'chart';
    if (p === '/admin/coaches') return 'admin_coaches';
    if (p === '/admin/checkin' || p === '/admin/tte-checkin') return 'tte_checkin';
    if (p === '/admin/reconcile') return 'reconcile';
    if (p === '/admin/staff') return 'staff_rbac';
    if (p === '/admin/audit') return 'audit_logs';
    if (p === '/admin/verifier') return 'verifier';
    if (p === '/admin/guide' || p === '/counter/guide' || p === '/tt/guide' || p === '/finance/guide' || p === '/station/guide' || p === '/guide') return 'user_guide';

    // TTE Routes
    if (p === '/tt' || p === '/tt/home') return 'tte_checkin';
    if (p === '/tt/chart') return 'chart';
    if (p === '/tt/collections') return 'tte_collections';
    if (p === '/tt/verify') return 'verifier';

    // Counter Clerk Routes
    if (p === '/counter' || p === '/counter/booking') return 'booking';
    if (p === '/counter/history') return 'bookings_list';
    if (p === '/counter/receipts') return 'receipts_desk';
    if (p === '/counter/chart') return 'chart';
    if (p === '/counter/collections') return 'counter_collections';
    if (p === '/counter/verify') return 'verifier';

    // Accounts / Finance Routes
    if (p === '/finance' || p === '/finance/ledger') return 'reconcile';
    if (p === '/finance/bookings') return 'bookings_list';
    if (p === '/finance/receipts') return 'receipts_desk';
    if (p === '/finance/verify') return 'verifier';

    // Station Master Routes
    if (p === '/station' || p === '/station/chart' || p === '/station/home') return 'chart';
    if (p === '/station/verify') return 'verifier';

    // Shared Public Receipts Desk
    if (p === '/receipts') return 'receipts_desk';

    return 'redirect_home';
  };

  const checkRouteAccess = () => {
    const p = currentPath;
    // Strictly allowed public routes
    if (p === '/' || p === '/home' || p === '/login' || p === '/receipts' || p === '/verify-ticket' || p === '/coach-position' || p === '/train-composition' || p === '/rule' || p === '/rules') {
      return { allowed: true };
    }
    if (!staffUser) {
      return { allowed: false, reason: 'NOT_LOGGED_IN' };
    }
    
    // Allow settings for all logged-in users regardless of role prefix
    if (p === '/settings' || p.endsWith('/settings')) {
      return { allowed: true };
    }
    if (p.startsWith('/admin') && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'à¤¸à¥à¤ªà¤° à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤• (SuperAdmin)' };
    }
    if (p.startsWith('/tt') && staffUser.role !== 'TTE' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'à¤Ÿà¥€à¤Ÿà¥€à¤ˆ à¤¸à¥à¤Ÿà¤¾à¤« (TTE)' };
    }
    if (p.startsWith('/counter') && staffUser.role !== 'BookingClerk' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¥à¤²à¤°à¥à¤• (BookingClerk)' };
    }
    if (p.startsWith('/finance') && staffUser.role !== 'AccountsOfficer' && staffUser.role !== 'FinanceOfficer' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'à¤…à¤•à¤¾à¤‰à¤‚à¤Ÿà¥à¤¸ à¤‘à¤«à¤¿à¤¸à¤° (AccountsOfficer)' };
    }
    if (p.startsWith('/station') && staffUser.role !== 'StationMaster' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¸à¤®à¤¨à¥à¤µà¤¯à¤• (StationMaster)' };
    }
    return { allowed: true };
  };

  // Automatic Security & Route Guard: Redirect invalid / unauthorized routes to Home '/'
  useEffect(() => {
    const access = checkRouteAccess();
    if (!access.allowed) {
      if (access.reason === 'NOT_LOGGED_IN') {
        navigate('/');
      } else if (access.reason === 'ROLE_MISMATCH' && staffUser) {
        navigate(getRoleDefaultPath(staffUser.role));
      }
    } else {
      const view = getActiveView();
      if (view === 'redirect_home') {
        navigate('/');
      }
    }
  }, [currentPath, staffUser]);

  // -------------------------------------------------------------
  // RENDER HELPER: HIGH SECURITY LOGIN SCREEN
  // -------------------------------------------------------------
  const renderLoginScreen = (notice = '') => {
    return (
      <div className="glass-card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center', border: '2px solid #FED7AA' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}><ShieldCheck size={48} /></div>
        <span className="badge badge-bhakti" style={{ marginBottom: 8, fontSize: '0.82rem' }}>
          à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤•à¥à¤·à¥‡à¤¤à¥à¤°
        </span>
        <h2 style={{ fontSize: '1.8rem', color: '#9A3412', margin: '8px 0 6px', fontWeight: 800 }}>
          à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤à¤µà¤‚ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿà¥€ à¤²à¥‰à¤—à¤¿à¤¨
        </h2>
        <p style={{ color: '#7C2D12', fontSize: '0.88rem', marginBottom: 20 }}>
          à¤¯à¤¹ à¤•à¥à¤·à¥‡à¤¤à¥à¤° à¤•à¥‡à¤µà¤² à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤°à¥‡à¤²à¤µà¥‡ à¤¸à¥à¤Ÿà¤¾à¤«, à¤Ÿà¥€à¤Ÿà¥€à¤ˆ, à¤…à¤•à¤¾à¤‰à¤‚à¤Ÿà¥à¤¸ à¤à¤µà¤‚ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤•à¥‹à¤‚ à¤•à¥‡ à¤²à¤¿à¤ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¹à¥ˆà¥¤
        </p>

        {notice && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', color: '#92400E', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.86rem', fontWeight: 700, textAlign: 'left' }}>
            {notice}
          </div>
        )}

        {/* Login Method Switcher */}
        <div style={{ display: 'flex', gap: 6, background: '#FFF8F2', padding: 4, borderRadius: 10, border: '1.5px solid #FED7AA', marginBottom: 20 }}>
          <button
            type="button"
            className={`btn btn-sm ${loginMethod === 'password' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '9px 6px', fontSize: '0.86rem' }}
            onClick={() => { setLoginMethod('password'); setAuthLoginError(''); }}
          >
            <Key size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> à¤†à¤ˆà¤¡à¥€ / à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡
          </button>
          <button
            type="button"
            className={`btn btn-sm ${loginMethod === 'google' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '9px 6px', fontSize: '0.86rem' }}
            onClick={() => { setLoginMethod('google'); setAuthLoginError(''); }}
          >
            <Globe size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> Google à¤¸à¤¾à¤‡à¤¨-à¤‡à¤¨
          </button>
        </div>

        {authLoginError && (
          <div style={{ background: '#FEE2E2', border: '1.5px solid #F87171', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.88rem', fontWeight: 600, textAlign: 'left' }}>
            <AlertTriangle size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> {authLoginError}
          </div>
        )}

        {/* Method 1: Email / Username & Password */}
        {loginMethod === 'password' && (
          <form onSubmit={handleStaffLogin}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">à¤œà¥€à¤®à¥‡à¤² à¤†à¤ˆà¤¡à¥€ à¤¯à¤¾ à¤¯à¥‚à¤œà¤°à¤¨à¥‡à¤® (Gmail ID / Username) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="iammshyam@gmail.com à¤¯à¤¾ admin"
                value={authLoginUsername}
                onChange={(e) => setAuthLoginUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">à¤—à¥‹à¤ªà¤¨à¥€à¤¯ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ (Password) *</label>
              <input
                type="password"
                className="form-control"
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                value={authLoginPassword}
                onChange={(e) => setAuthLoginPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={authLoginLoading} className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '1rem', marginTop: 10 }}>
              {authLoginLoading ? 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤œà¤¾à¤°à¥€...' : <><Lock size={18} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤ªà¥à¤°à¤µà¥‡à¤¶ à¤•à¤°à¥‡à¤‚ (Secure Login)</>}
            </button>
          </form>
        )}

        {/* Method 3: Google Sign-In */}
        {loginMethod === 'google' && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', padding: '12px 14px', borderRadius: 10, color: '#1E40AF', fontSize: '0.85rem', marginBottom: 16, textAlign: 'left', lineHeight: 1.4 }}>
              <strong><Globe size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> Google (Gmail) à¤µà¤¨-à¤•à¥à¤²à¤¿à¤• à¤²à¥‰à¤—à¤¿à¤¨:</strong>
              <div style={{ marginTop: 4 }}>à¤à¤¡à¤®à¤¿à¤¨ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤ªà¤‚à¤œà¥€à¤•à¥ƒà¤¤ à¤ˆà¤®à¥‡à¤² à¤†à¤ˆà¤¡à¥€ à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¤¤à¥‡ à¤¹à¥€ à¤‰à¤¨à¤•à¤¾ à¤¸à¤‚à¤¬à¤‚à¤§à¤¿à¤¤ à¤•à¤¾à¤°à¥à¤¯à¤­à¤¾à¤° (à¤à¤¡à¤®à¤¿à¤¨ / à¤¸à¥à¤Ÿà¤¾à¤«) à¤¸à¥à¤µà¤¤à¤ƒ à¤–à¥à¤² à¤œà¤¾à¤à¤—à¤¾à¥¤</div>
            </div>

            <button
              type="button"
              disabled={authLoginLoading}
              onClick={handleGoogleLogin}
              className="btn btn-outline"
              style={{
                width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                background: '#FFFFFF', borderColor: '#CBD5E1', color: '#1F2937',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: 10
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{authLoginLoading ? 'à¤—à¥‚à¤—à¤² à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¤°à¤£ à¤œà¤¾à¤°à¥€...' : 'Google (Gmail) à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¥‡à¤‚'}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER HELPER: ROLE SPECIFIC NAVIGATION BAR
  // -------------------------------------------------------------
  const renderRoleSubNav = () => {
    if (!staffUser) return null;
    const role = staffUser.role;

    let navItems = [];
    if (role === 'SuperAdmin') {
      navItems = [
        { path: '/admin/dashboard', label: <><LayoutDashboard size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡</>, subTab: 'dashboard' },
        { path: '/admin/booking', label: <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£</>, subTab: 'book' },
        { path: '/admin/bookings', label: <><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¡à¤¾à¤¯à¤°à¥‡à¤•à¥à¤Ÿà¤°à¥€</>, subTab: 'bookings' },
        { path: '/admin/chart', label: <><Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC à¤•à¥‹à¤š à¤šà¤¾à¤°à¥à¤Ÿ</>, subTab: 'chart' },
        { path: '/admin/reconcile', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤µ à¤¹à¤¿à¤¸à¤¾à¤¬</>, subTab: 'reconcile' },
        { path: '/admin/staff', label: <><Users size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤µ RBAC</>, subTab: 'staff' },
        { path: '/admin/audit', label: <><ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤‘à¤¡à¤¿à¤Ÿ à¤Ÿà¥à¤°à¥‡à¤²</>, subTab: 'audit' },
        { path: '/admin/verifier', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨</>, subTab: 'verifier' }
      ];
    } else if (role === 'TTE') {
      navItems = [
        { path: '/tt/home', label: <><BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸ à¤µ à¤µà¤¸à¥‚à¤²à¥€</>, subTab: 'tte' },
        { path: '/tt/chart', label: <><Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC à¤•à¥‹à¤š à¤šà¤¾à¤°à¥à¤Ÿ</>, subTab: 'chart' },
        { path: '/tt/collections', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤®à¥‡à¤°à¤¾ à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¤²à¥‡à¤•à¥à¤¶à¤¨</>, subTab: 'collections' },
        { path: '/tt/verify', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨</>, subTab: 'verifier' }
      ];
    } else if (role === 'BookingClerk') {
      navItems = [
        { path: '/counter/booking', label: <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¨à¤ˆ à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°</>, subTab: 'book' },
        { path: '/counter/history', label: <><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤®à¥‡à¤°à¥€ à¤œà¤¾à¤°à¥€ à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸</>, subTab: 'bookings' },
        { path: '/counter/collections', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤®à¥‡à¤°à¤¾ à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¤²à¥‡à¤•à¥à¤¶à¤¨</>, subTab: 'collections' },
        { path: '/counter/verify', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨</>, subTab: 'verifier' }
      ];
    } else if (role === 'AccountsOfficer') {
      navItems = [
        { path: '/finance/ledger', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¸à¤®à¤¾à¤§à¤¾à¤¨ à¤µ à¤¦à¥ˆà¤¨à¤¿à¤• à¤•à¤²à¥‡à¤•à¥à¤¶à¤¨</>, subTab: 'reconcile' },
        { path: '/finance/bookings', label: <><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤†à¤°à¤•à¥à¤·à¤£ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¸à¥‚à¤šà¥€</>, subTab: 'bookings' },
        { path: '/finance/verify', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨</>, subTab: 'verifier' }
      ];
    } else {
      navItems = [
        { path: '/admin/dashboard', label: <><LayoutDashboard size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡</>, subTab: 'dashboard' }
      ];
    }

    return (
      <div className="staff-panel-header glass-card no-hover" style={{ marginBottom: 18, border: '1.5px solid #FED7AA' }}>
        <div className="staff-info-row">
          {/* Avatar + Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="staff-avatar">
              {role === 'SuperAdmin' ? <Crown size={18} /> : role === 'TTE' ? <BadgeCheck size={18} /> : role === 'BookingClerk' ? <Briefcase size={18} /> : <LayoutDashboard size={18} />}
            </div>
            <div className="staff-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3>{staffUser.name}</h3>
                <span className="badge badge-bhakti">{role}</span>
                <span className="badge badge-paid">âœ“ Active</span>
              </div>
              <p>
                {staffUser.department || 'à¤°à¥‡à¤²à¤µà¥‡ à¤¸à¤‚à¤šà¤¾à¤²à¤¨'} &nbsp;|&nbsp; ID: <code>{staffUser.username || staffUser.staffId}</code>
                {staffUser.assignedCoach?.length > 0 && (
                  <> &nbsp;|&nbsp; Coach: <strong style={{ color: '#047857' }}>{staffUser.assignedCoach.join(', ')}</strong></>
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isSuperAdmin && (
              <>
                <a href={`/api/admin/export-excel?yatraYear=${encodeURIComponent(adminYearFilter || '')}&token=${safeStaffToken}`}
                  className="btn btn-gold btn-sm"><Download size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> Excel</a>
                <button className="btn btn-outline btn-sm" onClick={() => setBulkModalOpen(true)}><Upload size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¬à¤²à¥à¤•</button>
                <a href={`/api/admin/bulk-slips?yatraYear=${encodeURIComponent(adminYearFilter || '')}&token=${safeStaffToken}`}
                  className="btn btn-primary btn-sm"><FileText size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤ªà¤°à¥à¤šà¤¿à¤¯à¤¾à¤‚</a>
                <a href={`/api/admin/reports/defaulters?token=${safeStaffToken}`} target="_blank" rel="noreferrer"
                  className="btn btn-gold btn-sm"><Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¬à¤•à¤¾à¤¯à¤¾à¤¦à¤¾à¤°à¥‹à¤‚ à¤•à¥€ à¤¸à¥‚à¤šà¥€</a>
              </>
            )}
            <div style={{ background: '#FFF8F2', border: '1.5px solid #FDBA74', borderRadius: 6, padding: '3px 8px', fontSize: '0.72rem', color: '#9A3412', fontWeight: 700 }}>
              <code>{currentPath}</code>
            </div>
            <button className="btn btn-sm" onClick={handleStaffLogout}
              style={{ color: '#DC2626', border: '1.5px solid #FCA5A5', background: '#FFF5F5' }}>
              <LogOut size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> Logout
            </button>
          </div>
        </div>

        {/* Desktop Role Nav Tabs */}
        <div className="nav-tabs-scroll desktop-subnav" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #FFEDD5' }}>
          {navItems.map(item => (
            <button
              key={item.path}
              className={`btn btn-sm ${currentPath === item.path ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setStaffSubTab(item.subTab); navigate(item.path); }}
              style={{ fontWeight: currentPath === item.path ? 800 : 600 }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER HELPER: DATE-WISE DAILY COLLECTION PANEL (PERSONAL & STAFF)
  // -------------------------------------------------------------
  const renderDailyCollectionPanel = (isPersonalOnly = false) => {
    const report = dailyReportData;
    const personal = report?.personalStats || {
      staffName: staffUser?.name || 'à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€',
      role: staffUser?.role || 'Staff',
      department: staffUser?.department || 'à¤Ÿà¥à¤°à¥‡à¤¨ à¤¸à¤‚à¤šà¤¾à¤²à¤¨',
      totalCollected: 0,
      cashCollected: 0,
      upiCollected: 0,
      bookingsCount: 0,
      discountsGiven: 0,
      pendingDues: 0,
      yatrisHandled: 0,
      transactions: []
    };
    const overall = report?.overallStats || {
      totalCollected: 0,
      cashCollected: 0,
      upiCollected: 0,
      discountsGiven: 0,
      pendingDues: 0,
      grossAmount: 0,
      totalBookings: 0,
      zeroLeakageBalance: 0
    };
    const staffBreakdown = report?.staffBreakdown || [];
    const dateWiseBreakdown = report?.dateWiseBreakdown || [];
    const roleBreakdown = report?.roleBreakdown || {};
    const transactions = isPersonalOnly ? (personal.transactions || []) : (report?.transactions || personal.transactions || []);

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const firstDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // Active calculations
    const activeCollected = isPersonalOnly ? (personal.totalCollected || 0) : (dailyStaffFilter ? (personal.totalCollected || 0) : (overall.totalCollected || 0));
    const activeCash = isPersonalOnly ? (personal.cashCollected || 0) : (dailyStaffFilter ? (personal.cashCollected || 0) : (overall.cashCollected || 0));
    const activeUpi = isPersonalOnly ? (personal.upiCollected || 0) : (dailyStaffFilter ? (personal.upiCollected || 0) : (overall.upiCollected || 0));
    const activeDues = isPersonalOnly ? (personal.pendingDues || 0) : (dailyStaffFilter ? (personal.pendingDues || 0) : (overall.pendingDues || 0));
    const activeDiscounts = isPersonalOnly ? (personal.discountsGiven || 0) : (dailyStaffFilter ? (personal.discountsGiven || 0) : (overall.discountsGiven || 0));
    const activeBookings = isPersonalOnly ? (personal.bookingsCount || transactions.length || 0) : (dailyStaffFilter ? (personal.bookingsCount || 0) : (overall.totalBookings || staffBreakdown.reduce((acc, s) => acc + (s.bookingsCount || 0), 0)));
    const activeGross = activeCollected + activeDues + activeDiscounts;

    // Find max value in date-wise time series for graph scaling
    const maxDayTotal = Math.max(...dateWiseBreakdown.map(d => (d.totalCollected || 0) + (d.pendingDues || 0)), 1000);

    return (
      <div>
        {/* Date Filter & Staff Header */}
        <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <span className="badge badge-bhakti" style={{ marginBottom: 6 }}>
                {isPersonalOnly ? <><Briefcase size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤µà¥à¤¯à¤•à¥à¤¤à¤¿à¤—à¤¤ à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤¬à¤¹à¥€à¤–à¤¾à¤¤à¤¾</> : <><BarChart3 size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¦à¤¿à¤¨à¤¾à¤‚à¤•-à¤µà¤¾à¤° à¤¸à¤®à¤—à¥à¤° MIS à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ à¤à¤µà¤‚ à¤¶à¥‚à¤¨à¥à¤¯ à¤¹à¥‡à¤°-à¤«à¥‡à¤° à¤¸à¤®à¤¾à¤§à¤¾à¤¨</>}
              </span>
              <h3 style={{ fontSize: '1.45rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                {isPersonalOnly
                  ? `à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ â€¢ ${staffUser?.name || 'à¤®à¥‡à¤°à¤¾ à¤–à¤¾à¤¤à¤¾'} (${staffUser?.role || ''})`
                  : 'à¤¸à¤®à¤¸à¥à¤¤ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¤¿à¤¯à¥‹à¤‚ à¤•à¤¾ à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€, à¤›à¥‚à¤Ÿ, à¤‰à¤§à¤¾à¤°à¥€ à¤à¤µà¤‚ MIS à¤°à¤œà¤¿à¤¸à¥à¤Ÿà¤°'}
              </h3>
              <div style={{ color: '#7C2D12', fontSize: '0.86rem', marginTop: 4 }}>
                {isPersonalOnly
                  ? 'à¤†à¤ªà¤•à¥€ à¤µà¥à¤¯à¤•à¥à¤¤à¤¿à¤—à¤¤ à¤¨à¤•à¤¦ à¤µ UPI à¤µà¤¸à¥‚à¤²à¥€, à¤ªà¥à¤°à¤¦à¤¾à¤¨ à¤•à¥€ à¤—à¤ˆ à¤°à¤¿à¤¯à¤¾à¤¯à¤¤, à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ à¤à¤µà¤‚ à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤Ÿà¤¿à¤•à¤Ÿ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤•à¥€ à¤‘à¤¡à¤¿à¤Ÿ à¤à¤‚à¤Ÿà¥à¤°à¥€'
                  : 'à¤¤à¤¿à¤¥à¤¿-à¤¸à¥‡-à¤¤à¤¿à¤¥à¤¿ (Date-to-Date) à¤…à¤¨à¥à¤¸à¤¾à¤° à¤¨à¤•à¤¦, à¤¯à¥‚à¤ªà¥€à¤†à¤ˆ, à¤›à¥‚à¤Ÿ, à¤¶à¥‡à¤· à¤¬à¤•à¤¾à¤¯à¤¾ à¤µ à¤­à¥‚à¤®à¤¿à¤•à¤¾-à¤µà¤¾à¤° à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤‘à¤¡à¤¿à¤Ÿ à¤Ÿà¥à¤°à¥‡à¤²'}
              </div>
            </div>

            {/* Print & Refresh Quick Bar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => window.print()}
                title="à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ MIS à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚"
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> MIS à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => loadDailyReport(dailyFilterDate, isPersonalOnly ? staffUser?.username : dailyStaffFilter, dateFilterPreset === 'custom' ? dateRangeStartDate : null, dateFilterPreset === 'custom' ? dateRangeEndDate : null)}
                disabled={dailyReportLoading}
                title="à¤¡à¥‡à¤Ÿà¤¾ à¤¤à¤¾à¤œà¤¼à¤¾ à¤•à¤°à¥‡à¤‚"
              >
                <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {dailyReportLoading ? 'à¤²à¥‹à¤¡à¤¿à¤‚à¤—...' : 'à¤¤à¤¾à¤œà¤¼à¤¾ à¤•à¤°à¥‡à¤‚'}
              </button>
            </div>
          </div>

          {/* Date-to-Date & Range Filter Toolbar */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9A3412' }}>à¤¤à¥à¤µà¤°à¤¿à¤¤ à¤«à¤¼à¤¿à¤²à¥à¤Ÿà¤°:</span>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'today' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('today');
                  setDailyFilterDate(todayStr);
                  loadDailyReport(todayStr, isPersonalOnly ? staffUser?.username : dailyStaffFilter);
                }}
              >
                à¤†à¤œ (Today)
              </button>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'yesterday' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('yesterday');
                  setDailyFilterDate(yesterdayStr);
                  loadDailyReport(yesterdayStr, isPersonalOnly ? staffUser?.username : dailyStaffFilter);
                }}
              >
                à¤•à¤² (Yesterday)
              </button>
              <button
                className={`btn btn-sm ${dateFilterPreset === '7days' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('7days');
                  setDateRangeStartDate(sevenDaysAgoStr);
                  setDateRangeEndDate(todayStr);
                  loadDailyReport(null, isPersonalOnly ? staffUser?.username : dailyStaffFilter, sevenDaysAgoStr, todayStr);
                }}
              >
                à¤—à¤¤ 7 à¤¦à¤¿à¤¨
              </button>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'month' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('month');
                  setDateRangeStartDate(firstDayOfMonthStr);
                  setDateRangeEndDate(todayStr);
                  loadDailyReport(null, isPersonalOnly ? staffUser?.username : dailyStaffFilter, firstDayOfMonthStr, todayStr);
                }}
              >
                à¤‡à¤¸ à¤®à¤¾à¤¹
              </button>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('all');
                  setDailyFilterDate('all');
                  loadDailyReport('all', isPersonalOnly ? staffUser?.username : dailyStaffFilter);
                }}
              >
                à¤¸à¤®à¤¸à¥à¤¤ à¤¤à¤¿à¤¥à¤¿à¤¯à¤¾à¤‚ (All)
              </button>
            </div>

            {/* Custom Date-to-Date Range Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9A3412' }}>à¤•à¤¸à¥à¤Ÿà¤® à¤…à¤µà¤§à¤¿:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: '#7C2D12' }}>à¤¸à¥‡:</span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: 135, padding: '3px 6px', fontSize: '0.8rem' }}
                  value={dateRangeStartDate}
                  onChange={e => setDateRangeStartDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: '#7C2D12' }}>à¤¤à¤•:</span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: 135, padding: '3px 6px', fontSize: '0.8rem' }}
                  value={dateRangeEndDate}
                  onChange={e => setDateRangeEndDate(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: 700 }}
                onClick={() => {
                  setDateFilterPreset('custom');
                  loadDailyReport(null, isPersonalOnly ? staffUser?.username : dailyStaffFilter, dateRangeStartDate, dateRangeEndDate);
                }}
              >
                à¤²à¤¾à¤—à¥‚ à¤•à¤°à¥‡à¤‚
              </button>
            </div>

            {!isPersonalOnly && (isSuperAdmin || staffUser?.role === 'AccountsOfficer') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9A3412' }}>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '4px 10px', fontSize: '0.82rem' }}
                  value={dailyStaffFilter}
                  onChange={(e) => {
                    setDailyStaffFilter(e.target.value);
                    if (dateFilterPreset === 'custom' || dateFilterPreset === '7days' || dateFilterPreset === 'month') {
                      loadDailyReport(null, e.target.value, dateRangeStartDate, dateRangeEndDate);
                    } else {
                      loadDailyReport(dailyFilterDate, e.target.value);
                    }
                  }}
                >
                  <option value="">à¤¸à¤®à¤¸à¥à¤¤ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ (All Staff)</option>
                  {staffList.map(s => (
                    <option key={s.id || s.username} value={s.username}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ZERO FINANCIAL LEAKAGE MATHEMATICAL EQUATION BOX */}
        <div style={{
          background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
          border: '2px solid #F59E0B',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 20,
          boxShadow: '0 4px 14px rgba(245,158,11,0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color="#B45309" />
              <strong style={{ color: '#92400E', fontSize: '1rem' }}>
                à¤¶à¥‚à¤¨à¥à¤¯ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¹à¥‡à¤°-à¤«à¥‡à¤° à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ (Zero Financial Leakage Balance Formula)
              </strong>
            </div>
            <span className="badge badge-paid" style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#059669', color: '#fff' }}>
              âœ“ 100% à¤¸à¤Ÿà¥€à¤• à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¸à¤®à¤¾à¤§à¤¾à¤¨ (Balanced)
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            background: '#FFFFFF',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid #FDE68A',
            fontSize: '0.86rem'
          }} className="grid-kpi-mobile">
            <div>
              <span style={{ color: '#78350F', fontSize: '0.76rem' }}>à¤•à¥à¤² à¤¸à¤•à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾ (Gross):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#9A3412' }}>â‚¹ {activeGross.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#065F46', fontSize: '0.76rem' }}>= à¤•à¥à¤² à¤¸à¤‚à¤•à¤²à¤¿à¤¤ (Cash+UPI):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#047857' }}>â‚¹ {activeCollected.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#991B1B', fontSize: '0.76rem' }}>+ à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ / à¤‰à¤§à¤¾à¤°à¥€ (Dues):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#DC2626' }}>â‚¹ {activeDues.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#92400E', fontSize: '0.76rem' }}>+ à¤ªà¥à¤°à¤¦à¤¾à¤¨ à¤•à¥€ à¤—à¤ˆ à¤›à¥‚à¤Ÿ (Discount):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#D97706' }}>â‚¹ {activeDiscounts.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 4 Primary KPI Summary Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }} className="grid-kpi-mobile">
          {/* Total Collected */}
          <div className="kpi-card green">
            <div className="kpi-label">{isPersonalOnly ? 'à¤®à¥‡à¤°à¤¾ à¤•à¥à¤² à¤¸à¤‚à¤•à¤²à¤¨' : 'à¤¸à¤®à¤¸à¥à¤¤ à¤•à¥à¤² à¤µà¤¸à¥‚à¤²à¥€ (Total Collected)'}</div>
            <div className="kpi-value">
              â‚¹ {activeCollected.toLocaleString()}
            </div>
            <div className="kpi-sub" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span><IndianRupee size={15} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> à¤¨à¤•à¤¦: â‚¹{activeCash.toLocaleString()}</span>
              <span><Smartphone size={15} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> UPI: â‚¹{activeUpi.toLocaleString()}</span>
            </div>
          </div>

          {/* Bookings Count */}
          <div className="kpi-card blue">
            <div className="kpi-label">{isPersonalOnly ? 'à¤œà¤¾à¤°à¥€ à¤Ÿà¤¿à¤•à¤Ÿ' : 'à¤•à¥à¤² à¤œà¤¾à¤°à¥€ à¤Ÿà¤¿à¤•à¤Ÿ (Bookings)'}</div>
            <div className="kpi-value">
              {activeBookings}
            </div>
            <div className="kpi-sub">{isPersonalOnly ? `${personal.yatrisHandled || 0} à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¹à¥ˆà¤‚à¤¡à¤²` : 'à¤ªà¤‚à¤œà¥€à¤•à¥ƒà¤¤ à¤°à¤¸à¥€à¤¦à¥‡à¤‚'}</div>
          </div>

          {/* Pending Dues */}
          <div className="kpi-card red">
            <div className="kpi-label">à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ / à¤‰à¤§à¤¾à¤°à¥€ (Pending Dues)</div>
            <div className="kpi-value">
              â‚¹ {activeDues.toLocaleString()}
            </div>
            <div className="kpi-sub">à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤…à¤¥à¤µà¤¾ à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤†à¤—à¤®à¤¨ à¤ªà¤° à¤µà¤¸à¥‚à¤²à¥€ à¤¶à¥‡à¤·</div>
          </div>

          {/* Discounts Given */}
          <div className="kpi-card gold">
            <div className="kpi-label">à¤•à¥à¤² à¤›à¥‚à¤Ÿ (Discounts Granted)</div>
            <div className="kpi-value">
              â‚¹ {activeDiscounts.toLocaleString()}
            </div>
            <div className="kpi-sub">à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤µà¤¿à¤¶à¥‡à¤· à¤°à¤¿à¤¯à¤¾à¤¯à¤¤</div>
          </div>
        </div>

        {/* VISUAL INTERACTIVE MIS TIME-SERIES BAR CHART / GRAPH */}
        {dateWiseBreakdown.length > 0 && (
          <div className="glass-card" style={{ marginBottom: 22, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart3 size={22} color="#C2410C" />
                <div>
                  <h4 style={{ color: '#9A3412', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                    à¤¦à¤¿à¤¨à¤¾à¤‚à¤•-à¤µà¤¾à¤° à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤µ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤ªà¥à¤°à¤µà¤¾à¤¹ à¤—à¥à¤°à¤¾à¤« (MIS Time-Series Chart)
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: '#7C2D12' }}>
                    à¤¤à¤¾à¤°à¥€à¤– à¤…à¤¨à¥à¤¸à¤¾à¤° à¤¨à¤•à¤¦ à¤¸à¤‚à¤—à¥à¤°à¤¹ (à¤¹à¤°à¤¾), UPI à¤¸à¤‚à¤—à¥à¤°à¤¹ (à¤¨à¥€à¤²à¤¾) à¤à¤µà¤‚ à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ (à¤²à¤¾à¤²) à¤•à¥€ à¤¦à¥ƒà¤¶à¥à¤¯ à¤¤à¥à¤²à¤¨à¤¾
                  </div>
                </div>
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#10B981', borderRadius: 2 }} /> à¤¨à¤•à¤¦ (Cash)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#3B82F6', borderRadius: 2 }} /> UPI à¤¸à¤‚à¤—à¥à¤°à¤¹
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#EF4444', borderRadius: 2 }} /> à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ (Dues)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#F59E0B', borderRadius: 2 }} /> à¤›à¥‚à¤Ÿ (Discount)
                </span>
              </div>
            </div>

            {/* Visual Bar Chart Grid */}
            <div style={{
              overflowX: 'auto',
              paddingBottom: 10,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 12,
              minHeight: 190,
              padding: '16px 10px 10px',
              background: '#FFF8F2',
              borderRadius: 10,
              border: '1px solid #FED7AA'
            }}>
              {dateWiseBreakdown.map(d => {
                const cashHeight = Math.min(130, Math.max(8, ((d.cashCollected || 0) / maxDayTotal) * 130));
                const upiHeight = Math.min(130, Math.max(8, ((d.upiCollected || 0) / maxDayTotal) * 130));
                const duesHeight = Math.min(130, Math.max(4, ((d.pendingDues || 0) / maxDayTotal) * 130));
                const dayTotal = (d.totalCollected || 0);

                return (
                  <div
                    key={d.date}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: '1 0 75px',
                      minWidth: 70,
                      textAlign: 'center'
                    }}
                  >
                    {/* Amount Tag on top of bars */}
                    <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#9A3412', marginBottom: 6 }}>
                      â‚¹{dayTotal > 999 ? (dayTotal / 1000).toFixed(1) + 'k' : dayTotal}
                    </div>

                    {/* Bars Container */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
                      {/* Cash Bar */}
                      <div
                        title={`à¤¤à¤¿à¤¥à¤¿: ${d.date} | à¤¨à¤•à¤¦: â‚¹${(d.cashCollected || 0).toLocaleString()}`}
                        style={{
                          width: 16,
                          height: `${cashHeight}px`,
                          background: 'linear-gradient(180deg, #34D399, #059669)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                      />
                      {/* UPI Bar */}
                      <div
                        title={`à¤¤à¤¿à¤¥à¤¿: ${d.date} | UPI: â‚¹${(d.upiCollected || 0).toLocaleString()}`}
                        style={{
                          width: 16,
                          height: `${upiHeight}px`,
                          background: 'linear-gradient(180deg, #60A5FA, #2563EB)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                      />
                      {/* Dues Bar */}
                      {d.pendingDues > 0 && (
                        <div
                          title={`à¤¤à¤¿à¤¥à¤¿: ${d.date} | à¤¶à¥‡à¤· à¤¦à¥‡à¤¯: â‚¹${(d.pendingDues || 0).toLocaleString()}`}
                          style={{
                            width: 12,
                            height: `${duesHeight}px`,
                            background: 'linear-gradient(180deg, #F87171, #DC2626)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease'
                          }}
                        />
                      )}
                    </div>

                    {/* Date Label */}
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#7C2D12', marginTop: 8 }}>
                      {d.date.slice(5)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {d.bookingsCount} à¤Ÿà¤¿à¤•à¤Ÿ
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ROLE-WISE PERFORMANCE BREAKDOWN CARDS (SuperAdmin & Finance) */}
        {!isPersonalOnly && Object.keys(roleBreakdown).length > 0 && (
          <div className="glass-card" style={{ marginBottom: 22, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={20} color="#C2410C" />
                <h4 style={{ color: '#9A3412', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  à¤­à¥‚à¤®à¤¿à¤•à¤¾-à¤µà¤¾à¤° à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¸à¤‚à¤•à¤²à¤¨ à¤à¤µà¤‚ à¤ªà¥à¤°à¤¦à¤°à¥à¤¶à¤¨ à¤¸à¤¾à¤°à¤¾à¤‚à¤¶ (Role-Wise Breakdown)
                </h4>
              </div>
              <span className="badge badge-bhakti" style={{ fontSize: '0.75rem' }}>
                à¤•à¥à¤² à¤­à¥‚à¤®à¤¿à¤•à¤¾à¤à¤‚: {Object.keys(roleBreakdown).length}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              {Object.entries(roleBreakdown).map(([roleKey, rStats]) => (
                <div
                  key={roleKey}
                  style={{
                    background: '#FFF8F2',
                    border: '1.5px solid #FED7AA',
                    borderRadius: 10,
                    padding: '12px 14px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ color: '#9A3412', fontSize: '0.95rem' }}>
                      {roleKey === 'SuperAdmin' ? 'à¤šà¥€à¤«à¤¼ à¤à¤¡à¤®à¤¿à¤¨' :
                       roleKey === 'BookingClerk' ? 'à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¥à¤²à¤°à¥à¤•' :
                       roleKey === 'TTE' ? 'TTE à¤šà¥‡à¤•à¤¿à¤‚à¤— à¤¸à¥à¤Ÿà¤¾à¤«' :
                       roleKey === 'FinanceOfficer' || roleKey === 'AccountsOfficer' ? 'à¤µà¤¿à¤¤à¥à¤¤ à¤…à¤§à¤¿à¤•à¤¾à¤°à¥€' :
                       roleKey === 'StationMaster' ? 'à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤®à¤¾à¤¸à¥à¤Ÿà¤°' : roleKey}
                    </strong>
                    <span className="badge badge-bhakti" style={{ fontSize: '0.7rem' }}>
                      {rStats.bookingsCount || 0} à¤Ÿà¤¿à¤•à¤Ÿ
                    </span>
                  </div>

                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857', marginBottom: 6 }}>
                    â‚¹ {(rStats.totalCollected || 0).toLocaleString()}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#7C2D12' }}>
                    <span>à¤¨à¤•à¤¦: â‚¹{(rStats.cashCollected || 0).toLocaleString()}</span>
                    <span>UPI: â‚¹{(rStats.upiCollected || 0).toLocaleString()}</span>
                  </div>
                  {rStats.pendingDues > 0 && (
                    <div style={{ fontSize: '0.76rem', color: '#DC2626', marginTop: 4, fontWeight: 700 }}>
                      à¤¶à¥‡à¤· à¤¦à¥‡à¤¯: â‚¹{(rStats.pendingDues || 0).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff-by-Staff Table (Consolidated Panel) */}
        {!isPersonalOnly && (
          <div className="glass-card" style={{ marginBottom: 22, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Briefcase size={20} color="#C2410C" />
                <h4 style={{ color: '#9A3412', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€-à¤µà¤¾à¤° à¤¦à¥ˆà¤¨à¤¿à¤• à¤¸à¤‚à¤—à¥à¤°à¤¹ à¤à¤µà¤‚ à¤¹à¥ˆà¤‚à¤¡à¤“à¤µà¤° à¤°à¤œà¤¿à¤¸à¥à¤Ÿà¤°
                </h4>
              </div>
              <span className="badge badge-bhakti" style={{ fontSize: '0.74rem' }}>
                à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€: {staffBreakdown.length}
              </span>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ ID</th>
                    <th>à¤¨à¤¾à¤® (Staff Name)</th>
                    <th>à¤µà¤¿à¤­à¤¾à¤—</th>
                    <th>à¤°à¥‹à¤²</th>
                    <th>à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤‚à¤–à¥à¤¯à¤¾</th>
                    <th>à¤¨à¤•à¤¦ (Cash)</th>
                    <th>UPI</th>
                    <th>à¤›à¥‚à¤Ÿ (Discount)</th>
                    <th>à¤¶à¥‡à¤· à¤¬à¤•à¤¾à¤¯à¤¾</th>
                    <th>à¤•à¥à¤² à¤µà¤¸à¥‚à¤²à¥€ (Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {staffBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: 20, color: '#784D35' }}>
                        à¤•à¥‹à¤ˆ à¤¸à¥à¤Ÿà¤¾à¤« à¤¡à¥‡à¤Ÿà¤¾ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤
                      </td>
                    </tr>
                  ) : (
                    staffBreakdown.map(s => (
                      <tr key={s.staffId || s.username}>
                        <td><strong style={{ color: '#C2410C' }}>{s.staffId}</strong></td>
                        <td>
                          <strong>{s.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{s.username}</div>
                        </td>
                        <td><span className="badge badge-bhakti">{s.department}</span></td>
                        <td><strong style={{ color: '#9A3412' }}>{s.role}</strong></td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.bookingsCount || s.transactionCount || 0}</td>
                        <td style={{ color: '#047857', fontWeight: 700 }}>â‚¹ {(s.cashCollected || 0)?.toLocaleString()}</td>
                        <td style={{ color: '#0284C7', fontWeight: 700 }}>â‚¹ {(s.upiCollected || 0)?.toLocaleString()}</td>
                        <td style={{ color: '#D97706', fontWeight: 600 }}>â‚¹ {(s.discountsGiven || 0)?.toLocaleString()}</td>
                        <td style={{ color: '#DC2626', fontWeight: 600 }}>â‚¹ {(s.pendingDues || 0)?.toLocaleString()}</td>
                        <td style={{ fontWeight: 900, color: '#9A3412', fontSize: '1rem' }}>
                          â‚¹ {(s.totalCollected || 0)?.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Itemized Personal / Selected Transactions Table */}
        <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ color: '#9A3412', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {isPersonalOnly ? 'à¤®à¥‡à¤°à¥€ à¤µà¤¿à¤¸à¥à¤¤à¥ƒà¤¤ à¤µà¤¸à¥‚à¤²à¥€ à¤°à¤¸à¥€à¤¦à¥‡à¤‚ / à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤¸à¥‚à¤šà¥€' : 'à¤µà¤¿à¤¸à¥à¤¤à¥ƒà¤¤ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤‘à¤¡à¤¿à¤Ÿ à¤Ÿà¥à¤°à¥‡à¤² (Transaction Ledger)'}
            </h4>
            <span style={{ fontSize: '0.8rem', color: '#7C2D12' }}>
              à¤•à¥à¤² à¤ªà¥à¤°à¤µà¤¿à¤·à¥à¤Ÿà¤¿à¤¯à¤¾à¤‚: <strong>{transactions.length}</strong>
            </span>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>à¤¸à¤®à¤¯ (Time)</th>
                  <th>à¤•à¤¾à¤°à¥à¤¯à¤µà¤¾à¤¹à¥€ (Action)</th>
                  <th>PNR / à¤¸à¤‚à¤¦à¤°à¥à¤­ ID</th>
                  <th>à¤•à¥‹à¤š / à¤¸à¥€à¤Ÿ</th>
                  <th>à¤µà¤¸à¥‚à¤²à¥€ à¤°à¤¾à¤¶à¤¿</th>
                  <th>à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤®à¤¾à¤§à¥à¤¯à¤®</th>
                  <th>à¤µà¤¿à¤µà¤°à¤£ (Details)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#784D35' }}>
                      à¤šà¤¯à¤¨à¤¿à¤¤ à¤…à¤µà¤§à¤¿ à¤•à¥‡ à¤¦à¥Œà¤°à¤¾à¤¨ à¤•à¥‹à¤ˆ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.logId || tx.id || Math.random()}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {tx.formattedTime || new Date(tx.timestamp).toLocaleString('hi-IN')}
                      </td>
                      <td>
                        <span className="badge badge-bhakti" style={{ fontSize: '0.74rem' }}>
                          {tx.action === 'PAYMENT_COLLECTED' ? <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¦à¥‡à¤¯ à¤µà¤¸à¥‚à¤²à¥€</> : (tx.action === 'TICKET_BOOKED' ? <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£</> : tx.action)}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#C2410C' }}>{tx.targetId || tx.bookingId || '-'}</strong>
                      </td>
                      <td>
                        {tx.coachName || tx.coach ? `à¤•à¥‹à¤š ${tx.coachName || tx.coach} ${tx.seatNumber ? `(à¤¸à¥€à¤Ÿ ${tx.seatNumber})` : ''}` : '-'}
                      </td>
                      <td style={{ fontWeight: 900, color: tx.amount > 0 ? '#047857' : '#784D35' }}>
                        {tx.amount > 0 ? `â‚¹ ${tx.amount?.toLocaleString()}` : '-'}
                      </td>
                      <td>
                        <span className={`badge ${(tx.paymentMode || '').toLowerCase().includes('cash') ? 'badge-partial' : 'badge-paid'}`}>
                          {tx.paymentMode || 'None'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.84rem' }}>{tx.details || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER HELPER: DEDICATED RECEIPTS & PAYMENT SLIPS DESK VIEW
  // -------------------------------------------------------------
  const renderReceiptsDeskView = () => {
    const query = (receiptSearchQuery || '').toLowerCase().trim();
    const matchedBookings = adminBookings.filter(b => {
      if (!query) return true;
      return (
        (b.bookingId && b.bookingId.toLowerCase().includes(query)) ||
        (b.bookedBy && b.bookedBy.toLowerCase().includes(query)) ||
        (b.mobile && b.mobile.includes(query)) ||
        (b.aadhar && b.aadhar.includes(query)) ||
        (b.passengers && b.passengers.some(p => p.name && p.name.toLowerCase().includes(query)))
      );
    });

    return (
      <div>
        {/* Receipts Desk Hero / Header */}
        <div className="glass-card" style={{ border: '2.5px solid #F97316', marginBottom: 24, background: '#FFFDF9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="badge badge-bhakti" style={{ marginBottom: 6 }}>
                <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤°à¤¸à¥€à¤¦ à¤à¤µà¤‚ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤ªà¤°à¥à¤šà¥€ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°
              </span>
              <h2 style={{ color: '#9A3412', margin: '6px 0 4px', fontWeight: 900, fontSize: '1.6rem' }}>
                à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤°à¤¸à¥€à¤¦ à¤–à¥‹à¤œ à¤µ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤¡à¥‡à¤¸à¥à¤•
              </h2>
              <p style={{ color: '#7C2D12', margin: 0, fontSize: '0.9rem' }}>
                PNR à¤¨à¤‚à¤¬à¤°, à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ à¤•à¥‡ à¤¨à¤¾à¤® à¤¯à¤¾ 10-à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¥‡ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¸à¥‡ à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¥€ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤ªà¤°à¥à¤šà¤¿à¤¯à¤¾à¤‚ à¤–à¥‹à¤œà¥‡à¤‚ à¤”à¤° à¤‡à¤šà¥à¤›à¤¾à¤¨à¥à¤¸à¤¾à¤° à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚à¥¤
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {staffUser?.role === 'SuperAdmin' && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/dashboard')}>
                  â† à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡ à¤µà¤¾à¤ªà¤¸
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, background: '#FFF8F2', padding: 10, borderRadius: 12, border: '2px solid #FED7AA' }}>
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 8, color: '#C2410C' }}>
              <Search size={22} />
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="PNR à¤¨à¤‚à¤¬à¤° (à¤œà¥ˆà¤¸à¥‡ MVD-2026-...), à¤­à¤•à¥à¤¤ à¤•à¤¾ à¤¨à¤¾à¤®, à¤¯à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚..."
              value={receiptSearchQuery}
              onChange={(e) => setReceiptSearchQuery(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '1rem', fontWeight: 600, padding: '8px 12px' }}
            />
            {receiptSearchQuery && (
              <button className="btn btn-outline btn-sm" onClick={() => setReceiptSearchQuery('')} style={{ alignSelf: 'center' }}>
                âœ• à¤¸à¤¾à¤«à¤¼ à¤•à¤°à¥‡à¤‚
              </button>
            )}
          </div>
        </div>

        {/* Results Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h4 style={{ color: '#9A3412', margin: 0, fontWeight: 800 }}>
            à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤†à¤°à¤•à¥à¤·à¤£ à¤à¤µà¤‚ à¤°à¤¸à¥€à¤¦à¥‡à¤‚ ({matchedBookings.length})
          </h4>
          <span style={{ fontSize: '0.82rem', color: '#784D35' }}>
            {query ? `"${query}" à¤•à¥‡ à¤ªà¤°à¤¿à¤£à¤¾à¤®` : 'à¤¸à¤­à¥€ à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸'}
          </span>
        </div>

        {/* List of Matched Devotees / Bookings with their slips */}
        {matchedBookings.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 40, color: '#784D35' }}>
            <div style={{ fontSize: 24, marginBottom: 10, color: "#9CA3AF" }}><Search size={36} /></div>
            <h3>à¤•à¥‹à¤ˆ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾</h3>
            <p>à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¸à¤¹à¥€ PNR à¤¨à¤‚à¤¬à¤°, à¤¨à¤¾à¤® à¤¯à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¡à¤¾à¤²à¤•à¤° à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤•à¤°à¥‡à¤‚à¥¤</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {matchedBookings.map((b) => {
              // Build payment list
              let slips = b.paymentHistory && b.paymentHistory.length > 0 ? b.paymentHistory : [];
              if (slips.length === 0 && b.advance > 0) {
                slips = [{
                  id: 'REC-ADV-' + (b.bookingId ? b.bookingId.replace(/[^0-9]/g, '') : '001'),
                  date: b.createdAt || new Date().toISOString(),
                  amount: b.advance,
                  method: b.paymentMode || 'Cash',
                  type: 'Advance Booking (à¤…à¤—à¥à¤°à¤¿à¤® à¤¬à¥à¤•à¤¿à¤‚à¤—)',
                  cashierName: 'Counter Staff',
                  utr: b.utrNumber || ''
                }];
              }

              return (
                <div key={b.bookingId} className="glass-card" style={{ border: '2px solid #FED7AA', padding: 20, background: '#FFFFFF' }}>
                  {/* Devotee Header Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1.5px dashed #FED7AA', paddingBottom: 14, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="badge badge-bhakti" style={{ fontSize: '0.85rem' }}>
                          {b.yatraYear || 2026}
                        </span>
                        <strong style={{ fontSize: '1.25rem', color: '#C2410C' }}>
                          PNR: {b.bookingId}
                        </strong>
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1F2937', marginTop: 4 }}>
                        {b.bookedBy}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: 2 }}>
                        à¤®à¥‹à¤¬à¤¾à¤‡à¤²: <strong>{b.mobile || 'N/A'}</strong> {b.aadhar ? `| à¤†à¤§à¤¾à¤°: ${b.aadhar}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857' }}>
                        {b.fromStation} âž” {b.toStation}
                      </div>
                      <div style={{ fontSize: '0.84rem', marginTop: 2 }}>
                        à¤•à¥‹à¤š: <strong style={{ color: '#C2410C' }}>{b.coachName}</strong> | à¤¸à¥€à¤Ÿ: <strong style={{ color: '#1E40AF' }}>{Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber}</strong> ({b.travelClass})
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span className={`badge ${b.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-partial'}`}>
                          {b.paymentStatus === 'Paid' ? 'âœ“ à¤ªà¥‚à¤°à¥à¤£ à¤­à¥à¤—à¤¤à¤¾à¤¨ (Paid)' : `à¤¦à¥‡à¤¯ à¤¬à¤•à¤¾à¤¯à¤¾: â‚¹${b.remainingAmount}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Overview Chips */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 16 }}>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤•à¥à¤² à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¤¿à¤°à¤¾à¤¯à¤¾:</span>
                      <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.95rem' }}>â‚¹ {b.totalAmount}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤•à¥à¤² à¤œà¤®à¤¾ à¤°à¤¾à¤¶à¤¿:</span>
                      <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.95rem' }}>â‚¹ {b.advance}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤®à¥‡à¤‚ à¤¶à¥‡à¤· à¤¦à¥‡à¤¯:</span>
                      <div style={{ fontWeight: 800, color: b.remainingAmount > 0 ? '#DC2626' : '#047857', fontSize: '0.95rem' }}>
                        â‚¹ {b.remainingAmount}
                      </div>
                    </div>
                  </div>

                  {/* All Individual Slips / Receipts for this booking */}
                  <div>
                    <h5 style={{ color: '#9A3412', margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={16} /> à¤‡à¤¸ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¥€ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤ªà¤°à¥à¤šà¤¿à¤¯à¤¾à¤‚ / à¤°à¤¸à¥€à¤¦à¥‡à¤‚ ({slips.length}):
                    </h5>

                    {slips.length === 0 ? (
                      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, color: '#6B7280', fontSize: '0.85rem' }}>
                        à¤‡à¤¸ PNR à¤ªà¤° à¤…à¤­à¥€ à¤¤à¤• à¤•à¥‹à¤ˆ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¦à¤°à¥à¤œ à¤¨à¤¹à¥€à¤‚ à¤¹à¥à¤† à¤¹à¥ˆà¥¤
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {slips.map((txn, sIdx) => (
                          <div
                            key={txn.id || sIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 12,
                              background: '#FFFDF9',
                              border: '1.5px solid #FDE68A',
                              borderRadius: 10,
                              padding: '12px 16px',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ background: '#EA580C', color: '#FFF', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 800 }}>
                                  à¤°à¤¸à¥€à¤¦ #{sIdx + 1}
                                </span>
                                <strong style={{ color: '#C2410C', fontSize: '0.9rem' }}>
                                  {txn.id}
                                </strong>
                                <span style={{ color: '#047857', fontWeight: 800, fontSize: '1.05rem', marginLeft: 8 }}>
                                  â‚¹ {parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#4B5563', marginTop: 4 }}>
                                ðŸ“… {new Date(txn.date || Date.now()).toLocaleString('en-IN')} | à¤®à¤¾à¤§à¥à¤¯à¤®: <strong>{txn.method || 'Cash'}</strong> {txn.utr ? `(UTR: ${txn.utr})` : ''}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#6B7280', marginTop: 2 }}>
                                à¤µà¤¿à¤µà¤°à¤£: {txn.type || 'à¤­à¥à¤—à¤¤à¤¾à¤¨'} | à¤•à¥ˆà¤¶à¤¿à¤¯à¤°: <strong>{txn.cashierName || 'Counter Staff'}</strong>
                              </div>
                            </div>

                            {/* Action Buttons for this specific Slip */}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setReceiptModal({ booking: b, txn })}
                                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                              >
                                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤¯à¤¹ à¤°à¤¸à¥€à¤¦ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚
                              </button>
                              <a
                                href={`/api/bookings/${b.bookingId}/receipt/${txn.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                              >
                                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER HELPER: ADMIN DASHBOARD OVERVIEW VIEW
  // -------------------------------------------------------------
  const renderAdminDashboardView = () => {
    const stats = adminStats || {
      totalBookings: adminBookings.length,
      totalPassengers: adminBookings.reduce((s, b) => s + (Number(b.numberOfPassengers) || 1), 0),
      totalCollection: adminBookings.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0),
      totalAdvance: adminBookings.reduce((s, b) => s + (Number(b.advance) || 0), 0),
      totalRemaining: adminBookings.reduce((s, b) => s + (Number(b.remainingAmount) || 0), 0),
      totalDiscount: adminBookings.reduce((s, b) => s + (Number(b.discount) || 0), 0),
      totalTrainCapacity: 1000,
      overallOccupancyPercent: 0
    };

    const maxTimelineAmount = (stats.timelineData && stats.timelineData.length > 0)
      ? Math.max(...stats.timelineData.map(t => t.gross || t.advance || 1), 1000)
      : 1000;

    return (
      <div>
        {/* Top Executive Header & Filter Bar */}
        <div className="dash-header-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #FF6D00 0%, #C2410C 100%)',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(230,81,0,0.3)'
            }}>
              <LayoutDashboard size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, color: '#431407', fontWeight: 900, fontSize: '1.25rem' }}>
                  à¤•à¤¾à¤°à¥à¤¯à¤•à¤¾à¤°à¥€ à¤¨à¤¿à¤¯à¤‚à¤¤à¥à¤°à¤£ à¤•à¤•à¥à¤· (Executive Command Dashboard)
                </h3>
                <span className="badge badge-bhakti" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  Live Analytics
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7C2D12', marginTop: 2 }}>
                à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤µà¤¾à¤°à¥à¤·à¤¿à¤• à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¥à¤°à¥‡à¤¨ â€” à¤²à¤¾à¤‡à¤µ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤à¤µà¤‚ à¤ªà¤°à¤¿à¤šà¤¾à¤²à¤¨ à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '4px 8px', borderRadius: 8, border: '1.5px solid #FDBA74' }}>
              <CalendarDays size={16} color="#C2410C" />
              <select
                value={adminYearFilter}
                onChange={(e) => {
                  setAdminYearFilter(e.target.value);
                  setTimeout(() => loadAdminDashboard(), 50);
                }}
                style={{ border: 'none', background: 'transparent', fontWeight: 800, color: '#431407', outline: 'none', cursor: 'pointer', fontSize: '0.86rem' }}
              >
                <option value="2026">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· 2026 (à¤šà¤¾à¤²à¥‚)</option>
                <option value="2025">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· 2025</option>
                <option value="2024">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· 2024</option>
                <option value="">à¤¸à¤®à¤¸à¥à¤¤ à¤µà¤°à¥à¤· (All Seasons)</option>
              </select>
            </div>

            <button
              className="btn btn-outline btn-sm"
              onClick={loadAdminDashboard}
              title="à¤¡à¥‡à¤Ÿà¤¾ à¤°à¥€à¤«à¥à¤°à¥‡à¤¶ à¤•à¤°à¥‡à¤‚"
            >
              <RefreshCw size={15} /> à¤°à¥€à¤«à¥à¤°à¥‡à¤¶
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/admin/booking')}
            >
              <Plus size={15} /> à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£
            </button>
          </div>
        </div>

        {/* 1. Core Financial & Volume KPI Intelligence Strip (6 Responsive Cards) */}
        <div className="kpi-responsive-grid" style={{ marginBottom: 22 }}>
          {/* Card 1: Gross Ticket Value */}
          <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #C2410C' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.74rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>à¤•à¥à¤² à¤¸à¤•à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾</div>
              <IndianRupee size={16} color="#C2410C" />
            </div>
            <div className="kpi-num" style={{ fontSize: '1.85rem', fontWeight: 900, color: '#C2410C', margin: '4px 0', lineHeight: 1.1 }}>
              â‚¹ {(stats.totalCollection || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#784D35' }}>
              à¤¸à¤•à¤² à¤²à¤•à¥à¤·à¤¿à¤¤ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¾à¤œà¤¸à¥à¤µ
            </div>
          </div>

          {/* Card 2: Net Advance Received */}
          <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #047857' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.74rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤…à¤—à¥à¤°à¤¿à¤® (Net Collected)</div>
              <CheckCircle2 size={16} color="#047857" />
            </div>
            <div className="kpi-num" style={{ fontSize: '1.85rem', fontWeight: 900, color: '#047857', margin: '4px 0', lineHeight: 1.1 }}>
              â‚¹ {(stats.totalAdvance || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 700 }}>
              {stats.totalCollection > 0 ? Math.round(((stats.totalAdvance || 0) / stats.totalCollection) * 100) : 0}% à¤•à¥à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤µà¤¸à¥‚à¤²
            </div>
          </div>

          {/* Card 3: Outstanding Remaining Dues */}
          <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #DC2626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.74rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿ (Outstanding)</div>
              <AlertTriangle size={16} color="#DC2626" />
            </div>
            <div className="kpi-num" style={{ fontSize: '1.85rem', fontWeight: 900, color: '#DC2626', margin: '4px 0', lineHeight: 1.1 }}>
              â‚¹ {(stats.totalRemaining || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#991B1B' }}>
              à¤Ÿà¥à¤°à¥‡à¤¨/à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤ªà¤° à¤µà¤¸à¥‚à¤²à¥€ à¤¯à¥‹à¤—à¥à¤¯
            </div>
          </div>

          {/* Card 4: Total Discount Conceded */}
          <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #D97706' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.74rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>à¤•à¥à¤² à¤›à¥‚à¤Ÿ à¤µ à¤°à¤¿à¤¯à¤¾à¤¯à¤¤</div>
              <Percent size={16} color="#D97706" />
            </div>
            <div className="kpi-num" style={{ fontSize: '1.85rem', fontWeight: 900, color: '#D97706', margin: '4px 0', lineHeight: 1.1 }}>
              â‚¹ {(stats.totalDiscount || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#92400E' }}>
              {stats.discountStats?.discountedTicketsCount || 0} à¤Ÿà¤¿à¤•à¤Ÿà¥‹à¤‚ à¤ªà¤° à¤Ÿà¥à¤°à¤¸à¥à¤Ÿà¥€ à¤›à¥‚à¤Ÿ
            </div>
          </div>

          {/* Card 5: Pilgrims & Tickets Count */}
          <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #2563EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.74rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥</div>
              <Users size={16} color="#2563EB" />
            </div>
            <div className="kpi-num" style={{ fontSize: '1.85rem', fontWeight: 900, color: '#2563EB', margin: '4px 0', lineHeight: 1.1 }}>
              {stats.totalPassengers || 0}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#1E40AF' }}>
              {stats.totalBookings || 0} PNR à¤Ÿà¤¿à¤•à¤Ÿà¥‹à¤‚ à¤®à¥‡à¤‚ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤
            </div>
          </div>

          {/* Card 6: Train Capacity Occupancy Rate */}
          <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #7C3AED' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.74rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>à¤Ÿà¥à¤°à¥‡à¤¨ à¤²à¤¾à¤‡à¤µ à¤‘à¤•à¥à¤¯à¥‚à¤ªà¥‡à¤‚à¤¸à¥€</div>
              <TrendingUp size={16} color="#7C3AED" />
            </div>
            <div className="kpi-num" style={{ fontSize: '1.85rem', fontWeight: 900, color: '#7C3AED', margin: '4px 0', lineHeight: 1.1 }}>
              {stats.overallOccupancyPercent || 0}%
            </div>
            <div style={{ fontSize: '0.76rem', color: '#5B21B6' }}>
              {stats.totalPassengers || 0} / {stats.totalTrainCapacity || 1000} à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤­à¤°à¥€à¤‚
            </div>
          </div>
        </div>

        {/* 2. Train Capacity & Live Occupancy Multi-Tier Progress Tracker */}
        <div className="glass-card" style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Train size={20} /> à¤Ÿà¥à¤°à¥‡à¤¨ à¤•à¥à¤·à¤®à¤¤à¤¾ à¤à¤µà¤‚ à¤²à¤¾à¤‡à¤µ à¤¸à¥€à¤Ÿ à¤‘à¤•à¥à¤¯à¥‚à¤ªà¥‡à¤‚à¤¸à¥€ à¤ªà¥à¤°à¥‹à¤—à¥à¤°à¥‡à¤¸ (Train Capacity Progress)
              </h4>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', marginTop: 2 }}>
                18 à¤•à¥‹à¤š à¤¸à¥à¤ªà¥‡à¤¶à¤² à¤°à¥ˆà¤• â€¢ à¤•à¥à¤² à¤•à¥à¤·à¤®à¤¤à¤¾: {stats.totalTrainCapacity || 1000} à¤¸à¥€à¤Ÿà¥‡à¤‚ â€¢ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤: {stats.totalPassengers || 0} à¤¸à¥€à¤Ÿà¥‡à¤‚ ({stats.overallOccupancyPercent || 0}%)
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/chart')}>
              <Armchair size={15} /> à¤¸à¤®à¥à¤ªà¥‚à¤°à¥à¤£ à¤¸à¥€à¤Ÿà¤¿à¤‚à¤— à¤šà¤¾à¤°à¥à¤Ÿ à¤¦à¥‡à¤–à¥‡à¤‚ âž”
            </button>
          </div>

          {/* Master Progress Bar */}
          <div className="dash-progress-track" style={{ height: 16, marginBottom: 14 }}>
            <div
              className="dash-progress-fill bhagwa"
              style={{ width: `${Math.min(100, Math.max(0, stats.overallOccupancyPercent || 0))}%` }}
              title={`à¤Ÿà¥à¤°à¥‡à¤¨ à¤‘à¤•à¥à¤¯à¥‚à¤ªà¥‡à¤‚à¤¸à¥€: ${stats.overallOccupancyPercent}%`}
            />
          </div>

          {/* Class Breakdown 3-Grid */}
          <div className="grid-3" style={{ gap: 12 }}>
            {/* Sleeper Class */}
            <div style={{ background: '#FFF7ED', border: '1.5px solid #FDBA74', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#9A3412', fontSize: '0.88rem' }}>ðŸ›ï¸ à¤¸à¥à¤²à¥€à¤ªà¤° à¤•à¥à¤²à¤¾à¤¸ (Sleeper)</span>
                <span className="badge badge-bhakti" style={{ fontSize: '0.75rem' }}>
                  {stats.classStats?.Sleeper?.capacity ? Math.round(((stats.classStats?.Sleeper?.booked || 0) / stats.classStats.Sleeper.capacity) * 100) : 0}%
                </span>
              </div>
              <div className="dash-progress-track" style={{ height: 8, marginBottom: 6 }}>
                <div
                  className="dash-progress-fill orange"
                  style={{ width: `${stats.classStats?.Sleeper?.capacity ? Math.min(100, Math.round(((stats.classStats?.Sleeper?.booked || 0) / stats.classStats.Sleeper.capacity) * 100)) : 0}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#7C2D12' }}>
                <span>à¤†à¤°à¤•à¥à¤·à¤¿à¤¤: <strong>{stats.classStats?.Sleeper?.booked || 0}</strong> / {stats.classStats?.Sleeper?.capacity || 432}</span>
                <span>à¤°à¤¾à¤œà¤¸à¥à¤µ: <strong>â‚¹{(stats.classStats?.Sleeper?.revenue || 0).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* AC Class */}
            <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#1E40AF', fontSize: '0.88rem' }}>â„ï¸ à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ (AC 3A / 2A)</span>
                <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                  {stats.classStats?.AC?.capacity ? Math.round(((stats.classStats?.AC?.booked || 0) / stats.classStats.AC.capacity) * 100) : 0}%
                </span>
              </div>
              <div className="dash-progress-track" style={{ height: 8, marginBottom: 6, background: '#DBEAFE' }}>
                <div
                  className="dash-progress-fill blue"
                  style={{ width: `${stats.classStats?.AC?.capacity ? Math.min(100, Math.round(((stats.classStats?.AC?.booked || 0) / stats.classStats.AC.capacity) * 100)) : 0}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#1E40AF' }}>
                <span>à¤†à¤°à¤•à¥à¤·à¤¿à¤¤: <strong>{stats.classStats?.AC?.booked || 0}</strong> / {stats.classStats?.AC?.capacity || 378}</span>
                <span>à¤°à¤¾à¤œà¤¸à¥à¤µ: <strong>â‚¹{(stats.classStats?.AC?.revenue || 0).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* General & SLR Class */}
            <div style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#065F46', fontSize: '0.88rem' }}>ðŸ‘¥ à¤¸à¤¾à¤®à¤¾à¤¨à¥à¤¯ à¤µ à¤¦à¤¿à¤µà¥à¤¯à¤¾à¤‚à¤— (General/SLR)</span>
                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                  {stats.classStats?.General?.capacity ? Math.round(((stats.classStats?.General?.booked || 0) / stats.classStats.General.capacity) * 100) : 0}%
                </span>
              </div>
              <div className="dash-progress-track" style={{ height: 8, marginBottom: 6, background: '#D1FAE5' }}>
                <div
                  className="dash-progress-fill green"
                  style={{ width: `${stats.classStats?.General?.capacity ? Math.min(100, Math.round(((stats.classStats?.General?.booked || 0) / stats.classStats.General.capacity) * 100)) : 0}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#065F46' }}>
                <span>à¤†à¤°à¤•à¥à¤·à¤¿à¤¤: <strong>{stats.classStats?.General?.booked || 0}</strong> / {stats.classStats?.General?.capacity || 200}</span>
                <span>à¤°à¤¾à¤œà¤¸à¥à¤µ: <strong>â‚¹{(stats.classStats?.General?.revenue || 0).toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Interactive 2-Column: Collection Timeline Graph & Payment Modes Split */}
        <div className="grid-2" style={{ marginBottom: 22, alignItems: 'stretch' }}>
          {/* Left: Daily Collection Progress Graph */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={18} /> à¤¦à¥ˆà¤¨à¤¿à¤• à¤†à¤°à¤•à¥à¤·à¤£ à¤µ à¤¸à¤‚à¤—à¥à¤°à¤¹ à¤Ÿà¥à¤°à¥‡à¤‚à¤¡ (Collection Velocity Graph)
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤¦à¥ˆà¤¨à¤¿à¤• à¤¬à¥à¤•à¤¿à¤‚à¤— à¤ªà¥à¤°à¤µà¤¾à¤¹ à¤à¤µà¤‚ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ (â‚¹)</div>
              </div>
              <span className="badge badge-bhakti" style={{ fontSize: '0.72rem' }}>Timeline Progress</span>
            </div>

            {stats.timelineData && stats.timelineData.length > 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="dash-chart-container">
                  {stats.timelineData.slice(-14).map((item, idx) => {
                    const heightPercent = Math.max(12, Math.min(100, Math.round(((item.gross || item.advance || 1) / maxTimelineAmount) * 100)));
                    const tooltipText = `${item.date}: â‚¹${(item.gross || item.advance || 0).toLocaleString()} (${item.bookings} à¤Ÿà¤¿à¤•à¤Ÿà¥‡à¤‚, ${item.passengers} à¤¯à¤¾à¤¤à¥à¤°à¥€)`;
                    return (
                      <div key={idx} className="dash-chart-col">
                        <div
                          className="dash-chart-bar"
                          style={{ height: `${heightPercent}%` }}
                          data-tooltip={tooltipText}
                        />
                        <div style={{ fontSize: '0.66rem', color: '#7C2D12', marginTop: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {item.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#784D35', borderTop: '1px solid #FED7AA', paddingTop: 8, marginTop: 6 }}>
                  <span>ðŸ“Š à¤¬à¤¾à¤° à¤ªà¤° à¤¹à¥‹à¤µà¤° à¤•à¤°à¤•à¥‡ à¤µà¤¿à¤¸à¥à¤¤à¥ƒà¤¤ à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¿à¤µà¤°à¤£ à¤¦à¥‡à¤–à¥‡à¤‚</span>
                  <span><strong>{stats.timelineData.length}</strong> à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¤à¤¿à¤¥à¤¿à¤¯à¤¾à¤‚</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9A3412', fontSize: '0.86rem' }}>
                à¤…à¤­à¥€ à¤‡à¤¸ à¤¸à¤¤à¥à¤° à¤®à¥‡à¤‚ à¤•à¥‹à¤ˆ à¤¦à¤¿à¤¨à¤¾à¤‚à¤•-à¤µà¤¾à¤° à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤
              </div>
            )}
          </div>

          {/* Right: Payment Modes Breakdown */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QrCode size={18} /> à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤®à¤¾à¤§à¥à¤¯à¤® à¤µà¤°à¥à¤—à¥€à¤•à¤°à¤£ (Payment Modes Split)
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤¨à¤•à¤¦ à¤¬à¤¨à¤¾à¤® à¤¯à¥‚à¤ªà¥€à¤†à¤ˆ à¤¬à¤¨à¤¾à¤® à¤¬à¥ˆà¤‚à¤•/à¤…à¤¨à¥à¤¯ à¤®à¤¾à¤§à¥à¤¯à¤®</div>
              </div>
              <button className="btn btn-outline btn-xs" onClick={() => navigate('/admin/reconcile')}>
                à¤¸à¤®à¤¾à¤§à¤¾à¤¨ à¤²à¥‡à¤œà¤° âž”
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
              {/* Mode 1: Cash */}
              <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, color: '#9A3412', fontSize: '0.85rem' }}>ðŸ’µ à¤¨à¤•à¤¦ (Cash Collection)</span>
                  <span style={{ fontWeight: 900, color: '#C2410C', fontSize: '0.95rem' }}>
                    â‚¹ {(stats.paymentModes?.cash?.amount || 0).toLocaleString()}
                    <span style={{ fontSize: '0.74rem', color: '#7C2D12', marginLeft: 4 }}>({stats.paymentModes?.cash?.percent || 0}%)</span>
                  </span>
                </div>
                <div className="dash-progress-track" style={{ height: 8 }}>
                  <div className="dash-progress-fill orange" style={{ width: `${stats.paymentModes?.cash?.percent || 0}%` }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#784D35', marginTop: 4 }}>
                  {stats.paymentModes?.cash?.count || 0} à¤¨à¤•à¤¦ à¤°à¤¸à¥€à¤¦à¥‡à¤‚ à¤œà¤®à¤¾
                </div>
              </div>

              {/* Mode 2: UPI / QR */}
              <div style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, color: '#065F46', fontSize: '0.85rem' }}>ðŸ“± UPI / à¤•à¥à¤¯à¥‚à¤†à¤° à¤•à¥‹à¤¡ (Online UPI)</span>
                  <span style={{ fontWeight: 900, color: '#047857', fontSize: '0.95rem' }}>
                    â‚¹ {(stats.paymentModes?.upi?.amount || 0).toLocaleString()}
                    <span style={{ fontSize: '0.74rem', color: '#065F46', marginLeft: 4 }}>({stats.paymentModes?.upi?.percent || 0}%)</span>
                  </span>
                </div>
                <div className="dash-progress-track" style={{ height: 8, background: '#D1FAE5' }}>
                  <div className="dash-progress-fill green" style={{ width: `${stats.paymentModes?.upi?.percent || 0}%` }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#065F46', marginTop: 4 }}>
                  {stats.paymentModes?.upi?.count || 0} à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤•à¥à¤¯à¥‚à¤†à¤° à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤°à¤¸à¥€à¤¦à¥‡à¤‚
                </div>
              </div>

              {/* Mode 3: Bank / Other */}
              <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, color: '#1E40AF', fontSize: '0.85rem' }}>ðŸ¦ à¤¬à¥ˆà¤‚à¤• à¤Ÿà¥à¤°à¤¾à¤‚à¤¸à¤«à¤° / UTR</span>
                  <span style={{ fontWeight: 900, color: '#1D4ED8', fontSize: '0.95rem' }}>
                    â‚¹ {(stats.paymentModes?.other?.amount || 0).toLocaleString()}
                    <span style={{ fontSize: '0.74rem', color: '#1E40AF', marginLeft: 4 }}>({stats.paymentModes?.other?.percent || 0}%)</span>
                  </span>
                </div>
                <div className="dash-progress-track" style={{ height: 8, background: '#DBEAFE' }}>
                  <div className="dash-progress-fill blue" style={{ width: `${stats.paymentModes?.other?.percent || 0}%` }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#1E40AF', marginTop: 4 }}>
                  {stats.paymentModes?.other?.count || 0} à¤ªà¥à¤°à¤¤à¥à¤¯à¤•à¥à¤· à¤¬à¥ˆà¤‚à¤• / UTR à¤°à¤¸à¥€à¤¦à¥‡à¤‚
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Staff & Counter Performance Leaderboard (Staff Graph & Ranking) */}
        <div className="glass-card" style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Crown size={20} color="#D97706" /> à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤µ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤¨à¤¿à¤·à¥à¤ªà¤¾à¤¦à¤¨ à¤²à¥€à¤¡à¤°à¤¬à¥‹à¤°à¥à¤¡ (Staff Performance & Booking Graph)
              </h4>
              <div style={{ fontSize: '0.76rem', color: '#7C2D12', marginTop: 2 }}>
                à¤•à¤¿à¤¸ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ / à¤²à¤¿à¤ªà¤¿à¤• à¤¨à¥‡ à¤•à¤¿à¤¤à¤¨à¥€ à¤Ÿà¤¿à¤•à¤Ÿà¥‡à¤‚ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤•à¥€à¤‚, à¤•à¤¿à¤¤à¤¨à¤¾ à¤¨à¤•à¤¦ à¤µ à¤¯à¥‚à¤ªà¥€à¤†à¤ˆ à¤¸à¤‚à¤—à¥à¤°à¤¹ à¤•à¤¿à¤¯à¤¾
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/staff')}>
              <Users size={15} /> à¤¸à¥à¤Ÿà¤¾à¤« à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨ âž”
            </button>
          </div>

          {stats.staffLeaderboard && stats.staffLeaderboard.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.staffLeaderboard.map((st, idx) => {
                const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-default';
                const sharePercent = stats.totalCollection > 0 ? Math.round(((st.grossCollection || 0) / stats.totalCollection) * 100) : 0;
                return (
                  <div key={idx} className="dash-leaderboard-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, flex: 1 }}>
                      <div className={`dash-rank-badge ${rankClass}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#431407', fontSize: '0.92rem' }}>
                          {st.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#7C2D12', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span className="badge badge-bhakti" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                            {st.role}
                          </span>
                          <span>â€¢ {st.bookingsCount} à¤Ÿà¤¿à¤•à¤Ÿà¥‡à¤‚ ({st.passengersCount} à¤¯à¤¾à¤¤à¥à¤°à¥€)</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#784D35', textTransform: 'uppercase', fontWeight: 700 }}>à¤¸à¤•à¤² à¤¸à¤‚à¤—à¥à¤°à¤¹</div>
                        <div style={{ fontWeight: 900, color: '#047857', fontSize: '1rem' }}>
                          â‚¹ {(st.grossCollection || 0).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#784D35', textTransform: 'uppercase', fontWeight: 700 }}>à¤¨à¤•à¤¦ / à¤¯à¥‚à¤ªà¥€à¤†à¤ˆ</div>
                        <div style={{ fontSize: '0.78rem', color: '#431407', fontWeight: 700 }}>
                          à¤¨à¤•à¤¦: â‚¹{(st.cashAmount || 0).toLocaleString()} | UPI: â‚¹{(st.upiAmount || 0).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 90 }}>
                        <div style={{ fontSize: '0.7rem', color: '#784D35', textTransform: 'uppercase', fontWeight: 700 }}>à¤›à¥‚à¤Ÿ à¤¦à¥€ à¤—à¤ˆ</div>
                        <div style={{ fontSize: '0.84rem', color: '#D97706', fontWeight: 800 }}>
                          â‚¹ {(st.discountGiven || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: '#9A3412', fontSize: '0.88rem' }}>
              à¤…à¤­à¥€ à¤•à¥‹à¤ˆ à¤¸à¥à¤Ÿà¤¾à¤« à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¡à¥‡à¤Ÿà¤¾ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤
            </div>
          )}
        </div>

        {/* 5. Coach-by-Coach Live Utilization Heatmap Matrix (16+ Coaches) */}
        <div className="glass-card" style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={20} /> à¤•à¥‹à¤š-à¤µà¤¾à¤° à¤²à¤¾à¤‡à¤µ à¤‘à¤•à¥à¤¯à¥‚à¤ªà¥‡à¤‚à¤¸à¥€ à¤®à¥ˆà¤Ÿà¥à¤°à¤¿à¤•à¥à¤¸ (Coach Utilization Heatmap)
              </h4>
              <div style={{ fontSize: '0.76rem', color: '#7C2D12', marginTop: 2 }}>
                à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤¬à¥‹à¤—à¥€ à¤•à¥€ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤µ à¤°à¤¿à¤•à¥à¤¤ à¤¸à¥€à¤Ÿà¥‡à¤‚ â€” à¤•à¥‹à¤š à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤‰à¤¸à¤•à¤¾ à¤¸à¥€à¤Ÿà¤¿à¤‚à¤— à¤šà¤¾à¤°à¥à¤Ÿ à¤–à¥‹à¤²à¥‡à¤‚
              </div>
            </div>
            <span className="badge badge-bhakti" style={{ fontSize: '0.75rem' }}>
              16 à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚
            </span>
          </div>

          <div className="dash-coach-grid">
            {(stats.coachMatrix && stats.coachMatrix.length > 0 ? stats.coachMatrix : [
              { coachCode: 'S1', coachName: 'à¤¸à¥à¤²à¥€à¤ªà¤° S1', capacity: 72, booked: stats.coachStats?.S1 || 0, occupancy: 0 },
              { coachCode: 'S2', coachName: 'à¤¸à¥à¤²à¥€à¤ªà¤° S2', capacity: 72, booked: stats.coachStats?.S2 || 0, occupancy: 0 },
              { coachCode: 'S3', coachName: 'à¤¸à¥à¤²à¥€à¤ªà¤° S3', capacity: 72, booked: stats.coachStats?.S3 || 0, occupancy: 0 },
              { coachCode: 'S4', coachName: 'à¤¸à¥à¤²à¥€à¤ªà¤° S4', capacity: 72, booked: stats.coachStats?.S4 || 0, occupancy: 0 },
              { coachCode: 'S5', coachName: 'à¤¸à¥à¤²à¥€à¤ªà¤° S5', capacity: 72, booked: stats.coachStats?.S5 || 0, occupancy: 0 },
              { coachCode: 'S6', coachName: 'à¤¸à¥à¤²à¥€à¤ªà¤° S6', capacity: 72, booked: stats.coachStats?.S6 || 0, occupancy: 0 },
              { coachCode: 'B1', coachName: 'à¤¥à¤°à¥à¤¡ à¤à¤¸à¥€ B1', capacity: 72, booked: stats.coachStats?.B1 || 0, occupancy: 0 },
              { coachCode: 'B2', coachName: 'à¤¥à¤°à¥à¤¡ à¤à¤¸à¥€ B2', capacity: 72, booked: stats.coachStats?.B2 || 0, occupancy: 0 },
              { coachCode: 'B3', coachName: 'à¤¥à¤°à¥à¤¡ à¤à¤¸à¥€ B3', capacity: 72, booked: stats.coachStats?.B3 || 0, occupancy: 0 },
              { coachCode: 'A1', coachName: 'à¤¸à¥‡à¤•à¤‚à¤¡ à¤à¤¸à¥€ A1', capacity: 54, booked: stats.coachStats?.A1 || 0, occupancy: 0 },
              { coachCode: 'A2', coachName: 'à¤¸à¥‡à¤•à¤‚à¤¡ à¤à¤¸à¥€ A2', capacity: 54, booked: stats.coachStats?.A2 || 0, occupancy: 0 },
              { coachCode: 'A3', coachName: 'à¤¸à¥‡à¤•à¤‚à¤¡ à¤à¤¸à¥€ A3', capacity: 54, booked: stats.coachStats?.A3 || 0, occupancy: 0 },
              { coachCode: 'GS1', coachName: 'à¤œà¤¨à¤°à¤² GS1', capacity: 80, booked: stats.coachStats?.GS1 || 0, occupancy: 0 },
              { coachCode: 'GS2', coachName: 'à¤œà¤¨à¤°à¤² GS2', capacity: 80, booked: stats.coachStats?.GS2 || 0, occupancy: 0 },
              { coachCode: 'SLR1', coachName: 'à¤à¤¸à¤à¤²à¤†à¤° 1', capacity: 20, booked: stats.coachStats?.SLR1 || 0, occupancy: 0 },
              { coachCode: 'SLR2', coachName: 'à¤à¤¸à¤à¤²à¤†à¤° 2', capacity: 20, booked: stats.coachStats?.SLR2 || 0, occupancy: 0 }
            ]).map((c, idx) => {
              const booked = c.booked || (stats.coachStats && stats.coachStats[c.coachCode]) || 0;
              const cap = c.capacity || 72;
              const occPercent = cap > 0 ? Math.min(100, Math.round((booked / cap) * 100)) : 0;
              const statusClass = occPercent >= 95 ? 'full' : occPercent >= 70 ? 'almost' : 'available';
              const progressColor = occPercent >= 95 ? 'red' : occPercent >= 70 ? 'orange' : 'green';

              return (
                <div
                  key={idx}
                  className={`dash-coach-card ${statusClass}`}
                  onClick={() => {
                    setChartCoach(c.coachCode);
                    navigate('/admin/chart');
                  }}
                  title={`à¤•à¥‹à¤š ${c.coachCode} à¤•à¤¾ à¤šà¤¾à¤°à¥à¤Ÿ à¤¦à¥‡à¤–à¥‡à¤‚`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 900, color: '#431407', fontSize: '0.98rem' }}>{c.coachCode}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: occPercent >= 95 ? '#DC2626' : occPercent >= 70 ? '#D97706' : '#059669' }}>
                      {occPercent}%
                    </span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: '#7C2D12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 6 }}>
                    {c.coachName}
                  </div>

                  <div className="dash-progress-track" style={{ height: 6, marginBottom: 6 }}>
                    <div className={`dash-progress-fill ${progressColor}`} style={{ width: `${occPercent}%` }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#784D35', fontWeight: 700 }}>
                    <span>à¤­à¤°à¥€: {booked}</span>
                    <span>à¤¶à¥‡à¤·: {Math.max(0, cap - booked)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Boarding Stations Distribution & On-Train Attendance Grid */}
        <div className="grid-2" style={{ marginBottom: 22, alignItems: 'stretch' }}>
          {/* Left: Top Boarding Stations */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Train size={18} /> à¤ªà¥à¤°à¤®à¥à¤– à¤¬à¥‹à¤°à¥à¤¡à¤¿à¤‚à¤— à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤µà¤¿à¤¤à¤°à¤£ (Boarding Hubs)
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¤¿à¤¸ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¸à¥‡ à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤¸à¤µà¤¾à¤° à¤¹à¥‹à¤‚à¤—à¥‡</div>
              </div>
              <span className="badge badge-bhakti" style={{ fontSize: '0.72rem' }}>à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¶à¥‡à¤¯à¤°</span>
            </div>

            {stats.boardingStations && stats.boardingStations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.boardingStations.slice(0, 6).map((stn, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#431407', marginBottom: 4 }}>
                      <span>ðŸ“ {stn.station}</span>
                      <span>{stn.passengers} à¤¯à¤¾à¤¤à¥à¤°à¥€ ({stn.percentage}%)</span>
                    </div>
                    <div className="dash-progress-track" style={{ height: 7 }}>
                      <div className="dash-progress-fill orange" style={{ width: `${stn.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: '#9A3412', fontSize: '0.84rem' }}>
                à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¡à¥‡à¤Ÿà¤¾ à¤ªà¥à¤°à¥‹à¤¸à¥‡à¤¸ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...
              </div>
            )}
          </div>

          {/* Right: Journey Attendance & Verification Status */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, color: '#9A3412', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BadgeCheck size={18} /> à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ (Attendance Status)
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤šà¤² à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¤°à¥€à¤•à¥à¤·à¤• (TTE) à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤¸à¥à¤¥à¤¿à¤¤à¤¿</div>
              </div>
              <button className="btn btn-outline btn-xs" onClick={() => navigate('/admin/checkin')}>
                à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸ âž”
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Boarded / Present */}
              <div style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#065F46', fontSize: '0.88rem' }}>ðŸŸ¢ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ / à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤¸à¤µà¤¾à¤° (Boarded)</div>
                  <div style={{ fontSize: '0.72rem', color: '#047857' }}>TTE à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤­à¥Œà¤¤à¤¿à¤• à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857' }}>{stats.checkinStats?.present || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#065F46', fontWeight: 700 }}>{stats.checkinStats?.boardedPercent || 0}%</div>
                </div>
              </div>

              {/* Absent */}
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.88rem' }}>ðŸ”´ à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤ (Absent / Missed)</div>
                  <div style={{ fontSize: '0.72rem', color: '#DC2626' }}>à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ à¤¨à¤¹à¥€à¤‚ à¤¹à¥à¤</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DC2626' }}>{stats.checkinStats?.absent || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#991B1B', fontWeight: 700 }}>à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                </div>
              </div>

              {/* Pending */}
              <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#92400E', fontSize: '0.88rem' }}>ðŸŸ¡ à¤ªà¥à¤°à¤¤à¥€à¤•à¥à¤·à¤¾à¤°à¤¤ (Pending Boarding)</div>
                  <div style={{ fontSize: '0.72rem', color: '#D97706' }}>à¤†à¤—à¤¾à¤®à¥€ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨à¥‹à¤‚ à¤¸à¥‡ à¤¸à¤µà¤¾à¤° à¤¹à¥‹à¤¨à¥‡ à¤µà¤¾à¤²à¥‡</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#D97706' }}>{stats.checkinStats?.pending || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#92400E', fontWeight: 700 }}>à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7. All Project Features Master Command Grid for SuperAdmin */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ color: '#9A3412', margin: 0, fontWeight: 900, fontSize: '1.22rem' }}>
              à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤¨à¤¿à¤¯à¤‚à¤¤à¥à¤°à¤£ à¤•à¤•à¥à¤· â€” à¤¸à¤®à¤¸à¥à¤¤ à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤®à¥‰à¤¡à¥à¤¯à¥‚à¤²
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#7C2D12', marginTop: 2 }}>All Project Features & Control Desks</div>
          </div>
          <span className="badge badge-bhakti" style={{ fontSize: '0.82rem', padding: '4px 12px' }}>12 à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤®à¥‰à¤¡à¥à¤¯à¥‚à¤²</span>
        </div>

        <div className="module-hub-grid">
          {/* Feature 1: Live Booking Counter */}
          <div className="module-card" onClick={() => navigate('/admin/booking')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <Ticket size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">1. à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°</h4>
                <p className="module-card-desc">à¤¨à¤¯à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤†à¤°à¤•à¥à¤·à¤£, à¤¤à¤¤à¥à¤•à¤¾à¤² à¤¸à¥€à¤Ÿ à¤†à¤µà¤‚à¤Ÿà¤¨ à¤µ à¤¥à¤°à¥à¤®à¤² à¤ªà¤°à¥à¤šà¥€ à¤œà¤¾à¤°à¥€ à¤•à¤°à¥‡à¤‚à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 2: All Bookings Directory */}
          <div className="module-card" onClick={() => navigate('/admin/bookings')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <ClipboardList size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">2. à¤†à¤°à¤•à¥à¤·à¤£ à¤¡à¤¾à¤¯à¤°à¥‡à¤•à¥à¤Ÿà¤°à¥€</h4>
                <p className="module-card-desc">à¤¸à¤­à¥€ à¤µà¤°à¥à¤·à¥‹à¤‚ à¤•à¥€ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤Ÿà¤¿à¤•à¤Ÿà¥‡à¤‚ à¤–à¥‹à¤œà¥‡à¤‚, à¤ªà¤°à¥à¤šà¥€ à¤¦à¥‡à¤–à¥‡à¤‚ à¤µ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 3: Receipts & Slips Desk */}
          <div className="module-card" onClick={() => navigate('/admin/receipts')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <FileText size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">3. à¤°à¤¸à¥€à¤¦ à¤à¤µà¤‚ à¤ªà¤°à¥à¤šà¥€ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°</h4>
                <p className="module-card-desc">PNR, à¤¨à¤¾à¤® à¤¯à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¸à¥‡ à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¥€ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤°à¤¸à¥€à¤¦à¥‡à¤‚ à¤–à¥‹à¤œà¥‡à¤‚ à¤µ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 4: IRCTC Seating Chart */}
          <div className="module-card" onClick={() => navigate('/admin/chart')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <Printer size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">4. IRCTC à¤¸à¥€à¤Ÿà¤¿à¤‚à¤— à¤šà¤¾à¤°à¥à¤Ÿ</h4>
                <p className="module-card-desc">à¤°à¥‡à¤²à¤µà¥‡ à¤•à¥‹à¤š S1-S6, B1-B3, GS1 à¤•à¤¾ à¤¸à¥€à¤Ÿà¤¿à¤‚à¤— à¤šà¤¾à¤°à¥à¤Ÿ à¤¦à¥‡à¤–à¥‡à¤‚ à¤à¤µà¤‚ A4 à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤²à¥‡à¤‚à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 5: On-Train Check-in Attendance */}
          <div className="module-card" onClick={() => navigate('/admin/checkin')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <BadgeCheck size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">5. à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸</h4>
                <p className="module-card-desc">à¤šà¤² à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¤°à¥€à¤•à¥à¤·à¤• (TTE) à¤²à¤¾à¤‡à¤µ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤…à¤‚à¤•à¤¨à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 6: Daily Collection & Ledger */}
          <div className="module-card" onClick={() => navigate('/admin/reconcile')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap" style={{ color: '#047857', background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', borderColor: '#A7F3D0' }}>
                <IndianRupee size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">6. à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤µ à¤¸à¤®à¤¾à¤§à¤¾à¤¨</h4>
                <p className="module-card-desc">à¤¤à¤¿à¤¥à¤¿-à¤µà¤¾à¤° à¤¸à¤®à¤¸à¥à¤¤ à¤Ÿà¥€à¤Ÿà¥€à¤ˆ à¤µ à¤¸à¥à¤Ÿà¤¾à¤« à¤µà¤¸à¥‚à¤²à¥€, à¤¨à¤•à¤¦, à¤¯à¥‚à¤ªà¥€à¤†à¤ˆ à¤µ à¤ªà¤¾à¤ˆ-à¤ªà¤¾à¤ˆ à¤•à¤¾ à¤¹à¤¿à¤¸à¤¾à¤¬à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 7: Anti-Fraud Verifier & UTR */}
          <div className="module-card" onClick={() => navigate('/admin/verifier')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <Search size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">7. à¤à¤‚à¤Ÿà¥€-à¤«à¥à¤°à¥‰à¤¡ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ UTR</h4>
                <p className="module-card-desc">à¤«à¤°à¥à¤œà¥€ à¤Ÿà¤¿à¤•à¤Ÿà¥‹à¤‚ à¤•à¥€ à¤²à¤¾à¤‡à¤µ à¤ªà¤¹à¤šà¤¾à¤¨, à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥€à¤² à¤¹à¥ˆà¤¶ à¤µ UTR à¤…à¤¨à¥à¤®à¥‹à¤¦à¤¨à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 8: Staff RBAC Management */}
          <div className="module-card" onClick={() => navigate('/admin/staff')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <Users size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">8. à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ RBAC à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨</h4>
                <p className="module-card-desc">à¤¨à¤¯à¤¾ à¤Ÿà¥€à¤Ÿà¥€à¤ˆ, à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤•à¥à¤²à¤°à¥à¤•, à¤à¤•à¤¾à¤‰à¤‚à¤Ÿà¥à¤¸ à¤¸à¥à¤Ÿà¤¾à¤« à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ (Gmail ID à¤¸à¤¹à¤¿à¤¤) à¤µ à¤…à¤§à¤¿à¤•à¤¾à¤° à¤¨à¤¿à¤¯à¤‚à¤¤à¥à¤°à¤¿à¤¤ à¤•à¤°à¥‡à¤‚à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 9: Audit Trail Logs */}
          <div className="module-card" onClick={() => navigate('/admin/audit')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <ShieldCheck size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">9. à¤‘à¤¡à¤¿à¤Ÿ à¤Ÿà¥à¤°à¥‡à¤²à¥à¤¸ à¤µ à¤¸à¥à¤°à¤•à¥à¤·à¤¾</h4>
                <p className="module-card-desc">à¤¸à¤­à¥€ à¤²à¥‰à¤—à¤¿à¤¨, à¤¬à¥à¤•à¤¿à¤‚à¤—, à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤”à¤° à¤¸à¤¿à¤¸à¥à¤Ÿà¤® à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨à¥‹à¤‚ à¤•à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤Ÿà¤¾à¤‡à¤®à¤¸à¥à¤Ÿà¥ˆà¤®à¥à¤ªà¥à¤¡ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 10: Defaulters Report */}
          <div className="module-card" onClick={() => window.open(`/api/admin/reports/defaulters?token=${safeStaffToken}`, '_blank')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap" style={{ color: '#B45309', background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', borderColor: '#FDE68A' }}>
                <Printer size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">10. à¤¬à¤•à¤¾à¤¯à¤¾à¤¦à¤¾à¤°à¥‹à¤‚ à¤•à¥€ à¤¸à¥‚à¤šà¥€</h4>
                <p className="module-card-desc">à¤œà¤¿à¤¨ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥à¤“à¤‚ à¤•à¤¾ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¶à¥‡à¤· (Remaining Due) à¤¹à¥ˆ, à¤‰à¤¨à¤•à¥€ à¤ªà¥‚à¤°à¥à¤£ A4 à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿà¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 11: Bulk Excel Upload & Export */}
          <div className="module-card" onClick={() => setBulkModalOpen(true)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap" style={{ color: '#047857', background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', borderColor: '#A7F3D0' }}>
                <Upload size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">11. à¤à¤•à¥à¤¸à¥‡à¤² à¤¬à¤²à¥à¤• à¤¬à¥à¤•à¤¿à¤‚à¤—</h4>
                <p className="module-card-desc">à¤¸à¥ˆà¤•à¤¡à¤¼à¥‹à¤‚ à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤•à¥€ à¤à¤•à¥à¤¸à¥‡à¤² à¤«à¤¾à¤‡à¤² à¤à¤• à¤•à¥à¤²à¤¿à¤• à¤®à¥‡à¤‚ à¤…à¤ªà¤²à¥‹à¤¡ à¤µ à¤‘à¤Ÿà¥‹-à¤ªà¥à¤°à¥‹à¤¸à¥‡à¤¸ à¤•à¤°à¥‡à¤‚à¥¤</p>
              </div>
            </div>
          </div>

          {/* Feature 12: Security & Settings */}
          <div className="module-card" onClick={() => navigate('/admin/settings')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <Settings size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">12. à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤à¤µà¤‚ à¤¸à¥à¤°à¤•à¥à¤·à¤¾</h4>
                <p className="module-card-desc">à¤à¤¡à¤®à¤¿à¤¨ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨, à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤ªà¥à¤°à¥‹à¤«à¤¼à¤¾à¤‡à¤² à¤µ à¤¸à¤¤à¥à¤° à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨à¥¤</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bookings Quick Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ color: '#9A3412', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              à¤¹à¤¾à¤² à¤¹à¥€ à¤®à¥‡à¤‚ à¤œà¤¾à¤°à¥€ à¤†à¤°à¤•à¥à¤·à¤£ (Recent Bookings)
            </h4>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/bookings')}>
              à¤¸à¤®à¤¸à¥à¤¤ Directoy à¤–à¥‹à¤²à¥‡à¤‚ âž”
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PNR</th>
                  <th>à¤µà¤°à¥à¤·</th>
                  <th>à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤</th>
                  <th>à¤°à¥‚à¤Ÿ</th>
                  <th>à¤•à¥‹à¤š / à¤¸à¥€à¤Ÿ</th>
                  <th>à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                  <th style={{ textAlign: 'right' }}>à¤ªà¤°à¥à¤šà¥€</th>
                </tr>
              </thead>
              <tbody>
                {adminBookings.slice(0, 5).map(b => (
                  <tr key={b.bookingId}>
                    <td><strong style={{ color: '#C2410C' }}>{b.bookingId}</strong></td>
                    <td><span className="badge badge-bhakti">{b.yatraYear}</span></td>
                    <td>
                      <strong>{b.bookedBy}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.mobile}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{b.fromStation} âž” {b.toStation}</td>
                    <td><strong style={{ color: '#047857' }}>{b.coachName}</strong> ({Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber})</td>
                    <td>
                      <span className={`badge ${b.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-partial'}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setTicketModal(b)}>
                        <FileText size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤ªà¤°à¥à¤šà¥€
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const activeView = getActiveView();
  const routeAccess = checkRouteAccess();

  // Navigation items for current staff role (Sidebar & All Panels drawer)
  const getAllStaffNavItems = () => {
    if (!staffUser) return [];
    const role = staffUser.role;
    if (role === 'SuperAdmin') return [
      { path: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡ (Overview)' },
      { path: '/admin/booking', icon: <Ticket size={18} />, label: '1. à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£' },
      { path: '/admin/bookings', icon: <ClipboardList size={18} />, label: '2. à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¡à¤¾à¤¯à¤°à¥‡à¤•à¥à¤Ÿà¤°à¥€' },
      { path: '/admin/receipts', icon: <FileText size={18} />, label: '3. à¤°à¤¸à¥€à¤¦ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°' },
      { path: '/admin/refunds', icon: <AlertTriangle size={18} />, label: '4. à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡' },
      { path: '/admin/verifier', icon: <Search size={18} />, label: '5. à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ UTR' },
      { path: '/admin/chart', icon: <Printer size={18} />, label: '6. IRCTC à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤šà¤¾à¤°à¥à¤Ÿ' },
      { path: '/admin/coaches', icon: <Train size={18} />, label: '7. à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¥‹à¤—à¥€ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨' },
      { path: '/admin/checkin', icon: <BadgeCheck size={18} />, label: '8. à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸' },
      { path: '/admin/reconcile', icon: <IndianRupee size={18} />, label: '9. à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤µ à¤¹à¤¿à¤¸à¤¾à¤¬' },
      { path: '/admin/guide', icon: <Lightbulb size={18} />, label: '10. à¤¯à¥‚à¤œà¤¼à¤° à¤—à¤¾à¤‡à¤¡ à¤µ SOP' },
      { path: '/admin/staff', icon: <Users size={18} />, label: 'à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ RBAC' },
      { path: '/admin/audit', icon: <ShieldCheck size={18} />, label: 'à¤‘à¤¡à¤¿à¤Ÿ à¤²à¥‰à¤—à¥à¤¸' },
      { path: '/admin/settings', icon: <Settings size={18} />, label: 'à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
    ];
    if (role === 'TTE') return [
      { path: '/tt/home', icon: <BadgeCheck size={18} />, label: '1. à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸' },
      { path: '/tt/chart', icon: <Printer size={18} />, label: '2. IRCTC à¤•à¥‹à¤š à¤šà¤¾à¤°à¥à¤Ÿ' },
      { path: '/coach-position', icon: <Train size={18} />, label: '3. à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { path: '/tt/verify', icon: <Search size={18} />, label: '4. à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { path: '/tt/collections', icon: <IndianRupee size={18} />, label: '5. à¤®à¥‡à¤°à¤¾ à¤•à¤²à¥‡à¤•à¥à¤¶à¤¨' },
      { path: '/tt/guide', icon: <Lightbulb size={18} />, label: '6. à¤¯à¥‚à¤œà¤¼à¤° à¤—à¤¾à¤‡à¤¡' },
      { path: '/tt/settings', icon: <Settings size={18} />, label: 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
    ];
    if (role === 'BookingClerk') return [
      { path: '/counter/booking', icon: <Ticket size={18} />, label: '1. à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°' },
      { path: '/counter/history', icon: <ClipboardList size={18} />, label: '2. à¤†à¤°à¤•à¥à¤·à¤£ à¤¸à¥‚à¤šà¥€' },
      { path: '/counter/receipts', icon: <FileText size={18} />, label: '3. à¤°à¤¸à¥€à¤¦ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°' },
      { path: '/counter/refunds', icon: <AlertTriangle size={18} />, label: '4. à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡' },
      { path: '/coach-position', icon: <Train size={18} />, label: '5. à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { path: '/counter/chart', icon: <Printer size={18} />, label: '6. à¤•à¥‹à¤š à¤šà¤¾à¤°à¥à¤Ÿ' },
      { path: '/counter/collections', icon: <IndianRupee size={18} />, label: '7. à¤®à¥‡à¤°à¤¾ à¤•à¤²à¥‡à¤•à¥à¤¶à¤¨' },
      { path: '/counter/verify', icon: <Search size={18} />, label: '8. à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { path: '/counter/guide', icon: <Lightbulb size={18} />, label: '9. à¤¯à¥‚à¤œà¤¼à¤° à¤—à¤¾à¤‡à¤¡' },
      { path: '/counter/settings', icon: <Settings size={18} />, label: 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
    ];
    if (role === 'AccountsOfficer' || role === 'FinanceOfficer') return [
      { path: '/finance/ledger', icon: <IndianRupee size={18} />, label: '1. à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¬à¤¹à¥€ à¤µ MIS' },
      { path: '/finance/bookings', icon: <ClipboardList size={18} />, label: '2. à¤†à¤°à¤•à¥à¤·à¤£ à¤¸à¥‚à¤šà¥€' },
      { path: '/finance/receipts', icon: <FileText size={18} />, label: '3. à¤°à¤¸à¥€à¤¦ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°' },
      { path: '/admin/refunds', icon: <AlertTriangle size={18} />, label: '4. à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ' },
      { path: '/coach-position', icon: <Train size={18} />, label: '5. à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { path: '/finance/verify', icon: <Search size={18} />, label: '6. à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ UTR' },
      { path: '/finance/guide', icon: <Lightbulb size={18} />, label: '7. à¤¯à¥‚à¤œà¤¼à¤° à¤—à¤¾à¤‡à¤¡' },
      { path: '/finance/settings', icon: <Settings size={18} />, label: 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
    ];
    if (role === 'StationMaster') return [
      { path: '/station/chart', icon: <Printer size={18} />, label: '1. à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤šà¤¾à¤°à¥à¤Ÿ' },
      { path: '/coach-position', icon: <Train size={18} />, label: '2. à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { path: '/station/verify', icon: <Search size={18} />, label: '3. à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { path: '/station/guide', icon: <Lightbulb size={18} />, label: '4. à¤¯à¥‚à¤œà¤¼à¤° à¤—à¤¾à¤‡à¤¡' },
      { path: '/station/settings', icon: <Settings size={18} />, label: 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
    ];
    return [
      { path: '/settings', icon: <Settings size={18} />, label: 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
    ];
  };

  // Curated 5 items for mobile bottom tab bar (avoids clipping on small screens)
  const getCuratedBottomNavItems = () => {
    if (!staffUser) return [];
    const role = staffUser.role;
    if (role === 'SuperAdmin') return [
      { path: '/admin/dashboard', icon: <LayoutDashboard size={20} />, label: 'à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡' },
      { path: '/admin/booking', icon: <Ticket size={20} />, label: 'à¤¨à¤ˆ à¤Ÿà¤¿à¤•à¤Ÿ' },
      { path: '/admin/bookings', icon: <ClipboardList size={20} />, label: 'à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¥‚à¤šà¥€' },
      { path: '/admin/verifier', icon: <QrCode size={20} />, label: 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'à¤¸à¤­à¥€ à¤®à¥‡à¤¨à¥à¤¯à¥‚' },
    ];
    if (role === 'TTE') return [
      { path: '/tt/home', icon: <BadgeCheck size={20} />, label: 'à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸' },
      { path: '/tt/chart', icon: <Printer size={20} />, label: 'à¤•à¥‹à¤š à¤šà¤¾à¤°à¥à¤Ÿ' },
      { path: '/coach-position', icon: <Train size={20} />, label: 'à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { path: '/tt/verify', icon: <QrCode size={20} />, label: 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'à¤¸à¤­à¥€ à¤®à¥‡à¤¨à¥à¤¯à¥‚' },
    ];
    if (role === 'BookingClerk') return [
      { path: '/counter/booking', icon: <Ticket size={20} />, label: 'à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£' },
      { path: '/counter/history', icon: <ClipboardList size={20} />, label: 'à¤†à¤°à¤•à¥à¤·à¤£ à¤¸à¥‚à¤šà¥€' },
      { path: '/counter/receipts', icon: <FileText size={20} />, label: 'à¤°à¤¸à¥€à¤¦à¥‡à¤‚' },
      { path: '/coach-position', icon: <Train size={20} />, label: 'à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'à¤¸à¤­à¥€ à¤®à¥‡à¤¨à¥à¤¯à¥‚' },
    ];
    if (role === 'AccountsOfficer' || role === 'FinanceOfficer') return [
      { path: '/finance/ledger', icon: <IndianRupee size={20} />, label: 'à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¬à¤¹à¥€' },
      { path: '/finance/bookings', icon: <ClipboardList size={20} />, label: 'à¤†à¤°à¤•à¥à¤·à¤£' },
      { path: '/finance/receipts', icon: <FileText size={20} />, label: 'à¤°à¤¸à¥€à¤¦à¥‡à¤‚' },
      { path: '/finance/verify', icon: <Search size={20} />, label: 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'à¤¸à¤­à¥€ à¤®à¥‡à¤¨à¥à¤¯à¥‚' },
    ];
    if (role === 'StationMaster') return [
      { path: '/station/chart', icon: <Printer size={20} />, label: 'à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤šà¤¾à¤°à¥à¤Ÿ' },
      { path: '/coach-position', icon: <Train size={20} />, label: 'à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
      { path: '/station/verify', icon: <QrCode size={20} />, label: 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'à¤¸à¤­à¥€ à¤®à¥‡à¤¨à¥à¤¯à¥‚' },
    ];
    return [
      { path: '/settings', icon: <Settings size={20} />, label: 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'à¤®à¥‡à¤¨à¥à¤¯à¥‚' },
    ];
  };

  const getPublicBottomNavItems = () => [
    { path: '/', icon: <Search size={20} />, label: 'PNR à¤œà¤¾à¤‚à¤š' },
    { path: '/coach-position', icon: <Train size={20} />, label: 'à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿' },
    { path: '/receipts', icon: <FileText size={20} />, label: 'à¤°à¤¸à¥€à¤¦ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°' },
    { path: '/verify-ticket', icon: <QrCode size={20} />, label: 'à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¥à¤•à¥ˆà¤¨' },
    { path: '/login', icon: <Lock size={20} />, label: 'à¤¸à¥à¤Ÿà¤¾à¤« à¤²à¥‰à¤—à¤¿à¤¨' },
  ];

  const allStaffNavItems = getAllStaffNavItems();
  const curatedBottomNavItems = getCuratedBottomNavItems();
  const publicBottomNavItems = getPublicBottomNavItems();

  const isStaffView = staffUser && activeView !== 'public_home' && activeView !== 'login' && !(activeView === 'verifier' && currentPath === '/verify-ticket');

  const renderInnerViews = () => (
    <>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 14px' }}
        className={staffUser && !isStaffView ? 'bottom-nav-aware' : ''}>

        {/* ----------------- ROUTE ACCESS GUARD: NOT LOGGED IN ----------------- */}
        {!routeAccess.allowed && routeAccess.reason === 'NOT_LOGGED_IN' && (
          <div>
            {renderLoginScreen(<><AlertTriangle size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤‡à¤¸ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤•à¥à¤·à¥‡à¤¤à¥à¤° ({currentPath}) à¤®à¥‡à¤‚ à¤ªà¥à¤°à¤µà¥‡à¤¶ à¤¹à¥‡à¤¤à¥ à¤•à¥ƒà¤ªà¤¯à¤¾ à¤ªà¤¹à¤²à¥‡ à¤…à¤ªà¤¨à¥‡ à¤¸à¥à¤Ÿà¤¾à¤« à¤•à¥à¤°à¥‡à¤¡à¥‡à¤‚à¤¶à¤¿à¤¯à¤²à¥à¤¸ à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¥‡à¤‚à¥¤</>)}
          </div>
        )}

        {/* ----------------- ROUTE ACCESS GUARD: ROLE MISMATCH ----------------- */}
        {!routeAccess.allowed && routeAccess.reason === 'ROLE_MISMATCH' && (
          <div className="glass-card" style={{ maxWidth: 650, margin: '40px auto', textAlign: 'center', border: '2px solid #F87171', padding: 32 }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}></div>
            <span className="badge badge-unpaid" style={{ fontSize: '0.85rem', marginBottom: 8 }}>à¤…à¤¨à¤¾à¤§à¤¿à¤•à¥ƒà¤¤ à¤•à¥à¤·à¥‡à¤¤à¥à¤° (Access Restricted)</span>
            <h2 style={{ color: '#991B1B', fontWeight: 800, margin: '8px 0 12px' }}>à¤ªà¤¹à¥à¤‚à¤š à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤</h2>
            <p style={{ color: '#7F1D1D', fontSize: '1rem', lineHeight: 1.5 }}>
              à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ à¤†à¤ª <strong>{staffUser?.name}</strong> (à¤°à¥‹à¤²: <strong>{staffUser?.role}</strong>) à¤•à¥‡ à¤°à¥‚à¤ª à¤®à¥‡à¤‚ à¤²à¥‰à¤—à¤¿à¤¨ à¤¹à¥ˆà¤‚à¥¤
              à¤¯à¤¹ à¤®à¤¾à¤°à¥à¤— à¤•à¥‡à¤µà¤² <strong>{routeAccess.required}</strong> à¤¹à¥‡à¤¤à¥ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤¹à¥ˆà¥¤
            </p>
            <div style={{ marginTop: 22, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate(getRoleDefaultPath(staffUser.role))}>
                <BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤…à¤ªà¤¨à¥‡ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤ªà¥‹à¤°à¥à¤Ÿà¤² ({getRoleDefaultPath(staffUser.role)}) à¤ªà¤° à¤œà¤¾à¤à¤‚
              </button>
              <button className="btn btn-outline" onClick={handleStaffLogout}>
                <LogOut size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤•à¤¿à¤¸à¥€ à¤…à¤¨à¥à¤¯ à¤–à¤¾à¤¤à¥‡ à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤•à¤°à¥‡à¤‚
              </button>
            </div>
          </div>
        )}

        {/* ----------------- ROUTE ALLOWED: VIEW SWITCHER ----------------- */}
        {routeAccess.allowed && (
          <>
            {/* VIEW 1: PUBLIC DEVOTEE PNR LOOKUP & SACRED GALLERY */}
            {activeView === 'public_home' && (
              <div className="ent-home-wrap">

                {/* â”€â”€ HERO: Vande Bharat Train Card â”€â”€ */}
                <div className="ent-hero-card">
                  <img
                    src="/vande_bharat_real.jpg"
                    alt="à¤µà¤‚à¤¦à¥‡ à¤­à¤¾à¤°à¤¤ à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸ â€” à¤¨à¤ˆ à¤¦à¤¿à¤²à¥à¤²à¥€ / à¤ªà¥à¤°à¤¯à¤¾à¤—à¤°à¤¾à¤œ à¤¸à¥‡ à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤•à¤Ÿà¤¡à¤¼à¤¾"
                    className="ent-hero-img"
                  />
                  <div className="ent-hero-overlay" />
                  <div className="ent-hero-content">
                    <div className="ent-hero-badge-row">
                      <span className="ent-badge ent-badge-dark">
                        <Train size={12} strokeWidth={2} />
                        à¤µà¤‚à¤¦à¥‡ à¤­à¤¾à¤°à¤¤ à¤¸à¥à¤ªà¤°à¤«à¤¾à¤¸à¥à¤Ÿ à¤¸à¥à¤ªà¥‡à¤¶à¤² à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸ â€” {projectSettings.activeYatraYear || 2026}
                      </span>
                      <span className="ent-badge ent-badge-saffron">
                        160 KMPH â€” Semi-High Speed
                      </span>
                      <span className="ent-badge ent-badge-amber">
                        Real Train 18
                      </span>
                    </div>
                    <h1 className="ent-hero-title">
                      à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤•à¤Ÿà¤¡à¤¼à¤¾ â€” à¤µà¤¾à¤°à¥à¤·à¤¿à¤• à¤¤à¥€à¤°à¥à¤¥ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤¿à¤¶à¥‡à¤·
                    </h1>
                    <div className="ent-hero-route-row">
                      <MapPin size={13} strokeWidth={2} />
                      <span>à¤¨à¤ˆ à¤¦à¤¿à¤²à¥à¤²à¥€ / à¤ªà¥à¤°à¤¯à¤¾à¤—à¤°à¤¾à¤œ</span>
                      <div className="ent-hero-route-sep" />
                      <span>à¤…à¤®à¥à¤¬à¤¾à¤²à¤¾</span>
                      <div className="ent-hero-route-sep" />
                      <span>à¤œà¤®à¥à¤®à¥‚ à¤¤à¤µà¥€ (JAT)</span>
                      <div className="ent-hero-route-sep" />
                      <span style={{ color: '#FFCBA4', fontWeight: 700 }}>à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤•à¤Ÿà¤¡à¤¼à¤¾ (SVDK)</span>
                    </div>
                  </div>
                </div>

                {/* â”€â”€ DASHBOARD ROW: Departure Schedule + Live Berth Availability â”€â”€ */}
                <div className="ent-dashboard-row">

                  {/* Departure Schedule Card */}
                  <div className="ent-countdown-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div className="ent-countdown-label">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¸à¤®à¤¯</div>
                        <h2 className="ent-countdown-heading">
                          à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¥à¤°à¥‡à¤¨ à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨
                        </h2>
                        <div className="ent-countdown-route">
                          <CalendarDays size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
                          <span>
                            {projectSettings.defaultTravelDate || '2026-10-15'} â€” à¤¸à¥à¤¬à¤¹ 06:00 à¤¬à¤œà¥‡
                          </span>
                          <span style={{ opacity: 0.35 }}>|</span>
                          <span>à¤šà¤¾à¤°à¤¬à¤¾à¤— à¤°à¥‡à¤²à¤µà¥‡ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨, à¤²à¤–à¤¨à¤Š</span>
                        </div>
                      </div>
                      <span className="ent-live-dot" style={{ flexShrink: 0, marginTop: 4 }}>à¤²à¤¾à¤‡à¤µ à¤¸à¤¿à¤‚à¤•</span>
                    </div>
                    <div className="ent-countdown-digits">
                      {[
                        { val: countdown.days,    unit: 'à¤¦à¤¿à¤¨',    unitEn: 'Days'  },
                        { val: countdown.hours,   unit: 'à¤˜à¤‚à¤Ÿà¥‡',   unitEn: 'Hrs'   },
                        { val: countdown.minutes, unit: 'à¤®à¤¿à¤¨à¤Ÿ',   unitEn: 'Mins'  },
                        { val: countdown.seconds, unit: 'à¤¸à¥‡à¤•à¤‚à¤¡',  unitEn: 'Secs'  },
                      ].map(({ val, unit, unitEn }) => (
                        <div key={unitEn} className="ent-digit-box">
                          <span className="ent-digit-val">{String(val).padStart(2, '0')}</span>
                          <span className="ent-digit-unit">{unit} / {unitEn}</span>
                        </div>
                      ))}
                    </div>
                    {projectSettings.returnTravelDate && (
                      <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                        <RefreshCw size={12} strokeWidth={2} />
                        <span>à¤µà¤¾à¤ªà¤¸à¥€ à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨: <strong style={{ color: '#86EFAC' }}>{projectSettings.returnTravelDate}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Live Berth Availability */}
                  <div className="ent-berth-card">
                    <div className="ent-card-header">
                      <div>
                        <div className="ent-card-title">à¤²à¤¾à¤‡à¤µ à¤¸à¥€à¤Ÿ à¤‰à¤ªà¤²à¤¬à¥à¤§à¤¤à¤¾</div>
                        <div className="ent-card-heading">à¤•à¥à¤² à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¬à¤°à¥à¤¥</div>
                      </div>
                      <div className="ent-card-icon-box">
                        <Armchair size={20} strokeWidth={1.75} />
                      </div>
                    </div>

                    <div>
                      <div className="ent-berth-big-num ent-shimmer-text">
                        {trainCompositionData?.totalAvailable !== undefined
                          ? trainCompositionData.totalAvailable
                          : 986}
                      </div>
                      <div className="ent-berth-sub">
                        à¤•à¥à¤² {trainCompositionData?.totalCapacity || 986} à¤¬à¤°à¥à¤¥à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¸à¥‡ â€” 18 à¤•à¥‹à¤š à¤°à¥‡à¤•,
                        à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· {projectSettings.activeYatraYear || 2026}
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: 18 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        <span className="ent-badge ent-badge-green">
                          <CheckCircle2 size={11} strokeWidth={2.5} />
                          à¤¬à¥à¤•à¤¿à¤‚à¤— à¤œà¤¾à¤°à¥€
                        </span>
                        <span className="ent-badge ent-badge-gold">
                          à¤†à¤°à¤•à¥à¤·à¤£ à¤–à¥à¤²à¤¾ à¤¹à¥ˆ
                        </span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/coach-position')}
                        style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '0.84rem' }}
                      >
                        <Train size={15} strokeWidth={2} />
                        à¤¸à¥€à¤Ÿ à¤²à¥‡à¤†à¤‰à¤Ÿ à¤µ à¤šà¤¾à¤°à¥à¤Ÿ à¤¦à¥‡à¤–à¥‡à¤‚
                        <ChevronRight size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* â”€â”€ FARE & CLASS CARDS GRID â”€â”€ */}
                <div className="ent-card" style={{ marginBottom: 16 }}>
                  <div className="ent-card-header">
                    <div>
                      <div className="ent-card-title">à¤¶à¥à¤°à¥‡à¤£à¥€ à¤à¤µà¤‚ à¤•à¤¿à¤°à¤¾à¤¯à¤¾</div>
                      <div className="ent-card-heading">à¤Ÿà¥à¤°à¥‡à¤¨ à¤µà¤¿à¤µà¤°à¤£ à¤à¤µà¤‚ à¤†à¤°à¤•à¥à¤·à¤£ à¤¶à¥à¤°à¥‡à¤£à¤¿à¤¯à¤¾à¤</div>
                    </div>
                    <div className="ent-card-icon-box">
                      <IndianRupee size={20} strokeWidth={1.75} />
                    </div>
                  </div>
                  <div className="ent-class-grid">
                    {/* AC 3-Tier */}
                    <div className="ent-class-card ac">
                      <span className="ent-class-type">AC 3-Tier â€” à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤</span>
                      <span className="ent-class-seats">
                        {trainCompositionData?.coaches
                          ? trainCompositionData.coaches.filter(c => c.coachClass === 'AC').reduce((s, c) => s + (c.availableBerths || 0), 0)
                          : 384}
                      </span>
                      <span className="ent-class-seats-label">à¤¬à¤°à¥à¤¥ à¤‰à¤ªà¤²à¤¬à¥à¤§</span>
                      <div className="ent-class-fare">â‚¹ 4,000 / à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                      <div className="ent-class-desc">à¤•à¥‹à¤š B1â€“B6 Â· à¤•à¥à¤² 384 à¤¬à¤°à¥à¤¥ Â· à¤šà¤¾à¤¦à¤°, à¤•à¤‚à¤¬à¤², AC</div>
                    </div>
                    {/* Sleeper */}
                    <div className="ent-class-card sl">
                      <span className="ent-class-type">Sleeper Class â€” à¤¶à¤¯à¤¨à¤¯à¤¾à¤¨</span>
                      <span className="ent-class-seats">
                        {trainCompositionData?.coaches
                          ? trainCompositionData.coaches.filter(c => c.coachClass === 'Sleeper').reduce((s, c) => s + (c.availableBerths || 0), 0)
                          : 432}
                      </span>
                      <span className="ent-class-seats-label">à¤¬à¤°à¥à¤¥ à¤‰à¤ªà¤²à¤¬à¥à¤§</span>
                      <div className="ent-class-fare">â‚¹ 3,000 / à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                      <div className="ent-class-desc">à¤•à¥‹à¤š S1â€“S6 Â· à¤•à¥à¤² 432 à¤¬à¤°à¥à¤¥ Â· à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¶à¤¯à¤¨à¤¯à¤¾à¤¨</div>
                    </div>
                    {/* General / SLR */}
                    <div className="ent-class-card gen">
                      <span className="ent-class-type">General / SLR â€” à¤¸à¤¾à¤®à¤¾à¤¨à¥à¤¯</span>
                      <span className="ent-class-seats">
                        {trainCompositionData?.coaches
                          ? trainCompositionData.coaches.filter(c => c.coachClass === 'General').reduce((s, c) => s + (c.availableBerths || 0), 0)
                          : 170}
                      </span>
                      <span className="ent-class-seats-label">à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤‰à¤ªà¤²à¤¬à¥à¤§</span>
                      <div className="ent-class-fare">â‚¹ 2,000 / à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                      <div className="ent-class-desc">à¤•à¥‹à¤š G1â€“G4 Â· à¤•à¥à¤² 170 à¤¸à¥€à¤Ÿà¥‡à¤‚ Â· à¤¸à¥à¤—à¤® à¤¬à¥ˆà¤ à¤• à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾</div>
                    </div>
                  </div>
                  {/* Route Schedule Bar */}
                  <div className="ent-schedule-bar">
                    <div className="ent-route-pill">
                      <Train size={15} strokeWidth={2} color="#E65100" />
                      <span>à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¤¾à¤°à¥à¤— à¤à¤µà¤‚ à¤¸à¤®à¤¯ à¤¸à¤¾à¤°à¤£à¥€</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.82rem', fontWeight: 600, color: '#3D2010' }}>
                      <span>à¤²à¤–à¤¨à¤Š à¤šà¤¾à¤°à¤¬à¤¾à¤— (LKO)</span>
                      <div className="ent-route-arrow" />
                      <span>à¤¨à¤ˆ à¤¦à¤¿à¤²à¥à¤²à¥€ (NDLS)</span>
                      <div className="ent-route-arrow" />
                      <span>à¤…à¤®à¥à¤¬à¤¾à¤²à¤¾</span>
                      <div className="ent-route-arrow" />
                      <span>à¤œà¤®à¥à¤®à¥‚ à¤¤à¤µà¥€ (JAT)</span>
                      <div className="ent-route-arrow" />
                      <span style={{ color: '#E65100', fontWeight: 800 }}>à¤•à¤Ÿà¤¡à¤¼à¤¾ (SVDK)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ent-badge ent-badge-gold">
                        <CalendarDays size={11} strokeWidth={2} />
                        à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨: {projectSettings.defaultTravelDate || '2026-10-15'}
                      </span>
                      <span className="ent-badge ent-badge-blue">38 à¤ à¤¹à¤°à¤¾à¤µ</span>
                    </div>
                  </div>
                </div>

                {/* â”€â”€ PNR STATUS SEARCH SECTION â”€â”€ */}
                <div className="ent-pnr-section">
                  <div className="ent-section-label">à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¥‡à¤µà¤¾ â€” Passenger Services</div>
                  <h2 className="ent-section-title">PNR à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨</h2>
                  <p className="ent-section-desc">
                    à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ â€” à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤ªà¥‹à¤°à¥à¤Ÿà¤²à¥¤
                    PNR à¤¨à¤‚à¤¬à¤° à¤¯à¤¾ à¤°à¤œà¤¿à¤¸à¥à¤Ÿà¤°à¥à¤¡ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¦à¤°à¥à¤œ à¤•à¤° à¤…à¤ªà¤¨à¥€ à¤¬à¤°à¥à¤¥ à¤”à¤° à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¥€ à¤ªà¥‚à¤°à¥€ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤
                  </p>

                  <div className="ent-pnr-input-wrap">
                    <Search size={17} strokeWidth={2} color="#9A6642" style={{ flexShrink: 0 }} />
                    <input
                      id="pnr-search-input"
                      type="text"
                      placeholder="PNR à¤¨à¤‚à¤¬à¤° à¤¯à¤¾ à¤°à¤œà¤¿à¤¸à¥à¤Ÿà¤°à¥à¤¡ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚..."
                      value={pnrInput}
                      onChange={(e) => { setPnrInput(e.target.value); setPnrSearchError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && searchPNR()}
                      aria-label="PNR à¤–à¥‹à¤œ à¤‡à¤¨à¤ªà¥à¤Ÿ"
                    />
                    <button
                      className="ent-pnr-btn"
                      onClick={() => searchPNR()}
                      disabled={pnrLoading}
                    >
                      {pnrLoading
                        ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> à¤œà¤¾à¤‚à¤š à¤œà¤¾à¤°à¥€...</>
                        : <><Search size={14} strokeWidth={2.5} /> à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤¸ à¤œà¤¾à¤‚à¤šà¥‡à¤‚</>
                      }
                    </button>
                  </div>

                  <div className="ent-pnr-formats">
                    <span className="ent-pnr-format-chip">
                      PNR à¤ªà¥à¤°à¤¾à¤°à¥‚à¤ª:
                      <span className="ent-pnr-format-code">MVD-2026-000001</span>
                    </span>
                    <span style={{ width: 1, height: 14, background: '#D1C7BC', flexShrink: 0 }} />
                    <span className="ent-pnr-format-chip">
                      à¤°à¤¸à¥€à¤¦:
                      <span className="ent-pnr-format-code receipt">R2026000001</span>
                    </span>
                  </div>

                  <div className="ent-security-notice" style={{ maxWidth: 680, margin: '16px auto 0', textAlign: 'left' }}>
                    <ShieldCheck size={16} strokeWidth={2} style={{ flexShrink: 0, color: '#92400E', marginTop: 1 }} />
                    <span>
                      <strong>à¤¸à¤¾à¤®à¤¾à¤¨à¥à¤¯ à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤¹à¥‡à¤¤à¥:</strong> PNR à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤¬à¤°à¥à¤¥ à¤œà¤¾à¤‚à¤š à¤¸à¤¾à¤°à¥à¤µà¤œà¤¨à¤¿à¤• à¤°à¥‚à¤ª à¤¸à¥‡ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¥¤
                      à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£, à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤…à¤¦à¥à¤¯à¤¤à¤¨ à¤à¤µà¤‚ à¤šà¥‡à¤•à¤¿à¤‚à¤— à¤•à¥‡à¤µà¤² à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤•à¤°à¥à¤®à¤¿à¤¯à¥‹à¤‚ à¤¦à¥à¤µà¤¾à¤°à¤¾à¥¤
                    </span>
                  </div>
                </div>

                {/* â”€â”€ PNR Search Error â”€â”€ */}
                {pnrSearchError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 18px', borderRadius: 10, marginBottom: 14, fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                    {pnrSearchError}
                  </div>
                )}

                {/* â”€â”€ Searched Ticket Result Card â”€â”€ */}
                {searchedTicket && (
                  <div className="ent-ticket-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #EFEAE3', paddingBottom: 14, marginBottom: 16 }}>
                      <div>
                        <span className="ent-badge ent-badge-gold" style={{ marginBottom: 6 }}>
                          <Ticket size={11} strokeWidth={2.5} />
                          à¤µà¥ˆà¤§ à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¤°à¥à¤šà¥€
                        </span>
                        <div className="ent-ticket-pnr">PNR: {searchedTicket.bookingId}</div>
                      </div>
                      <span className={`badge ${searchedTicket.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-partial'}`}>
                        {searchedTicket.paymentStatus === 'Paid'
                          ? <><CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />à¤ªà¥‚à¤°à¥à¤£ à¤­à¥à¤—à¤¤à¤¾à¤¨ (Confirmed)</>
                          : `à¤†à¤‚à¤¶à¤¿à¤• à¤­à¥à¤—à¤¤à¤¾à¤¨ â€” à¤¦à¥‡à¤¯: â‚¹${searchedTicket.remainingAmount}`}
                      </span>
                    </div>

                    <div className="ent-ticket-row">
                      <div>
                        <span className="ent-ticket-field-label">à¤®à¥à¤–à¥à¤¯ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤®</span>
                        <span className="ent-ticket-field-val">{searchedTicket.bookedBy}</span>
                        <div style={{ fontSize: '0.8rem', color: '#9A6642', marginTop: 2 }}>à¤®à¥‹à¤¬à¤¾à¤‡à¤²: {searchedTicket.mobile}</div>
                      </div>
                      <div>
                        <span className="ent-ticket-field-label">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤°à¥‚à¤Ÿ à¤à¤µà¤‚ à¤•à¥‹à¤š</span>
                        <span className="ent-ticket-field-val" style={{ color: '#14532D' }}>
                          {searchedTicket.fromStation} â€” {searchedTicket.toStation}
                        </span>
                        <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
                          à¤•à¥‹à¤š: <strong style={{ color: '#BF360C' }}>{searchedTicket.coachName}</strong>
                          {' '}| à¤¶à¥à¤°à¥‡à¤£à¥€: <strong>{searchedTicket.travelClass}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Passenger List */}
                    <div style={{ background: '#FDFBF7', borderRadius: 8, padding: '10px 14px', border: '1px solid #EFEAE3', marginBottom: 14 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9A6642', marginBottom: 8 }}>
                        à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¥€ â€” Berth Allocation
                      </div>
                      {(searchedTicket.passengers || []).map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #EFEAE3', fontSize: '0.86rem', color: '#3D2010' }}>
                          <span>{idx + 1}. <strong>{p.name}</strong> ({p.age || '-'} à¤µà¤°à¥à¤·, {p.gender || '-'})</span>
                          <strong style={{ color: '#BF360C' }}>à¤¸à¥€à¤Ÿ: {p.seatAssigned || p.seatNumber || '-'}</strong>
                        </div>
                      ))}
                    </div>

                    {/* Fare Summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#FDFBF7', padding: '10px 14px', borderRadius: 8, border: '1px solid #EFEAE3', marginBottom: 16, fontSize: '0.85rem' }}>
                      <span>à¤•à¥à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾: <strong>â‚¹ {searchedTicket.totalAmount}</strong></span>
                      <span style={{ color: '#14532D' }}>à¤…à¤—à¥à¤°à¤¿à¤® à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤: <strong>â‚¹ {searchedTicket.advance}</strong></span>
                      <span style={{ color: searchedTicket.remainingAmount > 0 ? '#DC2626' : '#14532D', fontWeight: 800 }}>
                        à¤¶à¥‡à¤· à¤¦à¥‡à¤¯: â‚¹ {searchedTicket.remainingAmount}
                      </span>
                    </div>

                    {/* Payment Receipts */}
                    {((searchedTicket.paymentHistory && searchedTicket.paymentHistory.length > 0) || searchedTicket.advance > 0) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#14532D', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Printer size={14} strokeWidth={2} /> à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤°à¤¸à¥€à¤¦à¥‡à¤‚ â€” Payment Receipts
                        </div>
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '8px 10px' }}>
                          {((searchedTicket.paymentHistory && searchedTicket.paymentHistory.length > 0)
                            ? searchedTicket.paymentHistory
                            : [{ id: 'R' + (searchedTicket.yatraYear || '2026') + '000001', date: searchedTicket.createdAt || new Date().toISOString(), amount: searchedTicket.advance, method: searchedTicket.paymentMode || 'Cash', type: 'Advance Booking (à¤…à¤—à¥à¤°à¤¿à¤® à¤¬à¥à¤•à¤¿à¤‚à¤—)', cashierName: 'Counter Staff', utr: searchedTicket.utrNumber || '' }]
                          ).map((txn, sIdx) => (
                            <div key={txn.id || sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '7px 4px', borderBottom: '1px solid #DCFCE7', fontSize: '0.83rem' }}>
                              <div>
                                <strong style={{ color: '#14532D' }}>â‚¹ {parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                <span style={{ color: '#4B5563', marginLeft: 6 }}>via {txn.method} {txn.utr ? `(UTR: ${txn.utr})` : ''}</span>
                                <div style={{ color: '#059669', fontSize: '0.72rem' }}>{new Date(txn.date).toLocaleString('en-IN')} | {txn.type}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-sm btn-primary" onClick={() => setReceiptModal({ booking: searchedTicket, txn })} style={{ padding: '4px 10px', fontSize: '0.73rem' }}>
                                  <Printer size={12} strokeWidth={2} /> à¤°à¤¸à¥€à¤¦
                                </button>
                                <a href={`/api/bookings/${searchedTicket.bookingId}/receipt/${txn.id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" style={{ padding: '4px 8px', fontSize: '0.73rem', borderColor: '#86EFAC', color: '#14532D' }}>
                                  <FileText size={12} strokeWidth={2} /> PDF
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href={`/api/bookings/${searchedTicket.bookingId}/pdf`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ flex: 1, borderColor: '#BBF7D0', color: '#14532D', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <FileText size={15} strokeWidth={2} /> PDF à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¤°à¥à¤šà¥€ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡
                      </a>
                      {searchedTicket.remainingAmount > 0 && (
                        <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={() => openUpiQR(searchedTicket.bookingId)}>
                          <Smartphone size={15} strokeWidth={2} /> UPI à¤¸à¥‡ à¤¶à¥‡à¤· â‚¹{searchedTicket.remainingAmount} à¤œà¤®à¤¾ à¤•à¤°à¥‡à¤‚
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* â”€â”€ CTA Buttons â”€â”€ */}
                <div className="ent-cta-row">
                  <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '0.93rem' }} onClick={() => navigate('/coach-position')}>
                    <Train size={18} strokeWidth={2} />
                    à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤°à¥‡à¤• à¤¸à¤‚à¤°à¤šà¤¨à¤¾
                  </button>
                  <button className="btn btn-gold" style={{ padding: '12px 28px', fontSize: '0.93rem' }} onClick={() => setActiveTab('staff')}>
                    <Lock size={18} strokeWidth={2} />
                    à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤à¤µà¤‚ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤…à¤§à¤¿à¤•à¤¾à¤°à¥€ à¤²à¥‰à¤—à¤¿à¤¨
                  </button>
                </div>

                <hr className="ent-section-divider" />

                {/* â”€â”€ POSTER & PANORAMA â”€â”€ */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div className="ent-section-label">à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥à¤°à¤šà¤¾à¤° à¤¸à¤¾à¤®à¤—à¥à¤°à¥€</div>
                    <h3 style={{ fontFamily: "'Inter', 'Poppins', sans-serif", fontSize: '1.35rem', fontWeight: 800, color: '#1C0A00', letterSpacing: '-0.01em', margin: '4px 0' }}>
                      à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥‹à¤¸à¥à¤Ÿà¤° {projectSettings.activeYatraYear || 2026}
                    </h3>
                  </div>
                  <div className="ent-poster-grid">
                    <div className="ent-img-card" onClick={() => setPosterModal(true)} title="à¤ªà¥‚à¤°à¥à¤£ à¤ªà¥‹à¤¸à¥à¤Ÿà¤° HD à¤®à¥‡à¤‚ à¤¦à¥‡à¤–à¥‡à¤‚">
                      <img src="/poster.png" alt="à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥‹à¤¸à¥à¤Ÿà¤°" style={{ height: 280, objectFit: 'contain', background: '#FFF8F2' }} />
                      <div className="ent-img-caption">
                        <div className="ent-img-caption-sub">à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥‹à¤¸à¥à¤Ÿà¤° â€” à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚ HD à¤¦à¥‡à¤–à¥‡à¤‚</div>
                        <div className="ent-img-caption-title">à¤µà¤¿à¤¶à¥‡à¤· à¤¤à¥€à¤°à¥à¤¥ à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸ Â· à¤²à¤–à¤¨à¤Š à¤¸à¥‡ à¤•à¤Ÿà¤¡à¤¼à¤¾</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: '#FDFBF7', border: '1px solid #EFEAE3', borderRadius: 12, padding: '16px 18px' }}>
                        <div className="ent-section-label" style={{ marginBottom: 10 }}>à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤¸à¤¾à¤°à¤¾à¤‚à¤¶</div>
                        {[
                          { label: 'à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤·', val: projectSettings.activeYatraYear || 2026 },
                          { label: 'à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¤à¤¿à¤¥à¤¿', val: projectSettings.defaultTravelDate || '2026-10-15', green: true },
                          { label: 'à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤•à¥‡à¤‚à¤¦à¥à¤°', val: 'à¤šà¤¾à¤°à¤¬à¤¾à¤— à¤°à¥‡à¤²à¤µà¥‡ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨, à¤²à¤–à¤¨à¤Š' },
                          { label: 'à¤—à¤‚à¤¤à¤µà¥à¤¯', val: 'à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤•à¤Ÿà¤¡à¤¼à¤¾ (SVDK)', highlight: true },
                          { label: 'à¤•à¥à¤² à¤ à¤¹à¤°à¤¾à¤µ', val: '38 à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨' },
                        ].map(({ label, val, green, highlight }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #EFEAE3', fontSize: '0.83rem' }}>
                            <span style={{ color: '#9A6642', fontWeight: 600 }}>{label}</span>
                            <span style={{ fontWeight: 700, color: green ? '#14532D' : highlight ? '#BF360C' : '#3D2010' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-gold btn-sm" onClick={() => setPosterModal(true)} style={{ flex: 1, justifyContent: 'center' }}>
                          <Eye size={14} strokeWidth={2} /> à¤ªà¥‹à¤¸à¥à¤Ÿà¤° à¤œà¤¼à¥‚à¤® à¤•à¤°à¥‡à¤‚
                        </button>
                        <a href="/poster.png" download="Vaishno_Devi_Yatra_Poster_2026.png" className="btn btn-primary btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <Download size={14} strokeWidth={2} /> à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* â”€â”€ SACRED SHRINE PANORAMA â”€â”€ */}
                {['/shrine_hero.jpg'].map(src => (
                  <div key={src} className="ent-img-card" style={{ marginBottom: 16, cursor: 'default' }}>
                    <img src={src} alt="à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¾à¤µà¤¨ à¤§à¤¾à¤® â€” à¤¤à¥à¤°à¤¿à¤•à¥à¤Ÿà¤¾ à¤ªà¤°à¥à¤µà¤¤" style={{ height: 320 }} />
                    <div className="ent-img-caption" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div className="ent-img-caption-sub">à¤¤à¥à¤°à¤¿à¤•à¥à¤Ÿà¤¾ à¤ªà¤°à¥à¤µà¤¤ à¤ªà¤¾à¤µà¤¨ à¤§à¤¾à¤® Â· à¤•à¤Ÿà¤¡à¤¼à¤¾ (SVDK)</div>
                        <div className="ent-img-caption-title">à¤ªà¤µà¤¿à¤¤à¥à¤° à¤—à¥à¤«à¤¾ à¤¦à¤°à¥à¤¶à¤¨ à¤¯à¤¾à¤¤à¥à¤°à¤¾ â€” à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¥à¤°à¥‡à¤¨</div>
                      </div>
                      <span className="ent-badge ent-badge-gold">à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤¸à¥‡ 14 à¤•à¤¿à¤®à¥€ à¤ªà¤¦à¤¯à¤¾à¤¤à¥à¤°à¤¾</span>
                    </div>
                  </div>
                ))}

                {/* â”€â”€ GALLERY GRID â”€â”€ */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div className="ent-section-label">à¤¦à¤°à¥à¤¶à¤¨ à¤¦à¥€à¤°à¥à¤˜à¤¾</div>
                    <h3 style={{ fontFamily: "'Inter', 'Poppins', sans-serif", fontSize: '1.35rem', fontWeight: 800, color: '#1C0A00', letterSpacing: '-0.01em', margin: '4px 0' }}>
                      à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤§à¤¾à¤® à¤à¤µà¤‚ à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¥à¤°à¥‡à¤¨
                    </h3>
                  </div>
                  <div className="ent-gallery-grid">
                    {[
                      { src: '/shrine_night.jpg', sub: 'à¤¤à¥à¤°à¤¿à¤•à¥à¤Ÿà¤¾ à¤¶à¤¿à¤–à¤° Â· à¤ªà¤¾à¤µà¤¨ à¤§à¤¾à¤®', title: 'à¤°à¤¾à¤¤à¥à¤°à¤¿ à¤†à¤²à¥‹à¤•à¤¿à¤¤ à¤¦à¤¿à¤µà¥à¤¯ à¤­à¤µà¤¨', desc: 'à¤¸à¥à¤µà¤°à¥à¤£à¤¿à¤® à¤ªà¥à¤°à¤•à¤¾à¤¶ à¤®à¥‡à¤‚ à¤œà¤—à¤®à¤—à¤¾à¤¤à¤¾ à¤®à¤¾à¤‚ à¤•à¤¾ à¤ªà¤¾à¤µà¤¨ à¤­à¤µà¤¨' },
                      { src: '/yatra_train.jpg', sub: 'à¤µà¤¿à¤¶à¥‡à¤· à¤¤à¥€à¤°à¥à¤¥ à¤à¤•à¥à¤¸à¤ªà¥à¤°à¥‡à¤¸', title: 'à¤¸à¥à¤¸à¤œà¥à¤œà¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤Ÿà¥à¤°à¥‡à¤¨', desc: 'à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¸à¥à¤¸à¤œà¥à¤œà¤¿à¤¤ à¤µà¤¾à¤°à¥à¤·à¤¿à¤• à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¥à¤°à¥‡à¤¨' },
                      { src: '/katra_station.jpg', sub: 'à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨', title: 'à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤°à¥‡à¤²à¤µà¥‡ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ (SVDK)', desc: 'à¤®à¤¾à¤¤à¤¾ à¤•à¥‡ à¤¦à¥à¤µà¤¾à¤° à¤¤à¤• à¤ªà¤¹à¥à¤à¤šà¤¾à¤¨à¥‡ à¤µà¤¾à¤²à¤¾ à¤…à¤‚à¤¤à¤¿à¤® à¤°à¥‡à¤²à¤µà¥‡ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨' },
                    ].map(({ src, sub, title, desc }) => (
                      <div key={src} className="ent-img-card">
                        <img src={src} alt={title} />
                        <div className="ent-img-caption">
                          <div className="ent-img-caption-sub">{sub}</div>
                          <div className="ent-img-caption-title">{title}</div>
                          <div style={{ fontSize: '0.75rem', color: '#9A6642', marginTop: 3 }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="ent-section-divider" />

                {/* â”€â”€ FEATURES GRID â”€â”€ */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 16, textAlign: 'center' }}>
                    <div className="ent-section-label">à¤ªà¥‹à¤°à¥à¤Ÿà¤² à¤¸à¥à¤µà¤¿à¤§à¤¾à¤à¤ â€” Portal Capabilities</div>
                    <h3 style={{ fontFamily: "'Inter', 'Poppins', sans-serif", fontSize: '1.35rem', fontWeight: 800, color: '#1C0A00', letterSpacing: '-0.01em', margin: '4px 0' }}>
                      à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤¬à¥à¤•à¤¿à¤‚à¤— à¤à¤µà¤‚ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¥‡à¤µà¤¾à¤à¤
                    </h3>
                  </div>
                  <div className="ent-feature-grid">
                    {[
                      { icon: <CalendarDays size={22} strokeWidth={1.75} />, title: 'à¤¬à¤¹à¥-à¤µà¤°à¥à¤·à¥€à¤¯ à¤¯à¤¾à¤¤à¥à¤°à¤¾ (Multi-Year)', desc: 'à¤µà¤°à¥à¤· 2024 à¤¸à¥‡ 2028 à¤¤à¤• à¤•à¥‡ à¤¸à¤­à¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ â€” à¤à¤• à¤¹à¥€ à¤ªà¥‹à¤°à¥à¤Ÿà¤² à¤ªà¤° à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤µ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¿à¤¤à¥¤' },
                      { icon: <Armchair size={22} strokeWidth={1.75} />, title: 'à¤‡à¤‚à¤Ÿà¤°à¥ˆà¤•à¥à¤Ÿà¤¿à¤µ à¤¸à¥€à¤Ÿ à¤šà¤¯à¤¨', desc: 'à¤•à¥‹à¤š à¤•à¤¾ à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¨à¤•à¥à¤¶à¤¾ à¤¦à¥‡à¤–à¤•à¤° à¤²à¥‹à¤…à¤°, à¤®à¤¿à¤¡à¤¿à¤², à¤…à¤ªà¤° à¤¯à¤¾ à¤¸à¤¾à¤‡à¤¡ à¤¬à¤°à¥à¤¥ à¤•à¤¾ à¤šà¤¯à¤¨ à¤•à¤°à¥‡à¤‚à¥¤' },
                      { icon: <Smartphone size={22} strokeWidth={1.75} />, title: 'UPI à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤à¤µà¤‚ à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤ªà¤¾à¤¸', desc: 'GPay, PhonePe, Paytm à¤¸à¥‡ à¤¸à¥€à¤§à¥‡ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤­à¥à¤—à¤¤à¤¾à¤¨ â€” à¤¤à¤¤à¥à¤•à¤¾à¤² QR à¤à¤µà¤‚ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¤°à¥à¤šà¥€à¥¤' },
                    ].map(({ icon, title, desc }) => (
                      <div key={title} className="ent-feature-card">
                        <div className="ent-feature-icon">{icon}</div>
                        <div className="ent-feature-title">{title}</div>
                        <p className="ent-feature-desc">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* â”€â”€ ORGANIZER + GUIDELINES â”€â”€ */}
                <div className="ent-info-two-col">
                  {/* Organizer */}
                  <div className="ent-card">
                    <div className="ent-card-header">
                      <div>
                        <div className="ent-card-title">à¤®à¥à¤–à¥à¤¯ à¤†à¤¯à¥‹à¤œà¤•</div>
                        <div className="ent-card-heading">à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ</div>
                      </div>
                      <div className="ent-card-icon-box"><Users size={20} strokeWidth={1.75} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <img src="/logo.png" alt="MVD Trust Logo" style={{ width: 68, height: 68, borderRadius: 10, border: '1.5px solid #EFEAE3', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.85rem', color: '#6B4226', lineHeight: 1.6, margin: '0 0 12px' }}>
                          à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤µà¤°à¥à¤· à¤†à¤¯à¥‹à¤œà¤¿à¤¤ à¤¯à¤¹ à¤ªà¤¾à¤µà¤¨ à¤¤à¥€à¤°à¥à¤¥ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤¹à¤œà¤¾à¤°à¥‹à¤‚ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥à¤“à¤‚ à¤•à¥‹ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤à¤µà¤‚ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¿à¤¤ à¤¤à¤°à¥€à¤•à¥‡ à¤¸à¥‡ à¤®à¤¾à¤¤à¤¾ à¤•à¥‡ à¤¦à¤°à¤¬à¤¾à¤° à¤¤à¤• à¤ªà¤¹à¥à¤à¤šà¤¾à¤¤à¥€ à¤¹à¥ˆà¥¤
                        </p>
                        {[
                          { label: 'à¤¸à¤®à¥à¤ªà¤°à¥à¤•', val: projectSettings.organizerPhone || '+91-XXXXX-XXXXX' },
                          { label: 'à¤ˆà¤®à¥‡à¤²', val: projectSettings.organizerEmail || 'info@mvdtrust.org' },
                          { label: 'à¤¸à¥à¤¥à¤¾à¤¨', val: 'à¤²à¤–à¤¨à¤Š, à¤‰à¤¤à¥à¤¤à¤° à¤ªà¥à¤°à¤¦à¥‡à¤¶' },
                        ].map(({ label, val }) => (
                          <div key={label} style={{ display: 'flex', gap: 10, fontSize: '0.82rem', marginBottom: 5 }}>
                            <span style={{ color: '#9A6642', fontWeight: 700, minWidth: 55 }}>{label}:</span>
                            <span style={{ color: '#3D2010', fontWeight: 600 }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Travel Guidelines */}
                  <div className="ent-card">
                    <div className="ent-card-header">
                      <div>
                        <div className="ent-card-title">à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¦à¤¿à¤¶à¤¾à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶</div>
                        <div className="ent-card-heading">Travel Guidelines</div>
                      </div>
                      <div className="ent-card-icon-box"><ShieldCheck size={20} strokeWidth={1.75} /></div>
                    </div>
                    <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        'à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥à¤°à¤¾à¤°à¤‚à¤­ à¤¸à¥‡ 45 à¤®à¤¿à¤¨à¤Ÿ à¤ªà¥‚à¤°à¥à¤µ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤ªà¤° à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ à¤°à¤¹à¥‡à¤‚à¥¤',
                        'à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¤°à¥à¤šà¥€ à¤¯à¤¾ à¤®à¥à¤¦à¥à¤°à¤¿à¤¤ à¤Ÿà¤¿à¤•à¤Ÿ à¤…à¤µà¤¶à¥à¤¯ à¤¸à¤¾à¤¥ à¤°à¤–à¥‡à¤‚à¥¤',
                        'TTE à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¬à¤°à¥à¤¥ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¹à¥‡à¤¤à¥ ID à¤ªà¥à¤°à¤®à¤¾à¤£ à¤ªà¥à¤°à¤¸à¥à¤¤à¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤',
                        'à¤¬à¥à¤œà¥à¤°à¥à¤—à¥‹à¤‚ à¤”à¤° à¤¦à¤¿à¤µà¥à¤¯à¤¾à¤‚à¤—à¤œà¤¨à¥‹à¤‚ à¤¹à¥‡à¤¤à¥ à¤²à¥‹à¤…à¤° à¤¬à¤°à¥à¤¥ à¤†à¤°à¤•à¥à¤·à¤£ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆà¥¤',
                        'à¤Ÿà¥à¤°à¥‡à¤¨ à¤ªà¤°à¤¿à¤¸à¤° à¤®à¥‡à¤‚ à¤®à¤¾à¤¦à¤• à¤ªà¤¦à¤¾à¤°à¥à¤¥ à¤µ à¤…à¤¨à¥à¤šà¤¿à¤¤ à¤µà¥à¤¯à¤µà¤¹à¤¾à¤° à¤¸à¤–à¥à¤¤ à¤µà¤°à¥à¤œà¤¿à¤¤ à¤¹à¥ˆà¥¤',
                        'à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤² à¤®à¥‡à¤‚ à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨ à¤¨à¤‚à¤¬à¤° à¤¸à¥‡ à¤¤à¤¤à¥à¤•à¤¾à¤² à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤',
                      ].map((g, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.82rem', color: '#6B4226', lineHeight: 1.5 }}>
                          <CheckCircle2 size={13} strokeWidth={2.5} style={{ color: '#E65100', flexShrink: 0, marginTop: 2 }} />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* â”€â”€ ENTERPRISE FOOTER STRIP â”€â”€ */}
                <div className="ent-footer-card">
                  <div className="ent-footer-grid">
                    <div>
                      <div className="ent-footer-title">
                        <img src="/logo.png" alt="MVD Trust" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', objectFit: 'cover' }} />
                        à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, maxWidth: 360 }}>
                        à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤•à¥‡ à¤¦à¤°à¥à¤¶à¤¨ à¤¹à¥‡à¤¤à¥ à¤²à¤–à¤¨à¤Š à¤¸à¥‡ à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤¤à¤• à¤µà¤¾à¤°à¥à¤·à¤¿à¤• à¤¸à¥à¤ªà¤°à¤«à¤¾à¤¸à¥à¤Ÿ à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¥à¤°à¥‡à¤¨ à¤•à¤¾ à¤¸à¤‚à¤šà¤¾à¤²à¤¨à¥¤
                        à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤Ÿà¤¿à¤•à¤Ÿà¤¿à¤‚à¤—, PNR à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤à¤µà¤‚ à¤²à¤¾à¤‡à¤µ à¤¬à¤°à¥à¤¥ à¤Ÿà¥à¤°à¥ˆà¤•à¤¿à¤‚à¤— à¤ªà¥‹à¤°à¥à¤Ÿà¤²à¥¤
                      </p>
                      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className="ent-badge ent-badge-dark" style={{ fontSize: '0.7rem' }}>
                          <Globe size={10} strokeWidth={2.5} /> mvdv.vercel.app
                        </span>
                        <span className="ent-badge ent-badge-dark" style={{ fontSize: '0.7rem' }}>
                          <ShieldCheck size={10} strokeWidth={2.5} /> SSL Secured
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="ent-footer-title">
                        <Phone size={14} strokeWidth={2} /> à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¥‡à¤µà¤¾à¤à¤
                      </div>
                      <ul className="ent-footer-list">
                        {[
                          'PNR à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤œà¤¾à¤à¤š â€” à¤¸à¤¾à¤°à¥à¤µà¤œà¤¨à¤¿à¤•',
                          'à¤¬à¤°à¥à¤¥ à¤à¤µà¤‚ à¤•à¥‹à¤š à¤¸à¥à¤¥à¤¿à¤¤à¤¿ â€” à¤²à¤¾à¤‡à¤µ',
                          'à¤Ÿà¤¿à¤•à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ (PDF)',
                          'UPI à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾',
                          'TTE / à¤¸à¥à¤Ÿà¤¾à¤« à¤²à¥‰à¤—à¤¿à¤¨',
                        ].map(s => <li key={s}><ChevronRight size={10} style={{ color: '#E65100', flexShrink: 0 }} />{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="ent-footer-title">
                        <ShieldCheck size={14} strokeWidth={2} /> à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨
                      </div>
                      <ul className="ent-footer-list">
                        {[
                          { label: 'à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤•à¤¾à¤°à¥à¤¯à¤¾à¤²à¤¯', val: projectSettings.organizerPhone || '+91-XXXXX-XXXXX' },
                          { label: 'à¤°à¥‡à¤²à¤µà¥‡ à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨', val: '139' },
                          { label: 'à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨', val: '01991-234XXX' },
                          { label: 'à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²', val: '112' },
                        ].map(({ label, val }) => (
                          <li key={label}>
                            <span style={{ minWidth: 90, display: 'inline-block', opacity: 0.55 }}>{label}</span>
                            <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{val}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <hr className="ent-footer-divider" />
                  <div className="ent-footer-bottom">
                    <span>
                      &copy; {projectSettings.activeYatraYear || 2026} à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ Â· à¤¸à¤°à¥à¤µà¤¾à¤§à¤¿à¤•à¤¾à¤° à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤
                    </span>
                    <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>à¤—à¥‹à¤ªà¤¨à¥€à¤¯à¤¤à¤¾ à¤¨à¥€à¤¤à¤¿</span>
                      <span>à¤¨à¤¿à¤¯à¤® à¤à¤µà¤‚ à¤¶à¤°à¥à¤¤à¥‡à¤‚</span>
                      <span>à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤¦à¤¿à¤¶à¤¾à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶</span>
                    </span>
                  </div>
                </div>

              </div>
            )}

      {/* VIEW 2: DEDICATED LOGIN ROUTE */}
            {activeView === 'login' && (
              <div>
                {staffUser ? (
                  <div className="glass-card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', border: '2px solid #FED7AA', padding: 32 }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>âœ…</div>
                    <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤†à¤ª à¤ªà¤¹à¤²à¥‡ à¤¸à¥‡ à¤²à¥‰à¤—à¤¿à¤¨ à¤¹à¥ˆà¤‚!</h3>
                    <p style={{ color: '#7C2D12', fontSize: '0.94rem' }}>
                      à¤¸à¥à¤µà¤¾à¤—à¤¤ à¤¹à¥ˆ <strong>{staffUser.name}</strong> ({staffUser.role} - {staffUser.department})à¥¤
                    </p>
                    <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button className="btn btn-primary" onClick={() => navigate(getRoleDefaultPath(staffUser.role))}>
                        <BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤…à¤ªà¤¨à¥‡ à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤ªà¥‹à¤°à¥à¤Ÿà¤² ({getRoleDefaultPath(staffUser.role)}) à¤ªà¤° à¤œà¤¾à¤à¤‚
                      </button>
                      <button className="btn btn-outline" onClick={handleStaffLogout}>
                        à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ à¤•à¤°à¥‡à¤‚
                      </button>
                    </div>
                  </div>
                ) : (
                  renderLoginScreen()
                )}
              </div>
            )}

            {/* VIEW 3: STANDALONE ANTI-FRAUD VERIFIER (PUBLIC OR STAFF) */}
            {(activeView === 'verifier' && (!staffUser || currentPath === '/verify-ticket')) && (
              <div>
                <div>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <span className="badge badge-bhakti">HMAC-SHA256 à¤•à¥à¤°à¤¿à¤ªà¥à¤Ÿà¥‹à¤—à¥à¤°à¤¾à¤«à¤¿à¤• à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤‡à¤‚à¤œà¤¨</span>
                      <h2 style={{ fontSize: '1.9rem', color: '#9A3412', marginTop: 4, fontWeight: 800 }}>
                        <Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤à¤‚à¤Ÿà¥€-à¤«à¥à¤°à¥‰à¤¡ à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤ªà¥à¤°à¤£à¤¾à¤²à¥€
                      </h2>
                      <p style={{ color: '#7C2D12', fontSize: '0.92rem' }}>
                        à¤«à¥‹à¤Ÿà¥‹à¤¶à¥‰à¤ª à¤¯à¤¾ à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤ à¤«à¤°à¥à¤œà¥€ à¤Ÿà¤¿à¤•à¤Ÿà¥‹à¤‚ à¤•à¥€ à¤¤à¥à¤°à¤‚à¤¤ à¤ªà¤¹à¤šà¤¾à¤¨ â€¢ à¤°à¥‡à¤²à¤µà¥‡ à¤à¤µà¤‚ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤•à¥‡ à¤•à¥‡à¤‚à¤¦à¥à¤°à¥€à¤¯ à¤¡à¥‡à¤Ÿà¤¾à¤¬à¥‡à¤¸ à¤¸à¥‡ à¤²à¤¾à¤‡à¤µ à¤®à¤¿à¤²à¤¾à¤¨
                      </p>
                    </div>

                    <div className="glass-card" style={{ maxWidth: 640, margin: '0 auto 24px', border: '2px solid #FED7AA', padding: 24, textAlign: 'center' }}>
                      
                      {/* QR Scanner Mockup */}
                      <div className="qr-scanner-frame">
                        <div className="qr-scanner-corners">
                          <div className="qr-scanner-corners-inner"></div>
                        </div>
                        <div className="laser-line"></div>
                        <div className="scanner-text">
                          <Scan size={14} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} />
                          QR CODE SCANNING...
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1.2rem', color: '#9A3412', marginBottom: '16px', fontWeight: 700 }}>
                        à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¥‡ à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾ QR à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚
                      </h3>

                      <form onSubmit={(e) => { e.preventDefault(); handleVerifyTicketSubmit(); }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                            à¤¯à¤¾ à¤®à¥ˆà¤¨à¥à¤¯à¥à¤…à¤² à¤°à¥‚à¤ª à¤¸à¥‡ PNR à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚
                          </p>
                          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 400 }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="PNR Number (à¤‰à¤¦à¤¾. MVD-2026-...)"
                              value={verifierPnr}
                              onChange={(e) => setVerifierPnr(e.target.value)}
                              style={{ width: '100%', textAlign: 'center', letterSpacing: '1px', fontWeight: 600, padding: '10px' }}
                              required
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={verifierLoading}
                            className="btn btn-primary"
                            style={{ width: '100%', maxWidth: 400, padding: '12px', fontSize: '1.05rem', marginTop: 10, boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)' }}
                          >
                            {verifierLoading ? 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...' : <><ShieldCheck size={18} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> à¤®à¥ˆà¤¨à¥à¤¯à¥à¤…à¤² à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤•à¤°à¥‡à¤‚</>}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Verification Result Display */}
                    {verifierResult && (
                      <div className="glass-card" style={{ maxWidth: 740, margin: '0 auto', border: verifierResult.status === 'GENUINE' ? '2.5px solid #10B981' : '2.5px solid #EF4444', padding: 24 }}>
                        {verifierResult.status === 'GENUINE' ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#D1FAE5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>âœ…</div>
                              <div>
                                <h3 style={{ margin: 0, color: '#065F46', fontSize: '1.3rem', fontWeight: 800 }}>{verifierResult.title}</h3>
                                <p style={{ margin: '2px 0 0', color: '#047857', fontSize: '0.88rem' }}>{verifierResult.message}</p>
                              </div>
                            </div>

                            <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNR / à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¸à¤‚à¤–à¥à¤¯à¤¾</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookingId}</div>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ / à¤†à¤µà¥‡à¤¦à¤•</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookedBy} ({verifierResult.booking.mobile})</div>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¥‹à¤š à¤µ à¤¸à¥€à¤Ÿ</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>
                                  à¤•à¥‹à¤š {verifierResult.booking.coachName} â€¢ à¤¸à¥€à¤Ÿ: {Array.isArray(verifierResult.booking.seatNumber) ? verifierResult.booking.seatNumber.join(', ') : verifierResult.booking.seatNumber}
                                </div>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤µ à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: verifierResult.booking.remainingAmount > 0 ? '#DC2626' : '#047857' }}>
                                  {verifierResult.booking.paymentStatus} (à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤®à¥‡à¤‚ à¤¶à¥‡à¤· à¤¦à¥‡à¤¯: â‚¹ {verifierResult.booking.remainingAmount})
                                </div>
                              </div>
                            </div>

                            <div style={{ background: '#FFF8F2', borderRadius: 8, padding: 12, border: '1px solid #FED7AA' }}>
                              <strong style={{ color: '#9A3412', fontSize: '0.88rem' }}>à¤¡à¥‡à¤Ÿà¤¾à¤¬à¥‡à¤¸ à¤®à¥‡à¤‚ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¸à¤¹à¤¯à¤¾à¤¤à¥à¤°à¥€:</strong>
                              {(verifierResult.booking.passengers || []).map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #FFEDD5', fontSize: '0.85rem' }}>
                                  <span>{idx + 1}. <strong>{p.name}</strong> ({p.age || '-'} à¤µà¤°à¥à¤·, {p.gender || '-'})</span>
                                  <span style={{ color: '#C2410C', fontWeight: 700 }}>à¤¸à¥€à¤Ÿ: {p.seatAssigned || p.seatNumber || '-'}</span>
                                </div>
                              ))}
                            </div>

                            <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥€à¤² à¤¹à¥ˆà¤¶: <code>{verifierResult.securityHash}</code>
                            </div>
                          </div>
                        ) : verifierResult.status === 'TAMPERED' ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEE2E2', color: '#991B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}></div>
                              <div>
                                <h3 style={{ margin: 0, color: '#991B1B', fontSize: '1.3rem', fontWeight: 800 }}>{verifierResult.title}</h3>
                                <p style={{ margin: '2px 0 0', color: '#B91C1C', fontSize: '0.88rem', fontWeight: 600 }}>{verifierResult.message}</p>
                              </div>
                            </div>

                            <div style={{ background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 8, padding: 12, color: '#991B1B', fontSize: '0.85rem', marginBottom: 16 }}>
                              <div><strong>à¤…à¤µà¥ˆà¤§ / à¤œà¤¾à¤²à¥€ à¤¹à¥ˆà¤¶:</strong> <code>{verifierResult.providedSecurityHash}</code></div>
                              <div><strong>à¤¸à¤°à¥à¤µà¤° à¤•à¤¾ à¤…à¤ªà¥‡à¤•à¥à¤·à¤¿à¤¤ à¤µà¥ˆà¤§ à¤¹à¥ˆà¤¶:</strong> <code>{verifierResult.expectedSecurityHash}</code></div>
                              <div style={{ marginTop: 4 }}><strong>à¤›à¥‡à¤¡à¤¼à¤›à¤¾à¤¡à¤¼ à¤µà¤¾à¤²à¥‡ à¤•à¥à¤·à¥‡à¤¤à¥à¤°:</strong> {verifierResult.tamperedFields}</div>
                            </div>

                            <h4 style={{ color: '#9A3412', marginBottom: 8, fontSize: '0.95rem' }}><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤¸à¤°à¥à¤µà¤° à¤•à¤¾ à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤ªà¥à¤°à¤¾à¤®à¤¾à¤£à¤¿à¤• à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡:</h4>
                            <div className="grid-2" style={{ gap: 10, fontSize: '0.88rem' }}>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤­à¤•à¥à¤¤: <strong>{verifierResult.authenticData.bookedBy}</strong> ({verifierResult.authenticData.mobile})
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¸à¥€à¤Ÿ: <strong style={{ color: '#DC2626' }}>à¤•à¥‹à¤š {verifierResult.authenticData.coachName}, à¤¸à¥€à¤Ÿ {Array.isArray(verifierResult.authenticData.seatNumber) ? verifierResult.authenticData.seatNumber.join(', ') : verifierResult.authenticData.seatNumber}</strong>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿: <strong style={{ color: '#DC2626' }}>â‚¹ {verifierResult.authenticData.remainingAmount} ({verifierResult.authenticData.paymentStatus})</strong>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¤‚à¤–à¥à¤¯à¤¾: <strong>{(verifierResult.authenticData.passengers || []).length} à¤¯à¤¾à¤¤à¥à¤°à¥€</strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>âŒ</div>
                            <h3 style={{ color: '#991B1B', fontWeight: 800 }}>{verifierResult.title || 'à¤…à¤®à¤¾à¤¨à¥à¤¯ / à¤«à¤°à¥à¤œà¥€ PNR'}</h3>
                            <p style={{ color: '#B91C1C', fontSize: '0.9rem', marginTop: 4 }}>{verifierResult.message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
            )}

            {/* VIEW: STANDALONE / PUBLIC RECEIPTS DESK */}
            {activeView === 'receipts_desk' && !isStaffView && renderReceiptsDeskView()}

            {/* AUTHENTICATED STAFF WORKSTATION VIEWS (AND PUBLIC COACH POSITION) */}
            {(staffUser || activeView === 'coach_position') && activeView !== 'public_home' && activeView !== 'login' && !(activeView === 'verifier' && currentPath === '/verify-ticket') && (
              <div>

                {/* VIEW: ADMIN DASHBOARD */}
                {activeView === 'admin_dashboard' && renderAdminDashboardView()}

                {/* VIEW: RECEIPTS & PAYMENT SLIPS DESK */}
                {activeView === 'receipts_desk' && renderReceiptsDeskView()}

                {/* NO FREE TICKET POPUP */}
                {showNoFreeTicketPopup && (
                  <div className="modal-overlay" onClick={() => setShowNoFreeTicketPopup(false)} style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 850, textAlign: 'center', padding: '60px 40px', background: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)', border: '4px solid #E11D48', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(225, 29, 72, 0.4)' }}>
                      <AlertTriangle size={100} color="#E11D48" style={{ marginBottom: 24 }} />
                      <h1 style={{ fontSize: '3rem', color: '#9F1239', fontWeight: 900, marginBottom: 24, lineHeight: 1.2 }}>
                        à¤¬à¤¿à¤¨à¤¾ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¥‡ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¸à¤‚à¤­à¤µ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ!
                      </h1>
                      <h2 style={{ fontSize: '1.8rem', color: '#BE123C', fontWeight: 700, marginBottom: 30, lineHeight: 1.4 }}>
                        à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¸à¥à¤Ÿà¤¾à¤« à¤ªà¤° à¤¨à¤¿à¤ƒà¤¶à¥à¤²à¥à¤• (Free) à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¥‡ à¤²à¤¿à¤ à¤¦à¤¬à¤¾à¤µ à¤¨ à¤¡à¤¾à¤²à¥‡à¤‚ à¤”à¤° à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¤¾à¤°à¥à¤¯ à¤®à¥‡à¤‚ à¤¬à¤¾à¤§à¤¾ à¤‰à¤¤à¥à¤ªà¤¨à¥à¤¨ à¤¨ à¤•à¤°à¥‡à¤‚à¥¤
                      </h2>
                      <div style={{ fontSize: '1.2rem', color: '#4C0519', fontWeight: 600, padding: '20px', background: '#FDA4AF', borderRadius: 12, display: 'inline-block' }}>
                        ðŸ™ à¤†à¤ªà¤•à¥‡ à¤¸à¤¹à¤¯à¥‹à¤— à¤•à¥‡ à¤²à¤¿à¤ à¤¹à¤® à¤†à¤­à¤¾à¤°à¥€ à¤¹à¥ˆà¤‚à¥¤ ðŸ™
                      </div>
                      <div style={{ marginTop: 40 }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '16px 40px', fontSize: '1.2rem', background: '#E11D48', borderColor: '#E11D48' }}
                          onClick={() => setShowNoFreeTicketPopup(false)}
                        >
                          à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚ (Close)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW: BOOKING COUNTER FORM */}
                {activeView === 'booking' && (
                  <div>
                    <div>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      <span className="badge badge-bhakti">à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤°à¥‡à¤²à¤µà¥‡ à¤†à¤°à¤•à¥à¤·à¤£ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°</span>
                      <h2 style={{ fontSize: '2.1rem', color: '#9A3412', marginTop: 6, fontWeight: 800 }}>à¤Ÿà¥à¤°à¥‡à¤¨ à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤«à¥‰à¤°à¥à¤®</h2>
                      <p style={{ color: '#7C2D12', fontWeight: 600 }}>à¤²à¤¾à¤‡à¤µ à¤¸à¥€à¤Ÿ à¤‰à¤ªà¤²à¤¬à¥à¤§à¤¤à¤¾ à¤®à¥ˆà¤ª â€¢ à¤¤à¤¤à¥à¤•à¤¾à¤² à¤•à¥à¤¯à¥‚à¤†à¤° à¤Ÿà¥‹à¤•à¤¨ à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ â€¢ à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¤°à¥à¤šà¥€</p>
                      
                      <div style={{ marginTop: 12 }}>
                        <button 
                          type="button" 
                          className="btn btn-outline" 
                          style={{ borderColor: '#991B1B', color: '#991B1B', fontWeight: 800, padding: '8px 16px', fontSize: '0.85rem' }}
                          onClick={() => setShowNoFreeTicketPopup(true)}
                        >
                          <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> 
                          à¤«à¥à¤°à¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤µà¤¾à¤°à¥à¤¨à¤¿à¤‚à¤— à¤¦à¤¿à¤–à¤¾à¤à¤‚ (Show Warning)
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleBookingSubmit}>
                      <div className="grid-2">
                        {/* Left Column: Route & Seats */}
                        <div>
                          <div className="glass-card" style={{ marginBottom: 20 }}>
                            <h3 style={{ color: '#9A3412', fontSize: '1.25rem', marginBottom: 16, fontWeight: 800 }}>
                              <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 1. à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· à¤à¤µà¤‚ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤šà¤¯à¤¨
                            </h3>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· (à¤¹à¤° à¤¸à¤¾à¤² à¤Ÿà¥à¤°à¥‡à¤¨):</label>
                                <select className="form-control" value={bookingYear} onChange={(e) => setBookingYear(e.target.value)}>
                                  <option value="2026">à¤¯à¤¾à¤¤à¥à¤°à¤¾ 2026 (à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¬à¥ˆà¤š)</option>
                                  <option value="2027">à¤¯à¤¾à¤¤à¥à¤°à¤¾ 2027 (à¤…à¤—à¥à¤°à¤¿à¤® à¤¬à¥à¤•à¤¿à¤‚à¤—)</option>
                                  <option value="2025">à¤¯à¤¾à¤¤à¥à¤°à¤¾ 2025 (à¤ªà¥à¤°à¤¾à¤¨à¤¾ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡)</option>
                                  <option value="2024">à¤¯à¤¾à¤¤à¥à¤°à¤¾ 2024 (à¤ªà¥à¤°à¤¾à¤¨à¤¾ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡)</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¥€ à¤¤à¤¿à¤¥à¤¿ (Travel Date):</label>
                                <input type="date" className="form-control" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} required />
                                <div style={{ marginTop: '6px', color: '#DC2626', fontWeight: 800, fontSize: '0.82rem', animation: 'pulse 2s infinite' }}>
                                  ðŸ”¥ 1,245+ Tickets Booked! Limited Seats Available.
                                </div>
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ (Boarding Station - Lucknow to Katra Route):</label>
                                <select className="form-control" value={fromStation} onChange={(e) => setFromStation(e.target.value)}>
                                  {stationsList.map((stn, idx) => (
                                    <option key={idx} value={stn}>{stn}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ (Destination):</label>
                                <input type="text" className="form-control" value="Shri Mata Vaishno Devi Katra (SVDK)" readOnly style={{ background: '#FFF8F2', color: '#047857', fontWeight: 800 }} />
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤¶à¥à¤°à¥‡à¤£à¥€ (Class):</label>
                                <select className="form-control" value={travelClass} onChange={(e) => setTravelClass(e.target.value)}>
                                  <option value="Sleeper">à¤¸à¥à¤²à¥€à¤ªà¤° à¤•à¥à¤²à¤¾à¤¸ (SL) - â‚¹ 3,000</option>
                                  <option value="AC">à¤à¤¸à¥€ à¤•à¥‹à¤š (AC 3A/2A) - â‚¹ 4,000</option>
                                  <option value="General">à¤œà¤¨à¤°à¤² / à¤¸à¥€à¤Ÿà¤¿à¤‚à¤— (2S) - â‚¹ 2,000</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">à¤•à¥‹à¤š à¤¨à¤‚à¤¬à¤° (Coach):</label>
                                <select className="form-control" value={coachName} onChange={(e) => setCoachName(e.target.value)}>
                                  {(COACHES[travelClass] || COACHES.Sleeper).map(c => (
                                    <option key={c} value={c}>Coach {c}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Visual Seat Selector */}
                          <div className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <h4 style={{ fontSize: '1.15rem', color: '#9A3412', fontWeight: 800, margin: 0 }}>à¤•à¥‹à¤š {coachName} à¤¸à¥€à¤Ÿ à¤®à¥ˆà¤ª (à¤¯à¤¾à¤¤à¥à¤°à¤¾ {bookingYear})</h4>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¸à¥€à¤Ÿ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¤•à¥‡ à¤šà¥à¤¨à¥‡à¤‚ à¤…à¤¥à¤µà¤¾ à¤¸à¥à¤µà¤¤à¤ƒ à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¤°à¥‡à¤‚</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-gold"
                                  onClick={handleAutoAssignSeats}
                                  style={{ padding: '5px 10px', fontSize: '0.8rem', fontWeight: 700 }}
                                  title="à¤¸à¥à¤µà¤šà¤¾à¤²à¤¿à¤¤ à¤°à¥‚à¤ª à¤¸à¥‡ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤šà¥à¤¨à¥‡à¤‚"
                                >
                                  à¤¸à¥à¤µà¤¤à¤ƒ à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤šà¥à¤¨à¥‡à¤‚ ({passengers.length} Seat{passengers.length > 1 ? 's' : ''})
                                </button>
                                <span className="badge badge-paid">{coachLayout.availableCount} à¤–à¤¾à¤²à¥€</span>
                                <span className="badge badge-unpaid">{coachLayout.bookedCount} à¤†à¤°à¤•à¥à¤·à¤¿à¤¤</span>
                              </div>
                            </div>

                            <div className="seat-grid">
                              {coachLayout.layout.map(seat => {
                                const isSelected = selectedSeats.includes(String(seat.seatNumber)) || passengers.some(p => String(p.seatAssigned) === String(seat.seatNumber));
                                return (
                                  <div
                                    key={seat.seatNumber}
                                    className={`seat-box ${seat.isBooked ? 'seat-booked' : (isSelected ? 'seat-selected' : 'seat-available')}`}
                                    onClick={() => handleSeatClick(seat.seatNumber, seat.isBooked)}
                                    title={`Seat ${seat.seatNumber} (${seat.berthType})${isSelected ? ' - à¤šà¤¯à¤¨à¤¿à¤¤' : ''}`}
                                  >
                                    <div style={{ fontSize: '0.95rem', fontWeight: 900 }}>
                                      {isSelected ? 'âœ“ ' : ''}{seat.seatNumber}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: isSelected ? 800 : 500 }}>
                                      {seat.berthType.slice(0, 2)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 14, fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#DC2626', borderRadius: 3 }} /> à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ (Booked)
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#16A34A', borderRadius: 3 }} /> à¤šà¥à¤¨à¥€ à¤¹à¥à¤ˆ (Selected)
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#FFFFFF', border: '1.5px solid #FED7AA', borderRadius: 3 }} /> à¤‰à¤ªà¤²à¤¬à¥à¤§ (Available)
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Devotee & Passengers */}
                        <div>
                          {/* Lead Devotee Details */}
                          <div className="glass-card" style={{ marginBottom: 20 }}>
                            <h3 style={{ color: '#9A3412', fontSize: '1.25rem', marginBottom: 16, fontWeight: 800 }}>
                              2. à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ à¤µà¤¿à¤µà¤°à¤£ (Lead Devotee)
                            </h3>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® *</label>
                                <input type="text" className="form-control" value={bookedBy} onChange={(e) => setBookedBy(e.target.value)} required autoFocus />
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° (WhatsApp) *</label>
                                <input type="tel" className="form-control" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength="10" required />
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤ˆà¤®à¥‡à¤² à¤ªà¤¤à¤¾ (à¤µà¥ˆà¤•à¤²à¥à¤ªà¤¿à¤•):</label>
                                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤†à¤§à¤¾à¤° à¤¨à¤‚à¤¬à¤° *</label>
                                <input type="text" className="form-control" value={aadhar} onChange={(e) => setAadhar(e.target.value)} maxLength="12" required />
                              </div>
                            </div>
                          </div>

                          {/* Co-Passengers List */}
                          <div className="glass-card" style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <h3 style={{ color: '#9A3412', fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                                <Users size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 3. à¤¸à¤¹à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤µà¤¿à¤µà¤°à¤£ ({passengers.length} Yatri)
                              </h3>
                              <button type="button" className="btn btn-outline btn-sm" onClick={addPassenger}>
                                + à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚
                              </button>
                            </div>

                            {passengers.map((p, idx) => {
                              const assignedSeat = p.seatAssigned || selectedSeats[idx] || (idx + 1).toString();
                              const detectedBerth = getBerthType(assignedSeat, travelClass);
                              return (
                              <div key={idx} style={{ background: '#FFF8F2', padding: 14, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <strong style={{ color: '#9A3412', fontSize: '0.9rem' }}>à¤¯à¤¾à¤¤à¥à¤°à¥€ #{idx + 1}</strong>
                                    <span className="badge badge-bhakti" style={{ fontSize: '0.74rem', padding: '2px 8px' }}>
                                      à¤¸à¥€à¤Ÿ: {assignedSeat} ({detectedBerth})
                                    </span>
                                  </div>
                                  {idx === 0 && (
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#C2410C', cursor: 'pointer', fontWeight: 'bold' }}>
                                      <input
                                        type="checkbox"
                                        checked={sameAsLeadDevotee}
                                        onChange={(e) => handleSameAsLeadToggle(e.target.checked)}
                                        style={{ accentColor: '#E65100', width: 16, height: 16 }}
                                      />
                                      à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ à¤¹à¥€ à¤¯à¤¾à¤¤à¥à¤°à¥€ #1 à¤¹à¥ˆà¤‚ (Auto-Fill)
                                    </label>
                                  )}
                                  {idx > 0 && (
                                    <button type="button" onClick={() => removePassenger(idx)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}>
                                      à¤¹à¤Ÿà¤¾à¤à¤‚ âœ•
                                    </button>
                                  )}
                                </div>

                                <div className="grid-2">
                                  <div className="form-group">
                                    <input type="text" className="form-control" placeholder="à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤®" value={p.name} onChange={(e) => handlePassengerChange(idx, 'name', e.target.value)} required />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="number" className="form-control" placeholder="à¤†à¤¯à¥" value={p.age} onChange={(e) => handlePassengerChange(idx, 'age', e.target.value)} min="1" max="100" style={{ width: '45%' }} required />
                                    <select className="form-control" value={p.gender} onChange={(e) => handlePassengerChange(idx, 'gender', e.target.value)} style={{ width: '55%' }}>
                                      <option value="Male">à¤ªà¥à¤°à¥à¤·</option>
                                      <option value="Female">à¤®à¤¹à¤¿à¤²à¤¾</option>
                                      <option value="Other">à¤…à¤¨à¥à¤¯</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid-2">
                                  <input type="text" className="form-control" placeholder="à¤†à¤§à¤¾à¤° à¤•à¥à¤°à¤®à¤¾à¤‚à¤• / à¤ªà¤¹à¤šà¤¾à¤¨" value={p.aadhar} onChange={(e) => handlePassengerChange(idx, 'aadhar', e.target.value)} />
                                  <select className="form-control" value={p.berthPreference} onChange={(e) => handlePassengerChange(idx, 'berthPreference', e.target.value)}>
                                    <option value="Lower">Lower Berth</option>
                                    <option value="Middle">Middle Berth</option>
                                    <option value="Upper">Upper Berth</option>
                                    <option value="Side Lower">Side Lower</option>
                                    <option value="Side Upper">Side Upper</option>
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                          {/* Fare Calculation & Token Advance */}
                          <div className="glass-card">
                            <h3 style={{ color: '#9A3412', fontSize: '1.25rem', marginBottom: 14, fontWeight: 800 }}>
                              <IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 4. à¤°à¤¿à¤¯à¤¾à¤¯à¤¤à¥€ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤à¤µà¤‚ à¤…à¤—à¥à¤°à¤¿à¤® à¤Ÿà¥‹à¤•à¤¨
                            </h3>

                            <div style={{ background: '#FFF8F2', padding: 14, borderRadius: 8, marginBottom: 14, border: '1.5px solid #FED7AA' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span>à¤ªà¥à¤°à¤¤à¤¿ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¿à¤°à¤¾à¤¯à¤¾:</span>
                                <strong>â‚¹ {unitFare?.toLocaleString()}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span>à¤•à¥à¤² à¤¯à¤¾à¤¤à¥à¤°à¥€:</span>
                                <strong>{passengers.length}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9A3412', fontSize: '1.2rem', fontWeight: 800 }}>
                                <span>à¤•à¥à¤² à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿:</span>
                                <span>â‚¹ {netPayable?.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤…à¤—à¥à¤°à¤¿à¤® à¤Ÿà¥‹à¤•à¤¨ à¤°à¤¾à¤¶à¤¿ (Advance â‚¹):</label>
                                <input type="number" className="form-control" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} min="0" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤›à¥‚à¤Ÿ / à¤°à¤¿à¤¯à¤¾à¤¯à¤¤ (Discount â‚¹):</label>
                                <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" />
                              </div>
                            </div>

                            <div style={{
                              background: 'linear-gradient(90deg, #FFF0E5, #FFE4D0)',
                              border: '1.5px solid #FB923C', padding: 14, borderRadius: 8, marginBottom: 18,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontSize: '0.85rem', color: '#7C2D12', fontWeight: 700 }}>à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤†à¤—à¤®à¤¨ à¤ªà¤° à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿:</div>
                                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#C2410C' }}>â‚¹ {remainingDue?.toLocaleString()}</div>
                              </div>
                              <span className={`badge ${remainingDue <= 0 ? 'badge-paid' : 'badge-partial'}`}>
                                {remainingDue <= 0 ? 'à¤ªà¥‚à¤°à¥à¤£ à¤­à¥à¤—à¤¤à¤¾à¤¨' : 'à¤Ÿà¥‹à¤•à¤¨ à¤­à¥à¤—à¤¤à¤¾à¤¨'}
                              </span>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }} disabled={isSubmitting}>
                              {isSubmitting ? 'à¤†à¤°à¤•à¥à¤·à¤£ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...' : <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤†à¤°à¤•à¥à¤·à¤£ à¤ªà¤•à¥à¤•à¤¾ à¤•à¤°à¥‡à¤‚ à¤à¤µà¤‚ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¤°à¥à¤šà¥€ à¤œà¤¾à¤°à¥€ à¤•à¤°à¥‡à¤‚</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                  </div>
                )}

                {/* VIEW: BOOKINGS DIRECTORY */}
                {activeView === 'bookings_list' && (
                  <div>
                    <div>
                    {/* KPI Metrics Strip */}
                    {adminStats && (
                      <div className="grid-4" style={{ marginBottom: 24 }}>
                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>à¤•à¥à¤² à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#C2410C', margin: '4px 0' }}>{adminStats.totalBookings}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>{adminStats.totalPassengers} à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤</div>
                        </div>

                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>à¤•à¥à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¸à¤‚à¤—à¥à¤°à¤¹</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#047857', margin: '4px 0' }}>â‚¹ {adminStats?.totalCollection?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>à¤¸à¤•à¤² à¤°à¤¿à¤¯à¤¾à¤¯à¤¤à¥€ à¤°à¤¾à¤¶à¤¿</div>
                        </div>

                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>à¤…à¤—à¥à¤°à¤¿à¤® à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ (Token)</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#B45309', margin: '4px 0' }}>â‚¹ {adminStats?.totalAdvance?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤œà¤®à¤¾ à¤…à¤—à¥à¤°à¤¿à¤®</div>
                        </div>

                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ (Remaining)</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>â‚¹ {adminStats?.totalRemaining?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤®à¥‡à¤‚ à¤¦à¥‡à¤¯</div>
                        </div>
                      </div>
                    )}

                    {/* Bookings Directory Table */}
                    <div className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h3 style={{ fontSize: '1.25rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤†à¤°à¤•à¥à¤·à¤£ à¤¡à¤¾à¤¯à¤°à¥‡à¤•à¥à¤Ÿà¤°à¥€</h3>
                          <select className="form-control" style={{ padding: '4px 8px', width: 'auto' }} value={adminYearFilter} onChange={(e) => setAdminYearFilter(e.target.value)}>
                            <option value="">à¤¸à¤­à¥€ à¤µà¤°à¥à¤· (All)</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="PNR, à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ à¤¯à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤–à¥‹à¤œà¥‡à¤‚..."
                          style={{ width: 280 }}
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                        />
                      </div>

                      <div className="table-responsive">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>PNR</th>
                              <th>à¤µà¤°à¥à¤·</th>
                              <th>à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤</th>
                              <th>à¤°à¥‚à¤Ÿ</th>
                              <th>à¤•à¥‹à¤š / à¤¸à¥€à¤Ÿ</th>
                              <th>à¤¯à¤¾à¤¤à¥à¤°à¥€</th>
                              <th>à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                              <th>à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                              <th style={{ textAlign: 'right' }}>à¤•à¤¾à¤°à¥à¤¯</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminBookings
                              .filter(b => !adminSearch || 
                                b.bookingId.toLowerCase().includes(adminSearch.toLowerCase()) ||
                                b.bookedBy.toLowerCase().includes(adminSearch.toLowerCase()) ||
                                (b.mobile && b.mobile.includes(adminSearch))
                              )
                              .map(b => (
                                <tr key={b.bookingId}>
                                  <td><strong style={{ color: '#C2410C' }}>{b.bookingId}</strong></td>
                                  <td><span className="badge badge-bhakti">{b.yatraYear}</span></td>
                                  <td>
                                    <strong>{b.bookedBy}</strong>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.mobile}</div>
                                  </td>
                                  <td style={{ fontSize: '0.85rem' }}>
                                    <div>{b.fromStation}</div>
                                    <div style={{ color: '#047857', fontWeight: 600 }}>âž” {b.toStation}</div>
                                  </td>
                                  <td>
                                    <span style={{ color: '#9A3412', fontWeight: 'bold' }}>{b.coachName}</span>
                                    <div style={{ fontSize: '0.75rem' }}>à¤¸à¥€à¤Ÿ: {Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber}</div>
                                  </td>
                                  <td><strong>{b.numberOfPassengers || (b.passengers ? b.passengers.length : 1)}</strong></td>
                                  <td style={{ fontSize: '0.85rem' }}>
                                    <div>à¤•à¥à¤²: â‚¹ {b.totalAmount}</div>
                                    <div style={{ color: '#047857' }}>à¤…à¤—à¥à¤°à¤¿à¤®: â‚¹ {b.advance}</div>
                                    <div style={{ color: b.remainingAmount > 0 ? '#DC2626' : '#047857', fontWeight: 'bold' }}>à¤¶à¥‡à¤·: â‚¹ {b.remainingAmount}</div>
                                    {b.utrNumber && (
                                      <div style={{ marginTop: 4, padding: 2, background: b.utrStatus === 'Verified' ? '#D1FAE5' : '#FEF3C7', borderRadius: 4, border: '1px solid #FDE68A' }}>
                                        <span style={{ fontWeight: 600 }}>UTR:</span> {b.utrNumber}
                                        <div style={{ fontSize: '0.75rem', color: b.utrStatus === 'Verified' ? '#047857' : '#D97706' }}>
                                          {b.utrStatus === 'Verified' ? 'âœ“ Verified' : 'Pending'}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge ${b.paymentStatus === 'Paid' ? 'badge-paid' : (b.paymentStatus === 'Partial' ? 'badge-partial' : 'badge-unpaid')}`}>
                                      {b.paymentStatus}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '6px 8px' }}>
                                    <div className="action-btn-group">
                                      {b.utrNumber && b.utrStatus !== 'Verified' && (
                                        <button className="btn btn-xs btn-gold" onClick={() => verifyUtr(b.bookingId, b.utrNumber)} title="Verify UTR">
                                          âœ“ Verify
                                        </button>
                                      )}
                                      {b.remainingAmount > 0 && b.utrStatus !== 'Pending' && (
                                        <button className="btn btn-xs btn-success" onClick={() => markBookingPaid(b.bookingId)} title="Clear Dues">
                                          âœ“ Paid
                                        </button>
                                      )}
                                      <button className="btn btn-xs btn-gold" onClick={() => { setReceiptSearchQuery(b.bookingId); navigate('/admin/receipts'); }} title="à¤°à¤¸à¥€à¤¦à¥‡à¤‚">
                                        <Printer size={13} /> à¤°à¤¸à¥€à¤¦
                                      </button>
                                      <button className="btn btn-xs btn-outline" onClick={() => setTicketModal(b)} title="à¤ªà¤°à¥à¤šà¥€ à¤¦à¥‡à¤–à¥‡à¤‚">
                                        <Eye size={13} /> à¤ªà¤°à¥à¤šà¥€
                                      </button>
                                      <button className="btn btn-icon-xs btn-outline" onClick={() => openUpiQR(b.bookingId)} title="UPI QR">
                                        <Smartphone size={13} />
                                      </button>
                                      {isSuperAdmin && (
                                        <button className="btn btn-icon-xs btn-outline" onClick={() => {
                                          setPaymentEditData({
                                            bookingId: b.bookingId,
                                            paymentMode: b.paymentMode || 'Cash',
                                            upiTransactionId: b.upiTransactionId || '',
                                            advance: b.advance || 0,
                                            discount: b.discount || 0,
                                            totalAmount: b.totalAmount
                                          });
                                          setPaymentEditModal(true);
                                        }} title="à¤•à¤¿à¤°à¤¾à¤¯à¤¾ / à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤à¤¡à¤¿à¤Ÿ">
                                          <IndianRupee size={13} />
                                        </button>
                                      )}
                                      <a href={`/api/bookings/${b.bookingId}/pdf`} target="_blank" rel="noreferrer" className="btn btn-icon-xs btn-outline" title="PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡">
                                        <FileText size={13} />
                                      </a>
                                      {isSuperAdmin && (
                                        <button className="btn btn-icon-xs btn-danger" onClick={() => deleteBooking(b.bookingId)} title="Delete">
                                          âœ•
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {/* VIEW: IRCTC COACH SEATING CHART */}
                {activeView === 'chart' && (
                  <div>
                    <div>
                    <div className="glass-card" style={{ marginBottom: 24, border: '2px solid #FED7AA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                        <div>
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}>à¤­à¤¾à¤°à¤¤à¥€à¤¯ à¤°à¥‡à¤² / à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤†à¤°à¤•à¥à¤·à¤£ à¤šà¤¾à¤°à¥à¤Ÿ</span>
                          <h2 style={{ fontSize: '1.8rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            à¤•à¥‹à¤š à¤†à¤°à¤•à¥à¤·à¤£ à¤šà¤¾à¤°à¥à¤Ÿ (IRCTC Seating Chart)
                          </h2>
                          <div style={{ color: '#7C2D12', fontSize: '0.9rem', marginTop: 4 }}>
                            à¤•à¥‹à¤š à¤…à¤¨à¥à¤¸à¤¾à¤° à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¬à¤°à¥à¤¥ à¤†à¤µà¤‚à¤Ÿà¤¨, à¤ªà¥€à¤à¤¨à¤†à¤° à¤à¤µà¤‚ à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤ªà¥à¤°à¤¾à¤°à¥‚à¤ª
                          </div>
                        </div>

                        {/* Coach & Year Switcher Controls */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412' }}>à¤•à¥‹à¤š:</label>
                            <select
                              className="form-control"
                              style={{ padding: '4px 8px', width: 'auto' }}
                              value={chartCoach}
                              onChange={(e) => {
                                setChartCoach(e.target.value);
                                loadCoachChart(e.target.value, chartYear);
                              }}
                            >
                              {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'GS1', 'GS2', 'SLR'].map(c => (
                                <option key={c} value={c}>Coach {c}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412' }}>à¤µà¤°à¥à¤·:</label>
                            <select
                              className="form-control"
                              style={{ padding: '4px 8px', width: 'auto' }}
                              value={chartYear}
                              onChange={(e) => {
                                setChartYear(e.target.value);
                                loadCoachChart(chartCoach, e.target.value);
                              }}
                            >
                              <option value="2026">2026</option>
                              <option value="2027">2027</option>
                              <option value="2025">2025</option>
                              <option value="2024">2024</option>
                            </select>
                          </div>

                          <button className="btn btn-primary" onClick={() => openPrintChart(chartCoach, chartYear)} style={{ boxShadow: '0 4px 15px rgba(230,81,0,0.35)' }}>
                            <Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC à¤šà¤¾à¤°à¥à¤Ÿ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚
                          </button>
                        </div>
                      </div>

                      {/* Summary Metric Strip */}
                      {coachChartData && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 18, borderTop: '1px solid #FED7AA', paddingTop: 16 }}>
                          <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 700 }}>à¤•à¥à¤² à¤¬à¤°à¥à¤¥ à¤•à¥à¤·à¤®à¤¤à¤¾</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9A3412' }}>{coachChartData.totalCapacity}</div>
                          </div>
                          <div style={{ background: '#ECFDF5', padding: '10px 14px', borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: 700 }}>à¤•à¤¨à¥à¤«à¤°à¥à¤® à¤¸à¥€à¤Ÿà¥‡à¤‚ (CNF)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>{coachChartData.bookedCount}</div>
                          </div>
                          <div style={{ background: '#FFFBEB', padding: '10px 14px', borderRadius: 8, border: '1px solid #FDE68A', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>à¤°à¤¿à¤•à¥à¤¤ à¤¸à¥€à¤Ÿà¥‡à¤‚ (Vacant)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#B45309' }}>{coachChartData.vacantCount}</div>
                          </div>
                          <div style={{ background: '#EFF6FF', padding: '10px 14px', borderRadius: 8, border: '1px solid #BFDBFE', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#1E40AF', fontWeight: 700 }}>à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563EB' }}>{coachChartData.presentCount}</div>
                          </div>
                          <div style={{ background: '#FEF2F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FECACA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#991B1B', fontWeight: 700 }}>à¤•à¥‹à¤š à¤®à¥‡à¤‚ à¤¬à¤•à¤¾à¤¯à¤¾ à¤¦à¥‡à¤¯</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626' }}>â‚¹ {coachChartData?.totalDuesInCoach?.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chart Table */}
                    <div className="glass-card" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['all', 'cnf', 'vacant', 'dues'].map(f => (
                            <button
                              key={f}
                              className={`btn btn-sm ${chartFilter === f ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => setChartFilter(f)}
                            >
                              {f === 'all' && `à¤¸à¤­à¥€ à¤¸à¥€à¤Ÿà¥‡à¤‚ (${coachChartData?.totalCapacity || 0})`}
                              {f === 'cnf' && `à¤•à¤¨à¥à¤«à¤°à¥à¤® à¤¸à¥€à¤Ÿà¥‡à¤‚ (${coachChartData?.bookedCount || 0})`}
                              {f === 'vacant' && `à¤°à¤¿à¤•à¥à¤¤ à¤¸à¥€à¤Ÿà¥‡à¤‚ (${coachChartData?.vacantCount || 0})`}
                              {f === 'dues' && `à¤¬à¤•à¤¾à¤¯à¤¾ à¤•à¤¿à¤°à¤¾à¤¯à¤¾`}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          className="form-control"
                          placeholder="à¤¸à¥€à¤Ÿ à¤¨à¤‚, à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤®, PNR à¤–à¥‹à¤œà¥‡à¤‚..."
                          style={{ width: 280 }}
                          value={chartSearch}
                          onChange={(e) => setChartSearch(e.target.value)}
                        />
                      </div>

                      {chartLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#E65100', fontWeight: 'bold' }}>
                          à¤šà¤¾à¤°à¥à¤Ÿ à¤²à¥‹à¤¡ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ... à¤•à¥ƒà¤ªà¤¯à¤¾ à¤ªà¥à¤°à¤¤à¥€à¤•à¥à¤·à¤¾ à¤•à¤°à¥‡à¤‚
                        </div>
                      ) : coachChartData ? (
                        <div className="table-responsive">
                          <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: 60, textAlign: 'center' }}>à¤¸à¥€à¤Ÿ à¤¨à¤‚</th>
                                <th style={{ width: 80 }}>à¤¬à¤°à¥à¤¥ à¤ªà¥à¤°à¤•à¤¾à¤°</th>
                                <th style={{ width: 130 }}>PNR à¤•à¥à¤°à¤®à¤¾à¤‚à¤•</th>
                                <th>à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤® (Passenger)</th>
                                <th style={{ width: 90, textAlign: 'center' }}>à¤†à¤¯à¥ / à¤²à¤¿à¤‚à¤—</th>
                                <th>à¤•à¤¹à¤¾à¤ à¤¸à¥‡ - à¤•à¤¹à¤¾à¤ à¤¤à¤•</th>
                                <th style={{ width: 90, textAlign: 'center' }}>à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                                <th style={{ width: 110 }}>à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                                <th style={{ width: 100, textAlign: 'center' }}>à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                              </tr>
                            </thead>
                            <tbody>
                              {coachChartData.rows
                                .filter(r => {
                                  if (chartFilter === 'cnf' && !r.isBooked) return false;
                                  if (chartFilter === 'vacant' && r.isBooked) return false;
                                  if (chartFilter === 'dues' && (!r.isBooked || r.remainingAmount <= 0)) return false;
                                  if (chartSearch) {
                                    const q = chartSearch.toLowerCase();
                                    return String(r.seatNumber).includes(q) ||
                                      (r.passengerName && r.passengerName.toLowerCase().includes(q)) ||
                                      (r.pnr && r.pnr.toLowerCase().includes(q));
                                  }
                                  return true;
                                })
                                .map((r) => (
                                  <tr key={r.seatNumber} style={{ background: !r.isBooked ? '#FFFDFB' : '#FFFFFF' }}>
                                    <td style={{ textAlign: 'center', fontWeight: 900, color: '#C2410C', fontSize: '1.05rem' }}>
                                      {r.seatNumber}
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: 700, color: '#9A3412' }}>{r.berthType}</span>
                                    </td>
                                    <td>
                                      {r.pnr ? (
                                        <strong style={{ color: '#E65100', cursor: 'pointer' }} onClick={() => { setPnrInput(r.pnr); searchPNR(r.pnr); }}>
                                          {r.pnr}
                                        </strong>
                                      ) : '-'}
                                    </td>
                                    <td>
                                      {r.isBooked ? (
                                        <div>
                                          <div style={{ fontWeight: 800, color: '#431407' }}>{r.passengerName}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#7C2D12' }}>à¤®à¥à¤–à¥à¤¯: {r.bookedBy} (à¤®à¥‹: {r.mobile})</div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>--- à¤–à¤¾à¤²à¥€ (Vacant) ---</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {r.isBooked ? `${r.age || '-'} / ${r.gender === 'Female' ? 'F' : 'M'}` : '-'}
                                    </td>
                                    <td style={{ fontSize: '0.82rem' }}>
                                      {r.fromStation ? `${r.fromStation.split(' ')[0]} âž” SVDK` : '-'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {r.isBooked ? (
                                        <span className="badge badge-paid" style={{ fontSize: '0.72rem' }}>CNF</span>
                                      ) : (
                                        <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280', fontSize: '0.72rem' }}>VACANT</span>
                                      )}
                                    </td>
                                    <td>
                                      {r.isBooked ? (
                                        r.remainingAmount > 0 ? (
                                          <span className="badge badge-partial" style={{ fontSize: '0.72rem' }}>à¤¦à¥‡à¤¯: â‚¹{r.remainingAmount}</span>
                                        ) : (
                                          <span className="badge badge-paid" style={{ fontSize: '0.72rem' }}>à¤ªà¥à¤°à¤¦à¤¤à¥à¤¤</span>
                                        )
                                      ) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {r.isBooked ? (
                                        <span className={`badge ${r.checkInStatus === 'Present' ? 'badge-paid' : (r.checkInStatus === 'Absent' ? 'badge-unpaid' : 'badge-bhakti')}`} style={{ fontSize: '0.72rem' }}>
                                          {r.checkInStatus === 'Present' ? 'à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤' : (r.checkInStatus === 'Absent' ? 'à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤' : 'à¤²à¤‚à¤¬à¤¿à¤¤')}
                                        </span>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  </div>
                )}

                {/* VIEW: TTE ON-TRAIN ATTENDANCE & DUES COLLECTION */}
                {activeView === 'tte_checkin' && (
                  <div>
                    <div>
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 26, color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
                          }}><BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /></div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.4rem', fontWeight: 800 }}>{staffUser.name} (TTE On-Duty)</h3>
                              <span className="badge badge-paid" style={{ fontSize: '0.75rem' }}>à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤šà¥‡à¤•à¤¿à¤‚à¤—</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#7C2D12', marginTop: 2 }}>
                              à¤Ÿà¥à¤°à¥‡à¤¨: 04201 / 04202 à¤µà¤¿à¤¶à¥‡à¤· à¤¸à¥à¤ªà¤°à¤«à¤¾à¤¸à¥à¤Ÿ â€¢ à¤¬à¥ˆà¤š {chartYear} â€¢ à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤®à¤¾à¤°à¥à¤—
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412' }}>à¤•à¥‹à¤š à¤šà¥à¤¨à¥‡à¤‚:</label>
                            <select
                              className="form-control"
                              style={{ padding: '4px 8px', width: 'auto' }}
                              value={chartCoach}
                              onChange={(e) => {
                                setChartCoach(e.target.value);
                                loadCoachChart(e.target.value, chartYear);
                              }}
                            >
                              {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'GS1', 'GS2', 'SLR'].map(c => (
                                <option key={c} value={c}>Coach {c}</option>
                              ))}
                            </select>
                          </div>

                          <button className="btn btn-primary btn-sm" onClick={() => openPrintChart(chartCoach, chartYear)}>
                            <Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC à¤šà¤¾à¤°à¥à¤Ÿ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ
                          </button>
                        </div>
                      </div>

                      {/* Quick TTE Stats Strip */}
                      {coachChartData && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16, borderTop: '1px solid #FED7AA', paddingTop: 14 }}>
                          <div style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #FED7AA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12' }}>à¤•à¥à¤² à¤¯à¤¾à¤¤à¥à¤°à¥€ (Booked)</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#9A3412' }}>{coachChartData.bookedCount}</div>
                          </div>
                          <div style={{ background: '#ECFDF5', padding: '8px 12px', borderRadius: 6, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#065F46' }}>âœ“ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ (Present)</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#047857' }}>{coachChartData.presentCount}</div>
                          </div>
                          <div style={{ background: '#FEF2F2', padding: '8px 12px', borderRadius: 6, border: '1px solid #FECACA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#991B1B' }}>âœ— à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤ (Absent)</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#DC2626' }}>{coachChartData.absentCount}</div>
                          </div>
                          <div style={{ background: '#FFFBEB', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#92400E' }}>à¤²à¤‚à¤¬à¤¿à¤¤ à¤šà¥‡à¤•à¤¿à¤‚à¤—</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#B45309' }}>{coachChartData.pendingCheckInCount}</div>
                          </div>
                          <div style={{ background: '#FFF7ED', padding: '8px 12px', borderRadius: 6, border: '1px solid #FFEDD5', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#C2410C' }}>à¤•à¥à¤² à¤¬à¤¾à¤•à¥€ à¤•à¤¿à¤°à¤¾à¤¯à¤¾</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#C2410C' }}>â‚¹ {coachChartData.totalDuesInCoach.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TTE Interactive Seat Checking List */}
                    <div className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                        <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.25rem', fontWeight: 800 }}>
                          à¤•à¥‹à¤š {chartCoach} à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤šà¥‡à¤•à¤¿à¤‚à¤— à¤¸à¥‚à¤šà¥€
                        </h3>

                        <input
                          type="text"
                          className="form-control"
                          placeholder="à¤¸à¥€à¤Ÿ à¤¨à¤‚à¤¬à¤°, à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¯à¤¾ PNR à¤–à¥‹à¤œà¥‡à¤‚..."
                          style={{ width: 280 }}
                          value={chartSearch}
                          onChange={(e) => setChartSearch(e.target.value)}
                        />
                      </div>

                      {coachChartData && (
                        <div className="table-responsive">
                          <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: 65, textAlign: 'center' }}>à¤¸à¥€à¤Ÿ à¤¨à¤‚</th>
                                <th style={{ width: 85 }}>à¤¬à¤°à¥à¤¥ à¤ªà¥à¤°à¤•à¤¾à¤°</th>
                                <th>à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤µà¤¿à¤µà¤°à¤£ (Passenger Details)</th>
                                <th style={{ width: 120 }}>PNR à¤•à¥à¤°à¤®à¤¾à¤‚à¤•</th>
                                <th style={{ width: 110 }}>à¤¬à¥‹à¤°à¥à¤¡à¤¿à¤‚à¤—</th>
                                <th style={{ width: 140 }}>à¤•à¤¿à¤°à¤¾à¤¯à¤¾ / à¤‘à¤¨-à¤¸à¥à¤ªà¥‰à¤Ÿ à¤µà¤¸à¥‚à¤²à¥€</th>
                                <th style={{ width: 210, textAlign: 'center' }}>à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸ à¤•à¤¾à¤°à¥à¤°à¤µà¤¾à¤ˆ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {coachChartData.rows
                                .filter(r => {
                                  if (!chartSearch) return true;
                                  const q = chartSearch.toLowerCase();
                                  return String(r.seatNumber).includes(q) ||
                                    (r.passengerName && r.passengerName.toLowerCase().includes(q)) ||
                                    (r.pnr && r.pnr.toLowerCase().includes(q));
                                })
                                .map((r) => (
                                  <tr key={r.seatNumber} style={{ background: !r.isBooked ? '#FFFDFB' : '#FFFFFF' }}>
                                    <td style={{ textAlign: 'center', fontWeight: 900, color: '#C2410C', fontSize: '1.1rem' }}>
                                      {r.seatNumber}
                                    </td>
                                    <td>
                                      <strong style={{ color: '#9A3412' }}>{r.berthType}</strong>
                                    </td>
                                    <td>
                                      {r.isBooked ? (
                                        <div>
                                          <div style={{ fontWeight: 800, color: '#431407' }}>{r.passengerName}</div>
                                          <div style={{ fontSize: '0.78rem', color: '#7C2D12' }}>
                                            {r.age || '-'} à¤µà¤°à¥à¤· â€¢ {r.gender === 'Female' ? 'à¤®à¤¹à¤¿à¤²à¤¾' : 'à¤ªà¥à¤°à¥à¤·'} â€¢ à¤†à¤§à¤¾à¤°: {r.aadhar || 'à¤ªà¥à¤°à¤®à¤¾à¤£à¥€à¤•à¥ƒà¤¤'}
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>--- à¤°à¤¿à¤•à¥à¤¤ (à¤–à¤¾à¤²à¥€ à¤¸à¥€à¤Ÿ) ---</span>
                                      )}
                                    </td>
                                    <td>
                                      {r.pnr ? <strong style={{ color: '#E65100' }}>{r.pnr}</strong> : '-'}
                                    </td>
                                    <td>
                                      {r.fromStation ? `${r.fromStation.split(' ')[0]} âž” SVDK` : '-'}
                                    </td>
                                    <td>
                                      {r.isBooked ? (
                                        <div>
                                          {r.remainingAmount > 0 ? (
                                            <div>
                                              <div style={{ color: '#DC2626', fontWeight: 800, fontSize: '0.85rem' }}>
                                                à¤¬à¤•à¤¾à¤¯à¤¾: â‚¹ {r.remainingAmount}
                                              </div>
                                              <button
                                                className="btn btn-sm btn-gold"
                                                style={{ marginTop: 4, padding: '3px 8px', fontSize: '0.74rem' }}
                                                onClick={() => handleTteCollectDue(r.bookingId, r.remainingAmount)}
                                              >
                                                <IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤°à¤¾à¤¶à¤¿ à¤µà¤¸à¥‚à¤²à¥‡à¤‚
                                              </button>
                                            </div>
                                          ) : (
                                            <span style={{ color: '#059669', fontWeight: 800 }}>âœ“ à¤ªà¥‚à¤°à¥à¤£ à¤ªà¥à¤°à¤¦à¤¤à¥à¤¤</span>
                                          )}
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {r.isBooked ? (
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                          <button
                                            className={`btn btn-sm ${r.checkInStatus === 'Present' ? 'btn-success' : 'btn-outline'}`}
                                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                            onClick={() => handleTteCheckIn(r.seatNumber, 'Present')}
                                          >
                                            âœ“ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤
                                          </button>
                                          <button
                                            className={`btn btn-sm ${r.checkInStatus === 'Absent' ? 'btn-danger' : 'btn-outline'}`}
                                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                            onClick={() => handleTteCheckIn(r.seatNumber, 'Absent')}
                                          >
                                            âœ• à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>à¤°à¤¿à¤•à¥à¤¤ à¤¸à¥€à¤Ÿ</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                )}

                {/* VIEW: FINANCIAL RECONCILIATION & DAILY COLLECTIONS */}
                {activeView === 'reconcile' && (
                  <div>
                    <div>
                    {reconcileData && (
                      <div>
                        <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <span className="badge badge-bhakti" style={{ marginBottom: 6 }}><ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 100% à¤à¤‚à¤Ÿà¥€-à¤«à¥à¤°à¥‰à¤¡ à¤°à¤¿à¤¯à¤²-à¤Ÿà¤¾à¤‡à¤® à¤®à¤¿à¤²à¤¾à¤¨</span>
                              <h3 style={{ fontSize: '1.4rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                                à¤ªà¤¾à¤ˆ-à¤ªà¤¾à¤ˆ à¤•à¤¾ à¤¸à¤®à¤¾à¤§à¤¾à¤¨ à¤à¤µà¤‚ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤¹à¤¿à¤¸à¤¾à¤¬-à¤•à¤¿à¤¤à¤¾à¤¬
                              </h3>
                              <div style={{ color: '#7C2D12', fontSize: '0.88rem', marginTop: 4 }}>
                                à¤•à¥à¤² à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸, à¤¨à¤•à¤¦ à¤µ à¤¯à¥‚à¤ªà¥€à¤†à¤ˆ à¤¸à¤‚à¤—à¥à¤°à¤¹, à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿, à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤¬à¤•à¤¾à¤¯à¤¾ à¤¦à¥‡à¤¯ à¤•à¤¾ à¤¸à¤®à¤—à¥à¤° à¤¬à¥à¤¯à¥Œà¤°à¤¾
                              </div>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={loadReconciliation}>
                              ðŸ”„ à¤¤à¤¾à¤œà¤¼à¤¾ à¤•à¤°à¥‡à¤‚ (Refresh Ledger)
                            </button>
                          </div>
                        </div>

                        {/* 8 Metric KPI Cards */}
                        <div className="grid-4" style={{ marginBottom: 24 }}>
                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #C2410C' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤•à¥à¤² à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸ / à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#C2410C', margin: '4px 0' }}>
                              {reconcileData.summary.totalBookings || 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>
                              {reconcileData.summary.totalYatris || reconcileData.summary.totalPassengers || 0} à¤ªà¤‚à¤œà¥€à¤•à¥ƒà¤¤ à¤¯à¤¾à¤¤à¥à¤°à¥€
                            </div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #047857' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤•à¥à¤² à¤¸à¤•à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾ (Gross)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#047857', margin: '4px 0' }}>
                              â‚¹ {(reconcileData?.summary?.totalGrossCollection || 0)?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤ªà¥‚à¤°à¥à¤£ à¤…à¤¨à¥à¤®à¤¾à¤¨à¤¿à¤¤ à¤†à¤¯</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #0284C7' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤…à¤—à¥à¤°à¤¿à¤® (Online Advance)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284C7', margin: '4px 0' }}>
                              â‚¹ {(reconcileData?.summary?.totalAdvanceCollected || 0)?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤¬à¥ˆà¤‚à¤•/à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤¸à¥€à¤§à¥‡ à¤œà¤®à¤¾</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤µà¤¸à¥‚à¤²à¤¾ à¤—à¤¯à¤¾ à¤¬à¤•à¤¾à¤¯à¤¾ (Due Recv)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10B981', margin: '4px 0' }}>
                              â‚¹ {(reconcileData?.summary?.totalDueCollectedOnTrain || Math.max(0, (reconcileData?.summary?.totalGrossCollection || 0) - (reconcileData?.summary?.totalAdvanceCollected || 0) - (reconcileData?.summary?.totalRemainingDues || 0)))?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¤¿à¤¯à¥‹à¤‚ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¸à¤‚à¤•à¤²à¤¿à¤¤</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #DC2626' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤¶à¥‡à¤· à¤¦à¥‡à¤¯ à¤¬à¤•à¤¾à¤¯à¤¾ (Remaining Due)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>
                              â‚¹ {(reconcileData?.summary?.totalRemainingDues || reconcileData?.summary?.totalRemainingDue || 0)?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤¸à¥‡ à¤µà¤¸à¥‚à¤²à¤¨à¤¾ à¤¶à¥‡à¤·</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #059669' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤•à¥à¤² à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¥€ (Present)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669', margin: '4px 0' }}>
                              {reconcileData.summary.totalPresentYatris || 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤¸à¥€à¤Ÿ à¤ªà¤° à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #EF4444' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤•à¥à¤² à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¥€ (Absent)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#EF4444', margin: '4px 0' }}>
                              {reconcileData.summary.totalAbsentYatris || 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤®à¥‡à¤‚ à¤¶à¤¾à¤®à¤¿à¤² à¤¨à¤¹à¥€à¤‚ à¤¹à¥à¤</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #F59E0B' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¶à¥‡à¤· (Pending Check-in)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B', margin: '4px 0' }}>
                              {reconcileData.summary.totalPendingCheckIn ?? reconcileData.summary.totalPendingYatris ?? 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>à¤œà¤¾à¤‚à¤š à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾à¤§à¥€à¤¨</div>
                          </div>
                        </div>

                        {/* Staff / Collector Wise Collection Breakdown */}
                        <div className="glass-card">
                          <h4 style={{ color: '#9A3412', marginBottom: 14, fontSize: '1.15rem', fontWeight: 800 }}>
                            <Briefcase size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€-à¤µà¤¾à¤° à¤à¤µà¤‚ à¤Ÿà¥€à¤Ÿà¥€-à¤µà¤¾à¤° à¤µà¤¸à¥‚à¤²à¥€ à¤‘à¤¡à¤¿à¤Ÿ (Staff Collection Breakdown)
                          </h4>
                          <div className="table-responsive">
                            <table className="custom-table">
                              <thead>
                                <tr>
                                  <th>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ ID</th>
                                  <th>à¤¨à¤¾à¤®</th>
                                  <th>à¤µà¤¿à¤­à¤¾à¤—</th>
                                  <th>à¤ªà¤¦ / à¤°à¥‹à¤²</th>
                                  <th>à¤²à¥‡à¤¨-à¤¦à¥‡à¤¨ à¤¸à¤‚à¤–à¥à¤¯à¤¾</th>
                                  <th>à¤¨à¤•à¤¦ à¤µà¤¸à¥‚à¤²à¥€ (Cash)</th>
                                  <th>UPI à¤µà¤¸à¥‚à¤²à¥€ (UPI)</th>
                                  <th>à¤•à¥à¤² à¤µà¤¸à¥‚à¤²à¥€ (Total)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!reconcileData.staffBreakdown || reconcileData.staffBreakdown.length === 0) ? (
                                  <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 20, color: '#784D35' }}>
                                      à¤•à¥‹à¤ˆ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤¡à¥‡à¤Ÿà¤¾ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤
                                    </td>
                                  </tr>
                                ) : (
                                  reconcileData.staffBreakdown.map((s) => (
                                    <tr key={s.staffId}>
                                      <td><strong style={{ color: '#C2410C' }}>{s.staffId}</strong></td>
                                      <td><strong>{s.name}</strong></td>
                                      <td><span className="badge badge-bhakti">{s.department}</span></td>
                                      <td><strong style={{ color: '#9A3412' }}>{s.role}</strong></td>
                                      <td>{s.transactionCount || 0}</td>
                                      <td style={{ color: '#047857', fontWeight: 700 }}>â‚¹ {(s.cashCollected || 0)?.toLocaleString()}</td>
                                      <td style={{ color: '#0284C7', fontWeight: 700 }}>â‚¹ {(s.upiCollected || 0)?.toLocaleString()}</td>
                                      <td style={{ fontWeight: 900, color: '#9A3412', fontSize: '1rem' }}>
                                        â‚¹ {(s.totalCollected || 0)?.toLocaleString()}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                    <div style={{ marginTop: 28 }}>
                      {renderDailyCollectionPanel(false)}
                    </div>
                  </div>
                )}

                {/* VIEW: PERSONAL DAILY COLLECTIONS REGISTER (FOR TTE & COUNTER CLERK) */}
                {(activeView === 'tte_collections' || activeView === 'counter_collections') && (
                  <div>
                    {renderDailyCollectionPanel(true)}
                  </div>
                )}

                {/* VIEW: STAFF & ROLE RBAC */}
                {activeView === 'staff_rbac' && (
                  <div>
                    <div>
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}><Users size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¤µà¤¿à¤­à¤¾à¤— à¤à¤µà¤‚ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤°à¥‹à¤² à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨</span>
                          <h3 style={{ fontSize: '1.4rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤¸à¥‚à¤šà¥€ à¤à¤µà¤‚ à¤…à¤§à¤¿à¤•à¤¾à¤° à¤¨à¤¿à¤°à¥à¤§à¤¾à¤°à¤£ (Staff RBAC)
                          </h3>
                          <div style={{ color: '#7C2D12', fontSize: '0.88rem', marginTop: 4 }}>
                            à¤à¤¡à¤®à¤¿à¤¨ à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤•à¥‹ à¤œà¥‹à¤¡à¤¼, à¤¨à¤¿à¤²à¤‚à¤¬à¤¿à¤¤ à¤¯à¤¾ à¤¹à¤Ÿà¤¾ à¤¸à¤•à¤¤à¤¾ à¤¹à¥ˆ à¤¤à¤¥à¤¾ à¤‰à¤¨à¤•à¥‡ à¤µà¤¿à¤­à¤¾à¤— à¤”à¤° à¤°à¥‹à¤² à¤¤à¤¯ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥ˆ
                          </div>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setNewStaffModal(true)}>
                          + à¤¨à¤¯à¤¾ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ (Add Staff)
                        </button>
                      </div>
                    </div>

                    <div className="glass-card">
                      <div className="table-responsive">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ ID</th>
                              <th>à¤¨à¤¾à¤® à¤µ à¤‰à¤ªà¤¯à¥‹à¤—à¤•à¤°à¥à¤¤à¤¾</th>
                              <th>à¤œà¥€à¤®à¥‡à¤² / Email ID</th>
                              <th>à¤µà¤¿à¤­à¤¾à¤— (Department)</th>
                              <th>à¤°à¥‹à¤² (Role)</th>
                              <th>à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤°</th>
                              <th>à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¥‹à¤š</th>
                              <th>à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                              <th style={{ textAlign: 'right' }}>à¤•à¤¾à¤°à¥à¤¯</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffList.map(st => (
                              <tr key={st.id}>
                                <td><strong style={{ color: '#C2410C' }}>{st.id}</strong></td>
                                <td>
                                  <strong>{st.name}</strong>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{st.username}</div>
                                </td>
                                <td>
                                  {st.email ? (
                                    <span style={{ color: '#0284C7', fontWeight: 600, fontSize: '0.85rem' }}>
                                      <Mail size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
                                      {st.email}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>-</span>
                                  )}
                                </td>
                                <td><span className="badge badge-bhakti">{st.department}</span></td>
                                <td>
                                  <strong style={{ color: '#9A3412' }}>{st.role}</strong>
                                </td>
                                <td>{st.mobile || '-'}</td>
                                <td>
                                  {st.role === 'TTE' ? (() => {
                                    const coaches = st.assignedCoaches || st.assignedCoach;
                                    if (Array.isArray(coaches) && coaches.length > 0) {
                                      return <span style={{ color: '#047857', fontWeight: 600 }}>{coaches.join(', ')}</span>;
                                    } else if (typeof coaches === 'string' && coaches.trim().length > 0) {
                                      return <span style={{ color: '#047857', fontWeight: 600 }}>{coaches}</span>;
                                    }
                                    return <span style={{ color: '#784D35' }}>à¤¸à¤­à¥€ à¤•à¥‹à¤š (All)</span>;
                                  })() : (
                                    <span style={{ color: '#9CA3AF' }}>-</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`badge ${st.status === 'Active' ? 'badge-paid' : 'badge-unpaid'}`}>
                                    {st.status === 'Active' ? 'à¤¸à¤•à¥à¤°à¤¿à¤¯ (Active)' : 'à¤¨à¤¿à¤²à¤‚à¤¬à¤¿à¤¤ (Suspended)'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <button
                                    className={`btn btn-sm ${st.status === 'Active' ? 'btn-outline' : 'btn-success'}`}
                                    style={{ marginRight: 6 }}
                                    onClick={() => handleToggleStaffStatus(st)}
                                    title={st.status === 'Active' ? 'à¤¨à¤¿à¤²à¤‚à¤¬à¤¿à¤¤ à¤•à¤°à¥‡à¤‚' : 'à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤•à¤°à¥‡à¤‚'}
                                  >
                                    {st.status === 'Active' ? 'à¤…à¤µà¤°à¥à¤¦à¥à¤§ à¤•à¤°à¥‡à¤‚' : 'à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤•à¤°à¥‡à¤‚'}
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteStaff(st.id, st.name)}
                                    title="à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤¹à¤Ÿà¤¾à¤à¤‚"
                                  >
                                    à¤¹à¤Ÿà¤¾à¤à¤‚
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {/* VIEW: ANTI-FRAUD AUDIT TRAIL */}
                {activeView === 'audit_logs' && (
                  <div>
                    <div>
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}><ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 100% à¤›à¥‡à¤¡à¤¼à¤›à¤¾à¤¡à¤¼-à¤®à¥à¤•à¥à¤¤ à¤‘à¤¡à¤¿à¤Ÿ à¤Ÿà¥à¤°à¥‡à¤²</span>
                          <h3 style={{ fontSize: '1.4rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            à¤à¤‚à¤Ÿà¥€-à¤«à¥à¤°à¥‰à¤¡ à¤‘à¤¡à¤¿à¤Ÿ à¤²à¥‰à¤— (Audit Trail Ledger)
                          </h3>
                          <div style={{ color: '#7C2D12', fontSize: '0.88rem', marginTop: 4 }}>
                            à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤•à¤¾ à¤²à¥‰à¤—à¤¿à¤¨, à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤…à¤‚à¤•à¤¨, à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿ à¤µà¤¸à¥‚à¤²à¥€ à¤”à¤° à¤¬à¥à¤•à¤¿à¤‚à¤— à¤—à¤¤à¤¿à¤µà¤¿à¤§à¤¿ à¤•à¤¾ à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡
                          </div>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={loadAuditLogs}>
                          ðŸ”„ à¤¤à¤¾à¤œà¤¼à¤¾ à¤•à¤°à¥‡à¤‚ (Refresh Logs)
                        </button>
                      </div>
                    </div>

                    <div className="glass-card">
                      <div className="table-responsive">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>à¤¸à¤®à¤¯ (Timestamp)</th>
                              <th>à¤•à¤¾à¤°à¥à¤¯à¤µà¤¾à¤¹à¥€ (Action)</th>
                              <th>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ (Performed By)</th>
                              <th>à¤°à¥‹à¤² / à¤µà¤¿à¤­à¤¾à¤—</th>
                              <th>PNR / à¤•à¥‹à¤š</th>
                              <th>à¤°à¤¾à¤¶à¤¿ (à¤µà¤¸à¥‚à¤²à¥€/à¤­à¥à¤—à¤¤à¤¾à¤¨)</th>
                              <th>à¤®à¤¾à¤§à¥à¤¯à¤®</th>
                              <th>à¤µà¤¿à¤µà¤°à¤£ (Details)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogsList.length === 0 ? (
                              <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#784D35' }}>
                                  à¤•à¥‹à¤ˆ à¤‘à¤¡à¤¿à¤Ÿ à¤²à¥‰à¤— à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆà¥¤
                                </td>
                              </tr>
                            ) : (
                              auditLogsList.map(lg => (
                                <tr key={lg.id}>
                                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                    {new Date(lg.timestamp).toLocaleString('hi-IN')}
                                  </td>
                                  <td>
                                    <span className="badge badge-bhakti" style={{ fontSize: '0.75rem' }}>
                                      {lg.action}
                                    </span>
                                  </td>
                                  <td>
                                    <strong>{lg.performedByName || lg.performedBy}</strong>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {lg.performedBy}</div>
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    <div>{lg.role || '-'}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#784D35' }}>{lg.department || '-'}</div>
                                  </td>
                                  <td>
                                    {lg.bookingId ? <strong style={{ color: '#C2410C' }}>{lg.bookingId}</strong> : '-'}
                                    {lg.coach ? <div style={{ fontSize: '0.75rem' }}>à¤•à¥‹à¤š: {lg.coach}</div> : null}
                                  </td>
                                  <td style={{ fontWeight: 'bold', color: lg.amount > 0 ? '#047857' : '#784D35' }}>
                                    {lg.amount > 0 ? `â‚¹ ${lg.amount}` : '-'}
                                  </td>
                                  <td>
                                    {lg.paymentMode ? (
                                      <span className={`badge ${lg.paymentMode === 'Cash' ? 'badge-partial' : 'badge-paid'}`}>
                                        {lg.paymentMode}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td style={{ fontSize: '0.85rem' }}>{lg.details || '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {/* VIEW: ANTI-FRAUD SLIP VERIFIER & ONLINE UTR MATCHING DESK */}
                {activeView === 'verifier' && (
                  <div>
                    {/* Header & Tabs */}
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div>
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}>
                            <ShieldCheck size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> 100% à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤µ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¨à¤¿à¤¯à¤‚à¤¤à¥à¤°à¤£ à¤•à¥‡à¤‚à¤¦à¥à¤°
                          </span>
                          <h3 style={{ fontSize: '1.45rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ UPI à¤µ UTR à¤®à¤¿à¤²à¤¾à¤¨ à¤²à¥‡à¤œà¤° à¤à¤µà¤‚ à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨
                          </h3>
                          <div style={{ color: '#7C2D12', fontSize: '0.86rem', marginTop: 4 }}>
                            à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¤¿à¤¯à¥‹à¤‚ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¦à¤°à¥à¤œ à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤­à¥à¤—à¤¤à¤¾à¤¨à¥‹à¤‚ à¤•à¤¾ UTR à¤®à¤¿à¤²à¤¾à¤¨ (Approve/Reject) à¤à¤µà¤‚ à¤œà¤¾à¤²à¥€ à¤Ÿà¤¿à¤•à¤Ÿà¥‹à¤‚ à¤•à¥€ à¤ªà¤¹à¤šà¤¾à¤¨
                          </div>
                        </div>

                        {/* Quick Action / Refresh */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          {verifierTab === 'utr_desk' && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => loadOnlineTransactions(onlineTxnsStatusFilter, onlineTxnsSearch)}
                              disabled={onlineTxnsLoading}
                            >
                              <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
                              {onlineTxnsLoading ? 'à¤²à¥‹à¤¡à¤¿à¤‚à¤—...' : 'à¤¤à¤¾à¤œà¤¼à¤¾ à¤•à¤°à¥‡à¤‚ (Refresh)'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Navigation Tabs */}
                      <div style={{ display: 'flex', gap: 10, borderTop: '1.5px solid #FFEDD5', paddingTop: 14 }}>
                        {staffUser?.role !== 'TTE' && (
                          <button
                            type="button"
                            className={`btn btn-sm ${verifierTab === 'utr_desk' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700 }}
                            onClick={() => {
                              setVerifierTab('utr_desk');
                              loadOnlineTransactions();
                            }}
                          >
                            <Smartphone size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                            1. à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ UPI à¤µ UTR à¤®à¤¿à¤²à¤¾à¤¨ à¤²à¥‡à¤œà¤° ({onlineTxnsList.length || 'Desk'})
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-sm ${(verifierTab === 'ticket_scanner' || staffUser?.role === 'TTE') ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700 }}
                          onClick={() => setVerifierTab('ticket_scanner')}
                        >
                          <Scan size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                          2. à¤²à¤¾à¤‡à¤µ à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥à¤•à¥ˆà¤¨à¤° (HMAC QR Check)
                        </button>
                      </div>
                    </div>

                    {/* TAB 1: ONLINE TRANSACTIONS & UTR MATCHING DESK */}
                    {(verifierTab === 'utr_desk' && staffUser?.role !== 'TTE') && (
                      <div>
                        {/* 4 Summary KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }} className="grid-kpi-mobile">
                          <div className="glass-card" style={{ background: '#FFF8F2', border: '1.5px solid #FED7AA', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#7C2D12', fontWeight: 700 }}>à¤•à¥à¤² à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#9A3412', margin: '4px 0' }}>{onlineTxnsSummary.total}</div>
                            <div style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>à¤•à¥à¤² à¤°à¤¾à¤¶à¤¿: â‚¹ {onlineTxnsSummary.totalAmount.toLocaleString()}</div>
                          </div>

                          <div className="glass-card" style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#92400E', fontWeight: 700 }}>à¤²à¤‚à¤¬à¤¿à¤¤ UTR à¤®à¤¿à¤²à¤¾à¤¨ (Pending)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#B45309', margin: '4px 0' }}>{onlineTxnsSummary.pending}</div>
                            <div style={{ fontSize: '0.78rem', color: '#78350F' }}>à¤¬à¥ˆà¤‚à¤• à¤¸à¥‡ à¤®à¥ˆà¤š à¤•à¤°à¤¨à¤¾ à¤¬à¤¾à¤•à¥€</div>
                          </div>

                          <div className="glass-card" style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#065F46', fontWeight: 700 }}>âœ“ à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ / à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ (Verified)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#047857', margin: '4px 0' }}>{onlineTxnsSummary.verified}</div>
                            <div style={{ fontSize: '0.78rem', color: '#065F46' }}>à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤µ à¤ªà¥à¤·à¥à¤Ÿ</div>
                          </div>

                          <div className="glass-card" style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#991B1B', fontWeight: 700 }}>âœ• à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ (Rejected)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>{onlineTxnsSummary.rejected}</div>
                            <div style={{ fontSize: '0.78rem', color: '#7F1D1D' }}>à¤…à¤®à¤¾à¤¨à¥à¤¯ / à¤«à¤°à¥à¤œà¥€ UTR</div>
                          </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="glass-card" style={{ marginBottom: 18, padding: 14, border: '1.5px solid #FED7AA', background: '#FFFFFF' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            {/* Filter Chips */}
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9A3412' }}>à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤«à¤¼à¤¿à¤²à¥à¤Ÿà¤°:</span>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('All');
                                  loadOnlineTransactions('All', onlineTxnsSearch);
                                }}
                              >
                                à¤¸à¤­à¥€ ({onlineTxnsSummary.total})
                              </button>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'Pending' ? 'btn-primary' : 'btn-outline'}`}
                                style={onlineTxnsStatusFilter !== 'Pending' ? { borderColor: '#F59E0B', color: '#B45309' } : {}}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('Pending');
                                  loadOnlineTransactions('Pending', onlineTxnsSearch);
                                }}
                              >
                                à¤²à¤‚à¤¬à¤¿à¤¤ ({onlineTxnsSummary.pending})
                              </button>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'Verified' ? 'btn-primary' : 'btn-outline'}`}
                                style={onlineTxnsStatusFilter !== 'Verified' ? { borderColor: '#10B981', color: '#047857' } : {}}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('Verified');
                                  loadOnlineTransactions('Verified', onlineTxnsSearch);
                                }}
                              >
                                âœ“ à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ ({onlineTxnsSummary.verified})
                              </button>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'Rejected' ? 'btn-primary' : 'btn-outline'}`}
                                style={onlineTxnsStatusFilter !== 'Rejected' ? { borderColor: '#EF4444', color: '#DC2626' } : {}}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('Rejected');
                                  loadOnlineTransactions('Rejected', onlineTxnsSearch);
                                }}
                              >
                                âœ• à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ ({onlineTxnsSummary.rejected})
                              </button>
                            </div>

                            {/* Live Search Box */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 280, flex: '1 0 280px' }}>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="PNR, à¤¨à¤¾à¤®, 12-à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¤¾ UTR à¤¯à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤°..."
                                value={onlineTxnsSearch}
                                onChange={(e) => {
                                  setOnlineTxnsSearch(e.target.value);
                                  loadOnlineTransactions(onlineTxnsStatusFilter, e.target.value);
                                }}
                                style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                              />
                              {onlineTxnsSearch && (
                                <button className="btn btn-outline btn-sm" onClick={() => { setOnlineTxnsSearch(''); loadOnlineTransactions(onlineTxnsStatusFilter, ''); }}>
                                  âœ•
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Online Transactions Matching Table */}
                        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #FED7AA' }}>
                          <div className="table-responsive">
                            <table className="custom-table" style={{ fontSize: '0.88rem', margin: 0 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: 45 }}>à¤•à¥à¤°.</th>
                                  <th>PNR à¤à¤µà¤‚ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤µà¤¿à¤µà¤°à¤£</th>
                                  <th>à¤œà¤®à¤¾ à¤°à¤¾à¤¶à¤¿ (â‚¹)</th>
                                  <th>à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤®à¤¾à¤§à¥à¤¯à¤®</th>
                                  <th>UTR / à¤¬à¥ˆà¤‚à¤• à¤¸à¤‚à¤¦à¤°à¥à¤­ à¤•à¥à¤°à¤®à¤¾à¤‚à¤•</th>
                                  <th>à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤à¤•à¤°à¥à¤¤à¤¾ à¤¸à¥à¤Ÿà¤¾à¤«</th>
                                  <th>à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                                  <th style={{ textAlign: 'center', width: 220 }}>
                                    {isSuperAdmin ? 'à¤à¤¡à¤®à¤¿à¤¨ à¤®à¤¿à¤²à¤¾à¤¨ à¤•à¤¾à¤°à¥à¤¯à¤µà¤¾à¤¹à¥€' : 'à¤¸à¥à¤¥à¤¿à¤¤à¤¿'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {onlineTxnsLoading ? (
                                  <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 30, color: '#7C2D12' }}>
                                      à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤¡à¥‡à¤Ÿà¤¾ à¤²à¥‹à¤¡ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...
                                    </td>
                                  </tr>
                                ) : onlineTxnsList.length === 0 ? (
                                  <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 36, color: '#784D35' }}>
                                      <div style={{ fontSize: 32, marginBottom: 6 }}>ðŸ”</div>
                                      <strong>à¤•à¥‹à¤ˆ à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾à¥¤</strong>
                                      <div style={{ fontSize: '0.82rem', marginTop: 4 }}>à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤…à¤¥à¤µà¤¾ à¤­à¤•à¥à¤¤ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤‘à¤¨à¤²à¤¾à¤‡à¤¨/UPI à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ à¤•à¤°à¤¨à¥‡ à¤ªà¤° à¤µà¤¹ à¤¤à¥à¤°à¤‚à¤¤ à¤‡à¤¸ à¤²à¥‡à¤œà¤° à¤®à¥‡à¤‚ à¤¦à¤¿à¤–à¤¾à¤ˆ à¤¦à¥‡à¤—à¤¾à¥¤</div>
                                    </td>
                                  </tr>
                                ) : (
                                  onlineTxnsList.map((tx, idx) => (
                                    <tr key={tx.id || idx} style={{ background: tx.status === 'Verified' ? '#F0FDF4' : (tx.status === 'Rejected' ? '#FEF2F2' : '#FFFFFF') }}>
                                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                                      <td>
                                        <div style={{ fontWeight: 800, color: '#C2410C' }}>{tx.pnr}</div>
                                        <div style={{ fontWeight: 700, color: '#1F2937' }}>{tx.devoteeName}</div>
                                        <div style={{ fontSize: '0.76rem', color: '#6B7280' }}>
                                          {tx.mobile} | à¤•à¥‹à¤š {tx.coachName} (à¤¸à¥€à¤Ÿ: {tx.seatNumber})
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#047857' }}>
                                          â‚¹ {Number(tx.amount || 0).toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                                          {new Date(tx.date).toLocaleDateString('hi-IN')} {new Date(tx.date).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      </td>
                                      <td>
                                        <span className="badge badge-bhakti" style={{ fontSize: '0.78rem' }}>
                                          <Smartphone size={13} style={{ display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} /> {tx.method || 'UPI'}
                                        </span>
                                      </td>
                                      <td>
                                        {tx.utrNumber ? (
                                          <div>
                                            <code style={{ fontSize: '0.88rem', fontWeight: 800, color: '#9A3412', background: '#FFF8F2', padding: '3px 6px', borderRadius: 4, border: '1px solid #FED7AA' }}>
                                              {tx.utrNumber}
                                            </code>
                                            {tx.remarks && (
                                              <div style={{ fontSize: '0.74rem', color: '#7C2D12', marginTop: 3 }}>
                                                à¤¨à¥‹à¤Ÿ: {tx.remarks}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.8rem' }}>--- UTR à¤¦à¤°à¥à¤œ à¤¨à¤¹à¥€à¤‚ ---</span>
                                        )}
                                      </td>
                                      <td>
                                        <div style={{ fontWeight: 700, color: '#374151' }}>{tx.cashierName || 'Staff'}</div>
                                        {tx.verifiedBy && (
                                          <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                                            à¤œà¤¾à¤‚à¤šà¤•à¤°à¥à¤¤à¤¾: {tx.verifiedBy}
                                          </div>
                                        )}
                                      </td>
                                      <td>
                                        {tx.status === 'Verified' ? (
                                          <span className="badge badge-paid" style={{ fontSize: '0.78rem' }}>
                                            âœ“ à¤¬à¥ˆà¤‚à¤• à¤¸à¥‡ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤
                                          </span>
                                        ) : tx.status === 'Rejected' ? (
                                          <span className="badge badge-unpaid" style={{ fontSize: '0.78rem' }}>
                                            âœ• à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ UTR
                                          </span>
                                        ) : (
                                          <span className="badge badge-partial" style={{ fontSize: '0.78rem' }}>
                                            à¤®à¤¿à¤²à¤¾à¤¨ à¤²à¤‚à¤¬à¤¿à¤¤
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {isSuperAdmin ? (
                                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            {tx.status !== 'Verified' && (
                                              <button
                                                className="btn btn-sm btn-success"
                                                style={{ padding: '4px 8px', fontSize: '0.76rem', fontWeight: 700 }}
                                                onClick={() => handleVerifyUtrAction(tx.bookingId, tx.id, 'Verified', tx.utrNumber, 'Matched with Trust Bank Account')}
                                                title="à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¥‡ à¤¸à¥‡ UTR à¤•à¤¾ à¤®à¤¿à¤²à¤¾à¤¨ à¤•à¤° à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ à¤•à¤°à¥‡à¤‚"
                                              >
                                                âœ“ à¤®à¥ˆà¤š (Approve)
                                              </button>
                                            )}
                                            {tx.status !== 'Rejected' && (
                                              <button
                                                className="btn btn-sm btn-danger"
                                                style={{ padding: '4px 8px', fontSize: '0.76rem', fontWeight: 700 }}
                                                onClick={() => {
                                                  const r = window.prompt('à¤…à¤¸à¥à¤µà¥€à¤•à¤¾à¤° à¤•à¤°à¤¨à¥‡ à¤•à¤¾ à¤•à¤¾à¤°à¤£ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚ (à¤‰à¤¦à¤¾. à¤¬à¥ˆà¤‚à¤• à¤®à¥‡à¤‚ à¤¨à¤¹à¥€à¤‚ à¤†à¤¯à¤¾ / à¤…à¤®à¤¾à¤¨à¥à¤¯):', 'à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ à¤°à¤¾à¤¶à¤¿ à¤¨à¤¹à¥€à¤‚ à¤¦à¤¿à¤–à¥€');
                                                  if (r !== null) {
                                                    handleVerifyUtrAction(tx.bookingId, tx.id, 'Rejected', tx.utrNumber, r);
                                                  }
                                                }}
                                                title="UTR à¤…à¤¸à¥à¤µà¥€à¤•à¤¾à¤° à¤•à¤°à¥‡à¤‚"
                                              >
                                                âœ• à¤°à¤¿à¤œà¥‡à¤•à¥à¤Ÿ
                                              </button>
                                            )}
                                            <button
                                              className="btn btn-sm btn-outline"
                                              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                                              onClick={() => setEditUtrModal({
                                                show: true,
                                                txn: tx,
                                                newUtr: tx.utrNumber || '',
                                                status: tx.status || 'Pending',
                                                remarks: tx.remarks || ''
                                              })}
                                              title="UTR à¤¨à¤‚à¤¬à¤° à¤¯à¤¾ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤¸à¤‚à¤¶à¥‹à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚"
                                            >
                                              à¤¬à¤¦à¤²à¥‡à¤‚
                                            </button>
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: '0.8rem', color: '#6B7280', fontStyle: 'italic', padding: '8px' }}>
                                            à¤•à¥‡à¤µà¤² à¤¦à¥‡à¤–à¤¨à¥‡ à¤¹à¥‡à¤¤à¥ (View Only)
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: LIVE HMAC TICKET SECURITY SCANNER */}
                    {(verifierTab === 'ticket_scanner' || staffUser?.role === 'TTE') && (
                      <div>
                        <div className="glass-card" style={{ maxWidth: 640, margin: '0 auto 24px', border: '2px solid #FED7AA', padding: 24, textAlign: 'center' }}>
                          <div className="qr-scanner-frame">
                            <div className="qr-scanner-corners">
                              <div className="qr-scanner-corners-inner"></div>
                            </div>
                            <div className="laser-line"></div>
                            <div className="scanner-text">
                              <Scan size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                              QR CODE SCANNING...
                            </div>
                          </div>

                          <h3 style={{ fontSize: '1.2rem', color: '#9A3412', marginBottom: '16px', fontWeight: 700 }}>
                            à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¥‡ à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾ QR à¤•à¥‹à¤¡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚
                          </h3>

                          <form onSubmit={(e) => { e.preventDefault(); handleVerifyTicketSubmit(); }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                                à¤¯à¤¾ à¤®à¥ˆà¤¨à¥à¤¯à¥à¤…à¤² à¤°à¥‚à¤ª à¤¸à¥‡ PNR à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚
                              </p>
                              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 400 }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="PNR Number (à¤‰à¤¦à¤¾. MVD-2026-...)"
                                  value={verifierPnr}
                                  onChange={(e) => setVerifierPnr(e.target.value)}
                                  style={{ width: '100%', textAlign: 'center', letterSpacing: '1px', fontWeight: 600, padding: '10px' }}
                                  required
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={verifierLoading}
                                className="btn btn-primary"
                                style={{ width: '100%', maxWidth: 400, padding: '12px', fontSize: '1.05rem', marginTop: 10, boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)' }}
                              >
                                {verifierLoading ? 'à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...' : <><ShieldCheck size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> à¤®à¥ˆà¤¨à¥à¤¯à¥à¤…à¤² à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ à¤•à¤°à¥‡à¤‚</>}
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* Verification Result Display */}
                        {verifierResult && (
                          <div className="glass-card" style={{ maxWidth: 740, margin: '0 auto', border: verifierResult.status === 'GENUINE' ? '2.5px solid #10B981' : '2.5px solid #EF4444', padding: 24 }}>
                            {verifierResult.status === 'GENUINE' ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#D1FAE5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>âœ…</div>
                                  <div>
                                    <h3 style={{ margin: 0, color: '#065F46', fontSize: '1.3rem', fontWeight: 800 }}>{verifierResult.title}</h3>
                                    <p style={{ margin: '2px 0 0', color: '#047857', fontSize: '0.88rem' }}>{verifierResult.message}</p>
                                  </div>
                                </div>

                                <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNR / à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¸à¤‚à¤–à¥à¤¯à¤¾</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookingId}</div>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à¤®à¥à¤–à¥à¤¯ à¤­à¤•à¥à¤¤ / à¤†à¤µà¥‡à¤¦à¤•</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookedBy} ({verifierResult.booking.mobile})</div>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¥‹à¤š à¤µ à¤¸à¥€à¤Ÿ</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>
                                      à¤•à¥‹à¤š {verifierResult.booking.coachName} â€¢ à¤¸à¥€à¤Ÿ: {Array.isArray(verifierResult.booking.seatNumber) ? verifierResult.booking.seatNumber.join(', ') : verifierResult.booking.seatNumber}
                                    </div>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤µ à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: verifierResult.booking.remainingAmount > 0 ? '#DC2626' : '#047857' }}>
                                      {verifierResult.booking.paymentStatus} (à¤•à¤Ÿà¤¡à¤¼à¤¾ à¤®à¥‡à¤‚ à¤¶à¥‡à¤· à¤¦à¥‡à¤¯: â‚¹ {verifierResult.booking.remainingAmount})
                                    </div>
                                  </div>
                                </div>

                                <div style={{ background: '#FFF8F2', borderRadius: 8, padding: 12, border: '1px solid #FED7AA' }}>
                                  <strong style={{ color: '#9A3412', fontSize: '0.88rem' }}>à¤¡à¥‡à¤Ÿà¤¾à¤¬à¥‡à¤¸ à¤®à¥‡à¤‚ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¸à¤¹à¤¯à¤¾à¤¤à¥à¤°à¥€:</strong>
                                  {(verifierResult.booking.passengers || []).map((p, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #FFEDD5', fontSize: '0.85rem' }}>
                                      <span>{idx + 1}. <strong>{p.name}</strong> ({p.age || '-'} à¤µà¤°à¥à¤·, {p.gender || '-'})</span>
                                      <span style={{ color: '#C2410C', fontWeight: 700 }}>à¤¸à¥€à¤Ÿ: {p.seatAssigned || p.seatNumber || '-'}</span>
                                    </div>
                                  ))}
                                </div>

                                <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥€à¤² à¤¹à¥ˆà¤¶: <code>{verifierResult.securityHash}</code>
                                </div>
                              </div>
                            ) : verifierResult.status === 'TAMPERED' ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEE2E2', color: '#991B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}></div>
                                  <div>
                                    <h3 style={{ margin: 0, color: '#991B1B', fontSize: '1.3rem', fontWeight: 800 }}>{verifierResult.title}</h3>
                                    <p style={{ margin: '2px 0 0', color: '#B91C1C', fontSize: '0.88rem', fontWeight: 600 }}>{verifierResult.message}</p>
                                  </div>
                                </div>

                                <div style={{ background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 8, padding: 12, color: '#991B1B', fontSize: '0.85rem', marginBottom: 16 }}>
                                  <div><strong>à¤…à¤µà¥ˆà¤§ / à¤œà¤¾à¤²à¥€ à¤¹à¥ˆà¤¶:</strong> <code>{verifierResult.providedSecurityHash}</code></div>
                                  <div><strong>à¤¸à¤°à¥à¤µà¤° à¤•à¤¾ à¤…à¤ªà¥‡à¤•à¥à¤·à¤¿à¤¤ à¤µà¥ˆà¤§ à¤¹à¥ˆà¤¶:</strong> <code>{verifierResult.expectedSecurityHash}</code></div>
                                  <div style={{ marginTop: 4 }}><strong>à¤›à¥‡à¤¡à¤¼à¤›à¤¾à¤¡à¤¼ à¤µà¤¾à¤²à¥‡ à¤•à¥à¤·à¥‡à¤¤à¥à¤°:</strong> {verifierResult.tamperedFields}</div>
                                </div>

                                <h4 style={{ color: '#9A3412', marginBottom: 8, fontSize: '0.95rem' }}><ClipboardList size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤¸à¤°à¥à¤µà¤° à¤•à¤¾ à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤ªà¥à¤°à¤¾à¤®à¤¾à¤£à¤¿à¤• à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡:</h4>
                                <div className="grid-2" style={{ gap: 10, fontSize: '0.88rem' }}>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤­à¤•à¥à¤¤: <strong>{verifierResult.authenticData.bookedBy}</strong> ({verifierResult.authenticData.mobile})
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¸à¥€à¤Ÿ: <strong style={{ color: '#DC2626' }}>à¤•à¥‹à¤š {verifierResult.authenticData.coachName}, à¤¸à¥€à¤Ÿ {Array.isArray(verifierResult.authenticData.seatNumber) ? verifierResult.authenticData.seatNumber.join(', ') : verifierResult.authenticData.seatNumber}</strong>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    à¤µà¤¾à¤¸à¥à¤¤à¤µà¤¿à¤• à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿: <strong style={{ color: '#DC2626' }}>â‚¹ {verifierResult.authenticData.remainingAmount} ({verifierResult.authenticData.paymentStatus})</strong>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤¸à¤‚à¤–à¥à¤¯à¤¾: <strong>{(verifierResult.authenticData.passengers || []).length} à¤¯à¤¾à¤¤à¥à¤°à¥€</strong>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{ fontSize: 36, marginBottom: 8 }}>âŒ</div>
                                <h3 style={{ color: '#991B1B', fontWeight: 800 }}>{verifierResult.title || 'à¤…à¤®à¤¾à¤¨à¥à¤¯ / à¤«à¤°à¥à¤œà¥€ PNR'}</h3>
                                <p style={{ color: '#B91C1C', fontSize: '0.9rem', marginTop: 4 }}>{verifierResult.message}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW: SETTINGS & STAFF PROFILE */}
                {activeView === 'settings' && (
                  <div style={{ maxWidth: 840, margin: '20px auto' }}>
                    {/* Master Project & UPI Financial Settings (SuperAdmin Only) */}
                    {isSuperAdmin && (
                      <div className="glass-card" style={{ marginBottom: 24, border: '2px solid #F97316', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(249,115,22,0.12)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1.5px solid #FED7AA', paddingBottom: 14, marginBottom: 18 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, #F97316, #C2410C)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <QrCode size={24} />
                            </div>
                            <div>
                              <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.3rem', fontWeight: 800 }}>
                                à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤à¤µà¤‚ UPI à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ (Project & UPI Configuration)
                              </h3>
                              <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.86rem' }}>
                                à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ UPI ID, à¤•à¥à¤¯à¥‚à¤†à¤° à¤•à¥‹à¤¡, à¤ªà¥à¤°à¤¤à¤¿ à¤¸à¥€à¤Ÿ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¦à¤°à¥‡à¤‚ à¤à¤µà¤‚ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤µà¤¿à¤µà¤°à¤£ à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚
                              </p>
                            </div>
                          </div>
                          <span className="badge badge-bhakti" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                            <Crown size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤šà¥€à¤« à¤à¤¡à¤®à¤¿à¤¨ à¤•à¤‚à¤Ÿà¥à¤°à¥‹à¤²
                          </span>
                        </div>

                        {projectSettingsSuccess && (
                          <div style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0', color: '#065F46', padding: '12px 16px', borderRadius: 8, marginBottom: 18, fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CheckCircle2 size={18} color="#059669" /> {projectSettingsSuccess}
                          </div>
                        )}
                        {projectSettingsError && (
                          <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B', padding: '12px 16px', borderRadius: 8, marginBottom: 18, fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={18} color="#DC2626" /> {projectSettingsError}
                          </div>
                        )}

                        <form onSubmit={handleUpdateProjectSettings}>
                          {/* Live Dynamic UPI QR Preview Section */}
                          <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', border: '1.5px solid #FDBA74', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ maxWidth: 440 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <Smartphone size={18} color="#C2410C" />
                                <strong style={{ color: '#9A3412', fontSize: '1.05rem' }}>à¤²à¤¾à¤‡à¤µ UPI QR à¤•à¥‹à¤¡ à¤ªà¥à¤°à¤¿à¤µà¥à¤¯à¥‚</strong>
                              </div>
                              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#7C2D12' }}>
                                à¤¸à¤­à¥€ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤à¤µà¤‚ à¤°à¤¸à¥€à¤¦à¥‹à¤‚ à¤®à¥‡à¤‚ à¤¯à¤¹à¥€ à¤•à¥à¤¯à¥‚à¤†à¤° à¤•à¥‹à¤¡ à¤”à¤° à¤®à¤°à¥à¤šà¥‡à¤‚à¤Ÿ à¤¨à¤¾à¤® à¤¸à¥à¤µà¤¤à¤ƒ à¤²à¤¾à¤—à¥‚ à¤¹à¥‹à¤—à¤¾à¥¤
                              </p>
                              <div style={{ fontSize: '0.85rem', background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #FED7AA' }}>
                                <div><strong>UPI ID:</strong> <code style={{ color: '#C2410C' }}>{projectSettings.upiId || '7398959993@okbizaxis'}</code></div>
                                <div style={{ marginTop: 3 }}><strong>à¤ªà¥‡à¤ˆ à¤¨à¤¾à¤®:</strong> <span style={{ color: '#1F2937' }}>{projectSettings.upiPayeeName || 'à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ'}</span></div>
                              </div>
                            </div>

                            <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 10, border: '2px solid #FB923C', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=${projectSettings.upiId || '7398959993@okbizaxis'}&pn=${encodeURIComponent(projectSettings.upiPayeeName || 'Shri Mata Vaishno Devi Trust')}&cu=INR`)}`}
                                alt="UPI Live QR Preview"
                                style={{ width: 130, height: 130, display: 'block', margin: '0 auto' }}
                              />
                              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', marginTop: 6 }}>
                                âœ“ à¤¸à¥à¤•à¥ˆà¤¨ à¤µ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¹à¥‡à¤¤à¥ à¤¤à¥ˆà¤¯à¤¾à¤°
                              </div>
                            </div>
                          </div>

                          {/* UPI & Merchant Details */}
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ color: '#9A3412', fontSize: '1rem', fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Smartphone size={16} color="#C2410C" /> 1. à¤¡à¤¿à¤œà¤¿à¤Ÿà¤² à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤à¤µà¤‚ UPI VPA à¤µà¤¿à¤µà¤°à¤£
                            </h4>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ UPI ID (VPA) <span style={{ color: 'red' }}>*</span></label>
                                <input
                                  type="text"
                                  required
                                  className="form-control"
                                  placeholder="à¤‰à¤¦à¤¾. 7398959993@okbizaxis, trust@sbi"
                                  value={projectSettings.upiId || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, upiId: e.target.value.trim() })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">UPI à¤ªà¥‡à¤ˆ / à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤•à¤¾ à¤¨à¤¾à¤® (Payee Name) <span style={{ color: 'red' }}>*</span></label>
                                <input
                                  type="text"
                                  required
                                  className="form-control"
                                  placeholder="à¤‰à¤¦à¤¾. Shri Mata Vaishno Devi Public Charitable Trust"
                                  value={projectSettings.upiPayeeName || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, upiPayeeName: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤· (Yatra Year)</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  placeholder="2026"
                                  value={projectSettings.activeYatraYear || 2026}
                                  onChange={e => setProjectSettings({ ...projectSettings, activeYatraYear: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label" style={{ color: '#C2410C', fontWeight: 800 }}>
                                  à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥à¤°à¤¸à¥à¤¥à¤¾à¤¨ à¤¤à¤¿à¤¥à¤¿ (Journey Date) <span style={{ color: 'red' }}>*</span>
                                </label>
                                <input
                                  type="date"
                                  className="form-control"
                                  style={{ borderColor: '#F97316', background: '#FFF8F2', fontWeight: 700 }}
                                  value={projectSettings.defaultTravelDate || projectSettings.journeyDate || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, defaultTravelDate: e.target.value, journeyDate: e.target.value })}
                                />
                                <div style={{ fontSize: '0.72rem', color: '#9A3412', marginTop: 3 }}>
                                  * à¤¹à¥‹à¤® à¤ªà¥‡à¤œ à¤à¤µà¤‚ à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤ªà¤° à¤¯à¤¹à¥€ à¤¤à¤¿à¤¥à¤¿ à¤¸à¥à¤µà¤¤à¤ƒ à¤²à¤¾à¤—à¥‚ à¤¹à¥‹à¤—à¥€à¥¤
                                </div>
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤¾à¤ªà¤¸à¥€ à¤¤à¤¿à¤¥à¤¿ (Return Date)</label>
                                <input
                                  type="date"
                                  className="form-control"
                                  value={projectSettings.returnTravelDate || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, returnTravelDate: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Fares Configuration */}
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ color: '#9A3412', fontSize: '1rem', fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <IndianRupee size={16} color="#C2410C" /> 2. à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¦à¤°à¥‡à¤‚ (Fares)
                            </h4>
                            <div className="grid-3" style={{ gap: 10 }}>
                              <div className="form-group">
                                <label className="form-label">à¤¸à¥à¤²à¥€à¤ªà¤° à¤•à¥à¤²à¤¾à¤¸ (Sleeper â‚¹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={projectSettings.fareSleeper || 3000}
                                  onChange={e => setProjectSettings({ ...projectSettings, fareSleeper: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤à¤¸à¥€ à¤•à¥à¤²à¤¾à¤¸ (AC 3A/2A â‚¹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={projectSettings.fareAC || 4000}
                                  onChange={e => setProjectSettings({ ...projectSettings, fareAC: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤œà¤¨à¤°à¤² à¤•à¥à¤²à¤¾à¤¸ (General â‚¹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={projectSettings.fareGeneral || 2000}
                                  onChange={e => setProjectSettings({ ...projectSettings, fareGeneral: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Contact & Trust Info */}
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ color: '#9A3412', fontSize: '1rem', fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Globe size={16} color="#C2410C" /> 3. à¤¸à¤‚à¤ªà¤°à¥à¤•, à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨ à¤à¤µà¤‚ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤µà¤¿à¤µà¤°à¤£
                            </h4>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨ à¤«à¥‹à¤¨ à¤¨à¤‚à¤¬à¤°</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="+91 7398959993"
                                  value={projectSettings.helplineNumber || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, helplineNumber: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ˆà¤®à¥‡à¤² à¤†à¤ˆà¤¡à¥€</label>
                                <input
                                  type="email"
                                  className="form-control"
                                  placeholder="infomatavaishnodevi@gmail.com"
                                  value={projectSettings.officialEmail || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, officialEmail: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="form-label">à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤•à¤¾à¤°à¥à¤¯à¤¾à¤²à¤¯ à¤•à¤¾ à¤ªà¤¤à¤¾ (Office Address)</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India"
                                value={projectSettings.officeAddress || ''}
                                onChange={e => setProjectSettings({ ...projectSettings, officeAddress: e.target.value })}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">à¤ªà¤µà¤¿à¤¤à¥à¤° à¤¶à¥à¤²à¥‹à¤• / à¤Ÿà¥ˆà¤—à¤²à¤¾à¤‡à¤¨</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="à¤œà¤¯ à¤®à¤¾à¤¤à¤¾ à¤¦à¥€ â€¢ à¥ à¤¶à¥à¤°à¥€ à¤µà¥ˆà¤·à¥à¤£à¤µà¥€ à¤¨à¤®à¤ƒ â€¢ à¤¨à¤¿à¤·à¥à¤•à¤¾à¤® à¤¸à¥‡à¤µà¤¾"
                                value={projectSettings.sacredShlok || ''}
                                onChange={e => setProjectSettings({ ...projectSettings, sacredShlok: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid-2">
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                              <input
                                type="checkbox"
                                id="hideBerthNumber"
                                checked={projectSettings.hideBerthNumber || false}
                                onChange={e => setProjectSettings({ ...projectSettings, hideBerthNumber: e.target.checked })}
                                style={{ width: 20, height: 20, cursor: 'pointer' }}
                              />
                              <label htmlFor="hideBerthNumber" className="form-label" style={{ margin: 0, cursor: 'pointer', color: '#9A3412', fontWeight: 800 }}>
                                à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¤° à¤¬à¤°à¥à¤¥/à¤¸à¥€à¤Ÿ à¤¨à¤‚à¤¬à¤° à¤›à¤¿à¤ªà¤¾à¤à¤‚ (à¤¸à¤¿à¤°à¥à¤« à¤•à¥‹à¤š à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤¹à¥‹à¤—à¤¾)
                              </label>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 800 }}
                            disabled={projectSettingsSaving}
                          >
                            <Settings size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                            {projectSettingsSaving ? 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¹à¥‹ à¤°à¤¹à¥€ à¤¹à¥ˆà¤‚...' : 'à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤à¤µà¤‚ UPI à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤•à¤°à¥‡à¤‚ (Save Settings)'}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* User Profile Overview Card */}
                    {staffUser && (
                      <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1.5px solid #FED7AA', paddingBottom: 14, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, boxShadow: '0 4px 10px rgba(234,88,12,0.3)' }}>
                              {staffUser.name ? staffUser.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.3rem', fontWeight: 800 }}>{staffUser.name}</h3>
                              <div style={{ fontSize: '0.85rem', color: '#7C2D12', marginTop: 2 }}>
                                @{staffUser.username} {staffUser.email ? `â€¢ ${staffUser.email}` : ''}
                              </div>
                            </div>
                          </div>
                          <span className="badge badge-bhakti" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                            {staffUser.role}
                          </span>
                        </div>

                        <div className="grid-2" style={{ gap: 12, fontSize: '0.88rem' }}>
                          <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤µà¤¿à¤­à¤¾à¤— (Department):</div>
                            <strong style={{ color: '#1F2937' }}>{staffUser.department || 'à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¸à¤¾à¤®à¤¾à¤¨à¥à¤¯ à¤ªà¥à¤°à¤¶à¤¾à¤¸à¤¨'}</strong>
                          </div>
                          <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤–à¤¾à¤¤à¤¾ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (Account Status):</div>
                            <strong style={{ color: '#047857' }}>âœ“ Active & Verified (à¤¸à¤•à¥à¤°à¤¿à¤¯)</strong>
                          </div>
                          {staffUser.assignedCoach && (
                            <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                              <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¥‹à¤š (Assigned Coaches):</div>
                              <strong style={{ color: '#C2410C' }}>{staffUser.assignedCoach}</strong>
                            </div>
                          )}
                          {staffUser.assignedStation && (
                            <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                              <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ (Assigned Station):</div>
                              <strong style={{ color: '#1F2937' }}>{staffUser.assignedStation}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Change Password Card */}
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Lock size={22} color="#C2410C" />
                        <h3 style={{ fontSize: '1.2rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤à¤µà¤‚ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¬à¤¦à¤²à¥‡à¤‚ (Change Password)</h3>
                      </div>
                      
                      {settingsMessage && (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', fontWeight: 600 }}>
                          âœ“ {settingsMessage}
                        </div>
                      )}
                      {settingsError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', fontWeight: 600 }}>
                          âŒ {settingsError}
                        </div>
                      )}

                      <form onSubmit={handlePasswordUpdate}>
                        <div className="form-group">
                          <label className="form-label">à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ (Old Password) <span style={{color: 'red'}}>*</span></label>
                          <input type="password" required className="form-control" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" value={settingsOldPass} onChange={e => setSettingsOldPass(e.target.value)} />
                        </div>
                        <div className="grid-2">
                          <div className="form-group">
                            <label className="form-label">à¤¨à¤¯à¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ (New Password) <span style={{color: 'red'}}>*</span></label>
                            <input type="password" required minLength={6} className="form-control" placeholder="à¤¨à¥à¤¯à¥‚à¤¨à¤¤à¤® 6 à¤…à¤•à¥à¤·à¤°" value={settingsNewPass} onChange={e => setSettingsNewPass(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤•à¤°à¥‡à¤‚ (Confirm Password) <span style={{color: 'red'}}>*</span></label>
                            <input type="password" required minLength={6} className="form-control" placeholder="à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤ªà¥à¤¨à¤ƒ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚" value={settingsConfirmPass} onChange={e => setSettingsConfirmPass(e.target.value)} />
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: 6, fontSize: '0.95rem' }}>
                          <Key size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> à¤¨à¤¯à¤¾ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤¸à¤¹à¥‡à¤œà¥‡à¤‚ (Update Password)
                        </button>
                      </form>
                    </div>

                    {/* Account Logout Action Card */}
                    <div className="glass-card" style={{ border: '2px solid #FCA5A5', background: '#FFF5F5', textAlign: 'center', padding: 20 }}>
                      <h4 style={{ color: '#991B1B', margin: '0 0 6px', fontWeight: 800 }}>à¤¸à¤¤à¥à¤° à¤¸à¤®à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚ (Staff Logout)</h4>
                      <p style={{ color: '#7F1D1D', fontSize: '0.85rem', margin: '0 0 14px' }}>
                        à¤•à¤¾à¤® à¤¸à¤®à¤¾à¤ªà¥à¤¤ à¤¹à¥‹à¤¨à¥‡ à¤•à¥‡ à¤¬à¤¾à¤¦ à¤…à¤ªà¤¨à¥‡ à¤–à¤¾à¤¤à¥‡ à¤•à¥‹ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤°à¤–à¤¨à¥‡ à¤¹à¥‡à¤¤à¥ à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ à¤•à¤°à¥‡à¤‚à¥¤
                      </p>
                      <button className="btn btn-danger" onClick={handleStaffLogout} style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 700 }}>
                        <LogOut size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ à¤•à¤°à¥‡à¤‚ (Logout Now)
                      </button>
                    </div>
                  </div>
                )}

                {/* VIEW: TRAIN COMPOSITION & COACH POSITIONS (PUBLIC & STAFF) */}
                {activeView === 'coach_position' && (
                  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    {/* Header & Controls */}
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: '1.5px solid #FED7AA', paddingBottom: 14, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #F97316, #C2410C)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Train size={28} />
                          </div>
                          <div>
                            <h2 style={{ margin: 0, color: '#9A3412', fontSize: '1.4rem', fontWeight: 800 }}>
                              à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤°à¥‡à¤• à¤¸à¤‚à¤°à¤šà¤¨à¤¾ (Live Train Composition)
                            </h2>
                            <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.88rem' }}>
                              à¤‡à¤‚à¤œà¤¨ à¤¸à¥‡ à¤—à¤¾à¤°à¥à¤¡ à¤µà¥ˆà¤¨ à¤¤à¤• à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ 18+ à¤¬à¥‹à¤—à¥€ à¤¸à¤‚à¤°à¤šà¤¨à¤¾, à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤ªà¥à¤²à¥‡à¤¸à¤®à¥‡à¤‚à¤Ÿ à¤à¤µà¤‚ à¤¬à¤°à¥à¤¥ à¤‰à¤ªà¤²à¤¬à¥à¤§à¤¤à¤¾
                            </p>
                          </div>
                        </div>

                        {/* Filter Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7C2D12' }}>à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤·:</label>
                            <select
                              className="form-control"
                              style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto', minWidth: 100 }}
                              value={compositionYearFilter}
                              onChange={(e) => {
                                setCompositionYearFilter(e.target.value);
                                loadTrainComposition(e.target.value);
                              }}
                            >
                              <option value="2026">2026 (à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨)</option>
                              <option value="2025">2025</option>
                              <option value="2024">2024</option>
                            </select>
                          </div>

                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => loadTrainComposition(compositionYearFilter)}
                            disabled={trainCompositionLoading}
                          >
                            <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {trainCompositionLoading ? 'à¤²à¥‹à¤¡ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...' : 'à¤°à¤¿à¤«à¥à¤°à¥‡à¤¶'}
                          </button>

                          {isSuperAdmin && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/admin/coaches')}
                            >
                              <Settings size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤¬à¥‹à¤—à¥€ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨ (Admin)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Summary Metric Stats */}
                      {trainCompositionData && trainCompositionData.stats && (
                        <div className="grid-4" style={{ gap: 12, marginBottom: 16 }}>
                          <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#7C2D12', fontWeight: 700 }}>à¤•à¥à¤² à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚ (Total Bogies)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9A3412' }}>
                              {trainCompositionData.stats.totalCoaches || 18}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#9A3412' }}>à¤‡à¤‚à¤œà¤¨ + 18 à¤¡à¤¿à¤¬à¥à¤¬à¥‡</div>
                          </div>

                          <div style={{ background: '#EFF6FF', padding: 12, borderRadius: 8, border: '1px solid #BFDBFE', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 700 }}>à¤¸à¥à¤²à¥€à¤ªà¤° à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚ (Sleeper)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1D4ED8' }}>
                              {trainCompositionData.stats.sleeperCoaches || 6} à¤¬à¥‹à¤—à¥€
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#2563EB' }}>{trainCompositionData.stats.sleeperBerths || 432} à¤¸à¥€à¤Ÿà¥‡à¤‚</div>
                          </div>

                          <div style={{ background: '#F5F3FF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#5B21B6', fontWeight: 700 }}>à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ (AC 3T / 2T)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6D28D9' }}>
                              {trainCompositionData.stats.acCoaches || 6} à¤¬à¥‹à¤—à¥€
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#7C3AED' }}>{trainCompositionData.stats.acBerths || 384} à¤¸à¥€à¤Ÿà¥‡à¤‚</div>
                          </div>

                          {staffUser && (
                            <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 700 }}>à¤•à¥à¤² à¤†à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¥€</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>
                                {trainCompositionData.stats.totalBooked || 0} / {trainCompositionData.stats.totalBerthCapacity || 816}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#059669' }}>
                                à¤‰à¤ªà¤²à¤¬à¥à¤§: {(trainCompositionData.stats.totalBerthCapacity || 816) - (trainCompositionData.stats.totalBooked || 0)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Search / Filter Bogie */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FFFDF9', padding: '10px 14px', borderRadius: 8, border: '1px solid #FDBA74' }}>
                        <Search size={18} color="#C2410C" />
                        <input
                          type="text"
                          className="form-control"
                          placeholder="à¤•à¥‹à¤š à¤•à¥‹à¤¡ à¤¸à¥‡ à¤–à¥‹à¤œà¥‡à¤‚ (à¤‰à¤¦à¤¾. S1, S4, B2, A1, PC) à¤¯à¤¾ à¤¶à¥à¤°à¥‡à¤£à¥€..."
                          value={coachSearchQuery}
                          onChange={(e) => setCoachSearchQuery(e.target.value)}
                          style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: '0.92rem', boxShadow: 'none' }}
                        />
                        {coachSearchQuery && (
                          <button
                            onClick={() => setCoachSearchQuery('')}
                            style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            âœ•
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Horizontal Train Rake Visualizer */}
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontWeight: 800, color: '#9A3412', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>à¤°à¥‡à¤• à¤¸à¤‚à¤°à¤šà¤¨à¤¾ (Live Rake Layout - 18 Bogies)</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#7C2D12', display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3B82F6', display: 'inline-block' }}></span> à¤¸à¥à¤²à¥€à¤ªà¤° (SL)
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#8B5CF6', display: 'inline-block' }}></span> 3 AC (3A)
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#D97706', display: 'inline-block' }}></span> 2 AC (2A)
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#64748B', display: 'inline-block' }}></span> SLR / Guard / PC
                          </span>
                        </div>
                      </div>

                      {/* Platform Direction Bar */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(90deg, #EA580C 0%, #FED7AA 50%, #64748B 100%)',
                        color: '#FFFFFF',
                        padding: '6px 14px',
                        borderRadius: '6px 6px 0 0',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.03em'
                      }}>
                        <span>â¬…ï¸ à¤‡à¤‚à¤œà¤¨ / à¤†à¤—à¥‡ à¤•à¤¾ à¤›à¥‹à¤° (Front of Platform / Engine End)</span>
                        <span style={{ color: '#7C2D12', background: '#FFF', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem' }}>à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤Ÿà¥à¤°à¥ˆà¤•</span>
                        <span>à¤—à¤¾à¤°à¥à¤¡ à¤µà¥ˆà¤¨ / à¤ªà¤¿à¤›à¤²à¤¾ à¤›à¥‹à¤° (Rear of Platform / Guard End) âž¡ï¸</span>
                      </div>

                      {/* Horizontally Scrollable Train Rake Track */}
                      <div style={{
                        overflowX: 'auto',
                        padding: '16px 8px 24px 8px',
                        background: '#FFF8F2',
                        border: '1.5px solid #FED7AA',
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'stretch',
                        scrollBehavior: 'smooth'
                      }}>
                        {/* Engine Car */}
                        <div
                          style={{
                            minWidth: 110,
                            background: 'linear-gradient(135deg, #B91C1C, #991B1B)',
                            color: '#FFF',
                            borderRadius: '12px 6px 6px 12px',
                            padding: '12px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            border: '2px solid #7F1D1D',
                            boxShadow: '0 4px 10px rgba(185, 28, 28, 0.25)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ fontSize: 24, marginBottom: 2 }}>ðŸš‚</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 900 }}>LOCO / ENG</div>
                          <div style={{ fontSize: '0.68rem', opacity: 0.9 }}>WAP-7 High Power</div>
                          <div style={{ fontSize: '0.62rem', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, marginTop: 4 }}>
                            Front #0
                          </div>
                        </div>

                        {/* Bogies Sequence */}
                        {((trainCompositionData?.coaches || []).filter(c => {
                          if (!coachSearchQuery) return true;
                          const q = coachSearchQuery.toLowerCase();
                          return (c.coachCode || '').toLowerCase().includes(q) ||
                                 (c.coachName || '').toLowerCase().includes(q) ||
                                 (c.coachClass || '').toLowerCase().includes(q);
                        })).map((coach, idx) => {
                          const isSelected = selectedCoachForPosition?.coachCode === coach.coachCode;
                          const isSleeper = coach.coachClass === 'Sleeper';
                          const is3AC = coach.coachClass === '3 AC' || coach.coachCode?.startsWith('B');
                          const is2AC = coach.coachClass === '2 AC' || coach.coachCode?.startsWith('A');
                          const isPantry = coach.coachClass === 'Pantry' || coach.coachCode === 'PC';
                          const isSLR = coach.coachClass === 'Guard / SLR' || coach.coachCode?.startsWith('SLR');

                          const cardBg = isSelected ? '#FFFBEB'
                            : isSleeper ? '#F0F9FF'
                            : is3AC ? '#F5F3FF'
                            : is2AC ? '#FFFBEB'
                            : isPantry ? '#FEF3C7'
                            : '#F8FAFC';

                          const borderClr = isSelected ? '#F59E0B'
                            : isSleeper ? '#38BDF8'
                            : is3AC ? '#A78BFA'
                            : is2AC ? '#FBBF24'
                            : isPantry ? '#F59E0B'
                            : '#CBD5E1';

                          const badgeBg = isSleeper ? '#0284C7'
                            : is3AC ? '#7C3AED'
                            : is2AC ? '#D97706'
                            : isPantry ? '#B45309'
                            : '#475569';

                          return (
                            <div
                              key={coach.id || coach.coachCode || idx}
                              onClick={() => setSelectedCoachForPosition(coach)}
                              style={{
                                minWidth: 105,
                                maxWidth: 120,
                                background: cardBg,
                                border: `2px solid ${borderClr}`,
                                borderRadius: 8,
                                padding: '10px 6px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: isSelected ? '0 6px 16px rgba(245, 158, 11, 0.35)' : '0 2px 5px rgba(0,0,0,0.05)',
                                position: 'relative'
                              }}
                            >
                              {/* Position Seq # Tag */}
                              <div style={{
                                position: 'absolute',
                                top: -8,
                                background: '#9A3412',
                                color: '#FFF',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: 10
                              }}>
                                #{coach.positionSequence || idx + 1}
                              </div>

                              <div style={{ marginTop: 4 }}>
                                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1F2937' }}>
                                  {coach.coachCode}
                                </div>
                                <div style={{
                                  background: badgeBg,
                                  color: '#FFF',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  marginTop: 2
                                }}>
                                  {coach.coachClass}
                                </div>
                              </div>

                              <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#4B5563', width: '100%' }}>
                                {coach.isBookable ? (
                                  <>
                                    {staffUser && (
                                      <>
                                        <div style={{ fontWeight: 700, color: '#047857' }}>
                                          {coach.bookedPassengers || 0}/{coach.capacity || 72}
                                        </div>
                                        <div style={{ fontSize: '0.64rem', color: '#6B7280' }}>
                                          â‚¹ {coach.baseFare || 0}
                                        </div>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ fontSize: '0.65rem', color: '#6B7280', fontStyle: 'italic' }}>
                                    à¤¸à¥‡à¤µà¤¾ / à¤²à¤—à¥‡à¤œ
                                  </div>
                                )}
                              </div>

                              <div style={{
                                fontSize: '0.6rem',
                                color: '#9A3412',
                                background: '#FFEEDB',
                                padding: '2px 4px',
                                borderRadius: 4,
                                marginTop: 6,
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {coach.platformPlacement || 'Center'}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Visual Railway Track */}
                      <div style={{
                        height: 8,
                        background: 'repeating-linear-gradient(90deg, #78350F 0px, #78350F 6px, #FED7AA 6px, #FED7AA 16px)',
                        borderRadius: 4,
                        marginTop: 4
                      }}></div>
                    </div>

                    {/* Selected Coach Detailed Inspector Card */}
                    {selectedCoachForPosition && (
                      <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #F59E0B', background: '#FFFDF9', padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1.5px solid #FDE68A', paddingBottom: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F59E0B', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>
                              {selectedCoachForPosition.coachCode}
                            </div>
                            <div>
                              <h3 style={{ margin: 0, color: '#92400E', fontSize: '1.25rem', fontWeight: 800 }}>
                                à¤•à¥‹à¤š {selectedCoachForPosition.coachName} ({selectedCoachForPosition.coachCode})
                              </h3>
                              <div style={{ fontSize: '0.84rem', color: '#78350F' }}>
                                à¤¶à¥à¤°à¥‡à¤£à¥€: <strong>{selectedCoachForPosition.coachClass}</strong> â€¢ à¤•à¥à¤°à¤® à¤¸à¤‚à¤–à¥à¤¯à¤¾: #{selectedCoachForPosition.positionSequence}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedCoachForPosition(null)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          >
                            âœ• à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚
                          </button>
                        </div>

                        <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                          <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (Platform Location)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412', marginTop: 2 }}>
                              {selectedCoachForPosition.platformPlacement || 'Center of Platform'}
                            </div>
                          </div>

                          {staffUser && (
                            <>
                              <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤¬à¤°à¥à¤¥ à¤•à¥à¤·à¤®à¤¤à¤¾ à¤µ à¤†à¤°à¤•à¥à¤·à¤£ à¤¸à¥à¤¥à¤¿à¤¤à¤¿</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857', marginTop: 2 }}>
                                  {selectedCoachForPosition.bookedPassengers || 0} / {selectedCoachForPosition.capacity || 72} à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤†à¤°à¤•à¥à¤·à¤¿à¤¤
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#059669' }}>
                                  à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤°à¤¿à¤•à¥à¤¤: {(selectedCoachForPosition.capacity || 72) - (selectedCoachForPosition.bookedPassengers || 0)}
                                </div>
                              </div>

                              <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤¬à¥‡à¤¸ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ (Base Fare)</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#C2410C', marginTop: 2 }}>
                                  â‚¹ {selectedCoachForPosition.baseFare || 0} / à¤¯à¤¾à¤¤à¥à¤°à¥€
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {selectedCoachForPosition.notes && (
                          <div style={{ background: '#FFFBEB', padding: '10px 14px', borderRadius: 8, border: '1px solid #FDE68A', fontSize: '0.85rem', color: '#92400E' }}>
                            <strong>à¤•à¥‹à¤š à¤µà¤¿à¤µà¤°à¤£ / à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¤¿à¤ªà¥à¤ªà¤£à¥€:</strong> {selectedCoachForPosition.notes}
                          </div>
                        )}

                        {/* Berth Arrangement Explanation */}
                        {selectedCoachForPosition.isBookable && (
                          <div style={{ marginTop: 14, background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', fontSize: '0.82rem', color: '#7C2D12' }}>
                            <strong>à¤¬à¤°à¥à¤¥ à¤²à¥‡à¤†à¤‰à¤Ÿ à¤¦à¤¿à¤¶à¤¾à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶:</strong>
                            {selectedCoachForPosition.coachClass === 'Sleeper' ? (
                              <span> 1 à¤¸à¥‡ 72 à¤¤à¤• à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• 8 à¤¸à¥€à¤Ÿà¥‹à¤‚ à¤•à¤¾ à¤•à¥‚à¤ªà¥‡ (Lower: 1,4, Middle: 2,5, Upper: 3,6, Side Lower: 7, Side Upper: 8)à¥¤</span>
                            ) : (
                              <span> 1 à¤¸à¥‡ 64/72 à¤¤à¤• à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤•à¥‚à¤ªà¥‡ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾ à¤à¤µà¤‚ à¤²à¤¿à¤¨à¤¨ à¤¸à¥à¤µà¤¿à¤§à¤¾ à¤‰à¤ªà¤²à¤¬à¥à¤§à¥¤</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tabular Full Rake Reference */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <h3 style={{ color: '#9A3412', fontWeight: 800, fontSize: '1.15rem', marginBottom: 14 }}>
                        à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤°à¥‡à¤• à¤—à¤ à¤¨ à¤¤à¤¾à¤²à¤¿à¤•à¤¾ (Complete Train Formation Chart)
                      </h3>

                      <div className="table-responsive">
                        <table className="custom-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#FFF7ED', color: '#9A3412' }}>
                              <th>à¤•à¥à¤°à¤® #</th>
                              <th>à¤¬à¥‹à¤—à¥€ à¤•à¥‹à¤¡</th>
                              <th>à¤¬à¥‹à¤—à¥€ à¤•à¤¾ à¤¨à¤¾à¤®</th>
                              <th>à¤¶à¥à¤°à¥‡à¤£à¥€</th>
                              {staffUser && <th>à¤•à¥à¤² à¤¸à¥€à¤Ÿà¥‡à¤‚</th>}
                              {staffUser && <th>à¤†à¤°à¤•à¥à¤·à¤¿à¤¤</th>}
                              {staffUser && <th>à¤‰à¤ªà¤²à¤¬à¥à¤§</th>}
                              {staffUser && <th>à¤•à¤¿à¤°à¤¾à¤¯à¤¾</th>}
                              <th>à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                              <th>à¤¬à¥à¤•à¤¿à¤‚à¤—</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Locomotive Row */}
                            <tr style={{ background: '#FEF2F2' }}>
                              <td><strong>0</strong></td>
                              <td><span className="badge badge-danger">LOCO</span></td>
                              <td><strong>à¤‡à¤‚à¤œà¤¨ (WAP-7 Locomotive)</strong></td>
                              <td>à¤²à¥‹à¤•à¥‹à¤®à¥‹à¤Ÿà¤¿à¤µ</td>
                              {staffUser && <td>-</td>}
                              {staffUser && <td>-</td>}
                              {staffUser && <td>-</td>}
                              {staffUser && <td>-</td>}
                              <td>à¤‡à¤‚à¤œà¤¨ à¤›à¥‹à¤° (Front End)</td>
                              <td><span className="badge" style={{ background: '#CBD5E1', color: '#334155' }}>à¤¸à¤‚à¤šà¤¾à¤²à¤¨</span></td>
                            </tr>

                            {(trainCompositionData?.coaches || []).map((c, i) => (
                              <tr
                                key={c.id || c.coachCode || i}
                                style={{
                                  background: selectedCoachForPosition?.coachCode === c.coachCode ? '#FEF3C7' : i % 2 === 0 ? '#FFFFFF' : '#FFFDF9',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setSelectedCoachForPosition(c)}
                              >
                                <td><strong>#{c.positionSequence || i + 1}</strong></td>
                                <td>
                                  <strong style={{ color: '#C2410C', fontSize: '0.95rem' }}>{c.coachCode}</strong>
                                </td>
                                <td>{c.coachName}</td>
                                <td>
                                  <span className="badge badge-bhakti" style={{ fontSize: '0.75rem' }}>
                                    {c.coachClass}
                                  </span>
                                </td>
                                {staffUser && <td><strong>{c.capacity || '-'}</strong></td>}
                                {staffUser && <td style={{ color: '#047857', fontWeight: 700 }}>{c.isBookable ? (c.bookedPassengers || 0) : '-'}</td>}
                                {staffUser && (
                                  <td style={{ color: '#0284C7', fontWeight: 700 }}>
                                    {c.isBookable ? ((c.capacity || 72) - (c.bookedPassengers || 0)) : '-'}
                                  </td>
                                )}
                                {staffUser && <td>{c.baseFare ? `â‚¹ ${c.baseFare}` : '-'}</td>}
                                <td>{c.platformPlacement || 'Center'}</td>
                                <td>
                                  {c.isBookable ? (
                                    <span className="badge badge-active" style={{ fontSize: '0.72rem' }}>à¤¸à¤•à¥à¤°à¤¿à¤¯</span>
                                  ) : (
                                    <span className="badge" style={{ background: '#E2E8F0', color: '#475569', fontSize: '0.72rem' }}>à¤¸à¥‡à¤µà¤¾</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW: ADMIN COACH & BOGIE MASTER MANAGEMENT (SUPERADMIN ONLY) */}
                {activeView === 'admin_coaches' && isSuperAdmin && (
                  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    {/* Header */}
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: '1.5px solid #FED7AA', paddingBottom: 14, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Train size={28} />
                          </div>
                          <div>
                            <h2 style={{ margin: 0, color: '#9A3412', fontSize: '1.4rem', fontWeight: 800 }}>
                              à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¥‹à¤—à¥€ à¤à¤µà¤‚ à¤•à¥‹à¤š à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨ (Train Coach & Rake Master)
                            </h2>
                            <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.88rem' }}>
                              à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤¨à¤ˆ à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚ à¤œà¥‹à¥œà¥‡à¤‚, à¤‡à¤‚à¤œà¤¨ à¤¸à¥‡ à¤—à¤¾à¤°à¥à¤¡ à¤µà¥ˆà¤¨ à¤¤à¤• à¤•à¥à¤°à¤®/à¤ªà¥‹à¤œà¥€à¤¶à¤¨ à¤¬à¤¦à¤²à¥‡à¤‚ à¤¤à¤¥à¤¾ à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤µ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤¨à¤¿à¤°à¥à¤§à¤¾à¤°à¤¿à¤¤ à¤•à¤°à¥‡à¤‚
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setNewCoachForm({
                                coachCode: '',
                                coachName: '',
                                coachClass: 'Sleeper',
                                capacity: 72,
                                baseFare: 1650,
                                platformPlacement: 'Center of Platform',
                                positionSequence: (adminCoachesList.length + 1),
                                isBookable: true,
                                notes: ''
                              });
                              setNewCoachModal(true);
                            }}
                          >
                            <Plus size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> + à¤¨à¤ˆ à¤¬à¥‹à¤—à¥€ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ (Add Bogie)
                          </button>

                          <button
                            className="btn btn-outline btn-sm"
                            onClick={handleResetDefaultRake}
                            style={{ borderColor: '#F59E0B', color: '#B45309' }}
                            title="18 à¤¬à¥‹à¤—à¤¿à¤¯à¥‹à¤‚ à¤•à¥‡ à¤®à¤¾à¤¨à¤• à¤°à¥‡à¤• à¤ªà¤° à¤°à¥€à¤¸à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚"
                          >
                            <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤¡à¤¿à¤«à¤¼à¥‰à¤²à¥à¤Ÿ 18-à¤¬à¥‹à¤—à¥€ à¤°à¥‡à¤• à¤°à¥€à¤¸à¥‡à¤Ÿ
                          </button>

                          <button
                            className="btn btn-outline btn-sm"
                            onClick={loadAdminCoaches}
                            disabled={adminCoachesLoading}
                          >
                            <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {adminCoachesLoading ? 'à¤²à¥‹à¤¡à¤¿à¤‚à¤—...' : 'à¤°à¤¿à¤«à¥à¤°à¥‡à¤¶'}
                          </button>

                          <button
                            className="btn btn-gold btn-sm"
                            onClick={() => navigate('/coach-position')}
                          >
                            <Train size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤¬à¥‹à¤—à¥€ à¤¦à¥ƒà¤¶à¥à¤¯ (Visualizer)
                          </button>
                        </div>
                      </div>

                      {/* Coach Stats Cards */}
                      <div className="grid-4" style={{ gap: 12 }}>
                        <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤•à¥à¤² à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚ (Rake Size)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9A3412' }}>
                            {adminCoachesList.length} à¤¡à¤¿à¤¬à¥à¤¬à¥‡
                          </div>
                        </div>

                        <div style={{ background: '#EFF6FF', padding: 12, borderRadius: 8, border: '1px solid #BFDBFE', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#1E40AF', fontWeight: 700 }}>à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1D4ED8' }}>
                            {adminCoachesList.filter(c => c.isBookable).length} à¤¬à¥‹à¤—à¥€
                          </div>
                        </div>

                        <div style={{ background: '#F5F3FF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#5B21B6', fontWeight: 700 }}>à¤•à¥à¤² à¤¬à¤°à¥à¤¥ à¤•à¥à¤·à¤®à¤¤à¤¾ (Total Seats)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6D28D9' }}>
                            {adminCoachesList.reduce((acc, c) => acc + (parseInt(c.capacity) || 0), 0)} à¤¸à¥€à¤Ÿà¥‡à¤‚
                          </div>
                        </div>

                        <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 700 }}>à¤²à¤¾à¤‡à¤µ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¸à¤¿à¤‚à¤•</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#047857' }}>
                            âœ“ Active Realtime
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Master Coaches Table with Reordering & Actions */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ color: '#9A3412', fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                          à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¥‹à¤—à¥€ à¤•à¥à¤°à¤® à¤à¤µà¤‚ à¤µà¤¿à¤µà¤°à¤£ à¤¤à¤¾à¤²à¤¿à¤•à¤¾ (Rake Sequence & Configuration)
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: '#7C2D12' }}>
                          â¬†ï¸ / â¬‡ï¸ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤¬à¥‹à¤—à¥€ à¤•à¤¾ à¤•à¥à¤°à¤® (à¤‡à¤‚à¤œà¤¨ à¤¸à¥‡ à¤¦à¥‚à¤°à¥€) à¤¬à¤¦à¤²à¥‡à¤‚
                        </span>
                      </div>

                      <div className="table-responsive">
                        <table className="custom-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#FFF7ED', color: '#9A3412' }}>
                              <th>à¤•à¥à¤°à¤®</th>
                              <th>à¤¬à¥‹à¤—à¥€ à¤•à¥‹à¤¡</th>
                              <th>à¤¬à¥‹à¤—à¥€ à¤¨à¤¾à¤®</th>
                              <th>à¤¶à¥à¤°à¥‡à¤£à¥€ (Class)</th>
                              <th>à¤¸à¥€à¤Ÿà¥‡à¤‚</th>
                              <th>à¤•à¤¿à¤°à¤¾à¤¯à¤¾ â‚¹</th>
                              <th>à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤¸à¥à¤¥à¤¿à¤¤à¤¿</th>
                              <th>à¤¬à¥à¤•à¤¿à¤‚à¤— à¤šà¤¾à¤²à¥‚?</th>
                              <th>à¤•à¥à¤°à¤® à¤¬à¤¦à¤²à¥‡à¤‚</th>
                              <th>à¤•à¥à¤°à¤¿à¤¯à¤¾à¤à¤‚</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminCoachesList.length === 0 ? (
                              <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: 24, color: '#7C2D12' }}>
                                  à¤•à¥‹à¤ˆ à¤¬à¥‹à¤—à¥€ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¥€à¥¤ à¤•à¥ƒà¤ªà¤¯à¤¾ "à¤¡à¤¿à¤«à¤¼à¥‰à¤²à¥à¤Ÿ 18-à¤¬à¥‹à¤—à¥€ à¤°à¥‡à¤• à¤°à¥€à¤¸à¥‡à¤Ÿ" à¤¦à¤¬à¤¾à¤à¤‚à¥¤
                                </td>
                              </tr>
                            ) : (
                              adminCoachesList.map((coach, idx) => (
                                <tr key={coach.id || coach.coachCode || idx}>
                                  <td>
                                    <span style={{
                                      background: '#9A3412',
                                      color: '#FFF',
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontWeight: 800,
                                      fontSize: '0.8rem'
                                    }}>
                                      #{coach.position || coach.positionSequence || idx + 1}
                                    </span>
                                  </td>
                                  <td>
                                    <strong style={{ color: '#C2410C', fontSize: '1.05rem' }}>{coach.coachCode}</strong>
                                  </td>
                                  <td><strong>{coach.coachName}</strong></td>
                                  <td>
                                    <span className="badge badge-bhakti" style={{ fontSize: '0.78rem' }}>
                                      {coach.coachClass}
                                    </span>
                                  </td>
                                  <td><strong>{coach.totalSeats || coach.capacity || 72}</strong></td>
                                  <td><strong>â‚¹ {Number(coach.fare || coach.baseFare || 3000).toLocaleString('en-IN')}</strong></td>
                                  <td style={{ fontSize: '0.82rem', color: '#7C2D12' }}>{coach.platformPosition || coach.platformPlacement || 'Center'}</td>
                                  <td>
                                    {coach.isBookable ? (
                                      <span className="badge badge-active" style={{ fontSize: '0.72rem' }}>à¤¸à¤•à¥à¤°à¤¿à¤¯ (Bookable)</span>
                                    ) : (
                                      <span className="badge" style={{ background: '#E2E8F0', color: '#475569', fontSize: '0.72rem' }}>à¤…à¤•à¥à¤°à¤¿à¤¯ / à¤¸à¤°à¥à¤µà¤¿à¤¸</span>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '3px 7px', fontSize: '0.75rem' }}
                                        disabled={idx === 0}
                                        onClick={() => handleMoveCoachPosition(idx, 'up')}
                                        title="à¤¬à¥‹à¤—à¥€ à¤•à¥‹ à¤†à¤—à¥‡ à¤²à¥‡ à¤œà¤¾à¤à¤‚ (Move Up)"
                                      >
                                        <ArrowUp size={14} />
                                      </button>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '3px 7px', fontSize: '0.75rem' }}
                                        disabled={idx === adminCoachesList.length - 1}
                                        onClick={() => handleMoveCoachPosition(idx, 'down')}
                                        title="à¤¬à¥‹à¤—à¥€ à¤•à¥‹ à¤ªà¥€à¤›à¥‡ à¤²à¥‡ à¤œà¤¾à¤à¤‚ (Move Down)"
                                      >
                                        <ArrowDown size={14} />
                                      </button>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '4px 8px', fontSize: '0.78rem', color: '#2563EB', borderColor: '#93C5FD' }}
                                        onClick={() => {
                                          setEditCoachForm({
                                            ...coach,
                                            id: coach.id || coach.coachCode,
                                            positionSequence: coach.position || coach.positionSequence || idx + 1,
                                            capacity: coach.totalSeats || coach.capacity || 72,
                                            baseFare: coach.fare || coach.baseFare || 3000,
                                            platformPlacement: coach.platformPosition || coach.platformPlacement || 'Center'
                                          });
                                          setEditCoachModal(true);
                                        }}
                                        title="à¤¬à¥‹à¤—à¥€ à¤µà¤¿à¤µà¤°à¤£ à¤¸à¤‚à¤¶à¥‹à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚"
                                      >
                                        <Edit size={14} style={{ display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} /> à¤à¤¡à¤¿à¤Ÿ
                                      </button>
                                      <button
                                        className="btn btn-danger btn-sm"
                                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                                        onClick={() => handleDeleteCoach(coach.id, coach.coachCode)}
                                        title="à¤¬à¥‹à¤—à¥€ à¤¹à¤Ÿà¤¾à¤à¤‚"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW: TICKET CANCELLATION & REFUND DESK */}
                {activeView === 'refunds_desk' && (
                  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1.5px solid #FED7AA', paddingBottom: 14, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={28} />
                          </div>
                          <div>
                            <h2 style={{ margin: 0, color: '#9A3412', fontSize: '1.35rem', fontWeight: 800 }}>
                               à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡ à¤¡à¥‡à¤¸à¥à¤• (Ticket Cancellation & Refund Master)
                            </h2>
                            <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.85rem' }}>
                              à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚, à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ à¤¸à¤®à¤¾à¤¯à¥‹à¤œà¤¿à¤¤ à¤•à¤°à¥‡à¤‚ à¤¤à¤¥à¤¾ à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£à¤•à¤°à¥à¤¤à¤¾ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤•à¤¾ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤¦à¥‡à¤–à¥‡à¤‚
                            </p>
                          </div>
                        </div>

                        <button className="btn btn-outline btn-sm" onClick={loadAdminDashboard}>
                          <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤°à¤¿à¤«à¥à¤°à¥‡à¤¶
                        </button>
                      </div>

                      {/* Refund KPI Stats */}
                      <div className="grid-4" style={{ gap: 12 }}>
                        <div style={{ background: '#FEF2F2', padding: 12, borderRadius: 8, border: '1px solid #FECACA', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#991B1B', fontWeight: 700 }}>à¤•à¥à¤² à¤°à¤¦à¥à¤¦ à¤Ÿà¤¿à¤•à¤Ÿ (Cancelled)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626' }}>
                            {adminBookings.filter(b => b.status === 'Cancelled').length} à¤Ÿà¤¿à¤•à¤Ÿ
                          </div>
                        </div>
                        <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>à¤•à¥à¤² à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ (Total Refunded)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EA580C' }}>
                            â‚¹ {adminBookings.filter(b => b.status === 'Cancelled').reduce((sum, b) => sum + (Number(b.refundAmount) || Number(b.cancellationDetails?.refundAmount) || 0), 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 700 }}>à¤•à¤Ÿà¥Œà¤¤à¥€ / à¤¶à¥à¤²à¥à¤• (Charges Kept)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>
                            â‚¹ {adminBookings.filter(b => b.status === 'Cancelled').reduce((sum, b) => sum + (Number(b.cancellationCharges) || Number(b.cancellationDetails?.cancellationCharges) || 0), 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>à¤¸à¥€à¤Ÿà¥‡à¤‚ à¤¸à¥à¤µà¤¤à¤ƒ à¤®à¥à¤•à¥à¤¤ (Seats Released)</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                            âœ“ 100% Realtime Available
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cancelled Bookings Table */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <h3 style={{ color: '#9A3412', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 14px 0' }}>
                        à¤°à¤¦à¥à¤¦ à¤Ÿà¤¿à¤•à¤Ÿà¥‹à¤‚ à¤•à¤¾ à¤µà¤¿à¤¸à¥à¤¤à¥ƒà¤¤ à¤²à¥‡à¤œà¤° (Cancelled Tickets Roster)
                      </h3>

                      <div className="table-responsive">
                        <table className="custom-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#FEF2F2', color: '#991B1B' }}>
                              <th>PNR à¤•à¥à¤°à¤®à¤¾à¤‚à¤•</th>
                              <th>à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ / à¤¯à¤¾à¤¤à¥à¤°à¥€</th>
                              <th>à¤®à¥‹à¤¬à¤¾à¤‡à¤²</th>
                              <th>à¤•à¥‹à¤š à¤µ à¤®à¥‚à¤² à¤¸à¥€à¤Ÿà¥‡à¤‚</th>
                              <th>à¤œà¤®à¤¾ à¤…à¤—à¥à¤°à¤¿à¤®</th>
                              <th>à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿</th>
                              <th>à¤®à¤¾à¤§à¥à¤¯à¤®</th>
                              <th>à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£à¤•à¤°à¥à¤¤à¤¾ (Staff)</th>
                              <th>à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤¸à¤®à¤¯ à¤µ à¤•à¤¾à¤°à¤£</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminBookings.filter(b => b.status === 'Cancelled').length === 0 ? (
                              <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                  à¤µà¤°à¥à¤¤à¤®à¤¾à¤¨ à¤®à¥‡à¤‚ à¤•à¥‹à¤ˆ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤¨à¤¹à¥€à¤‚ à¤¹à¥à¤† à¤¹à¥ˆà¥¤ à¤¸à¤®à¤¸à¥à¤¤ à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤µ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¹à¥ˆà¤‚à¥¤
                                </td>
                              </tr>
                            ) : (
                              adminBookings.filter(b => b.status === 'Cancelled').map((b, idx) => (
                                <tr key={b.bookingId || idx}>
                                  <td><strong style={{ color: '#DC2626' }}>{b.bookingId}</strong></td>
                                  <td><strong>{b.bookedBy}</strong> ({b.numberOfPassengers} à¤¯à¤¾à¤¤à¥à¤°à¥€)</td>
                                  <td>{b.mobile}</td>
                                  <td>
                                    <span className="badge badge-bhakti">{b.coachName || b.cancellationDetails?.originalCoach}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#6B7280', marginLeft: 4 }}>
                                      (à¤¸à¥€à¤Ÿà¥‡à¤‚: {Array.isArray(b.releasedSeats || b.cancellationDetails?.originalSeats) ? (b.releasedSeats || b.cancellationDetails?.originalSeats).join(', ') : 'Free'})
                                    </span>
                                  </td>
                                  <td>â‚¹ {b.cancellationDetails?.originalAdvance || b.advance || 0}</td>
                                  <td><strong style={{ color: '#EA580C' }}>â‚¹ {b.refundAmount || b.cancellationDetails?.refundAmount || 0}</strong></td>
                                  <td><span className="badge badge-paid">{b.cancellationDetails?.refundMode || 'Cash'}</span></td>
                                  <td>
                                    <strong style={{ color: '#1F2937' }}>{b.cancellationDetails?.cancelledBy || 'Admin'}</strong>
                                    <span style={{ fontSize: '0.72rem', color: '#6B7280', display: 'block' }}>({b.cancellationDetails?.cancelledByRole || 'Staff'})</span>
                                  </td>
                                  <td style={{ fontSize: '0.78rem', color: '#4B5563' }}>
                                    {b.cancellationDetails?.cancelledAt ? new Date(b.cancellationDetails.cancelledAt).toLocaleString('en-IN') : 'N/A'}
                                    <div style={{ color: '#B91C1C', fontStyle: 'italic', marginTop: 2 }}>{b.cancellationDetails?.cancellationReason || 'à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤…à¤¨à¥à¤°à¥‹à¤§'}</div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW: COMPREHENSIVE USER GUIDE & SOP */}
                {activeView === 'user_guide' && (
                  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1.5px solid #FED7AA', paddingBottom: 14, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Lightbulb size={28} />
                        </div>
                        <div>
                          <h2 style={{ margin: 0, color: '#9A3412', fontSize: '1.4rem', fontWeight: 800 }}>
                            à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤¯à¥‚à¤œà¤¼à¤° à¤—à¤¾à¤‡à¤¡ à¤µ à¤¸à¤‚à¤šà¤¾à¤²à¤¨ à¤•à¤¾à¤°à¥à¤¯à¤ªà¥à¤°à¤£à¤¾à¤²à¥€ (User Manual & SOP)
                          </h2>
                          <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.88rem' }}>
                            à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤•, à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¥à¤²à¤°à¥à¤•, à¤Ÿà¥€à¤Ÿà¥€à¤ˆ à¤à¤µà¤‚ à¤²à¥‡à¤–à¤¾ à¤Ÿà¥€à¤® à¤¹à¥‡à¤¤à¥ à¤šà¤°à¤£à¤¬à¤¦à¥à¤§ à¤‰à¤ªà¤¯à¥‹à¤— à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶
                          </p>
                        </div>
                      </div>

                      {/* Guide Category Tabs */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #FED7AA', paddingBottom: 10 }}>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('admin')}
                        >
                          1. à¤®à¥à¤–à¥à¤¯ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤• (SuperAdmin SOP)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'clerk' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('clerk')}
                        >
                          2. à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤²à¤¿à¤ªà¤¿à¤• (Booking Clerk)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'tte' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('tte')}
                        >
                          3. à¤šà¤² à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¤°à¥€à¤•à¥à¤·à¤• (TTE Live Check)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'accounts' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('accounts')}
                        >
                          4. à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤µ à¤²à¥‡à¤–à¤¾ à¤®à¤¿à¤²à¤¾à¤¨ (Accounts/MIS)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'refund_rules' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('refund_rules')}
                        >
                           5. à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡ à¤¨à¤¿à¤¯à¤® (Cancellation Policy)
                        </button>
                      </div>
                    </div>

                    {/* Guide Content Card */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 24, lineHeight: 1.7 }}>
                      {userGuideTab === 'admin' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤®à¥à¤–à¥à¤¯ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤• (Chief Admin) à¤•à¤¾à¤°à¥à¤¯à¤ªà¥à¤°à¤£à¤¾à¤²à¥€</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡:</strong> à¤²à¤¾à¤‡à¤µ à¤•à¥à¤² à¤†à¤°à¤•à¥à¤·à¤£, à¤¦à¥ˆà¤¨à¤¿à¤• à¤¬à¤¿à¤•à¥à¤°à¥€, à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ à¤”à¤° à¤¶à¥à¤¦à¥à¤§ à¤°à¤¾à¤œà¤¸à¥à¤µ à¤•à¤¾ à¤µà¤¿à¤¶à¥à¤²à¥‡à¤·à¤£ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¥‹à¤—à¥€ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨:</strong> à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤¨à¤ˆ à¤¬à¥‹à¤—à¤¿à¤¯à¤¾à¤‚ à¤œà¥‹à¥œà¥‡à¤‚, 18-à¤¬à¥‹à¤—à¥€ à¤°à¥‡à¤• à¤°à¥€à¤¸à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚ à¤¯à¤¾ â¬†ï¸/â¬‡ï¸ à¤¬à¤Ÿà¤¨ à¤¸à¥‡ à¤•à¥à¤°à¤® à¤¬à¤¦à¤²à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤¸à¥‡ UPI ID à¤…à¤ªà¤¡à¥‡à¤Ÿ:</strong> à¤…à¤ªà¤¨à¥€ à¤¬à¥ˆà¤‚à¤• UPI ID à¤µ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¨à¤¾à¤® à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚ à¤œà¥‹ QR à¤•à¥‹à¤¡ à¤®à¥‡à¤‚ à¤¤à¥à¤°à¤‚à¤¤ à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¹à¥‹à¤—à¥€à¥¤</li>
                            <li><strong>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ RBAC:</strong> à¤¨à¤ TTE, à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¥à¤²à¤°à¥à¤• à¤µ à¤…à¤•à¤¾à¤‰à¤‚à¤Ÿà¥à¤¸ à¤¸à¥à¤Ÿà¤¾à¤« à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ à¤à¤µà¤‚ à¤‰à¤¨à¥à¤¹à¥‡à¤‚ à¤µà¤¿à¤¶à¤¿à¤·à¥à¤Ÿ à¤¬à¥‹à¤—à¥€ à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤‘à¤¡à¤¿à¤Ÿ à¤Ÿà¥à¤°à¥‡à¤²:</strong> à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤¬à¥à¤•à¤¿à¤‚à¤—, à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£, à¤°à¤¿à¤«à¤‚à¤¡ à¤¯à¤¾ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¬à¤¦à¤²à¤¾à¤µ à¤•à¥€ à¤¸à¤®à¤¯à¤¬à¤¦à¥à¤§ à¤œà¤¾à¤à¤š à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ UTR (à¤¨à¤¯à¤¾):</strong> '5. à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ UTR' à¤®à¥‡à¤‚ à¤œà¤¾à¤•à¤° à¤ªà¥‡à¤‚à¤¡à¤¿à¤‚à¤— UTR à¤•à¤¾ à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¥‡ à¤¸à¥‡ à¤®à¤¿à¤²à¤¾à¤¨ à¤•à¤° à¤‰à¤¸à¥‡ 'Verified' (à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤) à¤¯à¤¾ 'Rejected' (à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤) à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥à¤•à¥ˆà¤¨à¤° (HMAC):</strong> à¤«à¤°à¥à¤œà¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¥‹à¤•à¤¨à¥‡ à¤¹à¥‡à¤¤à¥ 'à¤²à¤¾à¤‡à¤µ à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¥à¤•à¥ˆà¤¨à¤°' à¤¸à¥‡ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾ QR à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤° à¤…à¤¸à¤²à¥€/à¤¨à¤•à¤²à¥€ à¤•à¥€ à¤ªà¤¹à¤šà¤¾à¤¨ à¤•à¤°à¥‡à¤‚à¥¤</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'clerk' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤¬à¥à¤•à¤¿à¤‚à¤— à¤•à¥à¤²à¤°à¥à¤• SOP</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>à¤¨à¤¯à¤¾ à¤†à¤°à¤•à¥à¤·à¤£:</strong> à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤·, à¤¶à¥à¤°à¥‡à¤£à¥€ (Sleeper/AC) à¤à¤µà¤‚ à¤•à¥‹à¤š à¤šà¥à¤¨à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤¸à¥€à¤Ÿ à¤šà¤¯à¤¨:</strong> à¤¸à¥€à¤Ÿ à¤®à¥ˆà¤ª à¤®à¥‡à¤‚ à¤–à¤¾à¤²à¥€ à¤¸à¥€à¤Ÿ à¤ªà¤° à¤•à¥à¤²à¤¿à¤• à¤•à¤°à¥‡à¤‚ (à¤¹à¤°à¥€ à¤²à¤¾à¤‡à¤Ÿ à¤¸à¥‡ à¤šà¤¯à¤¨à¤¿à¤¤ à¤¸à¥€à¤Ÿ à¤¦à¤¿à¤–à¤¤à¥€ à¤¹à¥ˆ)à¥¤</li>
                            <li><strong>à¤¸à¤¹à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤µà¤¿à¤µà¤°à¤£:</strong> à¤¨à¤¾à¤®, à¤†à¤¯à¥, à¤²à¤¿à¤‚à¤—, à¤†à¤§à¤¾à¤° à¤µ à¤¬à¤°à¥à¤¥ à¤ªà¥à¤°à¤¾à¤¥à¤®à¤¿à¤•à¤¤à¤¾ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤µ à¤°à¤¸à¥€à¤¦:</strong> à¤¨à¤•à¤¦ à¤¯à¤¾ UPI QR à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤²à¥‡à¤‚à¥¤ 'à¤•à¥à¤² à¤¦à¥‡à¤¯ à¤°à¤¾à¤¶à¤¿' à¤…à¤ªà¤¨à¥‡-à¤†à¤ª 'à¤…à¤—à¥à¤°à¤¿à¤® à¤Ÿà¥‹à¤•à¤¨ à¤°à¤¾à¤¶à¤¿' à¤®à¥‡à¤‚ à¤­à¤° à¤œà¤¾à¤à¤—à¥€à¥¤ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¥‹ à¤†à¤§à¤¿à¤•à¤¾à¤°à¤¿à¤• à¤ªà¤°à¥à¤šà¥€ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¤•à¥‡ à¤¦à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ (Cancellation):</strong> à¤¯à¤¦à¤¿ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤°à¤¦à¥à¤¦ à¤•à¤°à¤¤à¤¾ à¤¹à¥ˆ à¤¤à¥‹ '4. à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡' à¤®à¥‡à¤‚ à¤œà¤¾à¤•à¤° à¤Ÿà¤¿à¤•à¤Ÿ à¤¨à¤¿à¤°à¤¸à¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤Ÿà¤¿à¤•à¤Ÿ à¤œà¤¾à¤à¤š (Verification):</strong> à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¤¾ à¤Ÿà¤¿à¤•à¤Ÿ à¤…à¤¸à¤²à¥€ à¤¹à¥ˆ à¤¯à¤¾ à¤¨à¤¹à¥€à¤‚, à¤‡à¤¸à¤•à¥‡ à¤²à¤¿à¤ '8. à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' à¤®à¥‡à¤‚ à¤œà¤¾à¤•à¤° PNR à¤¡à¤¾à¤²à¥‡à¤‚ à¤¯à¤¾ QR à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚à¥¤</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'tte' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤šà¤² à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¤°à¥€à¤•à¥à¤·à¤• (TTE) à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤…à¤Ÿà¥‡à¤‚à¤¡à¥‡à¤‚à¤¸ SOP</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>à¤²à¤¾à¤‡à¤µ à¤¸à¥€à¤Ÿ à¤—à¥à¤°à¤¿à¤¡:</strong> à¤…à¤ªà¤¨à¥‡ à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¥‹à¤š à¤•à¤¾ à¤šà¤¯à¤¨ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤œà¤¾à¤à¤š:</strong> à¤ªà¥à¤°à¤¤à¥à¤¯à¥‡à¤• à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤® à¤µ à¤†à¤§à¤¾à¤° à¤¦à¥‡à¤–à¤•à¤° <strong>âœ“ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ (Present)</strong> à¤¯à¤¾ <strong>âœ• à¤…à¤¨à¥à¤ªà¤¸à¥à¤¥à¤¿à¤¤ (Absent)</strong> à¤®à¤¾à¤°à¥à¤• à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤‘à¤¨-à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¤•à¤¾à¤¯à¤¾ à¤µà¤¸à¥‚à¤²à¥€:</strong> à¤¶à¥‡à¤· à¤°à¤¾à¤¶à¤¿ à¤¹à¥‹à¤¨à¥‡ à¤ªà¤° <strong>"à¤µà¤¸à¥‚à¤²à¥€ à¤•à¤°à¥‡à¤‚"</strong> à¤¦à¤¬à¤¾à¤•à¤° à¤¨à¤•à¤¦ à¤¯à¤¾ à¤‘à¤¨-à¤¸à¥à¤ªà¥‰à¤Ÿ UPI QR à¤¸à¥‡ à¤¶à¥‡à¤· à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤«à¤°à¥à¤œà¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¥‹à¤•à¤¥à¤¾à¤®:</strong> '4. à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨' à¤®à¥‡à¤‚ <strong>à¤²à¤¾à¤‡à¤µ à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤¸à¥à¤•à¥ˆà¤¨à¤° (HMAC)</strong> à¤•à¤¾ à¤‰à¤ªà¤¯à¥‹à¤— à¤•à¤°à¥‡à¤‚à¥¤ à¤…à¤—à¤° à¤Ÿà¤¿à¤•à¤Ÿ à¤¸à¥‡ à¤›à¥‡à¤¡à¤¼à¤›à¤¾à¤¡à¤¼ à¤¹à¥à¤ˆ à¤¹à¥ˆ (à¤œà¥ˆà¤¸à¥‡ à¤¨à¤¾à¤® à¤¯à¤¾ à¤°à¤¾à¤¶à¤¿ à¤¬à¤¦à¤²à¥€ à¤¹à¥ˆ) à¤¤à¥‹ à¤¸à¥à¤•à¥ˆà¤¨à¤° à¤¤à¥à¤°à¤‚à¤¤ à¤…à¤²à¤°à¥à¤Ÿ (à¤²à¤¾à¤² à¤°à¤‚à¤—) à¤¦à¥‡à¤—à¤¾à¥¤</li>
                            <li><strong>UTR à¤¦à¤°à¥à¤œ à¤•à¤°à¤¨à¤¾:</strong> à¤¯à¤¦à¤¿ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ UPI à¤¸à¥‡ à¤¬à¤•à¤¾à¤¯à¤¾ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¤°à¤¤à¤¾ à¤¹à¥ˆ, à¤¤à¥‹ UTR à¤¸à¥à¤•à¥ˆà¤¨à¤° à¤Ÿà¥ˆà¤¬ à¤®à¥‡à¤‚ à¤¡à¤¾à¤²à¤•à¤° à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ à¤•à¤°à¥‡à¤‚à¥¤</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'accounts' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤¦à¥ˆà¤¨à¤¿à¤• à¤µà¤¸à¥‚à¤²à¥€ à¤µ à¤²à¥‡à¤–à¤¾ à¤®à¤¿à¤²à¤¾à¤¨ (Daily MIS & Accounts)</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>à¤¦à¥ˆà¤¨à¤¿à¤• à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ:</strong> à¤¤à¤¿à¤¥à¤¿ à¤šà¥à¤¨à¥‡à¤‚ (à¤†à¤œ, à¤•à¤², à¤ªà¤¿à¤›à¤²à¥‡ 7 à¤¦à¤¿à¤¨ à¤¯à¤¾ à¤•à¤¸à¥à¤Ÿà¤® à¤¡à¥‡à¤Ÿ à¤°à¥‡à¤‚à¤œ)à¥¤</li>
                            <li><strong>à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€à¤µà¤¾à¤° à¤¬à¤¹à¥€à¤–à¤¾à¤¤à¤¾:</strong> à¤•à¤¿à¤¸ à¤•à¥à¤²à¤°à¥à¤• à¤¯à¤¾ TTE à¤¨à¥‡ à¤•à¤¿à¤¤à¤¨à¤¾ à¤¨à¤•à¤¦ à¤µ UPI à¤•à¤²à¥‡à¤•à¥à¤Ÿ à¤•à¤¿à¤¯à¤¾, à¤‰à¤¸à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¹à¤¿à¤¸à¤¾à¤¬ à¤¦à¥‡à¤–à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤°à¤¿à¤«à¤‚à¤¡ à¤¸à¤®à¤¾à¤¯à¥‹à¤œà¤¨:</strong> à¤°à¤¿à¤«à¤‚à¤¡ à¤•à¥€ à¤—à¤ˆ à¤°à¤¾à¤¶à¤¿ à¤¶à¥à¤¦à¥à¤§ à¤°à¤¾à¤œà¤¸à¥à¤µ (Net Balance) à¤¸à¥‡ à¤‘à¤Ÿà¥‹-à¤à¤¡à¤œà¤¸à¥à¤Ÿ à¤¹à¥‹à¤•à¤° à¤ªà¥à¤°à¤¦à¤°à¥à¤¶à¤¿à¤¤ à¤¹à¥‹à¤—à¥€à¥¤</li>
                            <li><strong>UTR à¤®à¤¿à¤²à¤¾à¤¨ (Verification):</strong> '6. à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤µ UTR' à¤®à¥‡à¤‚ à¤œà¤¾à¤•à¤° à¤¬à¥ˆà¤‚à¤• à¤¸à¥à¤Ÿà¥‡à¤Ÿà¤®à¥‡à¤‚à¤Ÿ à¤¸à¥‡ à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥à¤“à¤‚ à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤­à¤°à¥‡ à¤—à¤ 12-à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¥‡ UTR à¤•à¤¾ à¤®à¤¿à¤²à¤¾à¤¨ à¤•à¤°à¥‡à¤‚ à¤”à¤° à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤µà¥‡à¤°à¥€à¤«à¤¾à¤ˆ à¤•à¤°à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤à¤•à¥à¤¸à¥‡à¤² à¤à¤•à¥à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ:</strong> à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤µà¤¿à¤¤à¥à¤¤à¥€à¤¯ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ (Financial Record) à¤à¤• à¤•à¥à¤²à¤¿à¤• à¤®à¥‡à¤‚ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚à¥¤</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'refund_rules' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}> à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡ à¤¨à¤¿à¤¯à¤® (Cancellation & Refund Rules)</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾:</strong> à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¡à¤¾à¤¯à¤°à¥‡à¤•à¥à¤Ÿà¤°à¥€ à¤®à¥‡à¤‚ à¤œà¤¾à¤•à¤° à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¥‡ à¤¸à¤¾à¤®à¤¨à¥‡ <strong>"âœ• à¤°à¤¦à¥à¤¦ / à¤°à¤¿à¤«à¤‚à¤¡"</strong> à¤¦à¤¬à¤¾à¤à¤‚à¥¤</li>
                            <li><strong>à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ à¤¨à¤¿à¤°à¥à¤§à¤¾à¤°à¤£:</strong> à¤œà¤®à¤¾ à¤…à¤—à¥à¤°à¤¿à¤® à¤®à¥‡à¤‚ à¤¸à¥‡ à¤¨à¤¿à¤¯à¤®à¤¾à¤¨à¥à¤¸à¤¾à¤° à¤•à¤Ÿà¥Œà¤¤à¥€ à¤•à¤° à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¥‹ à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ à¤ªà¥à¤°à¤¦à¤¾à¤¨ à¤•à¤°à¥‡à¤‚à¥¤ à¤°à¤¿à¤«à¤‚à¤¡ à¤®à¥‹à¤¡ (UPI/Cash) à¤…à¤¨à¤¿à¤µà¤¾à¤°à¥à¤¯ à¤°à¥‚à¤ª à¤¸à¥‡ à¤šà¥à¤¨à¥‡à¤‚à¥¤</li>
                            <li><strong>à¤¸à¥€à¤Ÿ à¤•à¥€ à¤¤à¤¤à¥à¤•à¤¾à¤² à¤‰à¤ªà¤²à¤¬à¥à¤§à¤¤à¤¾:</strong> à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤¹à¥‹à¤¤à¥‡ à¤¹à¥€ à¤¸à¥€à¤Ÿ à¤®à¥ˆà¤ª à¤®à¥‡à¤‚ à¤µà¤¹ à¤¬à¤°à¥à¤¥ à¤ªà¥à¤¨à¤ƒ à¤¹à¤°à¥€ (Available) à¤¹à¥‹ à¤œà¤¾à¤¤à¥€ à¤¹à¥ˆà¥¤</li>
                            <li><strong>à¤‘à¤¡à¤¿à¤Ÿ à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡:</strong> à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£à¤•à¤°à¥à¤¤à¤¾ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤®, à¤¤à¤¿à¤¥à¤¿ à¤µ à¤°à¤¿à¤«à¤‚à¤¡ à¤®à¥‹à¤¡ à¤¸à¥à¤¥à¤¾à¤¯à¥€ à¤°à¥‚à¤ª à¤¸à¥‡ à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤°à¤¹à¤¤à¤¾ à¤¹à¥ˆ à¤”à¤° à¤‘à¤¡à¤¿à¤Ÿ à¤²à¥‰à¤—à¥à¤¸ à¤®à¥‡à¤‚ à¤¦à¤°à¥à¤œ à¤¹à¥‹à¤¤à¤¾ à¤¹à¥ˆà¥¤</li>
                          </ol>
                        </div>
                      )}

                      <div style={{ marginTop: 20, background: '#FFF8F2', padding: 14, borderRadius: 8, border: '1px solid #FED7AA', fontSize: '0.85rem', color: '#7C2D12' }}>
                        <strong>à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨ à¤µ à¤¤à¤•à¤¨à¥€à¤•à¥€ à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾:</strong> à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤•à¤ à¤¿à¤¨à¤¾à¤ˆ à¤•à¥‡ à¤²à¤¿à¤ à¤à¤¡à¤®à¤¿à¤¨ à¤¸à¤ªà¥‹à¤°à¥à¤Ÿ <code>iammshyam@gmail.com</code> à¤¯à¤¾ <code>info.aroventech@gmail.com</code> à¤ªà¤° à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚à¥¤<br />
                        <strong>à¤¸à¥‰à¤«à¥à¤Ÿà¤µà¥‡à¤¯à¤° à¤¡à¥‡à¤µà¤²à¤ªà¤°:</strong> ArovenTech (www.aroventech.site | +91 9598023701)
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW: RULES AND CONDITIONS PAGE */}
                {activeView === 'rules' && (
                  <div className="glass-card rules-page" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 30px', background: '#FFFFFF', color: '#1F2937', fontFamily: 'serif' }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #9A3412', paddingBottom: 20, marginBottom: 30 }}>
                      <h1 style={{ fontSize: '2.5rem', color: '#9A3412', fontWeight: 900, margin: '0 0 10px 0' }}>{projectSettings.trustName || 'à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ'}</h1>
                      <h2 style={{ fontSize: '1.5rem', color: '#7C2D12', margin: 0 }}>à¤Ÿà¥à¤°à¥‡à¤¨ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¥‡ à¤¨à¤¿à¤¯à¤® à¤à¤µà¤‚ à¤¶à¤°à¥à¤¤à¥‡à¤‚ (Terms & Conditions)</h2>
                      <div style={{ marginTop: 15 }}>
                        <button className="btn btn-outline hide-on-print" onClick={() => window.print()} style={{ borderColor: '#9A3412', color: '#9A3412' }}>
                          <Printer size={16} style={{ display: 'inline', marginRight: 6 }} /> à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚ (Print)
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ lineHeight: 1.8, fontSize: '1.05rem' }}>
                      <ol style={{ paddingLeft: 24 }}>
                        <li style={{ marginBottom: 12 }}><strong>à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¥€ à¤µà¥ˆà¤§à¤¤à¤¾ (Validity):</strong> à¤¯à¤¹ à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¥‡à¤µà¤² à¤‰à¤¸à¥€ à¤¤à¤¿à¤¥à¤¿, à¤Ÿà¥à¤°à¥‡à¤¨ à¤”à¤° à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¥‡ à¤²à¤¿à¤ à¤®à¤¾à¤¨à¥à¤¯ à¤¹à¥ˆ à¤œà¤¿à¤¸à¤•à¥‡ à¤¨à¤¾à¤® à¤ªà¤° à¤¯à¤¹ à¤œà¤¾à¤°à¥€ à¤•à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¹à¥ˆà¥¤ à¤Ÿà¤¿à¤•à¤Ÿ à¤…à¤¹à¤¸à¥à¤¤à¤¾à¤‚à¤¤à¤°à¤£à¥€à¤¯ (Non-transferable) à¤¹à¥ˆà¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤ªà¤¹à¤šà¤¾à¤¨ à¤ªà¤¤à¥à¤° (ID Proof):</strong> à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¥‡ à¤¦à¥Œà¤°à¤¾à¤¨ à¤¸à¤­à¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¿à¤¯à¥‹à¤‚ à¤•à¥‹ à¤…à¤ªà¤¨à¤¾ à¤®à¥‚à¤² (Original) à¤µà¥ˆà¤§ à¤ªà¤¹à¤šà¤¾à¤¨ à¤ªà¤¤à¥à¤° (à¤œà¥ˆà¤¸à¥‡ à¤†à¤§à¤¾à¤° à¤•à¤¾à¤°à¥à¤¡, à¤µà¥‹à¤Ÿà¤° à¤†à¤ˆà¤¡à¥€) à¤¸à¤¾à¤¥ à¤°à¤–à¤¨à¤¾ à¤…à¤¨à¤¿à¤µà¤¾à¤°à¥à¤¯ à¤¹à¥ˆà¥¤ à¤ªà¤¹à¤šà¤¾à¤¨ à¤ªà¤¤à¥à¤° à¤¨ à¤¹à¥‹à¤¨à¥‡ à¤ªà¤° à¤Ÿà¤¿à¤•à¤Ÿ à¤…à¤®à¤¾à¤¨à¥à¤¯ à¤®à¤¾à¤¨à¤¾ à¤œà¤¾à¤à¤—à¤¾à¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤à¤µà¤‚ à¤°à¤¿à¤«à¤‚à¤¡ (Cancellation & Refund):</strong> à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤¸à¥‡ 48 à¤˜à¤‚à¤Ÿà¥‡ à¤ªà¥‚à¤°à¥à¤µ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤•à¤°à¤¨à¥‡ à¤ªà¤° 25% à¤•à¤Ÿà¥Œà¤¤à¥€ à¤¹à¥‹à¤—à¥€à¥¤ 48 à¤¸à¥‡ 24 à¤˜à¤‚à¤Ÿà¥‡ à¤ªà¥‚à¤°à¥à¤µ 50% à¤•à¤Ÿà¥Œà¤¤à¥€ à¤¹à¥‹à¤—à¥€à¥¤ 24 à¤˜à¤‚à¤Ÿà¥‡ à¤¸à¥‡ à¤•à¤® à¤¸à¤®à¤¯ à¤®à¥‡à¤‚ à¤•à¥‹à¤ˆ à¤°à¤¿à¤«à¤‚à¤¡ à¤¨à¤¹à¥€à¤‚ à¤¦à¤¿à¤¯à¤¾ à¤œà¤¾à¤à¤—à¤¾à¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤¸à¤¾à¤®à¤¾à¤¨ à¤•à¥€ à¤œà¤¿à¤®à¥à¤®à¥‡à¤¦à¤¾à¤°à¥€ (Luggage):</strong> à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤…à¤ªà¤¨à¥‡ à¤¸à¤¾à¤®à¤¾à¤¨ à¤•à¥€ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤•à¥‡ à¤²à¤¿à¤ à¤¸à¥à¤µà¤¯à¤‚ à¤œà¤¿à¤®à¥à¤®à¥‡à¤¦à¤¾à¤° à¤¹à¥ˆà¤‚à¥¤ à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¯à¤¾ à¤°à¥‡à¤²à¤µà¥‡ à¤ªà¥à¤°à¤¶à¤¾à¤¸à¤¨ à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤ªà¥à¤°à¤•à¤¾à¤° à¤•à¥€ à¤šà¥‹à¤°à¥€ à¤¯à¤¾ à¤¨à¥à¤•à¤¸à¤¾à¤¨ à¤•à¥‡ à¤²à¤¿à¤ à¤‰à¤¤à¥à¤¤à¤°à¤¦à¤¾à¤¯à¥€ à¤¨à¤¹à¥€à¤‚ à¤¹à¥‹à¤—à¤¾à¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤¨à¤¿à¤ƒà¤¶à¥à¤²à¥à¤• à¤¯à¤¾à¤¤à¥à¤°à¤¾ (Free Travel):</strong> à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤ªà¥à¤°à¤•à¤¾à¤° à¤•à¥€ à¤¨à¤¿à¤ƒà¤¶à¥à¤²à¥à¤• à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥‚à¤°à¥à¤£à¤¤à¤ƒ à¤ªà¥à¤°à¤¤à¤¿à¤¬à¤‚à¤§à¤¿à¤¤ à¤¹à¥ˆà¥¤ à¤¬à¤¿à¤¨à¤¾ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¯à¤¾ à¤«à¤°à¥à¤œà¥€ UTR à¤•à¥‡ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤•à¤°à¤¤à¥‡ à¤¹à¥à¤ à¤ªà¤¾à¤ à¤œà¤¾à¤¨à¥‡ à¤ªà¤° à¤¦à¤‚à¤¡à¤¾à¤¤à¥à¤®à¤• à¤•à¤¾à¤°à¥à¤°à¤µà¤¾à¤ˆ à¤•à¥€ à¤œà¤¾à¤à¤—à¥€à¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤§à¥‚à¤®à¥à¤°à¤ªà¤¾à¤¨ à¤à¤µà¤‚ à¤¨à¤¶à¤¾ (Smoking & Intoxicants):</strong> à¤Ÿà¥à¤°à¥‡à¤¨ à¤•à¥‡ à¤­à¥€à¤¤à¤° à¤§à¥‚à¤®à¥à¤°à¤ªà¤¾à¤¨, à¤¶à¤°à¤¾à¤¬ à¤¯à¤¾ à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤ªà¥à¤°à¤•à¤¾à¤° à¤•à¥‡ à¤®à¤¾à¤¦à¤• à¤ªà¤¦à¤¾à¤°à¥à¤¥à¥‹à¤‚ à¤•à¤¾ à¤¸à¥‡à¤µà¤¨ à¤ªà¥‚à¤°à¥à¤£à¤¤à¤ƒ à¤µà¤°à¥à¤œà¤¿à¤¤ à¤¹à¥ˆà¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤µà¤¿à¤µà¤¾à¤¦ (Disputes):</strong> à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤ªà¥à¤°à¤•à¤¾à¤° à¤•à¥‡ à¤µà¤¿à¤µà¤¾à¤¦ à¤•à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤®à¥‡à¤‚ à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤•à¤¾ à¤¨à¤¿à¤°à¥à¤£à¤¯ à¤…à¤‚à¤¤à¤¿à¤® à¤à¤µà¤‚ à¤¸à¤°à¥à¤µà¤®à¤¾à¤¨à¥à¤¯ à¤¹à¥‹à¤—à¤¾à¥¤</li>
                        <li style={{ marginBottom: 12 }}><strong>à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤² (Emergency):</strong> à¤•à¤¿à¤¸à¥€ à¤­à¥€ à¤†à¤ªà¤¾à¤¤ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤¯à¤¾ à¤šà¤¿à¤•à¤¿à¤¤à¥à¤¸à¤¾ à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾ à¤•à¥‡ à¤²à¤¿à¤ à¤•à¥ƒà¤ªà¤¯à¤¾ à¤Ÿà¥à¤°à¥‡à¤¨ à¤®à¥‡à¤‚ à¤‰à¤ªà¤¸à¥à¤¥à¤¿à¤¤ TTE à¤¯à¤¾ à¤¸à¥à¤°à¤•à¥à¤·à¤¾ à¤•à¤°à¥à¤®à¤¿à¤¯à¥‹à¤‚ à¤¸à¥‡ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚à¥¤</li>
                      </ol>
                    </div>

                    <div style={{ marginTop: 50, borderTop: '1px solid #E5E7EB', paddingTop: 20, textAlign: 'center', fontSize: '0.9rem', color: '#6B7280' }}>
                      <p style={{ margin: '0 0 5px 0' }}>{projectSettings.sacredShlok || 'à¥¤à¥¤ à¥ à¤¸à¤°à¥à¤µà¤®à¤‚à¤—à¤² à¤®à¤¾à¤‚à¤—à¤²à¥à¤¯à¥‡ à¤¶à¤¿à¤µà¥‡ à¤¸à¤°à¥à¤µà¤¾à¤°à¥à¤¥ à¤¸à¤¾à¤§à¤¿à¤•à¥‡ â€¢ à¤¶à¤°à¤£à¥à¤¯à¥‡ à¤¤à¥à¤°à¥à¤¯à¤‚à¤¬à¤•à¥‡ à¤—à¥Œà¤°à¥€ à¤¨à¤¾à¤°à¤¾à¤¯à¤£à¤¿ à¤¨à¤®à¥‹à¤½à¤¸à¥à¤¤à¥ à¤¤à¥‡ à¥¤à¥¤'}</p>
                      <p style={{ margin: 0 }}>à¤…à¤§à¤¿à¤• à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤•à¥‡ à¤²à¤¿à¤ à¤¸à¤‚à¤ªà¤°à¥à¤• à¤•à¤°à¥‡à¤‚: {projectSettings.helplineNumber || '+91 9598023701'} | {projectSettings.officialEmail || 'iammshyam@gmail.com'}</p>
                    </div>
                  </div>
                )}

                {/* VIEW: 404 NOT FOUND */}
                {activeView === '404' && (
                  <div className="glass-card" style={{ maxWidth: 650, margin: '60px auto', textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 64, color: '#F97316', marginBottom: 16 }}>404</div>
                    <h2 style={{ color: '#9A3412', fontWeight: 800, marginBottom: 12 }}>à¤ªà¥ƒà¤·à¥à¤  à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾ (Page Not Found)</h2>
                    <p style={{ color: '#7C2D12', marginBottom: 24 }}>
                      à¤†à¤ª à¤œà¤¿à¤¸ à¤ªà¥ƒà¤·à¥à¤  à¤•à¥‹ à¤¢à¥‚à¤à¤¢ à¤°à¤¹à¥‡ à¤¹à¥ˆà¤‚, à¤µà¤¹ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ à¤¯à¤¾ à¤¹à¤Ÿà¤¾ à¤¦à¤¿à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¹à¥ˆà¥¤
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                      <Home size={18} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> à¤¹à¥‹à¤® à¤ªà¥‡à¤œ à¤ªà¤° à¤œà¤¾à¤à¤‚
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* ----------------- TICKET CANCELLATION & REFUND MODAL ----------------- */}
      {cancelModal && cancelModal.show && cancelModal.booking && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal-content glass-card no-hover" style={{ maxWidth: 520, background: '#FFFFFF', border: '2px solid #EF4444' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #FCA5A5', paddingBottom: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={22} color="#DC2626" />
                <h3 style={{ color: '#991B1B', fontWeight: 800, margin: 0, fontSize: '1.15rem' }}>
                  à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤µ à¤°à¤¿à¤«à¤‚à¤¡ (Cancel Ticket #{cancelModal.booking.bookingId})
                </h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setCancelModal(null)} style={{ border: 'none', fontSize: '1.2rem', color: '#6B7280' }}>âœ•</button>
            </div>

            <form onSubmit={handleCancelTicket}>
              <div style={{ background: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥ à¤•à¤¾ à¤¨à¤¾à¤®:</span>
                  <strong>{cancelModal.booking.bookedBy} (Mob: {cancelModal.booking.mobile})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>à¤•à¥‹à¤š à¤µ à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤¸à¥€à¤Ÿà¥‡à¤‚:</span>
                  <strong>{cancelModal.booking.coachName} - à¤¸à¥€à¤Ÿ: {Array.isArray(cancelModal.booking.seatNumber) ? cancelModal.booking.seatNumber.join(', ') : cancelModal.booking.seatNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>à¤•à¥à¤² à¤•à¤¿à¤°à¤¾à¤¯à¤¾:</span>
                  <strong>â‚¹ {cancelModal.booking.totalAmount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 700 }}>
                  <span>à¤œà¤®à¤¾ à¤…à¤—à¥à¤°à¤¿à¤® à¤°à¤¾à¤¶à¤¿ (Paid Advance):</span>
                  <span>â‚¹ {cancelModal.booking.advance || 0}</span>
                </div>
              </div>

              {/* Refund Policy Banner */}
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ color: '#991B1B', fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>âš ï¸</span>
                  <span>à¤°à¤¿à¤«à¤‚à¤¡ à¤¨à¥€à¤¤à¤¿: à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤¸à¥‡ à¤¨à¤•à¤¦ (Cash) à¤µà¤¾à¤ªà¤¸ à¤¨à¤¹à¥€à¤‚ à¤¦à¤¿à¤¯à¤¾ à¤œà¤¾à¤à¤—à¤¾à¥¤</span>
                </div>
                <div style={{ color: '#7F1D1D', fontSize: '0.78rem', marginTop: 4, lineHeight: 1.4 }}>
                  à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¾à¤¶à¤¿ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤• (Admin) à¤¦à¥à¤µà¤¾à¤°à¤¾ <strong>5-7 à¤•à¤¾à¤°à¥à¤¯ à¤¦à¤¿à¤µà¤¸à¥‹à¤‚ (Working Days)</strong> à¤®à¥‡à¤‚ à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¥‡ à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¥‡ / UPI à¤®à¥‡à¤‚ à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤Ÿà¥à¤°à¤¾à¤‚à¤¸à¤«à¤° à¤•à¥€ à¤œà¤¾à¤à¤—à¥€à¥¤ à¤•à¥ƒà¤ªà¤¯à¤¾ à¤¨à¥€à¤šà¥‡ à¤¸à¤¹à¥€ à¤¬à¥ˆà¤‚à¤• à¤¯à¤¾ UPI à¤µà¤¿à¤µà¤°à¤£ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚à¥¤
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#991B1B' }}>à¤°à¤¿à¤«à¤‚à¤¡ à¤•à¥€ à¤œà¤¾à¤¨à¥‡ à¤µà¤¾à¤²à¥€ à¤°à¤¾à¤¶à¤¿ (Refund Amount â‚¹) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={cancelModal.refundAmount}
                  onChange={(e) => {
                    const ref = parseFloat(e.target.value) || 0;
                    const paid = Number(cancelModal.booking.advance || 0);
                    setCancelModal({
                      ...cancelModal,
                      refundAmount: ref,
                      cancellationCharges: Math.max(0, paid - ref)
                    });
                  }}
                  required
                  min="0"
                  max={cancelModal.booking.advance || 0}
                  style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">à¤•à¤Ÿà¥Œà¤¤à¥€ / à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤¶à¥à¤²à¥à¤• (Cancellation Charges â‚¹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={cancelModal.cancellationCharges}
                  onChange={(e) => {
                    const chg = parseFloat(e.target.value) || 0;
                    const paid = Number(cancelModal.booking.advance || 0);
                    setCancelModal({
                      ...cancelModal,
                      cancellationCharges: chg,
                      refundAmount: Math.max(0, paid - chg)
                    });
                  }}
                  min="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>à¤°à¤¿à¤«à¤‚à¤¡ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤•à¤°à¤¨à¥‡ à¤•à¤¾ à¤®à¤¾à¤§à¥à¤¯à¤® (Refund Channel - 5-7 Days) *</label>
                <select
                  className="form-control"
                  value={cancelModal.refundChannel || 'UPI'}
                  onChange={(e) => setCancelModal({ ...cancelModal, refundChannel: e.target.value, refundMode: e.target.value === 'UPI' ? 'Admin UPI Transfer (5-7 Days)' : 'Admin Bank Transfer (5-7 Days)' })}
                >
                  <option value="UPI">UPI à¤Ÿà¥à¤°à¤¾à¤‚à¤¸à¤«à¤° (5-7 à¤•à¤¾à¤°à¥à¤¯ à¤¦à¤¿à¤µà¤¸)</option>
                  <option value="Bank">à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¤¾ à¤Ÿà¥à¤°à¤¾à¤‚à¤¸à¤«à¤° (NEFT/IMPS 5-7 à¤•à¤¾à¤°à¥à¤¯ à¤¦à¤¿à¤µà¤¸)</option>
                </select>
              </div>

              {(cancelModal.refundChannel || 'UPI') === 'UPI' ? (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: '#047857' }}>à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ UPI ID (à¤‰à¤¦à¤¾. 9876543210@upi / paytm) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="à¤‰à¤¦à¤¾. mobile@upi à¤¯à¤¾ name@okhdfcbank"
                    value={cancelModal.upiId || ''}
                    onChange={(e) => setCancelModal({ ...cancelModal, upiId: e.target.value, utr: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>à¤–à¤¾à¤¤à¤¾ à¤§à¤¾à¤°à¤• à¤•à¤¾ à¤¨à¤¾à¤® (Account Holder Name) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="à¤‰à¤¦à¤¾. à¤¯à¤¾à¤¤à¥à¤°à¥€ à¤•à¤¾ à¤¨à¤¾à¤®"
                      value={cancelModal.accountHolder || cancelModal.booking.bookedBy || ''}
                      onChange={(e) => setCancelModal({ ...cancelModal, accountHolder: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>à¤¬à¥ˆà¤‚à¤• à¤•à¤¾ à¤¨à¤¾à¤® (Bank Name)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="à¤‰à¤¦à¤¾. SBI / PNB / HDFC"
                        value={cancelModal.bankName || ''}
                        onChange={(e) => setCancelModal({ ...cancelModal, bankName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>à¤–à¤¾à¤¤à¤¾ à¤¸à¤‚à¤–à¥à¤¯à¤¾ (Account No) *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="à¤‰à¤¦à¤¾. 123456789012"
                        value={cancelModal.accountNumber || ''}
                        onChange={(e) => setCancelModal({ ...cancelModal, accountNumber: e.target.value, utr: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>IFSC à¤•à¥‹à¤¡ (IFSC Code) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="à¤‰à¤¦à¤¾. SBIN0001234"
                      value={cancelModal.ifscCode || ''}
                      onChange={(e) => setCancelModal({ ...cancelModal, ifscCode: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">à¤°à¤¦à¥à¤¦à¥€à¤•à¤°à¤£ à¤•à¤¾ à¤•à¤¾à¤°à¤£ (Cancellation Reason) *</label>
                <input
                  type="text"
                  className="form-control"
                  value={cancelModal.cancellationReason}
                  onChange={(e) => setCancelModal({ ...cancelModal, cancellationReason: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setCancelModal(null)}>
                  à¤°à¤¦à¥à¤¦ à¤¨ à¤•à¤°à¥‡à¤‚ (Back)
                </button>
                <button type="submit" className="btn btn-danger" style={{ background: '#DC2626', color: '#fff', fontWeight: 800 }}>
                  âœ“ à¤Ÿà¤¿à¤•à¤Ÿ à¤°à¤¦à¥à¤¦ à¤µ à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¿à¤•à¥à¤µà¥‡à¤¸à¥à¤Ÿ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- OFFICIAL IRCTC ERS TRAVEL TICKET MODAL (EXACT 1-PAGE A4 FORMAT) ----------------- */}
      {ticketModal && (
        <div className="modal-overlay" onClick={() => setTicketModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840, padding: 16, border: '2px solid #0284C7', background: '#F8FAFC' }}>
            
            {/* Top Toolbar (No-Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1.5px solid #BAE6FD', paddingBottom: 10 }}>
              <span className="badge badge-bhakti" style={{ background: '#0284C7', color: '#FFFFFF', borderColor: '#0369A1' }}>
                <Ticket size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> 
                à¤‡à¤²à¥‡à¤•à¥à¤Ÿà¥à¤°à¥‰à¤¨à¤¿à¤• à¤°à¤¿à¤œà¤°à¥à¤µà¥‡à¤¶à¤¨ à¤¸à¥à¤²à¤¿à¤ª (IRCTC ERS Travel Pass Preview)
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => printSlipElement('irctc-ticket-print-area', `IRCTC-Ticket-${ticketModal.bookingId}`)}
                  style={{ background: '#0284C7', borderColor: '#0369A1' }}
                >
                  <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚ (Print A4 ERS)
                </button>
                <a 
                  href={`/api/bookings/${ticketModal.bookingId}/pdf?token=${safeStaffToken}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: '#0284C7', color: '#0284C7' }}
                >
                  <FileText size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡
                </a>
                <button onClick={() => setTicketModal(null)} style={{ background: 'none', border: 'none', color: '#0369A1', fontSize: 24, cursor: 'pointer', fontWeight: 'bold', marginLeft: 8 }}>âœ•</button>
              </div>
            </div>

            {/* Exact IRCTC ERS Ticket Canvas (Identical to Downloaded PDF) */}
            <div id="irctc-ticket-print-area" className="irctc-ticket-wrapper" style={{ position: 'relative' }}>
              
              {/* Header 1: Blue Bar */}
              <div className="irctc-header-blue">
                <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.02em' }}>SHRI MATA VAISHNO DEVI PUBLIC CHARITABLE TRUST</div>
                <div style={{ fontSize: '0.78rem', color: '#BAE6FD', marginTop: 2 }}>YATRA SPECIAL SUPERFAST EXPRESS â€¢ ANNUAL PILGRIMAGE SPECIAL TRAIN</div>
                <div style={{ fontSize: '0.74rem', color: '#FDE047', fontWeight: 700, marginTop: 3 }}>ELECTRONIC RESERVATION SLIP (ERS) â€¢ VALID FOR TRAVEL (1-PAGE OFFICIAL PASS)</div>
              </div>

              {/* Subheader: PNR, Quota, Batch */}
              <div className="irctc-sub-bar">
                <div><span style={{ color: '#0C4A6E', fontWeight: 700 }}>PNR / BOOKING ID:</span> <strong style={{ color: '#DC2626', fontSize: '0.95rem', marginLeft: 4 }}>{ticketModal.bookingId}</strong></div>
                <div><span style={{ color: '#0C4A6E', fontWeight: 700 }}>QUOTA:</span> <strong style={{ color: '#0284C7', marginLeft: 4 }}>PILGRIM TRUST (PT)</strong></div>
                <div><span style={{ color: '#0C4A6E', fontWeight: 700 }}>YATRA BATCH:</span> <strong style={{ color: '#1E293B', marginLeft: 4 }}>{ticketModal.yatraYear || '2026'}</strong></div>
              </div>

              {/* Journey Details Grid */}
              <div className="irctc-grid-box">
                <div className="irctc-grid-row">
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Train Number & Name</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>04201 / MVD YATRA SPECIAL</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Class</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>{ticketModal.travelClass || 'Sleeper'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Coach / Assigned Seats</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284C7' }}>
                      Coach {ticketModal.coachName || 'S1'} {!(projectSettings && projectSettings.hideBerthNumber) && `: Berths [ ${Array.isArray(ticketModal.seatNumber) ? ticketModal.seatNumber.join(', ') : ticketModal.seatNumber} ]`}
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #E2E8F0' }}></div>
                <div className="irctc-grid-row">
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>From Station</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#C2410C' }}>{ticketModal.fromStation || 'New Delhi (NDLS)'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>To Destination</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#15803D' }}>{ticketModal.toStation || 'Shri Mata Vaishno Devi Katra (SVDK)'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Date of Journey</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>{ticketModal.travelDate || 'As Scheduled'}</div>
                  </div>
                </div>
              </div>

              {/* Devotee Contact Bar */}
              <div className="irctc-contact-row">
                <div><span style={{ color: '#475569', fontWeight: 700 }}>Booked By:</span> <strong style={{ color: '#0F172A', marginLeft: 4 }}>{ticketModal.bookedBy || 'Devotee'}</strong></div>
                <div><span style={{ color: '#475569', fontWeight: 700 }}>Mobile:</span> <span style={{ color: '#0F172A', marginLeft: 4 }}>{ticketModal.mobile || 'N/A'}</span></div>
                <div><span style={{ color: '#475569', fontWeight: 700 }}>Aadhaar / ID:</span> <span style={{ color: '#0F172A', marginLeft: 4 }}>{ticketModal.aadhar || 'Verified at Station'}</span></div>
              </div>

              {/* Passenger Roster Table */}
              <div style={{ margin: '8px 14px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0C4A6E', marginBottom: 4 }}>PASSENGER DETAILS</div>
                <div style={{ border: '1px solid #CBD5E1', borderRadius: 4, overflow: 'hidden' }}>
                  <div className="irctc-pax-header">
                    <div>#</div>
                    <div>Passenger Name</div>
                    <div>Age / Gender</div>
                    <div>Booking Status</div>
                    <div>Current Status</div>
                    <div>Coach / {!(projectSettings && projectSettings.hideBerthNumber) ? 'Berth / Type' : 'Type'}</div>
                  </div>
                  {(ticketModal.passengers && ticketModal.passengers.length > 0
                    ? ticketModal.passengers
                    : [{ name: ticketModal.bookedBy, age: '-', gender: '-', aadhar: ticketModal.aadhar, seatAssigned: (Array.isArray(ticketModal.seatNumber) ? ticketModal.seatNumber.join(', ') : ticketModal.seatNumber), berthPreference: 'Berth' }]
                  ).map((p, idx) => {
                    const assignedSeat = p.seatAssigned || p.seatNumber || (Array.isArray(ticketModal.seatNumber) ? ticketModal.seatNumber[idx] : idx + 1);
                    const isCancelled = ticketModal.status === 'Cancelled';
                    const statusText = isCancelled ? 'CANCELLED' : 'CONFIRMED (CNF)';
                    const statusColor = isCancelled ? '#DC2626' : '#16A34A';
                    return (
                      <div key={idx} className="irctc-pax-row">
                        <div style={{ color: '#475569' }}>{idx + 1}</div>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{p.name || 'Passenger'}</div>
                        <div style={{ color: '#475569' }}>{p.age || '-'} / {p.gender || '-'}</div>
                        <div style={{ color: statusColor, fontWeight: 700 }}>{statusText}</div>
                        <div style={{ color: statusColor, fontWeight: 700 }}>{statusText}</div>
                        <div style={{ color: '#0284C7', fontWeight: 700 }}>{ticketModal.coachName || 'S1'} / {!(projectSettings && projectSettings.hideBerthNumber) ? `${assignedSeat} / ${p.berthPreference || 'Berth'}` : (p.berthPreference || 'Berth')}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fare & Anti-Tamper Security QR Grid */}
              <div className="irctc-fare-grid">
                <div className="irctc-fare-table">
                  <div className="irctc-fare-header" style={{ background: '#0F172A', color: '#FFF', padding: '5px 10px', fontSize: '0.74rem', fontWeight: 700 }}>
                    FARE & PAYMENT DETAILS
                  </div>
                  <div style={{ padding: '6px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', padding: '2px 0' }}>
                      <span style={{ color: '#475569' }}>Ticket Fare Amount:</span>
                      <strong>â‚¹ {parseFloat(ticketModal.totalAmount || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', padding: '2px 0' }}>
                      <span style={{ color: '#475569' }}>Trust Discount / Concession:</span>
                      <span>â‚¹ {parseFloat(ticketModal.discount || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', padding: '2px 0', color: '#16A34A' }}>
                      <span>Advance Paid:</span>
                      <strong>â‚¹ {parseFloat(ticketModal.advance || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '3px 0', borderTop: '1px solid #E2E8F0', marginTop: 3 }}>
                      <span style={{ fontWeight: 700 }}>Balance Due at Boarding:</span>
                      <strong style={{ color: ticketModal.remainingAmount > 0 ? '#DC2626' : '#16A34A' }}>
                        â‚¹ {parseFloat(ticketModal.remainingAmount || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ marginTop: 5, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        background: ticketModal.paymentStatus === 'Paid' ? '#16A34A' : (ticketModal.paymentStatus === 'Partial' ? '#EA580C' : '#DC2626'),
                        color: '#FFF',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 12px',
                        borderRadius: 3,
                        width: '100%'
                      }}>
                        PAYMENT: {(ticketModal.paymentStatus || 'UNPAID').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* QR Code & Sec Hash Card */}
                <div className="irctc-qr-card">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`${window.location.origin}/verify-ticket.html?pnr=${ticketModal.bookingId}`)}`}
                    alt="Anti-Fraud Ticket QR"
                    style={{ width: 75, height: 75, margin: '0 auto', display: 'block' }}
                  />
                  <div style={{ fontSize: '0.62rem', color: '#DC2626', fontWeight: 800, marginTop: 4 }}>ANTI-TAMPER SEC HASH:</div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                    MVD-{ticketModal.bookingId.replace(/[^0-9]/g, '').slice(-8) || '2026'}
                  </div>
                </div>
              </div>

              {/* Guidelines Box */}
              <div className="irctc-guidelines">
                <div style={{ fontWeight: 800, color: '#92400E', marginBottom: 3 }}>IMPORTANT PASSENGER INSTRUCTIONS & TRAVEL GUIDELINES:</div>
                <div>1. Carry this Electronic Reservation Slip (ERS) along with original Government ID (Aadhaar / Voter ID / DL) during journey.</div>
                <div>2. Reporting at boarding station is mandatory at least 45 minutes prior to scheduled train departure.</div>
                <div>3. Mandatory RFID Yatra Registration Card must be collected at Katra base before commencing the Mata Vaishno Devi Bhawan trek.</div>
                <div>4. Any remaining balance dues must be cleared with authorized Trust volunteers before boarding.</div>
                <div>5. For medical emergency or coach assistance, contact Trust Helpline: +91 7398959993 or Train Captain.</div>
              </div>

              {/* Signatures & Footer */}
              <div className="irctc-footer-bar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>Helpline: +91 7398959993 â€¢ Support: iammshyam@gmail.com</div>
                  <div>Authorized Signatory, Trust Secretary</div>
                </div>
                <div style={{ color: '#0284C7', fontWeight: 700 }}>Software Developed by ArovenTech (www.aroventech.site | +91 9598023701)</div>
                <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 2 }}>Official Electronic Reservation Slip (ERS) â€¢ Single Page Pass under Trust Railway Boarding Protocol</div>
              </div>

              {/* Watermark if Cancelled */}
              {ticketModal.status === 'Cancelled' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-25deg)',
                  fontSize: '3.5rem',
                  fontWeight: 900,
                  color: 'rgba(239, 68, 68, 0.25)',
                  border: '6px dashed rgba(239, 68, 68, 0.35)',
                  padding: '10px 40px',
                  borderRadius: 12,
                  pointerEvents: 'none',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}>
                  CANCELLED / RADD
                </div>
              )}
            </div>

            {/* Bottom Modal Actions (No-Print) */}
            <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {ticketModal.remainingAmount > 0 && (
                <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={() => openUpiQR(ticketModal.bookingId)}>
                  <Smartphone size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> UPI à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¶à¥‡à¤· à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¤°à¥‡à¤‚
                </button>
              )}
              <button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1, background: '#0284C7', borderColor: '#0369A1' }} 
                onClick={() => printSlipElement('irctc-ticket-print-area', `IRCTC-Ticket-${ticketModal.bookingId}`)}
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤ªà¤°à¥à¤šà¥€ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚ (A4 Print)
              </button>
              <a 
                href={`/api/bookings/${ticketModal.bookingId}/pdf?token=${safeStaffToken}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline btn-sm" 
                style={{ flex: 1, borderColor: '#0284C7', color: '#0284C7' }}
              >
                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ----------------- AUTHENTIC MANDIR PAYMENT RECEIPT MODAL (EXACT A4-HALF FORMAT) ----------------- */}
      {receiptModal && (
        <div className="modal-overlay" onClick={() => setReceiptModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780, padding: 16, border: '2px solid #C2410C', background: '#FFF8F2' }}>
            
            {/* Top Toolbar (No-Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1.5px dashed #FED7AA', paddingBottom: 10 }}>
              <span className="badge badge-bhakti">
                <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> 
                {parseFloat(receiptModal.txn.amount) < 0 || String(receiptModal.txn.type || '').toLowerCase().includes('refund')
                  ? 'à¤°à¤¿à¤«à¤‚à¤¡ à¤°à¤¸à¥€à¤¦ à¤ªà¥‚à¤°à¥à¤µà¤¾à¤µà¤²à¥‹à¤•à¤¨ (A4-Half Refund Advice Preview)'
                  : 'à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤°à¤¸à¥€à¤¦ à¤ªà¥‚à¤°à¥à¤µà¤¾à¤µà¤²à¥‹à¤•à¤¨ (A4-Half Payment Receipt Preview)'}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => printSlipElement('mandir-receipt-print-area', `MVD-Receipt-${receiptModal.txn.id}`)}
                >
                  <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤°à¤¸à¥€à¤¦ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚ (A4-Half Print)
                </button>
                <a 
                  href={`/api/bookings/${receiptModal.booking.bookingId}/receipt/${receiptModal.txn.id}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline btn-sm"
                >
                  <FileText size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡
                </a>
                <button onClick={() => setReceiptModal(null)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 24, cursor: 'pointer', fontWeight: 'bold', marginLeft: 8 }}>âœ•</button>
              </div>
            </div>

            {/* Exact A4-Half Mandir Payment Receipt (Identical to Downloaded PDF) */}
            <div id="mandir-receipt-print-area" className="mandir-receipt-wrapper">
              <div className="mandir-receipt-inner">
                
                {/* Header Banner */}
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <img src="/logo.jpg" alt="MVD Logo" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain', border: '1.5px solid #C2410C', background: '#FFF' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ color: '#C2410C', fontWeight: 800, fontSize: '0.72rem' }}>
                      || OM SARVA MANGAL MANGALYE SHIVE SARVARTHA SADHIKE ||
                    </div>
                    <div style={{ color: '#7C2D12', fontSize: '1.15rem', fontWeight: 900, margin: '1px 0', letterSpacing: '-0.01em' }}>
                      SHRI MATA VAISHNO DEVI PUBLIC CHARITABLE TRUST
                    </div>
                    <div style={{ color: '#9A3412', fontSize: '0.72rem', fontWeight: 600 }}>
                      Mata Vaishno Devi Mandir, Nagla Deena, Bholepur, Fatehgarh, Uttar Pradesh - 209601 | Helpline: +91 7398959993
                    </div>
                  </div>
                </div>

                {/* Official Receipt Ribbon */}
                {(() => {
                  const isRefund = parseFloat(receiptModal.txn.amount) < 0 || String(receiptModal.txn.type || '').toLowerCase().includes('refund');
                  const absAmt = Math.abs(parseFloat(receiptModal.txn.amount) || 0);
                  const seatStr = Array.isArray(receiptModal.booking.seatNumber) && receiptModal.booking.seatNumber.length > 0
                    ? receiptModal.booking.seatNumber.join(', ')
                    : (receiptModal.booking.seatNumber || (isRefund ? 'Released' : 'Allocated'));
                  
                  return (
                    <>
                      <div style={{
                        background: isRefund ? '#B91C1C' : '#EA580C',
                        color: '#FFFFFF',
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        padding: '5px 8px',
                        borderRadius: 4,
                        marginBottom: 8,
                        letterSpacing: '0.02em'
                      }}>
                        {isRefund 
                          ? 'OFFICIAL REFUND ADVICE & RECEIPT / RIFAND BHUGTAN RASEED (A4-HALF SHEET)' 
                          : 'OFFICIAL PAYMENT RECEIPT / BHUGTAN RASEED (A4-HALF SHEET)'}
                      </div>

                      {/* Meta Grid */}
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4, padding: '6px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.75rem', marginBottom: 8 }}>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>{isRefund ? 'Refund Voucher No:' : 'Receipt No:'}</span>
                          <strong style={{ color: '#DC2626', fontSize: '0.85rem' }}>{receiptModal.txn.id}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Booking PNR:</span>
                          <strong style={{ color: '#C2410C', fontSize: '0.85rem' }}>{receiptModal.booking.bookingId}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Date & Time:</span>
                          <span style={{ color: '#1F2937', fontWeight: 600 }}>{new Date(receiptModal.txn.date || Date.now()).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Yatra Special:</span>
                          <span style={{ color: '#1F2937' }}>Special Train {receiptModal.booking.yatraYear || 2026}</span>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Class & Coach:</span>
                          <span style={{ color: '#1F2937' }}>{receiptModal.booking.travelClass || 'Sleeper'} (Coach {receiptModal.booking.coachName || 'S1'})</span>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Seat No(s):</span>
                          <strong style={{ color: '#1E40AF' }}>{seatStr}</strong>
                        </div>
                      </div>

                      {/* Devotee Info */}
                      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 4, padding: '6px 10px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, fontSize: '0.75rem', marginBottom: 8 }}>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700 }}>Beneficiary / Devotee: </span>
                          <strong style={{ color: '#111827', fontSize: '0.85rem' }}>Shri / Smt. {receiptModal.booking.bookedBy}</strong>
                          <div style={{ color: '#4B5563', marginTop: 2 }}>
                            Aadhaar / ID: <strong>{receiptModal.booking.aadhar || 'Verified'}</strong> | Mobile: <strong>{receiptModal.booking.mobile || 'N/A'}</strong>
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Journey Route:</span>
                          <span style={{ color: '#1F2937', fontWeight: 600 }}>{receiptModal.booking.fromStation || 'New Delhi (NDLS)'} &rarr; Katra (SVDK)</span>
                        </div>
                      </div>

                      {/* Amount Received / Refund Card */}
                      <div style={{
                        background: isRefund ? '#FEF2F2' : '#ECFDF5',
                        border: `1px solid ${isRefund ? '#FECACA' : '#A7F3D0'}`,
                        borderRadius: 4,
                        padding: '8px 12px',
                        marginBottom: 8
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.74rem', color: isRefund ? '#991B1B' : '#065F46', fontWeight: 800, textTransform: 'uppercase' }}>
                              {isRefund ? 'REFUND PROCESSED (REFUND DEYA RASHI):' : 'AMOUNT RECEIVED (PRAPT RASHI):'}
                            </span>
                            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: isRefund ? '#DC2626' : '#047857' }}>
                              Rs. {absAmt.toFixed(2)} {isRefund && <span style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: 700 }}>(Credit in 5-7 Working Days)</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              background: isRefund ? '#DC2626' : '#059669',
                              color: '#FFF',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 3
                            }}>
                              {isRefund ? 'âœ“ REFUND INITIATED' : 'âœ“ PAYMENT RECEIVED'}
                            </span>
                          </div>
                        </div>
                        <div style={{ borderTop: `1px solid ${isRefund ? '#FECACA' : '#A7F3D0'}`, marginTop: 6, paddingTop: 4, fontSize: '0.76rem', color: isRefund ? '#991B1B' : '#065F46' }}>
                          <strong>Amount In Words:</strong> <em>{numberToWords(absAmt)}</em>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#374151', marginTop: 3 }}>
                          {isRefund 
                            ? `Refund Channel: ${receiptModal.txn.method || 'Admin Bank/UPI Transfer (5-7 Days)'} ${receiptModal.txn.utr ? `(Ref: ${receiptModal.txn.utr})` : ''} | Processed by Trust Admin directly to Bank/UPI`
                            : `Payment Mode: ${receiptModal.txn.method || 'Cash'} ${receiptModal.txn.utr ? `(UTR: ${receiptModal.txn.utr})` : ''} | Type: Advance/Balance Payment | ID: ${receiptModal.txn.id}`}
                        </div>
                      </div>

                      {/* Account Summary Table */}
                      <div style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 4, padding: '6px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '0.74rem', marginBottom: 8 }}>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Total Journey Fare</span>
                          <strong style={{ color: '#111827', fontSize: '0.82rem' }}>Rs. {parseFloat(receiptModal.booking.totalAmount || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>{isRefund ? 'Advance Refunded' : 'Total Paid Till Date'}</span>
                          <strong style={{ color: isRefund ? '#DC2626' : '#059669', fontSize: '0.82rem' }}>
                            Rs. {parseFloat(isRefund ? absAmt : (receiptModal.booking.advance || 0)).toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Ticket Status</span>
                          <strong style={{ color: isRefund ? '#DC2626' : ((receiptModal.booking.remainingAmount || 0) > 0 ? '#EA580C' : '#059669'), fontSize: '0.82rem' }}>
                            {isRefund 
                              ? 'CANCELLED & REFUND INITIATED' 
                              : ((receiptModal.booking.remainingAmount || 0) > 0 ? `Rs. ${parseFloat(receiptModal.booking.remainingAmount).toFixed(2)} (PENDING)` : 'PAID IN FULL')}
                          </strong>
                        </div>
                      </div>

                      {/* Cashier & Authorization Signatory Stamp */}
                      <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.72rem' }}>
                        <div>
                          <div style={{ color: '#4B5563', fontWeight: 700 }}>{isRefund ? 'Cancelled By Staff:' : 'Cashier / Counter Staff:'}</div>
                          <strong style={{ color: '#1F2937', fontSize: '0.82rem' }}>{receiptModal.txn.cashierName || 'Trust Authorized Staff'}</strong>
                          <div style={{ color: '#9CA3AF', fontSize: '0.62rem' }}>System Verified & Logged</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ border: '1.5px solid #C2410C', borderRadius: '50%', width: 50, height: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#C2410C', fontSize: '0.55rem', fontWeight: 900, transform: 'rotate(-5deg)', margin: '0 auto 2px', background: '#FFF7ED' }}>
                            <span> MVD</span>
                            <span>SEAL</span>
                            <span>2026</span>
                          </div>
                          <div style={{ fontSize: '0.6rem', color: '#7C2D12', fontWeight: 700 }}>Official Digital Stamp</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#4B5563', fontWeight: 700 }}>Authorized Signatory:</div>
                          <strong style={{ color: '#7C2D12', fontSize: '0.8rem' }}>For Shri Mata Vaishno Devi Trust</strong>
                          <div style={{ color: '#9CA3AF', fontSize: '0.62rem' }}>Official Computer Generated Receipt</div>
                        </div>
                      </div>

                      {/* Bottom Blessing */}
                      <div style={{ background: '#FEF3C7', borderRadius: 3, padding: '3px 6px', textAlign: 'center', color: '#C2410C', fontSize: '0.7rem', fontWeight: 800, marginTop: 6 }}>
                        JAI MATA DI - SHRI MATA VAISHNO DEVI JI BLESSINGS & BEST WISHES
                      </div>

                      {/* Branding Footer */}
                      <div style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.62rem', marginTop: 4 }}>
                        Software Developed by: ArovenTech (www.aroventech.site | +91 9598023701) | Support: iammshyam@gmail.com
                      </div>
                    </>
                  );
                })()}

              </div>
            </div>

            {/* Bottom Toolbar Actions (No-Print) */}
            <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1 }} 
                onClick={() => printSlipElement('mandir-receipt-print-area', `MVD-Receipt-${receiptModal.txn.id}`)}
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> à¤°à¤¸à¥€à¤¦ à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ à¤•à¤°à¥‡à¤‚ (A4-Half Print)
              </button>
              <a 
                href={`/api/bookings/${receiptModal.booking.bookingId}/receipt/${receiptModal.txn.id}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline btn-sm" 
                style={{ flex: 1 }}
              >
                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ----------------- OFFICIAL YATRA POSTER FULLSCREEN MODAL ----------------- */}
      {posterModal && (
        <div className="modal-overlay" onClick={() => setPosterModal(false)} style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', padding: 20, border: '3px solid #F97316', textAlign: 'center', background: '#FFFDF9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1.5px solid #FED7AA', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-bhakti">ðŸš© à¤…à¤§à¤¿à¤•à¥ƒà¤¤ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥‹à¤¸à¥à¤Ÿà¤°</span>
                <strong style={{ color: '#9A3412', fontSize: '1.15rem' }}>à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤¯à¤¾à¤¤à¥à¤°à¤¾ {projectSettings.activeYatraYear || 2026}</strong>
              </div>
              <button
                onClick={() => setPosterModal(false)}
                style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer', fontWeight: 'bold' }}
              >
                âœ•
              </button>
            </div>

            <div style={{ background: '#FFF8F2', borderRadius: 10, padding: 6, marginBottom: 14, border: '1.5px solid #FED7AA' }}>
              <img
                src="/poster.png"
                alt="à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤µà¤¾à¤°à¥à¤·à¤¿à¤• à¤µà¤¿à¤¶à¥‡à¤· à¤¤à¥€à¤°à¥à¤¥ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤ªà¥‹à¤¸à¥à¤Ÿà¤° 2026"
                style={{ width: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 6, display: 'block', margin: '0 auto' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="/poster.png"
                download="Vaishno_Devi_Yatra_Poster_2026.png"
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.92rem' }}
              >
                <Download size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> à¤ªà¥‹à¤¸à¥à¤Ÿà¤° à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚ (Save High-Res Image)
              </a>
              <a
                href="/poster.png"
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ padding: '10px 20px', fontSize: '0.92rem', borderColor: '#F97316', color: '#C2410C' }}
              >
                <Eye size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} /> à¤¨à¤ à¤Ÿà¥ˆà¤¬ à¤®à¥‡à¤‚ à¤–à¥‹à¤²à¥‡à¤‚
              </a>
              <button
                className="btn btn-outline"
                onClick={() => setPosterModal(false)}
                style={{ padding: '10px 20px', fontSize: '0.92rem' }}
              >
                à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- UPI MODAL ----------------- */}
      {upiQrModal && (
        <div className="modal-overlay" onClick={() => { setUpiQrModal(null); setUtrInput(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', border: '2px solid #F97316' }}>
            <button onClick={() => { setUpiQrModal(null); setUtrInput(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>âœ•</button>
            <h3 style={{ color: '#9A3412', marginBottom: 6, fontWeight: 800 }}>UPI à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤­à¥à¤—à¤¤à¤¾à¤¨</h3>
            <div style={{ fontSize: '0.88rem', color: '#7C2D12', fontWeight: 600 }}>à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ</div>

            <img src={upiQrModal.qrDataUrl} alt="UPI QR" style={{ width: 220, height: 220, margin: '16px auto', borderRadius: 12, background: '#fff', padding: 8, border: '2px solid #FED7AA' }} />
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#047857' }}>â‚¹ {upiQrModal.amount.toFixed(2)}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>GPay, PhonePe, Paytm à¤…à¤¥à¤µà¤¾ BHIM à¤¸à¥‡ à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚</div>
            <div style={{ fontSize: '0.82rem', color: '#C2410C', marginTop: 10, fontWeight: 700 }}>UPI ID: {upiQrModal.upiId}</div>

            {/* UTR Submission Form */}
            <form onSubmit={submitUtr} style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px dashed #FED7AA', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#7C2D12', fontWeight: 700, marginBottom: 6 }}>
                à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¥‡ à¤¬à¤¾à¤¦ 12-à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¤¾ UTR (Ref) à¤¨à¤‚à¤¬à¤° à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. 412345678901"
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem', borderColor: '#FDBA74' }}
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  maxLength={12}
                  required
                />
                <button type="submit" className="btn btn-gold" style={{ padding: '8px 16px' }}>à¤¸à¤¬à¤®à¤¿à¤Ÿ</button>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#B45309', marginTop: 6, lineHeight: 1.3 }}>
                * UTR à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤•à¤°à¤¨à¥‡ à¤•à¥‡ à¤¬à¤¾à¤¦ à¤à¤¡à¤®à¤¿à¤¨ à¤†à¤ªà¤•à¥‡ à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¥€ à¤ªà¥à¤·à¥à¤Ÿà¤¿ à¤•à¤°à¥‡à¤—à¤¾à¥¤
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- BULK MODAL ----------------- */}
      {bulkModalOpen && (
        <div className="modal-overlay" onClick={() => setBulkModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, border: '2px solid #F97316' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤à¤•à¥à¤¸à¥‡à¤² à¤¬à¤²à¥à¤• à¤¬à¥à¤•à¤¿à¤‚à¤— à¤…à¤ªà¤²à¥‹à¤¡</h3>
              <button onClick={() => setBulkModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>âœ•</button>
            </div>

            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label className="form-label">à¤²à¤•à¥à¤·à¤¿à¤¤ à¤¯à¤¾à¤¤à¥à¤°à¤¾ à¤µà¤°à¥à¤·:</label>
                <select className="form-control" value={bulkYear} onChange={(e) => setBulkYear(e.target.value)}>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2025">2025</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">à¤à¤•à¥à¤¸à¥‡à¤² à¤«à¤¾à¤‡à¤² (.xlsx) à¤šà¥à¤¨à¥‡à¤‚:</label>
                <input type="file" className="form-control" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files[0])} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>à¤ªà¥à¤°à¤¾à¤°à¥‚à¤ª à¤¨à¤®à¥‚à¤¨à¤¾ à¤šà¤¾à¤¹à¤¿à¤?</span>
                <a href="/api/admin/sample-template?token=mvd_admin_token" className="btn btn-gold btn-sm">
                  à¤¨à¤®à¥‚à¤¨à¤¾ à¤Ÿà¥‡à¤®à¥à¤ªà¤²à¥‡à¤Ÿ à¤¡à¤¾à¤‰à¤¨à¤²à¥‹à¤¡ à¤•à¤°à¥‡à¤‚
                </a>
              </div>

              {bulkMessage && <div style={{ color: '#047857', fontSize: '0.9rem', margin: '10px 0', fontWeight: 700 }}>{bulkMessage}</div>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                à¤¬à¥à¤•à¤¿à¤‚à¤—à¥à¤¸ à¤ªà¥à¤°à¥‹à¤¸à¥‡à¤¸ à¤•à¤°à¥‡à¤‚
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- PAYMENT EDIT MODAL (ADMIN) ----------------- */}
      {paymentEditModal && (
        <div className="modal-overlay" onClick={() => setPaymentEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450, border: '2px solid #F97316' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#9A3412', fontWeight: 800 }}>à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤ à¤•à¤°à¥‡à¤‚ (Edit Payment)</h3>
              <button onClick={() => setPaymentEditModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>âœ•</button>
            </div>
            
            <div style={{ background: '#FFF8F2', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px dashed #FDBA74' }}>
              <strong>Booking ID:</strong> <span style={{ color: '#C2410C' }}>{paymentEditData.bookingId}</span><br />
              <strong>Total Amount:</strong> â‚¹ {paymentEditData.totalAmount}
            </div>

            <form onSubmit={handlePaymentEditSubmit}>
              <div className="form-group">
                <label className="form-label">à¤­à¥à¤—à¤¤à¤¾à¤¨ à¤•à¤¾ à¤¤à¤°à¥€à¤•à¤¾ (Payment Mode)</label>
                <select 
                  className="form-control" 
                  value={paymentEditData.paymentMode} 
                  onChange={e => setPaymentEditData({...paymentEditData, paymentMode: e.target.value})}
                >
                  <option value="Cash">à¤¨à¤•à¤¦ (Cash)</option>
                  <option value="UPI">UPI / à¤‘à¤¨à¤²à¤¾à¤‡à¤¨</option>
                  <option value="Both">à¤¨à¤•à¤¦ + UPI</option>
                  <option value="Free">à¤¨à¤¿à¤ƒà¤¶à¥à¤²à¥à¤• (Trust Free)</option>
                </select>
              </div>

              {(paymentEditData.paymentMode === 'UPI' || paymentEditData.paymentMode === 'Both') && (
                <div className="form-group">
                  <label className="form-label">UPI Transaction ID (à¤°à¥‡à¤«à¤°à¥‡à¤‚à¤¸ à¤¨à¤‚à¤¬à¤°)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="à¤‰à¤¦à¤¾. 312345678901"
                    value={paymentEditData.upiTransactionId} 
                    onChange={e => setPaymentEditData({...paymentEditData, upiTransactionId: e.target.value})}
                  />
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤œà¤®à¤¾ à¤°à¤¾à¤¶à¤¿ (Paid / Advance) â‚¹</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={paymentEditData.advance} 
                    onChange={e => setPaymentEditData({...paymentEditData, advance: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">à¤›à¥‚à¤Ÿ (Discount) â‚¹</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={paymentEditData.discount} 
                    onChange={e => setPaymentEditData({...paymentEditData, discount: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}>
                à¤µà¤¿à¤µà¤°à¤£ à¤¸à¥‡à¤µ à¤•à¤°à¥‡à¤‚
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- ADD NEW STAFF MODAL ----------------- */}
      {newStaffModal && (
        <div className="modal-overlay" onClick={() => setNewStaffModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540, border: '2px solid #F97316' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#9A3412', fontWeight: 800 }}>+ à¤¨à¤¯à¤¾ à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ / à¤Ÿà¥€à¤Ÿà¥€ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ (Add Staff)</h3>
              <button onClick={() => setNewStaffModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>âœ•</button>
            </div>

            <form onSubmit={handleAddStaffSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="à¤‰à¤¦à¤¾. à¤°à¤¾à¤œà¥‡à¤¶ à¤•à¥à¤®à¤¾à¤° à¤¶à¤°à¥à¤®à¤¾"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">à¤œà¥€à¤®à¥‡à¤² à¤†à¤ˆà¤¡à¥€ / Email ID (Google à¤²à¥‰à¤—à¤¿à¤¨ à¤¹à¥‡à¤¤à¥) *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="à¤‰à¤¦à¤¾. rajesh.tte@gmail.com"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">

                <div className="form-group">
                  <label className="form-label">à¤²à¥‰à¤—à¤¿à¤¨ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤ªà¤¦ / à¤°à¥‹à¤² (Role) *</label>
                  <select
                    className="form-control"
                    value={newStaffForm.role}
                    onChange={(e) => {
                      const selectedRole = e.target.value;
                      let dept = 'Trust Executive (à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨)';
                      let coaches = [];
                      if (selectedRole === 'TTE') {
                        dept = 'Running Staff (à¤Ÿà¥à¤°à¥‡à¤¨ à¤¸à¤‚à¤šà¤¾à¤²à¤¨)';
                        coaches = ['S1'];
                      } else if (selectedRole === 'BookingClerk') {
                        dept = 'Booking Counter (à¤Ÿà¤¿à¤•à¤Ÿ à¤•à¤¾à¤‰à¤‚à¤Ÿà¤°)';
                      } else if (selectedRole === 'FinanceOfficer') {
                        dept = 'Accounts & Audit (à¤²à¥‡à¤–à¤¾ à¤µ à¤•à¥‹à¤·à¤¾à¤—à¤¾à¤°)';
                      } else if (selectedRole === 'StationMaster') {
                        dept = 'Station Management (à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¸à¤®à¤¨à¥à¤µà¤¯à¤¨)';
                      }
                      setNewStaffForm({
                        ...newStaffForm,
                        role: selectedRole,
                        department: dept,
                        assignedCoaches: coaches,
                        assignedCoach: coaches.join(',')
                      });
                    }}
                  >
                    {(staffRoles && typeof staffRoles === 'object' && !Array.isArray(staffRoles) && Object.keys(staffRoles).length > 0
                      ? Object.entries(staffRoles).map(([k, v]) => ({ id: k, name: v?.name || k }))
                      : Array.isArray(staffRoles) && staffRoles.length > 0
                        ? staffRoles
                        : [
                            { id: 'SuperAdmin', name: 'à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤®à¥à¤–à¥à¤¯ à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾à¤ªà¤• (Super Admin)' },
                            { id: 'TTE', name: 'à¤šà¤² à¤Ÿà¤¿à¤•à¤Ÿ à¤ªà¤°à¥€à¤•à¥à¤·à¤• (TTE / On-Train Officer)' },
                            { id: 'BookingClerk', name: 'à¤•à¤¾à¤‰à¤‚à¤Ÿà¤° à¤†à¤°à¤•à¥à¤·à¤£ à¤²à¤¿à¤ªik (Booking Clerk)' },
                            { id: 'FinanceOfficer', name: 'à¤²à¥‡à¤–à¤¾ à¤µ à¤•à¥‹à¤·à¤¾à¤§à¥à¤¯à¤•à¥à¤· à¤…à¤§à¤¿à¤•à¤¾à¤°à¥€ (Finance Officer)' },
                            { id: 'StationMaster', name: 'à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¸à¤®à¤¨à¥à¤µà¤¯à¤• (Station Coordinator)' }
                          ]
                    ).map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">à¤µà¤¿à¤­à¤¾à¤— (Department)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newStaffForm.department}
                    readOnly
                    style={{ background: '#FFF8F2', color: '#9A3412', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤®à¥‹à¤¬à¤¾à¤‡à¤² à¤¨à¤‚à¤¬à¤° *</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="10 à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¤¾ à¤®à¥‹à¤¬à¤¾à¤‡à¤²"
                    value={newStaffForm.mobile}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, mobile: e.target.value })}
                    required
                  />
                </div>
                {newStaffForm.role === 'TTE' && (
                  <div className="form-group">
                    <label className="form-label">à¤†à¤µà¤‚à¤Ÿà¤¿à¤¤ à¤•à¥‹à¤š (TTE à¤•à¥‡à¤µà¤², à¤‰à¤¦à¤¾. S1, S2) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="à¤‰à¤¦à¤¾. S1, S2, S3"
                      value={newStaffForm.assignedCoach || (newStaffForm.assignedCoaches ? newStaffForm.assignedCoaches.join(', ') : 'S1')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewStaffForm({
                          ...newStaffForm,
                          assignedCoach: val,
                          assignedCoaches: val.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
                        });
                      }}
                      required
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setNewStaffModal(false)}>
                  à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤¸à¤¹à¥‡à¤œà¥‡à¤‚ (Save Staff)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- ADD NEW COACH MODAL (ADMIN) ----------------- */}
      {newCoachModal && (
        <div className="modal-overlay" onClick={() => setNewCoachModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, border: '2px solid #F97316' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Train size={22} color="#C2410C" />
                <h3 style={{ color: '#9A3412', fontWeight: 800, margin: 0 }}>+ à¤¨à¤ˆ à¤¬à¥‹à¤—à¥€ / à¤•à¥‹à¤š à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ (Add New Bogie)</h3>
              </div>
              <button onClick={() => setNewCoachModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>âœ•</button>
            </div>

            <form onSubmit={handleCreateCoach}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤¬à¥‹à¤—à¥€ à¤•à¥‹à¤¡ (Coach Code) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="à¤‰à¤¦à¤¾. S7, B4, A2, PC"
                    value={newCoachForm.coachCode}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, coachCode: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">à¤¬à¥‹à¤—à¥€ à¤•à¤¾ à¤¨à¤¾à¤® (Coach Name) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="à¤‰à¤¦à¤¾. Sleeper Coach S-7"
                    value={newCoachForm.coachName}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, coachName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤¶à¥à¤°à¥‡à¤£à¥€ (Coach Class) *</label>
                  <select
                    className="form-control"
                    value={newCoachForm.coachClass}
                    onChange={(e) => {
                      const cl = e.target.value;
                      const cap = cl === 'Sleeper' ? 72 : cl === '3 AC' ? 64 : cl === '2 AC' ? 48 : cl === 'General' ? 80 : 0;
                      const fare = cl === 'Sleeper' ? (projectSettings.fareSleeper || 3000) : (cl === '3 AC' || cl === '2 AC') ? (projectSettings.fareAC || 4000) : cl === 'General' ? (projectSettings.fareGeneral || 2000) : 0;
                      setNewCoachForm({
                        ...newCoachForm,
                        coachClass: cl,
                        capacity: cap,
                        baseFare: fare,
                        isBookable: cl !== 'Guard / SLR' && cl !== 'Pantry'
                      });
                    }}
                  >
                    <option value="Sleeper">Sleeper (à¤¦à¥à¤µà¤¿à¤¤à¥€à¤¯ à¤¶à¤¯à¤¨à¤¯à¤¾à¤¨ - SL)</option>
                    <option value="3 AC">3 AC (à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤¥à¥à¤°à¥€ à¤Ÿà¤¿à¤¯à¤° - 3A)</option>
                    <option value="2 AC">2 AC (à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤Ÿà¥‚ à¤Ÿà¤¿à¤¯à¤° - 2A)</option>
                    <option value="General">General / Second Seating (GS)</option>
                    <option value="Pantry">Pantry Car (à¤°à¤¸à¥‹à¤ˆ à¤¯à¤¾à¤¨ - PC)</option>
                    <option value="Guard / SLR">Guard / Luggage Van (SLR)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">à¤°à¥‡à¤• à¤•à¥à¤°à¤® à¤¸à¤‚à¤–à¥à¤¯à¤¾ (Position Sequence) *</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="form-control"
                    value={newCoachForm.positionSequence}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, positionSequence: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤•à¥à¤² à¤¬à¤°à¥à¤¥ à¤•à¥à¤·à¤®à¤¤à¤¾ (Total Seats) *</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className="form-control"
                    value={newCoachForm.capacity}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, capacity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">à¤¬à¥‡à¤¸ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ à¤ªà¥à¤°à¤¤à¤¿ à¤¸à¥€à¤Ÿ (Base Fare â‚¹)</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={newCoachForm.baseFare}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, baseFare: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (Platform Placement)</label>
                <select
                  className="form-control"
                  value={newCoachForm.platformPlacement}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, platformPlacement: e.target.value })}
                >
                  <option value="Front of Platform">Front of Platform (à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤•à¥‡ à¤†à¤—à¥‡/à¤‡à¤‚à¤œà¤¨ à¤›à¥‹à¤° à¤ªà¤°)</option>
                  <option value="Center of Platform">Center of Platform (à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤•à¥‡ à¤®à¤§à¥à¤¯ à¤®à¥‡à¤‚)</option>
                  <option value="Rear of Platform">Rear of Platform (à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤•à¥‡ à¤ªà¤¿à¤›à¤²à¥‡ à¤›à¥‹à¤° à¤ªà¤°)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¤¿à¤ªà¥à¤ªà¤£à¥€ / à¤¨à¥‹à¤Ÿà¥à¤¸ (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="à¤‰à¤¦à¤¾. à¤…à¤¤à¤¿à¤°à¤¿à¤•à¥à¤¤ à¤¸à¥à¤ªà¥‡à¤¶à¤² à¤¬à¥‹à¤—à¥€, à¤†à¤ªà¤¾à¤¤à¤•à¤¾à¤²à¥€à¤¨ à¤•à¥‹à¤Ÿà¤¾ à¤†à¤¦à¤¿"
                  value={newCoachForm.notes}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, notes: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF8F2', padding: '10px 12px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                <input
                  type="checkbox"
                  id="newCoachBookable"
                  checked={newCoachForm.isBookable}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, isBookable: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#EA580C' }}
                />
                <label htmlFor="newCoachBookable" style={{ margin: 0, fontWeight: 700, color: '#7C2D12', fontSize: '0.88rem', cursor: 'pointer' }}>
                  à¤¯à¤¹ à¤¬à¥‹à¤—à¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤†à¤°à¤•à¥à¤·à¤£ / à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¹à¥‡à¤¤à¥ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆ (Active for Booking)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setNewCoachModal(false)}>
                  à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  à¤¬à¥‹à¤—à¥€ à¤œà¥‹à¤¡à¤¼à¥‡à¤‚ (Save Coach)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- EDIT COACH MODAL (ADMIN) ----------------- */}
      {editCoachModal && (
        <div className="modal-overlay" onClick={() => setEditCoachModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, border: '2px solid #F97316' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit size={22} color="#C2410C" />
                <h3 style={{ color: '#9A3412', fontWeight: 800, margin: 0 }}>à¤¬à¥‹à¤—à¥€ à¤µà¤¿à¤µà¤°à¤£ à¤¸à¤‚à¤¶à¥‹à¤§à¤¿à¤¤ à¤•à¤°à¥‡à¤‚ (Edit Bogie #{editCoachForm.coachCode})</h3>
              </div>
              <button onClick={() => setEditCoachModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>âœ•</button>
            </div>

            <form onSubmit={handleUpdateCoach}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤¬à¥‹à¤—à¥€ à¤•à¥‹à¤¡ (Coach Code) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editCoachForm.coachCode}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, coachCode: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">à¤¬à¥‹à¤—à¥€ à¤•à¤¾ à¤¨à¤¾à¤® (Coach Name) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editCoachForm.coachName}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, coachName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤¶à¥à¤°à¥‡à¤£à¥€ (Coach Class) *</label>
                  <select
                    className="form-control"
                    value={editCoachForm.coachClass}
                    onChange={(e) => {
                      const cl = e.target.value;
                      const cap = cl === 'Sleeper' ? 72 : cl === '3 AC' ? 64 : cl === '2 AC' ? 48 : cl === 'General' ? 80 : 0;
                      const fare = cl === 'Sleeper' ? (projectSettings.fareSleeper || 3000) : (cl === '3 AC' || cl === '2 AC') ? (projectSettings.fareAC || 4000) : cl === 'General' ? (projectSettings.fareGeneral || 2000) : 0;
                      setEditCoachForm({ 
                        ...editCoachForm, 
                        coachClass: cl,
                        capacity: cap,
                        baseFare: fare
                      });
                    }}
                  >
                    <option value="Sleeper">Sleeper (à¤¦à¥à¤µà¤¿à¤¤à¥€à¤¯ à¤¶à¤¯à¤¨à¤¯à¤¾à¤¨ - SL)</option>
                    <option value="3 AC">3 AC (à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤¥à¥à¤°à¥€ à¤Ÿà¤¿à¤¯à¤° - 3A)</option>
                    <option value="2 AC">2 AC (à¤µà¤¾à¤¤à¤¾à¤¨à¥à¤•à¥‚à¤²à¤¿à¤¤ à¤Ÿà¥‚ à¤Ÿà¤¿à¤¯à¤° - 2A)</option>
                    <option value="General">General / Second Seating (GS)</option>
                    <option value="Pantry">Pantry Car (à¤°à¤¸à¥‹à¤ˆ à¤¯à¤¾à¤¨ - PC)</option>
                    <option value="Guard / SLR">Guard / Luggage Van (SLR)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">à¤°à¥‡à¤• à¤•à¥à¤°à¤® à¤¸à¤‚à¤–à¥à¤¯à¤¾ (Position Sequence) *</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="form-control"
                    value={editCoachForm.positionSequence}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, positionSequence: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">à¤•à¥à¤² à¤¸à¥€à¤Ÿà¥‡à¤‚ (Capacity) *</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    className="form-control"
                    value={editCoachForm.capacity}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, capacity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">à¤¬à¥‡à¤¸ à¤•à¤¿à¤°à¤¾à¤¯à¤¾ (Base Fare â‚¹)</label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={editCoachForm.baseFare}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, baseFare: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (Platform Placement)</label>
                <select
                  className="form-control"
                  value={editCoachForm.platformPlacement}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, platformPlacement: e.target.value })}
                >
                  <option value="Front of Platform">Front of Platform (à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤•à¥‡ à¤†à¤—à¥‡/à¤‡à¤‚à¤œà¤¨ à¤›à¥‹à¤° à¤ªà¤°)</option>
                  <option value="Center of Platform">Center of Platform (à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤•à¥‡ à¤®à¤§à¥à¤¯ à¤®à¥‡à¤‚)</option>
                  <option value="Rear of Platform">Rear of Platform (à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤•à¥‡ à¤ªà¤¿à¤›à¤²à¥‡ à¤›à¥‹à¤° à¤ªà¤°)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">à¤µà¤¿à¤¶à¥‡à¤· à¤Ÿà¤¿à¤ªà¥à¤ªà¤£à¥€ / à¤¨à¥‹à¤Ÿà¥à¤¸</label>
                <input
                  type="text"
                  className="form-control"
                  value={editCoachForm.notes || ''}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, notes: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF8F2', padding: '10px 12px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                <input
                  type="checkbox"
                  id="editCoachBookable"
                  checked={editCoachForm.isBookable}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, isBookable: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#EA580C' }}
                />
                <label htmlFor="editCoachBookable" style={{ margin: 0, fontWeight: 700, color: '#7C2D12', fontSize: '0.88rem', cursor: 'pointer' }}>
                  à¤¯à¤¹ à¤¬à¥‹à¤—à¥€ à¤Ÿà¤¿à¤•à¤Ÿ à¤†à¤°à¤•à¥à¤·à¤£ / à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¹à¥‡à¤¤à¥ à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆ (Active for Booking)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditCoachModal(false)}>
                  à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  à¤ªà¤°à¤¿à¤µà¤°à¥à¤¤à¤¨ à¤¸à¤¹à¥‡à¤œà¥‡à¤‚ (Update Coach)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT UTR & VERIFICATION MODAL */}
      {editUtrModal && (
        <div className="modal-overlay" onClick={() => setEditUtrModal(null)}>
          <div className="glass-card modal-card" style={{ maxWidth: 480, border: '2.5px solid #F97316', background: '#FFFFFF', padding: 22 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #FED7AA', paddingBottom: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={20} color="#C2410C" />
                <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.15rem', fontWeight: 800 }}>
                  UTR à¤¨à¤‚à¤¬à¤° à¤à¤µà¤‚ à¤¬à¥ˆà¤‚à¤• à¤®à¤¿à¤²à¤¾à¤¨ à¤¸à¥à¤¥à¤¿à¤¤à¤¿
                </h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setEditUtrModal(null)}>âœ•</button>
            </div>

            <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 16, fontSize: '0.85rem' }}>
              <div><strong>PNR à¤•à¥à¤°à¤®à¤¾à¤‚à¤•:</strong> <span style={{ color: '#C2410C', fontWeight: 800 }}>{editUtrModal.txn?.pnr}</span></div>
              <div style={{ marginTop: 2 }}><strong>à¤¶à¥à¤°à¤¦à¥à¤§à¤¾à¤²à¥:</strong> {editUtrModal.txn?.devoteeName} ({editUtrModal.txn?.mobile})</div>
              <div style={{ marginTop: 2 }}>
                <strong>à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤°à¤¾à¤¶à¤¿:</strong> <span style={{ color: '#047857', fontWeight: 900, fontSize: '1.05rem' }}>â‚¹ {Number(editUtrModal.txn?.amount || 0).toLocaleString()}</span> via {editUtrModal.txn?.method || 'UPI'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: 4 }}>
                à¤¤à¤¾à¤°à¥€à¤–: {new Date(editUtrModal.txn?.date).toLocaleString('hi-IN')}
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleVerifyUtrAction(
                editUtrModal.txn?.bookingId,
                editUtrModal.txn?.id,
                editUtrModal.status,
                editUtrModal.newUtr,
                editUtrModal.remarks
              );
            }}>
              <div className="form-group">
                <label className="form-label">12-à¤…à¤‚à¤•à¥‹à¤‚ à¤•à¤¾ UPI UTR / à¤¬à¥ˆà¤‚à¤• à¤°à¥‡à¤«à¤°à¥‡à¤‚à¤¸ à¤•à¥à¤°à¤®à¤¾à¤‚à¤• <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="à¤‰à¤¦à¤¾. 425689123456"
                  value={editUtrModal.newUtr}
                  onChange={e => setEditUtrModal({ ...editUtrModal, newUtr: e.target.value.trim() })}
                  style={{ letterSpacing: '1px', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (Verification Status)</label>
                <select
                  className="form-control"
                  value={editUtrModal.status}
                  onChange={e => setEditUtrModal({ ...editUtrModal, status: e.target.value })}
                >
                  <option value="Pending">à¤®à¤¿à¤²à¤¾à¤¨ à¤²à¤‚à¤¬à¤¿à¤¤ (Pending Match)</option>
                  <option value="Verified">âœ“ à¤¬à¥ˆà¤‚à¤• à¤¸à¥‡ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¿à¤¤ (Verified / Approved)</option>
                  <option value="Rejected">âœ• à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ (Rejected / Fake UTR)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">à¤à¤¡à¤®à¤¿à¤¨ à¤¸à¤¤à¥à¤¯à¤¾à¤ªà¤¨ à¤¨à¥‹à¤Ÿ / à¤¬à¥ˆà¤‚à¤• à¤µà¤¿à¤µà¤°à¤£ (Remarks)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="à¤‰à¤¦à¤¾. à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ à¤¬à¥ˆà¤‚à¤• à¤–à¤¾à¤¤à¥‡ à¤®à¥‡à¤‚ 15:30 à¤ªà¤° à¤°à¤¾à¤¶à¤¿ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤¹à¥à¤ˆ"
                  value={editUtrModal.remarks}
                  onChange={e => setEditUtrModal({ ...editUtrModal, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditUtrModal(null)}>
                  à¤°à¤¦à¥à¤¦ à¤•à¤°à¥‡à¤‚
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  âœ“ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤…à¤ªà¤¡à¥‡à¤Ÿ à¤•à¤°à¥‡à¤‚
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  if (isStaffView) {
    const roleSettingsPath = staffUser.role === 'SuperAdmin' ? '/admin/settings'
      : staffUser.role === 'TTE' ? '/tt/settings'
      : staffUser.role === 'BookingClerk' ? '/counter/settings'
      : (staffUser.role === 'AccountsOfficer' || staffUser.role === 'FinanceOfficer') ? '/finance/settings'
      : staffUser.role === 'StationMaster' ? '/station/settings'
      : '/settings';

    return (
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <img src="/logo.jpg" alt="MVD Logo" className="admin-sidebar-logo" />
            <div>
              <div className="admin-sidebar-title">Mata Vaishno Devi</div>
              <div className="admin-sidebar-subtitle">Staff Portal 2026</div>
            </div>
          </div>
          <div className="admin-sidebar-nav">
             {allStaffNavItems.map((item, idx) => (
               <a 
                 key={idx} 
                 className={`admin-nav-item ${currentPath.startsWith(item.path) ? 'active' : ''}`}
                 onClick={(e) => { e.preventDefault(); navigate(item.path); }}
               >
                 {item.icon} {item.label}
               </a>
             ))}
          </div>
          <div className="admin-sidebar-footer">
             <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Logged in as:</div>
             <div style={{ fontWeight: 'bold' }}>{staffUser.name}</div>
             <div style={{ fontSize: '0.75rem', color: '#FDBA74', marginBottom: 6 }}>{staffUser.role}</div>
             <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
               <button
                 className="btn btn-sm btn-outline"
                 onClick={() => navigate(roleSettingsPath)}
                 style={{ flex: 1, padding: '5px 6px', fontSize: '0.75rem', color: '#FFF', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)' }}
                 title="à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤à¤µà¤‚ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡"
               >
                 <Settings size={13} style={{display:"inline", marginRight:"3px", verticalAlign:"text-bottom"}} /> à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸
               </button>
               <button
                 className="btn btn-sm"
                 onClick={handleStaffLogout}
                 style={{ flex: 1, padding: '5px 6px', fontSize: '0.75rem', color: '#FECACA', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.25)' }}
                 title="à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ"
               >
                 <LogOut size={13} style={{display:"inline", marginRight:"3px", verticalAlign:"text-bottom"}} /> à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ
               </button>
             </div>
          </div>
        </aside>
        
        <main className="admin-main">
          <header className="admin-header">
             <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
               <button
                 className="btn btn-outline btn-sm mobile-only-inline"
                 onClick={() => setMobileMenuOpen(true)}
                 style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#9A3412', borderColor: '#FDBA74', background: '#FFF8F2' }}
                 title="à¤¸à¤­à¥€ 14 à¤ªà¥ˆà¤¨à¤² à¤¦à¥‡à¤–à¥‡à¤‚"
               >
                 <Menu size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                 <span>à¤®à¥‡à¤¨à¥à¤¯à¥‚</span>
               </button>
               <div className="admin-header-title">
                  {allStaffNavItems.find(i => currentPath.startsWith(i.path))?.label || (activeView === 'settings' ? 'à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤à¤µà¤‚ à¤¸à¥à¤°à¤•à¥à¤·à¤¾' : 'à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡')}
               </div>
             </div>

             <div className="admin-header-user">
                {isSuperAdmin && (
                  <div className="desktop-actions" style={{ display: 'flex', gap: 6 }}>
                    <a href={`/api/admin/export-excel?yatraYear=${encodeURIComponent(adminYearFilter || '')}&token=${safeStaffToken}`}
                      className="btn btn-gold btn-sm"><Download size={14} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> Excel</a>
                    <button className="btn btn-outline btn-sm" onClick={() => setBulkModalOpen(true)}><Upload size={14} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> à¤¬à¤²à¥à¤•</button>
                    <a href={`/api/admin/bulk-slips?yatraYear=${encodeURIComponent(adminYearFilter || '')}&token=${safeStaffToken}`}
                      className="btn btn-primary btn-sm"><FileText size={14} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> à¤ªà¤°à¥à¤šà¤¿à¤¯à¤¾à¤‚</a>
                  </div>
                )}
                <span className="badge badge-bhakti" style={{ fontSize: '0.73rem', padding: '3px 8px' }}>{staffUser.department || staffUser.role}</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate(roleSettingsPath)}
                  style={{ color: '#9A3412', borderColor: '#FED7AA', background: '#FFF8F2', padding: '5px 8px' }}
                  title="à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸ à¤à¤µà¤‚ à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡"
                >
                  <Settings size={15} style={{ verticalAlign: 'middle' }} />
                </button>
                <button className="btn btn-sm" onClick={handleStaffLogout} style={{ color: '#DC2626', border: '1.5px solid #FCA5A5', background: '#FFF5F5', padding: '5px 8px' }} title="à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ">
                  <LogOut size={15} style={{ verticalAlign: 'middle' }} />
                </button>
             </div>
          </header>

          <div className="admin-content">
             {renderInnerViews()}
          </div>
        </main>

        {/* Mobile All Panels Drawer / Bottom Sheet */}
        {mobileMenuOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-drawer-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src="/logo.jpg" alt="Logo" style={{ width: 38, height: 38, borderRadius: 10, border: '1.5px solid #FDBA74', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#431407' }}>à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ â€¢ à¤¸à¥à¤Ÿà¤¾à¤« à¤ªà¥ˆà¤¨à¤²</div>
                    <div style={{ fontSize: '0.74rem', color: '#9A3412', fontWeight: 700 }}>{staffUser.name} ({staffUser.role})</div>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon-xs"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEE4CC', color: '#7C2D12' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mobile-drawer-body">
                {isSuperAdmin && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
                    <a href={`/api/admin/export-excel?yatraYear=${encodeURIComponent(adminYearFilter || '')}&token=${safeStaffToken}`}
                      className="btn btn-gold btn-xs" style={{ whiteSpace: 'nowrap' }}><Download size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> Excel Export</a>
                    <button className="btn btn-outline btn-xs" style={{ whiteSpace: 'nowrap' }} onClick={() => { setMobileMenuOpen(false); setBulkModalOpen(true); }}>
                      <Upload size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> à¤¬à¤²à¥à¤• à¤…à¤ªà¤²à¥‹à¤¡
                    </button>
                    <a href={`/api/admin/bulk-slips?yatraYear=${encodeURIComponent(adminYearFilter || '')}&token=${safeStaffToken}`}
                      className="btn btn-primary btn-xs" style={{ whiteSpace: 'nowrap' }}><FileText size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> à¤¸à¤­à¥€ à¤ªà¤°à¥à¤šà¤¿à¤¯à¤¾à¤‚</a>
                  </div>
                )}

                <div className="mobile-drawer-grid">
                  {allStaffNavItems.map((item, idx) => {
                    const isActive = currentPath === item.path || currentPath.startsWith(item.path);
                    return (
                      <div
                        key={idx}
                        className={`mobile-drawer-tile ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          navigate(item.path);
                        }}
                      >
                        <div className="mobile-drawer-tile-icon">
                          {item.icon}
                        </div>
                        <div className="mobile-drawer-tile-label">{item.label}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #FED7AA', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1, borderColor: '#FED7AA', color: '#9A3412', background: '#FFF8F2' }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate(roleSettingsPath);
                    }}
                  >
                    <Settings size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡ à¤µ à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, color: '#DC2626', border: '1.5px solid #FCA5A5', background: '#FFF5F5' }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleStaffLogout();
                    }}
                  >
                    <LogOut size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> à¤¸à¥à¤°à¤•à¥à¤·à¤¿à¤¤ à¤²à¥‰à¤—à¤†à¤‰à¤Ÿ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Curated 5-Tab Bar (Native App Style) */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {curatedBottomNavItems.map((item, idx) => {
              if (item.isMoreTrigger) {
                return (
                  <button
                    key="more-menu-trigger"
                    className={`bottom-nav-item ${mobileMenuOpen ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                );
              }
              const isActive = currentPath === item.path || (item.path !== '/admin' && currentPath.startsWith(item.path));
              return (
                <button
                  key={idx}
                  className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(item.path);
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--peach-bg)', minHeight: '100vh', color: 'var(--text-main)' }}>
      {/* Top Sacred Bhagwa Animated Band */}
      <div className="sacred-band">
        <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> à¥¤à¥¤ à¥ à¤¸à¤°à¥à¤µà¤®à¤‚à¤—à¤² à¤®à¤¾à¤‚à¤—à¤²à¥à¤¯à¥‡ à¤¶à¤¿à¤µà¥‡ à¤¸à¤°à¥à¤µà¤¾à¤°à¥à¤¥ à¤¸à¤¾à¤§à¤¿à¤•à¥‡ â€¢ à¤¶à¤°à¤£à¥à¤¯à¥‡ à¤¤à¥à¤°à¥à¤¯à¤‚à¤¬à¤•à¥‡ à¤—à¥Œà¤°à¥€ à¤¨à¤¾à¤°à¤¾à¤¯à¤£à¤¿ à¤¨à¤®à¥‹à¤½à¤¸à¥à¤¤à¥ à¤¤à¥‡ à¥¤à¥¤ <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> &nbsp;&nbsp; à¤œà¤¯ à¤®à¤¾à¤¤à¤¾ à¤¦à¥€ â€¢ à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ  &nbsp;&nbsp;
      </div>

      {/* Main Navbar (Mobile-Responsive) */}
      <nav className="navbar">
        {/* Brand */}
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <div className="navbar-logo" style={{ background: '#fff', overflow: 'hidden' }}><img src="/logo.jpg" alt="MVD Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /></div>
          <div>
            <div className="navbar-title">Mata Vaishno Devi</div>
            <div className="navbar-subtitle">à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ â€¢ Yatra Special Train 2026</div>
          </div>
        </div>

        {/* Nav Actions */}
        <div className="navbar-actions">
          <button
            className={`btn btn-sm ${(currentPath === '/' || currentPath === '/home') ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => navigate('/')}
            title="PNR à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤œà¤¾à¤‚à¤šà¥‡à¤‚"
          >
            <Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> <span className="btn-text-label">PNR à¤œà¤¾à¤‚à¤š</span>
          </button>
          <button
            className={`btn btn-sm ${(currentPath === '/coach-position' || currentPath === '/train-composition') ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => navigate('/coach-position')}
            title="à¤Ÿà¥à¤°à¥‡à¤¨ à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ à¤à¤µà¤‚ à¤¸à¤‚à¤°à¤šà¤¨à¤¾"
          >
            <Train size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> <span className="btn-text-label">à¤¬à¥‹à¤—à¥€ à¤¸à¥à¤¥à¤¿à¤¤à¤¿ (Coaches)</span>
          </button>
          <button
            className={`btn btn-sm ${currentPath === '/login' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => navigate('/login')}
            title="à¤•à¤°à¥à¤®à¤šà¤¾à¤°à¥€ à¤²à¥‰à¤—à¤¿à¤¨"
          >
            <Lock size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> <span className="btn-text-label">Staff Login</span>
          </button>
        </div>
      </nav>

      <div className="public-page-wrapper">
        {renderInnerViews()}

        {/* Footer */}
        <footer style={{
          marginTop: 60, borderTop: '2px solid #FED7AA',
          padding: '28px 16px 20px', textAlign: 'center', background: '#FFFFFF',
          color: '#7C2D12', fontSize: '0.9rem', boxShadow: '0 -4px 15px rgba(230,81,0,0.05)'
        }}>
          <div style={{ color: '#9A3412', fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>
            à¤¶à¥à¤°à¥€ à¤®à¤¾à¤¤à¤¾ à¤µà¥ˆà¤·à¥à¤£à¥‹ à¤¦à¥‡à¤µà¥€ à¤ªà¤¬à¥à¤²à¤¿à¤• à¤šà¥ˆà¤°à¤¿à¤Ÿà¥‡à¤¬à¤² à¤Ÿà¥à¤°à¤¸à¥à¤Ÿ
          </div>
          <div>Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India</div>
          <div style={{ marginTop: 8, color: '#C2410C', fontSize: '0.85rem', fontWeight: 700 }}>
            à¤¹à¥‡à¤²à¥à¤ªà¤²à¤¾à¤‡à¤¨: +91 7398959993 â€¢ à¤ˆà¤®à¥‡à¤²: infomatavaishnodevi@gmail.com â€¢ à¥¤à¥¤ à¤œà¤¯ à¤®à¤¾à¤¤à¤¾ à¤¦à¥€ à¥¤à¥¤
          </div>
          <div style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px dashed #FED7AA',
            fontSize: '0.84rem',
            color: '#6B7280',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap'
          }}>
            <span>
              Made with <span style={{ color: '#EF4444' }}>â¤ï¸</span> by{' '}
              <a
                href="https://www.aroventech.site"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#EA580C', fontWeight: 800, textDecoration: 'underline' }}
              >
                ArovenTech
              </a>
            </span>
            <span style={{ color: '#CBD5E1' }}>â€¢</span>
            <a
              href="https://wa.me/919598023701"
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#059669',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              ðŸ’¬ WhatsApp: +91 9598023701
            </a>
          </div>
        </footer>
      </div>

      {/* Public Mobile Bottom Navigation Tab Bar */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {publicBottomNavItems.map((item, idx) => {
            const isActive = currentPath === item.path || (item.path === '/' && (currentPath === '/' || currentPath === '/home'));
            return (
              <button
                key={idx}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

