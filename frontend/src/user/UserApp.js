import React, { useMemo, useState, useEffect } from 'react';
import './user.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const EXAMPLE_QUERIES = [
  'nostr protocol',
  'bitcoin lightning',
  'web of trust',
  'identity verification'
];

const deepLinkFor = (r) => {
  const sourceType = (r.source_type || r.document_type || '').toLowerCase();
  const eventId = r.external_id || r.attributes?.event_id;

  if (sourceType.includes('nostr') || eventId?.length === 64) {
    return `https://primal.net/e/${eventId || r.id}`;
  }

  return r.url || r.attributes?.source_url || null;
};

function UserApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState(null);
  const pageSize = 20;

  useEffect(() => {
    // Load stats on mount
    fetch(`${API_URL}/api/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Keyboard shortcut: Cmd+K or Ctrl+K to focus search
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.user-search input')?.focus();
      }
      if (e.key === 'Escape' && selected) {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected]);

  const runSearch = async (e, pageOverride = 0) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const q = query.trim();
      if (!q && pageOverride === 0) {
        setError('Please enter a search query');
        setLoading(false);
        return;
      }
      const offset = pageOverride * pageSize;
      const url = q
        ? `${API_URL}/api/search?q=${encodeURIComponent(q)}&limit=${pageSize}&offset=${offset}&mode=hybrid&explain=true`
        : `${API_URL}/api/documents?limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
      const data = await res.json();
      const incoming = Array.isArray(data) ? data : (data.results || []);
      setResults(incoming);
      setHasSearched(true);
      setPage(pageOverride);
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tryExample = (exampleQuery) => {
    setQuery(exampleQuery);
    setHasSearched(false);
  };

  const canNext = results.length === pageSize;
  const canPrev = page > 0;

  const role = localStorage.getItem('beacon_role');
  const navLabel = role === 'admin' ? '⚙️ Admin' : '🔍 Search';

  const selectedLink = useMemo(() => (selected ? deepLinkFor(selected) : null), [selected]);

  return (
    <div className="user-shell">
      <header className="user-header">
        <div>
          <h1>🔦 Beacon Search</h1>
          <p>Semantic search across your knowledge base</p>
          {stats && (
            <div className="stats-pills">
              <span className="stat-pill">{stats.totalDocuments || 0} documents</span>
              <span className="stat-pill">{stats.sources || 0} sources</span>
            </div>
          )}
        </div>
        <a className="pill-nav" href={role === 'admin' ? '/admin' : '/search'}>{navLabel}</a>
      </header>

      <form className="user-search" onSubmit={runSearch}>
        <div className="search-input-wrapper">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs, posts, notes... (⌘K)"
            autoFocus
          />
          {query && (
            <button 
              type="button" 
              className="clear-btn" 
              onClick={() => setQuery('')}
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>
        <button type="submit" disabled={loading} className="search-btn">
          {loading ? '⏳ Searching...' : '🔍 Search'}
        </button>
      </form>

      {!hasSearched && !loading && (
        <div className="hero-section">
          <h2>Try searching for:</h2>
          <div className="example-queries">
            {EXAMPLE_QUERIES.map(ex => (
              <button
                key={ex}
                className="example-chip"
                onClick={() => tryExample(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="hint">💡 Beacon uses semantic search + keywords for best results</p>
        </div>
      )}

      {error && (
        <div className="user-error">
          <strong>⚠️ Error:</strong> {error}
          <button onClick={(e) => runSearch(e, page)}>↻ Retry</button>
        </div>
      )}

      {loading && (
        <div className="user-results">
          {[1, 2, 3].map(i => (
            <div key={i} className="result-skeleton">
              <div className="skeleton-title"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-text short"></div>
              <div className="skeleton-meta"></div>
            </div>
          ))}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="user-empty">
          <div className="empty-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try a different query, or ask an admin to ingest more sources.</p>
          {query && (
            <button onClick={() => { setQuery(''); setHasSearched(false); }}>
              ← Back to examples
            </button>
          )}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="results-header">
            <span className="result-count">
              {results.length} result{results.length !== 1 ? 's' : ''} {page > 0 && `(page ${page + 1})`}
            </span>
          </div>

          <div className="user-results">
            {results.map((r) => {
              const link = deepLinkFor(r);
              const snippet = (r.content || '').slice(0, 200);
              const whyMatched = r.match_reason || (r.score > 0.8 ? 'strong semantic + keyword match' : 'semantic relevance');
              const sourceLabel = r.source_name || r.attributes?.source_name || r.source_id || 'manual';
              const author = r.author || r.attributes?.author;
              const authorShort = author ? (author.length > 16 ? author.slice(0, 16) + '...' : author) : 'unknown';

              return (
                <article 
                  key={r.id} 
                  className="user-result" 
                  onClick={() => setSelected(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(r)}
                >
                  <div className="result-header">
                    <h3>{r.title || 'Untitled'}</h3>
                    <span className="score" title={`Relevance: ${Number(r.score || 0).toFixed(3)}`}>
                      {(Number(r.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="result-snippet">{snippet}{(r.content || '').length > 200 ? '…' : ''}</p>
                  <div className="result-meta">
                    <span title={`Author: ${author || 'unknown'}`}>👤 {authorShort}</span>
                    <span>📅 {r.last_modified ? new Date(r.last_modified).toLocaleDateString() : (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—')}</span>
                    <span title={`Source: ${sourceLabel}`}>📁 {sourceLabel.length > 20 ? sourceLabel.slice(0, 20) + '...' : sourceLabel}</span>
                    <span className="match-reason" title={whyMatched}>💡 {whyMatched.length > 30 ? whyMatched.slice(0, 30) + '...' : whyMatched}</span>
                  </div>
                  {link && (
                    <div className="result-actions">
                      <a 
                        href={link} 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()}
                        className="view-original-link"
                      >
                        🔗 View Original →
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {(canPrev || canNext) && (
            <div className="pagination">
              <button 
                disabled={!canPrev || loading} 
                onClick={(e) => runSearch(e, page - 1)}
                className="pagination-btn"
              >
                ← Prev
              </button>
              <span className="page-indicator">Page {page + 1}</span>
              <button 
                disabled={!canNext || loading} 
                onClick={(e) => runSearch(e, page + 1)}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selected.title || 'Untitled'}</h2>
              <button 
                className="modal-close" 
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-meta">
              <span>👤 {selected.author || selected.attributes?.author || 'unknown'}</span>
              <span>📁 {selected.source_name || selected.attributes?.source_name || selected.source_id || 'manual'}</span>
              <span>🏷️ {selected.document_type || 'manual'}</span>
            </div>
            <div className="modal-content">
              <pre className="full-content">{selected.content || '(no content)'}</pre>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelected(null)} className="btn-secondary">Close</button>
              {selectedLink && (
                <a 
                  href={selectedLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-primary"
                >
                  🔗 View Original →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserApp;
