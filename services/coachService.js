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

class CoachService {
  // Initialize default coaches if collection is empty
  static async initDefaultCoaches() {
    try {
      const snap = await db.collection('trainCoaches').get();
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

  // Get all coaches ordered by sequence position (1 to N)
  static async getAllCoaches() {
    await this.initDefaultCoaches();
    const snap = await db.collection('trainCoaches').get();
    let list = [];
    snap.docs.forEach(doc => {
      list.push({ ...doc.data(), id: doc.id });
    });

    if (list.length === 0) {
      list = [...DEFAULT_TRAIN_COACHES];
    }

    // Sort by position ascending
    list.sort((a, b) => Number(a.position || 999) - Number(b.position || 999));
    return list;
  }

  // Get active bookable coaches mapped by class
  static async getBookableCoachesMap() {
    const all = await this.getAllCoaches();
    const active = all.filter(c => c.status === 'Active' && c.isBookable !== false);

    const map = {
      AC: active.filter(c => c.coachClass === 'AC').map(c => c.coachCode),
      Sleeper: active.filter(c => c.coachClass === 'Sleeper').map(c => c.coachCode),
      General: active.filter(c => c.coachClass === 'General').map(c => c.coachCode)
    };

    // Ensure fallback if empty
    if (!map.AC.length) map.AC = [];
    if (!map.Sleeper.length) map.Sleeper = Array.from({ length: 18 }, (_, i) => `S${i + 1}`);
    if (!map.General.length) map.General = ['SLR1', 'SLR2'];

    return map;
  }

  // Get full train rake with live occupancy stats for given year
  static async getTrainCompositionWithStats(yatraYear = 2026) {
    const coaches = await this.getAllCoaches();
    const bookingsSnap = await db.collection('bookings').get();
    
    const yearBookings = [];
    bookingsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (String(data.yatraYear) === String(yatraYear)) {
        yearBookings.push(data);
      }
    });

    // Compute booked seats per coach
    const coachStatsMap = {};
    yearBookings.forEach(b => {
      const cName = b.coachName;
      if (!coachStatsMap[cName]) coachStatsMap[cName] = { bookedCount: 0, passengerCount: 0 };
      
      const seats = Array.isArray(b.seatNumber) ? b.seatNumber : (b.seatNumber ? [b.seatNumber] : []);
      coachStatsMap[cName].bookedCount += seats.length;
      coachStatsMap[cName].passengerCount += (b.passengers ? b.passengers.length : seats.length);
    });

    let totalCapacity = 0;
    let totalBooked = 0;
    let totalBookableCoaches = 0;

    const enrichedCoaches = coaches.map(c => {
      const stats = coachStatsMap[c.coachCode] || { bookedCount: 0, passengerCount: 0 };
      const capacity = Number(c.totalSeats || 0);
      const booked = stats.bookedCount;
      const available = Math.max(0, capacity - booked);
      const occupancyRate = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

      if (c.isBookable !== false && capacity > 0) {
        totalCapacity += capacity;
        totalBooked += booked;
        totalBookableCoaches += 1;
      }

      return {
        ...c,
        bookedBerths: booked,
        availableBerths: available,
        occupancyRate,
        occupancyStatus: capacity === 0 ? 'N/A' : available === 0 ? 'Full' : occupancyRate > 80 ? 'Fast Filling' : 'Available'
      };
    });

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
        AC: enrichedCoaches.filter(c => c.coachClass === 'AC').length,
        Sleeper: enrichedCoaches.filter(c => c.coachClass === 'Sleeper').length,
        General: enrichedCoaches.filter(c => c.coachClass === 'General').length,
        Special: enrichedCoaches.filter(c => c.coachClass === 'Special').length
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
    if (all.some(c => c.coachCode === cleanCode)) {
      throw new Error(`कोच कोड ${cleanCode} पहले से मौजूद है। कृपया कोई भिन्न कोड दर्ज करें।`);
    }

    const nextPosition = payload.position ? Number(payload.position) : (all.length + 1);
    const newId = `coach-${cleanCode.toLowerCase()}-${Date.now()}`;

    const newCoach = {
      id: newId,
      coachCode: cleanCode,
      coachName: payload.coachName.trim(),
      coachClass: payload.coachClass || 'Sleeper',
      detailedType: payload.detailedType || (payload.coachClass === 'AC' ? 'AC 3-Tier' : payload.coachClass === 'General' ? 'General Seating' : 'Sleeper Class'),
      position: nextPosition,
      totalSeats: Number(payload.totalSeats || (payload.coachClass === 'AC' ? 64 : payload.coachClass === 'General' ? 80 : 72)),
      fare: Number(payload.fare || (payload.coachClass === 'AC' ? 4000 : payload.coachClass === 'General' ? 2000 : 3000)),
      status: payload.status || 'Active',
      isBookable: payload.isBookable !== undefined ? payload.isBookable : true,
      platformPosition: payload.platformPosition || 'ट्रेन में स्थान',
      facilities: Array.isArray(payload.facilities) ? payload.facilities : (payload.facilities ? String(payload.facilities).split(',').map(s => s.trim()) : ['चार्जिंग सॉकेट', 'बायो-टॉयलेट']),
      description: payload.description || `${cleanCode} ट्रेन बोगी।`,
      createdAt: new Date().toISOString()
    };

    await db.collection('trainCoaches').doc(newId).set(newCoach);
    return newCoach;
  }

  // Update existing Coach
  static async updateCoach(id, payload) {
    const docRef = db.collection('trainCoaches').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('कोच नहीं मिला।');
    }

    const updates = {};
    if (payload.coachName) updates.coachName = payload.coachName.trim();
    if (payload.coachCode) updates.coachCode = payload.coachCode.trim().toUpperCase();
    if (payload.coachClass) updates.coachClass = payload.coachClass;
    if (payload.detailedType) updates.detailedType = payload.detailedType;
    if (payload.position !== undefined) updates.position = Number(payload.position);
    if (payload.totalSeats !== undefined) updates.totalSeats = Number(payload.totalSeats);
    if (payload.fare !== undefined) updates.fare = Number(payload.fare);
    if (payload.status) updates.status = payload.status;
    if (payload.isBookable !== undefined) updates.isBookable = payload.isBookable;
    if (payload.platformPosition) updates.platformPosition = payload.platformPosition;
    if (payload.facilities) {
      updates.facilities = Array.isArray(payload.facilities) ? payload.facilities : String(payload.facilities).split(',').map(s => s.trim());
    }
    if (payload.description) updates.description = payload.description;
    updates.updatedAt = new Date().toISOString();

    await docRef.set(updates, { merge: true });
    const updated = await docRef.get();
    return { ...updated.data(), id: updated.id };
  }

  // Delete Coach
  static async deleteCoach(id) {
    const docRef = db.collection('trainCoaches').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('कोच नहीं मिला।');
    }
    await docRef.delete();
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
    return { success: true, message: 'ट्रेन की मानक 18-बोगी संरचना रीसेट कर दी गई।' };
  }
}

module.exports = {
  CoachService,
  DEFAULT_TRAIN_COACHES
};
