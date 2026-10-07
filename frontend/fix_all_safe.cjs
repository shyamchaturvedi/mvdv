const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

// 1. Add isAutoPrinting state
if (!content.includes('isAutoPrinting')) {
    content = content.replace(
        /const \[isSubmitting, setIsSubmitting\] = useState\(false\);/,
        `const [isSubmitting, setIsSubmitting] = useState(false);\n  const [isAutoPrinting, setIsAutoPrinting] = useState(false);`
    );
}

// 2. Modify printCombinedSlipElements
content = content.replace(
    /const printCombinedSlipElements = \(elementId1, elementId2, docTitle = 'MVD Document'\) => \{/,
    `const printCombinedSlipElements = (elementId1, elementId2, docTitle = 'MVD Document', onComplete = null) => {`
);

content = content.replace(
    /printWindow\.print\(\);\s*printWindow\.close\(\);\s*\}, 800\);/g,
    `printWindow.print();\n      printWindow.close();\n      if (onComplete) onComplete();\n    }, 800);`
);

// 3. Update handleBookingSubmit
content = content.replace(
    /\/\/ Fast counter workflow: immediately trigger print dialog combining both\s*setTimeout\(\(\) => \{\s*printCombinedSlipElements\('irctc-ticket-print-area', 'mandir-receipt-print-area', `MVD-Booking-Receipt-\$\{data\.booking\.bookingId\}`\);\s*\}, 150\);/,
    `setIsAutoPrinting(true);\n        // Fast counter workflow: immediately trigger print dialog combining both\n        setTimeout(() => {\n          printCombinedSlipElements('irctc-ticket-print-area', 'mandir-receipt-print-area', \`MVD-Booking-Receipt-\${data.booking.bookingId}\`, () => {\n            setIsAutoPrinting(false);\n            setTicketModal(null);\n            setReceiptModal(null);\n          });\n        }, 150);`
);

// 4. Update the modal overlays safely
content = content.replace(
    /\{ticketModal && \(\s*<div className="modal-overlay" onClick=\{\(\) => setTicketModal\(null\)\}>/g,
    `{ticketModal && (\n        <div className="modal-overlay" onClick={() => !isAutoPrinting && setTicketModal(null)} style={{ opacity: isAutoPrinting ? 0 : 1, pointerEvents: isAutoPrinting ? 'none' : 'auto' }}>`
);

content = content.replace(
    /\{receiptModal && \(\s*<div className="modal-overlay" onClick=\{\(\) => setReceiptModal\(null\)\}>/g,
    `{receiptModal && (\n        <div className="modal-overlay" onClick={() => !isAutoPrinting && setReceiptModal(null)} style={{ opacity: isAutoPrinting ? 0 : 1, pointerEvents: isAutoPrinting ? 'none' : 'auto' }}>`
);

// 5. Safely replace ticketModal Buttons
let ticketButtonOld = `<Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> पर्ची प्रिंट करें (A4 Print)
              </button>
              <a 
                href={\`/api/bookings/\${ticketModal.bookingId}/pdf?token=\${safeStaffToken}\`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline btn-sm" 
                style={{ flex: 1, borderColor: '#0284C7', color: '#0284C7' }}
              >
                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF डाउनलोड
              </a>`;

let ticketButtonNew = `<Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> टिकट प्रिंट / Save PDF
              </button>`;
if (content.includes('पर्ची प्रिंट करें (A4 Print)')) {
    content = content.replace(ticketButtonOld, ticketButtonNew);
} else {
    console.log("Ticket button old not found");
}

// 6. Safely replace receiptModal Buttons
let receiptButtonOld = `<Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> रसीद प्रिंट करें (A4-Half Print)
              </button>
              <a 
                href={\`/api/bookings/\${receiptModal.booking.bookingId}/receipt/\${receiptModal.txn.id}\`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline btn-sm" 
                style={{ flex: 1 }}
              >
                <FileText size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> PDF डाउनलोड
              </a>`;

let receiptButtonNew = `<Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> रसीद प्रिंट / Save PDF
              </button>`;

if (content.includes('रसीद प्रिंट करें (A4-Half Print)')) {
    content = content.replace(receiptButtonOld, receiptButtonNew);
} else {
    console.log("Receipt button old not found");
}

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
console.log('App.jsx successfully patched with safe replaces.');
