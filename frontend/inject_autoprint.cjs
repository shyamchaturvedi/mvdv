const fs = require('fs');

function injectAutoPrintHandlers() {
    let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

    // 1. Add handleAutoPrintTicket and handleAutoPrintReceipt
    if (!content.includes('const handleAutoPrintTicket')) {
        content = content.replace(
            /const \[isAutoPrinting, setIsAutoPrinting\] = useState\(false\);/,
            `const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const handleAutoPrintTicket = (booking) => {
    setIsAutoPrinting(true);
    setTicketModal(booking);
    setTimeout(() => {
      printSlipElement('irctc-ticket-print-area', \`IRCTC-Ticket-\${booking.bookingId}\`, () => {
        setIsAutoPrinting(false);
        setTicketModal(null);
      });
    }, 500);
  };
  const handleAutoPrintReceipt = (booking, txn) => {
    setIsAutoPrinting(true);
    setReceiptModal({ booking, txn });
    setTimeout(() => {
      printSlipElement('mandir-receipt-print-area', \`MVD-Receipt-\${txn.id}\`, () => {
        setIsAutoPrinting(false);
        setReceiptModal(null);
      });
    }, 500);
  };`
        );
    }

    // 2. Replace onClick in Yatri Directory for Ticket
    content = content.replace(
        /onClick=\{\(\) => setTicketModal\(b\)\} title="पर्ची देखें"/g,
        `onClick={() => handleAutoPrintTicket(b)} title="पर्ची प्रिंट करें"`
    );

    // 3. Replace onClick in Receipts Desk for Receipt
    content = content.replace(
        /onClick=\{\(\) => setReceiptModal\(\{ booking: b, txn \}\)\}/g,
        `onClick={() => handleAutoPrintReceipt(b, txn)}`
    );
    
    // 4. Update the text from "पर्ची देखें" to "पर्ची प्रिंट" and "यह रसीद प्रिंट करें" is fine
    content = content.replace(
        /<Eye size=\{13\} \/> पर्ची/g,
        `<Printer size={13} /> पर्ची`
    );

    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('App.jsx successfully patched with Auto Print Handlers.');
}

injectAutoPrintHandlers();
