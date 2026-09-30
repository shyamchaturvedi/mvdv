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
    totalSeats: 20,
    fare: 2000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'आगे की तरफ (Front End)',
    facilities: ['सामान कक्ष', 'दिव्यांग मित्रवत रैंप व बर्थ', 'बायो-टॉयलेट'],
    description: 'सामान रैक, दिव्यांग श्रद्धालु आरक्षण एवं ब्रेक वैन।'
  },
  {
    id: 'coach-gs1',
    coachCode: 'GS1',
    coachName: 'सामान्य अनारक्षित जीएस 1 (General GS1)',
    coachClass: 'General',
    detailedType: 'General Unreserved (सामान्य द्वितीय श्रेणी)',
    position: 3,
    totalSeats: 80,
    fare: 2000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'आगे की तरफ (Front End)',
    facilities: ['गद्देदार बैठक सीटें', 'पंखा व चार्जिंग सॉकेट', 'बायो-टॉयलेट'],
    description: 'सामान्य अनारक्षित कोच 1 — रियायती यात्रा श्रेणी।'
  },
  {
    id: 'coach-s1',
    coachCode: 'S1',
    coachName: 'स्लीपर कोच S1 (Sleeper Class S1)',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (शयनयान S1)',
    position: 4,
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'मध्य-अग्रिम (Front-Middle)',
    facilities: ['72 शयन बर्थ (8-बे लेआउट)', 'चार्जिंग पॉइंट्स', 'बायो-वैक्यूम टॉयलेट', 'पानी की टंकी'],
    description: 'स्लीपर क्लास कोच S1 — लोअर, मिडिल, अपर, साइड-लोअर व साइड-अपर बर्थ।'
  },
  {
    id: 'coach-s2',
    coachCode: 'S2',
    coachName: 'स्लीपर कोच S2 (Sleeper Class S2)',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (शयनयान S2)',
    position: 5,
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'मध्य-अग्रिम (Front-Middle)',
    facilities: ['72 शयन बर्थ', 'चार्जिंग पॉइंट्स', 'बायो-वैक्यूम टॉयलेट'],
    description: 'स्लीपर क्लास कोच S2 — आरक्षित तीर्थ यात्रा कोच।'
  },
  {
    id: 'coach-s3',
    coachCode: 'S3',
    coachName: 'स्लीपर कोच S3 (Sleeper Class S3)',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (शयनयान S3)',
    position: 6,
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'ट्रेन का मध्य भाग (Center Platform)',
    facilities: ['72 शयन बर्थ', 'चार्जिंग पॉइंट्स', 'बायो-टॉयलेट'],
    description: 'स्लीपर क्लास कोच S3 — मुख्य पारिवारिक आरक्षण कोच।'
  },
  {
    id: 'coach-s4',
    coachCode: 'S4',
    coachName: 'स्लीपर कोच S4 (Sleeper Class S4)',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (शयनयान S4)',
    position: 7,
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'ट्रेन का मध्य भाग (Center Platform)',
    facilities: ['72 शयन बर्थ', 'चार्जिंग पॉइंट्स', 'बायो-टॉयलेट'],
    description: 'स्लीपर क्लास कोच S4 — मुख्य ग्रुप एवं मंडल आरक्षण कोच।'
  },
  {
    id: 'coach-s5',
    coachCode: 'S5',
    coachName: 'स्लीपर कोच S5 (Sleeper Class S5)',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (शयनयान S5)',
    position: 8,
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'ट्रेन का मध्य भाग (Center Platform)',
    facilities: ['72 शयन बर्थ', 'चार्जिंग पॉइंट्स', 'बायो-टॉयलेट'],
    description: 'स्लीपर क्लास कोच S5 — आरामदायक शयनयान।'
  },
  {
    id: 'coach-s6',
    coachCode: 'S6',
    coachName: 'स्लीपर कोच S6 (Sleeper Class S6)',
    coachClass: 'Sleeper',
    detailedType: 'Sleeper 3-Tier (शयनयान S6)',
    position: 9,
    totalSeats: 72,
    fare: 3000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'मध्य-पश्च (Center-Rear)',
    facilities: ['72 शयन बर्थ', 'चार्जिंग पॉइंट्स', 'बायो-टॉयलेट'],
    description: 'स्लीपर क्लास कोच S6 — अंतिम स्लीपर बोगी।'
  },
  {
    id: 'coach-pc',
    coachCode: 'PC',
    coachName: 'पेंट्री कार व शुद्ध सात्विक रसोई (Pantry Car)',
    coachClass: 'Special',
    detailedType: 'Pantry Car / Catering (सात्विक रसोई)',
    position: 10,
    totalSeats: 0,
    fare: 0,
    status: 'Active',
    isBookable: false,
    platformPosition: 'ट्रेन का मध्य भाग (Center Platform)',
    facilities: ['शुद्ध सात्विक लंगर रसोई', 'RO शीतल जल', 'चाय/कॉफी व फलाहार व्यवस्था'],
    description: 'ट्रस्ट द्वारा संचालित संपूर्ण निशुल्क सात्विक भोजन व जल सेवा।'
  },
  {
    id: 'coach-b1',
    coachCode: 'B1',
    coachName: 'थर्ड एसी कोच B1 (AC 3-Tier B1)',
    coachClass: 'AC',
    detailedType: 'AC 3-Tier (तृतीय वातानुकूलित B1)',
    position: 11,
    totalSeats: 64,
    fare: 4000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'मध्य-पश्च (Center-Rear)',
    facilities: ['वातानुकूलित (AC)', 'चादर व कंबल किट', 'चार्जिंग पॉइंट्स', 'रीडिंग लाइट्स'],
    description: 'थर्ड एसी B1 — आरामदायक पूर्ण वातानुकूलित कोच।'
  },
  {
    id: 'coach-b2',
    coachCode: 'B2',
    coachName: 'थर्ड एसी कोच B2 (AC 3-Tier B2)',
    coachClass: 'AC',
    detailedType: 'AC 3-Tier (तृतीय वातानुकूलित B2)',
    position: 12,
    totalSeats: 64,
    fare: 4000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'मध्य-पश्च (Center-Rear)',
    facilities: ['वातानुकूलित (AC)', 'चादर व कंबल किट', 'चार्जिंग पॉइंट्स', 'रीडिंग लाइट्स'],
    description: 'थर्ड एसी B2 — पूर्ण वातानुकूलित आरामदायक यात्रा।'
  },
  {
    id: 'coach-b3',
    coachCode: 'B3',
    coachName: 'थर्ड एसी कोच B3 (AC 3-Tier B3)',
    coachClass: 'AC',
    detailedType: 'AC 3-Tier (तृतीय वातानुकूलित B3)',
    position: 13,
    totalSeats: 64,
    fare: 4000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'पीछे की तरफ (Rear Section)',
    facilities: ['वातानुकूलित (AC)', 'चादर व कंबल किट', 'चार्जिंग पॉइंट्स', 'रीडिंग लाइट्स'],
    description: 'थर्ड एसी B3 — तृतीय वातानुकूलित कोच।'
  },
  {
    id: 'coach-a1',
    coachCode: 'A1',
    coachName: 'सेकंड एसी कोच A1 (AC 2-Tier A1)',
    coachClass: 'AC',
    detailedType: 'AC 2-Tier (द्वितीय वातानुकूलित A1)',
    position: 14,
    totalSeats: 54,
    fare: 4000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'पीछे की तरफ (Rear Section)',
    facilities: ['2-टियर विस्तृत एसी बर्थ', 'पर्दे व प्राइवेसी', 'लक्जरी बेडरोल', 'व्यक्तिगत रीडिंग लैंप'],
    description: 'सेकंड एसी A1 — विशाल, शांत व प्रीमियम वातानुकूलित कोच।'
  },
  {
    id: 'coach-a2',
    coachCode: 'A2',
    coachName: 'सेकंड एसी कोच A2 (AC 2-Tier A2)',
    coachClass: 'AC',
    detailedType: 'AC 2-Tier (द्वितीय वातानुकूलित A2)',
    position: 15,
    totalSeats: 54,
    fare: 4000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'पीछे की तरफ (Rear Section)',
    facilities: ['2-टियर विस्तृत एसी बर्थ', 'पर्दे व प्राइवेसी', 'लक्जरी बेडरोल'],
    description: 'सेकंड एसी A2 — प्रीमियम 2-टियर वातानुकूलित कोच।'
  },
  {
    id: 'coach-a3',
    coachCode: 'A3',
    coachName: 'सेकंड एसी कोच A3 (AC 2-Tier A3)',
    coachClass: 'AC',
    detailedType: 'AC 2-Tier (द्वितीय वातानुकूलित A3)',
    position: 16,
    totalSeats: 54,
    fare: 4000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'पीछे की तरफ (Rear Section)',
    facilities: ['2-टियर विस्तृत एसी बर्थ', 'पर्दे व प्राइवेसी', 'लक्जरी बेडरोल'],
    description: 'सेकंड एसी A3 — द्वितीय वातानुकूलित कोच।'
  },
  {
    id: 'coach-gs2',
    coachCode: 'GS2',
    coachName: 'सामान्य अनारक्षित जीएस 2 (General GS2)',
    coachClass: 'General',
    detailedType: 'General Unreserved (सामान्य द्वितीय श्रेणी)',
    position: 17,
    totalSeats: 80,
    fare: 2000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'पीछे की तरफ (Rear End)',
    facilities: ['गद्देदार बैठक सीटें', 'पंखा व चार्जिंग सॉकेट', 'बायो-टॉयलेट'],
    description: 'सामान्य अनारक्षित कोच 2।'
  },
  {
    id: 'coach-slr2',
    coachCode: 'SLR2',
    coachName: 'एसएलआर व गार्ड बोगी 2 (Guard Van & SLR)',
    coachClass: 'General',
    detailedType: 'SLR & Guard Van (गार्ड व दिव्यांग बोगी)',
    position: 18,
    totalSeats: 20,
    fare: 2000,
    status: 'Active',
    isBookable: true,
    platformPosition: 'ट्रेन का अंतिम छोर (Rear Guard End)',
    facilities: ['गार्ड केबिन', 'आपातकालीन ब्रेक प्रणाली', 'दिव्यांग मित्रवत बर्थ'],
    description: 'ट्रेन का अंतिम कोच — गार्ड वैन एवं दिव्यांग श्रद्धालु आरक्षण।'
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
    if (!map.AC.length) map.AC = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
    if (!map.Sleeper.length) map.Sleeper = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    if (!map.General.length) map.General = ['GS1', 'GS2', 'SLR1', 'SLR2'];

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
