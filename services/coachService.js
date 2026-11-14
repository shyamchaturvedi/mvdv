const { db } = require('../config/firebase');

// Standard Indian Railways Rake Composition with facilities and platform placement
const DEFAULT_TRAIN_COACHES = [
  {
    id: 'coach-eng',
    coachCode: 'ENG',
    coachName: 'WAP-7 हाई-पावर इलेक्ट्रिक लोकोमोटिव (Engine)',
    coachClass: 'Special',
    detailedType: 'Locomotive Engine (इंजन)',
    position: 1,
    totalSeats: 0,
    fare: 0,
    status: 'Active',
    isBookable: false,
    platformPosition: 'इंजन साइड (Front Engine End)',
    facilities: ['6000 HP इलेक्ट्रिक ट्रैक्शन', 'सुरक्षा कैब', 'रेडियो संचार'],
    description: 'तीर्थ यात्रा स्पेशल ट्रेन का मुख्य शक्तिशाली इलेक्ट्रिक इंजन।'
  },
  {
    id: 'coach-slr1',
    coachCode: 'SLR1',
    coachName: 'एसएलआर बोगी 1 (Luggage & Divyang Rake)',
    coachClass: 'General',
    detailedType: 'SLR Luggage & Seating (सामान व दिव्यांग)',
    position: 2,
    totalSeats: 18,
    fare: 2000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'आगे की तरफ (Front End)',
    facilities: ['सामान कक्ष', 'दिव्यांग मित्रवत 18 आरक्षित सीटें', 'बायो-टॉयलेट'],
    description: 'सामान रैक, दिव्यांग श्रद्धालु आरक्षण (18 सीटें) एवं ब्रेक वैन।'
  },
  // 18 Sleeper Coaches (S1 to S18 - 72 seats each)
  ...Array.from({ length: 18 }, (_, idx) => {
    const num = idx + 1;
    const code = `S${num}`;
    return {
      id: `coach-s${num}`,
      coachCode: code,
      coachName: `स्लीपर कोच ${code} (Sleeper Class ${code})`,
      coachClass: 'Sleeper',
      detailedType: `Sleeper 3-Tier (शयनयान ${code})`,
      position: num + 2, // Positions 3 to 20
      totalSeats: 72,
      fare: 3000,
      status: 'Active',
      isBookable: true,
      platformPosition: num <= 6 ? 'अग्रिम भाग (Front Section)' : (num <= 12 ? 'मध्य भाग (Center Platform)' : 'पश्च भाग (Rear Section)'),
      facilities: ['72 शयन बर्थ (8-बे लेआउट)', 'चार्जिंग पॉइंट्स', 'बायो-वैक्यूम टॉयलेट', 'पानी की टंकी'],
      description: `स्लीपर क्लास कोच ${code} — 72 आरक्षित तीर्थ यात्रा बर्थ (लोअर, मिडिल, अपर, साइड-लोअर, साइड-अपर)।`
    };
  }),
  {
    id: 'coach-slr2',
    coachCode: 'SLR2',
    coachName: 'एसएलआर व गार्ड बोगी 2 (Guard Van & SLR)',
    coachClass: 'General',
    detailedType: 'SLR & Guard Van (गार्ड व दिव्यांग बोगी)',
    position: 21,
    totalSeats: 18,
    fare: 2000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'ट्रेन का अंतिम छोर (Rear Guard End)',
    facilities: ['गार्ड केबिन', 'आपातकालीन ब्रेक प्रणाली', 'दिव्यांग मित्रवत 18 सीटें'],
    description: 'ट्रेन का अंतिम कोच — गार्ड वैन एवं दिव्यांग श्रद्धालु आरक्षण (18 सीटें)।'
  }
];

function normalizeCoachClass(coachClass, coachCode = '') {
  const cls = String(coachClass || '').trim().toUpperCase();
  const code = String(coachCode || '').trim().toUpperCase();
  if (cls === 'AC' || cls === '3 AC' || cls === '2 AC' || cls === '1 AC' || cls === '3A' || cls === '2A' || cls === '1A' || cls === 'CC' || cls === 'EC') {
    return 'AC';
  }
  if (cls === 'SLEEPER' || cls === 'SL') {
    return 'Sleeper';
  }
  if (cls === 'GENERAL' || cls === '2S' || cls === 'GS' || cls === 'GUARD / SLR' || cls === 'SLR') {
    return 'General';
  }
  if (cls === 'SPECIAL' || cls === 'PANTRY' || cls === 'ENGINE' || cls === 'LOCO') {
    return 'Special';
  }
  if (code.startsWith('A') || code.startsWith('B') || code.startsWith('H')) return 'AC';
  if (code.startsWith('S') && !code.startsWith('SLR')) return 'Sleeper';
  if (code === 'ENG' || code === 'LOCO' || code === 'PC') return 'Special';
  return 'General';
}

