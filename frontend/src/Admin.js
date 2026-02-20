import React, { useState, useEffect } from 'react';
import './Admin.css';
import IntegrationCatalog from './components/IntegrationCatalog';
import WizardPanel from './components/WizardPanel';
import GitHistory from './components/GitHistory';
import ConfigEditor from './components/ConfigEditor';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [wizardSession, setWizardSession] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);

  useEffect(() => {
    fetchGitStatus();
  }, []);

  const fetchGitStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config/status`);
      const data = await res.json();
      setGitStatus(data);
    } catch (err) {
      console.error('Failed to fetch git status', err);
    }
  };

  const startWizard = (template) => {
    setSelectedTemplate(template);
    setActiveTab('wizard');
  };

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <div className="admin-logo">Beacon Admin</div>
        <button 
          className={activeTab === 'catalog' ? 'active' : ''} 
          onClick={() => setActiveTab('catalog')}
        >
          🧩 Integrations
        </button>
        <button 
          className={activeTab === 'wizard' ? 'active' : ''} 
          onClick={() => setActiveTab('wizard')}
        >
          🪄 AI Wizard
        </button>
        <button 
          className={activeTab === 'configs' ? 'active' : ''} 
          onClick={() => setActiveTab('configs')}
        >
          📝 Configs
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          git_branch History
        </button>
        
        <div className="git-indicator">
          {gitStatus?.initialized ? (
            <span className="clean">● {gitStatus.branch}</span>
          ) : (
            <span className="error">● Git Uninitialized</span>
          )}
        </div>
      </nav>

      <main className="admin-main">
        {activeTab === 'catalog' && (
          <IntegrationCatalog onSelect={startWizard} />
        )}
        {activeTab === 'wizard' && (
          <WizardPanel 
            initialTemplate={selectedTemplate} 
            onComplete={() => setActiveTab('configs')} 
          />
        )}
        {activeTab === 'configs' && (
          <ConfigEditor />
        )}
        {activeTab === 'history' && (
          <GitHistory />
        )}
      </main>
    </div>
  );
};

export default Admin;
