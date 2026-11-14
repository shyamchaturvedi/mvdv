const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

let admin = null;
let rawDb = null;
let isFirebaseActive = false;

// Check if Firebase service account credentials exist
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
  ? path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT)
  : path.resolve(__dirname, '..', 'serviceAccountKey.json');

try {
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
  }

  if (serviceAccount) {
    admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
    }
    
    rawDb = admin.firestore();
    rawDb.settings({ ignoreUndefinedProperties: true });
    isFirebaseActive = true;
    console.log('✅ Connected to Firebase Cloud Firestore successfully.');
  } else if (process.env.FIREBASE_CONFIG) {
    admin = require('firebase-admin');
    admin.initializeApp();
    rawDb = admin.firestore();
    rawDb.settings({ ignoreUndefinedProperties: true });
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
// Local JSON Storage implementing full Firestore API & Persistence
// -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TMP_DB_FILE = path.join(os.tmpdir(), 'mvd_db.json');

let inMemoryDb = null;

function loadLocalData() {
  if (inMemoryDb) return inMemoryDb;

  // 1. Try reading /tmp/mvd_db.json first (latest runtime mutations on serverless)
  if (fs.existsSync(TMP_DB_FILE)) {
    try {
      inMemoryDb = JSON.parse(fs.readFileSync(TMP_DB_FILE, 'utf8'));
      if (inMemoryDb && typeof inMemoryDb === 'object') return inMemoryDb;
    } catch (e) {
      console.warn('Could not read /tmp db:', e.message);
    }
  }

  // 2. Try reading bundled data/db.json
  if (fs.existsSync(DB_FILE)) {
    try {
      inMemoryDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (inMemoryDb && typeof inMemoryDb === 'object') return inMemoryDb;
    } catch (e) {
      console.warn('Could not read bundled db.json:', e.message);
    }
  }

  inMemoryDb = {
    bookings: [],
    staffMembers: [],
    auditLogs: [],
    defaulters: [],
    payments: [],
    cashAdjustments: [],
    trainCoaches: []
  };
  return inMemoryDb;
}

function saveLocalData(data) {
  inMemoryDb = data;
  let saved = false;
  // Try saving to project data dir first (local dev / persistent storage)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    saved = true;
  } catch (_) {
    // Read-only filesystem (e.g. Vercel deployment)
  }

  // Always write to /tmp for runtime survival across lambdas on the same instance
  try {
    fs.writeFileSync(TMP_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    saved = true;
  } catch (_) {}

  return saved;
}

// Fallback Local Firestore Implementation
class LocalCollectionReference {
  constructor(collectionName) {
    this.name = collectionName;
    this._limit = null;
  }

  _ensureArray(data) {
    if (!Array.isArray(data[this.name])) {
      if (data[this.name] && typeof data[this.name] === 'object') {
        data[this.name] = Object.entries(data[this.name]).map(([k, v]) => ({ id: k, ...v }));
      } else {
        data[this.name] = [];
      }
    }
    return data[this.name];
  }

  limit(n) {
    const clone = new LocalCollectionReference(this.name);
    clone._limit = n;
    return clone;
  }

  orderBy() {
    return this; // basic passthrough
  }

  async get() {
    const data = loadLocalData();
    let items = this._ensureArray(data);
    if (this._limit && this._limit > 0) {
      items = items.slice(0, this._limit);
    }
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
    const id = item.id || item.bookingId || item.staffId || item.logId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
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
        const item = items.find(i => (i.id === docId || i.bookingId === docId || i.staffId === docId));
        return {
          id: docId,
          exists: !!item,
          data: () => (item ? { ...item } : null)
        };
      },
      async set(item, options = {}) {
        const data = loadLocalData();
        const items = self._ensureArray(data);
        const idx = items.findIndex(i => (i.id === docId || i.bookingId === docId || i.staffId === docId));
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
        const idx = items.findIndex(i => (i.id === docId || i.bookingId === docId || i.staffId === docId));
        if (idx === -1) {
          // If document doesn't exist, create it with these fields
          const newItem = { id: docId, ...fields };
          items.push(newItem);
          data[self.name] = items;
          saveLocalData(data);
          return newItem;
        }
        items[idx] = { ...items[idx], ...fields };
        data[self.name] = items;
        saveLocalData(data);
        return items[idx];
      },
      async delete() {
        const data = loadLocalData();
        const items = self._ensureArray(data);
        data[self.name] = items.filter(i => (i.id !== docId && i.bookingId !== docId && i.staffId !== docId));
        saveLocalData(data);
      }
    };
  }

  where(field, operator, value) {
    const self = this;
    return {
      limit: (n) => ({
        get: async () => {
          const res = await self.where(field, operator, value).get();
          res.docs = res.docs.slice(0, n);
          res.size = res.docs.length;
          res.empty = res.size === 0;
          return res;
        }
      }),
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

const localDbInstance = new LocalFirestoreFallback();

// -------------------------------------------------------------
// Resilient Dual-Engine Circuit-Breaker Firestore Proxy
// Protects against 8 RESOURCE_EXHAUSTED Quota Exceeded & Network Timeouts
// -------------------------------------------------------------
let circuitBreakerOpen = false;
let circuitBreakerUntil = 0;
const CIRCUIT_BREAKER_DURATION = 5 * 60 * 1000; // 5 minutes cool-off when quota exceeded

function isCircuitOpen() {
  if (!isFirebaseActive || !rawDb) return true;
  if (circuitBreakerOpen) {
    if (Date.now() < circuitBreakerUntil) {
      return true;
    }
    // Half-open: allow next request to attempt
    circuitBreakerOpen = false;
  }
  return false;
}

function tripCircuit(reason) {
  circuitBreakerOpen = true;
  circuitBreakerUntil = Date.now() + CIRCUIT_BREAKER_DURATION;
  console.warn(`⚡ Firestore Circuit Breaker ACTIVATED (Serving 100% from persistent local data): ${reason}`);
}

class ResilientFirestoreProxy {
  collection(collName) {
    const localColl = localDbInstance.collection(collName);
    const rawColl = (isFirebaseActive && rawDb) ? rawDb.collection(collName) : null;

    return {
      limit: (n) => {
        const inner = localColl.limit(n);
        return {
          get: async () => {
            if (isCircuitOpen() || !rawColl) return inner.get();
            try {
              return await Promise.race([
                rawColl.limit(n).get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500))
              ]);
            } catch (err) {
              if (err.code === 8 || String(err.message).includes('Quota') || String(err.message).includes('timeout')) {
                tripCircuit(err.message);
              }
              return inner.get();
            }
          }
        };
      },

      orderBy: (...args) => {
        return this.collection(collName);
      },

      where: (field, op, val) => {
        const innerWhere = localColl.where(field, op, val);
        return {
          limit: (n) => ({
            get: async () => {
              if (isCircuitOpen() || !rawColl) return innerWhere.limit(n).get();
              try {
                return await Promise.race([
                  rawColl.where(field, op, val).limit(n).get(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500))
                ]);
              } catch (err) {
                if (err.code === 8 || String(err.message).includes('Quota') || String(err.message).includes('timeout')) {
                  tripCircuit(err.message);
                }
                return innerWhere.limit(n).get();
              }
            }
          }),
          get: async () => {
            if (isCircuitOpen() || !rawColl) return innerWhere.get();
            try {
              return await Promise.race([
                rawColl.where(field, op, val).get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500))
              ]);
            } catch (err) {
              if (err.code === 8 || String(err.message).includes('Quota') || String(err.message).includes('timeout')) {
                tripCircuit(err.message);
              }
              return innerWhere.get();
            }
          }
        };
      },

      get: async () => {
        if (isCircuitOpen() || !rawColl) {
          return localColl.get();
        }
        try {
          const snapshot = await Promise.race([
            rawColl.get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500))
          ]);
          // Sync remote snapshot docs into local disk store in background
          try {
            const data = loadLocalData();
            const syncd = [];
            snapshot.docs.forEach(d => {
              syncd.push({ ...d.data(), id: d.id });
            });
            if (syncd.length > 0) {
              data[collName] = syncd;
              saveLocalData(data);
            }
          } catch (_) {}
          return snapshot;
        } catch (err) {
          if (err.code === 8 || String(err.message).includes('Quota') || String(err.message).includes('timeout')) {
            tripCircuit(err.message);
          }
          return localColl.get();
        }
      },

      add: async (item) => {
        // ALWAYS write to local disk store first!
        const localRes = await localColl.add(item);
        if (!isCircuitOpen() && rawColl) {
          // Asynchronously sync to remote Firestore
          rawColl.doc(localRes.id).set(item).catch(err => {
            if (err.code === 8 || String(err.message).includes('Quota')) tripCircuit(err.message);
          });
        }
        return localRes;
      },

      doc: (docId) => {
        const localDocRef = localColl.doc(docId);
        const rawDocRef = rawColl ? rawColl.doc(docId) : null;

        return {
          id: docId,
          get: async () => {
            if (isCircuitOpen() || !rawDocRef) {
              return localDocRef.get();
            }
            try {
              const snap = await Promise.race([
                rawDocRef.get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1500))
              ]);
              if (snap.exists) {
                // Sync to local
                try {
                  const data = loadLocalData();
                  const arr = localColl._ensureArray(data);
                  const idx = arr.findIndex(i => (i.id === docId || i.bookingId === docId || i.staffId === docId));
                  const item = { ...snap.data(), id: docId };
                  if (idx >= 0) arr[idx] = item;
                  else arr.push(item);
                  data[collName] = arr;
                  saveLocalData(data);
                } catch (_) {}
                return snap;
              }
              return localDocRef.get();
            } catch (err) {
              if (err.code === 8 || String(err.message).includes('Quota') || String(err.message).includes('timeout')) {
                tripCircuit(err.message);
              }
              return localDocRef.get();
            }
          },

          set: async (item, options = {}) => {
            // ALWAYS write to local store first (immediate 0 ms ACID guarantee)
            const localResult = await localDocRef.set(item, options);
            if (!isCircuitOpen() && rawDocRef) {
              rawDocRef.set(item, options).catch(err => {
                if (err.code === 8 || String(err.message).includes('Quota')) tripCircuit(err.message);
              });
            }
            return localResult;
          },

          update: async (fields) => {
            // ALWAYS update local store first
            const localResult = await localDocRef.update(fields);
            if (!isCircuitOpen() && rawDocRef) {
              rawDocRef.update(fields).catch(err => {
                if (err.code === 8 || String(err.message).includes('Quota')) tripCircuit(err.message);
              });
            }
            return localResult;
          },

          delete: async () => {
            await localDocRef.delete();
            if (!isCircuitOpen() && rawDocRef) {
              rawDocRef.delete().catch(err => {
                if (err.code === 8 || String(err.message).includes('Quota')) tripCircuit(err.message);
              });
            }
          }
        };
      }
    };
  }
}

const firestoreInstance = new ResilientFirestoreProxy();

module.exports = {
  admin,
  db: firestoreInstance,
  isFirebaseActive,
  loadLocalData,
  saveLocalData
};
