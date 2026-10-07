const fs = require('fs');
const file = 'c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/services/bookingService.js';
let content = fs.readFileSync(file, 'utf8');

// Add audit log helper
if (!content.includes('static async logAudit')) {
  content = content.replace(/class BookingService {/, `class BookingService {\n  static async logAudit(action, performedBy, details, targetId) {\n    try {\n      await db.collection('auditLogs').add({\n        logId: 'AUD-' + Date.now() + '-' + Math.floor(Math.random()*1000),\n        timestamp: new Date().toISOString(),\n        action,\n        performedBy,\n        details,\n        targetId\n      });\n    } catch (e) { console.error('Audit Log Error:', e); }\n  }`);
}

// Update updateBooking
content = content.replace(/static async updateBooking\(bookingId, updates\) \{/g, `static async updateBooking(bookingId, updates, adminName = 'System') {`);
content = content.replace(/await db\.collection\('bookings'\)\.doc\(existing\.bookingId\)\.set\(updatedData\);/, `await db.collection('bookings').doc(existing.bookingId).set(updatedData);\n    await this.logAudit('BOOKING_EDIT', adminName, \`Booking \${bookingId} was edited.\`, bookingId);`);

// Update deleteBooking
content = content.replace(/static async deleteBooking\(bookingId\) \{/g, `static async deleteBooking(bookingId, adminName = 'System') {`);
content = content.replace(/await db\.collection\('bookings'\)\.doc\(bookingId\)\.delete\(\);/, `await db.collection('bookings').doc(bookingId).delete();\n    await this.logAudit('BOOKING_DELETE', adminName, \`Booking \${bookingId} was deleted.\`, bookingId);`);

// Update cancelBookingWithRefund
content = content.replace(/static async cancelBookingWithRefund\(bookingId, cancellationData = \{\}\) \{/g, `static async cancelBookingWithRefund(bookingId, cancellationData = {}, adminName = 'System') {`);
content = content.replace(/await db\.collection\('bookings'\)\.doc\(booking\.bookingId\)\.set\(updatedData\);/, `await db.collection('bookings').doc(booking.bookingId).set(updatedData);\n    await this.logAudit('BOOKING_CANCEL', adminName, \`Booking \${bookingId} cancelled. Refund: \${refundAmount}\`, bookingId);`);

fs.writeFileSync(file, content);
console.log('bookingService.js updated with Audit Logs.');