function withCoachUiAliases(coach, extra = {}) {
  const pos = Number(coach.position ?? coach.positionSequence ?? 999);
  const seats = Number(coach.totalSeats ?? coach.capacity ?? 0);
  const baseFare = Number(coach.fare ?? coach.baseFare ?? 0);
  const placement = coach.platformPosition || coach.platformPlacement || 'ट्रेन में स्थान';
  const notes = coach.description ?? coach.notes ?? '';
  return {
    ...coach,
    position: pos,
    positionSequence: pos,
    totalSeats: seats,
    capacity: seats,
    fare: baseFare,
    baseFare,
    platformPosition: placement,
    platformPlacement: placement,
    description: notes,
    notes,
    ...extra
  };
}

let cachedCoachesList = null;
let lastCoachesFetchTime = 0;
let hasInitializedDefaultCoaches = false;
const COACHES_CACHE_TTL = 60 * 1000; // 60 seconds

class CoachService {
  static invalidateCache() {
    cachedCoachesList = null;
    lastCoachesFetchTime = 0;
  }

  // Initialize default coaches if collection is empty (run once per lifecycle)
  static async initDefaultCoaches() {
    if (hasInitializedDefaultCoaches) return;
    hasInitializedDefaultCoaches = true;
    try {
      const snap = await Promise.race([
        db.collection('trainCoaches').limit(1).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
      ]);
      if (snap.empty) {
        for (const coach of DEFAULT_TRAIN_COACHES) {
          await db.collection('trainCoaches').doc(coach.id).set({
            ...coach,
            updatedAt: new Date().toISOString()
          });
        }
        console.log('✅ Default Train Rake Composition (18 Coaches) initialized in database.');
      }
    } catch (e) {
      console.warn('⚠️ Coach initialization notice:', e.message);
    }
  }

  // Get all coaches ordered by sequence position (1 to N) with high-speed memory caching
  static async getAllCoaches() {
    const now = Date.now();
    if (cachedCoachesList && (now - lastCoachesFetchTime) < COACHES_CACHE_TTL) {
      return cachedCoachesList;
    }

    try {
      await this.initDefaultCoaches();
      const snap = await Promise.race([
        db.collection('trainCoaches').get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3500))
      ]);
      let list = [];
      snap.docs.forEach(doc => {
        list.push(withCoachUiAliases({ ...doc.data(), id: doc.id }));
      });

      if (list.length === 0) {
        list = DEFAULT_TRAIN_COACHES.map(c => withCoachUiAliases(c));
      }

