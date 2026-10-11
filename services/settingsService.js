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
    Sleeper: 3500,
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
  hideBerthNumber: false,
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
    // Always try Firebase first (primary source of truth)
    try {
      const docRef = db.collection('settings').doc('general');
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        // Normalize fares
        const fares = data.fares || {
          AC: Number(data.fareAC || 4000),
          Sleeper: Number(data.fareSleeper || 3000),
          General: Number(data.fareGeneral || 2000)
        };
        inMemorySettings = {
          ...DEFAULT_SETTINGS,
          ...data,
          fares,
          fareSleeper: fares.Sleeper,
          fareAC: fares.AC,
          fareGeneral: fares.General
        };
        return inMemorySettings;
      } else {
        // First time: Initialize settings in Firebase with defaults
        const defaults = {
          ...DEFAULT_SETTINGS,
          fareSleeper: DEFAULT_SETTINGS.fares.Sleeper,
          fareAC: DEFAULT_SETTINGS.fares.AC,
          fareGeneral: DEFAULT_SETTINGS.fares.General,
          createdAt: new Date().toISOString()
        };
        await docRef.set(defaults);
        inMemorySettings = defaults;
        return defaults;
      }
    } catch (e) {
      console.warn('⚠️ Firebase settings read fallback to local:', e.message);
    }
    // Emergency fallback: local disk
    const diskSettings = loadSettingsFromDisk();
    const fares = diskSettings.fares || {
      AC: Number(diskSettings.fareAC || 4000),
      Sleeper: Number(diskSettings.fareSleeper || 3000),
      General: Number(diskSettings.fareGeneral || 2000)
    };
    return {
      ...diskSettings,
      fares,
      fareSleeper: fares.Sleeper,
      fareAC: fares.AC,
      fareGeneral: fares.General
    };
  }

  static async updateSettings(updates, updatedByName = 'Admin') {
    const current = await this.getSettings();

    // Harmonize fares between top-level fields and fares object
    const fareSleeper = Number(updates.fareSleeper !== undefined ? updates.fareSleeper : (updates.fares?.Sleeper || current.fareSleeper || 3000));
    const fareAC = Number(updates.fareAC !== undefined ? updates.fareAC : (updates.fares?.AC || current.fareAC || 4000));
    const fareGeneral = Number(updates.fareGeneral !== undefined ? updates.fareGeneral : (updates.fares?.General || current.fareGeneral || 2000));

    const fares = {
      AC: fareAC,
      Sleeper: fareSleeper,
      General: fareGeneral
    };

    const updated = {
      ...current,
      ...updates,
      fares,
      fareSleeper,
      fareAC,
      fareGeneral,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: updatedByName
    };

    // Primary: Save to Firebase Firestore
    try {
      await db.collection('settings').doc('general').set(updated);
      inMemorySettings = updated;
      saveSettingsToDisk(updated);
      console.log('✅ Settings saved to Firebase Firestore & local fallback.');
    } catch (e) {
      console.warn('⚠️ Firestore settings write failed, saving locally:', e.message);
      saveSettingsToDisk(updated);
    }

    // Automatically sync updated fares with all active coaches in Coach Management
    try {
      const coachesSnap = await db.collection('trainCoaches').get();
      if (!coachesSnap.empty) {
        for (const doc of coachesSnap.docs) {
          const c = doc.data();
          let targetFare = null;
          if (c.coachClass === 'AC') targetFare = fareAC;
          else if (c.coachClass === 'Sleeper') targetFare = fareSleeper;
          else if (c.coachClass === 'General') targetFare = fareGeneral;

          if (targetFare !== null && c.fare !== targetFare) {
            await db.collection('trainCoaches').doc(doc.id).set({
              fare: targetFare,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
        console.log('✅ Synchronized all coach fares with updated project fares.');
      }
    } catch (coachErr) {
      console.warn('⚠️ Auto coach fare sync notice:', coachErr.message);
    }

    try {
      const { StaffService } = require('./staffService');
      await StaffService.logAudit({
        action: 'SETTINGS_UPDATED',
        performedBy: updatedByName,
        details: `प्रोजेक्ट सेटिंग्स अपडेट की गई: UPI ID: ${updated.upiId}, स्लीपर: ₹${fareSleeper}, एसी: ₹${fareAC}`
      });
    } catch (e) { }

    return updated;
  }
}

module.exports = { SettingsService, DEFAULT_SETTINGS };
