const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StaffService, ROLES } = require('./staffService');

const SESSIONS_FILE = path.join(__dirname, '../data/sessions.json');
const TMP_SESSIONS_FILE = path.join(os.tmpdir(), 'mvd_sessions.json');

// In-memory token store backed by persistent disk storage
const activeSessions = new Map();

function loadSessionsFromDisk() {
  try {
    const file = fs.existsSync(SESSIONS_FILE) ? SESSIONS_FILE : (fs.existsSync(TMP_SESSIONS_FILE) ? TMP_SESSIONS_FILE : null);
    if (file) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const now = Date.now();
      for (const [token, session] of Object.entries(data)) {
        if (session && session.expiresAt > now) {
          activeSessions.set(token, session);
        }
      }
    }
  } catch (err) {
    // Graceful fallback to memory
  }
}

function saveSessionsToDisk() {
  try {
    const obj = {};
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
      if (session && session.expiresAt > now) {
        obj[token] = session;
      }
    }
    try {
      const dataDir = path.dirname(SESSIONS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
      return;
    } catch (_) {
      fs.writeFileSync(TMP_SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    }
  } catch (err) {
    // In-memory map is always active and preserved
  }
}

// Initial load
loadSessionsFromDisk();

class AuthService {
  // Generate secure random token
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Unified login for Admin, TTE, Booking Clerk, Finance Officer via Email or Username + Password
  static async login(identifier, password) {
    if (!identifier || !password) {
      throw new Error('ईमेल आईडी / यूजरनेम और पासवर्ड अनिवार्य हैं।');
    }

    const cleanId = identifier.trim().toLowerCase();

    // 1. Check SuperAdmin credentials by username 'admin' or admin email
    const adminPass = process.env.ADMIN_PASSWORD || 'admin@mvd2026';
    const adminEmail = (process.env.ADMIN_EMAIL || 'iammshyam@gmail.com').trim().toLowerCase();

    if (cleanId === 'admin' || cleanId === adminEmail || cleanId === 'iammshyam@gmail.com') {
      if (password !== adminPass) {
        throw new Error('व्यवस्थापक (Admin) पासवर्ड अमान्य है।');
      }
      const adminUser = {
        staffId: 'ADMIN-001',
        name: 'मुख्य ट्रस्ट व्यवस्थापक (Shyam Chaturvedi)',
        username: 'admin',
        email: 'iammshyam@gmail.com',
        role: 'SuperAdmin',
        department: 'Trust Executive (ट्रस्ट प्रबंधन)',
        status: 'Active',
        permissions: ['all', 'staff_manage', 'financial_reconcile', 'audit_view', 'delete_booking', 'export_excel', 'create_booking', 'checkin', 'collect_due', 'view_chart', 'print_chart']
      };

      const token = this.generateToken();
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      activeSessions.set(token, { user: adminUser, expiresAt });
      saveSessionsToDisk();

      await StaffService.logAudit({
        action: 'STAFF_LOGIN',
        performedBy: adminUser,
        details: `मुख्य ट्रस्ट व्यवस्थापक (${adminUser.name} - ${cleanId}) ने पासवर्ड के साथ लॉगिन किया।`
      });

      return {
        success: true,
        message: 'मुख्य व्यवस्थापक प्रमाणीकरण सफल।',
        token,
        user: adminUser,
        expiresAt
      };
    }

    // 2. Check Staff credentials via StaffService
    const staff = await StaffService.authenticateStaff(cleanId, password);

    // Get permissions list
    const roleDef = ROLES[staff.role] || {};
    const permissions = roleDef.permissions || [];
    const staffUser = {
      ...staff,
      permissions
    };

    const token = this.generateToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    activeSessions.set(token, { user: staffUser, expiresAt });
    saveSessionsToDisk();

    await StaffService.logAudit({
      action: 'STAFF_LOGIN',
      performedBy: staffUser,
      details: `${staffUser.name} (${staffUser.role} - ${staffUser.email || staffUser.username}) ने सफलतापूर्वक लॉगिन किया।`
    });

    return {
      success: true,
      message: 'कर्मचारी प्रमाणीकरण सफल।',
      token,
      user: staffUser,
      expiresAt
    };
  }

  // Unified Google Login for Admin & Registered Staff
  static async loginWithGoogle(emailOrObj, profileObj = {}) {
    let email = typeof emailOrObj === 'string' ? emailOrObj : emailOrObj?.email;
    let profile = typeof emailOrObj === 'object' ? { ...emailOrObj, ...profileObj } : profileObj;

    if (!email) {
      throw new Error('Google Email अनिवार्य है।');
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check SuperAdmin email (Strict exact match only: iammshyam@gmail.com)
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const authorizedSuperAdminEmails = [
      'iammshyam@gmail.com',
      configuredAdminEmail
    ].filter(Boolean);

    if (authorizedSuperAdminEmails.includes(cleanEmail)) {
      const adminUser = {
        staffId: 'ADMIN-001',
        name: profile.name || 'मुख्य ट्रस्ट व्यवस्थापक (Shyam Chaturvedi)',
        email: cleanEmail,
        username: 'admin',
        role: 'SuperAdmin',
        department: 'Trust Executive (ट्रस्ट प्रबंधन)',
        photoUrl: profile.photoUrl || '',
        status: 'Active',
        permissions: ['all', 'staff_manage', 'financial_reconcile', 'audit_view', 'delete_booking', 'export_excel', 'create_booking', 'checkin', 'collect_due', 'view_chart', 'print_chart']
      };

      const token = this.generateToken();
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      activeSessions.set(token, { user: adminUser, expiresAt });
      saveSessionsToDisk();

      await StaffService.logAudit({
        action: 'GOOGLE_LOGIN',
        performedBy: adminUser,
        details: `मुख्य व्यवस्थापक (${adminUser.name} - ${cleanEmail}) ने Google द्वारा लॉगिन किया।`
      });

      return {
        success: true,
        message: 'Google द्वारा मुख्य व्यवस्थापक प्रमाणीकरण सफल।',
        token,
        user: adminUser,
        expiresAt
      };
    }

    // 2. Look up in staff database strictly by registered email
    const staff = await StaffService.authenticateByGoogle(cleanEmail, profile);

    const roleDef = ROLES[staff.role] || {};
    const permissions = roleDef.permissions || [];
    const staffUser = {
      ...staff,
      permissions
    };

    const token = this.generateToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    activeSessions.set(token, { user: staffUser, expiresAt });
    saveSessionsToDisk();

    await StaffService.logAudit({
      action: 'GOOGLE_LOGIN',
      performedBy: staffUser,
      details: `${staffUser.name} (${staffUser.role} - ${cleanEmail}) ने Google द्वारा सफलतापूर्वक लॉगिन किया।`
    });

    return {
      success: true,
      message: 'Google द्वारा कर्मचारी प्रमाणीकरण सफल।',
      token,
      user: staffUser,
      expiresAt
    };
  }

  // Validate token
  static validateToken(token) {
    if (!token) return null;

    // Standard static development/admin token backward compatibility
    if (token === 'mvd_admin_token' || token === 'mvd_tte_session_token') {
      return {
        staffId: token === 'mvd_admin_token' ? 'ADMIN-001' : 'STF-101',
        name: token === 'mvd_admin_token' ? 'मुख्य ट्रस्ट व्यवस्थापक' : 'श्री रमाकांत शर्मा (TTE)',
        username: token === 'mvd_admin_token' ? 'admin' : 'tt',
        role: token === 'mvd_admin_token' ? 'SuperAdmin' : 'TTE',
        department: token === 'mvd_admin_token' ? 'Trust Executive' : 'Running Staff',
        status: 'Active',
        permissions: token === 'mvd_admin_token' 
          ? ['all', 'staff_manage', 'financial_reconcile', 'audit_view', 'delete_booking', 'export_excel', 'create_booking', 'checkin', 'collect_due', 'view_chart', 'print_chart']
          : ['checkin', 'collect_due', 'view_chart', 'print_chart']
      };
    }

    // Check in-memory map first
    let session = activeSessions.get(token);

    // If not found in memory, reload from disk
    if (!session) {
      loadSessionsFromDisk();
      session = activeSessions.get(token);
    }

    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      saveSessionsToDisk();
      return null;
    }

    return session.user;
  }

  // Revoke token / Logout
  static logout(token) {
    if (token && activeSessions.has(token)) {
      activeSessions.delete(token);
      saveSessionsToDisk();
    }
    return { success: true, message: 'सफलतापूर्वक लॉगआउट किया गया।' };
  }

  // Check if user has permission
  static hasPermission(user, requiredPermission) {
    if (!user || user.status !== 'Active') return false;
    if (user.role === 'SuperAdmin' || (user.permissions && user.permissions.includes('all'))) {
      return true;
    }
    if (!requiredPermission) return true;
    return user.permissions && user.permissions.includes(requiredPermission);
  }
}

// Express Middleware for High Security Role-Based Access Control
function requireAuth(requiredPermission = null) {
  return (req, res, next) => {
    let token = null;

    // 1. Authorization header: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 2. Custom header: "x-staff-token"
    if (!token && req.headers['x-staff-token']) {
      token = req.headers['x-staff-token'].trim();
    }

    // 3. Query param: "?token="
    if (!token && req.query.token) {
      token = req.query.token.trim();
    }

    // 4. Session fallback
    if (!token && req.session && req.session.token) {
      token = req.session.token;
    }

    let user = token ? AuthService.validateToken(token) : null;

    // 5. Direct Express Session Fallback (if opening PDF/report in new tab)
    if (!user && req.session && (req.session.isAdmin || req.session.staffUser)) {
      user = req.session.staffUser || {
        staffId: 'ADMIN-001',
        name: 'मुख्य ट्रस्ट व्यवस्थापक (Chief Admin)',
        username: 'admin',
        role: 'SuperAdmin',
        department: 'Trust Executive',
        status: 'Active',
        permissions: ['all', 'staff_manage', 'financial_reconcile', 'audit_view', 'delete_booking', 'export_excel', 'create_booking', 'checkin', 'collect_due', 'view_chart', 'print_chart']
      };
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'सुरक्षा चेतावनी: इस सेवा का उपयोग करने के लिए अधिकृत कर्मचारी या व्यवस्थापक लॉगिन अनिवार्य है। (Access Denied: Valid Staff Token Required)'
      });
    }

    if (requiredPermission && !AuthService.hasPermission(user, requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: `अनाधिकृत: आपके पद (${user.role}) को इस कार्य की अनुमति नहीं है। (Forbidden: Permission '${requiredPermission}' required)`
      });
    }

    req.user = user;
    next();
  };
}

module.exports = {
  AuthService,
  requireAuth
};
