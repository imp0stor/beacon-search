import React, { useState, useEffect, useRef } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const WizardPanel = ({ initialTemplate }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef();

  useEffect(() => {
    const startSession = async () => {
      const res = await fetch(`${API_URL}/api/wizard/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: initialTemplate?.id })
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages([{ role: 'assistant', content: data.message }]);
    };
    startSession();
  }, [initialTemplate]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/wizard/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to connect to wizard." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard-panel">
      <div className="wizard-header">
        <h3>AI Configuration Assistant</h3>
        {initialTemplate && <span>Integrating {initialTemplate.name}</span>}
      </div>
      <div className="wizard-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="message-content">{m.content}</div>
          </div>
        ))}
        {loading && <div className="message assistant">Typing...</div>}
      </div>
      <form className="wizard-input" onSubmit={sendMessage}>
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="Type your configuration details..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default WizardPanel;
