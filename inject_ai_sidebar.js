const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const targetLine = `{ path: '/admin/reconcile', icon: <IndianRupee size={18} />, label: '9. दैनिक वसूली व हिसाब' },`;
const newLine = `{ path: '/admin/reconcile', icon: <IndianRupee size={18} />, label: '9. दैनिक वसूली व हिसाब' },
      { path: '/admin/ai-auditor', icon: <Sparkles size={18} color="#F59E0B" />, label: '10. AI ऑडिटर (बॉट)' },`;

if (!content.includes('/admin/ai-auditor')) {
  content = content.replace(targetLine, newLine);
  
  // Also shift user guide down
  content = content.replace(`label: '10. यूज़र गाइड व SOP'`, `label: '11. यूज़र गाइड व SOP'`);
}

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('Injected to Sidebar');
