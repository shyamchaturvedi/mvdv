const fs = require('fs');

function injectEditModals() {
    let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

    // 1. Add States
    if (!content.includes('editYatriModal')) {
        content = content.replace(
            /const \[posterModal, setPosterModal\] = useState\(false\);/,
            `const [posterModal, setPosterModal] = useState(false);\n  const [editYatriModal, setEditYatriModal] = useState(null);\n  const [editReceiptModal, setEditReceiptModal] = useState(null);`
        );
    }

    // 2. Add Button for Edit Receipt
    if (!content.includes('setEditReceiptModal(')) {
        content = content.replace(
            /<Printer size=\{15\} style=\{\{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' \}\} \/> यह रसीद प्रिंट करें\s*<\/button>/,
            `<Printer size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> यह रसीद प्रिंट करें
                              </button>
                              {isSuperAdmin && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => setEditReceiptModal({ booking: b, txn, tIndex: sIdx })}
                                  style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: '#F59E0B', color: '#B45309' }}
                                >
                                  ✏️ एडिट
                                </button>
                              )}`
        );
    }

    // 3. Add Button for Edit Yatri
    if (!content.includes('setEditYatriModal(')) {
        content = content.replace(
            /<Eye size=\{13\} \/> पर्ची\s*<\/button>/,
            `<Eye size={13} /> पर्ची\n                                      </button>\n                                      {isSuperAdmin && (\n                                        <button className="btn btn-xs btn-outline" onClick={() => setEditYatriModal(b)} title="यात्री विवरण एडिट" style={{ borderColor: '#F59E0B', color: '#B45309' }}>\n                                          ✏️ यात्री\n                                        </button>\n                                      )}`
        );
    }

    // 4. Modals Component Code
    const modalCode = `
      {/* ----------------- EDIT YATRI MODAL ----------------- */}
      {editYatriModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#9A3412', fontSize: '1.2rem', fontWeight: 800 }}>
                ✏️ यात्री विवरण एडिट करें (PNR: {editYatriModal.bookingId})
              </h3>
              <button onClick={() => setEditYatriModal(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {editYatriModal.passengers.map((p, idx) => (
                <div key={idx} style={{ background: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid #E5E7EB' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#4B5563' }}>यात्री #{idx + 1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#6B7280' }}>नाम</label>
                      <input type="text" className="form-control form-control-sm" value={p.name} onChange={(e) => {
                        const newPax = [...editYatriModal.passengers];
                        newPax[idx].name = e.target.value;
                        setEditYatriModal({...editYatriModal, passengers: newPax});
                      }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#6B7280' }}>उम्र / लिंग</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input type="number" className="form-control form-control-sm" style={{ width: '40%' }} value={p.age} onChange={(e) => {
                          const newPax = [...editYatriModal.passengers];
                          newPax[idx].age = e.target.value;
                          setEditYatriModal({...editYatriModal, passengers: newPax});
                        }} />
                        <select className="form-control form-control-sm" style={{ width: '60%' }} value={p.gender} onChange={(e) => {
                          const newPax = [...editYatriModal.passengers];
                          newPax[idx].gender = e.target.value;
                          setEditYatriModal({...editYatriModal, passengers: newPax});
                        }}>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#6B7280' }}>कोच / सीट</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input type="text" className="form-control form-control-sm" placeholder="Coach" style={{ width: '40%' }} value={p.coach} onChange={(e) => {
                          const newPax = [...editYatriModal.passengers];
                          newPax[idx].coach = e.target.value;
                          setEditYatriModal({...editYatriModal, passengers: newPax});
                        }} />
                        <input type="text" className="form-control form-control-sm" placeholder="Seat" style={{ width: '60%' }} value={p.seat} onChange={(e) => {
                          const newPax = [...editYatriModal.passengers];
                          newPax[idx].seat = e.target.value;
                          setEditYatriModal({...editYatriModal, passengers: newPax});
                        }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#6B7280' }}>स्थिति</label>
                      <select className="form-control form-control-sm" value={p.status || 'CNF'} onChange={(e) => {
                          const newPax = [...editYatriModal.passengers];
                          newPax[idx].status = e.target.value;
                          setEditYatriModal({...editYatriModal, passengers: newPax});
                        }}>
                          <option value="CNF">CNF (Confirmed)</option>
                          <option value="WL">WL (Waitlist)</option>
                          <option value="RAC">RAC</option>
                          <option value="CAN">CAN (Cancelled)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setEditYatriModal(null)}>रद्द करें</button>
              <button className="btn btn-primary" onClick={async () => {
                const btn = document.activeElement;
                const prev = btn.innerText;
                btn.innerText = 'Updating...';
                try {
                  const res = await fetch(\`/api/admin/bookings/\${editYatriModal.bookingId}?token=\${staffToken}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ passengers: editYatriModal.passengers })
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert('यात्री विवरण सफलतापूर्वक अपडेट हो गया!');
                    fetchAdminData();
                    setEditYatriModal(null);
                  } else {
                    alert('Error: ' + data.error);
                  }
                } catch (e) {
                  alert('Network error');
                }
                btn.innerText = prev;
              }}>अपडेट सेव करें (Save)</button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- EDIT RECEIPT MODAL ----------------- */}
      {editReceiptModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#047857', fontSize: '1.2rem', fontWeight: 800 }}>
                ✏️ रसीद विवरण एडिट करें
              </h3>
              <button onClick={() => setEditReceiptModal(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>
            
            <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 8, border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '0.85rem', color: '#4B5563', marginBottom: 16 }}>
                <strong>रसीद ID:</strong> {editReceiptModal.txn.id} <br/>
                <strong>PNR:</strong> {editReceiptModal.booking.bookingId}
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>अमाउंट (Amount)</label>
                <input type="number" className="form-control" value={editReceiptModal.txn.amount} onChange={(e) => {
                  setEditReceiptModal({
                    ...editReceiptModal,
                    txn: { ...editReceiptModal.txn, amount: e.target.value }
                  });
                }} />
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>भुगतान का माध्यम (Payment Mode)</label>
                <select className="form-control" value={editReceiptModal.txn.method || 'Cash'} onChange={(e) => {
                  setEditReceiptModal({
                    ...editReceiptModal,
                    txn: { ...editReceiptModal.txn, method: e.target.value }
                  });
                }}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>UTR / संदर्भ संख्या (Ref No)</label>
                <input type="text" className="form-control" value={editReceiptModal.txn.utr || ''} onChange={(e) => {
                  setEditReceiptModal({
                    ...editReceiptModal,
                    txn: { ...editReceiptModal.txn, utr: e.target.value }
                  });
                }} />
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>कैशियर / स्टाफ का नाम</label>
                <input type="text" className="form-control" value={editReceiptModal.txn.cashierName || ''} onChange={(e) => {
                  setEditReceiptModal({
                    ...editReceiptModal,
                    txn: { ...editReceiptModal.txn, cashierName: e.target.value }
                  });
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setEditReceiptModal(null)}>रद्द करें</button>
              <button className="btn btn-primary" style={{ background: '#047857', borderColor: '#065F46' }} onClick={async () => {
                const btn = document.activeElement;
                const prev = btn.innerText;
                btn.innerText = 'Updating...';
                try {
                  // Build updated payment history
                  const newPaymentHistory = [...(editReceiptModal.booking.paymentHistory || [])];
                  
                  // Handle cases where the txn didn't exist in paymentHistory (like implicit advance)
                  const tIndex = newPaymentHistory.findIndex(t => t.id === editReceiptModal.txn.id);
                  if (tIndex >= 0) {
                      newPaymentHistory[tIndex] = editReceiptModal.txn;
                  } else {
                      newPaymentHistory.push(editReceiptModal.txn);
                  }

                  const res = await fetch(\`/api/admin/bookings/\${editReceiptModal.booking.bookingId}?token=\${staffToken}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentHistory: newPaymentHistory })
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert('रसीद सफलतापूर्वक अपडेट हो गई!');
                    fetchAdminData();
                    setEditReceiptModal(null);
                  } else {
                    alert('Error: ' + data.error);
                  }
                } catch (e) {
                  alert('Network error');
                }
                btn.innerText = prev;
              }}>अपडेट सेव करें (Save)</button>
            </div>
          </div>
        </div>
      )}
`;

    if (!content.includes('EDIT YATRI MODAL')) {
        content = content.replace(
            /\{posterModal && \(/,
            modalCode + '\n      {posterModal && ('
        );
    }

    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('App.jsx successfully patched with Edit Modals.');
}

injectEditModals();
