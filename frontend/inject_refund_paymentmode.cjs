const fs = require('fs');

function injectPaymentModeAndRefund() {
    let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

    // 1. Add paymentMode state
    if (!content.includes('const [bookingPaymentMode')) {
        content = content.replace(
            /const \[advancePayment, setAdvancePayment\] = useState\(1000\);/,
            `const [advancePayment, setAdvancePayment] = useState(1000);\n  const [bookingPaymentMode, setBookingPaymentMode] = useState('Cash');`
        );
    }

    // 2. Add paymentMode to payload in handleBookingSubmit
    if (!content.includes('paymentMode: bookingPaymentMode')) {
        content = content.replace(
            /discount: Number\(discount\),/,
            `discount: Number(discount),\n        paymentMode: bookingPaymentMode,`
        );
    }

    // 3. Add UI for Payment Mode in Booking Form
    if (!content.includes('setBookingPaymentMode')) {
        content = content.replace(
            /<div className="form-group">\s*<label className="form-label">अग्रिम टोकन राशि \(Advance ₹\):<\/label>\s*<input type="number" className="form-control" value=\{advancePayment\} onChange=\{\(e\) => setAdvancePayment\(e.target.value\)\} min="0" required \/>\s*<\/div>/,
            `<div className="form-group">
                                  <label className="form-label">अग्रिम टोकन राशि (Advance ₹):</label>
                                  <input type="number" className="form-control" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} min="0" required />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">भुगतान माध्यम (Payment Mode):</label>
                                  <select className="form-control" value={bookingPaymentMode} onChange={(e) => setBookingPaymentMode(e.target.value)}>
                                    <option value="Cash">Cash (नकद)</option>
                                    <option value="UPI">UPI (QR Code)</option>
                                    <option value="Card">Credit/Debit Card</option>
                                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                  </select>
                                </div>`
        );
    }

    // 4. Add cancel/refund state
    if (!content.includes('cancelRefundModal')) {
        content = content.replace(
            /const \[editYatriModal, setEditYatriModal\] = useState\(null\);/,
            `const [editYatriModal, setEditYatriModal] = useState(null);\n  const [cancelRefundModal, setCancelRefundModal] = useState(null);`
        );
    }

    // 5. Add Refund Button in Yatri Directory Actions
    if (!content.includes('setCancelRefundModal(b)')) {
        content = content.replace(
            /<button className="btn btn-icon-xs btn-danger" onClick=\{\(\) => deleteBooking\(b.bookingId\)\} title="Delete">\s*✕\s*<\/button>/,
            `<button className="btn btn-icon-xs btn-danger" onClick={() => deleteBooking(b.bookingId)} title="Delete">
                                            ✕
                                          </button>
                                        )}
                                        {isSuperAdmin && b.status !== 'Cancelled' && (
                                          <button className="btn btn-xs" onClick={() => setCancelRefundModal(b)} title="Ticket Cancel / Refund" style={{ background: '#DC2626', color: 'white', borderColor: '#B91C1C' }}>
                                            रद्द / रिफंड
                                          </button>`
        );
    }

    // 6. Add Refund Modal Component
    const cancelModalCode = `
      {/* ----------------- CANCEL & REFUND MODAL ----------------- */}
      {cancelRefundModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#DC2626', fontSize: '1.2rem', fontWeight: 800 }}>
                ⚠️ टिकट रद्द व रिफंड करें
              </h3>
              <button onClick={() => setCancelRefundModal(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>
            
            <div style={{ background: '#FEF2F2', padding: 16, borderRadius: 8, border: '1px solid #FECACA', marginBottom: 16 }}>
              <div style={{ fontSize: '0.85rem', color: '#991B1B', marginBottom: 8 }}>
                <strong>PNR:</strong> {cancelRefundModal.bookingId} <br/>
                <strong>भक्त:</strong> {cancelRefundModal.bookedBy} <br/>
                <strong>कुल जमा अग्रिम:</strong> ₹{cancelRefundModal.advance || 0}
              </div>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const payload = {
                refundAmount: Number(formData.get('refundAmount')),
                cancellationCharges: Number(formData.get('cancellationCharges')),
                cancellationReason: formData.get('cancellationReason'),
                refundMode: formData.get('refundMode')
              };
              
              const btn = e.target.querySelector('button[type="submit"]');
              const prev = btn.innerText;
              btn.innerText = 'Processing...';
              btn.disabled = true;
              
              try {
                const res = await fetch(\`/api/admin/bookings/\${cancelRefundModal.bookingId}/cancel?token=\${staffToken}\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                  alert('टिकट सफलतापूर्वक रद्द और रिफंड किया गया!');
                  fetchAdminData();
                  setCancelRefundModal(null);
                } else {
                  alert('Error: ' + data.error);
                }
              } catch (err) {
                alert('Network error');
              }
              
              btn.innerText = prev;
              btn.disabled = false;
            }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>रिफंड राशि (Refund Amount ₹)</label>
                <input type="number" name="refundAmount" className="form-control" defaultValue={cancelRefundModal.advance || 0} min="0" required />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>कटौती / कैंसलेशन चार्ज (Charges ₹)</label>
                <input type="number" name="cancellationCharges" className="form-control" defaultValue={0} min="0" required />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>रिफंड माध्यम (Refund Mode)</label>
                <select name="refundMode" className="form-control">
                  <option value="Cash">Cash (नकद वापसी)</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>रद्द करने का कारण</label>
                <input type="text" name="cancellationReason" className="form-control" placeholder="उदा. यात्री अनुरोध, मेडिकल, आदि" required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setCancelRefundModal(null)}>वापस जाएं</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#DC2626', borderColor: '#B91C1C' }}>
                  रद्द करें व रिफंड दें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

    if (!content.includes('CANCEL & REFUND MODAL')) {
        content = content.replace(
            /\{posterModal && \(/,
            cancelModalCode + '\n      {posterModal && ('
        );
    }

    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('App.jsx successfully patched with Refund Modal & Payment Mode UI.');
}

injectPaymentModeAndRefund();
