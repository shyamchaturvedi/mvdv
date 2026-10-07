const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const lines = content.split('\n');

const idx = lines.findIndex(l => l.includes("label: '9. ") && l.includes("IndianRupee"));

if (idx !== -1) {
  lines.splice(idx + 1, 0, `      { path: '/admin/ai-auditor', icon: <Sparkles size={18} color="#F59E0B" />, label: '10. AI ऑडिटर (बॉट)' },`);
  
  if (lines[idx + 2].includes("10. ")) {
    lines[idx + 2] = lines[idx + 2].replace("10. ", "11. ");
  }
  
  fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', lines.join('\n'));
  console.log("Successfully injected into sidebar via splice!");
} else {
  console.log("Could not find the target line!");
}
