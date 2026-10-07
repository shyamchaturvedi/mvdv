const { db, isFirebaseActive, loadLocalData, saveLocalData } = require('./config/firebase');

async function resetDatabase() {
  if (isFirebaseActive) {
    console.log("Resetting Firebase collections...");
    const collections = ['bookings', 'counters', 'audit', 'payments', 'defaulters', 'auditLogs', 'cashAdjustments'];
    for (const coll of collections) {
      try {
        const snapshot = await db.collection(coll).get();
        if (snapshot.size === 0) continue;
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleared Firebase collection: ${coll}`);
      } catch (err) {
        console.error(`Error clearing ${coll}:`, err.message);
      }
    }
  } else {
    console.log("Resetting Local JSON Database...");
    const data = loadLocalData();
    data.bookings = [];
    data.auditLogs = [];
    data.defaulters = [];
    data.payments = [];
    data.cashAdjustments = [];
    
    // We will preserve staffMembers and trainCoaches to keep the app working
    saveLocalData(data);
    console.log("Cleared Local Database successfully.");
  }
}

resetDatabase().then(() => {
  console.log("Database reset complete.");
  process.exit(0);
});
