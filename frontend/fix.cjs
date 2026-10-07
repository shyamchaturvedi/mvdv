const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const regex1 = /const printSlipElement = \(elementId, docTitle = 'MVD Document'\) => \{[\s\S]*?\}, 450\);\s*\};\s*/g;

const repl1 = `const printCombinedSlipElements = (elementId1, elementId2, docTitle = 'MVD Document') => {
    const elem1 = document.getElementById(elementId1);
    const elem2 = document.getElementById(elementId2);
    if (!elem1 || !elem2) return;
    
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      window.print();
      return;
    }
    
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\\n');
    const pageStyle = '@page { size: A4 portrait; margin: 6mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }';

    printWindow.document.write(\`
      <!DOCTYPE html>
      <html>
        <head>
          <title>\${docTitle}</title>
          \${styles}
          <style>
            \${pageStyle}
            * { box-sizing: border-box; }
            .no-print { display: none !important; }
            .irctc-ticket-wrapper, .mandir-receipt-wrapper { box-shadow: none !important; margin: 0 auto !important; max-width: 100% !important; border: 1.5px solid #0284C7 !important; page-break-inside: avoid; }
            .mandir-receipt-wrapper { border: 2px solid #C2410C !important; page-break-before: always; margin-top: 10mm !important; }
          </style>
        </head>
        <body style="background: #ffffff; padding: 0;">
          <div style="width: 100%; padding-bottom: 20px;">
            \${elem1.outerHTML}
          </div>
          <div style="page-break-before: always; width: 100%; padding-top: 20px;">
            \${elem2.outerHTML}
          </div>
        </body>
      </html>
    \`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 800);
  };

  const printSlipElement = (elementId, docTitle = 'MVD Document') => {
    const elem = document.getElementById(elementId);
    if (!elem) {
      window.print();
      return;
    }
    const isReceipt = elementId.includes('receipt');
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      window.print();
      return;
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\\n');
    const pageStyle = isReceipt
      ? '@page { size: 210mm 148mm; margin: 4mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
      : '@page { size: A4 portrait; margin: 6mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }';

    printWindow.document.write(\`
      <!DOCTYPE html>
      <html>
        <head>
          <title>\${docTitle}</title>
          \${styles}
          <style>
            \${pageStyle}
            * { box-sizing: border-box; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            .irctc-ticket-wrapper { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; border: 1.5px solid #0284C7 !important; }
            .mandir-receipt-wrapper { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; border: 2px solid #C2410C !important; }
          </style>
        </head>
        <body style="background: #ffffff; padding: 0;">
          \${elem.outerHTML}
        </body>
      </html>
    \`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 800);
  };
`;

const regex2 = /\/\/ Fast counter workflow: immediately trigger print dialog[\s\S]*?\}, 500\);/g;

const repl2 = `// Fast counter workflow: immediately trigger print dialog combining both
        setTimeout(() => {
          printCombinedSlipElements('irctc-ticket-print-area', 'mandir-receipt-print-area', \`MVD-Booking-Receipt-\${data.booking.bookingId}\`);
        }, 150);`;

let success = true;
if (regex1.test(content)) {
    content = content.replace(regex1, repl1);
    console.log("Replaced 1");
} else {
    console.log('Regex 1 not matched');
    success = false;
}

if (regex2.test(content)) {
    content = content.replace(regex2, repl2);
    console.log("Replaced 2");
} else {
    console.log('Regex 2 not matched');
    success = false;
}

if(success){
    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('Successfully replaced');
}
