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

// 4. Update the modal overlays for ticketModal and receiptModal
// We only want to hide them when isAutoPrinting is true.
// The string might be `<div className="modal-overlay" onClick={() => setTicketModal(null)}>`
content = content.replace(
    /\{ticketModal && \(\s*<div className="modal-overlay" onClick=\{\(\) => setTicketModal\(null\)\}>/g,
    `{ticketModal && (\n        <div className="modal-overlay" onClick={() => !isAutoPrinting && setTicketModal(null)} style={{ opacity: isAutoPrinting ? 0 : 1, pointerEvents: isAutoPrinting ? 'none' : 'auto' }}>`
);

content = content.replace(
    /\{receiptModal && \(\s*<div className="modal-overlay" onClick=\{\(\) => setReceiptModal\(null\)\}>/g,
    `{receiptModal && (\n        <div className="modal-overlay" onClick={() => !isAutoPrinting && setReceiptModal(null)} style={{ opacity: isAutoPrinting ? 0 : 1, pointerEvents: isAutoPrinting ? 'none' : 'auto' }}>`
);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
console.log('App.jsx successfully patched for silent printing preview.');
