import React, { useState } from 'react';
import './user.css';

const API_URL = '';

function UserApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchType, setSearchType] = useState('content');
  const [expanded, setExpanded] = useState(null);

  const runSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      setError('Please enter a search query');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      let res, data;
      
      if (searchType === 'user') {
        res = await fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) throw new Error(`User search failed (${res.status})`);
        data = await res.json();
        setResults(data.results || []);
      } else {
        res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        data = await res.json();
        
        const seen = new Set();
        const unique = (data.results || []).filter(r => {
          const key = r.external_id || r.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setResults(unique);
      }
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getDeepLink = (r) => {
    const sourceType = (r.source_type || r.document_type || '').toLowerCase();
    const eventId = r.external_id;
    
    if (sourceType.includes('nostr') || (eventId && eventId.length === 64)) {
      return { type: 'nostr', url: `https://primal.net/e/${eventId}` };
    }
    
    if (r.url) {
      return { type: 'web', url: r.url };
    }
    
    return null;
  };

  const toggleExpand = (r) => {
    if (expanded?.id === r.id) {
      setExpanded(null);
    } else {
      setExpanded(r);
    }
  };

  return (
    <div className="user-shell">
      <header className="user-header">
        <div>
          <h1>🔦 Beacon Search</h1>
          <p>Semantic search across your knowledge base</p>
        </div>
      </header>

      <form className="user-search" onSubmit={runSearch}>
        <div className="search-controls">
          <div className="search-type-toggle">
            <button
              type="button"
              className={`toggle-btn ${searchType === 'content' ? 'active' : ''}`}
              onClick={() => setSearchType('content')}
            >
              📄 Content
            </button>
            <button
              type="button"
              className={`toggle-btn ${searchType === 'user' ? 'active' : ''}`}
              onClick={() => setSearchType('user')}
            >
              👤 Users
            </button>
          </div>
        </div>
        
        <div className="search-input-wrapper">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchType === 'user' ? 'Search by NIP-05 (name@domain.com) or npub...' : 'Search docs, posts, notes...'}
            autoFocus
          />
        </div>
        <button type="submit" disabled={loading} className="search-btn">
          {loading ? '⏳ Searching...' : '🔍 Search'}
        </button>
      </form>

      {error && (
        <div className="user-error">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {loading && <div className="user-results">Loading...</div>}

      {!loading && results.length > 0 && searchType === 'content' && (
        <div className="user-results">
          {results.map((r) => {
            const isExpanded = expanded?.id === r.id;
            const link = getDeepLink(r);
            
            return (
              <article key={r.external_id || r.id} className="user-result">
                <div onClick={() => toggleExpand(r)} style={{ cursor: 'pointer' }}>
                  <div className="result-header">
                    <h3>{r.title || 'Untitled'}</h3>
                    <span className="score">{((r.score || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <p className="result-snippet">
                    {isExpanded ? r.content : (r.content || '').slice(0, 200) + (r.content?.length > 200 ? '...' : '')}
                  </p>
                  <div className="result-meta">
                    <span>Source: {r.source_name || 'unknown'}</span>
                    {r.author && <span>Author: {r.author.slice(0, 16)}...</span>}
                    {r.external_id && <span title={r.external_id}>Event: {r.external_id.slice(0, 8)}...</span>}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="result-actions">
                    {link && link.type === 'nostr' && (
                      <a href={link.url} target="_blank" rel="noreferrer" className="action-btn primary">
                        🔗 View on Primal →
                      </a>
                    )}
                    {link && link.type === 'web' && (
                      <a href={link.url} target="_blank" rel="noreferrer" className="action-btn primary">
                        🌐 View Source →
                      </a>
                    )}
                    <button onClick={() => setExpanded(null)} className="action-btn secondary">
                      ✕ Collapse
                    </button>
                  </div>
                )}
                
                {!isExpanded && (
                  <button onClick={() => toggleExpand(r)} className="expand-hint">
                    Click to expand ↓
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!loading && results.length > 0 && searchType === 'user' && (
        <div className="user-results">
          {results.map((u) => (
            <article key={u.npub || u.nip05 || u.pubkey} className="user-result">
              <h3>{u.display_name || u.name || 'Anonymous'}</h3>
              {u.nip05 && <p className="user-nip05">✉️ {u.nip05}</p>}
              {u.npub && <p className="user-npub">🔑 {u.npub}</p>}
              {u.about && <p className="result-snippet">{u.about.slice(0, 200)}...</p>}
              <div className="result-meta">
                {u.event_count && <span>📝 {u.event_count} events</span>}
                {u.wot_score && <span>🤝 WoT: {u.wot_score.toFixed(2)}</span>}
              </div>
              {u.profile_url && (
                <a href={u.profile_url} target="_blank" rel="noreferrer" className="action-btn primary">
                  View Profile →
                </a>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="user-empty">
          <h3>No results found</h3>
          <p>Try a different query or switch search type</p>
        </div>
      )}
    </div>
  );
}

export default UserApp;
