const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const oldTd = `<td><strong style={{ color: '#C2410C' }}>{b.bookingId}</strong></td>`;
const newTd = `<td>
                                    <strong style={{ color: '#C2410C' }}>{b.bookingId}</strong>
                                    {b.offlineReceiptNo && (
                                      <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 4 }}>
                                        Receipt: <strong>{b.offlineReceiptNo}</strong>
                                      </div>
                                    )}
                                  </td>`;

content = content.replace(oldTd, newTd);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('App.jsx table modified successfully');
