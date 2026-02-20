/**
 * Nostr Event Card Component
 * Renders different Nostr event types with appropriate templates
 */

import React from 'react';
import './NostrEventCard.css';

const NostrEventCard = ({ document, onClick }) => {
  const { attributes } = document;
  const { kind, kindName, kindCategory, metadata, tags, created_at, pubkey } = attributes || {};

  // Format timestamp
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Truncate pubkey
  const shortPubkey = (pk) => pk ? `${pk.slice(0, 8)}...${pk.slice(-8)}` : '';

  // Render different templates based on kind/category
  const renderContent = () => {
    switch (kindCategory) {
      case 'qa':
        return renderQA();
      case 'kb':
        return renderKB();
      case 'studio':
        return renderStudio();
      case 'podcast':
        return renderPodcast();
      case 'bounty':
        return renderBounty();
      default:
        return renderGeneric();
    }
  };

  // Q&A Template
  const renderQA = () => {
    if (kind === 30400) { // Question
      return (
        <div className="nostr-qa-question">
          <div className="qa-header">
            <span className="qa-vote-score">{metadata?.voteScore || 0}</span>
            <div className="qa-stats">
              {metadata?.bounty && (
                <span className="qa-bounty">⚡ {metadata.bounty} sats</span>
              )}
              {metadata?.answered && <span className="qa-answered">✓ Answered</span>}
            </div>
          </div>
          <h3>{document.title}</h3>
          <p className="content-preview">{document.content?.substring(0, 200)}...</p>
          <div className="tags">
            {tags?.topic?.map((tag, i) => (
              <span key={i} className="tag">#{tag}</span>
            ))}
          </div>
        </div>
      );
    } else if (kind === 6400) { // Answer
      return (
        <div className="nostr-qa-answer">
          <div className="answer-header">
            <span className="vote-score">↑ {metadata?.voteScore || 0}</span>
            {metadata?.accepted && <span className="accepted-badge">✓ Accepted</span>}
          </div>
          <h3>{document.title}</h3>
          <p className="content-preview">{document.content?.substring(0, 200)}...</p>
        </div>
      );
    }
    return renderGeneric();
  };

  // KB Article Template
  const renderKB = () => {
    return (
      <div className="nostr-kb-article">
        <div className="kb-header">
          <span className="doc-type">{metadata?.docType || 'article'}</span>
          {metadata?.version && <span className="version">v{metadata.version}</span>}
        </div>
        <h3>📖 {document.title}</h3>
        {metadata?.summary && (
          <p className="summary">{metadata.summary}</p>
        )}
        <p className="content-preview">{document.content?.substring(0, 200)}...</p>
        {tags?.topic && tags.topic.length > 0 && (
          <div className="tags">
            {tags.topic.map((tag, i) => (
              <span key={i} className="tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Studio Template
  const renderStudio = () => {
    return (
      <div className="nostr-studio">
        <div className="studio-header">
          {metadata?.image && (
            <img src={metadata.image} alt={document.title} className="studio-image" />
          )}
          <div className="studio-info">
            <h3>🎬 {document.title}</h3>
            {metadata?.website && (
              <a href={metadata.website} target="_blank" rel="noopener noreferrer" className="studio-website">
                {metadata.website}
              </a>
            )}
          </div>
        </div>
        <p className="description">{document.content}</p>
      </div>
    );
  };

  // Podcast Template
  const renderPodcast = () => {
    if (kind === 30383) { // Show
      return (
        <div className="nostr-show">
          <div className="show-header">
            {metadata?.image && (
              <img src={metadata.image} alt={document.title} className="show-image" />
            )}
            <div className="show-info">
              <h3>🎙️ {document.title}</h3>
              {metadata?.value4value && <span className="v4v-badge">⚡ V4V</span>}
            </div>
          </div>
          <p className="description">{document.content}</p>
        </div>
      );
    } else if (kind === 30384) { // Episode
      return (
        <div className="nostr-episode">
          <div className="episode-header">
            {metadata?.image && (
              <img src={metadata.image} alt={document.title} className="episode-image" />
            )}
            <div className="episode-info">
              <h3>🎧 {document.title}</h3>
              {metadata?.duration && (
                <span className="duration">{formatDuration(metadata.duration)}</span>
              )}
              {metadata?.publishedAt && (
                <span className="published">{formatDate(metadata.publishedAt)}</span>
              )}
            </div>
          </div>
          <p className="description">{document.content}</p>
          {metadata?.chapters && metadata.chapters.length > 0 && (
            <div className="chapters">
              <strong>Chapters:</strong>
              <ul>
                {metadata.chapters.slice(0, 3).map((ch, i) => (
                  <li key={i}>
                    {formatTimestamp(ch.timestamp)} - {ch.title}
                  </li>
                ))}
                {metadata.chapters.length > 3 && <li>...and {metadata.chapters.length - 3} more</li>}
              </ul>
            </div>
          )}
        </div>
      );
    }
    return renderGeneric();
  };

  // Bounty Template
  const renderBounty = () => {
    if (kind === 37100) { // Bounty
      return (
        <div className="nostr-bounty">
          <div className="bounty-header">
            <span className="bounty-amount">🎯 {metadata?.amount ? `${metadata.amount} sats` : 'Open Bounty'}</span>
            <span className={`bounty-status status-${metadata?.status}`}>{metadata?.status || 'open'}</span>
          </div>
          <h3>{document.title}</h3>
          <p className="content-preview">{document.content?.substring(0, 200)}...</p>
          {metadata?.expiry && (
            <div className="expiry">
              Expires: {formatDate(metadata.expiry)}
            </div>
          )}
        </div>
      );
    }
    return renderGeneric();
  };

  // Generic fallback
  const renderGeneric = () => {
    return (
      <div className="nostr-generic">
        <h3>{document.title}</h3>
        <p className="content-preview">{document.content?.substring(0, 200)}...</p>
      </div>
    );
  };

  // Helper functions
  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatTimestamp = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="nostr-event-card" onClick={onClick}>
      <div className="nostr-card-header">
        <span className="kind-badge">{kindName || `Kind ${kind}`}</span>
        <span className="timestamp">{formatDate(created_at)}</span>
      </div>
      
      {renderContent()}
      
      <div className="nostr-card-footer">
        <span className="author">by {shortPubkey(pubkey)}</span>
        {document.url && (
          <a 
            href={document.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="nostr-link"
          >
            View on Nostr →
          </a>
        )}
      </div>
    </div>
  );
};

export default NostrEventCard;
