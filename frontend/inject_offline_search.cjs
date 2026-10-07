const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const oldFilterStr = `{adminBookings
                              .filter(b => !adminSearch || 
                                b.bookingId.toLowerCase().includes(adminSearch.toLowerCase()) ||
                                b.bookedBy.toLowerCase().includes(adminSearch.toLowerCase()) ||
                                (b.mobile && b.mobile.includes(adminSearch))
                              )`;

const newFilterStr = `{adminBookings
                              .filter(b => !adminSearch || 
                                b.bookingId.toLowerCase().includes(adminSearch.toLowerCase()) ||
                                b.bookedBy.toLowerCase().includes(adminSearch.toLowerCase()) ||
                                (b.mobile && b.mobile.includes(adminSearch)) ||
                                (b.offlineReceiptNo && b.offlineReceiptNo.toLowerCase().includes(adminSearch.toLowerCase()))
                              )`;

content = content.replace(oldFilterStr, newFilterStr);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('App.jsx search modified successfully');
