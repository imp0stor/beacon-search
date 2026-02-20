import React, { useState, useEffect, useCallback } from 'react';
import './Connectors.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function Connectors({ onClose }) {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConnector, setEditingConnector] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [formType, setFormType] = useState('web');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  
  // Web connector config
  const [seedUrl, setSeedUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(100);
  const [sameDomainOnly, setSameDomainOnly] = useState(true);
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [rateLimit, setRateLimit] = useState(1000);
  
  // Folder connector config
  const [folderPath, setFolderPath] = useState('');
  const [recursive, setRecursive] = useState(true);
  const [fileTypes, setFileTypes] = useState(['.txt', '.md', '.html']);
  const [watchForChanges, setWatchForChanges] = useState(false);

  const fetchConnectors = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/connectors`);
      if (!response.ok) throw new Error('Failed to fetch connectors');
      const data = await response.json();
      setConnectors(data);
      setError(null);
    } catch (err) {
      setError('Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
    // Poll for status updates
    const interval = setInterval(fetchConnectors, 3000);
    return () => clearInterval(interval);
  }, [fetchConnectors]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType('web');
    setSeedUrl('');
    setMaxDepth(2);
    setMaxPages(100);
    setSameDomainOnly(true);
    setRespectRobotsTxt(true);
    setRateLimit(1000);
    setFolderPath('');
    setRecursive(true);
    setFileTypes(['.txt', '.md', '.html']);
    setWatchForChanges(false);
    setEditingConnector(null);
  };

  const buildConfig = () => {
    if (formType === 'web') {
      return {
        type: 'web',
        seedUrl,
        maxDepth: parseInt(maxDepth),
        maxPages: parseInt(maxPages),
        sameDomainOnly,
        respectRobotsTxt,
        rateLimit: parseInt(rateLimit)
      };
    } else if (formType === 'folder') {
      return {
        type: 'folder',
        folderPath,
        recursive,
        fileTypes,
        watchForChanges
      };
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const config = buildConfig();
    if (!config) return;

    const payload = {
      name: formName,
      description: formDescription || null,
      config
    };

    try {
      const url = editingConnector 
        ? `${API_URL}/api/connectors/${editingConnector.id}`
        : `${API_URL}/api/connectors`;
      
      const response = await fetch(url, {
        method: editingConnector ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save connector');
      }

      resetForm();
      setShowAddForm(false);
      fetchConnectors();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (connector) => {
    setEditingConnector(connector);
    setFormName(connector.name);
    setFormDescription(connector.description || '');
    setFormType(connector.config.type);

    if (connector.config.type === 'web') {
      setSeedUrl(connector.config.seedUrl);
      setMaxDepth(connector.config.maxDepth);
      setMaxPages(connector.config.maxPages);
      setSameDomainOnly(connector.config.sameDomainOnly);
      setRespectRobotsTxt(connector.config.respectRobotsTxt);
      setRateLimit(connector.config.rateLimit);
    } else if (connector.config.type === 'folder') {
      setFolderPath(connector.config.folderPath);
      setRecursive(connector.config.recursive);
      setFileTypes(connector.config.fileTypes);
      setWatchForChanges(connector.config.watchForChanges);
    }

    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this connector and all its documents?')) return;

    try {
      const response = await fetch(`${API_URL}/api/connectors/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete connector');
      fetchConnectors();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRun = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/connectors/${id}/run`, {
        method: 'POST'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run connector');
      }
      fetchConnectors();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStop = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/connectors/${id}/stop`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to stop connector');
      fetchConnectors();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleFileType = (ext) => {
    if (fileTypes.includes(ext)) {
      setFileTypes(fileTypes.filter(t => t !== ext));
    } else {
      setFileTypes([...fileTypes, ext]);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'stopped': return '⏹️';
      default: return '⏸️';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'web': return '🌐';
      case 'folder': return '📁';
      case 'sql': return '🗄️';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="connectors-modal">
        <div className="connectors-panel">
          <div className="connectors-loading">Loading connectors...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="connectors-modal">
      <div className="connectors-panel">
        <div className="connectors-header">
          <h2>🔌 Connectors</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="connectors-error">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className="connectors-actions">
          <button 
            className="add-connector-btn"
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Connector'}
          </button>
        </div>

        {showAddForm && (
          <form className="connector-form" onSubmit={handleSubmit}>
            <h3>{editingConnector ? 'Edit Connector' : 'New Connector'}</h3>
            
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My Website Crawler"
                required
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Crawls documentation site"
              />
            </div>

            <div className="form-group">
              <label>Type</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={formType === 'web' ? 'active' : ''}
                  onClick={() => setFormType('web')}
                >
                  🌐 Web Spider
                </button>
                <button
                  type="button"
                  className={formType === 'folder' ? 'active' : ''}
                  onClick={() => setFormType('folder')}
                >
                  📁 Folder
                </button>
              </div>
            </div>

            {formType === 'web' && (
              <>
                <div className="form-group">
                  <label>Seed URL</label>
                  <input
                    type="url"
                    value={seedUrl}
                    onChange={(e) => setSeedUrl(e.target.value)}
                    placeholder="https://docs.example.com"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Max Depth</label>
                    <input
                      type="number"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(e.target.value)}
                      min="0"
                      max="10"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Pages</label>
                    <input
                      type="number"
                      value={maxPages}
                      onChange={(e) => setMaxPages(e.target.value)}
                      min="1"
                      max="10000"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Rate Limit (ms)</label>
                  <input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    min="100"
                    max="60000"
                  />
                  <span className="hint">Delay between requests</span>
                </div>

                <div className="form-checkboxes">
                  <label>
                    <input
                      type="checkbox"
                      checked={sameDomainOnly}
                      onChange={(e) => setSameDomainOnly(e.target.checked)}
                    />
                    Same domain only
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={respectRobotsTxt}
                      onChange={(e) => setRespectRobotsTxt(e.target.checked)}
                    />
                    Respect robots.txt
                  </label>
                </div>
              </>
            )}

            {formType === 'folder' && (
              <>
                <div className="form-group">
                  <label>Folder Path</label>
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="/path/to/documents"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>File Types</label>
                  <div className="file-type-selector">
                    {['.txt', '.md', '.html', '.pdf', '.docx'].map(ext => (
                      <button
                        key={ext}
                        type="button"
                        className={fileTypes.includes(ext) ? 'active' : ''}
                        onClick={() => toggleFileType(ext)}
                      >
                        {ext}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-checkboxes">
                  <label>
                    <input
                      type="checkbox"
                      checked={recursive}
                      onChange={(e) => setRecursive(e.target.checked)}
                    />
                    Recursive (include subfolders)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={watchForChanges}
                      onChange={(e) => setWatchForChanges(e.target.checked)}
                    />
                    Watch for changes
                  </label>
                </div>
              </>
            )}

            <button type="submit" className="submit-btn">
              {editingConnector ? 'Update Connector' : 'Create Connector'}
            </button>
          </form>
        )}

        <div className="connectors-list">
          {connectors.length === 0 ? (
            <div className="no-connectors">
              No connectors yet. Add one to start indexing content!
            </div>
          ) : (
            connectors.map(connector => (
              <div key={connector.id} className="connector-card">
                <div className="connector-header">
                  <span className="connector-type">{getTypeIcon(connector.config.type)}</span>
                  <h3>{connector.name}</h3>
                  <span className="connector-status">
                    {getStatusIcon(connector.currentRun?.status || connector.lastRunStatus)}
                  </span>
                </div>

                {connector.description && (
                  <p className="connector-description">{connector.description}</p>
                )}

                <div className="connector-details">
                  {connector.config.type === 'web' && (
                    <span className="detail">🔗 {connector.config.seedUrl}</span>
                  )}
                  {connector.config.type === 'folder' && (
                    <span className="detail">📂 {connector.config.folderPath}</span>
                  )}
                  <span className="detail">📄 {connector.documentCount || 0} docs</span>
                </div>

                {connector.currentRun && connector.currentRun.status === 'running' && (
                  <div className="connector-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${connector.currentRun.progress || 0}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {connector.currentRun.processedItems || 0} / {connector.currentRun.totalItems || '?'} items
                      {connector.currentRun.currentUrl && (
                        <span className="current-item" title={connector.currentRun.currentUrl}>
                          → {new URL(connector.currentRun.currentUrl).pathname.substring(0, 30)}...
                        </span>
                      )}
                      {connector.currentRun.currentFile && (
                        <span className="current-item" title={connector.currentRun.currentFile}>
                          → {connector.currentRun.currentFile.substring(0, 30)}...
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div className="connector-actions">
                  {connector.currentRun?.status === 'running' ? (
                    <button 
                      className="stop-btn"
                      onClick={() => handleStop(connector.id)}
                    >
                      ⏹️ Stop
                    </button>
                  ) : (
                    <button 
                      className="run-btn"
                      onClick={() => handleRun(connector.id)}
                    >
                      ▶️ Run
                    </button>
                  )}
                  <button 
                    className="edit-btn"
                    onClick={() => handleEdit(connector)}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(connector.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>

                {connector.lastRunAt && (
                  <div className="connector-meta">
                    Last run: {new Date(connector.lastRunAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Connectors;
