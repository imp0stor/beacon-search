import React, { useMemo, useState } from 'react';
import './user.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
  const pageSize = 20;

  const runSearch = async (e, pageOverride = 0) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const q = query.trim();
      const offset = pageOverride * pageSize;
      const url = q
        ? `${API_URL}/api/search?q=${encodeURIComponent(q)}&limit=${pageSize}&offset=${offset}&mode=hybrid&explain=true`
        : `${API_URL}/api/documents?limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
      const data = await res.json();
      const incoming = Array.isArray(data) ? data : (data.results || []);
      setResults(incoming);
      setHasSearched(true);
      setPage(pageOverride);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const canNext = results.length === pageSize;
  const canPrev = page > 0;

  const role = localStorage.getItem('beacon_role');
  const navLabel = role === 'admin' ? 'Admin' : 'Search';

  const selectedLink = useMemo(() => (selected ? deepLinkFor(selected) : null), [selected]);

  return (
    <div className="user-shell">
      <header className="user-header">
        <div>
          <h1>Beacon Search</h1>
          <p>Rich search across indexed sources.</p>
        </div>
        <a className="pill-nav" href={role === 'admin' ? '/admin' : '/search'}>{navLabel}</a>
      </header>

      <form className="user-search" onSubmit={runSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs, posts, notes..."
        />
        <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </form>

      {error && <div className="user-error">{error} <button onClick={(e) => runSearch(e, page)}>Retry</button></div>}

      {hasSearched && !loading && results.length === 0 && (
        <div className="user-empty">No results yet. Try a broader query, or ask admin to ingest sources.</div>
      )}

      <div className="user-results">
        {results.map((r) => {
          const link = deepLinkFor(r);
          const snippet = (r.content || '').slice(0, 200);
          const whyMatched = r.match_reason || (r.score > 0.8 ? 'strong semantic + keyword match' : 'semantic relevance');
          const sourceLabel = r.source_name || r.attributes?.source_name || r.source_id || 'manual';

          return (
            <article key={r.id} className="user-result" onClick={() => setSelected(r)}>
              <div className="row-between">
                <h3>{r.title || 'Untitled'}</h3>
                <span className="score">{Number(r.score || 0).toFixed(3)}</span>
              </div>
              <p>{snippet}{(r.content || '').length > 200 ? '…' : ''}</p>
              <div className="meta">
                <span>Author: {r.author || r.attributes?.author || 'unknown'}</span>
                <span>Date: {r.last_modified ? new Date(r.last_modified).toLocaleString() : (r.created_at ? new Date(r.created_at).toLocaleString() : '—')}</span>
                <span>Source: {sourceLabel}</span>
                <span>Type: {r.document_type || 'manual'}</span>
                <span>Why: {whyMatched}</span>
                {link && <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>View Original</a>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="pagination">
        <button disabled={!canPrev || loading} onClick={(e) => runSearch(e, page - 1)}>Prev</button>
        <span>Page {page + 1}</span>
        <button disabled={!canNext || loading} onClick={(e) => runSearch(e, page + 1)}>Next</button>
      </div>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{selected.title || 'Untitled'}</h2>
            <div className="meta">
              <span>Author: {selected.author || selected.attributes?.author || 'unknown'}</span>
              <span>Type: {selected.document_type || 'manual'}</span>
              <span>Source: {selected.source_name || selected.attributes?.source_name || selected.source_id || 'manual'}</span>
            </div>
            <pre className="full-content">{selected.content || '(no content)'}</pre>
            <div className="row-between">
              <button onClick={() => setSelected(null)}>Close</button>
              {selectedLink && <a href={selectedLink} target="_blank" rel="noreferrer">View Original</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserApp;
