const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

// 1. Add state for offlineReceiptNo
content = content.replace(
  /const \[bookingPaymentMode, setBookingPaymentMode\] = useState\('Cash'\);/,
  `const [bookingPaymentMode, setBookingPaymentMode] = useState('Cash');\n  const [offlineReceiptNo, setOfflineReceiptNo] = useState('');`
);

// 2. Add to handleBookingSubmit payload
content = content.replace(
  /paymentMode: bookingPaymentMode,/,
  `paymentMode: bookingPaymentMode,\n        offlineReceiptNo: offlineReceiptNo,`
);

// 3. Reset state on success
content = content.replace(
  /setBookingPaymentMode\('Cash'\);/,
  `setBookingPaymentMode('Cash');\n        setOfflineReceiptNo('');`
);

// 4. Add the input field in the form (around line 5126)
const oldFormGroup = `<div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">अग्रिम टोकन राशि (Advance ₹):</label>
                                <input type="number" className="form-control" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} min="0" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">छूट / रियायत (Discount ₹):</label>
                                <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" />
                              </div>
                            </div>
                            
                            <div className="form-group" style={{ marginTop: '12px', marginBottom: '18px' }}>
                                <label className="form-label">भुगतान माध्यम (Payment Mode):</label>
                                <select className="form-control" value={bookingPaymentMode} onChange={(e) => setBookingPaymentMode(e.target.value)}>
                                  <option value="Cash">Cash (नकद)</option>
                                  <option value="UPI">UPI (QR Code)</option>
                                  <option value="Card">Credit/Debit Card</option>
                                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                </select>
                            </div>`;

const newFormGroup = `<div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">अग्रिम टोकन राशि (Advance ₹):</label>
                                <input type="number" className="form-control" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} min="0" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">छूट / रियायत (Discount ₹):</label>
                                <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" />
                              </div>
                            </div>
                            
                            <div className="grid-2" style={{ marginTop: '12px', marginBottom: '18px' }}>
                              <div className="form-group">
                                  <label className="form-label">भुगतान माध्यम (Payment Mode):</label>
                                  <select className="form-control" value={bookingPaymentMode} onChange={(e) => setBookingPaymentMode(e.target.value)}>
                                    <option value="Cash">Cash (नकद)</option>
                                    <option value="UPI">UPI (QR Code)</option>
                                    <option value="Card">Credit/Debit Card</option>
                                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                  </select>
                              </div>
                              <div className="form-group">
                                  <label className="form-label">ऑफलाइन रसीद क्र. (Offline Book Serial - Optional):</label>
                                  <input type="text" className="form-control" value={offlineReceiptNo} onChange={(e) => setOfflineReceiptNo(e.target.value)} placeholder="E.g. Book 14, Sl 105" />
                              </div>
                            </div>`;

content = content.replace(oldFormGroup, newFormGroup);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('App.jsx modified successfully');
