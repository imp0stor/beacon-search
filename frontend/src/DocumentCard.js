import React, { useState, useEffect, useRef } from 'react';
import './DocumentCard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Source system icons and colors
const SOURCE_STYLES = {
  confluence: { icon: '📘', color: '#0052CC', name: 'Confluence' },
  notion: { icon: '📝', color: '#000000', name: 'Notion' },
  sharepoint: { icon: '📂', color: '#0078D4', name: 'SharePoint' },
  github: { icon: '🐙', color: '#24292E', name: 'GitHub' },
  google_drive: { icon: '📁', color: '#4285F4', name: 'Google Drive' },
  dropbox: { icon: '💧', color: '#0061FF', name: 'Dropbox' },
  jira: { icon: '🎫', color: '#0052CC', name: 'Jira' },
  slack: { icon: '💬', color: '#4A154B', name: 'Slack' },
  web: { icon: '🌐', color: '#6B7280', name: 'Web' },
  folder: { icon: '📁', color: '#6B7280', name: 'Local' },
  unknown: { icon: '📄', color: '#9CA3AF', name: 'Unknown' }
};

/**
 * SourceBadge - Shows the source system icon and name
 */
export function SourceBadge({ sourceSystem, connectorName, size = 'small' }) {
  const style = SOURCE_STYLES[sourceSystem?.type] || SOURCE_STYLES.unknown;
  
  return (
    <span 
      className={`source-badge source-badge-${size}`}
      style={{ '--source-color': style.color }}
      title={connectorName || style.name}
    >
      <span className="source-badge-icon">{style.icon}</span>
      {size !== 'small' && (
        <span className="source-badge-name">{connectorName || style.name}</span>
      )}
    </span>
  );
}

/**
 * SourceActions - Context menu / button group for source actions
 */
export function SourceActions({ documentId, query, onAction }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Fetch actions when component mounts or documentId changes
  useEffect(() => {
    if (!documentId) return;
    
    const fetchActions = async () => {
      setLoading(true);
      try {
        const url = query 
          ? `${API_URL}/api/documents/${documentId}/actions?q=${encodeURIComponent(query)}`
          : `${API_URL}/api/documents/${documentId}/actions`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setActions(data);
        }
      } catch (err) {
        console.error('Failed to fetch source actions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [documentId, query]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || actions.length === 0) {
    return null;
  }

  const primaryAction = actions.find(a => a.primary);
  const secondaryActions = actions.filter(a => !a.primary);

  const handleAction = (action, e) => {
    e.stopPropagation();
    if (onAction) {
      onAction(action);
    }
    window.open(action.url, '_blank', 'noopener,noreferrer');
    setShowMenu(false);
  };

  return (
    <div className="source-actions" ref={menuRef}>
      {/* Primary action button */}
      {primaryAction && (
        <button 
          className="source-action-btn primary"
          onClick={(e) => handleAction(primaryAction, e)}
          title={primaryAction.label}
        >
          <span className="action-icon">{primaryAction.icon}</span>
          <span className="action-label">Open in Source</span>
        </button>
      )}

      {/* Secondary actions dropdown */}
      {secondaryActions.length > 0 && (
        <div className="source-actions-dropdown">
          <button 
            className="source-action-btn secondary"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            title="More actions"
          >
            ⋮
          </button>
          
          {showMenu && (
            <div className="source-actions-menu">
              {secondaryActions.map((action, i) => (
                <button
                  key={i}
                  className="source-action-menu-item"
                  onClick={(e) => handleAction(action, e)}
                >
                  <span className="action-icon">{action.icon}</span>
                  <span className="action-label">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DocumentCard - Enhanced document card with source integration
 */
function DocumentCard({ 
  document, 
  onClick, 
  onFavorite, 
  isFavorite = false,
  showSourceActions = true,
  compact = false 
}) {
  const [sourceInfo, setSourceInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch source info when document has a source_id
  useEffect(() => {
    if (!document?.id || !document?.source_id) return;

    const fetchSourceInfo = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/documents/${document.id}/source-info`);
        if (response.ok) {
          const data = await response.json();
          setSourceInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch source info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSourceInfo();
  }, [document?.id, document?.source_id]);

  const handleClick = (e) => {
    if (onClick) onClick(document, e);
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    if (onFavorite) onFavorite(document.id, e);
  };

  const snippet = (document.content || '').slice(0, compact ? 100 : 200);
  const hasMoreContent = (document.content || '').length > (compact ? 100 : 200);

  return (
    <div 
      className={`document-card ${compact ? 'compact' : ''} ${isFavorite ? 'favorite' : ''}`}
      onClick={handleClick}
    >
      {/* Header with title and source badge */}
      <div className="document-card-header">
        <div className="document-card-title-row">
          {sourceInfo && (
            <SourceBadge 
              sourceSystem={sourceInfo.sourceSystem}
              connectorName={sourceInfo.connectorName}
              size={compact ? 'small' : 'medium'}
            />
          )}
          <h3 className="document-card-title">{document.title}</h3>
        </div>
        
        <div className="document-card-actions">
          {onFavorite && (
            <button 
              className={`favorite-btn ${isFavorite ? 'active' : ''}`}
              onClick={handleFavorite}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>

      {/* URL display */}
      {document.url && !compact && (
        <a 
          href={document.url} 
          className="document-card-url"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {document.url}
        </a>
      )}

      {/* Content snippet */}
      <p className="document-card-snippet">
        {snippet}{hasMoreContent && '...'}
      </p>

      {/* Footer with metadata and source actions */}
      <div className="document-card-footer">
        <div className="document-card-meta">
          {document.created_at && (
            <span className="meta-date">
              {new Date(document.created_at).toLocaleDateString()}
            </span>
          )}
          {document.score !== undefined && (
            <span className="meta-score">
              {Math.round(document.score * 100)}% match
            </span>
          )}
          {document.type && (
            <span className="meta-type">{document.type}</span>
          )}
        </div>

        {/* Source action buttons */}
        {showSourceActions && document.id && (
          <SourceActions 
            documentId={document.id}
            query={document.title}
          />
        )}
      </div>
    </div>
  );
}

export default DocumentCard;
