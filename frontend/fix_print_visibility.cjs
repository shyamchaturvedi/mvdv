const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

// Fix printCombinedSlipElements
let regexCombined = /<style>\s*\$\{pageStyle\}\s*\* \{ box-sizing: border-box; \}\s*\.no-print \{ display: none !important; \}/;
let replCombined = `<style>
            \${pageStyle}
            * { box-sizing: border-box; }
            @media print { body * { visibility: visible !important; } .no-print, .no-print * { display: none !important; visibility: hidden !important; } }
            .no-print { display: none !important; }`;
content = content.replace(regexCombined, replCombined);

// Fix printSlipElement
let regexSingle = /<style>\s*\$\{pageStyle\}\s*\* \{ box-sizing: border-box; margin: 0; padding: 0; \}\s*\.no-print \{ display: none !important; \}/;
let replSingle = `<style>
            \${pageStyle}
            * { box-sizing: border-box; margin: 0; padding: 0; }
            @media print { body * { visibility: visible !important; } .no-print, .no-print * { display: none !important; visibility: hidden !important; } }
            .no-print { display: none !important; }`;
content = content.replace(regexSingle, replSingle);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
console.log('Successfully fixed print visibility blank issue.');
