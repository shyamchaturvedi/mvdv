const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebase');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

const DEFAULT_SETTINGS = {
  // UPI & Digital Payment
  upiId: '7398959993@okbizaxis',
  upiPayeeName: 'Shri Mata Vaishno Devi Public Charitable Trust',
  upiMerchantCode: '0000',
  defaultAdvance: 1000,
  enableUpiOnlinePayment: true,

  // Trust & Contact Information
  trustName: 'श्री माता वैष्णो देवी पब्लिक चैरिटेबल ट्रस्ट',
  helplineNumber: '+91 9598023701',
  officialEmail: 'iammshyam@gmail.com',
  adminSupportEmail: 'iammshyam@gmail.com',
  officeAddress: 'Nagla Deena, Bholepur Fatehgarh, Uttar Pradesh, 209601 India',
  sacredAnnouncement: '।। ॐ सर्वमंगल मांगल्ये शिवे सर्वार्थ साधिके • शरण्ये त्र्यंबके गौरी नारायणि नमोऽस्तु ते ।।',

  // Developer & System Branding
  developerName: 'ArovenTech',
  developerWebsite: 'www.aroventech.site',
  developerPhone: '+91 9598023701',
  developerSupportEmail: 'iammshyam@gmail.com',
  softwareBrandingText: 'Software Developed by ArovenTech (www.aroventech.site | +91 9598023701)',

  // Fares & Yatra Configuration
  activeYatraYear: 2026,
  availableYears: [2024, 2025, 2026, 2027, 2028],
  defaultTravelDate: '2026-10-15',
  journeyDate: '2026-10-15',
  returnTravelDate: '2026-10-22',
  fares: {
    AC: 4000,
    Sleeper: 3000,
    General: 2000
  },

  // Complete Route Stations: Lucknow to Jammu Tawi & Shri Mata Vaishno Devi Katra
  routeStations: [
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
  ],

  // Security & Audit
  enablePublicPnrSearch: true,
  strictQrVerification: true,
  updatedAt: new Date().toISOString()
};

const os = require('os');
const TMP_SETTINGS_FILE = path.join(os.tmpdir(), 'mvd_settings.json');
let inMemorySettings = null;

function loadSettingsFromDisk() {
  if (inMemorySettings) return inMemorySettings;
  try {
    const file = fs.existsSync(SETTINGS_FILE) ? SETTINGS_FILE : (fs.existsSync(TMP_SETTINGS_FILE) ? TMP_SETTINGS_FILE : null);
    if (file) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      inMemorySettings = { ...DEFAULT_SETTINGS, ...data };
      return inMemorySettings;
    }
  } catch (err) {
    // Fallback to defaults
  }
  inMemorySettings = { ...DEFAULT_SETTINGS };
  return inMemorySettings;
}

function saveSettingsToDisk(settings) {
  inMemorySettings = settings;
  try {
    const dataDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return;
  } catch (_) {
    try {
      fs.writeFileSync(TMP_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (err) {
      // Memory state is preserved
    }
  }
}

class SettingsService {
  static async getSettings() {
    try {
      const docRef = db.collection('settings').doc('general');
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        return { ...DEFAULT_SETTINGS, ...data };
      }
    } catch (e) {
      // Fallback to local disk
    }
    return loadSettingsFromDisk();
  }

  static async updateSettings(updates, updatedByName = 'Admin') {
    const current = await this.getSettings();
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: updatedByName
    };

    saveSettingsToDisk(updated);

    try {
      await db.collection('settings').doc('general').set(updated);
    } catch (e) {
      console.warn('Firestore settings write warning:', e.message);
    }

    try {
      const { StaffService } = require('./staffService');
      await StaffService.logAudit({
        action: 'SETTINGS_UPDATED',
        performedBy: updatedByName,
        details: `प्रोजेक्ट सेटिंग्स अपडेट की गई: UPI ID: ${updated.upiId}, ट्रस्ट नाम: ${updated.trustName}`
      });
    } catch (e) {}

    return updated;
  }
}

module.exports = { SettingsService, DEFAULT_SETTINGS };
