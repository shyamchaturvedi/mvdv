const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const targetStr = `<div className="form-group">
                                <label className="form-label">छूट / रियायत (Discount ₹):</label>
                                <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" />
                              </div>
                            </div>`;

const newStr = `<div className="form-group">
                                <label className="form-label">छूट / रियायत (Discount ₹):</label>
                                <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" />
                              </div>
                            </div>
                            
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">भुगतान माध्यम (Payment Mode):</label>
                                <select className="form-control" value={bookingPaymentMode} onChange={(e) => setBookingPaymentMode(e.target.value)}>
                                  <option value="Cash">Cash (नकद)</option>
                                  <option value="UPI">UPI (QR Code)</option>
                                  <option value="Card">Credit/Debit Card</option>
                                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                                </select>
                            </div>`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log("Injected Payment Mode Select");
