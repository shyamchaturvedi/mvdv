const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

if (!content.includes('Html5QrcodeScanner')) {
  content = content.replace(/import React, \{ useState, useEffect, useRef \} from 'react';/, `import React, { useState, useEffect, useRef } from 'react';\nimport { Html5QrcodeScanner } from 'html5-qrcode';`);
}

const oldScanEffectTarget = `const [bulkModalOpen, setBulkModalOpen] = useState(false);`;
const scannerEffect = `
  useEffect(() => {
    let html5QrcodeScanner = null;
    if (verifierTab === 'ticket_scanner' || (staffUser && staffUser.role === 'TTE')) {
      setTimeout(() => {
          html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: {width: 250, height: 250} },
            false
          );
          
          html5QrcodeScanner.render(
            (decodedText, decodedResult) => {
              if(decodedText) {
                 let pnr = decodedText;
                 try {
                   const parsed = JSON.parse(decodedText);
                   if(parsed.b) pnr = parsed.b;
                   else if(parsed.bookingId) pnr = parsed.bookingId;
                 } catch(e) {}
                 
                 setVerifierPnr(pnr);
                 html5QrcodeScanner.pause();
                 
                 setTimeout(() => {
                    const btn = document.getElementById('verify-btn');
                    if (btn) btn.click();
                    setTimeout(() => {
                        try { html5QrcodeScanner.resume(); } catch(err) {}
                    }, 3000);
                 }, 500);
              }
            },
            (errorMessage) => {
            }
          );
      }, 300);
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [verifierTab, staffUser]);
`;

content = content.replace(oldScanEffectTarget, scannerEffect + '\n\n' + oldScanEffectTarget);

const oldFrame = `<div className="qr-scanner-frame">
                            <div className="qr-scanner-corners">
                              <div className="qr-scanner-corners-inner"></div>
                            </div>
                            <div className="laser-line"></div>
                            <div className="scanner-text">
                              <Scan size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                              QR CODE SCANNING...
                            </div>
                          </div>`;

const newFrame = `<div id="reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto', border: 'none', borderRadius: '12px', overflow: 'hidden' }}></div>`;

content = content.replace(oldFrame, newFrame);
content = content.replace(/<button type="submit" className="btn btn-primary btn-full">/g, `<button id="verify-btn" type="submit" className="btn btn-primary btn-full">`);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('Scanner Injected successfully');
