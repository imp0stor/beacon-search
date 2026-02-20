import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchSources,
  fetchSource,
  createSource,
  updateSource,
  deleteSource,
  testSourceConnection,
  triggerSourceSync,
  fetchSourceSyncHistory,
  fetchSourceSampleDocs,
} from '../utils/api';

const SOURCE_TYPES = [
  { id: 'web', name: 'Web Crawler', icon: '🌐', description: 'Crawl websites and extract content' },
  { id: 'rss', name: 'RSS Feed', icon: '📡', description: 'Subscribe to RSS/Atom feeds' },
  { id: 'file', name: 'File System', icon: '📁', description: 'Index local files and directories' },
  { id: 'git', name: 'Git Repository', icon: '📂', description: 'Index code from Git repos' },
  { id: 'notion', name: 'Notion', icon: '📝', description: 'Sync Notion workspaces' },
  { id: 's3', name: 'S3 Bucket', icon: '☁️', description: 'Index files from AWS S3' },
  { id: 'api', name: 'REST API', icon: '🔌', description: 'Fetch data from REST endpoints' },
  { id: 'database', name: 'Database', icon: '🗄️', description: 'Index data from SQL databases' },
];

function SourcesManagement() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [editingSource, setEditingSource] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list | detail | history | samples
  const [testResult, setTestResult] = useState(null);

  // Fetch sources list
  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
    placeholderData: [],
  });

  // Fetch single source if viewing detail
  const { data: sourceDetail } = useQuery({
    queryKey: ['source', sourceId],
    queryFn: () => fetchSource(sourceId),
    enabled: !!sourceId,
  });

  // Fetch sync history
  const { data: syncHistory } = useQuery({
    queryKey: ['source-history', sourceId],
    queryFn: () => fetchSourceSyncHistory(sourceId),
    enabled: !!sourceId && viewMode === 'history',
    placeholderData: [],
  });

  // Fetch sample docs
  const { data: sampleDocs } = useQuery({
    queryKey: ['source-samples', sourceId],
    queryFn: () => fetchSourceSampleDocs(sourceId),
    enabled: !!sourceId && viewMode === 'samples',
    placeholderData: [],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      setShowAddModal(false);
      setSelectedType(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateSource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      queryClient.invalidateQueries(['source', sourceId]);
      setEditingSource(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      navigate('/admin/sources');
    },
  });

  const testMutation = useMutation({
    mutationFn: testSourceConnection,
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ success: false, error: err.message }),
  });

  const syncMutation = useMutation({
    mutationFn: triggerSourceSync,
    onSuccess: () => {
      queryClient.invalidateQueries(['sources']);
      alert('Sync triggered successfully');
    },
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'active';
      case 'syncing': return 'syncing';
      case 'error': return 'error';
      case 'disabled': return 'disabled';
      default: return 'inactive';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  // Source Form Component
  const SourceForm = ({ source, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState(source || {
      name: '',
      type: selectedType?.id || '',
      config: {},
      enabled: true,
      schedule: '0 */6 * * *', // Every 6 hours
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      onSubmit(formData);
    };

    const typeConfig = SOURCE_TYPES.find(t => t.id === formData.type);

    return (
      <form onSubmit={handleSubmit}>
        <div className="admin-form-group">
          <label className="admin-label">Source Name</label>
          <input
            type="text"
            className="admin-input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Web Source"
            required
          />
        </div>

        {!source && (
          <div className="admin-form-group">
            <label className="admin-label">Source Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {SOURCE_TYPES.map(type => (
                <div
                  key={type.id}
                  onClick={() => setFormData({ ...formData, type: type.id })}
                  style={{
                    padding: '0.75rem',
                    background: formData.type === type.id ? 'rgba(99, 102, 241, 0.2)' : 'var(--admin-bg-tertiary)',
                    border: `1px solid ${formData.type === type.id ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{type.icon}</div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{type.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type-specific config fields */}
        {formData.type === 'web' && (
          <>
            <div className="admin-form-group">
              <label className="admin-label">Start URL</label>
              <input
                type="url"
                className="admin-input"
                value={formData.config.startUrl || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  config: { ...formData.config, startUrl: e.target.value }
                })}
                placeholder="https://example.com"
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Max Depth</label>
              <input
                type="number"
                className="admin-input"
                value={formData.config.maxDepth || 3}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  config: { ...formData.config, maxDepth: parseInt(e.target.value) }
                })}
                min={1}
                max={10}
              />
            </div>
          </>
        )}

        {formData.type === 'rss' && (
          <div className="admin-form-group">
            <label className="admin-label">Feed URL</label>
            <input
              type="url"
              className="admin-input"
              value={formData.config.feedUrl || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                config: { ...formData.config, feedUrl: e.target.value }
              })}
              placeholder="https://example.com/feed.xml"
            />
          </div>
        )}

        {formData.type === 'file' && (
          <div className="admin-form-group">
            <label className="admin-label">Directory Path</label>
            <input
              type="text"
              className="admin-input"
              value={formData.config.path || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                config: { ...formData.config, path: e.target.value }
              })}
              placeholder="/path/to/documents"
            />
          </div>
        )}

        {formData.type === 'git' && (
          <>
            <div className="admin-form-group">
              <label className="admin-label">Repository URL</label>
              <input
                type="url"
                className="admin-input"
                value={formData.config.repoUrl || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  config: { ...formData.config, repoUrl: e.target.value }
                })}
                placeholder="https://github.com/user/repo"
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Branch</label>
              <input
                type="text"
                className="admin-input"
                value={formData.config.branch || 'main'}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  config: { ...formData.config, branch: e.target.value }
                })}
              />
            </div>
          </>
        )}

        <div className="admin-form-group">
          <label className="admin-label">Sync Schedule (Cron)</label>
          <input
            type="text"
            className="admin-input"
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            placeholder="0 */6 * * *"
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
            Examples: "0 */6 * * *" (every 6 hours), "0 0 * * *" (daily at midnight)
          </div>
        </div>

        <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            />
            <span className="admin-toggle-slider"></span>
          </label>
          <span style={{ fontSize: '0.875rem' }}>Enable automatic syncing</span>
        </div>

        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', margin: '1rem 0 0', borderTop: '1px solid var(--admin-border)' }}>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="admin-btn admin-btn-primary">
            {source ? 'Save Changes' : 'Create Source'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="sources-management">
      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">Sources</h1>
          <p className="admin-page-subtitle">
            Manage data connectors and sync schedules
          </p>
        </div>
        <button 
          className="admin-btn admin-btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <span>➕</span> Add Source
        </button>
      </div>

      {/* Sources List */}
      {isLoading ? (
        <div className="admin-loading">
          <div className="admin-spinner"></div>
        </div>
      ) : sources?.length === 0 ? (
        <div className="admin-card">
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">🔌</div>
            <div className="admin-empty-state-text">No sources configured yet</div>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              Add Your First Source
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th>Last Sync</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(source => {
                  const typeInfo = SOURCE_TYPES.find(t => t.id === source.type);
                  return (
                    <tr key={source.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{source.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          {source.config?.startUrl || source.config?.feedUrl || source.config?.path || ''}
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {typeInfo?.icon} {typeInfo?.name}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusColor(source.status)}`}>
                          {source.status === 'syncing' && '⟳ '}
                          {source.status}
                        </span>
                      </td>
                      <td>{source.documentCount || 0}</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                        {formatDate(source.lastSync)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => syncMutation.mutate(source.id)}
                            disabled={syncMutation.isPending || source.status === 'syncing'}
                            title="Trigger sync"
                          >
                            🔄
                          </button>
                          <button
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => testMutation.mutate(source.id)}
                            title="Test connection"
                          >
                            🧪
                          </button>
                          <button
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => {
                              setEditingSource(source);
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => {
                              if (window.confirm(`Delete source "${source.name}"?`)) {
                                deleteMutation.mutate(source.id);
                              }
                            }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Add New Source</h3>
              <button className="admin-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="admin-modal-body">
              <SourceForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setShowAddModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Source Modal */}
      {editingSource && (
        <div className="admin-modal-overlay" onClick={() => setEditingSource(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Edit Source</h3>
              <button className="admin-modal-close" onClick={() => setEditingSource(null)}>×</button>
            </div>
            <div className="admin-modal-body">
              <SourceForm
                source={editingSource}
                onSubmit={(data) => updateMutation.mutate({ id: editingSource.id, data })}
                onCancel={() => setEditingSource(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Test Result Modal */}
      {testResult && (
        <div className="admin-modal-overlay" onClick={() => setTestResult(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Connection Test</h3>
              <button className="admin-modal-close" onClick={() => setTestResult(null)}>×</button>
            </div>
            <div className="admin-modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {testResult.success ? '✅' : '❌'}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
              </div>
              {testResult.error && (
                <div style={{ color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
                  {testResult.error}
                </div>
              )}
              {testResult.details && (
                <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginTop: '0.5rem' }}>
                  {testResult.details}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SourcesManagement;
