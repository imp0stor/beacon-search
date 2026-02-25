import React, { useState } from 'react';
import './user.css';

const API_URL = '';

function UserApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchType, setSearchType] = useState('content'); // 'content' or 'user'

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
        // User search by NIP-05 or npub
        res = await fetch(`${API_URL}/api/search/users?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) throw new Error(`User search failed (${res.status})`);
        data = await res.json();
        setResults(data.results || []);
      } else {
        // Content search
        res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        data = await res.json();
        
        // Deduplicate by external_id (Nostr event ID)
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
          {results.map((r) => (
            <article key={r.external_id || r.id} className="user-result">
              <h3>{r.title || 'Untitled'}</h3>
              <p className="result-snippet">{(r.content || '').slice(0, 200)}...</p>
              <div className="result-meta">
                <span>Score: {((r.score || 0) * 100).toFixed(0)}%</span>
                <span>Source: {r.source_name || 'unknown'}</span>
                {r.author && <span>Author: {r.author.slice(0, 16)}...</span>}
                {r.external_id && <span title={r.external_id}>Event: {r.external_id.slice(0, 8)}...</span>}
              </div>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer">
                  View →
                </a>
              )}
            </article>
          ))}
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
                <a href={u.profile_url} target="_blank" rel="noreferrer">
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
