const fs = require('fs');
let content = fs.readFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', 'utf8');

const newChatbotComponent = `
const SmartAIAuditor = ({ adminBookings, staffToken }) => {
  const [chatLog, setChatLog] = React.useState([
    { sender: 'ai', text: 'नमस्कार! मैं आपका स्मार्ट ऑडिट असिस्टेंट हूँ। 🤖\\nआप मुझसे आज का कैश, डिलीट हुए टिकट, या कुल बुकिंग के बारे में पूछ सकते हैं।' }
  ]);
  const [query, setQuery] = React.useState('');
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [isTyping, setIsTyping] = React.useState(false);
  const chatEndRef = React.useRef(null);

  React.useEffect(() => {
    fetch('/api/admin/audit-logs?token=' + (staffToken || 'admin_token'))
      .then(r => r.json())
      .then(d => { if (d.logs) setAuditLogs(d.logs); })
      .catch(e => console.error(e));
  }, [staffToken]);

  React.useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isTyping]);

  const processQuery = (q) => {
    let lowerQ = q.toLowerCase();
    let response = "माफ़ करें, मैं यह नहीं समझ पाया। आप 'आज का कलेक्शन', 'रद्द टिकट', या 'डिलीट हिस्ट्री' पूछ सकते हैं।";
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = adminBookings.filter(b => b.createdAt && b.createdAt.startsWith(todayStr));

    if (lowerQ.includes('kaisa') || lowerQ.includes('hello') || lowerQ.includes('hi')) {
       response = "मैं ठीक हूँ! आप ऑडिट रिपोर्ट मांग सकते हैं।";
    }
    else if (lowerQ.includes('cash') || lowerQ.includes('nakhad') || lowerQ.includes('kash') || lowerQ.includes('paisa') || lowerQ.includes('collection')) {
       let cash = todayBookings.filter(b => b.paymentMode === 'Cash').reduce((acc, b) => acc + Number(b.advance || 0), 0);
       let upi = todayBookings.filter(b => b.paymentMode === 'UPI').reduce((acc, b) => acc + Number(b.advance || 0), 0);
       response = \`📊 **आज का कलेक्शन:**\\n💰 नकद (Cash): ₹\${cash}\\n📱 ऑनलाइन (UPI): ₹\${upi}\\n💵 कुल: ₹\${cash + upi}\`;
    }
    else if (lowerQ.includes('aaj') || lowerQ.includes('today') || lowerQ.includes('kitne') || lowerQ.includes('booking')) {
       let total = todayBookings.reduce((acc, b) => acc + Number(b.advance || 0), 0);
       response = \`🎟️ आज कुल **\${todayBookings.length} बुकिंग्स** हुई हैं।\\n📈 आज की कुल कमाई **₹\${total}** है।\`;
    }
    else if (lowerQ.includes('edit') || lowerQ.includes('badla') || lowerQ.includes('change') || lowerQ.includes('update')) {
       const edits = auditLogs.filter(a => a.action === 'BOOKING_EDIT' || a.action === 'STAFF_UPDATED').slice(0, 5);
       if (edits.length === 0) response = "✅ आज किसी ने कोई बुकिंग एडिट नहीं की है।";
       else {
         response = "⚠️ **हाल ही के एडिट्स:**\\n\\n" + edits.map(e => \`📝 \${e.performedBy} ने \${new Date(e.timestamp).toLocaleTimeString()} पर:\\n"\${e.details}"\`).join("\\n\\n");
       }
    }
    else if (lowerQ.includes('delete') || lowerQ.includes('cancel') || lowerQ.includes('radd') || lowerQ.includes('hata')) {
       const deletes = auditLogs.filter(a => a.action === 'BOOKING_DELETE' || a.action === 'BOOKING_CANCEL').slice(0, 5);
       if (deletes.length === 0) response = "✅ आज किसी ने कोई टिकट डिलीट या रद्द नहीं किया है।";
       else {
         response = "❌ **डिलीट / रद्द हुए टिकट:**\\n\\n" + deletes.map(e => \`🗑️ \${e.performedBy} ने \${new Date(e.timestamp).toLocaleTimeString()} पर:\\n"\${e.details}"\`).join("\\n\\n");
       }
    }
    else if (lowerQ.includes('chori') || lowerQ.includes('fraud') || lowerQ.includes('report') || lowerQ.includes('audit')) {
       const suspect = auditLogs.filter(a => a.action === 'BOOKING_DELETE' || a.action === 'BOOKING_EDIT').length;
       response = \`🚨 **सिक्योरिटी रिपोर्ट:**\\nअब तक **\${suspect}** संवेदनशील बदलाव (Edits/Deletes) पकड़े गए हैं। 'edit' या 'delete' लिखकर पूरा विवरण देखें।\`;
    }

    setIsTyping(false);
    setChatLog(prev => [...prev, { sender: 'ai', text: response }]);
  };

  const handleSend = (e, customQuery = null) => {
    if (e) e.preventDefault();
    const textToSend = customQuery || query;
    if (!textToSend.trim()) return;
    
    setChatLog(prev => [...prev, { sender: 'user', text: textToSend }]);
    setQuery('');
    setIsTyping(true);
    
    setTimeout(() => processQuery(textToSend), 1200);
  };

  return (
    <div style={{ background: '#F8FAFC', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '70vh', border: '1px solid #E2E8F0' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E1B4B, #4338CA)', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            <Sparkles size={20} color="#4338CA" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px' }}>स्मार्ट AI ऑडिटर</h3>
            <span style={{ fontSize: '0.75rem', color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', background: '#34D399', borderRadius: '50%' }}></div> Online
            </span>
          </div>
        </div>
      </div>

      {/* Chat Body */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {chatLog.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: c.sender === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
            {c.sender === 'ai' && (
              <div style={{ width: '28px', height: '28px', background: '#E0E7FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={14} color="#4338CA" />
              </div>
            )}
            
            <div style={{ 
              background: c.sender === 'user' ? 'linear-gradient(135deg, #4F46E5, #4338CA)' : '#FFFFFF', 
              color: c.sender === 'user' ? '#fff' : '#1E293B',
              padding: '12px 16px', 
              borderRadius: c.sender === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0', 
              maxWidth: '75%', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              fontSize: '0.95rem',
              lineHeight: '1.5',
              whiteSpace: 'pre-line',
              border: c.sender === 'ai' ? '1px solid #E2E8F0' : 'none'
            }}>
              {c.text}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', background: '#E0E7FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={14} color="#4338CA" />
            </div>
            <div style={{ background: '#FFFFFF', padding: '12px 16px', borderRadius: '16px 16px 16px 0', border: '1px solid #E2E8F0', display: 'flex', gap: '4px' }}>
              <div className="typing-dot"></div>
              <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
              <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: '8px', overflowX: 'auto', whiteSpace: 'nowrap' }} className="hide-scrollbar">
        <button onClick={() => handleSend(null, 'आज का कलेक्शन')} style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-bg-indigo-100">💰 आज का कलेक्शन</button>
        <button onClick={() => handleSend(null, 'रद्द टिकट')} style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-bg-red-100">❌ रद्द टिकट</button>
        <button onClick={() => handleSend(null, 'सिक्योरिटी रिपोर्ट')} style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#EA580C', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-bg-orange-100">🚨 सिक्योरिटी रिपोर्ट</button>
        <button onClick={() => handleSend(null, 'एडिट हिस्ट्री')} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-bg-green-100">📝 एडिट हिस्ट्री</button>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} style={{ display: 'flex', padding: '16px 20px', background: '#fff', borderTop: '1px solid #E2E8F0', gap: '12px' }}>
        <input 
          type="text" 
          placeholder="पूछें (जैसे: आज कितना कैश आया?)..." 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          style={{ flex: 1, padding: '12px 16px', borderRadius: '24px', border: '1px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', background: '#F8FAFC' }} 
          onFocus={e => e.target.style.borderColor = '#4338CA'}
          onBlur={e => e.target.style.borderColor = '#CBD5E1'}
        />
        <button 
          type="submit" 
          style={{ background: query.trim() ? '#4F46E5' : '#94A3B8', color: '#fff', border: 'none', width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: query.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s', flexShrink: 0 }}
          disabled={!query.trim()}
        >
          <Send size={18} style={{ marginLeft: '4px' }} />
        </button>
      </form>
      
      <style>{\`
        .typing-dot { width: 6px; height: 6px; background: #94A3B8; border-radius: 50%; animation: typing 1.4s infinite ease-in-out both; }
        @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hover-bg-indigo-100:hover { background: #E0E7FF !important; }
        .hover-bg-red-100:hover { background: #FEE2E2 !important; }
        .hover-bg-orange-100:hover { background: #FFEDD5 !important; }
        .hover-bg-green-100:hover { background: #DCFCE7 !important; }
      \`}</style>
    </div>
  );
};
`;

const startIndex = content.indexOf('const SmartAIAuditor = ({');
const endIndex = content.indexOf('};', startIndex) + 2;

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  content = before + newChatbotComponent + after;
  fs.writeFileSync('c:/Users/sahil/.gemini/antigravity-ide/scratch/mvd_train_ticket_system/frontend/src/App.jsx', content);
  console.log("Updated SmartAIAuditor with awesome UI!");
} else {
  console.log("Could not find SmartAIAuditor component");
}
