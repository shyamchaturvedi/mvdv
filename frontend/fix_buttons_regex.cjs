const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

content = content.replace(
  /<button className="btn btn-xs btn-gold" onClick=\{\(\) => \{ setReceiptSearchQuery\(b.bookingId\); navigate\('\/admin\/receipts'\); \}\} title="रसीदें">[\s\S]*?<\/button>/,
  `<button className="btn btn-xs btn-gold" onClick={() => { setReceiptSearchQuery(b.bookingId); navigate('/admin/receipts'); }} title="Payment Slip">
                                          <Printer size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Payment Slip
                                        </button>`
);

content = content.replace(
  /<button className="btn btn-xs btn-outline" onClick=\{\(\) => handleAutoPrintTicket\(b\)\} title="पर्ची प्रिंट करें">[\s\S]*?<\/button>/,
  `<button className="btn btn-xs btn-outline" onClick={() => handleAutoPrintTicket(b)} title="Ticket Print">
                                          <Ticket size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Ticket Print
                                        </button>`
);

content = content.replace(
  /<button className="btn btn-xs btn-outline" onClick=\{\(\) => setEditYatriModal\(b\)\} title="यात्री विवरण एडिट" style=\{\{ borderColor: '#F59E0B', color: '#B45309' \}\}>[\s\S]*?<\/button>/,
  `<button className="btn btn-xs btn-outline" onClick={() => setEditYatriModal(b)} title="Edit Yatri" style={{ borderColor: '#F59E0B', color: '#B45309' }}>
                                            <Edit size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Edit Yatri
                                          </button>`
);

content = content.replace(
  /<button className="btn btn-icon-xs btn-outline" onClick=\{\(\) => openUpiQR\(b.bookingId\)\} title="UPI QR">[\s\S]*?<\/button>/,
  `<button className="btn btn-xs btn-outline" onClick={() => openUpiQR(b.bookingId)} title="UPI QR">
                                          <QrCode size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> UPI QR
                                        </button>`
);

content = content.replace(
  /title="किराया \/ भुगतान एडिट">[\s\S]*?<\/button>/,
  `title="Pay Edit">
                                            <IndianRupee size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Pay Edit
                                          </button>`
);

content = content.replace(
  /<button className="btn btn-icon-xs btn-danger" onClick=\{\(\) => deleteBooking\(b.bookingId\)\} title="Delete">[\s\S]*?<\/button>/,
  `<button className="btn btn-xs btn-danger" onClick={() => deleteBooking(b.bookingId)} title="Delete">
                                              <Trash2 size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Delete
                                            </button>`
);

content = content.replace(
  /title="Ticket Cancel \/ Refund" style=\{\{ background: '#DC2626', color: 'white', borderColor: '#B91C1C' \}\}>[\s\S]*?<\/button>/,
  `title="Cancel/Refund" style={{ background: '#DC2626', color: 'white', borderColor: '#B91C1C' }}>
                                              <RefreshCw size={13} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} /> Cancel/Refund
                                            </button>`
);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('Fixed Buttons with SVG Icons');
