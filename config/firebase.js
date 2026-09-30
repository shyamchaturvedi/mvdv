const fs = require('fs');
const path = require('path');
require('dotenv').config();

let admin = null;
let db = null;
let isFirebaseActive = false;

// Check if Firebase service account credentials exist
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
  ? path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT)
  : path.resolve(__dirname, '..', 'serviceAccountKey.json');

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
    }
    
    db = admin.firestore();
    isFirebaseActive = true;
    console.log('✅ Connected to Firebase Cloud Firestore successfully.');
  } else if (process.env.FIREBASE_CONFIG) {
    admin = require('firebase-admin');
    admin.initializeApp();
    db = admin.firestore();
    isFirebaseActive = true;
    console.log('✅ Connected to Firebase via Application Default Credentials.');
  } else {
    console.log('ℹ️ Firebase serviceAccountKey.json not found. Operating in local JSON persistent Firestore-compatible mode.');
  }
} catch (error) {
  console.warn('⚠️ Firebase initialization warning:', error.message);
  console.log('ℹ️ Falling back to local persistent Firestore-compatible database.');
}

// -------------------------------------------------------------
// Local JSON Storage fallback implementing Firestore API
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadLocalData() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      bookings: [],
      admins: [
        {
          id: 'admin_1',
          username: process.env.ADMIN_USERNAME || 'admin',
          passwordHash: '$2a$10$wT/pZ/sHjIovPzB1X8d0d.NfJgA0kF0c5vUaI7X3Qe3Ea2zIeP2tK' // admin@mvd2026
        }
      ],
      settings: {
        currentYatraYear: 2026,
        trainName: 'Mata Vaishno Devi Yatra Special Superfast',
        trainNumber: '04201 / 04202',
        departureTime: '18:30 IST',
        destinationStation: 'Shri Mata Vaishno Devi Katra (SVDK)',
        fares: {
          AC: 4000,
          Sleeper: 3000,
          General: 2000
        }
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading local db.json:', e);
    return { bookings: [], admins: [], settings: {} };
  }
}

function saveLocalData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Fallback Local Firestore Implementation
class LocalCollectionReference {
  constructor(collectionName) {
    this.name = collectionName;
  }

  _ensureArray(data) {
    if (!Array.isArray(data[this.name])) {
      if (data[this.name] && typeof data[this.name] === 'object') {
        // Convert object mapping to array if needed
        data[this.name] = Object.entries(data[this.name]).map(([k, v]) => ({ id: k, ...v }));
      } else {
        data[this.name] = [];
      }
    }
    return data[this.name];
  }

  async get() {
    const data = loadLocalData();
    const items = this._ensureArray(data);
    const docs = items.map(item => ({
      id: item.id || item.bookingId || item.staffId || item.logId,
      data: () => ({ ...item }),
      exists: true
    }));
    return {
      empty: items.length === 0,
      size: items.length,
      docs,
      forEach: (cb) => docs.forEach(cb)
    };
  }

  async add(item) {
    const data = loadLocalData();
    const items = this._ensureArray(data);
    const id = item.id || item.bookingId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newItem = { ...item, id };
    items.push(newItem);
    data[this.name] = items;
    saveLocalData(data);
    return {
      id,
      get: async () => ({ id, data: () => ({ ...newItem }), exists: true })
    };
  }

  doc(docId) {
    const self = this;
    return {
      id: docId,
      async get() {
        const data = loadLocalData();
        const items = self._ensureArray(data);
        const item = items.find(i => (i.id === docId || i.bookingId === docId));
        return {
          id: docId,
          exists: !!item,
          data: () => (item ? { ...item } : null)
        };
      },
      async set(item, options = {}) {
        const data = loadLocalData();
        const items = self._ensureArray(data);
        const idx = items.findIndex(i => (i.id === docId || i.bookingId === docId));
        const finalItem = options.merge && idx >= 0 ? { ...items[idx], ...item, id: docId } : { ...item, id: docId };
        if (idx >= 0) {
          items[idx] = finalItem;
        } else {
          items.push(finalItem);
        }
        data[self.name] = items;
        saveLocalData(data);
        return finalItem;
      },
      async update(fields) {
        const data = loadLocalData();
        const items = self._ensureArray(data);
        const idx = items.findIndex(i => (i.id === docId || i.bookingId === docId));
        if (idx === -1) throw new Error(`Document ${docId} not found`);
        items[idx] = { ...items[idx], ...fields };
        data[self.name] = items;
        saveLocalData(data);
        return items[idx];
      },
      async delete() {
        const data = loadLocalData();
        const items = self._ensureArray(data);
        data[self.name] = items.filter(i => (i.id !== docId && i.bookingId !== docId));
        saveLocalData(data);
      }
    };
  }

  where(field, operator, value) {
    const self = this;
    return {
      async get() {
        const data = loadLocalData();
        const items = data[self.name] || [];
        const filtered = items.filter(item => {
          if (operator === '==') return item[field] === value;
          if (operator === '>=') return item[field] >= value;
          if (operator === '<=') return item[field] <= value;
          if (operator === 'in') return Array.isArray(value) && value.includes(item[field]);
          return true;
        });
        const docs = filtered.map(item => ({
          id: item.id || item.bookingId || item.staffId || item.logId,
          data: () => ({ ...item }),
          exists: true
        }));
        return {
          empty: filtered.length === 0,
          size: filtered.length,
          docs,
          forEach: (cb) => docs.forEach(cb)
        };
      }
    };
  }
}

class LocalFirestoreFallback {
  collection(name) {
    return new LocalCollectionReference(name);
  }
}

const firestoreInstance = isFirebaseActive ? db : new LocalFirestoreFallback();

module.exports = {
  admin,
  db: firestoreInstance,
  isFirebaseActive,
  loadLocalData,
  saveLocalData
};
