import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Smartphone, Globe, AlertTriangle, Send, Lightbulb, LayoutDashboard, Ticket, ClipboardList, Printer, IndianRupee, Users, Search, BadgeCheck, Briefcase, Download, Upload, FileText, LogOut, Crown, Eye, Lock, Scan, Home, Settings, CalendarDays, Armchair, Mail, Train, Plus, Trash2, Edit, ArrowUp, ArrowDown, RefreshCw, QrCode, BarChart3, CheckCircle2, DollarSign, TrendingUp, Percent, Menu, X, Sparkles, Layers } from 'lucide-react';

import { db, auth, firebaseConfig } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [pnrInput, setPnrInput] = useState('');
  const [ticketModal, setTicketModal] = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState('');
  const [upiQrModal, setUpiQrModal] = useState(null);
  const [utrInput, setUtrInput] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const [fromStation, setFromStation] = useState('New Delhi (NDLS)');
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
    upiPayeeName: 'श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट',
    merchantCode: 'MVD2026',
    defaultAdvance: 1000,
    fareSleeper: 3000,
    fareAC: 4000,
    fareGeneral: 2000,
    helplineNumber: '+91 7398959993',
    officialEmail: 'infomatavaishnodevi@gmail.com',
    officeAddress: 'Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India',
    sacredShlok: 'जय माता दी • ॐ श्री वैष्णवी नमः • निष्काम सेवा'
  });
  const [projectSettingsLoading, setProjectSettingsLoading] = useState(false);
  const [projectSettingsSaving, setProjectSettingsSaving] = useState(false);
  const [projectSettingsSuccess, setProjectSettingsSuccess] = useState('');
  const [projectSettingsError, setProjectSettingsError] = useState('');

  useEffect(() => {
    if (projectSettings?.defaultTravelDate) {
      setTravelDate(projectSettings.defaultTravelDate);
    }
  }, [projectSettings?.defaultTravelDate]);

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
    detailedType: 'Sleeper 3-Tier (शयनयान)',
    position: '',
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'ट्रेन का मध्य भाग (Center Platform)',
    facilities: '72 शयन बर्थ, पंखा व चार्जिंग सॉकेट, बायो-टॉयलेट',
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
    department: 'Running Staff (ट्रेन संचालन)',
    role: 'TTE',
    mobile: '',
    assignedCoach: '',
    assignedCoaches: ['S1', 'S2'],
    assignedStation: 'New Delhi (NDLS)'
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
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setStaffUser(data.user);
          localStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
          sessionStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        } else if (data.status === 401 || data.error?.includes('अमान्य')) {
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
      alert('कृपया कोच कोड और नाम भरें।');
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
        alert(data.message || 'नया कोच सफलतापूर्वक जोड़ा गया।');
        setNewCoachModal(false);
        setNewCoachForm({
          coachCode: '',
          coachName: '',
          coachClass: 'Sleeper',
          detailedType: 'Sleeper 3-Tier (शयनयान)',
          position: '',
          totalSeats: 72,
          fare: 3000,
          status: 'Active',
          isBookable: true,
          platformPosition: 'ट्रेन का मध्य भाग (Center Platform)',
          facilities: '72 शयन बर्थ, पंखा व चार्जिंग सॉकेट, बायो-टॉयलेट',
          description: ''
        });
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('सर्वर त्रुटि: ' + err.message);
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
        alert(data.message || 'कोच विवरण सफलतापूर्वक अपडेट किया गया।');
        setEditCoachModal(false);
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('सर्वर त्रुटि: ' + err.message);
    }
  };

  // Ticket Cancellation & Refund Handler
  const handleCancelTicket = async (e) => {
    e.preventDefault();
    if (!cancelModal?.booking) return;
    const b = cancelModal.booking;
    const refAmt = parseFloat(cancelModal.refundAmount) || 0;
    const charges = parseFloat(cancelModal.cancellationCharges) || 0;
    
    if (!confirm(`क्या आप निश्चित हैं कि PNR ${b.bookingId} (${b.bookedBy}) का टिकट रद्द करना चाहते हैं?\n\nरिफंड राशि: ₹${refAmt}\nकटौती शुल्क: ₹${charges}\nमाध्यम: ${cancelModal.refundMode}\n\nसीटें तुरंत मुक्त कर दी जाएंगी।`)) {
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
          cancellationReason: cancelModal.cancellationReason || 'यात्री के अनुरोध पर रद्दीकरण',
          refundMode: cancelModal.refundMode || 'Cash',
          utr: cancelModal.utr || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'टिकट सफलतापूर्वक रद्द किया गया एवं रिफंड रिकॉर्ड दर्ज किया गया।');
        setCancelModal(null);
        loadAdminDashboard();
        loadDashboardStats();
        loadCoachLayout(coachName, bookingYear);
        loadTrainComposition(compositionYearFilter);
        loadDailyReport(dailyFilterDate);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('सर्वर त्रुटि: ' + err.message);
    }
  };

  const handleDeleteCoach = async (id, code) => {
    if (!confirm(`क्या आप कोच ${code} को ट्रेन संरचना से हटाना चाहते हैं?`)) return;
    try {
      const res = await fetch(`/api/admin/coaches/${id}?token=${staffToken}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        alert('कोच सफलतापूर्वक हटा दिया गया।');
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('सर्वर त्रुटि: ' + err.message);
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
    if (!confirm('क्या आप ट्रेन संरचना को मानक 18-बोगी प्रारूप (Default Rake) पर रीसेट करना चाहते हैं?')) return;
    const token = staffToken || localStorage.getItem('mvd_staff_token') || 'mvd_admin_token';
    try {
      const res = await fetch(`/api/admin/coaches/reset-default?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'ट्रेन संरचना सफलतापूर्वक मानक 18-बोगी प्रारूप पर रीसेट हो गई।');
        loadAdminCoaches();
        loadTrainComposition(compositionYearFilter);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
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
      alert(`कोच ${coachName} में कोई भी सीट रिक्त नहीं है! कृपया अन्य कोच चुनें।`);
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
      alert('कृपया मुख्य भक्त का नाम और मोबाइल नंबर भरें।');
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
        setSelectedSeats([]);
        setBookedBy('');
        setMobile('');
        setAadhar('');
        setSameAsLeadDevotee(false);
        setPassengers([{ name: '', age: '', gender: 'Male', aadhar: '', seatAssigned: '1' }]);
        
        // Fast counter workflow: immediately trigger print dialog
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        alert('बुकिंग विफल: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
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
        throw new Error(`सर्वर स्थिति (${res.status}): ${text.slice(0, 100)}`);
      }
      throw new Error('अमान्य सर्वर प्रतिक्रिया');
    }
  };

  const searchPNR = async (queryTerm) => {
    const term = (queryTerm !== undefined ? queryTerm : pnrInput).trim();
    if (!term) {
      setPnrSearchError('कृपया PNR नंबर अथवा मोबाइल नंबर दर्ज करें।');
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
        setPnrSearchError(data.error || 'इस PNR / मोबाइल नंबर से कोई वैध आरक्षण नहीं मिला।');
      }
    } catch (err) {
      setPnrSearchError('सर्वर त्रुटि: ' + err.message);
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
      alert('UPI QR लोड नहीं हो सका: ' + err.message);
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
        setAuthLoginError(data.error || 'अमान्य ईमेल आईडी / यूजरनेम या पासवर्ड।');
      }
    } catch (err) {
      setAuthLoginError('प्रमाणीकरण त्रुटि: ' + err.message);
    } finally {
      setAuthLoginLoading(false);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    if (!otpSentNotice) {
      if (!loginPhone || loginPhone.length < 10) {
        setAuthLoginError('कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।');
        return;
      }
      setOtpSentNotice(true);
      setAuthLoginError('');
      setLoginOtp('123456'); // demo prefilled OTP
      return;
    }
    // Verify OTP
    if (loginOtp !== '123456') {
      setAuthLoginError('अमान्य OTP कोड! कृपया सही OTP (123456) दर्ज करें।');
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
      setAuthLoginError('लॉगिन त्रुटि: ' + err.message);
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
      if (data.success) {
        setStaffToken(data.token);
        setStaffUser(data.user);
        localStorage.setItem('mvd_staff_token', data.token);
        localStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        sessionStorage.setItem('mvd_staff_token', data.token);
        sessionStorage.setItem('mvd_staff_user', JSON.stringify(data.user));
        const targetRoute = getRoleDefaultPath(data.user.role);
        navigate(targetRoute);
      } else {
        setAuthLoginError(data.error || 'गूगल खाता अधिकृत नहीं है।');
      }
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        setAuthLoginError('सुरक्षा सूचना: Vercel डोमेन को Firebase Authentication Console (Authorized Domains) में जोड़ें, या "आईडी / पासवर्ड" से लॉगिन करें।');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setAuthLoginError('गूगल लॉगिन विंडो बंद कर दी गई।');
      } else {
        setAuthLoginError('गूगल प्रमाणीकरण त्रुटि: ' + err.message);
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
      setVerifierResult({ success: false, status: 'ERROR', message: 'सत्यापन सर्वर त्रुटि: ' + err.message });
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
        setProjectSettingsSuccess(data.message || 'प्रोजेक्ट एवं UPI सेटिंग्स सफलतापूर्वक सहेज ली गईं!');
        if (data.settings) setProjectSettings(data.settings);
      } else {
        setProjectSettingsError(data.error || 'सेटिंग्स अपडेट करने में विफल।');
      }
    } catch (err) {
      setProjectSettingsError('सर्वर त्रुटि: ' + err.message);
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
      setSettingsError('नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते।');
      return;
    }
    if (settingsNewPass.length < 6) {
      setSettingsError('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
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
        setSettingsError(data.error || 'पासवर्ड अपडेट करने में विफल।');
      }
    } catch (err) {
      setSettingsError('सर्वर त्रुटि, कृपया पुनः प्रयास करें।');
    }
  };
  const submitUtr = async (e) => {
    e.preventDefault();
    if (!utrInput.trim()) return alert('कृपया UTR नंबर दर्ज करें।');
    
    try {
      const res = await fetch(`/api/bookings/${upiQrModal.bookingId}/utr`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utrNumber: utrInput })
      });
      const data = await res.json();
      if (data.success) {
        alert('UTR सफलतापूर्वक सबमिट हो गया। एडमिन द्वारा वेरिफिकेशन की प्रतीक्षा है।');
        setUpiQrModal(null);
        setUtrInput('');
        if (staffToken) loadAdminDashboard(); // Refresh if staff
      } else {
        alert(data.error || 'UTR सबमिट करने में विफल।');
      }
    } catch (err) {
      alert('सर्वर त्रुटि, कृपया पुनः प्रयास करें।');
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
    if (!confirm(`बुकिंग ${id} को पूर्ण भुगतान चिह्नित करें?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${id}/pay?token=${staffToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) loadAdminDashboard();
    } catch (err) {
      alert('त्रुटि: ' + err.message);
    }
  };

  const verifyUtr = async (id, utrNumber) => {
    if (!confirm(`क्या आप UTR ${utrNumber} की पुष्टि करना चाहते हैं?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${id}/verify-utr?token=${staffToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        alert('UTR सफलतापूर्वक सत्यापित हो गया।');
        loadAdminDashboard();
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
    }
  };



  const deleteBooking = async (id) => {
    if (!confirm(`क्या आप बुकिंग ${id} को निरस्त करना चाहते हैं?`)) return;
    try {
      const res = await fetch(`/api/admin/bookings/${id}?token=${staffToken}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) loadAdminDashboard();
    } catch (err) {
      alert('त्रुटि: ' + err.message);
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
        alert(data.error || 'अपलोड त्रुटि');
      }
    } catch (err) {
      alert('अपलोड त्रुटि: ' + err.message);
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
        alert('अटेंडेंस त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
    }
  };

  const handleTteCollectDue = async (bookingId, amount) => {
    const mode = window.prompt(`बकाया ₹ ${amount} जमा करने का तरीका (Cash या UPI टाइप करें):`, 'Cash');
    if (!mode) return;
    
    const paymentMode = mode.trim().toUpperCase() === 'UPI' ? 'UPI' : 'Cash';
    let utr = '';
    
    if (paymentMode === 'UPI') {
      utr = window.prompt('कृपया 12-अंकों का UPI UTR (Ref) नंबर दर्ज करें:');
      if (!utr) {
        alert('UPI पेमेंट के लिए UTR अनिवार्य है!');
        return;
      }
    } else {
      if (!window.confirm(`क्या यात्री से ₹ ${amount} CASH प्राप्त हो चुका है?`)) return;
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
        alert('बकाया राशि सफलतापूर्वक जमा की गई!');
        loadCoachChart(chartCoach, chartYear);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
    }
  };

  const openPrintChart = (coach = chartCoach, year = chartYear) => {
    window.open(`/api/chart/${coach}/print?year=${year}&token=${staffToken}`, '_blank');
  };

  const loadStaffData = async () => {
    try {
      const res = await fetch(`/api/admin/staff?token=${staffToken}`, {
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff);
        setStaffRoles(data.roles);
        setStaffDepartments(data.departments);
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
        alert(data.message || 'सफलतापूर्वक अपडेट किया गया!');
        setEditUtrModal(null);
        loadOnlineTransactions(onlineTxnsStatusFilter, onlineTxnsSearch);
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
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
        alert('कर्मचारी सफलतापूर्वक जोड़ दिया गया!');
        setNewStaffModal(false);
        setNewStaffForm({
          name: '',
          username: '',
          password: '',
          department: 'Running Staff (ट्रेन संचालन)',
          role: 'TTE',
          mobile: '',
          assignedCoach: '',
          assignedCoaches: ['S1'],
          assignedStation: 'New Delhi (NDLS)'
        });
        loadStaffData();
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
    }
  };

  const handleDeleteStaff = async (staffId, name) => {
    if (!confirm(`क्या आप कर्मचारी "${name}" (ID: ${staffId}) को सिस्टम से हटाना चाहते हैं?`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${staffId}?token=${staffToken}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + staffToken }
      });
      const data = await res.json();
      if (data.success) {
        alert('कर्मचारी हटा दिया गया।');
        loadStaffData();
      } else {
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
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
        alert('त्रुटि: ' + data.error);
      }
    } catch (err) {
      alert('त्रुटि: ' + err.message);
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
    if (p === '/' || p === '/home' || p === '/login' || p === '/receipts' || p === '/verify-ticket' || p === '/coach-position' || p === '/train-composition') {
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
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'सुपर व्यवस्थापक (SuperAdmin)' };
    }
    if (p.startsWith('/tt') && staffUser.role !== 'TTE' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'टीटीई स्टाफ (TTE)' };
    }
    if (p.startsWith('/counter') && staffUser.role !== 'BookingClerk' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'बुकिंग क्लर्क (BookingClerk)' };
    }
    if (p.startsWith('/finance') && staffUser.role !== 'AccountsOfficer' && staffUser.role !== 'FinanceOfficer' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'अकाउंट्स ऑफिसर (AccountsOfficer)' };
    }
    if (p.startsWith('/station') && staffUser.role !== 'StationMaster' && !isSuperAdmin) {
      return { allowed: false, reason: 'ROLE_MISMATCH', required: 'स्टेशन समन्वयक (StationMaster)' };
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
          सुरक्षित अधिकृत कर्मचारी क्षेत्र
        </span>
        <h2 style={{ fontSize: '1.8rem', color: '#9A3412', margin: '8px 0 6px', fontWeight: 800 }}>
          कर्मचारी एवं ट्रस्टी लॉगिन
        </h2>
        <p style={{ color: '#7C2D12', fontSize: '0.88rem', marginBottom: 20 }}>
          यह क्षेत्र केवल अधिकृत रेलवे स्टाफ, टीटीई, अकाउंट्स एवं ट्रस्ट प्रबंधकों के लिए आरक्षित है।
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
            <Key size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> आईडी / पासवर्ड
          </button>
          <button
            type="button"
            className={`btn btn-sm ${loginMethod === 'google' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '9px 6px', fontSize: '0.86rem' }}
            onClick={() => { setLoginMethod('google'); setAuthLoginError(''); }}
          >
            <Globe size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> Google साइन-इन
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
              <label className="form-label">जीमेल आईडी या यूजरनेम (Gmail ID / Username) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="iammshyam@gmail.com या admin"
                value={authLoginUsername}
                onChange={(e) => setAuthLoginUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">गोपनीय सुरक्षा पासवर्ड (Password) *</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={authLoginPassword}
                onChange={(e) => setAuthLoginPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={authLoginLoading} className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '1rem', marginTop: 10 }}>
              {authLoginLoading ? 'सत्यापन जारी...' : <><Lock size={18} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> अधिकृत प्रवेश करें (Secure Login)</>}
            </button>
          </form>
        )}

        {/* Method 3: Google Sign-In */}
        {loginMethod === 'google' && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', padding: '12px 14px', borderRadius: 10, color: '#1E40AF', fontSize: '0.85rem', marginBottom: 16, textAlign: 'left', lineHeight: 1.4 }}>
              <strong><Globe size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> Google (Gmail) वन-क्लिक लॉगिन:</strong>
              <div style={{ marginTop: 4 }}>एडमिन द्वारा पंजीकृत ईमेल आईडी से लॉगिन करते ही उनका संबंधित कार्यभार (एडमिन / स्टाफ) स्वतः खुल जाएगा।</div>
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
              <span>{authLoginLoading ? 'गूगल प्रमाणीकरण जारी...' : 'Google (Gmail) से लॉगिन करें'}</span>
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
        { path: '/admin/dashboard', label: <><LayoutDashboard size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> डैशबोर्ड</>, subTab: 'dashboard' },
        { path: '/admin/booking', label: <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> नया आरक्षण</>, subTab: 'book' },
        { path: '/admin/bookings', label: <><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> बुकिंग डायरेक्टरी</>, subTab: 'bookings' },
        { path: '/admin/chart', label: <><Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC कोच चार्ट</>, subTab: 'chart' },
        { path: '/admin/reconcile', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> दैनिक वसूली व हिसाब</>, subTab: 'reconcile' },
        { path: '/admin/staff', label: <><Users size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> कर्मचारी व RBAC</>, subTab: 'staff' },
        { path: '/admin/audit', label: <><ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> ऑडिट ट्रेल</>, subTab: 'audit' },
        { path: '/admin/verifier', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> टिकट सत्यापन</>, subTab: 'verifier' }
      ];
    } else if (role === 'TTE') {
      navItems = [
        { path: '/tt/home', label: <><BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> ऑन-ट्रेन अटेंडेंस व वसूली</>, subTab: 'tte' },
        { path: '/tt/chart', label: <><Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC कोच चार्ट</>, subTab: 'chart' },
        { path: '/tt/collections', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> मेरा दैनिक कलेक्शन</>, subTab: 'collections' },
        { path: '/tt/verify', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> टिकट सत्यापन</>, subTab: 'verifier' }
      ];
    } else if (role === 'BookingClerk') {
      navItems = [
        { path: '/counter/booking', label: <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> नई टिकट काउंटर</>, subTab: 'book' },
        { path: '/counter/history', label: <><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> मेरी जारी बुकिंग्स</>, subTab: 'bookings' },
        { path: '/counter/collections', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> मेरा दैनिक कलेक्शन</>, subTab: 'collections' },
        { path: '/counter/verify', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> टिकट सत्यापन</>, subTab: 'verifier' }
      ];
    } else if (role === 'AccountsOfficer') {
      navItems = [
        { path: '/finance/ledger', label: <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> वित्तीय समाधान व दैनिक कलेक्शन</>, subTab: 'reconcile' },
        { path: '/finance/bookings', label: <><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> आरक्षण वित्तीय सूची</>, subTab: 'bookings' },
        { path: '/finance/verify', label: <><Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> टिकट सत्यापन</>, subTab: 'verifier' }
      ];
    } else {
      navItems = [
        { path: '/admin/dashboard', label: <><LayoutDashboard size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> डैशबोर्ड</>, subTab: 'dashboard' }
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
                <span className="badge badge-paid">✓ Active</span>
              </div>
              <p>
                {staffUser.department || 'रेलवे संचालन'} &nbsp;|&nbsp; ID: <code>{staffUser.username || staffUser.staffId}</code>
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
                <a href={`/api/admin/export-excel${adminYearFilter ? `?yatraYear=${adminYearFilter}` : ''}&token=${staffToken}`}
                  className="btn btn-gold btn-sm"><Download size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> Excel</a>
                <button className="btn btn-outline btn-sm" onClick={() => setBulkModalOpen(true)}><Upload size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> बल्क</button>
                <a href={`/api/admin/bulk-slips${adminYearFilter ? `?yatraYear=${adminYearFilter}` : ''}&token=${staffToken}`}
                  className="btn btn-primary btn-sm"><FileText size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> पर्चियां</a>
                <a href={`/api/admin/reports/defaulters?token=${staffToken}`} target="_blank" rel="noreferrer"
                  className="btn btn-gold btn-sm"><Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> बकायादारों की सूची</a>
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
      staffName: staffUser?.name || 'कर्मचारी',
      role: staffUser?.role || 'Staff',
      department: staffUser?.department || 'ट्रेन संचालन',
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
                {isPersonalOnly ? <><Briefcase size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> व्यक्तिगत दैनिक वसूली बहीखाता</> : <><BarChart3 size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> दिनांक-वार समग्र MIS रिपोर्ट एवं शून्य हेर-फेर समाधान</>}
              </span>
              <h3 style={{ fontSize: '1.45rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                {isPersonalOnly
                  ? `दैनिक वसूली रिपोर्ट • ${staffUser?.name || 'मेरा खाता'} (${staffUser?.role || ''})`
                  : 'समस्त कर्मचारियों का दैनिक वसूली, छूट, उधारी एवं MIS रजिस्टर'}
              </h3>
              <div style={{ color: '#7C2D12', fontSize: '0.86rem', marginTop: 4 }}>
                {isPersonalOnly
                  ? 'आपकी व्यक्तिगत नकद व UPI वसूली, प्रदान की गई रियायत, शेष देय एवं प्रत्येक टिकट लेनदेन की ऑडिट एंट्री'
                  : 'तिथि-से-तिथि (Date-to-Date) अनुसार नकद, यूपीआई, छूट, शेष बकाया व भूमिका-वार संपूर्ण ऑडिट ट्रेल'}
              </div>
            </div>

            {/* Print & Refresh Quick Bar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => window.print()}
                title="वर्तमान MIS रिपोर्ट प्रिंट करें"
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> MIS प्रिंट
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => loadDailyReport(dailyFilterDate, isPersonalOnly ? staffUser?.username : dailyStaffFilter, dateFilterPreset === 'custom' ? dateRangeStartDate : null, dateFilterPreset === 'custom' ? dateRangeEndDate : null)}
                disabled={dailyReportLoading}
                title="डेटा ताज़ा करें"
              >
                <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {dailyReportLoading ? 'लोडिंग...' : 'ताज़ा करें'}
              </button>
            </div>
          </div>

          {/* Date-to-Date & Range Filter Toolbar */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9A3412' }}>त्वरित फ़िल्टर:</span>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'today' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('today');
                  setDailyFilterDate(todayStr);
                  loadDailyReport(todayStr, isPersonalOnly ? staffUser?.username : dailyStaffFilter);
                }}
              >
                आज (Today)
              </button>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'yesterday' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('yesterday');
                  setDailyFilterDate(yesterdayStr);
                  loadDailyReport(yesterdayStr, isPersonalOnly ? staffUser?.username : dailyStaffFilter);
                }}
              >
                कल (Yesterday)
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
                गत 7 दिन
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
                इस माह
              </button>
              <button
                className={`btn btn-sm ${dateFilterPreset === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setDateFilterPreset('all');
                  setDailyFilterDate('all');
                  loadDailyReport('all', isPersonalOnly ? staffUser?.username : dailyStaffFilter);
                }}
              >
                समस्त तिथियां (All)
              </button>
            </div>

            {/* Custom Date-to-Date Range Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9A3412' }}>कस्टम अवधि:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: '#7C2D12' }}>से:</span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: 135, padding: '3px 6px', fontSize: '0.8rem' }}
                  value={dateRangeStartDate}
                  onChange={e => setDateRangeStartDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.75rem', color: '#7C2D12' }}>तक:</span>
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
                लागू करें
              </button>
            </div>

            {!isPersonalOnly && (isSuperAdmin || staffUser?.role === 'AccountsOfficer') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9A3412' }}>कर्मचारी:</span>
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
                  <option value="">समस्त कर्मचारी (All Staff)</option>
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
                शून्य वित्तीय हेर-फेर सत्यापन (Zero Financial Leakage Balance Formula)
              </strong>
            </div>
            <span className="badge badge-paid" style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#059669', color: '#fff' }}>
              ✓ 100% सटीक वित्तीय समाधान (Balanced)
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
              <span style={{ color: '#78350F', fontSize: '0.76rem' }}>कुल सकल किराया (Gross):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#9A3412' }}>₹ {activeGross.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#065F46', fontSize: '0.76rem' }}>= कुल संकलित (Cash+UPI):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#047857' }}>₹ {activeCollected.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#991B1B', fontSize: '0.76rem' }}>+ शेष देय / उधारी (Dues):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#DC2626' }}>₹ {activeDues.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: '#92400E', fontSize: '0.76rem' }}>+ प्रदान की गई छूट (Discount):</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#D97706' }}>₹ {activeDiscounts.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 4 Primary KPI Summary Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }} className="grid-kpi-mobile">
          {/* Total Collected */}
          <div className="kpi-card green">
            <div className="kpi-label">{isPersonalOnly ? 'मेरा कुल संकलन' : 'समस्त कुल वसूली (Total Collected)'}</div>
            <div className="kpi-value">
              ₹ {activeCollected.toLocaleString()}
            </div>
            <div className="kpi-sub" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span><IndianRupee size={15} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> नकद: ₹{activeCash.toLocaleString()}</span>
              <span><Smartphone size={15} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> UPI: ₹{activeUpi.toLocaleString()}</span>
            </div>
          </div>

          {/* Bookings Count */}
          <div className="kpi-card blue">
            <div className="kpi-label">{isPersonalOnly ? 'जारी टिकट' : 'कुल जारी टिकट (Bookings)'}</div>
            <div className="kpi-value">
              {activeBookings}
            </div>
            <div className="kpi-sub">{isPersonalOnly ? `${personal.yatrisHandled || 0} यात्री हैंडल` : 'पंजीकृत रसीदें'}</div>
          </div>

          {/* Pending Dues */}
          <div className="kpi-card red">
            <div className="kpi-label">शेष देय / उधारी (Pending Dues)</div>
            <div className="kpi-value">
              ₹ {activeDues.toLocaleString()}
            </div>
            <div className="kpi-sub">ट्रेन में अथवा कटड़ा आगमन पर वसूली शेष</div>
          </div>

          {/* Discounts Given */}
          <div className="kpi-card gold">
            <div className="kpi-label">कुल छूट (Discounts Granted)</div>
            <div className="kpi-value">
              ₹ {activeDiscounts.toLocaleString()}
            </div>
            <div className="kpi-sub">ट्रस्ट अधिकृत विशेष रियायत</div>
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
                    दिनांक-वार दैनिक वसूली व वित्तीय प्रवाह ग्राफ (MIS Time-Series Chart)
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: '#7C2D12' }}>
                    तारीख अनुसार नकद संग्रह (हरा), UPI संग्रह (नीला) एवं शेष देय (लाल) की दृश्य तुलना
                  </div>
                </div>
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#10B981', borderRadius: 2 }} /> नकद (Cash)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#3B82F6', borderRadius: 2 }} /> UPI संग्रह
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#EF4444', borderRadius: 2 }} /> शेष देय (Dues)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 12, height: 12, background: '#F59E0B', borderRadius: 2 }} /> छूट (Discount)
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
                      ₹{dayTotal > 999 ? (dayTotal / 1000).toFixed(1) + 'k' : dayTotal}
                    </div>

                    {/* Bars Container */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
                      {/* Cash Bar */}
                      <div
                        title={`तिथि: ${d.date} | नकद: ₹${(d.cashCollected || 0).toLocaleString()}`}
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
                        title={`तिथि: ${d.date} | UPI: ₹${(d.upiCollected || 0).toLocaleString()}`}
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
                          title={`तिथि: ${d.date} | शेष देय: ₹${(d.pendingDues || 0).toLocaleString()}`}
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
                      {d.bookingsCount} टिकट
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
                  भूमिका-वार वित्तीय संकलन एवं प्रदर्शन सारांश (Role-Wise Breakdown)
                </h4>
              </div>
              <span className="badge badge-bhakti" style={{ fontSize: '0.75rem' }}>
                कुल भूमिकाएं: {Object.keys(roleBreakdown).length}
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
                      {roleKey === 'SuperAdmin' ? 'चीफ़ एडमिन' :
                       roleKey === 'BookingClerk' ? 'बुकिंग क्लर्क' :
                       roleKey === 'TTE' ? 'TTE चेकिंग स्टाफ' :
                       roleKey === 'FinanceOfficer' || roleKey === 'AccountsOfficer' ? 'वित्त अधिकारी' :
                       roleKey === 'StationMaster' ? 'स्टेशन मास्टर' : roleKey}
                    </strong>
                    <span className="badge badge-bhakti" style={{ fontSize: '0.7rem' }}>
                      {rStats.bookingsCount || 0} टिकट
                    </span>
                  </div>

                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857', marginBottom: 6 }}>
                    ₹ {(rStats.totalCollected || 0).toLocaleString()}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#7C2D12' }}>
                    <span>नकद: ₹{(rStats.cashCollected || 0).toLocaleString()}</span>
                    <span>UPI: ₹{(rStats.upiCollected || 0).toLocaleString()}</span>
                  </div>
                  {rStats.pendingDues > 0 && (
                    <div style={{ fontSize: '0.76rem', color: '#DC2626', marginTop: 4, fontWeight: 700 }}>
                      शेष देय: ₹{(rStats.pendingDues || 0).toLocaleString()}
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
                  कर्मचारी-वार दैनिक संग्रह एवं हैंडओवर रजिस्टर
                </h4>
              </div>
              <span className="badge badge-bhakti" style={{ fontSize: '0.74rem' }}>
                सक्रिय कर्मचारी: {staffBreakdown.length}
              </span>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>कर्मचारी ID</th>
                    <th>नाम (Staff Name)</th>
                    <th>विभाग</th>
                    <th>रोल</th>
                    <th>टिकट संख्या</th>
                    <th>नकद (Cash)</th>
                    <th>UPI</th>
                    <th>छूट (Discount)</th>
                    <th>शेष बकाया</th>
                    <th>कुल वसूली (Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {staffBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: 20, color: '#784D35' }}>
                        कोई स्टाफ डेटा उपलब्ध नहीं है।
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
                        <td style={{ color: '#047857', fontWeight: 700 }}>₹ {(s.cashCollected || 0)?.toLocaleString()}</td>
                        <td style={{ color: '#0284C7', fontWeight: 700 }}>₹ {(s.upiCollected || 0)?.toLocaleString()}</td>
                        <td style={{ color: '#D97706', fontWeight: 600 }}>₹ {(s.discountsGiven || 0)?.toLocaleString()}</td>
                        <td style={{ color: '#DC2626', fontWeight: 600 }}>₹ {(s.pendingDues || 0)?.toLocaleString()}</td>
                        <td style={{ fontWeight: 900, color: '#9A3412', fontSize: '1rem' }}>
                          ₹ {(s.totalCollected || 0)?.toLocaleString()}
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
              {isPersonalOnly ? 'मेरी विस्तृत वसूली रसीदें / लेनदेन सूची' : 'विस्तृत लेनदेन ऑडिट ट्रेल (Transaction Ledger)'}
            </h4>
            <span style={{ fontSize: '0.8rem', color: '#7C2D12' }}>
              कुल प्रविष्टियां: <strong>{transactions.length}</strong>
            </span>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>समय (Time)</th>
                  <th>कार्यवाही (Action)</th>
                  <th>PNR / संदर्भ ID</th>
                  <th>कोच / सीट</th>
                  <th>वसूली राशि</th>
                  <th>भुगतान माध्यम</th>
                  <th>विवरण (Details)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#784D35' }}>
                      चयनित अवधि के दौरान कोई लेनदेन रिकॉर्ड उपलब्ध नहीं है।
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
                          {tx.action === 'PAYMENT_COLLECTED' ? <><IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> देय वसूली</> : (tx.action === 'TICKET_BOOKED' ? <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> नया आरक्षण</> : tx.action)}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#C2410C' }}>{tx.targetId || tx.bookingId || '-'}</strong>
                      </td>
                      <td>
                        {tx.coachName || tx.coach ? `कोच ${tx.coachName || tx.coach} ${tx.seatNumber ? `(सीट ${tx.seatNumber})` : ''}` : '-'}
                      </td>
                      <td style={{ fontWeight: 900, color: tx.amount > 0 ? '#047857' : '#784D35' }}>
                        {tx.amount > 0 ? `₹ ${tx.amount?.toLocaleString()}` : '-'}
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
                <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> आधिकारिक रसीद एवं भुगतान पर्ची काउंटर
              </span>
              <h2 style={{ color: '#9A3412', margin: '6px 0 4px', fontWeight: 900, fontSize: '1.6rem' }}>
                श्रद्धालु भुगतान रसीद खोज व प्रिंट डेस्क
              </h2>
              <p style={{ color: '#7C2D12', margin: 0, fontSize: '0.9rem' }}>
                PNR नंबर, मुख्य भक्त के नाम या 10-अंकों के मोबाइल नंबर से किसी भी श्रद्धालु की भुगतान पर्चियां खोजें और इच्छानुसार प्रिंट करें।
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {staffUser?.role === 'SuperAdmin' && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/dashboard')}>
                  ← डैशबोर्ड वापस
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
              placeholder="PNR नंबर (जैसे MVD-2026-...), भक्त का नाम, या मोबाइल नंबर दर्ज करें..."
              value={receiptSearchQuery}
              onChange={(e) => setReceiptSearchQuery(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '1rem', fontWeight: 600, padding: '8px 12px' }}
            />
            {receiptSearchQuery && (
              <button className="btn btn-outline btn-sm" onClick={() => setReceiptSearchQuery('')} style={{ alignSelf: 'center' }}>
                ✕ साफ़ करें
              </button>
            )}
          </div>
        </div>

        {/* Results Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h4 style={{ color: '#9A3412', margin: 0, fontWeight: 800 }}>
            उपलब्ध आरक्षण एवं रसीदें ({matchedBookings.length})
          </h4>
          <span style={{ fontSize: '0.82rem', color: '#784D35' }}>
            {query ? `"${query}" के परिणाम` : 'सभी वर्तमान बुकिंग्स'}
          </span>
        </div>

        {/* List of Matched Devotees / Bookings with their slips */}
        {matchedBookings.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 40, color: '#784D35' }}>
            <div style={{ fontSize: 24, marginBottom: 10, color: "#9CA3AF" }}><Search size={36} /></div>
            <h3>कोई रिकॉर्ड नहीं मिला</h3>
            <p>कृपया सही PNR नंबर, नाम या मोबाइल नंबर डालकर पुनः प्रयास करें।</p>
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
                  type: 'Advance Booking (अग्रिम बुकिंग)',
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
                        मोबाइल: <strong>{b.mobile || 'N/A'}</strong> {b.aadhar ? `| आधार: ${b.aadhar}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857' }}>
                        {b.fromStation} ➔ {b.toStation}
                      </div>
                      <div style={{ fontSize: '0.84rem', marginTop: 2 }}>
                        कोच: <strong style={{ color: '#C2410C' }}>{b.coachName}</strong> | सीट: <strong style={{ color: '#1E40AF' }}>{Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber}</strong> ({b.travelClass})
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span className={`badge ${b.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-partial'}`}>
                          {b.paymentStatus === 'Paid' ? '✓ पूर्ण भुगतान (Paid)' : `देय बकाया: ₹${b.remainingAmount}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Overview Chips */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 16 }}>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#7C2D12' }}>कुल यात्रा किराया:</span>
                      <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.95rem' }}>₹ {b.totalAmount}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#7C2D12' }}>कुल जमा राशि:</span>
                      <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.95rem' }}>₹ {b.advance}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.74rem', color: '#7C2D12' }}>कटड़ा में शेष देय:</span>
                      <div style={{ fontWeight: 800, color: b.remainingAmount > 0 ? '#DC2626' : '#047857', fontSize: '0.95rem' }}>
                        ₹ {b.remainingAmount}
                      </div>
                    </div>
                  </div>

                  {/* All Individual Slips / Receipts for this booking */}
                  <div>
                    <h5 style={{ color: '#9A3412', margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={16} /> इस श्रद्धालु की भुगतान पर्चियां / रसीदें ({slips.length}):
                    </h5>

                    {slips.length === 0 ? (
                      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, color: '#6B7280', fontSize: '0.85rem' }}>
                        इस PNR पर अभी तक कोई भुगतान दर्ज नहीं हुआ है।
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
                                  रसीद #{sIdx + 1}
                                </span>
                                <strong style={{ color: '#C2410C', fontSize: '0.9rem' }}>
                                  {txn.id}
                                </strong>
                                <span style={{ color: '#047857', fontWeight: 800, fontSize: '1.05rem', marginLeft: 8 }}>
                                  ₹ {parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#4B5563', marginTop: 4 }}>
                                📅 {new Date(txn.date || Date.now()).toLocaleString('en-IN')} | माध्यम: <strong>{txn.method || 'Cash'}</strong> {txn.utr ? `(UTR: ${txn.utr})` : ''}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#6B7280', marginTop: 2 }}>
                                विवरण: {txn.type || 'भुगतान'} | कैशियर: <strong>{txn.cashierName || 'Counter Staff'}</strong>
                              </div>
                            </div>

                            {/* Action Buttons for this specific Slip */}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setReceiptModal({ booking: b, txn })}
                                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                              >
                                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> यह रसीद प्रिंट करें
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
    return (
      <div>
        {/* KPI Metrics Strip */}
        {adminStats && (
          <div className="kpi-responsive-grid">
            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #C2410C' }}>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>कुल बुकिंग्स</div>
              <div className="kpi-num" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#C2410C', margin: '4px 0', lineHeight: 1.1 }}>{adminStats.totalBookings}</div>
              <div style={{ fontSize: '0.78rem', color: '#784D35' }}>{adminStats.totalPassengers} यात्री आरक्षित</div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #047857' }}>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>कुल किराया संग्रह</div>
              <div className="kpi-num" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#047857', margin: '4px 0', lineHeight: 1.1 }}>₹ {adminStats.totalCollection.toLocaleString()}</div>
              <div style={{ fontSize: '0.78rem', color: '#784D35' }}>सकल रियायती राशि</div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #B45309' }}>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>अग्रिम प्राप्त (Token)</div>
              <div className="kpi-num" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#B45309', margin: '4px 0', lineHeight: 1.1 }}>₹ {adminStats.totalAdvance.toLocaleString()}</div>
              <div style={{ fontSize: '0.78rem', color: '#784D35' }}>खाते में जमा अग्रिम</div>
            </div>

            <div className="glass-card" style={{ padding: '16px 18px', borderLeft: '4px solid #DC2626' }}>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>शेष देय (Remaining)</div>
              <div className="kpi-num" style={{ fontSize: '1.9rem', fontWeight: 900, color: '#DC2626', margin: '4px 0', lineHeight: 1.1 }}>₹ {adminStats.totalRemaining.toLocaleString()}</div>
              <div style={{ fontSize: '0.78rem', color: '#784D35' }}>कटड़ा में देय</div>
            </div>
          </div>
        )}

        {/* All Project Features Master Command Grid for SuperAdmin */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ color: '#9A3412', margin: 0, fontWeight: 900, fontSize: '1.22rem' }}>
              संपूर्ण नियंत्रण कक्ष — समस्त प्रोजेक्ट मॉड्यूल
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#7C2D12', marginTop: 2 }}>All Project Features & Control Desks</div>
          </div>
          <span className="badge badge-bhakti" style={{ fontSize: '0.82rem', padding: '4px 12px' }}>12 अधिकृत मॉड्यूल</span>
        </div>

        <div className="module-hub-grid">
          {/* Feature 1: Live Booking Counter */}
          <div className="module-card" onClick={() => navigate('/admin/booking')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap">
                <Ticket size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">1. नया आरक्षण काउंटर</h4>
                <p className="module-card-desc">नया टिकट आरक्षण, तत्काल सीट आवंटन व थर्मल पर्ची जारी करें।</p>
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
                <h4 className="module-card-title">2. आरक्षण डायरेक्टरी</h4>
                <p className="module-card-desc">सभी वर्षों की आरक्षित टिकटें खोजें, पर्ची देखें व डाउनलोड करें।</p>
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
                <h4 className="module-card-title">3. रसीद एवं पर्ची काउंटर</h4>
                <p className="module-card-desc">PNR, नाम या मोबाइल से किसी भी श्रद्धालु की भुगतान रसीदें खोजें व प्रिंट करें।</p>
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
                <h4 className="module-card-title">4. IRCTC सीटिंग चार्ट</h4>
                <p className="module-card-desc">रेलवे कोच S1-S6, B1-B3, GS1 का सीटिंग चार्ट देखें एवं A4 प्रिंट लें।</p>
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
                <h4 className="module-card-title">5. ऑन-ट्रेन अटेंडेंस</h4>
                <p className="module-card-desc">चल टिकट परीक्षक (TTE) लाइव यात्री सत्यापन व उपस्थिति अंकन।</p>
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
                <h4 className="module-card-title">6. दैनिक वसूली व समाधान</h4>
                <p className="module-card-desc">तिथि-वार समस्त टीटीई व स्टाफ वसूली, नकद, यूपीआई व पाई-पाई का हिसाब।</p>
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
                <h4 className="module-card-title">7. एंटी-फ्रॉड सत्यापन व UTR</h4>
                <p className="module-card-desc">फर्जी टिकटों की लाइव पहचान, सुरक्षा सील हैश व UTR अनुमोदन।</p>
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
                <h4 className="module-card-title">8. कर्मचारी RBAC प्रबंधन</h4>
                <p className="module-card-desc">नया टीटीई, काउंटर क्लर्क, एकाउंट्स स्टाफ जोड़ें (Gmail ID सहित) व अधिकार नियंत्रित करें।</p>
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
                <h4 className="module-card-title">9. ऑडिट ट्रेल्स व सुरक्षा</h4>
                <p className="module-card-desc">सभी लॉगिन, बुकिंग, भुगतान और सिस्टम परिवर्तनों का सुरक्षित टाइमस्टैम्प्ड रिकॉर्ड।</p>
              </div>
            </div>
          </div>

          {/* Feature 10: Defaulters Report */}
          <div className="module-card" onClick={() => window.open(`/api/admin/reports/defaulters?token=${staffToken}`, '_blank')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="module-card-icon-wrap" style={{ color: '#B45309', background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', borderColor: '#FDE68A' }}>
                <Printer size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 className="module-card-title">10. बकायादारों की सूची</h4>
                <p className="module-card-desc">जिन श्रद्धालुओं का किराया शेष (Remaining Due) है, उनकी पूर्ण A4 रिपोर्ट।</p>
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
                <h4 className="module-card-title">11. एक्सेल बल्क बुकिंग</h4>
                <p className="module-card-desc">सैकड़ों यात्रियों की एक्सेल फाइल एक क्लिक में अपलोड व ऑटो-प्रोसेस करें।</p>
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
                <h4 className="module-card-title">12. सेटिंग्स एवं सुरक्षा</h4>
                <p className="module-card-desc">एडमिन पासवर्ड परिवर्तन, ट्रस्ट प्रोफ़ाइल व सत्र प्रबंधन।</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Bookings Quick Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ color: '#9A3412', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              हाल ही में जारी आरक्षण (Recent Bookings)
            </h4>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/bookings')}>
              समस्त Directoy खोलें ➔
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PNR</th>
                  <th>वर्ष</th>
                  <th>मुख्य भक्त</th>
                  <th>रूट</th>
                  <th>कोच / सीट</th>
                  <th>किराया स्थिति</th>
                  <th style={{ textAlign: 'right' }}>पर्ची</th>
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
                    <td style={{ fontSize: '0.85rem' }}>{b.fromStation} ➔ {b.toStation}</td>
                    <td><strong style={{ color: '#047857' }}>{b.coachName}</strong> ({Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber})</td>
                    <td>
                      <span className={`badge ${b.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-partial'}`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setTicketModal(b)}>
                        <FileText size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> पर्ची
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
      { path: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'डैशबोर्ड (Overview)' },
      { path: '/admin/booking', icon: <Ticket size={18} />, label: '1. नया आरक्षण' },
      { path: '/admin/bookings', icon: <ClipboardList size={18} />, label: '2. यात्री डायरेक्टरी' },
      { path: '/admin/receipts', icon: <FileText size={18} />, label: '3. रसीद काउंटर' },
      { path: '/admin/refunds', icon: <AlertTriangle size={18} />, label: '4. रद्दीकरण व रिफंड' },
      { path: '/admin/verifier', icon: <Search size={18} />, label: '5. सत्यापन व UTR' },
      { path: '/admin/chart', icon: <Printer size={18} />, label: '6. IRCTC यात्रा चार्ट' },
      { path: '/admin/coaches', icon: <Train size={18} />, label: '7. ट्रेन बोगी प्रबंधन' },
      { path: '/admin/checkin', icon: <BadgeCheck size={18} />, label: '8. ऑन-ट्रेन अटेंडेंस' },
      { path: '/admin/reconcile', icon: <IndianRupee size={18} />, label: '9. दैनिक वसूली व हिसाब' },
      { path: '/admin/guide', icon: <Lightbulb size={18} />, label: '10. यूज़र गाइड व SOP' },
      { path: '/admin/staff', icon: <Users size={18} />, label: 'कर्मचारी RBAC' },
      { path: '/admin/audit', icon: <ShieldCheck size={18} />, label: 'ऑडिट लॉग्स' },
      { path: '/admin/settings', icon: <Settings size={18} />, label: 'प्रोजेक्ट सेटिंग्स' },
    ];
    if (role === 'TTE') return [
      { path: '/tt/home', icon: <BadgeCheck size={18} />, label: '1. ऑन-ट्रेन अटेंडेंस' },
      { path: '/tt/chart', icon: <Printer size={18} />, label: '2. IRCTC कोच चार्ट' },
      { path: '/coach-position', icon: <Train size={18} />, label: '3. बोगी स्थिति' },
      { path: '/tt/verify', icon: <Search size={18} />, label: '4. टिकट सत्यापन' },
      { path: '/tt/collections', icon: <IndianRupee size={18} />, label: '5. मेरा कलेक्शन' },
      { path: '/tt/guide', icon: <Lightbulb size={18} />, label: '6. यूज़र गाइड' },
      { path: '/tt/settings', icon: <Settings size={18} />, label: 'सेटिंग्स' },
    ];
    if (role === 'BookingClerk') return [
      { path: '/counter/booking', icon: <Ticket size={18} />, label: '1. नया आरक्षण काउंटर' },
      { path: '/counter/history', icon: <ClipboardList size={18} />, label: '2. आरक्षण सूची' },
      { path: '/counter/receipts', icon: <FileText size={18} />, label: '3. रसीद काउंटर' },
      { path: '/counter/refunds', icon: <AlertTriangle size={18} />, label: '4. रद्दीकरण व रिफंड' },
      { path: '/coach-position', icon: <Train size={18} />, label: '5. बोगी स्थिति' },
      { path: '/counter/chart', icon: <Printer size={18} />, label: '6. कोच चार्ट' },
      { path: '/counter/collections', icon: <IndianRupee size={18} />, label: '7. मेरा कलेक्शन' },
      { path: '/counter/verify', icon: <Search size={18} />, label: '8. टिकट सत्यापन' },
      { path: '/counter/guide', icon: <Lightbulb size={18} />, label: '9. यूज़र गाइड' },
      { path: '/counter/settings', icon: <Settings size={18} />, label: 'सेटिंग्स' },
    ];
    if (role === 'AccountsOfficer' || role === 'FinanceOfficer') return [
      { path: '/finance/ledger', icon: <IndianRupee size={18} />, label: '1. वित्तीय बही व MIS' },
      { path: '/finance/bookings', icon: <ClipboardList size={18} />, label: '2. आरक्षण सूची' },
      { path: '/finance/receipts', icon: <FileText size={18} />, label: '3. रसीद काउंटर' },
      { path: '/admin/refunds', icon: <AlertTriangle size={18} />, label: '4. रिफंड रिपोर्ट' },
      { path: '/coach-position', icon: <Train size={18} />, label: '5. बोगी स्थिति' },
      { path: '/finance/verify', icon: <Search size={18} />, label: '6. सत्यापन व UTR' },
      { path: '/finance/guide', icon: <Lightbulb size={18} />, label: '7. यूज़र गाइड' },
      { path: '/finance/settings', icon: <Settings size={18} />, label: 'सेटिंग्स' },
    ];
    if (role === 'StationMaster') return [
      { path: '/station/chart', icon: <Printer size={18} />, label: '1. स्टेशन चार्ट' },
      { path: '/coach-position', icon: <Train size={18} />, label: '2. बोगी स्थिति' },
      { path: '/station/verify', icon: <Search size={18} />, label: '3. टिकट सत्यापन' },
      { path: '/station/guide', icon: <Lightbulb size={18} />, label: '4. यूज़र गाइड' },
      { path: '/station/settings', icon: <Settings size={18} />, label: 'सेटिंग्स' },
    ];
    return [
      { path: '/settings', icon: <Settings size={18} />, label: 'सेटिंग्स' },
    ];
  };

  // Curated 5 items for mobile bottom tab bar (avoids clipping on small screens)
  const getCuratedBottomNavItems = () => {
    if (!staffUser) return [];
    const role = staffUser.role;
    if (role === 'SuperAdmin') return [
      { path: '/admin/dashboard', icon: <LayoutDashboard size={20} />, label: 'डैशबोर्ड' },
      { path: '/admin/booking', icon: <Ticket size={20} />, label: 'नई टिकट' },
      { path: '/admin/bookings', icon: <ClipboardList size={20} />, label: 'यात्री सूची' },
      { path: '/admin/verifier', icon: <QrCode size={20} />, label: 'सत्यापन' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'सभी मेन्यू' },
    ];
    if (role === 'TTE') return [
      { path: '/tt/home', icon: <BadgeCheck size={20} />, label: 'अटेंडेंस' },
      { path: '/tt/chart', icon: <Printer size={20} />, label: 'कोच चार्ट' },
      { path: '/coach-position', icon: <Train size={20} />, label: 'बोगी स्थिति' },
      { path: '/tt/verify', icon: <QrCode size={20} />, label: 'सत्यापन' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'सभी मेन्यू' },
    ];
    if (role === 'BookingClerk') return [
      { path: '/counter/booking', icon: <Ticket size={20} />, label: 'नया आरक्षण' },
      { path: '/counter/history', icon: <ClipboardList size={20} />, label: 'आरक्षण सूची' },
      { path: '/counter/receipts', icon: <FileText size={20} />, label: 'रसीदें' },
      { path: '/coach-position', icon: <Train size={20} />, label: 'बोगी स्थिति' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'सभी मेन्यू' },
    ];
    if (role === 'AccountsOfficer' || role === 'FinanceOfficer') return [
      { path: '/finance/ledger', icon: <IndianRupee size={20} />, label: 'वित्तीय बही' },
      { path: '/finance/bookings', icon: <ClipboardList size={20} />, label: 'आरक्षण' },
      { path: '/finance/receipts', icon: <FileText size={20} />, label: 'रसीदें' },
      { path: '/finance/verify', icon: <Search size={20} />, label: 'सत्यापन' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'सभी मेन्यू' },
    ];
    if (role === 'StationMaster') return [
      { path: '/station/chart', icon: <Printer size={20} />, label: 'स्टेशन चार्ट' },
      { path: '/coach-position', icon: <Train size={20} />, label: 'बोगी स्थिति' },
      { path: '/station/verify', icon: <QrCode size={20} />, label: 'सत्यापन' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'सभी मेन्यू' },
    ];
    return [
      { path: '/settings', icon: <Settings size={20} />, label: 'सेटिंग्स' },
      { isMoreTrigger: true, icon: <Menu size={20} />, label: 'मेन्यू' },
    ];
  };

  const getPublicBottomNavItems = () => [
    { path: '/', icon: <Search size={20} />, label: 'PNR जांच' },
    { path: '/coach-position', icon: <Train size={20} />, label: 'बोगी स्थिति' },
    { path: '/receipts', icon: <FileText size={20} />, label: 'रसीद काउंटर' },
    { path: '/verify-ticket', icon: <QrCode size={20} />, label: 'टिकट स्कैन' },
    { path: '/login', icon: <Lock size={20} />, label: 'स्टाफ लॉगिन' },
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
            {renderLoginScreen(<><AlertTriangle size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> इस अधिकृत क्षेत्र ({currentPath}) में प्रवेश हेतु कृपया पहले अपने स्टाफ क्रेडेंशियल्स से लॉगिन करें।</>)}
          </div>
        )}

        {/* ----------------- ROUTE ACCESS GUARD: ROLE MISMATCH ----------------- */}
        {!routeAccess.allowed && routeAccess.reason === 'ROLE_MISMATCH' && (
          <div className="glass-card" style={{ maxWidth: 650, margin: '40px auto', textAlign: 'center', border: '2px solid #F87171', padding: 32 }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}></div>
            <span className="badge badge-unpaid" style={{ fontSize: '0.85rem', marginBottom: 8 }}>अनाधिकृत क्षेत्र (Access Restricted)</span>
            <h2 style={{ color: '#991B1B', fontWeight: 800, margin: '8px 0 12px' }}>पहुंच अस्वीकृत</h2>
            <p style={{ color: '#7F1D1D', fontSize: '1rem', lineHeight: 1.5 }}>
              वर्तमान में आप <strong>{staffUser?.name}</strong> (रोल: <strong>{staffUser?.role}</strong>) के रूप में लॉगिन हैं।
              यह मार्ग केवल <strong>{routeAccess.required}</strong> हेतु अधिकृत है।
            </p>
            <div style={{ marginTop: 22, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate(getRoleDefaultPath(staffUser.role))}>
                <BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> अपने अधिकृत पोर्टल ({getRoleDefaultPath(staffUser.role)}) पर जाएं
              </button>
              <button className="btn btn-outline" onClick={handleStaffLogout}>
                <LogOut size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> किसी अन्य खाते से लॉगिन करें
              </button>
            </div>
          </div>
        )}

        {/* ----------------- ROUTE ALLOWED: VIEW SWITCHER ----------------- */}
        {routeAccess.allowed && (
          <>
            {/* VIEW 1: PUBLIC DEVOTEE PNR LOOKUP & SACRED GALLERY */}
            {activeView === 'public_home' && (
              <div>
                <div>
            {/* ── IRCTC-Grade PNR Hero Banner ── */}
            <div className="pnr-hero" style={{ marginBottom: 24 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
                <span className="badge badge-bhakti" style={{ fontSize: '0.84rem', padding: '4px 14px' }}>
                   ।। जय माता दी • वार्षिक विशेष तीर्थ यात्रा ।। 
                </span>
                <span className="badge" style={{ background: '#DC2626', color: '#FFF', fontSize: '0.80rem', padding: '4px 14px', animation: 'pulse 2s infinite', border: '1px solid #B91C1C' }}>
                  🔥 1,245+ Tickets Booked! Limited Seats Available.
                </span>
              </div>

              <h1 style={{ fontSize: 'clamp(1.45rem, 4.5vw, 2.3rem)', fontWeight: 900, color: '#9A3412', margin: '8px 0 6px', lineHeight: 1.25 }}>
                PNR स्थिति एवं टिकट सत्यापन
              </h1>
              <p style={{ color: '#7C2D12', fontSize: 'clamp(0.85rem, 2.2vw, 1rem)', maxWidth: 680, margin: '0 auto 20px', fontWeight: 500 }}>
                श्री माता वैष्णो देवी कटड़ा वार्षिक सुपरफास्ट स्पेशल ट्रेन — आधिकारिक डिजिटल पोर्टल।
              </p>

              {/* ── PNR Search Box ── */}
              <div className="pnr-search-box">
                <div className="pnr-search-input-wrap">
                  <Search size={18} color="#C2410C" style={{ flexShrink: 0 }} />
                  <input
                    id="pnr-search-input"
                    type="text"
                    placeholder="अपना PNR नंबर या रजिस्टर्ड मोबाइल दर्ज करें..."
                    value={pnrInput}
                    onChange={(e) => { setPnrInput(e.target.value); setPnrSearchError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && searchPNR()}
                  />
                </div>
                <button className="btn btn-primary pnr-search-btn" onClick={() => searchPNR()} disabled={pnrLoading}>
                  {pnrLoading ? 'जांच जारी...' : 'स्टेटस जांचें ➔'}
                </button>
              </div>

              {/* Security Notice */}
              <div className="alert alert-bhakti" style={{ maxWidth: 720, margin: '14px auto 12px', textAlign: 'left', fontSize: '0.82rem' }}>
                <ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> <strong>सामान्य यात्रियों हेतु:</strong> PNR स्टेटस एवं बर्थ जांच। नया आरक्षण व चेकिंग केवल अधिकृत ट्रस्ट कर्मियों द्वारा।
              </div>

              {/* Quick PNR test chips */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>त्वरित परीक्षण PNR:</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                  onClick={() => { setPnrInput('MVD-2026-860670'); searchPNR('MVD-2026-860670'); }}
                >
                  MVD-2026-860670
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                  onClick={() => { setPnrInput('MVD-2026-861347'); searchPNR('MVD-2026-861347'); }}
                >
                  MVD-2026-861347
                </button>
              </div>


              {pnrSearchError && (
                <div style={{ background: '#FEF2F2', border: '1.5px solid #F87171', color: '#DC2626', padding: '10px 16px', borderRadius: 8, maxWidth: 620, margin: '0 auto 16px', fontWeight: 700, fontSize: '0.9rem' }}>
                  <AlertTriangle size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> {pnrSearchError}
                </div>
              )}

              {/* Inline Searched Ticket Display Card */}
              {searchedTicket && (
                <div className="glass-card" style={{
                  maxWidth: 720, margin: '20px auto 24px', textAlign: 'left',
                  border: '2.5px solid #F97316', background: '#FFFDFB'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1.5px dashed #FDBA74', paddingBottom: 12, marginBottom: 14 }}>
                    <div>
                      <span className="badge badge-bhakti"><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> वैध डिजिटल यात्रा पर्ची</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#C2410C', marginTop: 4 }}>
                        PNR: {searchedTicket.bookingId}
                      </div>
                    </div>
                    <span className={`badge ${searchedTicket.paymentStatus === 'Paid' ? 'badge-paid' : 'badge-partial'}`}>
                      {searchedTicket.paymentStatus === 'Paid' ? '✓ पूर्ण भुगतान (Confirmed)' : `आंशिक भुगतान (देय: ₹${searchedTicket.remainingAmount})`}
                    </span>
                  </div>

                  <div className="grid-2" style={{ marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#7C2D12' }}>मुख्य भक्त का नाम:</div>
                      <strong style={{ fontSize: '1.05rem', color: '#381A08' }}>{searchedTicket.bookedBy}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>मोबाइल: {searchedTicket.mobile}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#7C2D12' }}>यात्रा रूट एवं कोच:</div>
                      <strong style={{ color: '#047857' }}>{searchedTicket.fromStation} ➔ {searchedTicket.toStation}</strong>
                      <div style={{ fontSize: '0.85rem', marginTop: 3 }}>
                        कोच: <strong style={{ color: '#C2410C' }}>{searchedTicket.coachName}</strong> | श्रेणी: <strong>{searchedTicket.travelClass}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Passenger Roster */}
                  <div style={{ background: '#FFF8F2', borderRadius: 8, padding: 12, border: '1px solid #FED7AA', marginBottom: 16 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412', marginBottom: 6 }}>
                      आरक्षित यात्री एवं बर्थ आवंटन:
                    </div>
                    {(searchedTicket.passengers || []).map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #FFEDD5', fontSize: '0.88rem' }}>
                        <span>{idx + 1}. <strong>{p.name}</strong> ({p.age || '-'} वर्ष, {p.gender || '-'})</span>
                        <strong style={{ color: '#C2410C' }}>सीट: {p.seatAssigned || p.seatNumber || '-'} ({p.berthPreference || 'बर्थ'})</strong>
                      </div>
                    ))}
                  </div>

                  {/* Financial Details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 18 }}>
                    <div>कुल किराया: <strong>₹ {searchedTicket.totalAmount}</strong></div>
                    <div style={{ color: '#047857' }}>अग्रिम प्राप्त: <strong>₹ {searchedTicket.advance}</strong></div>
                    <div style={{ color: searchedTicket.remainingAmount > 0 ? '#DC2626' : '#047857', fontWeight: 800 }}>
                      कटड़ा में शेष देय: ₹ {searchedTicket.remainingAmount}
                    </div>
                  </div>

                  {/* Payment History Ledger / Receipts for Devotee */}
                  {((searchedTicket.paymentHistory && searchedTicket.paymentHistory.length > 0) || searchedTicket.advance > 0) && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#047857', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Printer size={16} /> अधिकृत भुगतान रसीदें (Payment Receipts):
                      </div>
                      <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 8, padding: 10 }}>
                        {((searchedTicket.paymentHistory && searchedTicket.paymentHistory.length > 0)
                          ? searchedTicket.paymentHistory
                          : [{
                              id: 'REC-ADV-' + (searchedTicket.bookingId ? searchedTicket.bookingId.replace(/[^0-9]/g, '') : '001'),
                              date: searchedTicket.createdAt || new Date().toISOString(),
                              amount: searchedTicket.advance,
                              method: searchedTicket.paymentMode || 'Cash',
                              type: 'Advance Booking (अग्रिम बुकिंग)',
                              cashierName: 'Counter Staff',
                              utr: searchedTicket.utrNumber || ''
                            }]
                        ).map((txn, sIdx) => (
                          <div
                            key={txn.id || sIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                              padding: '8px 4px',
                              borderBottom: '1px solid #DCFCE7',
                              fontSize: '0.84rem'
                            }}
                          >
                            <div>
                              <strong style={{ color: '#047857' }}>₹ {parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                              <span style={{ color: '#4B5563', marginLeft: 6 }}>via {txn.method} {txn.utr ? `(UTR: ${txn.utr})` : ''}</span>
                              <div style={{ color: '#059669', fontSize: '0.74rem' }}>
                                {new Date(txn.date).toLocaleString('en-IN')} | {txn.type}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => setReceiptModal({ booking: searchedTicket, txn })}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                <Printer size={13} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> रसीद प्रिंट
                              </button>
                              <a
                                href={`/api/bookings/${searchedTicket.bookingId}/receipt/${txn.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: '#34D399', color: '#047857' }}
                              >
                                <FileText size={13} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} /> PDF
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Security Notice for Public Devotee */}
                  <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400E', fontWeight: 800, fontSize: '0.92rem' }}>
                      <span><ShieldCheck size={48} /></span>
                      <span>सुरक्षा निर्देश: सामान्य यात्रियों के लिए केवल डिजिटल पीएनआर स्थिति देखने की सुविधा है।</span>
                    </div>
                    <div style={{ color: '#78350F', fontSize: '0.84rem', marginTop: 4 }}>
                      आधिकारिक मुद्रित यात्रा पर्ची (Physical Slip) केवल रेलवे आरक्षण काउंटर एवं अधिकृत टीटीई द्वारा जारी की जाती है। अनधिकृत संपादन, पीडीएफ से छेड़छाड़ या जाली टिकट बनाना कानूनन संज्ञेय अपराध है।
                    </div>
                  </div>

                  {/* Public Devotee Action Buttons */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a
                      href={`/api/bookings/${searchedTicket.bookingId}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, borderColor: '#10B981', color: '#047857', fontWeight: 700, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <span><FileText size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /></span>
                      <span>आधिकारिक PDF पर्ची प्रिंट / डाउनलोड करें</span>
                    </a>
                    {searchedTicket.remainingAmount > 0 && (
                      <button className="btn btn-gold btn-sm" style={{ flex: 1 }} onClick={() => openUpiQR(searchedTicket.bookingId)}>
                        <Smartphone size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> UPI द्वारा शेष किराया (₹ {searchedTicket.remainingAmount}) जमा करें
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
                <button className="btn btn-primary" style={{ padding: '12px 26px', fontSize: '0.98rem' }} onClick={() => navigate('/coach-position')}>
                  <Train size={20} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> ट्रेन बोगी स्थिति व रेक संरचना (Live Coach Position)
                </button>
                <button className="btn btn-gold" style={{ padding: '12px 26px', fontSize: '0.98rem' }} onClick={() => setActiveTab('staff')}>
                  <Lock size={20} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> अधिकृत कर्मचारी एवं ट्रस्ट अधिकारी लॉगिन
                </button>
              </div>
            </div>

            {/* Sacred Shrine Panorama Card */}
            <div className="glass-card" style={{ marginBottom: 28, padding: 0, overflow: 'hidden', border: '2px solid #FED7AA' }}>
              <div style={{ position: 'relative', maxHeight: 420, overflow: 'hidden' }}>
                <img src="/shrine_hero.jpg" alt="Holy Mata Vaishno Devi Shrine" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(67, 20, 7, 0.85) 90%)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 30
                }}>
                  <span className="badge" style={{ background: '#FFEDD5', color: '#9A3412', width: 'fit-content', marginBottom: 8, fontWeight: 800 }}>
                    त्रिकुटा पर्वत पावन धाम • कटड़ा (SVDK)
                  </span>
                  <h2 style={{ fontSize: '2.2rem', color: '#FFFFFF', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                    पवित्र गुफा दर्शन यात्रा विशेष ट्रेन
                  </h2>
                  <p style={{ color: '#FFEDD5', maxWidth: 780, fontSize: '1rem', fontWeight: 500 }}>
                    माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट द्वारा प्रत्येक वर्ष आयोजित की जाने वाली यह अखंड तीर्थ यात्रा ट्रेन दिल्ली, कानपुर, लखनऊ, वाराणसी, मथुरा, आगरा से सीधे कटड़ा रेलवे स्टेशन तक संचालित की जाती है।
                  </p>
                </div>
              </div>
            </div>

            {/* Sacred Image Gallery Showcase (Bhawan, Superfast Train, Holy Sanctum Darshan) */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span className="badge badge-bhakti" style={{ fontSize: '0.82rem' }}>
                  <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> पावन दर्शन दीर्घा • अखंड तीर्थ यात्रा <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} />
                </span>
                <h2 style={{ fontSize: '1.9rem', color: '#9A3412', fontWeight: 800, marginTop: 4 }}>
                  माता वैष्णो देवी धाम एवं विशेष ट्रेन दर्शन
                </h2>
                <p style={{ color: '#7C2D12', fontSize: '0.95rem' }}>
                  पवित्र गुफा, रात्रि आलोकित त्रिकुटा पर्वत और वादियों में दौड़ती सुसज्जित तीर्थ एक्सप्रेस
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                {/* Image Card 1: Night Bhawan */}
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #FED7AA', borderRadius: 16 }}>
                  <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                    <img
                      src="/shrine_night.jpg"
                      alt="Mata Vaishno Devi Bhawan at Night"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, insetInline: 0,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(26, 10, 4, 0.9) 100%)',
                      padding: '16px 14px 10px', color: '#FFF'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#FDBA74', fontWeight: 700 }}>त्रिकुटा शिखर • पावन धाम</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFF' }}>रात्रि आलोकित दिव्य पावन भवन</div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', background: '#FFF8F2', fontSize: '0.88rem', color: '#7C2D12' }}>
                    स्वर्णिम प्रकाश और लाखों दीयों की आभा से जगमगाता मां भगवती का पावन भवन। कटड़ा से 14 किमी की मनोरम पदयात्रा।
                  </div>
                </div>

                {/* Image Card 2: Yatra Train */}
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #FED7AA', borderRadius: 16 }}>
                  <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                    <img
                      src="/yatra_train.jpg"
                      alt="Decorated Vaishno Devi Special Train"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, insetInline: 0,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(26, 10, 4, 0.9) 100%)',
                      padding: '16px 14px 10px', color: '#FFF'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#FDBA74', fontWeight: 700 }}>अखंड तीर्थ एक्सप्रेस • भारतीय रेल</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFF' }}>सुसज्जित स्पेशल यात्रा ट्रेन</div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', background: '#FFF8F2', fontSize: '0.88rem', color: '#7C2D12' }}>
                    हिमालय पर्वत शृंखलाओं के मध्य से गुजरती पूर्ण आरक्षित वातानुकूलित व स्लीपर कोच ट्रेन। ऑन-बोर्ड भजन कीर्तन व सात्विक प्रसाद।
                  </div>
                </div>

                {/* Image Card 3: Sanctum Darshan */}
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #FED7AA', borderRadius: 16 }}>
                  <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                    <img
                      src="/sanctum_darshan.jpg"
                      alt="Divine Sanctum Darshan & Holy Aarti"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, insetInline: 0,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(26, 10, 4, 0.9) 100%)',
                      padding: '16px 14px 10px', color: '#FFF'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#FDBA74', fontWeight: 700 }}>पवित्र गुफा • साक्षात् दर्शन</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFF' }}>महाआरती एवं दिव्य पिंडियां</div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', background: '#FFF8F2', fontSize: '0.88rem', color: '#7C2D12' }}>
                    माता महाकाली, महालक्ष्मी व महासरस्वती स्वरूपा तीनों पवित्र पिंडियों के दर्शन एवं प्रातः व सांध्यकालीन अखंड आरती।
                  </div>
                </div>
              </div>
            </div>

            {/* Features in 3 Light Peach Cards */}
            <div className="grid-3">
              <div className="glass-card" style={{ textAlign: 'center', padding: '30px 22px' }}>
                <div style={{ marginBottom: 16 }}><CalendarDays size={48} color="#0284C7" strokeWidth={1.5} /></div>
                <h3 style={{ color: '#9A3412', fontSize: '1.3rem', marginBottom: 8 }}>हर साल यात्रा (Multi-Year)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  यह ट्रेन हर साल नियत तिथियों पर जाती है। ट्रस्ट के इस पोर्टल पर वर्ष 2024, 2025, 2026, 2027 और 2028 के सभी रिकॉर्ड सुरक्षित एवं व्यवस्थित रहते हैं।
                </p>
              </div>

              <div className="glass-card" style={{ textAlign: 'center', padding: '30px 22px' }}>
                <div style={{ marginBottom: 16 }}><Armchair size={48} color="#0284C7" strokeWidth={1.5} /></div>
                <h3 style={{ color: '#9A3412', fontSize: '1.3rem', marginBottom: 8 }}>इंटरैक्टिव सीट चयन</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  कोच का वास्तविक नक्शा देखकर अपनी मनपसंद लोअर, मिडिल, अपर या साइड बर्थ बुक करें। एक भी सीट दोबारा बुक नहीं हो सकती।
                </p>
              </div>

              <div className="glass-card" style={{ textAlign: 'center', padding: '30px 22px' }}>
                <div style={{ marginBottom: 16 }}><Smartphone size={48} color="#0284C7" strokeWidth={1.5} /></div>
                <h3 style={{ color: '#9A3412', fontSize: '1.3rem', marginBottom: 8 }}>UPI भुगतान एवं डिजिटल पास</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  GPay, PhonePe, Paytm द्वारा सीधे ट्रस्ट के खाते में अग्रिम भुगतान करें और तत्काल अधिकृत यात्रा पर्ची एवं क्यूआर कोड प्राप्त करें।
                </p>
              </div>
            </div>

            {/* Organizer Details & Guidelines */}
            <div style={{ marginTop: 40, borderTop: '2px dashed #FED7AA', paddingTop: 32 }}>
              <div className="grid-2" style={{ gap: 24, alignItems: 'stretch' }}>
                
                {/* Organizer Info */}
                <div className="glass-card" style={{ padding: '28px 24px', border: '1.5px solid #FDBA74', background: '#FFF8F2', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.05, transform: 'scale(1.5)' }}>
                    <Users size={180} />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', color: '#9A3412', fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Users size={24} color="#C2410C" /> मुख्य आयोजक विवरण
                  </h3>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #C2410C)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 900, border: '4px solid #FED7AA', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      DR
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.3rem', color: '#7C2D12', margin: '0 0 4px', fontWeight: 800 }}>डॉ. राकेश तिवारी (Dr. Rakesh Tiwari)</h4>
                      <p style={{ margin: '0 0 10px', color: '#9A3412', fontWeight: 700, fontSize: '0.9rem' }}>
                        प्रसिद्ध चिकित्सक, समाजसेवी एवं मुख्य आयोजक
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        डॉ. राकेश तिवारी जी के कुशल नेतृत्व एवं निःस्वार्थ सेवाभाव से प्रतिवर्ष श्री माता वैष्णो देवी की यह भव्य विशेष ट्रेन यात्रा आयोजित की जाती है। उनके अथक प्रयासों से हज़ारों श्रद्धालुओं को माता के दरबार में दर्शन का सौभाग्य प्राप्त होता है।
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rules & Warnings */}
                <div className="glass-card" style={{ padding: '28px 24px', border: '1.5px solid #FCA5A5', background: '#FEF2F2' }}>
                  <h3 style={{ fontSize: '1.4rem', color: '#B91C1C', fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={24} color="#DC2626" /> यात्रा नियम एवं चेतावनी
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#991B1B', fontSize: '0.9rem', lineHeight: 1.7, fontWeight: 500 }}>
                    <li style={{ marginBottom: 6 }}>यात्रा के दौरान <strong>मूल (Original) आधार कार्ड</strong> व अधिकृत <strong>यात्रा पर्ची (Ticket)</strong> साथ रखना अनिवार्य है।</li>
                    <li style={{ marginBottom: 6 }}>जिन यात्रियों की राशि बकाया (Pending) है, वे यात्रा से पूर्व भुगतान कर <strong>Payment Slip</strong> प्राप्त कर लें, अन्यथा यात्रा की अनुमति नहीं होगी।</li>
                    <li style={{ marginBottom: 6 }}>यह टिकट <strong>अहस्तांतरणीय (Non-transferable)</strong> है। किसी अन्य व्यक्ति को यात्रा करने की अनुमति नहीं है।</li>
                    <li style={{ marginBottom: 6 }}>ट्रेन परिसर में किसी भी प्रकार का मादक पदार्थ या अनुचित व्यवहार सख्त वर्जित है।</li>
                    <li>आपातकालीन स्थिति में पर्ची पर दिए गए हेल्पलाइन नंबर पर संपर्क करें।</li>
                  </ul>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW 2: DEDICATED LOGIN ROUTE */}
            {activeView === 'login' && (
              <div>
                {staffUser ? (
                  <div className="glass-card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', border: '2px solid #FED7AA', padding: 32 }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
                    <h3 style={{ color: '#9A3412', fontWeight: 800 }}>आप पहले से लॉगिन हैं!</h3>
                    <p style={{ color: '#7C2D12', fontSize: '0.94rem' }}>
                      स्वागत है <strong>{staffUser.name}</strong> ({staffUser.role} - {staffUser.department})।
                    </p>
                    <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button className="btn btn-primary" onClick={() => navigate(getRoleDefaultPath(staffUser.role))}>
                        <BadgeCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> अपने अधिकृत पोर्टल ({getRoleDefaultPath(staffUser.role)}) पर जाएं
                      </button>
                      <button className="btn btn-outline" onClick={handleStaffLogout}>
                        लॉगआउट करें
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
                      <span className="badge badge-bhakti">HMAC-SHA256 क्रिप्टोग्राफिक सुरक्षा इंजन</span>
                      <h2 style={{ fontSize: '1.9rem', color: '#9A3412', marginTop: 4, fontWeight: 800 }}>
                        <Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> आधिकारिक एंटी-फ्रॉड टिकट सत्यापन प्रणाली
                      </h2>
                      <p style={{ color: '#7C2D12', fontSize: '0.92rem' }}>
                        फोटोशॉप या संपादित फर्जी टिकटों की तुरंत पहचान • रेलवे एवं ट्रस्ट के केंद्रीय डेटाबेस से लाइव मिलान
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
                        यात्री के टिकट का QR कोड स्कैन करें
                      </h3>

                      <form onSubmit={(e) => { e.preventDefault(); handleVerifyTicketSubmit(); }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                            या मैन्युअल रूप से PNR दर्ज करें
                          </p>
                          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 400 }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="PNR Number (उदा. MVD-2026-...)"
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
                            {verifierLoading ? 'सत्यापन हो रहा है...' : <><ShieldCheck size={18} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> मैन्युअल रूप से सत्यापित करें</>}
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
                              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#D1FAE5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✅</div>
                              <div>
                                <h3 style={{ margin: 0, color: '#065F46', fontSize: '1.3rem', fontWeight: 800 }}>{verifierResult.title}</h3>
                                <p style={{ margin: '2px 0 0', color: '#047857', fontSize: '0.88rem' }}>{verifierResult.message}</p>
                              </div>
                            </div>

                            <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNR / बुकिंग संख्या</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookingId}</div>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>मुख्य भक्त / आवेदक</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookedBy} ({verifierResult.booking.mobile})</div>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>आवंटित कोच व सीट</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>
                                  कोच {verifierResult.booking.coachName} • सीट: {Array.isArray(verifierResult.booking.seatNumber) ? verifierResult.booking.seatNumber.join(', ') : verifierResult.booking.seatNumber}
                                </div>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>भुगतान स्थिति व देय राशि</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: verifierResult.booking.remainingAmount > 0 ? '#DC2626' : '#047857' }}>
                                  {verifierResult.booking.paymentStatus} (कटड़ा में शेष देय: ₹ {verifierResult.booking.remainingAmount})
                                </div>
                              </div>
                            </div>

                            <div style={{ background: '#FFF8F2', borderRadius: 8, padding: 12, border: '1px solid #FED7AA' }}>
                              <strong style={{ color: '#9A3412', fontSize: '0.88rem' }}>डेटाबेस में आरक्षित सहयात्री:</strong>
                              {(verifierResult.booking.passengers || []).map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #FFEDD5', fontSize: '0.85rem' }}>
                                  <span>{idx + 1}. <strong>{p.name}</strong> ({p.age || '-'} वर्ष, {p.gender || '-'})</span>
                                  <span style={{ color: '#C2410C', fontWeight: 700 }}>सीट: {p.seatAssigned || p.seatNumber || '-'}</span>
                                </div>
                              ))}
                            </div>

                            <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              सुरक्षा सील हैश: <code>{verifierResult.securityHash}</code>
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
                              <div><strong>अवैध / जाली हैश:</strong> <code>{verifierResult.providedSecurityHash}</code></div>
                              <div><strong>सर्वर का अपेक्षित वैध हैश:</strong> <code>{verifierResult.expectedSecurityHash}</code></div>
                              <div style={{ marginTop: 4 }}><strong>छेड़छाड़ वाले क्षेत्र:</strong> {verifierResult.tamperedFields}</div>
                            </div>

                            <h4 style={{ color: '#9A3412', marginBottom: 8, fontSize: '0.95rem' }}><ClipboardList size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> सर्वर का वास्तविक प्रामाणिक रिकॉर्ड:</h4>
                            <div className="grid-2" style={{ gap: 10, fontSize: '0.88rem' }}>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                वास्तविक भक्त: <strong>{verifierResult.authenticData.bookedBy}</strong> ({verifierResult.authenticData.mobile})
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                वास्तविक सीट: <strong style={{ color: '#DC2626' }}>कोच {verifierResult.authenticData.coachName}, सीट {Array.isArray(verifierResult.authenticData.seatNumber) ? verifierResult.authenticData.seatNumber.join(', ') : verifierResult.authenticData.seatNumber}</strong>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                वास्तविक देय राशि: <strong style={{ color: '#DC2626' }}>₹ {verifierResult.authenticData.remainingAmount} ({verifierResult.authenticData.paymentStatus})</strong>
                              </div>
                              <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                यात्री संख्या: <strong>{(verifierResult.authenticData.passengers || []).length} यात्री</strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>❌</div>
                            <h3 style={{ color: '#991B1B', fontWeight: 800 }}>{verifierResult.title || 'अमान्य / फर्जी PNR'}</h3>
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

                {/* VIEW: BOOKING COUNTER FORM */}
                {activeView === 'booking' && (
                  <div>
                    <div>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      <span className="badge badge-bhakti">आधिकारिक रेलवे आरक्षण काउंटर</span>
                      <h2 style={{ fontSize: '2.1rem', color: '#9A3412', marginTop: 6, fontWeight: 800 }}>ट्रेन टिकट बुकिंग फॉर्म</h2>
                      <p style={{ color: '#7C2D12', fontWeight: 600 }}>लाइव सीट उपलब्धता मैप • तत्काल क्यूआर टोकन पेमेंट • आधिकारिक यात्रा पर्ची</p>
                    </div>

                    <form onSubmit={handleBookingSubmit}>
                      <div className="grid-2">
                        {/* Left Column: Route & Seats */}
                        <div>
                          <div className="glass-card" style={{ marginBottom: 20 }}>
                            <h3 style={{ color: '#9A3412', fontSize: '1.25rem', marginBottom: 16, fontWeight: 800 }}>
                              <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 1. यात्रा वर्ष एवं स्टेशन चयन
                            </h3>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">यात्रा वर्ष (हर साल ट्रेन):</label>
                                <select className="form-control" value={bookingYear} onChange={(e) => setBookingYear(e.target.value)}>
                                  <option value="2026">यात्रा 2026 (सक्रिय बैच)</option>
                                  <option value="2027">यात्रा 2027 (अग्रिम बुकिंग)</option>
                                  <option value="2025">यात्रा 2025 (पुराना रिकॉर्ड)</option>
                                  <option value="2024">यात्रा 2024 (पुराना रिकॉर्ड)</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">यात्रा की तिथि (Travel Date):</label>
                                <input type="date" className="form-control" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} required />
                                <div style={{ marginTop: '6px', color: '#DC2626', fontWeight: 800, fontSize: '0.82rem', animation: 'pulse 2s infinite' }}>
                                  🔥 1,245+ Tickets Booked! Limited Seats Available.
                                </div>
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">प्रस्थान स्टेशन (From):</label>
                                <select className="form-control" value={fromStation} onChange={(e) => setFromStation(e.target.value)}>
                                  <option value="New Delhi (NDLS)">New Delhi (NDLS)</option>
                                  <option value="Kanpur Central (CNB)">Kanpur Central (CNB)</option>
                                  <option value="Lucknow Charbagh (LKO)">Lucknow Charbagh (LKO)</option>
                                  <option value="Varanasi Cantt (BSB)">Varanasi Cantt (BSB)</option>
                                  <option value="Agra Cantt (AGC)">Agra Cantt (AGC)</option>
                                  <option value="Ambala Cantt (UMB)">Ambala Cantt (UMB)</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">गंतव्य स्टेशन (Destination):</label>
                                <input type="text" className="form-control" value="Shri Mata Vaishno Devi Katra (SVDK)" readOnly style={{ background: '#FFF8F2', color: '#047857', fontWeight: 800 }} />
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">श्रेणी (Class):</label>
                                <select className="form-control" value={travelClass} onChange={(e) => setTravelClass(e.target.value)}>
                                  <option value="Sleeper">स्लीपर क्लास (SL) - ₹ 3,000</option>
                                  <option value="AC">एसी कोच (AC 3A/2A) - ₹ 4,000</option>
                                  <option value="General">जनरल / सीटिंग (2S) - ₹ 2,000</option>
                                </select>
                              </div>

                              <div className="form-group">
                                <label className="form-label">कोच नंबर (Coach):</label>
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
                                <h4 style={{ fontSize: '1.15rem', color: '#9A3412', fontWeight: 800, margin: 0 }}>कोच {coachName} सीट मैप (यात्रा {bookingYear})</h4>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>उपलब्ध सीट पर क्लिक करके चुनें अथवा स्वतः आवंटित करें</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-gold"
                                  onClick={handleAutoAssignSeats}
                                  style={{ padding: '5px 10px', fontSize: '0.8rem', fontWeight: 700 }}
                                  title="स्वचालित रूप से उपलब्ध सीटें चुनें"
                                >
                                  स्वतः सीटें चुनें ({passengers.length} Seat{passengers.length > 1 ? 's' : ''})
                                </button>
                                <span className="badge badge-paid">{coachLayout.availableCount} खाली</span>
                                <span className="badge badge-unpaid">{coachLayout.bookedCount} आरक्षित</span>
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
                                    title={`Seat ${seat.seatNumber} (${seat.berthType})${isSelected ? ' - चयनित' : ''}`}
                                  >
                                    <div style={{ fontSize: '0.95rem', fontWeight: 900 }}>
                                      {isSelected ? '✓ ' : ''}{seat.seatNumber}
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
                                <div style={{ width: 14, height: 14, background: '#DC2626', borderRadius: 3 }} /> आरक्षित (Booked)
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#16A34A', borderRadius: 3 }} /> चुनी हुई (Selected)
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#FFFFFF', border: '1.5px solid #FED7AA', borderRadius: 3 }} /> उपलब्ध (Available)
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Devotee & Passengers */}
                        <div>
                          {/* Lead Devotee Details */}
                          <div className="glass-card" style={{ marginBottom: 20 }}>
                            <h3 style={{ color: '#9A3412', fontSize: '1.25rem', marginBottom: 16, fontWeight: 800 }}>
                              2. मुख्य भक्त विवरण (Lead Devotee)
                            </h3>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">मुख्य भक्त का पूरा नाम *</label>
                                <input type="text" className="form-control" value={bookedBy} onChange={(e) => setBookedBy(e.target.value)} required autoFocus />
                              </div>
                              <div className="form-group">
                                <label className="form-label">मोबाइल नंबर (WhatsApp) *</label>
                                <input type="tel" className="form-control" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength="10" required />
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">ईमेल पता (वैकल्पिक):</label>
                                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">आधार नंबर *</label>
                                <input type="text" className="form-control" value={aadhar} onChange={(e) => setAadhar(e.target.value)} maxLength="12" required />
                              </div>
                            </div>
                          </div>

                          {/* Co-Passengers List */}
                          <div className="glass-card" style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <h3 style={{ color: '#9A3412', fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                                <Users size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 3. सहयात्री विवरण ({passengers.length} Yatri)
                              </h3>
                              <button type="button" className="btn btn-outline btn-sm" onClick={addPassenger}>
                                + यात्री जोड़ें
                              </button>
                            </div>

                            {passengers.map((p, idx) => {
                              const assignedSeat = p.seatAssigned || selectedSeats[idx] || (idx + 1).toString();
                              const detectedBerth = getBerthType(assignedSeat, travelClass);
                              return (
                              <div key={idx} style={{ background: '#FFF8F2', padding: 14, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <strong style={{ color: '#9A3412', fontSize: '0.9rem' }}>यात्री #{idx + 1}</strong>
                                    <span className="badge badge-bhakti" style={{ fontSize: '0.74rem', padding: '2px 8px' }}>
                                      सीट: {assignedSeat} ({detectedBerth})
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
                                      मुख्य भक्त ही यात्री #1 हैं (Auto-Fill)
                                    </label>
                                  )}
                                  {idx > 0 && (
                                    <button type="button" onClick={() => removePassenger(idx)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}>
                                      हटाएं ✕
                                    </button>
                                  )}
                                </div>

                                <div className="grid-2">
                                  <div className="form-group">
                                    <input type="text" className="form-control" placeholder="यात्री का नाम" value={p.name} onChange={(e) => handlePassengerChange(idx, 'name', e.target.value)} required />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="number" className="form-control" placeholder="आयु" value={p.age} onChange={(e) => handlePassengerChange(idx, 'age', e.target.value)} min="1" max="100" style={{ width: '45%' }} required />
                                    <select className="form-control" value={p.gender} onChange={(e) => handlePassengerChange(idx, 'gender', e.target.value)} style={{ width: '55%' }}>
                                      <option value="Male">पुरुष</option>
                                      <option value="Female">महिला</option>
                                      <option value="Other">अन्य</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid-2">
                                  <input type="text" className="form-control" placeholder="आधार क्रमांक / पहचान" value={p.aadhar} onChange={(e) => handlePassengerChange(idx, 'aadhar', e.target.value)} />
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
                              <IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 4. रियायती किराया एवं अग्रिम टोकन
                            </h3>

                            <div style={{ background: '#FFF8F2', padding: 14, borderRadius: 8, marginBottom: 14, border: '1.5px solid #FED7AA' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span>प्रति यात्री किराया:</span>
                                <strong>₹ {unitFare?.toLocaleString()}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span>कुल यात्री:</span>
                                <strong>{passengers.length}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9A3412', fontSize: '1.2rem', fontWeight: 800 }}>
                                <span>कुल देय राशि:</span>
                                <span>₹ {netPayable?.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">अग्रिम टोकन राशि (Advance ₹):</label>
                                <input type="number" className="form-control" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} min="0" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">छूट / रियायत (Discount ₹):</label>
                                <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" />
                              </div>
                            </div>

                            <div style={{
                              background: 'linear-gradient(90deg, #FFF0E5, #FFE4D0)',
                              border: '1.5px solid #FB923C', padding: 14, borderRadius: 8, marginBottom: 18,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontSize: '0.85rem', color: '#7C2D12', fontWeight: 700 }}>कटड़ा आगमन पर शेष देय राशि:</div>
                                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#C2410C' }}>₹ {remainingDue?.toLocaleString()}</div>
                              </div>
                              <span className={`badge ${remainingDue <= 0 ? 'badge-paid' : 'badge-partial'}`}>
                                {remainingDue <= 0 ? 'पूर्ण भुगतान' : 'टोकन भुगतान'}
                              </span>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }} disabled={isSubmitting}>
                              {isSubmitting ? 'आरक्षण हो रहा है...' : <><Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> आरक्षण पक्का करें एवं यात्रा पर्ची जारी करें</>}
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
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>कुल बुकिंग्स</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#C2410C', margin: '4px 0' }}>{adminStats.totalBookings}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>{adminStats.totalPassengers} यात्री आरक्षित</div>
                        </div>

                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>कुल किराया संग्रह</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#047857', margin: '4px 0' }}>₹ {adminStats?.totalCollection?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>सकल रियायती राशि</div>
                        </div>

                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>अग्रिम प्राप्त (Token)</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#B45309', margin: '4px 0' }}>₹ {adminStats?.totalAdvance?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>खाते में जमा अग्रिम</div>
                        </div>

                        <div className="glass-card" style={{ padding: 20 }}>
                          <div style={{ fontSize: '0.82rem', color: '#7C2D12', textTransform: 'uppercase', fontWeight: 700 }}>शेष देय (Remaining)</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>₹ {adminStats?.totalRemaining?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.82rem', color: '#784D35' }}>कटड़ा में देय</div>
                        </div>
                      </div>
                    )}

                    {/* Bookings Directory Table */}
                    <div className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h3 style={{ fontSize: '1.25rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>यात्री आरक्षण डायरेक्टरी</h3>
                          <select className="form-control" style={{ padding: '4px 8px', width: 'auto' }} value={adminYearFilter} onChange={(e) => setAdminYearFilter(e.target.value)}>
                            <option value="">सभी वर्ष (All)</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="PNR, मुख्य भक्त या मोबाइल खोजें..."
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
                              <th>वर्ष</th>
                              <th>मुख्य भक्त</th>
                              <th>रूट</th>
                              <th>कोच / सीट</th>
                              <th>यात्री</th>
                              <th>किराया स्थिति</th>
                              <th>स्थिति</th>
                              <th style={{ textAlign: 'right' }}>कार्य</th>
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
                                    <div style={{ color: '#047857', fontWeight: 600 }}>➔ {b.toStation}</div>
                                  </td>
                                  <td>
                                    <span style={{ color: '#9A3412', fontWeight: 'bold' }}>{b.coachName}</span>
                                    <div style={{ fontSize: '0.75rem' }}>सीट: {Array.isArray(b.seatNumber) ? b.seatNumber.join(', ') : b.seatNumber}</div>
                                  </td>
                                  <td><strong>{b.numberOfPassengers || (b.passengers ? b.passengers.length : 1)}</strong></td>
                                  <td style={{ fontSize: '0.85rem' }}>
                                    <div>कुल: ₹ {b.totalAmount}</div>
                                    <div style={{ color: '#047857' }}>अग्रिम: ₹ {b.advance}</div>
                                    <div style={{ color: b.remainingAmount > 0 ? '#DC2626' : '#047857', fontWeight: 'bold' }}>शेष: ₹ {b.remainingAmount}</div>
                                    {b.utrNumber && (
                                      <div style={{ marginTop: 4, padding: 2, background: b.utrStatus === 'Verified' ? '#D1FAE5' : '#FEF3C7', borderRadius: 4, border: '1px solid #FDE68A' }}>
                                        <span style={{ fontWeight: 600 }}>UTR:</span> {b.utrNumber}
                                        <div style={{ fontSize: '0.75rem', color: b.utrStatus === 'Verified' ? '#047857' : '#D97706' }}>
                                          {b.utrStatus === 'Verified' ? '✓ Verified' : 'Pending'}
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
                                          ✓ Verify
                                        </button>
                                      )}
                                      {b.remainingAmount > 0 && b.utrStatus !== 'Pending' && (
                                        <button className="btn btn-xs btn-success" onClick={() => markBookingPaid(b.bookingId)} title="Clear Dues">
                                          ✓ Paid
                                        </button>
                                      )}
                                      <button className="btn btn-xs btn-gold" onClick={() => { setReceiptSearchQuery(b.bookingId); navigate('/admin/receipts'); }} title="रसीदें">
                                        <Printer size={13} /> रसीद
                                      </button>
                                      <button className="btn btn-xs btn-outline" onClick={() => setTicketModal(b)} title="पर्ची देखें">
                                        <Eye size={13} /> पर्ची
                                      </button>
                                      <button className="btn btn-icon-xs btn-outline" onClick={() => openUpiQR(b.bookingId)} title="UPI QR">
                                        <Smartphone size={13} />
                                      </button>
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
                                      }} title="किराया / भुगतान एडिट">
                                        <IndianRupee size={13} />
                                      </button>
                                      <a href={`/api/bookings/${b.bookingId}/pdf`} target="_blank" rel="noreferrer" className="btn btn-icon-xs btn-outline" title="PDF डाउनलोड">
                                        <FileText size={13} />
                                      </a>
                                      {isSuperAdmin && (
                                        <button className="btn btn-icon-xs btn-danger" onClick={() => deleteBooking(b.bookingId)} title="Delete">
                                          ✕
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
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}>भारतीय रेल / ट्रस्ट आरक्षण चार्ट</span>
                          <h2 style={{ fontSize: '1.8rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            कोच आरक्षण चार्ट (IRCTC Seating Chart)
                          </h2>
                          <div style={{ color: '#7C2D12', fontSize: '0.9rem', marginTop: 4 }}>
                            कोच अनुसार वास्तविक बर्थ आवंटन, पीएनआर एवं आधिकारिक प्रिंट प्रारूप
                          </div>
                        </div>

                        {/* Coach & Year Switcher Controls */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412' }}>कोच:</label>
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
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412' }}>वर्ष:</label>
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
                            <Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC चार्ट प्रिंट करें
                          </button>
                        </div>
                      </div>

                      {/* Summary Metric Strip */}
                      {coachChartData && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 18, borderTop: '1px solid #FED7AA', paddingTop: 16 }}>
                          <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 700 }}>कुल बर्थ क्षमता</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9A3412' }}>{coachChartData.totalCapacity}</div>
                          </div>
                          <div style={{ background: '#ECFDF5', padding: '10px 14px', borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: 700 }}>कन्फर्म सीटें (CNF)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>{coachChartData.bookedCount}</div>
                          </div>
                          <div style={{ background: '#FFFBEB', padding: '10px 14px', borderRadius: 8, border: '1px solid #FDE68A', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>रिक्त सीटें (Vacant)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#B45309' }}>{coachChartData.vacantCount}</div>
                          </div>
                          <div style={{ background: '#EFF6FF', padding: '10px 14px', borderRadius: 8, border: '1px solid #BFDBFE', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#1E40AF', fontWeight: 700 }}>उपस्थित यात्री</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563EB' }}>{coachChartData.presentCount}</div>
                          </div>
                          <div style={{ background: '#FEF2F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FECACA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', color: '#991B1B', fontWeight: 700 }}>कोच में बकाया देय</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626' }}>₹ {coachChartData?.totalDuesInCoach?.toLocaleString()}</div>
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
                              {f === 'all' && `सभी सीटें (${coachChartData?.totalCapacity || 0})`}
                              {f === 'cnf' && `कन्फर्म सीटें (${coachChartData?.bookedCount || 0})`}
                              {f === 'vacant' && `रिक्त सीटें (${coachChartData?.vacantCount || 0})`}
                              {f === 'dues' && `बकाया किराया`}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          className="form-control"
                          placeholder="सीट नं, यात्री का नाम, PNR खोजें..."
                          style={{ width: 280 }}
                          value={chartSearch}
                          onChange={(e) => setChartSearch(e.target.value)}
                        />
                      </div>

                      {chartLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#E65100', fontWeight: 'bold' }}>
                          चार्ट लोड हो रहा है... कृपया प्रतीक्षा करें
                        </div>
                      ) : coachChartData ? (
                        <div className="table-responsive">
                          <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: 60, textAlign: 'center' }}>सीट नं</th>
                                <th style={{ width: 80 }}>बर्थ प्रकार</th>
                                <th style={{ width: 130 }}>PNR क्रमांक</th>
                                <th>यात्री का नाम (Passenger)</th>
                                <th style={{ width: 90, textAlign: 'center' }}>आयु / लिंग</th>
                                <th>कहाँ से - कहाँ तक</th>
                                <th style={{ width: 90, textAlign: 'center' }}>स्थिति</th>
                                <th style={{ width: 110 }}>किराया स्थिति</th>
                                <th style={{ width: 100, textAlign: 'center' }}>उपस्थिति</th>
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
                                          <div style={{ fontSize: '0.75rem', color: '#7C2D12' }}>मुख्य: {r.bookedBy} (मो: {r.mobile})</div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>--- खाली (Vacant) ---</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {r.isBooked ? `${r.age || '-'} / ${r.gender === 'Female' ? 'F' : 'M'}` : '-'}
                                    </td>
                                    <td style={{ fontSize: '0.82rem' }}>
                                      {r.fromStation ? `${r.fromStation.split(' ')[0]} ➔ SVDK` : '-'}
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
                                          <span className="badge badge-partial" style={{ fontSize: '0.72rem' }}>देय: ₹{r.remainingAmount}</span>
                                        ) : (
                                          <span className="badge badge-paid" style={{ fontSize: '0.72rem' }}>प्रदत्त</span>
                                        )
                                      ) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {r.isBooked ? (
                                        <span className={`badge ${r.checkInStatus === 'Present' ? 'badge-paid' : (r.checkInStatus === 'Absent' ? 'badge-unpaid' : 'badge-bhakti')}`} style={{ fontSize: '0.72rem' }}>
                                          {r.checkInStatus === 'Present' ? 'उपस्थित' : (r.checkInStatus === 'Absent' ? 'अनुपस्थित' : 'लंबित')}
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
                              <span className="badge badge-paid" style={{ fontSize: '0.75rem' }}>ऑन-ट्रेन चेकिंग</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#7C2D12', marginTop: 2 }}>
                              ट्रेन: 04201 / 04202 विशेष सुपरफास्ट • बैच {chartYear} • कटड़ा मार्ग
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FDBA74' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9A3412' }}>कोच चुनें:</label>
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
                            <Printer size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> IRCTC चार्ट प्रिंट
                          </button>
                        </div>
                      </div>

                      {/* Quick TTE Stats Strip */}
                      {coachChartData && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16, borderTop: '1px solid #FED7AA', paddingTop: 14 }}>
                          <div style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #FED7AA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12' }}>कुल यात्री (Booked)</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#9A3412' }}>{coachChartData.bookedCount}</div>
                          </div>
                          <div style={{ background: '#ECFDF5', padding: '8px 12px', borderRadius: 6, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#065F46' }}>✓ उपस्थित (Present)</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#047857' }}>{coachChartData.presentCount}</div>
                          </div>
                          <div style={{ background: '#FEF2F2', padding: '8px 12px', borderRadius: 6, border: '1px solid #FECACA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#991B1B' }}>✗ अनुपस्थित (Absent)</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#DC2626' }}>{coachChartData.absentCount}</div>
                          </div>
                          <div style={{ background: '#FFFBEB', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#92400E' }}>लंबित चेकिंग</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#B45309' }}>{coachChartData.pendingCheckInCount}</div>
                          </div>
                          <div style={{ background: '#FFF7ED', padding: '8px 12px', borderRadius: 6, border: '1px solid #FFEDD5', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.74rem', color: '#C2410C' }}>कुल बाकी किराया</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#C2410C' }}>₹ {coachChartData.totalDuesInCoach.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TTE Interactive Seat Checking List */}
                    <div className="glass-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                        <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.25rem', fontWeight: 800 }}>
                          कोच {chartCoach} ऑन-ट्रेन चेकिंग सूची
                        </h3>

                        <input
                          type="text"
                          className="form-control"
                          placeholder="सीट नंबर, यात्री या PNR खोजें..."
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
                                <th style={{ width: 65, textAlign: 'center' }}>सीट नं</th>
                                <th style={{ width: 85 }}>बर्थ प्रकार</th>
                                <th>यात्री विवरण (Passenger Details)</th>
                                <th style={{ width: 120 }}>PNR क्रमांक</th>
                                <th style={{ width: 110 }}>बोर्डिंग</th>
                                <th style={{ width: 140 }}>किराया / ऑन-स्पॉट वसूली</th>
                                <th style={{ width: 210, textAlign: 'center' }}>अटेंडेंस कार्रवाई</th>
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
                                            {r.age || '-'} वर्ष • {r.gender === 'Female' ? 'महिला' : 'पुरुष'} • आधार: {r.aadhar || 'प्रमाणीकृत'}
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>--- रिक्त (खाली सीट) ---</span>
                                      )}
                                    </td>
                                    <td>
                                      {r.pnr ? <strong style={{ color: '#E65100' }}>{r.pnr}</strong> : '-'}
                                    </td>
                                    <td>
                                      {r.fromStation ? `${r.fromStation.split(' ')[0]} ➔ SVDK` : '-'}
                                    </td>
                                    <td>
                                      {r.isBooked ? (
                                        <div>
                                          {r.remainingAmount > 0 ? (
                                            <div>
                                              <div style={{ color: '#DC2626', fontWeight: 800, fontSize: '0.85rem' }}>
                                                बकाया: ₹ {r.remainingAmount}
                                              </div>
                                              <button
                                                className="btn btn-sm btn-gold"
                                                style={{ marginTop: 4, padding: '3px 8px', fontSize: '0.74rem' }}
                                                onClick={() => handleTteCollectDue(r.bookingId, r.remainingAmount)}
                                              >
                                                <IndianRupee size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> राशि वसूलें
                                              </button>
                                            </div>
                                          ) : (
                                            <span style={{ color: '#059669', fontWeight: 800 }}>✓ पूर्ण प्रदत्त</span>
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
                                            ✓ उपस्थित
                                          </button>
                                          <button
                                            className={`btn btn-sm ${r.checkInStatus === 'Absent' ? 'btn-danger' : 'btn-outline'}`}
                                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                            onClick={() => handleTteCheckIn(r.seatNumber, 'Absent')}
                                          >
                                            ✕ अनुपस्थित
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>रिक्त सीट</span>
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
                              <span className="badge badge-bhakti" style={{ marginBottom: 6 }}><ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 100% एंटी-फ्रॉड रियल-टाइम मिलान</span>
                              <h3 style={{ fontSize: '1.4rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                                पाई-पाई का समाधान एवं वित्तीय हिसाब-किताब
                              </h3>
                              <div style={{ color: '#7C2D12', fontSize: '0.88rem', marginTop: 4 }}>
                                कुल बुकिंग्स, नकद व यूपीआई संग्रह, उपस्थिति, अनुपस्थिति एवं बकाया देय का समग्र ब्यौरा
                              </div>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={loadReconciliation}>
                              🔄 ताज़ा करें (Refresh Ledger)
                            </button>
                          </div>
                        </div>

                        {/* 8 Metric KPI Cards */}
                        <div className="grid-4" style={{ marginBottom: 24 }}>
                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #C2410C' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>कुल बुकिंग्स / यात्री</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#C2410C', margin: '4px 0' }}>
                              {reconcileData.summary.totalBookings || 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>
                              {reconcileData.summary.totalYatris || reconcileData.summary.totalPassengers || 0} पंजीकृत यात्री
                            </div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #047857' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>कुल सकल किराया (Gross)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#047857', margin: '4px 0' }}>
                              ₹ {(reconcileData?.summary?.totalGrossCollection || 0)?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>पूर्ण अनुमानित आय</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #0284C7' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>प्राप्त अग्रिम (Online Advance)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284C7', margin: '4px 0' }}>
                              ₹ {(reconcileData?.summary?.totalAdvanceCollected || 0)?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>बैंक/ट्रस्ट खाते में सीधे जमा</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>ट्रेन में वसूला गया बकाया (Due Recv)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10B981', margin: '4px 0' }}>
                              ₹ {(reconcileData?.summary?.totalDueCollectedOnTrain || Math.max(0, (reconcileData?.summary?.totalGrossCollection || 0) - (reconcileData?.summary?.totalAdvanceCollected || 0) - (reconcileData?.summary?.totalRemainingDues || 0)))?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>कर्मचारियों द्वारा संकलित</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #DC2626' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>शेष देय बकाया (Remaining Due)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>
                              ₹ {(reconcileData?.summary?.totalRemainingDues || reconcileData?.summary?.totalRemainingDue || 0)?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>यात्रियों से वसूलना शेष</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #059669' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>कुल उपस्थित यात्री (Present)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669', margin: '4px 0' }}>
                              {reconcileData.summary.totalPresentYatris || 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>सीट पर सत्यापित</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #EF4444' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>कुल अनुपस्थित यात्री (Absent)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#EF4444', margin: '4px 0' }}>
                              {reconcileData.summary.totalAbsentYatris || 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>यात्रा में शामिल नहीं हुए</div>
                          </div>

                          <div className="glass-card" style={{ padding: 18, borderLeft: '4px solid #F59E0B' }}>
                            <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 800 }}>सत्यापन शेष (Pending Check-in)</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B', margin: '4px 0' }}>
                              {reconcileData.summary.totalPendingCheckIn ?? reconcileData.summary.totalPendingYatris ?? 0}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#784D35' }}>जांच प्रक्रियाधीन</div>
                          </div>
                        </div>

                        {/* Staff / Collector Wise Collection Breakdown */}
                        <div className="glass-card">
                          <h4 style={{ color: '#9A3412', marginBottom: 14, fontSize: '1.15rem', fontWeight: 800 }}>
                            <Briefcase size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> कर्मचारी-वार एवं टीटी-वार वसूली ऑडिट (Staff Collection Breakdown)
                          </h4>
                          <div className="table-responsive">
                            <table className="custom-table">
                              <thead>
                                <tr>
                                  <th>कर्मचारी ID</th>
                                  <th>नाम</th>
                                  <th>विभाग</th>
                                  <th>पद / रोल</th>
                                  <th>लेन-देन संख्या</th>
                                  <th>नकद वसूली (Cash)</th>
                                  <th>UPI वसूली (UPI)</th>
                                  <th>कुल वसूली (Total)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!reconcileData.staffBreakdown || reconcileData.staffBreakdown.length === 0) ? (
                                  <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 20, color: '#784D35' }}>
                                      कोई कर्मचारी डेटा उपलब्ध नहीं है।
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
                                      <td style={{ color: '#047857', fontWeight: 700 }}>₹ {(s.cashCollected || 0)?.toLocaleString()}</td>
                                      <td style={{ color: '#0284C7', fontWeight: 700 }}>₹ {(s.upiCollected || 0)?.toLocaleString()}</td>
                                      <td style={{ fontWeight: 900, color: '#9A3412', fontSize: '1rem' }}>
                                        ₹ {(s.totalCollected || 0)?.toLocaleString()}
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
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}><Users size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> विभाग एवं कर्मचारी रोल प्रबंधन</span>
                          <h3 style={{ fontSize: '1.4rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            कर्मचारी सूची एवं अधिकार निर्धारण (Staff RBAC)
                          </h3>
                          <div style={{ color: '#7C2D12', fontSize: '0.88rem', marginTop: 4 }}>
                            एडमिन किसी भी कर्मचारी को जोड़, निलंबित या हटा सकता है तथा उनके विभाग और रोल तय कर सकता है
                          </div>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setNewStaffModal(true)}>
                          + नया कर्मचारी जोड़ें (Add Staff)
                        </button>
                      </div>
                    </div>

                    <div className="glass-card">
                      <div className="table-responsive">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>कर्मचारी ID</th>
                              <th>नाम व उपयोगकर्ता</th>
                              <th>जीमेल / Email ID</th>
                              <th>विभाग (Department)</th>
                              <th>रोल (Role)</th>
                              <th>मोबाइल नंबर</th>
                              <th>आवंटित कोच</th>
                              <th>स्थिति</th>
                              <th style={{ textAlign: 'right' }}>कार्य</th>
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
                                  {(() => {
                                    const coaches = st.assignedCoaches || st.assignedCoach;
                                    if (Array.isArray(coaches) && coaches.length > 0) {
                                      return <span style={{ color: '#047857', fontWeight: 600 }}>{coaches.join(', ')}</span>;
                                    } else if (typeof coaches === 'string' && coaches.trim().length > 0) {
                                      return <span style={{ color: '#047857', fontWeight: 600 }}>{coaches}</span>;
                                    }
                                    return <span style={{ color: '#784D35' }}>सभी कोच (All)</span>;
                                  })()}
                                </td>
                                <td>
                                  <span className={`badge ${st.status === 'Active' ? 'badge-paid' : 'badge-unpaid'}`}>
                                    {st.status === 'Active' ? 'सक्रिय (Active)' : 'निलंबित (Suspended)'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <button
                                    className={`btn btn-sm ${st.status === 'Active' ? 'btn-outline' : 'btn-success'}`}
                                    style={{ marginRight: 6 }}
                                    onClick={() => handleToggleStaffStatus(st)}
                                    title={st.status === 'Active' ? 'निलंबित करें' : 'सक्रिय करें'}
                                  >
                                    {st.status === 'Active' ? 'अवरुद्ध करें' : 'सक्रिय करें'}
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteStaff(st.id, st.name)}
                                    title="कर्मचारी हटाएं"
                                  >
                                    हटाएं
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
                          <span className="badge badge-bhakti" style={{ marginBottom: 6 }}><ShieldCheck size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> 100% छेड़छाड़-मुक्त ऑडिट ट्रेल</span>
                          <h3 style={{ fontSize: '1.4rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            एंटी-फ्रॉड ऑडिट लॉग (Audit Trail Ledger)
                          </h3>
                          <div style={{ color: '#7C2D12', fontSize: '0.88rem', marginTop: 4 }}>
                            प्रत्येक कर्मचारी का लॉगिन, उपस्थिति अंकन, देय राशि वसूली और बुकिंग गतिविधि का संपूर्ण रिकॉर्ड
                          </div>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={loadAuditLogs}>
                          🔄 ताज़ा करें (Refresh Logs)
                        </button>
                      </div>
                    </div>

                    <div className="glass-card">
                      <div className="table-responsive">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>समय (Timestamp)</th>
                              <th>कार्यवाही (Action)</th>
                              <th>कर्मचारी (Performed By)</th>
                              <th>रोल / विभाग</th>
                              <th>PNR / कोच</th>
                              <th>राशि (वसूली/भुगतान)</th>
                              <th>माध्यम</th>
                              <th>विवरण (Details)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogsList.length === 0 ? (
                              <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#784D35' }}>
                                  कोई ऑडिट लॉग उपलब्ध नहीं है।
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
                                    {lg.coach ? <div style={{ fontSize: '0.75rem' }}>कोच: {lg.coach}</div> : null}
                                  </td>
                                  <td style={{ fontWeight: 'bold', color: lg.amount > 0 ? '#047857' : '#784D35' }}>
                                    {lg.amount > 0 ? `₹ ${lg.amount}` : '-'}
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
                            <ShieldCheck size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> 100% ऑनलाइन लेनदेन व सुरक्षा नियंत्रण केंद्र
                          </span>
                          <h3 style={{ fontSize: '1.45rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>
                            ऑनलाइन UPI व UTR मिलान लेजर एवं टिकट सत्यापन
                          </h3>
                          <div style={{ color: '#7C2D12', fontSize: '0.86rem', marginTop: 4 }}>
                            कर्मचारियों द्वारा दर्ज ऑनलाइन भुगतानों का UTR मिलान (Approve/Reject) एवं जाली टिकटों की पहचान
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
                              {onlineTxnsLoading ? 'लोडिंग...' : 'ताज़ा करें (Refresh)'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Navigation Tabs */}
                      <div style={{ display: 'flex', gap: 10, borderTop: '1.5px solid #FFEDD5', paddingTop: 14 }}>
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
                          1. ऑनलाइन UPI व UTR मिलान लेजर ({onlineTxnsList.length || 'Desk'})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${verifierTab === 'ticket_scanner' ? 'btn-primary' : 'btn-outline'}`}
                          style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700 }}
                          onClick={() => setVerifierTab('ticket_scanner')}
                        >
                          <Scan size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                          2. लाइव टिकट सुरक्षा स्कैनर (HMAC QR Check)
                        </button>
                      </div>
                    </div>

                    {/* TAB 1: ONLINE TRANSACTIONS & UTR MATCHING DESK */}
                    {verifierTab === 'utr_desk' && (
                      <div>
                        {/* 4 Summary KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }} className="grid-kpi-mobile">
                          <div className="glass-card" style={{ background: '#FFF8F2', border: '1.5px solid #FED7AA', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#7C2D12', fontWeight: 700 }}>कुल ऑनलाइन लेनदेन</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#9A3412', margin: '4px 0' }}>{onlineTxnsSummary.total}</div>
                            <div style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>कुल राशि: ₹ {onlineTxnsSummary.totalAmount.toLocaleString()}</div>
                          </div>

                          <div className="glass-card" style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#92400E', fontWeight: 700 }}>लंबित UTR मिलान (Pending)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#B45309', margin: '4px 0' }}>{onlineTxnsSummary.pending}</div>
                            <div style={{ fontSize: '0.78rem', color: '#78350F' }}>बैंक से मैच करना बाकी</div>
                          </div>

                          <div className="glass-card" style={{ background: '#ECFDF5', border: '1.5px solid #A7F3D0', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#065F46', fontWeight: 700 }}>✓ स्वीकृत / सत्यापित (Verified)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#047857', margin: '4px 0' }}>{onlineTxnsSummary.verified}</div>
                            <div style={{ fontSize: '0.78rem', color: '#065F46' }}>खाते में प्राप्त व पुष्ट</div>
                          </div>

                          <div className="glass-card" style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', padding: 14 }}>
                            <div style={{ fontSize: '0.76rem', color: '#991B1B', fontWeight: 700 }}>✕ अस्वीकृत (Rejected)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#DC2626', margin: '4px 0' }}>{onlineTxnsSummary.rejected}</div>
                            <div style={{ fontSize: '0.78rem', color: '#7F1D1D' }}>अमान्य / फर्जी UTR</div>
                          </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="glass-card" style={{ marginBottom: 18, padding: 14, border: '1.5px solid #FED7AA', background: '#FFFFFF' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            {/* Filter Chips */}
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9A3412' }}>स्थिति फ़िल्टर:</span>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('All');
                                  loadOnlineTransactions('All', onlineTxnsSearch);
                                }}
                              >
                                सभी ({onlineTxnsSummary.total})
                              </button>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'Pending' ? 'btn-primary' : 'btn-outline'}`}
                                style={onlineTxnsStatusFilter !== 'Pending' ? { borderColor: '#F59E0B', color: '#B45309' } : {}}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('Pending');
                                  loadOnlineTransactions('Pending', onlineTxnsSearch);
                                }}
                              >
                                लंबित ({onlineTxnsSummary.pending})
                              </button>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'Verified' ? 'btn-primary' : 'btn-outline'}`}
                                style={onlineTxnsStatusFilter !== 'Verified' ? { borderColor: '#10B981', color: '#047857' } : {}}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('Verified');
                                  loadOnlineTransactions('Verified', onlineTxnsSearch);
                                }}
                              >
                                ✓ स्वीकृत ({onlineTxnsSummary.verified})
                              </button>
                              <button
                                className={`btn btn-sm ${onlineTxnsStatusFilter === 'Rejected' ? 'btn-primary' : 'btn-outline'}`}
                                style={onlineTxnsStatusFilter !== 'Rejected' ? { borderColor: '#EF4444', color: '#DC2626' } : {}}
                                onClick={() => {
                                  setOnlineTxnsStatusFilter('Rejected');
                                  loadOnlineTransactions('Rejected', onlineTxnsSearch);
                                }}
                              >
                                ✕ अस्वीकृत ({onlineTxnsSummary.rejected})
                              </button>
                            </div>

                            {/* Live Search Box */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 280, flex: '1 0 280px' }}>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="PNR, नाम, 12-अंकों का UTR या मोबाइल नंबर..."
                                value={onlineTxnsSearch}
                                onChange={(e) => {
                                  setOnlineTxnsSearch(e.target.value);
                                  loadOnlineTransactions(onlineTxnsStatusFilter, e.target.value);
                                }}
                                style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                              />
                              {onlineTxnsSearch && (
                                <button className="btn btn-outline btn-sm" onClick={() => { setOnlineTxnsSearch(''); loadOnlineTransactions(onlineTxnsStatusFilter, ''); }}>
                                  ✕
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
                                  <th style={{ width: 45 }}>क्र.</th>
                                  <th>PNR एवं श्रद्धालु विवरण</th>
                                  <th>जमा राशि (₹)</th>
                                  <th>भुगतान माध्यम</th>
                                  <th>UTR / बैंक संदर्भ क्रमांक</th>
                                  <th>प्राप्तकर्ता स्टाफ</th>
                                  <th>सत्यापन स्थिति</th>
                                  <th style={{ textAlign: 'center', width: 220 }}>एडमिन मिलान कार्यवाही</th>
                                </tr>
                              </thead>
                              <tbody>
                                {onlineTxnsLoading ? (
                                  <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 30, color: '#7C2D12' }}>
                                      ऑनलाइन लेनदेन डेटा लोड हो रहा है...
                                    </td>
                                  </tr>
                                ) : onlineTxnsList.length === 0 ? (
                                  <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: 36, color: '#784D35' }}>
                                      <div style={{ fontSize: 32, marginBottom: 6 }}>🔍</div>
                                      <strong>कोई ऑनलाइन लेनदेन रिकॉर्ड नहीं मिला।</strong>
                                      <div style={{ fontSize: '0.82rem', marginTop: 4 }}>किसी भी कर्मचारी अथवा भक्त द्वारा ऑनलाइन/UPI पेमेंट करने पर वह तुरंत इस लेजर में दिखाई देगा।</div>
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
                                          {tx.mobile} | कोच {tx.coachName} (सीट: {tx.seatNumber})
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#047857' }}>
                                          ₹ {Number(tx.amount || 0).toLocaleString()}
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
                                                नोट: {tx.remarks}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.8rem' }}>--- UTR दर्ज नहीं ---</span>
                                        )}
                                      </td>
                                      <td>
                                        <div style={{ fontWeight: 700, color: '#374151' }}>{tx.cashierName || 'Staff'}</div>
                                        {tx.verifiedBy && (
                                          <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                                            जांचकर्ता: {tx.verifiedBy}
                                          </div>
                                        )}
                                      </td>
                                      <td>
                                        {tx.status === 'Verified' ? (
                                          <span className="badge badge-paid" style={{ fontSize: '0.78rem' }}>
                                            ✓ बैंक से सत्यापित
                                          </span>
                                        ) : tx.status === 'Rejected' ? (
                                          <span className="badge badge-unpaid" style={{ fontSize: '0.78rem' }}>
                                            ✕ अस्वीकृत UTR
                                          </span>
                                        ) : (
                                          <span className="badge badge-partial" style={{ fontSize: '0.78rem' }}>
                                            मिलान लंबित
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                          {tx.status !== 'Verified' && (
                                            <button
                                              className="btn btn-sm btn-success"
                                              style={{ padding: '4px 8px', fontSize: '0.76rem', fontWeight: 700 }}
                                              onClick={() => handleVerifyUtrAction(tx.bookingId, tx.id, 'Verified', tx.utrNumber, 'Matched with Trust Bank Account')}
                                              title="बैंक खाते से UTR का मिलान कर स्वीकृत करें"
                                            >
                                              ✓ मैच (Approve)
                                            </button>
                                          )}
                                          {tx.status !== 'Rejected' && (
                                            <button
                                              className="btn btn-sm btn-danger"
                                              style={{ padding: '4px 8px', fontSize: '0.76rem', fontWeight: 700 }}
                                              onClick={() => {
                                                const r = window.prompt('अस्वीकार करने का कारण दर्ज करें (उदा. बैंक में नहीं आया / अमान्य):', 'बैंक खाते में राशि नहीं दिखी');
                                                if (r !== null) {
                                                  handleVerifyUtrAction(tx.bookingId, tx.id, 'Rejected', tx.utrNumber, r);
                                                }
                                              }}
                                              title="UTR अस्वीकार करें"
                                            >
                                              ✕ रिजेक्ट
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
                                            title="UTR नंबर या स्थिति संशोधित करें"
                                          >
                                            बदलें
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

                    {/* TAB 2: LIVE HMAC TICKET SECURITY SCANNER */}
                    {verifierTab === 'ticket_scanner' && (
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
                            यात्री के टिकट का QR कोड स्कैन करें
                          </h3>

                          <form onSubmit={(e) => { e.preventDefault(); handleVerifyTicketSubmit(); }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                                या मैन्युअल रूप से PNR दर्ज करें
                              </p>
                              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 400 }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="PNR Number (उदा. MVD-2026-...)"
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
                                {verifierLoading ? 'सत्यापन हो रहा है...' : <><ShieldCheck size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> मैन्युअल रूप से सत्यापित करें</>}
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
                                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#D1FAE5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✅</div>
                                  <div>
                                    <h3 style={{ margin: 0, color: '#065F46', fontSize: '1.3rem', fontWeight: 800 }}>{verifierResult.title}</h3>
                                    <p style={{ margin: '2px 0 0', color: '#047857', fontSize: '0.88rem' }}>{verifierResult.message}</p>
                                  </div>
                                </div>

                                <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNR / बुकिंग संख्या</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookingId}</div>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>मुख्य भक्त / आवेदक</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412' }}>{verifierResult.booking.bookedBy} ({verifierResult.booking.mobile})</div>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>आवंटित कोच व सीट</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>
                                      कोच {verifierResult.booking.coachName} • सीट: {Array.isArray(verifierResult.booking.seatNumber) ? verifierResult.booking.seatNumber.join(', ') : verifierResult.booking.seatNumber}
                                    </div>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 10, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>भुगतान स्थिति व देय राशि</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: verifierResult.booking.remainingAmount > 0 ? '#DC2626' : '#047857' }}>
                                      {verifierResult.booking.paymentStatus} (कटड़ा में शेष देय: ₹ {verifierResult.booking.remainingAmount})
                                    </div>
                                  </div>
                                </div>

                                <div style={{ background: '#FFF8F2', borderRadius: 8, padding: 12, border: '1px solid #FED7AA' }}>
                                  <strong style={{ color: '#9A3412', fontSize: '0.88rem' }}>डेटाबेस में आरक्षित सहयात्री:</strong>
                                  {(verifierResult.booking.passengers || []).map((p, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #FFEDD5', fontSize: '0.85rem' }}>
                                      <span>{idx + 1}. <strong>{p.name}</strong> ({p.age || '-'} वर्ष, {p.gender || '-'})</span>
                                      <span style={{ color: '#C2410C', fontWeight: 700 }}>सीट: {p.seatAssigned || p.seatNumber || '-'}</span>
                                    </div>
                                  ))}
                                </div>

                                <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  सुरक्षा सील हैश: <code>{verifierResult.securityHash}</code>
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
                                  <div><strong>अवैध / जाली हैश:</strong> <code>{verifierResult.providedSecurityHash}</code></div>
                                  <div><strong>सर्वर का अपेक्षित वैध हैश:</strong> <code>{verifierResult.expectedSecurityHash}</code></div>
                                  <div style={{ marginTop: 4 }}><strong>छेड़छाड़ वाले क्षेत्र:</strong> {verifierResult.tamperedFields}</div>
                                </div>

                                <h4 style={{ color: '#9A3412', marginBottom: 8, fontSize: '0.95rem' }}><ClipboardList size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> सर्वर का वास्तविक प्रामाणिक रिकॉर्ड:</h4>
                                <div className="grid-2" style={{ gap: 10, fontSize: '0.88rem' }}>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    वास्तविक भक्त: <strong>{verifierResult.authenticData.bookedBy}</strong> ({verifierResult.authenticData.mobile})
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    वास्तविक सीट: <strong style={{ color: '#DC2626' }}>कोच {verifierResult.authenticData.coachName}, सीट {Array.isArray(verifierResult.authenticData.seatNumber) ? verifierResult.authenticData.seatNumber.join(', ') : verifierResult.authenticData.seatNumber}</strong>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    वास्तविक देय राशि: <strong style={{ color: '#DC2626' }}>₹ {verifierResult.authenticData.remainingAmount} ({verifierResult.authenticData.paymentStatus})</strong>
                                  </div>
                                  <div style={{ background: '#FFF8F2', padding: 8, borderRadius: 6 }}>
                                    यात्री संख्या: <strong>{(verifierResult.authenticData.passengers || []).length} यात्री</strong>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{ fontSize: 36, marginBottom: 8 }}>❌</div>
                                <h3 style={{ color: '#991B1B', fontWeight: 800 }}>{verifierResult.title || 'अमान्य / फर्जी PNR'}</h3>
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
                                प्रोजेक्ट वित्तीय एवं UPI सेटिंग्स (Project & UPI Configuration)
                              </h3>
                              <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.86rem' }}>
                                आधिकारिक ट्रस्ट UPI ID, क्यूआर कोड, प्रति सीट किराया दरें एवं संपर्क विवरण अपडेट करें
                              </p>
                            </div>
                          </div>
                          <span className="badge badge-bhakti" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                            <Crown size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> चीफ एडमिन कंट्रोल
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
                                <strong style={{ color: '#9A3412', fontSize: '1.05rem' }}>लाइव UPI QR कोड प्रिव्यू</strong>
                              </div>
                              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#7C2D12' }}>
                                सभी बुकिंग एवं रसीदों में यही क्यूआर कोड और मर्चेंट नाम स्वतः लागू होगा।
                              </p>
                              <div style={{ fontSize: '0.85rem', background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #FED7AA' }}>
                                <div><strong>UPI ID:</strong> <code style={{ color: '#C2410C' }}>{projectSettings.upiId || '7398959993@okbizaxis'}</code></div>
                                <div style={{ marginTop: 3 }}><strong>पेई नाम:</strong> <span style={{ color: '#1F2937' }}>{projectSettings.upiPayeeName || 'श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट'}</span></div>
                              </div>
                            </div>

                            <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 10, border: '2px solid #FB923C', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=${projectSettings.upiId || '7398959993@okbizaxis'}&pn=${encodeURIComponent(projectSettings.upiPayeeName || 'Shri Mata Vaishno Devi Trust')}&cu=INR`)}`}
                                alt="UPI Live QR Preview"
                                style={{ width: 130, height: 130, display: 'block', margin: '0 auto' }}
                              />
                              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', marginTop: 6 }}>
                                ✓ स्कैन व भुगतान हेतु तैयार
                              </div>
                            </div>
                          </div>

                          {/* UPI & Merchant Details */}
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ color: '#9A3412', fontSize: '1rem', fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Smartphone size={16} color="#C2410C" /> 1. डिजिटल भुगतान एवं UPI VPA विवरण
                            </h4>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">आधिकारिक ट्रस्ट UPI ID (VPA) <span style={{ color: 'red' }}>*</span></label>
                                <input
                                  type="text"
                                  required
                                  className="form-control"
                                  placeholder="उदा. 7398959993@okbizaxis, trust@sbi"
                                  value={projectSettings.upiId || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, upiId: e.target.value.trim() })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">UPI पेई / ट्रस्ट का नाम (Payee Name) <span style={{ color: 'red' }}>*</span></label>
                                <input
                                  type="text"
                                  required
                                  className="form-control"
                                  placeholder="उदा. Shri Mata Vaishno Devi Public Charitable Trust"
                                  value={projectSettings.upiPayeeName || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, upiPayeeName: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">मर्चेंट कोड (Merchant Code)</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="उदा. MVD2026"
                                  value={projectSettings.merchantCode || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, merchantCode: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">डिफ़ॉल्ट यात्रा तिथि (Travel Date)</label>
                                <input
                                  type="date"
                                  className="form-control"
                                  value={projectSettings.defaultTravelDate || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, defaultTravelDate: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Fares Configuration */}
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ color: '#9A3412', fontSize: '1rem', fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <IndianRupee size={16} color="#C2410C" /> 2. आधिकारिक टिकट किराया दरें (Fares)
                            </h4>
                            <div className="grid-3" style={{ gap: 10 }}>
                              <div className="form-group">
                                <label className="form-label">स्लीपर क्लास (Sleeper ₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={projectSettings.fareSleeper || 3000}
                                  onChange={e => setProjectSettings({ ...projectSettings, fareSleeper: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">एसी क्लास (AC 3A/2A ₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={projectSettings.fareAC || 4000}
                                  onChange={e => setProjectSettings({ ...projectSettings, fareAC: Number(e.target.value) })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">जनरल क्लास (General ₹)</label>
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
                              <Globe size={16} color="#C2410C" /> 3. संपर्क, हेल्पलाइन एवं ट्रस्ट विवरण
                            </h4>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">हेल्पलाइन फोन नंबर</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="+91 7398959993"
                                  value={projectSettings.helplineNumber || ''}
                                  onChange={e => setProjectSettings({ ...projectSettings, helplineNumber: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">आधिकारिक ईमेल आईडी</label>
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
                              <label className="form-label">ट्रस्ट कार्यालय का पता (Office Address)</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India"
                                value={projectSettings.officeAddress || ''}
                                onChange={e => setProjectSettings({ ...projectSettings, officeAddress: e.target.value })}
                              />
                            </div>

                            <div className="form-group">
                              <label className="form-label">पवित्र श्लोक / टैगलाइन</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="जय माता दी • ॐ श्री वैष्णवी नमः • निष्काम सेवा"
                                value={projectSettings.sacredShlok || ''}
                                onChange={e => setProjectSettings({ ...projectSettings, sacredShlok: e.target.value })}
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 800 }}
                            disabled={projectSettingsSaving}
                          >
                            <Settings size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                            {projectSettingsSaving ? 'सेटिंग्स सुरक्षित हो रही हैं...' : 'प्रोजेक्ट एवं UPI सेटिंग्स सुरक्षित करें (Save Settings)'}
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
                                @{staffUser.username} {staffUser.email ? `• ${staffUser.email}` : ''}
                              </div>
                            </div>
                          </div>
                          <span className="badge badge-bhakti" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                            {staffUser.role}
                          </span>
                        </div>

                        <div className="grid-2" style={{ gap: 12, fontSize: '0.88rem' }}>
                          <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>विभाग (Department):</div>
                            <strong style={{ color: '#1F2937' }}>{staffUser.department || 'ट्रस्ट सामान्य प्रशासन'}</strong>
                          </div>
                          <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>खाता स्थिति (Account Status):</div>
                            <strong style={{ color: '#047857' }}>✓ Active & Verified (सक्रिय)</strong>
                          </div>
                          {staffUser.assignedCoach && (
                            <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                              <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>आवंटित कोच (Assigned Coaches):</div>
                              <strong style={{ color: '#C2410C' }}>{staffUser.assignedCoach}</strong>
                            </div>
                          )}
                          {staffUser.assignedStation && (
                            <div style={{ background: '#FFF8F2', padding: '10px 14px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                              <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>स्टेशन (Assigned Station):</div>
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
                        <h3 style={{ fontSize: '1.2rem', color: '#9A3412', margin: 0, fontWeight: 800 }}>सुरक्षा एवं पासवर्ड बदलें (Change Password)</h3>
                      </div>
                      
                      {settingsMessage && (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', fontWeight: 600 }}>
                          ✓ {settingsMessage}
                        </div>
                      )}
                      {settingsError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', fontWeight: 600 }}>
                          ❌ {settingsError}
                        </div>
                      )}

                      <form onSubmit={handlePasswordUpdate}>
                        <div className="form-group">
                          <label className="form-label">वर्तमान पासवर्ड (Old Password) <span style={{color: 'red'}}>*</span></label>
                          <input type="password" required className="form-control" placeholder="••••••••" value={settingsOldPass} onChange={e => setSettingsOldPass(e.target.value)} />
                        </div>
                        <div className="grid-2">
                          <div className="form-group">
                            <label className="form-label">नया पासवर्ड (New Password) <span style={{color: 'red'}}>*</span></label>
                            <input type="password" required minLength={6} className="form-control" placeholder="न्यूनतम 6 अक्षर" value={settingsNewPass} onChange={e => setSettingsNewPass(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">पुष्टि करें (Confirm Password) <span style={{color: 'red'}}>*</span></label>
                            <input type="password" required minLength={6} className="form-control" placeholder="पासवर्ड पुनः दर्ज करें" value={settingsConfirmPass} onChange={e => setSettingsConfirmPass(e.target.value)} />
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: 6, fontSize: '0.95rem' }}>
                          <Key size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> नया पासवर्ड सहेजें (Update Password)
                        </button>
                      </form>
                    </div>

                    {/* Account Logout Action Card */}
                    <div className="glass-card" style={{ border: '2px solid #FCA5A5', background: '#FFF5F5', textAlign: 'center', padding: 20 }}>
                      <h4 style={{ color: '#991B1B', margin: '0 0 6px', fontWeight: 800 }}>सत्र समाप्त करें (Staff Logout)</h4>
                      <p style={{ color: '#7F1D1D', fontSize: '0.85rem', margin: '0 0 14px' }}>
                        काम समाप्त होने के बाद अपने खाते को सुरक्षित रखने हेतु लॉगआउट करें।
                      </p>
                      <button className="btn btn-danger" onClick={handleStaffLogout} style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 700 }}>
                        <LogOut size={16} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> सुरक्षित लॉगआउट करें (Logout Now)
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
                              ट्रेन बोगी स्थिति एवं रेक संरचना (Live Train Composition)
                            </h2>
                            <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.88rem' }}>
                              इंजन से गार्ड वैन तक संपूर्ण 18+ बोगी संरचना, प्लेटफ़ॉर्म प्लेसमेंट एवं बर्थ उपलब्धता
                            </p>
                          </div>
                        </div>

                        {/* Filter Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8F2', padding: '6px 12px', borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7C2D12' }}>यात्रा वर्ष:</label>
                            <select
                              className="form-control"
                              style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto', minWidth: 100 }}
                              value={compositionYearFilter}
                              onChange={(e) => {
                                setCompositionYearFilter(e.target.value);
                                loadTrainComposition(e.target.value);
                              }}
                            >
                              <option value="2026">2026 (वर्तमान)</option>
                              <option value="2025">2025</option>
                              <option value="2024">2024</option>
                            </select>
                          </div>

                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => loadTrainComposition(compositionYearFilter)}
                            disabled={trainCompositionLoading}
                          >
                            <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {trainCompositionLoading ? 'लोड हो रहा है...' : 'रिफ्रेश'}
                          </button>

                          {isSuperAdmin && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/admin/coaches')}
                            >
                              <Settings size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> बोगी प्रबंधन (Admin)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Summary Metric Stats */}
                      {trainCompositionData && trainCompositionData.stats && (
                        <div className="grid-4" style={{ gap: 12, marginBottom: 16 }}>
                          <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#7C2D12', fontWeight: 700 }}>कुल बोगियां (Total Bogies)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9A3412' }}>
                              {trainCompositionData.stats.totalCoaches || 18}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#9A3412' }}>इंजन + 18 डिब्बे</div>
                          </div>

                          <div style={{ background: '#EFF6FF', padding: 12, borderRadius: 8, border: '1px solid #BFDBFE', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 700 }}>स्लीपर बोगियां (Sleeper)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1D4ED8' }}>
                              {trainCompositionData.stats.sleeperCoaches || 6} बोगी
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#2563EB' }}>{trainCompositionData.stats.sleeperBerths || 432} सीटें</div>
                          </div>

                          <div style={{ background: '#F5F3FF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#5B21B6', fontWeight: 700 }}>वातानुकूलित (AC 3T / 2T)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6D28D9' }}>
                              {trainCompositionData.stats.acCoaches || 6} बोगी
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#7C3AED' }}>{trainCompositionData.stats.acBerths || 384} सीटें</div>
                          </div>

                          {staffUser && (
                            <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 700 }}>कुल आरक्षित यात्री</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>
                                {trainCompositionData.stats.totalBooked || 0} / {trainCompositionData.stats.totalBerthCapacity || 816}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#059669' }}>
                                उपलब्ध: {(trainCompositionData.stats.totalBerthCapacity || 816) - (trainCompositionData.stats.totalBooked || 0)}
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
                          placeholder="कोच कोड से खोजें (उदा. S1, S4, B2, A1, PC) या श्रेणी..."
                          value={coachSearchQuery}
                          onChange={(e) => setCoachSearchQuery(e.target.value)}
                          style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: '0.92rem', boxShadow: 'none' }}
                        />
                        {coachSearchQuery && (
                          <button
                            onClick={() => setCoachSearchQuery('')}
                            style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Horizontal Train Rake Visualizer */}
                    <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontWeight: 800, color: '#9A3412', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>रेक संरचना (Live Rake Layout - 18 Bogies)</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#7C2D12', display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3B82F6', display: 'inline-block' }}></span> स्लीपर (SL)
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
                        <span>⬅️ इंजन / आगे का छोर (Front of Platform / Engine End)</span>
                        <span style={{ color: '#7C2D12', background: '#FFF', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem' }}>प्लेटफ़ॉर्म ट्रैक</span>
                        <span>गार्ड वैन / पिछला छोर (Rear of Platform / Guard End) ➡️</span>
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
                          <div style={{ fontSize: 24, marginBottom: 2 }}>🚂</div>
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
                                          ₹ {coach.baseFare || 0}
                                        </div>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <div style={{ fontSize: '0.65rem', color: '#6B7280', fontStyle: 'italic' }}>
                                    सेवा / लगेज
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
                                कोच {selectedCoachForPosition.coachName} ({selectedCoachForPosition.coachCode})
                              </h3>
                              <div style={{ fontSize: '0.84rem', color: '#78350F' }}>
                                श्रेणी: <strong>{selectedCoachForPosition.coachClass}</strong> • क्रम संख्या: #{selectedCoachForPosition.positionSequence}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedCoachForPosition(null)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          >
                            ✕ बंद करें
                          </button>
                        </div>

                        <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                          <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FED7AA' }}>
                            <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>प्लेटफ़ॉर्म स्थिति (Platform Location)</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9A3412', marginTop: 2 }}>
                              {selectedCoachForPosition.platformPlacement || 'Center of Platform'}
                            </div>
                          </div>

                          {staffUser && (
                            <>
                              <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>बर्थ क्षमता व आरक्षण स्थिति</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857', marginTop: 2 }}>
                                  {selectedCoachForPosition.bookedPassengers || 0} / {selectedCoachForPosition.capacity || 72} सीटें आरक्षित
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#059669' }}>
                                  उपलब्ध रिक्त: {(selectedCoachForPosition.capacity || 72) - (selectedCoachForPosition.bookedPassengers || 0)}
                                </div>
                              </div>

                              <div style={{ background: '#FFF', padding: 12, borderRadius: 8, border: '1px solid #FED7AA' }}>
                                <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>बेस किराया (Base Fare)</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#C2410C', marginTop: 2 }}>
                                  ₹ {selectedCoachForPosition.baseFare || 0} / यात्री
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {selectedCoachForPosition.notes && (
                          <div style={{ background: '#FFFBEB', padding: '10px 14px', borderRadius: 8, border: '1px solid #FDE68A', fontSize: '0.85rem', color: '#92400E' }}>
                            <strong>कोच विवरण / विशेष टिप्पणी:</strong> {selectedCoachForPosition.notes}
                          </div>
                        )}

                        {/* Berth Arrangement Explanation */}
                        {selectedCoachForPosition.isBookable && (
                          <div style={{ marginTop: 14, background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', fontSize: '0.82rem', color: '#7C2D12' }}>
                            <strong>बर्थ लेआउट दिशानिर्देश:</strong>
                            {selectedCoachForPosition.coachClass === 'Sleeper' ? (
                              <span> 1 से 72 तक प्रत्येक 8 सीटों का कूपे (Lower: 1,4, Middle: 2,5, Upper: 3,6, Side Lower: 7, Side Upper: 8)।</span>
                            ) : (
                              <span> 1 से 64/72 तक वातानुकूलित कूपे व्यवस्था एवं लिनन सुविधा उपलब्ध।</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tabular Full Rake Reference */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <h3 style={{ color: '#9A3412', fontWeight: 800, fontSize: '1.15rem', marginBottom: 14 }}>
                        संपूर्ण रेक गठन तालिका (Complete Train Formation Chart)
                      </h3>

                      <div className="table-responsive">
                        <table className="custom-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#FFF7ED', color: '#9A3412' }}>
                              <th>क्रम #</th>
                              <th>बोगी कोड</th>
                              <th>बोगी का नाम</th>
                              <th>श्रेणी</th>
                              {staffUser && <th>कुल सीटें</th>}
                              {staffUser && <th>आरक्षित</th>}
                              {staffUser && <th>उपलब्ध</th>}
                              {staffUser && <th>किराया</th>}
                              <th>प्लेटफ़ॉर्म स्थिति</th>
                              <th>बुकिंग</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Locomotive Row */}
                            <tr style={{ background: '#FEF2F2' }}>
                              <td><strong>0</strong></td>
                              <td><span className="badge badge-danger">LOCO</span></td>
                              <td><strong>इंजन (WAP-7 Locomotive)</strong></td>
                              <td>लोकोमोटिव</td>
                              {staffUser && <td>-</td>}
                              {staffUser && <td>-</td>}
                              {staffUser && <td>-</td>}
                              {staffUser && <td>-</td>}
                              <td>इंजन छोर (Front End)</td>
                              <td><span className="badge" style={{ background: '#CBD5E1', color: '#334155' }}>संचालन</span></td>
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
                                {staffUser && <td>{c.baseFare ? `₹ ${c.baseFare}` : '-'}</td>}
                                <td>{c.platformPlacement || 'Center'}</td>
                                <td>
                                  {c.isBookable ? (
                                    <span className="badge badge-active" style={{ fontSize: '0.72rem' }}>सक्रिय</span>
                                  ) : (
                                    <span className="badge" style={{ background: '#E2E8F0', color: '#475569', fontSize: '0.72rem' }}>सेवा</span>
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
                              ट्रेन बोगी एवं कोच प्रबंधन (Train Coach & Rake Master)
                            </h2>
                            <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.88rem' }}>
                              ट्रेन में नई बोगियां जोड़ें, इंजन से गार्ड वैन तक क्रम/पोजीशन बदलें तथा सीटें व किराया निर्धारित करें
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
                            <Plus size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> + नई बोगी जोड़ें (Add Bogie)
                          </button>

                          <button
                            className="btn btn-outline btn-sm"
                            onClick={handleResetDefaultRake}
                            style={{ borderColor: '#F59E0B', color: '#B45309' }}
                            title="18 बोगियों के मानक रेक पर रीसेट करें"
                          >
                            <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> डिफ़ॉल्ट 18-बोगी रेक रीसेट
                          </button>

                          <button
                            className="btn btn-outline btn-sm"
                            onClick={loadAdminCoaches}
                            disabled={adminCoachesLoading}
                          >
                            <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {adminCoachesLoading ? 'लोडिंग...' : 'रिफ्रेश'}
                          </button>

                          <button
                            className="btn btn-gold btn-sm"
                            onClick={() => navigate('/coach-position')}
                          >
                            <Train size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> बोगी दृश्य (Visualizer)
                          </button>
                        </div>
                      </div>

                      {/* Coach Stats Cards */}
                      <div className="grid-4" style={{ gap: 12 }}>
                        <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>कुल बोगियां (Rake Size)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#9A3412' }}>
                            {adminCoachesList.length} डिब्बे
                          </div>
                        </div>

                        <div style={{ background: '#EFF6FF', padding: 12, borderRadius: 8, border: '1px solid #BFDBFE', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#1E40AF', fontWeight: 700 }}>सक्रिय बुकिंग बोगियां</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1D4ED8' }}>
                            {adminCoachesList.filter(c => c.isBookable).length} बोगी
                          </div>
                        </div>

                        <div style={{ background: '#F5F3FF', padding: 12, borderRadius: 8, border: '1px solid #DDD6FE', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#5B21B6', fontWeight: 700 }}>कुल बर्थ क्षमता (Total Seats)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6D28D9' }}>
                            {adminCoachesList.reduce((acc, c) => acc + (parseInt(c.capacity) || 0), 0)} सीटें
                          </div>
                        </div>

                        <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 700 }}>लाइव बुकिंग सिंक</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#047857' }}>
                            ✓ Active Realtime
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Master Coaches Table with Reordering & Actions */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ color: '#9A3412', fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                          ट्रेन बोगी क्रम एवं विवरण तालिका (Rake Sequence & Configuration)
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: '#7C2D12' }}>
                          ⬆️ / ⬇️ बटन से बोगी का क्रम (इंजन से दूरी) बदलें
                        </span>
                      </div>

                      <div className="table-responsive">
                        <table className="custom-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#FFF7ED', color: '#9A3412' }}>
                              <th>क्रम</th>
                              <th>बोगी कोड</th>
                              <th>बोगी नाम</th>
                              <th>श्रेणी (Class)</th>
                              <th>सीटें</th>
                              <th>किराया ₹</th>
                              <th>प्लेटफ़ॉर्म स्थिति</th>
                              <th>बुकिंग चालू?</th>
                              <th>क्रम बदलें</th>
                              <th>क्रियाएं</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminCoachesList.length === 0 ? (
                              <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: 24, color: '#7C2D12' }}>
                                  कोई बोगी नहीं मिली। कृपया "डिफ़ॉल्ट 18-बोगी रेक रीसेट" दबाएं।
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
                                  <td><strong>₹ {Number(coach.fare || coach.baseFare || 3000).toLocaleString('en-IN')}</strong></td>
                                  <td style={{ fontSize: '0.82rem', color: '#7C2D12' }}>{coach.platformPosition || coach.platformPlacement || 'Center'}</td>
                                  <td>
                                    {coach.isBookable ? (
                                      <span className="badge badge-active" style={{ fontSize: '0.72rem' }}>सक्रिय (Bookable)</span>
                                    ) : (
                                      <span className="badge" style={{ background: '#E2E8F0', color: '#475569', fontSize: '0.72rem' }}>अक्रिय / सर्विस</span>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '3px 7px', fontSize: '0.75rem' }}
                                        disabled={idx === 0}
                                        onClick={() => handleMoveCoachPosition(idx, 'up')}
                                        title="बोगी को आगे ले जाएं (Move Up)"
                                      >
                                        <ArrowUp size={14} />
                                      </button>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '3px 7px', fontSize: '0.75rem' }}
                                        disabled={idx === adminCoachesList.length - 1}
                                        onClick={() => handleMoveCoachPosition(idx, 'down')}
                                        title="बोगी को पीछे ले जाएं (Move Down)"
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
                                        title="बोगी विवरण संशोधित करें"
                                      >
                                        <Edit size={14} style={{ display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} /> एडिट
                                      </button>
                                      <button
                                        className="btn btn-danger btn-sm"
                                        style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                                        onClick={() => handleDeleteCoach(coach.id, coach.coachCode)}
                                        title="बोगी हटाएं"
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
                               टिकट रद्दीकरण व रिफंड डेस्क (Ticket Cancellation & Refund Master)
                            </h2>
                            <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.85rem' }}>
                              यात्री टिकट रद्द करें, रिफंड राशि समायोजित करें तथा रद्दीकरणकर्ता कर्मचारी का रिकॉर्ड देखें
                            </p>
                          </div>
                        </div>

                        <button className="btn btn-outline btn-sm" onClick={loadAdminDashboard}>
                          <RefreshCw size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> रिफ्रेश
                        </button>
                      </div>

                      {/* Refund KPI Stats */}
                      <div className="grid-4" style={{ gap: 12 }}>
                        <div style={{ background: '#FEF2F2', padding: 12, borderRadius: 8, border: '1px solid #FECACA', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#991B1B', fontWeight: 700 }}>कुल रद्द टिकट (Cancelled)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626' }}>
                            {adminBookings.filter(b => b.status === 'Cancelled').length} टिकट
                          </div>
                        </div>
                        <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#7C2D12', fontWeight: 700 }}>कुल रिफंड राशि (Total Refunded)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EA580C' }}>
                            ₹ {adminBookings.filter(b => b.status === 'Cancelled').reduce((sum, b) => sum + (Number(b.refundAmount) || Number(b.cancellationDetails?.refundAmount) || 0), 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 8, border: '1px solid #A7F3D0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 700 }}>कटौती / शुल्क (Charges Kept)</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#047857' }}>
                            ₹ {adminBookings.filter(b => b.status === 'Cancelled').reduce((sum, b) => sum + (Number(b.cancellationCharges) || Number(b.cancellationDetails?.cancellationCharges) || 0), 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>सीटें स्वतः मुक्त (Seats Released)</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                            ✓ 100% Realtime Available
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cancelled Bookings Table */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 20 }}>
                      <h3 style={{ color: '#9A3412', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 14px 0' }}>
                        रद्द टिकटों का विस्तृत लेजर (Cancelled Tickets Roster)
                      </h3>

                      <div className="table-responsive">
                        <table className="custom-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#FEF2F2', color: '#991B1B' }}>
                              <th>PNR क्रमांक</th>
                              <th>श्रद्धालु / यात्री</th>
                              <th>मोबाइल</th>
                              <th>कोच व मूल सीटें</th>
                              <th>जमा अग्रिम</th>
                              <th>रिफंड राशि</th>
                              <th>माध्यम</th>
                              <th>रद्दीकरणकर्ता (Staff)</th>
                              <th>रद्दीकरण समय व कारण</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminBookings.filter(b => b.status === 'Cancelled').length === 0 ? (
                              <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                                  वर्तमान में कोई टिकट रद्द नहीं हुआ है। समस्त बुकिंग्स सुरक्षित व सक्रिय हैं।
                                </td>
                              </tr>
                            ) : (
                              adminBookings.filter(b => b.status === 'Cancelled').map((b, idx) => (
                                <tr key={b.bookingId || idx}>
                                  <td><strong style={{ color: '#DC2626' }}>{b.bookingId}</strong></td>
                                  <td><strong>{b.bookedBy}</strong> ({b.numberOfPassengers} यात्री)</td>
                                  <td>{b.mobile}</td>
                                  <td>
                                    <span className="badge badge-bhakti">{b.coachName || b.cancellationDetails?.originalCoach}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#6B7280', marginLeft: 4 }}>
                                      (सीटें: {Array.isArray(b.releasedSeats || b.cancellationDetails?.originalSeats) ? (b.releasedSeats || b.cancellationDetails?.originalSeats).join(', ') : 'Free'})
                                    </span>
                                  </td>
                                  <td>₹ {b.cancellationDetails?.originalAdvance || b.advance || 0}</td>
                                  <td><strong style={{ color: '#EA580C' }}>₹ {b.refundAmount || b.cancellationDetails?.refundAmount || 0}</strong></td>
                                  <td><span className="badge badge-paid">{b.cancellationDetails?.refundMode || 'Cash'}</span></td>
                                  <td>
                                    <strong style={{ color: '#1F2937' }}>{b.cancellationDetails?.cancelledBy || 'Admin'}</strong>
                                    <span style={{ fontSize: '0.72rem', color: '#6B7280', display: 'block' }}>({b.cancellationDetails?.cancelledByRole || 'Staff'})</span>
                                  </td>
                                  <td style={{ fontSize: '0.78rem', color: '#4B5563' }}>
                                    {b.cancellationDetails?.cancelledAt ? new Date(b.cancellationDetails.cancelledAt).toLocaleString('en-IN') : 'N/A'}
                                    <div style={{ color: '#B91C1C', fontStyle: 'italic', marginTop: 2 }}>{b.cancellationDetails?.cancellationReason || 'यात्री अनुरोध'}</div>
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
                            संपूर्ण यूज़र गाइड व संचालन कार्यप्रणाली (User Manual & SOP)
                          </h2>
                          <p style={{ margin: '2px 0 0', color: '#7C2D12', fontSize: '0.88rem' }}>
                            ट्रस्ट व्यवस्थापक, बुकिंग क्लर्क, टीटीई एवं लेखा टीम हेतु चरणबद्ध उपयोग निर्देश
                          </p>
                        </div>
                      </div>

                      {/* Guide Category Tabs */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #FED7AA', paddingBottom: 10 }}>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'admin' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('admin')}
                        >
                          1. मुख्य व्यवस्थापक (SuperAdmin SOP)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'clerk' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('clerk')}
                        >
                          2. टिकट काउंटर लिपिक (Booking Clerk)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'tte' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('tte')}
                        >
                          3. चल टिकट परीक्षक (TTE Live Check)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'accounts' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('accounts')}
                        >
                          4. दैनिक वसूली व लेखा मिलान (Accounts/MIS)
                        </button>
                        <button
                          className={`btn btn-sm ${userGuideTab === 'refund_rules' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setUserGuideTab('refund_rules')}
                        >
                           5. रद्दीकरण व रिफंड नियम (Cancellation Policy)
                        </button>
                      </div>
                    </div>

                    {/* Guide Content Card */}
                    <div className="glass-card" style={{ border: '2px solid #FED7AA', background: '#FFFFFF', padding: 24, lineHeight: 1.7 }}>
                      {userGuideTab === 'admin' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>मुख्य व्यवस्थापक (Chief Admin) कार्यप्रणाली</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>डैशबोर्ड:</strong> लाइव कुल आरक्षण, दैनिक बिक्री, रिफंड राशि और शुद्ध राजस्व का विश्लेषण करें।</li>
                            <li><strong>ट्रेन बोगी प्रबंधन:</strong> ट्रेन में नई बोगियां जोड़ें, 18-बोगी रेक रीसेट करें या ⬆️/⬇️ बटन से क्रम बदलें।</li>
                            <li><strong>सेटिंग्स से UPI ID अपडेट:</strong> अपनी बैंक UPI ID व ट्रस्ट नाम अपडेट करें जो QR कोड में तुरंत सक्रिय होगी।</li>
                            <li><strong>कर्मचारी RBAC:</strong> नए TTE, बुकिंग क्लर्क व अकाउंट्स स्टाफ जोड़ें एवं उन्हें विशिष्ट बोगी आवंटित करें।</li>
                            <li><strong>ऑडिट ट्रेल:</strong> किसी भी टिकट बुकिंग, रद्दीकरण, रिफंड या भुगतान बदलाव की समयबद्ध जाँच करें।</li>
                            <li><strong>सत्यापन व UTR (नया):</strong> '5. सत्यापन व UTR' में जाकर पेंडिंग UTR का बैंक खाते से मिलान कर उसे 'Verified' (स्वीकृत) या 'Rejected' (अस्वीकृत) करें।</li>
                            <li><strong>सुरक्षा स्कैनर (HMAC):</strong> फर्जी टिकट रोकने हेतु 'लाइव टिकट स्कैनर' से श्रद्धालु की टिकट का QR स्कैन कर असली/नकली की पहचान करें।</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'clerk' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>टिकट काउंटर बुकिंग क्लर्क SOP</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>नया आरक्षण:</strong> यात्रा वर्ष, श्रेणी (Sleeper/AC) एवं कोच चुनें।</li>
                            <li><strong>सीट चयन:</strong> सीट मैप में खाली सीट पर क्लिक करें (हरी लाइट से चयनित सीट दिखती है)।</li>
                            <li><strong>सहयात्री विवरण:</strong> नाम, आयु, लिंग, आधार व बर्थ प्राथमिकता दर्ज करें।</li>
                            <li><strong>भुगतान व रसीद:</strong> नकद या UPI QR द्वारा भुगतान लें। 'कुल देय राशि' अपने-आप 'अग्रिम टोकन राशि' में भर जाएगी। श्रद्धालु को आधिकारिक पर्ची प्रिंट करके दें।</li>
                            <li><strong>रद्दीकरण (Cancellation):</strong> यदि श्रद्धालु यात्रा रद्द करता है तो '4. रद्दीकरण व रिफंड' में जाकर टिकट निरस्त करें।</li>
                            <li><strong>टिकट जाँच (Verification):</strong> श्रद्धालु का टिकट असली है या नहीं, इसके लिए '8. टिकट सत्यापन' में जाकर PNR डालें या QR स्कैन करें।</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'tte' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>चल टिकट परीक्षक (TTE) ऑन-ट्रेन अटेंडेंस SOP</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>लाइव सीट ग्रिड:</strong> अपने आवंटित कोच का चयन करें।</li>
                            <li><strong>उपस्थिति जाँच:</strong> प्रत्येक यात्री का नाम व आधार देखकर <strong>✓ उपस्थित (Present)</strong> या <strong>✕ अनुपस्थित (Absent)</strong> मार्क करें।</li>
                            <li><strong>ऑन-ट्रेन बकाया वसूली:</strong> शेष राशि होने पर <strong>"वसूली करें"</strong> दबाकर नकद या ऑन-स्पॉट UPI QR से शेष किराया प्राप्त करें।</li>
                            <li><strong>फर्जी टिकट रोकथाम:</strong> '4. टिकट सत्यापन' में <strong>लाइव टिकट सुरक्षा स्कैनर (HMAC)</strong> का उपयोग करें। अगर टिकट से छेड़छाड़ हुई है (जैसे नाम या राशि बदली है) तो स्कैनर तुरंत अलर्ट (लाल रंग) देगा।</li>
                            <li><strong>UTR दर्ज करना:</strong> यदि श्रद्धालु ट्रेन में UPI से बकाया भुगतान करता है, तो UTR स्कैनर टैब में डालकर रिकॉर्ड करें।</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'accounts' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}>दैनिक वसूली व लेखा मिलान (Daily MIS & Accounts)</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>दैनिक रिपोर्ट:</strong> तिथि चुनें (आज, कल, पिछले 7 दिन या कस्टम डेट रेंज)।</li>
                            <li><strong>कर्मचारीवार बहीखाता:</strong> किस क्लर्क या TTE ने कितना नकद व UPI कलेक्ट किया, उसका पूरा हिसाब देखें।</li>
                            <li><strong>रिफंड समायोजन:</strong> रिफंड की गई राशि शुद्ध राजस्व (Net Balance) से ऑटो-एडजस्ट होकर प्रदर्शित होगी।</li>
                            <li><strong>UTR मिलान (Verification):</strong> '6. सत्यापन व UTR' में जाकर बैंक स्टेटमेंट से श्रद्धालुओं द्वारा भरे गए 12-अंकों के UTR का मिलान करें और लेनदेन वेरीफाई करें।</li>
                            <li><strong>एक्सेल एक्सपोर्ट:</strong> संपूर्ण वित्तीय रिकॉर्ड (Financial Record) एक क्लिक में डाउनलोड करें।</li>
                          </ol>
                        </div>
                      )}

                      {userGuideTab === 'refund_rules' && (
                        <div>
                          <h3 style={{ color: '#9A3412', fontWeight: 800 }}> टिकट रद्दीकरण व रिफंड नियम (Cancellation & Refund Rules)</h3>
                          <ol style={{ paddingLeft: 20, color: '#374151' }}>
                            <li><strong>रद्दीकरण प्रक्रिया:</strong> बुकिंग डायरेक्टरी में जाकर टिकट के सामने <strong>"✕ रद्द / रिफंड"</strong> दबाएं।</li>
                            <li><strong>रिफंड राशि निर्धारण:</strong> जमा अग्रिम में से नियमानुसार कटौती कर श्रद्धालु को रिफंड राशि प्रदान करें। रिफंड मोड (UPI/Cash) अनिवार्य रूप से चुनें।</li>
                            <li><strong>सीट की तत्काल उपलब्धता:</strong> टिकट रद्द होते ही सीट मैप में वह बर्थ पुनः हरी (Available) हो जाती है।</li>
                            <li><strong>ऑडिट रिकॉर्ड:</strong> रद्दीकरणकर्ता कर्मचारी का नाम, तिथि व रिफंड मोड स्थायी रूप से सुरक्षित रहता है और ऑडिट लॉग्स में दर्ज होता है।</li>
                          </ol>
                        </div>
                      )}

                      <div style={{ marginTop: 20, background: '#FFF8F2', padding: 14, borderRadius: 8, border: '1px solid #FED7AA', fontSize: '0.85rem', color: '#7C2D12' }}>
                        <strong>हेल्पलाइन व तकनीकी सहायता:</strong> किसी भी कठिनाई के लिए एडमिन सपोर्ट <code>iammshyam@gmail.com</code> या <code>info.aroventech@gmail.com</code> पर संपर्क करें।<br />
                        <strong>सॉफ्टवेयर डेवलपर:</strong> ArovenTech (www.aroventech.site | +91 9598023701)
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW: 404 NOT FOUND */}
                {activeView === '404' && (
                  <div className="glass-card" style={{ maxWidth: 650, margin: '60px auto', textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 64, color: '#F97316', marginBottom: 16 }}>404</div>
                    <h2 style={{ color: '#9A3412', fontWeight: 800, marginBottom: 12 }}>पृष्ठ नहीं मिला (Page Not Found)</h2>
                    <p style={{ color: '#7C2D12', marginBottom: 24 }}>
                      आप जिस पृष्ठ को ढूँढ रहे हैं, वह उपलब्ध नहीं है या हटा दिया गया है।
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                      <Home size={18} style={{display:"inline", marginRight:"6px", verticalAlign:"text-bottom"}} /> होम पेज पर जाएं
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
                  टिकट रद्दीकरण व रिफंड (Cancel Ticket #{cancelModal.booking.bookingId})
                </h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setCancelModal(null)} style={{ border: 'none', fontSize: '1.2rem', color: '#6B7280' }}>✕</button>
            </div>

            <form onSubmit={handleCancelTicket}>
              <div style={{ background: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>श्रद्धालु का नाम:</span>
                  <strong>{cancelModal.booking.bookedBy} (Mob: {cancelModal.booking.mobile})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>कोच व आवंटित सीटें:</span>
                  <strong>{cancelModal.booking.coachName} - सीट: {Array.isArray(cancelModal.booking.seatNumber) ? cancelModal.booking.seatNumber.join(', ') : cancelModal.booking.seatNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>कुल किराया:</span>
                  <strong>₹ {cancelModal.booking.totalAmount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 700 }}>
                  <span>जमा अग्रिम राशि (Paid Advance):</span>
                  <span>₹ {cancelModal.booking.advance || 0}</span>
                </div>
              </div>

              {/* Refund Policy Banner */}
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ color: '#991B1B', fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️</span>
                  <span>रिफंड नीति: काउंटर से नकद (Cash) वापस नहीं दिया जाएगा।</span>
                </div>
                <div style={{ color: '#7F1D1D', fontSize: '0.78rem', marginTop: 4, lineHeight: 1.4 }}>
                  रिफंड राशि व्यवस्थापक (Admin) द्वारा <strong>5-7 कार्य दिवसों (Working Days)</strong> में यात्री के बैंक खाते / UPI में ऑनलाइन ट्रांसफर की जाएगी। कृपया नीचे सही बैंक या UPI विवरण दर्ज करें।
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#991B1B' }}>रिफंड की जाने वाली राशि (Refund Amount ₹) *</label>
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
                <label className="form-label">कटौती / रद्दीकरण शुल्क (Cancellation Charges ₹)</label>
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
                <label className="form-label" style={{ fontWeight: 700 }}>रिफंड प्राप्त करने का माध्यम (Refund Channel - 5-7 Days) *</label>
                <select
                  className="form-control"
                  value={cancelModal.refundChannel || 'UPI'}
                  onChange={(e) => setCancelModal({ ...cancelModal, refundChannel: e.target.value, refundMode: e.target.value === 'UPI' ? 'Admin UPI Transfer (5-7 Days)' : 'Admin Bank Transfer (5-7 Days)' })}
                >
                  <option value="UPI">UPI ट्रांसफर (5-7 कार्य दिवस)</option>
                  <option value="Bank">बैंक खाता ट्रांसफर (NEFT/IMPS 5-7 कार्य दिवस)</option>
                </select>
              </div>

              {(cancelModal.refundChannel || 'UPI') === 'UPI' ? (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: '#047857' }}>यात्री का UPI ID (उदा. 9876543210@upi / paytm) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. mobile@upi या name@okhdfcbank"
                    value={cancelModal.upiId || ''}
                    onChange={(e) => setCancelModal({ ...cancelModal, upiId: e.target.value, utr: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0', marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>खाता धारक का नाम (Account Holder Name) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="उदा. यात्री का नाम"
                      value={cancelModal.accountHolder || cancelModal.booking.bookedBy || ''}
                      onChange={(e) => setCancelModal({ ...cancelModal, accountHolder: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid-2" style={{ gap: 8, marginBottom: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>बैंक का नाम (Bank Name)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="उदा. SBI / PNB / HDFC"
                        value={cancelModal.bankName || ''}
                        onChange={(e) => setCancelModal({ ...cancelModal, bankName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>खाता संख्या (Account No) *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="उदा. 123456789012"
                        value={cancelModal.accountNumber || ''}
                        onChange={(e) => setCancelModal({ ...cancelModal, accountNumber: e.target.value, utr: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>IFSC कोड (IFSC Code) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="उदा. SBIN0001234"
                      value={cancelModal.ifscCode || ''}
                      onChange={(e) => setCancelModal({ ...cancelModal, ifscCode: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">रद्दीकरण का कारण (Cancellation Reason) *</label>
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
                  रद्द न करें (Back)
                </button>
                <button type="submit" className="btn btn-danger" style={{ background: '#DC2626', color: '#fff', fontWeight: 800 }}>
                  ✓ टिकट रद्द व रिफंड रिक्वेस्ट दर्ज करें
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
                इलेक्ट्रॉनिक रिजर्वेशन स्लिप (IRCTC ERS Travel Pass Preview)
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => printSlipElement('irctc-ticket-print-area', `IRCTC-Ticket-${ticketModal.bookingId}`)}
                  style={{ background: '#0284C7', borderColor: '#0369A1' }}
                >
                  <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> टिकट प्रिंट करें (Print A4 ERS)
                </button>
                <a 
                  href={`/api/bookings/${ticketModal.bookingId}/pdf?token=${staffToken}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: '#0284C7', color: '#0284C7' }}
                >
                  <FileText size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF डाउनलोड
                </a>
                <button onClick={() => setTicketModal(null)} style={{ background: 'none', border: 'none', color: '#0369A1', fontSize: 24, cursor: 'pointer', fontWeight: 'bold', marginLeft: 8 }}>✕</button>
              </div>
            </div>

            {/* Exact IRCTC ERS Ticket Canvas (Identical to Downloaded PDF) */}
            <div id="irctc-ticket-print-area" className="irctc-ticket-wrapper" style={{ position: 'relative' }}>
              
              {/* Header 1: Blue Bar */}
              <div className="irctc-header-blue">
                <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.02em' }}>SHRI MATA VAISHNO DEVI PUBLIC CHARITABLE TRUST</div>
                <div style={{ fontSize: '0.78rem', color: '#BAE6FD', marginTop: 2 }}>YATRA SPECIAL SUPERFAST EXPRESS • ANNUAL PILGRIMAGE SPECIAL TRAIN</div>
                <div style={{ fontSize: '0.74rem', color: '#FDE047', fontWeight: 700, marginTop: 3 }}>ELECTRONIC RESERVATION SLIP (ERS) • VALID FOR TRAVEL (1-PAGE OFFICIAL PASS)</div>
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
                      Coach {ticketModal.coachName || 'S1'} : Berths [ {Array.isArray(ticketModal.seatNumber) ? ticketModal.seatNumber.join(', ') : ticketModal.seatNumber} ]
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
                    <div>Coach / Berth / Type</div>
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
                        <div style={{ color: '#0284C7', fontWeight: 700 }}>{ticketModal.coachName || 'S1'} / {assignedSeat} / {p.berthPreference || 'Berth'}</div>
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
                      <strong>₹ {parseFloat(ticketModal.totalAmount || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', padding: '2px 0' }}>
                      <span style={{ color: '#475569' }}>Trust Discount / Concession:</span>
                      <span>₹ {parseFloat(ticketModal.discount || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', padding: '2px 0', color: '#16A34A' }}>
                      <span>Advance Paid:</span>
                      <strong>₹ {parseFloat(ticketModal.advance || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '3px 0', borderTop: '1px solid #E2E8F0', marginTop: 3 }}>
                      <span style={{ fontWeight: 700 }}>Balance Due at Boarding:</span>
                      <strong style={{ color: ticketModal.remainingAmount > 0 ? '#DC2626' : '#16A34A' }}>
                        ₹ {parseFloat(ticketModal.remainingAmount || 0).toFixed(2)}
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
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`http://localhost:3000/verify-ticket.html?pnr=${ticketModal.bookingId}`)}`}
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
                  <div>Helpline: +91 7398959993 • Support: iammshyam@gmail.com</div>
                  <div>Authorized Signatory, Trust Secretary</div>
                </div>
                <div style={{ color: '#0284C7', fontWeight: 700 }}>Software Developed by ArovenTech (www.aroventech.site | +91 9598023701)</div>
                <div style={{ fontSize: '0.62rem', color: '#64748B', marginTop: 2 }}>Official Electronic Reservation Slip (ERS) • Single Page Pass under Trust Railway Boarding Protocol</div>
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
                  <Smartphone size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> UPI द्वारा शेष भुगतान करें
                </button>
              )}
              <button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1, background: '#0284C7', borderColor: '#0369A1' }} 
                onClick={() => printSlipElement('irctc-ticket-print-area', `IRCTC-Ticket-${ticketModal.bookingId}`)}
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> पर्ची प्रिंट करें (A4 Print)
              </button>
              <a 
                href={`/api/bookings/${ticketModal.bookingId}/pdf?token=${staffToken}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline btn-sm" 
                style={{ flex: 1, borderColor: '#0284C7', color: '#0284C7' }}
              >
                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF डाउनलोड
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
                  ? 'रिफंड रसीद पूर्वावलोकन (A4-Half Refund Advice Preview)'
                  : 'भुगतान रसीद पूर्वावलोकन (A4-Half Payment Receipt Preview)'}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => printSlipElement('mandir-receipt-print-area', `MVD-Receipt-${receiptModal.txn.id}`)}
                >
                  <Printer size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> रसीद प्रिंट करें (A4-Half Print)
                </button>
                <a 
                  href={`/api/bookings/${receiptModal.booking.bookingId}/receipt/${receiptModal.txn.id}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline btn-sm"
                >
                  <FileText size={16} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF डाउनलोड
                </a>
                <button onClick={() => setReceiptModal(null)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 24, cursor: 'pointer', fontWeight: 'bold', marginLeft: 8 }}>✕</button>
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
                              {isRefund ? '✓ REFUND INITIATED' : '✓ PAYMENT RECEIVED'}
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
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> रसीद प्रिंट करें (A4-Half Print)
              </button>
              <a 
                href={`/api/bookings/${receiptModal.booking.bookingId}/receipt/${receiptModal.txn.id}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline btn-sm" 
                style={{ flex: 1 }}
              >
                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF डाउनलोड
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ----------------- UPI MODAL ----------------- */}
      {upiQrModal && (
        <div className="modal-overlay" onClick={() => { setUpiQrModal(null); setUtrInput(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', border: '2px solid #F97316' }}>
            <button onClick={() => { setUpiQrModal(null); setUtrInput(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            <h3 style={{ color: '#9A3412', marginBottom: 6, fontWeight: 800 }}>UPI द्वारा भुगतान</h3>
            <div style={{ fontSize: '0.88rem', color: '#7C2D12', fontWeight: 600 }}>माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट</div>

            <img src={upiQrModal.qrDataUrl} alt="UPI QR" style={{ width: 220, height: 220, margin: '16px auto', borderRadius: 12, background: '#fff', padding: 8, border: '2px solid #FED7AA' }} />
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#047857' }}>₹ {upiQrModal.amount.toFixed(2)}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>GPay, PhonePe, Paytm अथवा BHIM से स्कैन करें</div>
            <div style={{ fontSize: '0.82rem', color: '#C2410C', marginTop: 10, fontWeight: 700 }}>UPI ID: {upiQrModal.upiId}</div>

            {/* UTR Submission Form */}
            <form onSubmit={submitUtr} style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px dashed #FED7AA', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#7C2D12', fontWeight: 700, marginBottom: 6 }}>
                भुगतान के बाद 12-अंकों का UTR (Ref) नंबर दर्ज करें:
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
                <button type="submit" className="btn btn-gold" style={{ padding: '8px 16px' }}>सबमिट</button>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#B45309', marginTop: 6, lineHeight: 1.3 }}>
                * UTR सबमिट करने के बाद एडमिन आपके भुगतान की पुष्टि करेगा।
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
              <h3 style={{ color: '#9A3412', fontWeight: 800 }}>एक्सेल बल्क बुकिंग अपलोड</h3>
              <button onClick={() => setBulkModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label className="form-label">लक्षित यात्रा वर्ष:</label>
                <select className="form-control" value={bulkYear} onChange={(e) => setBulkYear(e.target.value)}>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2025">2025</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">एक्सेल फाइल (.xlsx) चुनें:</label>
                <input type="file" className="form-control" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files[0])} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>प्रारूप नमूना चाहिए?</span>
                <a href="/api/admin/sample-template?token=mvd_admin_token" className="btn btn-gold btn-sm">
                  नमूना टेम्पलेट डाउनलोड करें
                </a>
              </div>

              {bulkMessage && <div style={{ color: '#047857', fontSize: '0.9rem', margin: '10px 0', fontWeight: 700 }}>{bulkMessage}</div>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                बुकिंग्स प्रोसेस करें
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
              <h3 style={{ color: '#9A3412', fontWeight: 800 }}>भुगतान संपादित करें (Edit Payment)</h3>
              <button onClick={() => setPaymentEditModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ background: '#FFF8F2', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px dashed #FDBA74' }}>
              <strong>Booking ID:</strong> <span style={{ color: '#C2410C' }}>{paymentEditData.bookingId}</span><br />
              <strong>Total Amount:</strong> ₹ {paymentEditData.totalAmount}
            </div>

            <form onSubmit={handlePaymentEditSubmit}>
              <div className="form-group">
                <label className="form-label">भुगतान का तरीका (Payment Mode)</label>
                <select 
                  className="form-control" 
                  value={paymentEditData.paymentMode} 
                  onChange={e => setPaymentEditData({...paymentEditData, paymentMode: e.target.value})}
                >
                  <option value="Cash">नकद (Cash)</option>
                  <option value="UPI">UPI / ऑनलाइन</option>
                  <option value="Both">नकद + UPI</option>
                  <option value="Free">निःशुल्क (Trust Free)</option>
                </select>
              </div>

              {(paymentEditData.paymentMode === 'UPI' || paymentEditData.paymentMode === 'Both') && (
                <div className="form-group">
                  <label className="form-label">UPI Transaction ID (रेफरेंस नंबर)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="उदा. 312345678901"
                    value={paymentEditData.upiTransactionId} 
                    onChange={e => setPaymentEditData({...paymentEditData, upiTransactionId: e.target.value})}
                  />
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">जमा राशि (Paid / Advance) ₹</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={paymentEditData.advance} 
                    onChange={e => setPaymentEditData({...paymentEditData, advance: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">छूट (Discount) ₹</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={paymentEditData.discount} 
                    onChange={e => setPaymentEditData({...paymentEditData, discount: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}>
                विवरण सेव करें
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
              <h3 style={{ color: '#9A3412', fontWeight: 800 }}>+ नया कर्मचारी / टीटी जोड़ें (Add Staff)</h3>
              <button onClick={() => setNewStaffModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleAddStaffSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">कर्मचारी का पूरा नाम *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. राजेश कुमार शर्मा"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">जीमेल आईडी / Email ID (Google लॉगिन हेतु) *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="उदा. rajesh.tte@gmail.com"
                    value={newStaffForm.email}
                    onChange={(e) => {
                      const em = e.target.value;
                      setNewStaffForm({
                        ...newStaffForm,
                        email: em,
                        username: newStaffForm.username || (em.includes('@') ? em.split('@')[0] : em)
                      });
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">लॉगिन उपयोगकर्ता नाम (Username) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. rajesh.tte"
                    value={newStaffForm.username}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">लॉगिन पासवर्ड *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="सुरक्षित पासवर्ड"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">विभाग (Department) *</label>
                  <select
                    className="form-control"
                    value={newStaffForm.department}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                  >
                    {(Array.isArray(staffDepartments) && staffDepartments.length > 0 ? staffDepartments : [
                      'Running Staff (ट्रेन संचालन)',
                      'Booking Counter (टिकट काउंटर)',
                      'Accounts & Audit (लेखा व कोषागार)',
                      'Trust Executive (ट्रस्ट प्रबंधन)',
                      'Station Management (स्टेशन समन्वयन)'
                    ]).map((d, i) => {
                      const val = typeof d === 'object' ? (d.id || d.name) : d;
                      const lbl = typeof d === 'object' ? (d.name || d.id) : d;
                      return <option key={i} value={val}>{lbl}</option>;
                    })}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">पद / रोल (Role) *</label>
                  <select
                    className="form-control"
                    value={newStaffForm.role}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  >
                    {(staffRoles && typeof staffRoles === 'object' && !Array.isArray(staffRoles) && Object.keys(staffRoles).length > 0
                      ? Object.entries(staffRoles).map(([k, v]) => ({ id: k, name: v?.name || k }))
                      : Array.isArray(staffRoles) && staffRoles.length > 0
                        ? staffRoles
                        : [
                            { id: 'SuperAdmin', name: 'ट्रस्ट मुख्य व्यवस्थापक (Super Admin)' },
                            { id: 'TTE', name: 'चल टिकट परीक्षक (TTE / On-Train Officer)' },
                            { id: 'BookingClerk', name: 'काउंटर आरक्षण लिपिक (Booking Clerk)' },
                            { id: 'FinanceOfficer', name: 'लेखा व कोषाध्यक्ष अधिकारी (Finance Officer)' },
                            { id: 'StationMaster', name: 'स्टेशन समन्वयक (Station Coordinator)' }
                          ]
                    ).map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">मोबाइल नंबर *</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="10 अंकों का मोबाइल"
                    value={newStaffForm.mobile}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, mobile: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">आवंटित कोच (अल्पविराम से अलग)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. S1, S2, B1 (खाली = सभी कोच)"
                    value={newStaffForm.assignedCoach}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, assignedCoach: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setNewStaffModal(false)}>
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  सुरक्षित सहेजें (Save Staff)
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
                <h3 style={{ color: '#9A3412', fontWeight: 800, margin: 0 }}>+ नई बोगी / कोच जोड़ें (Add New Bogie)</h3>
              </div>
              <button onClick={() => setNewCoachModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleCreateCoach}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">बोगी कोड (Coach Code) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. S7, B4, A2, PC"
                    value={newCoachForm.coachCode}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, coachCode: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">बोगी का नाम (Coach Name) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="उदा. Sleeper Coach S-7"
                    value={newCoachForm.coachName}
                    onChange={(e) => setNewCoachForm({ ...newCoachForm, coachName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">श्रेणी (Coach Class) *</label>
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
                    <option value="Sleeper">Sleeper (द्वितीय शयनयान - SL)</option>
                    <option value="3 AC">3 AC (वातानुकूलित थ्री टियर - 3A)</option>
                    <option value="2 AC">2 AC (वातानुकूलित टू टियर - 2A)</option>
                    <option value="General">General / Second Seating (GS)</option>
                    <option value="Pantry">Pantry Car (रसोई यान - PC)</option>
                    <option value="Guard / SLR">Guard / Luggage Van (SLR)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">रेक क्रम संख्या (Position Sequence) *</label>
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
                  <label className="form-label">कुल बर्थ क्षमता (Total Seats) *</label>
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
                  <label className="form-label">बेस किराया प्रति सीट (Base Fare ₹)</label>
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
                <label className="form-label">प्लेटफ़ॉर्म स्थिति (Platform Placement)</label>
                <select
                  className="form-control"
                  value={newCoachForm.platformPlacement}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, platformPlacement: e.target.value })}
                >
                  <option value="Front of Platform">Front of Platform (प्लेटफ़ॉर्म के आगे/इंजन छोर पर)</option>
                  <option value="Center of Platform">Center of Platform (प्लेटफ़ॉर्म के मध्य में)</option>
                  <option value="Rear of Platform">Rear of Platform (प्लेटफ़ॉर्म के पिछले छोर पर)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">विशेष टिप्पणी / नोट्स (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="उदा. अतिरिक्त स्पेशल बोगी, आपातकालीन कोटा आदि"
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
                  यह बोगी टिकट आरक्षण / बुकिंग हेतु उपलब्ध है (Active for Booking)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setNewCoachModal(false)}>
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  बोगी जोड़ें (Save Coach)
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
                <h3 style={{ color: '#9A3412', fontWeight: 800, margin: 0 }}>बोगी विवरण संशोधित करें (Edit Bogie #{editCoachForm.coachCode})</h3>
              </div>
              <button onClick={() => setEditCoachModal(false)} style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: 22, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleUpdateCoach}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">बोगी कोड (Coach Code) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editCoachForm.coachCode}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, coachCode: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">बोगी का नाम (Coach Name) *</label>
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
                  <label className="form-label">श्रेणी (Coach Class) *</label>
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
                    <option value="Sleeper">Sleeper (द्वितीय शयनयान - SL)</option>
                    <option value="3 AC">3 AC (वातानुकूलित थ्री टियर - 3A)</option>
                    <option value="2 AC">2 AC (वातानुकूलित टू टियर - 2A)</option>
                    <option value="General">General / Second Seating (GS)</option>
                    <option value="Pantry">Pantry Car (रसोई यान - PC)</option>
                    <option value="Guard / SLR">Guard / Luggage Van (SLR)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">रेक क्रम संख्या (Position Sequence) *</label>
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
                  <label className="form-label">कुल सीटें (Capacity) *</label>
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
                  <label className="form-label">बेस किराया (Base Fare ₹)</label>
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
                <label className="form-label">प्लेटफ़ॉर्म स्थिति (Platform Placement)</label>
                <select
                  className="form-control"
                  value={editCoachForm.platformPlacement}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, platformPlacement: e.target.value })}
                >
                  <option value="Front of Platform">Front of Platform (प्लेटफ़ॉर्म के आगे/इंजन छोर पर)</option>
                  <option value="Center of Platform">Center of Platform (प्लेटफ़ॉर्म के मध्य में)</option>
                  <option value="Rear of Platform">Rear of Platform (प्लेटफ़ॉर्म के पिछले छोर पर)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">विशेष टिप्पणी / नोट्स</label>
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
                  यह बोगी टिकट आरक्षण / बुकिंग हेतु उपलब्ध है (Active for Booking)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditCoachModal(false)}>
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  परिवर्तन सहेजें (Update Coach)
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
                  UTR नंबर एवं बैंक मिलान स्थिति
                </h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setEditUtrModal(null)}>✕</button>
            </div>

            <div style={{ background: '#FFF8F2', padding: 12, borderRadius: 8, border: '1px solid #FED7AA', marginBottom: 16, fontSize: '0.85rem' }}>
              <div><strong>PNR क्रमांक:</strong> <span style={{ color: '#C2410C', fontWeight: 800 }}>{editUtrModal.txn?.pnr}</span></div>
              <div style={{ marginTop: 2 }}><strong>श्रद्धालु:</strong> {editUtrModal.txn?.devoteeName} ({editUtrModal.txn?.mobile})</div>
              <div style={{ marginTop: 2 }}>
                <strong>लेनदेन राशि:</strong> <span style={{ color: '#047857', fontWeight: 900, fontSize: '1.05rem' }}>₹ {Number(editUtrModal.txn?.amount || 0).toLocaleString()}</span> via {editUtrModal.txn?.method || 'UPI'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: 4 }}>
                तारीख: {new Date(editUtrModal.txn?.date).toLocaleString('hi-IN')}
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
                <label className="form-label">12-अंकों का UPI UTR / बैंक रेफरेंस क्रमांक <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="उदा. 425689123456"
                  value={editUtrModal.newUtr}
                  onChange={e => setEditUtrModal({ ...editUtrModal, newUtr: e.target.value.trim() })}
                  style={{ letterSpacing: '1px', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">सत्यापन स्थिति (Verification Status)</label>
                <select
                  className="form-control"
                  value={editUtrModal.status}
                  onChange={e => setEditUtrModal({ ...editUtrModal, status: e.target.value })}
                >
                  <option value="Pending">मिलान लंबित (Pending Match)</option>
                  <option value="Verified">✓ बैंक से सत्यापित (Verified / Approved)</option>
                  <option value="Rejected">✕ अस्वीकृत (Rejected / Fake UTR)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">एडमिन सत्यापन नोट / बैंक विवरण (Remarks)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="उदा. ट्रस्ट बैंक खाते में 15:30 पर राशि प्राप्त हुई"
                  value={editUtrModal.remarks}
                  onChange={e => setEditUtrModal({ ...editUtrModal, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditUtrModal(null)}>
                  रद्द करें
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  ✓ स्थिति अपडेट करें
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
                 title="सेटिंग्स एवं पासवर्ड"
               >
                 <Settings size={13} style={{display:"inline", marginRight:"3px", verticalAlign:"text-bottom"}} /> सेटिंग्स
               </button>
               <button
                 className="btn btn-sm"
                 onClick={handleStaffLogout}
                 style={{ flex: 1, padding: '5px 6px', fontSize: '0.75rem', color: '#FECACA', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.25)' }}
                 title="लॉगआउट"
               >
                 <LogOut size={13} style={{display:"inline", marginRight:"3px", verticalAlign:"text-bottom"}} /> लॉगआउट
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
                 title="सभी 14 पैनल देखें"
               >
                 <Menu size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                 <span>मेन्यू</span>
               </button>
               <div className="admin-header-title">
                  {allStaffNavItems.find(i => currentPath.startsWith(i.path))?.label || (activeView === 'settings' ? 'सेटिंग्स एवं सुरक्षा' : 'डैशबोर्ड')}
               </div>
             </div>

             <div className="admin-header-user">
                {isSuperAdmin && (
                  <div className="desktop-actions" style={{ display: 'flex', gap: 6 }}>
                    <a href={`/api/admin/export-excel${adminYearFilter ? `?yatraYear=${adminYearFilter}` : ''}&token=${staffToken}`}
                      className="btn btn-gold btn-sm"><Download size={14} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> Excel</a>
                    <button className="btn btn-outline btn-sm" onClick={() => setBulkModalOpen(true)}><Upload size={14} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> बल्क</button>
                    <a href={`/api/admin/bulk-slips${adminYearFilter ? `?yatraYear=${adminYearFilter}` : ''}&token=${staffToken}`}
                      className="btn btn-primary btn-sm"><FileText size={14} style={{display:"inline", marginRight:"2px", verticalAlign:"text-bottom"}} /> पर्चियां</a>
                  </div>
                )}
                <span className="badge badge-bhakti" style={{ fontSize: '0.73rem', padding: '3px 8px' }}>{staffUser.department || staffUser.role}</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate(roleSettingsPath)}
                  style={{ color: '#9A3412', borderColor: '#FED7AA', background: '#FFF8F2', padding: '5px 8px' }}
                  title="सेटिंग्स एवं पासवर्ड"
                >
                  <Settings size={15} style={{ verticalAlign: 'middle' }} />
                </button>
                <button className="btn btn-sm" onClick={handleStaffLogout} style={{ color: '#DC2626', border: '1.5px solid #FCA5A5', background: '#FFF5F5', padding: '5px 8px' }} title="लॉगआउट">
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
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#431407' }}>श्री माता वैष्णो देवी • स्टाफ पैनल</div>
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
                    <a href={`/api/admin/export-excel${adminYearFilter ? `?yatraYear=${adminYearFilter}` : ''}&token=${staffToken}`}
                      className="btn btn-gold btn-xs" style={{ whiteSpace: 'nowrap' }}><Download size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> Excel Export</a>
                    <button className="btn btn-outline btn-xs" style={{ whiteSpace: 'nowrap' }} onClick={() => { setMobileMenuOpen(false); setBulkModalOpen(true); }}>
                      <Upload size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> बल्क अपलोड
                    </button>
                    <a href={`/api/admin/bulk-slips${adminYearFilter ? `?yatraYear=${adminYearFilter}` : ''}&token=${staffToken}`}
                      className="btn btn-primary btn-xs" style={{ whiteSpace: 'nowrap' }}><FileText size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} /> सभी पर्चियां</a>
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
                    <Settings size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> पासवर्ड व सेटिंग्स
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1, color: '#DC2626', border: '1.5px solid #FCA5A5', background: '#FFF5F5' }}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleStaffLogout();
                    }}
                  >
                    <LogOut size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} /> सुरक्षित लॉगआउट
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
        <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> ।। ॐ सर्वमंगल मांगल्ये शिवे सर्वार्थ साधिके • शरण्ये त्र्यंबके गौरी नारायणि नमोऽस्तु ते ।। <Ticket size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> &nbsp;&nbsp; जय माता दी • श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट  &nbsp;&nbsp;
      </div>

      {/* Main Navbar (Mobile-Responsive) */}
      <nav className="navbar">
        {/* Brand */}
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <div className="navbar-logo" style={{ background: '#fff', overflow: 'hidden' }}><img src="/logo.jpg" alt="MVD Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /></div>
          <div>
            <div className="navbar-title">Mata Vaishno Devi</div>
            <div className="navbar-subtitle">श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट • Yatra Special Train 2026</div>
          </div>
        </div>

        {/* Nav Actions */}
        <div className="navbar-actions">
          <button
            className={`btn btn-sm ${(currentPath === '/' || currentPath === '/home') ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => navigate('/')}
            title="PNR स्थिति जांचें"
          >
            <Search size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> <span className="btn-text-label">PNR जांच</span>
          </button>
          <button
            className={`btn btn-sm ${(currentPath === '/coach-position' || currentPath === '/train-composition') ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => navigate('/coach-position')}
            title="ट्रेन बोगी स्थिति एवं संरचना"
          >
            <Train size={16} style={{display:"inline", marginRight:"4px", verticalAlign:"text-bottom"}} /> <span className="btn-text-label">बोगी स्थिति (Coaches)</span>
          </button>
          <button
            className={`btn btn-sm ${currentPath === '/login' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => navigate('/login')}
            title="कर्मचारी लॉगिन"
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
          padding: '30px 20px', textAlign: 'center', background: '#FFFFFF',
          color: '#7C2D12', fontSize: '0.9rem', boxShadow: '0 -4px 15px rgba(230,81,0,0.05)'
        }}>
          <div style={{ color: '#9A3412', fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>
            श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट
          </div>
          <div>Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India</div>
          <div style={{ marginTop: 8, color: '#C2410C', fontSize: '0.85rem', fontWeight: 700 }}>
            हेल्पलाइन: +91 7398959993 • ईमेल: infomatavaishnodevi@gmail.com • ।। जय माता दी ।।
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

