const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const regex = /\{\/\* Bottom Modal Actions \(No-Print\) \*\/\}\s*<div className="no-print" style=\{\{ display: 'flex', gap: 10, marginTop: 14 \}\}>/;

const repl = `{/* Bottom Modal Actions (No-Print) */}
            <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {ticketModal.status !== 'Cancelled' && (
                <button 
                  className="btn btn-danger btn-sm" 
                  style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '0 12px' }} 
                  onClick={() => { 
                    setCancelModal({ 
                      show: true, 
                      booking: ticketModal, 
                      refundAmount: 0, 
                      cancellationCharges: ticketModal.advance || 0, 
                      cancellationReason: 'यात्री के अनुरोध पर', 
                      refundMode: 'Cash', 
                      utr: '' 
                    }); 
                    setTicketModal(null); 
                  }}>
                  रद्द करें (Cancel)
                </button>
              )}`;

if (regex.test(content)) {
    content = content.replace(regex, repl);
    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('Successfully added Cancel button');
} else {
    console.log('Cancel button target not found');
}
