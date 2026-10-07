const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const regex3 = /<span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Seat No\(s\):<\/span>\s*<strong style=\{\{ color: '#1E40AF' \}\}>\{seatStr\}<\/strong>/;

const repl3 = `<span style={{ color: '#4B5563', fontWeight: 700, display: 'block' }}>Seat No(s):</span>
                          <strong style={{ color: '#1E40AF' }}>{projectSettings && projectSettings.hideBerthNumber ? 'Unassigned' : seatStr}</strong>`;

if (regex3.test(content)) {
    content = content.replace(regex3, repl3);
    fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content, 'utf8');
    console.log('Successfully replaced seatStr');
} else {
    console.log('Not found seatStr regex');
}
