import React, { useState } from 'react';
import './user.css';

const API_URL = '';

function UserApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setResults(data.results || []);
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
        <div className="search-input-wrapper">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs, posts, notes..."
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

      {!loading && results.length > 0 && (
        <div className="user-results">
          {results.map((r) => (
            <article key={r.id} className="user-result">
              <h3>{r.title || 'Untitled'}</h3>
              <p className="result-snippet">{(r.content || '').slice(0, 200)}...</p>
              <div className="result-meta">
                <span>Score: {((r.score || 0) * 100).toFixed(0)}%</span>
                <span>Source: {r.source_name || 'unknown'}</span>
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

      {!loading && results.length === 0 && query && (
        <div className="user-empty">
          <h3>No results found</h3>
          <p>Try a different query</p>
        </div>
      )}
    </div>
  );
}

export default UserApp;
