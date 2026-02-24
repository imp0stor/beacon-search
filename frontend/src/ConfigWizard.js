import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ConfigWizard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// BMAD Phase definitions
const PHASES = [
  { id: 'analysis', name: 'Analysis', icon: '📋', description: 'Understanding your needs' },
  { id: 'planning', name: 'Planning', icon: '🎯', description: 'Designing the solution' },
  { id: 'build', name: 'Build', icon: '🔨', description: 'Creating configuration' },
  { id: 'measure', name: 'Measure', icon: '📊', description: 'Verifying success' },
  { id: 'iterate', name: 'Iterate', icon: '🔄', description: 'Refining setup' }
];

// Quick action suggestions per phase
const QUICK_ACTIONS = {
  analysis: ['Our support documentation', 'Company wiki pages', 'Customer knowledge base', 'Internal file share'],
  planning: ['Approve plan', 'Adjust field mappings', 'Change rate limits', 'Review access control'],
  build: ['Validate config', 'Test connection', 'Save configuration'],
  measure: ['Check status', 'Test search query', 'Generate report'],
  iterate: ['Apply improvement 1', 'Re-run sync', 'Finish wizard']
};

function ConfigWizard() {
  // Session state
  const [session, setSession] = useState(null);
  const [integrationName, setIntegrationName] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentPhase, setCurrentPhase] = useState('analysis');
  const [progress, setProgress] = useState({ percent: 0, steps: [] });
  
  // UI state
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState({ title: '', content: '' });
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after loading
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  // Start a new wizard session
  const startSession = async (e) => {
    e.preventDefault();
    if (!integrationName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/wizard/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationName: integrationName.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      setSession(data);
      setMessages(data.messages || []);
      setCurrentPhase(data.phase || 'analysis');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message to the wizard
  const sendMessage = useCallback(async (messageText) => {
    if (!session || !messageText.trim()) return;

    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      phase: currentPhase
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/wizard/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          message: messageText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Update state from response
      if (data.response) {
        setMessages(prev => [...prev, data.response]);
      }
      if (data.phase) {
        setCurrentPhase(data.phase);
      }
      if (data.progress) {
        setProgress(data.progress);
      }
    } catch (err) {
      setError(err.message);
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${err.message}\n\nPlease try again.`,
        timestamp: new Date(),
        phase: currentPhase
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [session, currentPhase]);

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Handle quick action click
  const handleQuickAction = (action) => {
    sendMessage(action);
  };

  // Handle input key press (Enter to send)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Reset wizard
  const resetWizard = () => {
    setSession(null);
    setMessages([]);
    setIntegrationName('');
    setCurrentPhase('analysis');
    setProgress({ percent: 0, steps: [] });
    setError(null);
  };

  // Open artifact preview
  const openPreview = async (artifactPath) => {
    setPreviewContent({ title: artifactPath, content: 'Loading...' });
    setPreviewOpen(true);
    
    // In a real implementation, fetch the artifact content
    // For now, show a placeholder
    setPreviewContent({
      title: artifactPath,
      content: `# ${artifactPath}\n\n*Artifact preview would load here*\n\nThis file was generated by the BMAD wizard.`
    });
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get phase index
  const getPhaseIndex = (phase) => PHASES.findIndex(p => p.id === phase);

  // Render start screen
  if (!session) {
    return (
      <div className="config-wizard">
        <div className="wizard-start-screen">
          <div className="start-icon">🧙</div>
          <h1 className="start-title">BMAD Config Wizard</h1>
          <p className="start-subtitle">
            I'll guide you through setting up a new integration using the BMAD methodology.
            Let's build something great together!
          </p>
          
          <form className="start-form" onSubmit={startSession}>
            <input
              type="text"
              className="start-input"
              placeholder="Name your integration (e.g., company-sharepoint)"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <button 
              type="submit" 
              className="start-button"
              disabled={!integrationName.trim() || isLoading}
            >
              {isLoading ? 'Starting...' : 'Start Wizard →'}
            </button>
          </form>

          {error && (
            <p style={{ color: '#ff5252', marginTop: '1rem' }}>
              {error}
            </p>
          )}

          <div className="start-features">
            {PHASES.map(phase => (
              <div key={phase.id} className="feature-card">
                <div className="feature-icon">{phase.icon}</div>
                <h3 className="feature-title">{phase.name}</h3>
                <p className="feature-desc">{phase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render main wizard interface
  return (
    <div className="config-wizard">
      {/* Header */}
      <header className="wizard-header">
        <div className="wizard-title">
          <span className="wizard-icon">🧙</span>
          <div>
            <h1>BMAD Config Wizard</h1>
            <p className="wizard-integration-name">{session.integrationName}</p>
          </div>
        </div>
        <div className="wizard-actions">
          <button onClick={() => window.history.back()}>← Back</button>
          <button onClick={resetWizard}>Start Over</button>
        </div>
      </header>

      {/* Phase Tracker */}
      <div className="phase-tracker">
        {PHASES.map((phase, index) => {
          const currentIndex = getPhaseIndex(currentPhase);
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          
          return (
            <React.Fragment key={phase.id}>
              <div className={`phase-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                <div className="phase-icon">{isCompleted ? '✓' : phase.icon}</div>
                <span className="phase-label">{phase.name}</span>
              </div>
              {index < PHASES.length - 1 && (
                <div className={`phase-connector ${isCompleted ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Chat Container */}
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-header">
                <div className="message-avatar">
                  {message.role === 'assistant' ? '🧙' : '👤'}
                </div>
                <span className="message-sender">
                  {message.role === 'assistant' ? 'BMAD Wizard' : 'You'}
                </span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div className="message-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
                {message.artifacts && message.artifacts.length > 0 && (
                  <div className="message-artifacts">
                    <h4>Generated Artifacts</h4>
                    {message.artifacts.map((artifact, i) => (
                      <button
                        key={i}
                        className="artifact-link"
                        onClick={() => openPreview(artifact)}
                      >
                        📄 {artifact.split('/').pop()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="typing-indicator">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <form onSubmit={handleSubmit} className="chat-input-container">
            <div className="chat-input-wrapper">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Type your response..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                rows={1}
              />
            </div>
            <button
              type="submit"
              className="send-button"
              disabled={!inputValue.trim() || isLoading}
              title="Send message"
            >
              ➤
            </button>
          </form>
          
          {/* Quick Actions */}
          <div className="quick-actions">
            {(QUICK_ACTIONS[currentPhase] || []).map((action, i) => (
              <button
                key={i}
                className="quick-action"
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Document Preview Sidebar */}
      <div className={`document-preview ${previewOpen ? 'open' : ''}`}>
        <div className="preview-header">
          <h3 className="preview-title">{previewContent.title}</h3>
          <button className="preview-close" onClick={() => setPreviewOpen(false)}>
            ✕
          </button>
        </div>
        <div className="preview-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {previewContent.content}
          </ReactMarkdown>
        </div>
      </div>

      {error && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 82, 82, 0.9)',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          zIndex: 1000
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default ConfigWizard;
