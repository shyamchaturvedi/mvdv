const fs = require('fs');

function removeSealAndSignatures() {
    let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

    // 1. Replace Ticket Signature Block
    content = content.replace(
        /<div>Authorized Signatory, Trust Secretary<\/div>/g,
        `<div style={{ color: '#047857', fontWeight: 'bold' }}>*Digitally Signed (No Signature Required)*</div>`
    );

    // 2. Remove Receipt Seal & Replace Signature Block
    const receiptSignatureRegex = /<div style=\{\{ textAlign: 'center' \}\}>\s*<div style=\{\{ border: '1\.5px solid #C2410C'[^>]+>\s*<span> MVD<\/span>\s*<span>SEAL<\/span>\s*<span>2026<\/span>\s*<\/div>\s*<div style=\{\{ fontSize: '0\.6rem'[^>]+>Official Digital Stamp<\/div>\s*<\/div>\s*<div style=\{\{ textAlign: 'right' \}\}>\s*<div style=\{\{ color: '#4B5563'[^>]+>Authorized Signatory:<\/div>\s*<strong style=\{\{ color: '#7C2D12'[^>]+>For Shri Mata Vaishno Devi Trust<\/strong>\s*<div style=\{\{ color: '#9CA3AF'[^>]+>Official Computer Generated Receipt<\/div>\s*<\/div>/g;

    const receiptReplacement = `<div style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#047857', fontSize: '0.8rem' }}>*Digitally Signed (No Signature Required)*</strong>
                          <div style={{ color: '#9CA3AF', fontSize: '0.62rem' }}>Official Computer Generated Receipt</div>
                        </div>`;

    content = content.replace(receiptSignatureRegex, receiptReplacement);

    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('App.jsx successfully patched: Seal and signatures removed.');
}

removeSealAndSignatures();
