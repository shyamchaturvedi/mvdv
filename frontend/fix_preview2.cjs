const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

// For ticket modal
if (content.includes('{ticketModal && (')) {
    let oldStr = '<div className="modal-overlay" onClick={() => setTicketModal(null)}>';
    let newStr = '<div className="modal-overlay" onClick={() => !isAutoPrinting && setTicketModal(null)} style={{ opacity: isAutoPrinting ? 0 : 1, pointerEvents: isAutoPrinting ? \'none\' : \'auto\' }}>';
    content = content.replace(oldStr, newStr);
}

// For receipt modal
if (content.includes('{receiptModal && (')) {
    let oldStr = '<div className="modal-overlay" onClick={() => setReceiptModal(null)}>';
    let newStr = '<div className="modal-overlay" onClick={() => !isAutoPrinting && setReceiptModal(null)} style={{ opacity: isAutoPrinting ? 0 : 1, pointerEvents: isAutoPrinting ? \'none\' : \'auto\' }}>';
    content = content.replace(oldStr, newStr);
}

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
console.log('App.jsx modal overlays patched.');
