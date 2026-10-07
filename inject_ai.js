const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

// We need to inject a new component for the AI Chatbot
const chatbotComponent = `
const SmartAIAuditor = ({ adminBookings, staffToken }) => {
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'नमस्कार! मैं आपका स्मार्ट ऑडिट असिस्टेंट हूँ। आप मुझसे आज का कैश, डिलीट हुए टिकट, या कुल बुकिंग के बारे में पूछ सकते हैं।' }]);
  const [query, setQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/audit-logs?token=' + (staffToken || 'admin_token'))
      .then(r => r.json())
      .then(d => { if (d.logs) setAuditLogs(d.logs); })
      .catch(e => console.error(e));
  }, [staffToken]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const processQuery = (q) => {
    let lowerQ = q.toLowerCase();
    let response = "माफ़ करें, मैं यह नहीं समझ पाया। आप 'आज का कलेक्शन', 'रद्द टिकट', या 'डिलीट हिस्ट्री' पूछ सकते हैं।";
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = adminBookings.filter(b => b.createdAt && b.createdAt.startsWith(todayStr));

    if (lowerQ.includes('kaisa') || lowerQ.includes('hello')) {
       response = "मैं ठीक हूँ! आप ऑडिट रिपोर्ट मांग सकते हैं।";
    }
    else if (lowerQ.includes('cash') || lowerQ.includes('nakhad') || lowerQ.includes('kash') || lowerQ.includes('paisa')) {
       let cash = todayBookings.filter(b => b.paymentMode === 'Cash').reduce((acc, b) => acc + Number(b.advance || 0), 0);
       let upi = todayBookings.filter(b => b.paymentMode === 'UPI').reduce((acc, b) => acc + Number(b.advance || 0), 0);
       response = \`आज का कुल नकद (Cash): ₹\${cash}\\nआज का कुल ऑनलाइन (UPI): ₹\${upi}\`;
    }
    else if (lowerQ.includes('aaj') || lowerQ.includes('today') || lowerQ.includes('kitne')) {
       let total = todayBookings.reduce((acc, b) => acc + Number(b.advance || 0), 0);
       response = \`आज कुल \${todayBookings.length} बुकिंग्स हुई हैं। आज की कुल कमाई ₹\${total} है।\`;
    }
    else if (lowerQ.includes('edit') || lowerQ.includes('badla') || lowerQ.includes('change')) {
       const edits = auditLogs.filter(a => a.action === 'BOOKING_EDIT' || a.action === 'STAFF_UPDATED').slice(0, 5);
       if (edits.length === 0) response = "आज किसी ने कोई बुकिंग एडिट नहीं की है।";
       else {
         response = "हाल ही के एडिट्स:\\n" + edits.map(e => \`• \${e.performedBy} ने \${new Date(e.timestamp).toLocaleTimeString()} पर: \${e.details}\`).join("\\n");
       }
    }
    else if (lowerQ.includes('delete') || lowerQ.includes('cancel') || lowerQ.includes('radd')) {
       const deletes = auditLogs.filter(a => a.action === 'BOOKING_DELETE' || a.action === 'BOOKING_CANCEL').slice(0, 5);
       if (deletes.length === 0) response = "आज किसी ने कोई टिकट डिलीट या रद्द नहीं किया है।";
       else {
         response = "डिलीट / रद्द हुए टिकट:\\n" + deletes.map(e => \`• \${e.performedBy} ने \${new Date(e.timestamp).toLocaleTimeString()} पर: \${e.details}\`).join("\\n");
       }
    }
    else if (lowerQ.includes('chori') || lowerQ.includes('fraud') || lowerQ.includes('report')) {
       const suspect = auditLogs.filter(a => a.action === 'BOOKING_DELETE' || a.action === 'BOOKING_EDIT').length;
       response = \`सिक्योरिटी रिपोर्ट: अब तक \${suspect} संवेदनशील बदलाव (Edits/Deletes) पकड़े गए हैं। 'edit' या 'delete' लिखकर विवरण देखें।\`;
    }

    setChatLog(prev => [...prev, { sender: 'ai', text: response }]);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setChatLog(prev => [...prev, { sender: 'user', text: query }]);
    setQuery('');
    setTimeout(() => processQuery(query), 500);
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '60vh' }}>
      <div style={{ background: '#4F46E5', color: '#fff', padding: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
        <ShieldCheck size={20} style={{ marginRight: '8px' }} />
        स्मार्ट AI ऑडिटर (Offline Mode)
      </div>
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#F9FAFB' }}>
        {chatLog.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: c.sender === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
            <div style={{ 
              background: c.sender === 'user' ? '#4F46E5' : '#E5E7EB', 
              color: c.sender === 'user' ? '#fff' : '#1F2937',
              padding: '10px 14px', borderRadius: '12px', maxWidth: '80%', whiteSpace: 'pre-line' 
            }}>
              {c.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', padding: '12px', background: '#fff', borderTop: '1px solid #E5E7EB' }}>
        <input type="text" placeholder="पूछें (जैसे: आज कितना कैश आया?, डिलीट रिपोर्ट)..." value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', marginRight: '8px' }} />
        <button type="submit" className="btn btn-primary" style={{ padding: '0 20px', borderRadius: '8px' }}>भेजें</button>
      </form>
    </div>
  );
};
`;

if (!content.includes('SmartAIAuditor =')) {
  content = content.replace(/const App = \(\) => \{/, chatbotComponent + '\nconst App = () => {');
}

// Add ShieldCheck icon
if (!content.includes('ShieldCheck,')) {
  content = content.replace(/import \{ /, `import { ShieldCheck, `);
}

// Add Tab
if (!content.includes('<option value="ai_audit">AI ऑडिटर</option>')) {
  // Try to find the select where we choose tabs. In App.jsx there are multiple views. 
  // Look for admin tabs: <button onClick={() => navigate('/admin')}
  const targetAdminTabs = `<button className={\`btn btn-sm \${adminActiveTab === 'roster' ? 'btn-primary' : 'btn-outline'}\`} onClick={() => setAdminActiveTab('roster')}>स्टाफ रोस्टर</button>`;
  const newAdminTabs = `<button className={\`btn btn-sm \${adminActiveTab === 'ai_audit' ? 'btn-primary' : 'btn-outline'}\`} onClick={() => setAdminActiveTab('ai_audit')}>AI ऑडिटर</button>\n                          ` + targetAdminTabs;
  content = content.replace(targetAdminTabs, newAdminTabs);
}

// Add the rendering of the tab
const targetRender = `{adminActiveTab === 'roster' && (`;
const newRender = `{adminActiveTab === 'ai_audit' && (
                        <div className="module-card">
                          <h2 className="module-card-title">ऑर्गेनाइज़र AI असिस्टेंट</h2>
                          <p className="module-card-desc">यह इन-बिल्ट स्मार्ट बॉट बिना इंटरनेट API के आपके डेटा का विश्लेषण करता है।</p>
                          <SmartAIAuditor adminBookings={adminBookings} staffToken={staffToken} />
                        </div>
                      )}\n\n                      ` + targetRender;
content = content.replace(targetRender, newRender);

fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
console.log('AI Auditor component injected successfully!');
