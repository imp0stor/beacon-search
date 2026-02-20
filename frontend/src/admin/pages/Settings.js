import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchSettings, 
  updateSettings, 
  fetchGitConfig, 
  syncGitConfig 
} from '../utils/api';

function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    placeholderData: {
      general: { siteName: 'Beacon Search', language: 'en' },
      ai: { model: 'llama3', temperature: 0.7, ragParams: { topK: 5 } },
      pipeline: { nlpEnabled: true, embeddingsEnabled: true },
    }
  });

  const { data: gitConfig } = useQuery({
    queryKey: ['git-config'],
    queryFn: fetchGitConfig,
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
      alert('Settings saved');
    },
  });

  const gitSyncMutation = useMutation({
    mutationFn: syncGitConfig,
    onSuccess: () => alert('Git sync complete'),
  });

  if (isLoading) return <div className="admin-loading"><div className="admin-spinner"></div></div>;

  return (
    <div className="admin-settings">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Settings</h1>
        <p className="admin-page-subtitle">Configure system behavior and integration parameters</p>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>General</button>
        <button className={`admin-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI & RAG</button>
        <button className={`admin-tab ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>Pipeline</button>
        <button className={`admin-tab ${activeTab === 'git' ? 'active' : ''}`} onClick={() => setActiveTab('git')}>Git Config</button>
      </div>

      <div className="admin-card">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="admin-form-group">
              <label className="admin-label">Site Name</label>
              <input type="text" className="admin-input" defaultValue={settings.general.siteName} />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Default Language</label>
              <select className="admin-select" defaultValue={settings.general.language}>
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="admin-form-group">
              <label className="admin-label">Ollama Model</label>
              <input type="text" className="admin-input" defaultValue={settings.ai.model} />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Temperature ({settings.ai.temperature})</label>
              <input type="range" min="0" max="1" step="0.1" className="w-full" defaultValue={settings.ai.temperature} />
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
              <span>NLP Processing Pipeline</span>
              <label className="admin-toggle">
                <input type="checkbox" defaultChecked={settings.pipeline.nlpEnabled} />
                <span className="admin-toggle-slider"></span>
              </label>
            </div>
            <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
              <span>Vector Embeddings</span>
              <label className="admin-toggle">
                <input type="checkbox" defaultChecked={settings.pipeline.embeddingsEnabled} />
                <span className="admin-toggle-slider"></span>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'git' && (
          <div className="space-y-4">
            <div className="p-4 bg-dark-900 rounded border border-dark-600">
              <div className="text-sm font-mono">{gitConfig?.repoUrl || 'git@github.com:org/beacon-config.git'}</div>
              <div className="text-xs text-muted mt-1">Status: {gitConfig?.status || 'Clean'}</div>
            </div>
            <button className="admin-btn admin-btn-secondary" onClick={() => gitSyncMutation.mutate()}>
              Sync with Git Repository
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-dark-600 flex justify-end">
          <button className="admin-btn admin-btn-primary" onClick={() => updateMutation.mutate(settings)}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