      // Sort by position ascending
      list.sort((a, b) => Number(a.position || 999) - Number(b.position || 999));
      cachedCoachesList = list;
      lastCoachesFetchTime = now;
      return list;
    } catch (e) {
      console.warn('⚠️ Coach fetch fallback to default rake:', e.message);
      const fallbackList = cachedCoachesList && cachedCoachesList.length > 0
        ? cachedCoachesList
        : DEFAULT_TRAIN_COACHES.map(c => withCoachUiAliases(c));
      cachedCoachesList = fallbackList;
      lastCoachesFetchTime = now;
      return fallbackList;
    }
  }

  // Get active bookable coaches mapped by class
  static async getBookableCoachesMap() {
    const all = await this.getAllCoaches();
    const active = all.filter(c => c.status !== 'Inactive' && c.isBookable !== false && Number(c.totalSeats) > 0);

    const map = {
      AC: active.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'AC').map(c => c.coachCode),
      Sleeper: active.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'Sleeper').map(c => c.coachCode),
      General: active.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'General').map(c => c.coachCode)
    };

    // Only use default fallbacks when no coaches exist in database at all
    if (all.length === 0) {
      map.AC = [];
      map.Sleeper = Array.from({ length: 18 }, (_, i) => `S${i + 1}`);
      map.General = ['SLR1', 'SLR2'];
    }

    return map;
  }

  // Get full train rake with live occupancy stats for given year
  static async getTrainCompositionWithStats(yatraYear = 2026) {
    const coaches = await this.getAllCoaches();
    const bookingsSnap = await db.collection('bookings').get();

    const yearBookings = [];
    bookingsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.status !== 'Cancelled' && String(data.yatraYear) === String(yatraYear)) {
        yearBookings.push(data);
      }
    });

    // Compute booked seats/passengers per coach (case-insensitive coach code key)
    const coachStatsMap = {};
    yearBookings.forEach(b => {
      const cName = String(b.coachName || '').trim().toUpperCase();
      if (!cName) return;
      if (!coachStatsMap[cName]) coachStatsMap[cName] = { bookedCount: 0, passengerCount: 0 };

      const seats = Array.isArray(b.seatNumber) ? b.seatNumber : (b.seatNumber ? [b.seatNumber] : []);
      const paxLen = Number(b.numberOfPassengers) || (Array.isArray(b.passengers) ? b.passengers.length : seats.length);
      coachStatsMap[cName].bookedCount += Math.max(seats.length, paxLen);
      coachStatsMap[cName].passengerCount += paxLen;
    });

    let totalCapacity = 0;
    let totalBooked = 0;
    let totalBookableCoaches = 0;

    const enrichedCoaches = coaches.map(c => {
      const stats = coachStatsMap[String(c.coachCode || '').trim().toUpperCase()] || { bookedCount: 0, passengerCount: 0 };
      const capacity = Number(c.totalSeats || 0);
      const booked = stats.bookedCount;
      const available = Math.max(0, capacity - booked);
      const occupancyRate = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

      if (c.isBookable !== false && capacity > 0) {
        totalCapacity += capacity;
        totalBooked += booked;
        totalBookableCoaches += 1;
      }

      return withCoachUiAliases(c, {
        bookedBerths: booked,
        bookedPassengers: booked,
        availableBerths: available,
        occupancyRate,
        occupancyStatus: capacity === 0 ? 'N/A' : available === 0 ? 'Full' : occupancyRate > 80 ? 'Fast Filling' : 'Available'
      });
    });

    const acCoachesList = enrichedCoaches.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'AC');
    const sleeperCoachesList = enrichedCoaches.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'Sleeper');
    const generalCoachesList = enrichedCoaches.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'General');
    const specialCoachesList = enrichedCoaches.filter(c => normalizeCoachClass(c.coachClass, c.coachCode) === 'Special');

    return {
      trainName: 'श्री माता वैष्णो देवी वार्षिक तीर्थ यात्रा स्पेशल एक्सप्रेस',
      trainNumber: '04201 / 04202',
      yatraYear,
      totalCoachesCount: coaches.length,
      totalBookableCoaches,
      totalCapacity,
      totalBooked,
      totalAvailable: Math.max(0, totalCapacity - totalBooked),
      overallOccupancyRate: totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0,
      breakdownByClass: {
        AC: acCoachesList.length,
        Sleeper: sleeperCoachesList.length,
        General: generalCoachesList.length,
        Special: specialCoachesList.length
      },
      stats: {
        totalCoaches: coaches.length,
        bookableCoaches: totalBookableCoaches,
        sleeperCoaches: sleeperCoachesList.length,
        sleeperBerths: sleeperCoachesList.reduce((s, c) => s + Number(c.totalSeats || 0), 0),
        acCoaches: acCoachesList.length,
        acBerths: acCoachesList.reduce((s, c) => s + Number(c.totalSeats || 0), 0),
        generalCoaches: generalCoachesList.length,
        generalBerths: generalCoachesList.reduce((s, c) => s + Number(c.totalSeats || 0), 0),
        totalBooked,
        totalBerthCapacity: totalCapacity,
        totalAvailable: Math.max(0, totalCapacity - totalBooked)
      },
      coaches: enrichedCoaches
    };
  }

  // Add new Coach
  static async addCoach(payload) {
    if (!payload.coachCode || !payload.coachName) {
      throw new Error('कोच कोड (उदा. S7, B4) और कोच का नाम अनिवार्य है।');
    }

    const cleanCode = payload.coachCode.trim().toUpperCase();
    const all = await this.getAllCoaches();

    // Check duplicate code
    if (all.some(c => String(c.coachCode || '').toUpperCase() === cleanCode)) {
      throw new Error(`कोच कोड ${cleanCode} पहले से मौजूद है। कृपया कोई भिन्न कोड दर्ज करें।`);
    }

    const coachClass = payload.coachClass || 'Sleeper';
    const normClass = normalizeCoachClass(coachClass, cleanCode);
    const rawPos = payload.position ?? payload.positionSequence;
    const rawSeats = payload.totalSeats ?? payload.capacity;
    const rawFare = payload.fare ?? payload.baseFare;
    const nextPosition = rawPos !== undefined && rawPos !== '' ? Number(rawPos) : (all.length + 1);
    const defaultSeats = normClass === 'AC' ? 64 : normClass === 'General' ? 80 : normClass === 'Special' ? 0 : 72;
    const defaultFare = normClass === 'AC' ? 4000 : normClass === 'General' ? 2000 : normClass === 'Special' ? 0 : 3000;
    const newId = `coach-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;

    const newCoach = withCoachUiAliases({
      id: newId,
      coachCode: cleanCode,
      coachName: payload.coachName.trim(),
      coachClass,
      detailedType: payload.detailedType || (normClass === 'AC' ? `${coachClass} Air-Conditioned` : normClass === 'General' ? 'General Seating / SLR' : 'Sleeper Class'),
      position: nextPosition,
      totalSeats: rawSeats !== undefined && rawSeats !== '' ? Number(rawSeats) : defaultSeats,
      fare: rawFare !== undefined && rawFare !== '' ? Number(rawFare) : defaultFare,
      status: payload.status || 'Active',
      isBookable: payload.isBookable !== undefined ? Boolean(payload.isBookable) : true,
      platformPosition: payload.platformPosition || payload.platformPlacement || 'ट्रेन में स्थान',
      facilities: Array.isArray(payload.facilities) ? payload.facilities : (payload.facilities ? String(payload.facilities).split(',').map(s => s.trim()).filter(Boolean) : ['चार्जिंग सॉकेट', 'बायो-टॉयलेट']),
      description: payload.description !== undefined ? payload.description : (payload.notes !== undefined ? payload.notes : `${cleanCode} ट्रेन बोगी।`),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.collection('trainCoaches').doc(newId).set(newCoach);
    this.invalidateCache();
    return newCoach;
  }

  // Update existing Coach (with coachCode cascade across bookings & TTE assignments)
  static async updateCoach(id, payload) {
    const docRef = db.collection('trainCoaches').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('कोच नहीं मिला।');
    }

    const existing = doc.data();
    const oldCode = String(existing.coachCode || '').trim().toUpperCase();
    const oldDisplayName = String(existing.coachName || '').trim();
    const newCode = payload.coachCode !== undefined && String(payload.coachCode).trim()
      ? String(payload.coachCode).trim().toUpperCase()
      : oldCode;

    if (newCode !== oldCode) {
      const all = await this.getAllCoaches();
      if (all.some(c => c.id !== id && String(c.coachCode || '').toUpperCase() === newCode)) {
        throw new Error(`कोच कोड ${newCode} पहले से किसी अन्य बोगी को आवंटित है।`);
      }
    }

    const updates = {};
    if (payload.coachName !== undefined && String(payload.coachName).trim()) {
      updates.coachName = String(payload.coachName).trim();
    }
    const newDisplayName = updates.coachName !== undefined ? updates.coachName : oldDisplayName;
    if (newCode) {
      updates.coachCode = newCode;
    }
    if (payload.coachClass !== undefined) updates.coachClass = payload.coachClass;
    if (payload.detailedType !== undefined) updates.detailedType = payload.detailedType;
    const rawPos = payload.position !== undefined ? payload.position : payload.positionSequence;
    if (rawPos !== undefined && rawPos !== '') updates.position = Number(rawPos);
    const rawSeats = payload.totalSeats !== undefined ? payload.totalSeats : payload.capacity;
    if (rawSeats !== undefined && rawSeats !== '') updates.totalSeats = Number(rawSeats);
    const rawFare = payload.fare !== undefined ? payload.fare : payload.baseFare;
    if (rawFare !== undefined && rawFare !== '') updates.fare = Number(rawFare);
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.isBookable !== undefined) updates.isBookable = Boolean(payload.isBookable);
    const rawPlacement = payload.platformPosition !== undefined ? payload.platformPosition : payload.platformPlacement;
    if (rawPlacement !== undefined) updates.platformPosition = rawPlacement;
    if (payload.facilities !== undefined) {
      updates.facilities = Array.isArray(payload.facilities)
        ? payload.facilities
        : String(payload.facilities).split(',').map(s => s.trim()).filter(Boolean);
    }
    const rawDesc = payload.description !== undefined ? payload.description : payload.notes;
    if (rawDesc !== undefined) updates.description = rawDesc;
    updates.updatedAt = new Date().toISOString();

    await docRef.set(updates, { merge: true });

    // Cascade coachCode and/or bogie display name updates onto existing bookings and staff assignments
    const codeChanged = Boolean(oldCode && newCode && oldCode !== newCode);
    const nameChanged = Boolean(newDisplayName && oldDisplayName !== newDisplayName);
    let bookingsUpdated = 0;
    let staffUpdated = 0;
    if (codeChanged || nameChanged) {
      try {
        const nowIso = new Date().toISOString();
        const bookingsSnap = await db.collection('bookings').get();
        for (const bDoc of bookingsSnap.docs) {
          const b = bDoc.data();
          const bCoach = String(b.coachName || '').trim().toUpperCase();
          const origCoach = String(b.cancellationDetails?.originalCoach || '').trim().toUpperCase();
          if (bCoach === oldCode || (origCoach && origCoach === oldCode)) {
            const bookingPatch = {
              updatedAt: nowIso
            };
            if (bCoach === oldCode) {
              bookingPatch.coachName = newCode;
              if (newDisplayName) bookingPatch.coachDisplayName = newDisplayName;
            }
            if (b.cancellationDetails && origCoach === oldCode) {
              bookingPatch.cancellationDetails = {
                ...b.cancellationDetails,
                originalCoach: newCode,
                ...(newDisplayName ? { originalCoachDisplayName: newDisplayName } : {})
              };
            }
            await db.collection('bookings').doc(bDoc.id).set(bookingPatch, { merge: true });
            bookingsUpdated++;
          }
        }

        if (codeChanged) {
          const staffSnap = await db.collection('staffMembers').get();
          for (const sDoc of staffSnap.docs) {
            const st = sDoc.data();
            let changed = false;
            const staffUpdates = {};
            if (Array.isArray(st.assignedCoaches) && st.assignedCoaches.some(c => String(c).trim().toUpperCase() === oldCode)) {
              staffUpdates.assignedCoaches = st.assignedCoaches.map(c => String(c).trim().toUpperCase() === oldCode ? newCode : c);
              changed = true;
            }
            if (typeof st.assignedCoach === 'string' && st.assignedCoach.split(',').some(c => c.trim().toUpperCase() === oldCode)) {
              staffUpdates.assignedCoach = st.assignedCoach.split(',').map(c => c.trim().toUpperCase() === oldCode ? newCode : c.trim()).join(', ');
              changed = true;
            }
            if (changed) {
              staffUpdates.updatedAt = nowIso;
              await db.collection('staffMembers').doc(sDoc.id).set(staffUpdates, { merge: true });
              staffUpdated++;
            }
          }
        }
      } catch (cascadeErr) {
        console.warn('Coach rename cascade warning:', cascadeErr.message);
      }
    }

    this.invalidateCache();
    const updated = await docRef.get();
    return withCoachUiAliases({ ...updated.data(), id: updated.id }, {
      previousCoachCode: oldCode,
      previousCoachName: oldDisplayName,
      codeChanged,
      nameChanged,
      bookingsUpdated,
      staffUpdated
    });
  }

  // Delete Coach
  static async deleteCoach(id) {
    const docRef = db.collection('trainCoaches').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('कोच नहीं मिला।');
    }
    await docRef.delete();
    this.invalidateCache();
    return { success: true, message: 'कोच हटा दिया गया।' };
  }

  // Bulk Reorder Coaches Position
  static async reorderCoaches(orderedIds) {
    if (!Array.isArray(orderedIds)) {
      throw new Error('अमान्य कोच क्रम सूची।');
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      await db.collection('trainCoaches').doc(id).set({
        position: i + 1,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    this.invalidateCache();
    return { success: true, message: 'कोच स्थिति क्रम सफलतापूर्वक सहेजा गया।' };
  }

  // Reset to default standard train rake
  static async resetDefaultRake() {
    const snap = await db.collection('trainCoaches').get();
    for (const doc of snap.docs) {
      await db.collection('trainCoaches').doc(doc.id).delete();
    }
    for (const coach of DEFAULT_TRAIN_COACHES) {
      await db.collection('trainCoaches').doc(coach.id).set({
        ...coach,
        updatedAt: new Date().toISOString()
      });
    }
    try {
      const defaultMap = {};
      DEFAULT_TRAIN_COACHES.forEach(c => {
        defaultMap[String(c.coachCode || '').toUpperCase()] = c.coachName || '';
      });
      const bookingsSnap = await db.collection('bookings').get();
      const nowIso = new Date().toISOString();
      for (const bDoc of bookingsSnap.docs) {
        const b = bDoc.data();
        const code = String(b.coachName || '').trim().toUpperCase();
        if (code && defaultMap[code] && b.coachDisplayName !== defaultMap[code]) {
          await db.collection('bookings').doc(bDoc.id).set({
            coachDisplayName: defaultMap[code],
            updatedAt: nowIso
          }, { merge: true });
        }
      }
    } catch (e) {}
    this.invalidateCache();
    return { success: true, message: 'डिफ़ॉल्ट ट्रेन रेक संरचना सफलतापूर्वक रीसेट की गई।' };
  }
}

module.exports = {
  CoachService,
  DEFAULT_TRAIN_COACHES
};
