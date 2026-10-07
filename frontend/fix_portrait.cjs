const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const regex = /const pageStyle = isReceipt\s*\?\s*\'@page \{ size: 210mm 148mm; margin: 4mm; \} body \{ width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; \}\'\s*:\s*\'@page \{ size: A4 portrait; margin: 6mm; \} body \{ width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; \}\';/;

const repl = `const pageStyle = '@page { size: A4 portrait; margin: 6mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }';`;

if (regex.test(content)) {
    content = content.replace(regex, repl);
    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('Successfully changed all prints to A4 portrait');
} else {
    console.log('Regex not found');
}
