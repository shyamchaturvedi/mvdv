const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

// Replace ticketModal buttons
let ticketRegex = /<button[\s\S]*?onClick=\{\(\) => printSlipElement\('irctc-ticket-print-area', `IRCTC-Ticket-\$\{ticketModal\.bookingId\}`\)\}[\s\S]*?>[\s\S]*?<Printer size=\{15\} style=\{\{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' \}\} \/> पर्ची प्रिंट करें \(A4 Print\)[\s\S]*?<\/button>\s*<a[\s\S]*?href=\{`\/api\/bookings\/\$\{ticketModal\.bookingId\}\/pdf\?token=\$\{safeStaffToken\}`\}[\s\S]*?target="_blank"[\s\S]*?rel="noreferrer"[\s\S]*?className="btn btn-outline btn-sm"[\s\S]*?style=\{\{ flex: 1, borderColor: '#0284C7', color: '#0284C7' \}\}[\s\S]*?>[\s\S]*?<FileText size=\{15\} style=\{\{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' \}\} \/> PDF डाउनलोड[\s\S]*?<\/a>/;

let ticketRepl = `<button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1, background: '#0284C7', borderColor: '#0369A1' }} 
                onClick={() => printSlipElement('irctc-ticket-print-area', \`IRCTC-Ticket-\${ticketModal.bookingId}\`)}
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> टिकट प्रिंट / Save PDF
              </button>`;
if (ticketRegex.test(content)) {
    content = content.replace(ticketRegex, ticketRepl);
    console.log('Ticket buttons replaced successfully.');
} else {
    console.log('Ticket buttons NOT FOUND.');
}


// Replace receiptModal buttons
let receiptRegex = /<button[\s\S]*?className="btn btn-primary btn-sm"[\s\S]*?style=\{\{ flex: 1 \}\}[\s\S]*?onClick=\{\(\) => printSlipElement\('mandir-receipt-print-area', `MVD-Receipt-\$\{receiptModal\.txn\.id\}`\)\}[\s\S]*?>[\s\S]*?<Printer size=\{15\} style=\{\{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' \}\} \/> रसीद प्रिंट करें \(A4-Half Print\)[\s\S]*?<\/button>\s*<a[\s\S]*?href=\{`\/api\/bookings\/\$\{receiptModal\.booking\.bookingId\}\/receipt\/\$\{receiptModal\.txn\.id\}`\}[\s\S]*?target="_blank"[\s\S]*?rel="noreferrer"[\s\S]*?className="btn btn-outline btn-sm"[\s\S]*?style=\{\{ flex: 1 \}\}[\s\S]*?>[\s\S]*?<FileText size=\{15\} style=\{\{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' \}\} \/> PDF डाउनलोड[\s\S]*?<\/a>/;

let receiptRepl = `<button 
                className="btn btn-primary btn-sm" 
                style={{ flex: 1 }} 
                onClick={() => printSlipElement('mandir-receipt-print-area', \`MVD-Receipt-\${receiptModal.txn.id}\`)}
              >
                <Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> रसीद प्रिंट / Save PDF
              </button>`;

if (receiptRegex.test(content)) {
    content = content.replace(receiptRegex, receiptRepl);
    console.log('Receipt buttons replaced successfully.');
} else {
    console.log('Receipt buttons NOT FOUND.');
}

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
