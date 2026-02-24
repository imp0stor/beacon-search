import React, { useEffect, useMemo, useState } from 'react';
import '../user/user.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function AdminConsole() {
  const [connectors, setConnectors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState('');
  const [error, setError] = useState('');

  const loadConnectors = async () => {
    try {
      const res = await fetch(`${API_URL}/api/connectors`);
      const data = await res.json();
      setConnectors(data || []);
      if (!selectedId && data?.length) setSelectedId(data[0].id);
    } catch (e) {
      setError('Failed to load connectors');
    }
  };

  const runAction = async (id, action) => {
    setError('');
    const res = await fetch(`${API_URL}/api/connectors/${id}/${action}`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `${action} failed`);
      return;
    }
    loadConnectors();
  };

  const toggleActive = async (c) => {
    const res = await fetch(`${API_URL}/api/connectors/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'toggle failed');
      return;
    }
    loadConnectors();
  };

  useEffect(() => { loadConnectors(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    const id = selectedId;
    let mounted = true;
    const tick = async () => {
      const [statusRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/api/connectors/${id}/status`),
        fetch(`${API_URL}/api/connectors/${id}/logs${level ? `?level=${level}` : ''}`)
      ]);
      if (!mounted) return;
      if (statusRes.ok) setStatus(await statusRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { mounted = false; clearInterval(t); };
  }, [selectedId, level]);

  const selected = useMemo(() => connectors.find((c) => c.id === selectedId), [connectors, selectedId]);

  return (
    <div className="user-shell">
      <header className="user-header"><h1>Beacon Admin</h1><a className="pill-nav" href="/search">Search</a></header>
      {error && <div className="user-error">{error}</div>}

      <div className="user-results">
        {connectors.map((c) => (
          <article key={c.id} className="user-result">
            <div className="row-between">
              <h3>{c.name}</h3>
              <span className="score">{c.isActive ? 'enabled' : 'disabled'}</span>
            </div>
            <div className="meta">
              <span>Type: {c.config?.type}</span>
              <span>Docs: {c.documentCount || 0}</span>
              <span>Last Sync: {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : 'Never'}</span>
              <span>Status: {c.currentRun?.status || c.lastRunStatus || 'idle'}</span>
            </div>
            <div className="row-between">
              <div>
                <button onClick={() => setSelectedId(c.id)}>Inspect</button>
                <button onClick={() => toggleActive(c)}>{c.isActive ? 'Disable' : 'Enable'}</button>
                <button onClick={() => runAction(c.id, 'run')}>Start Ingestion</button>
              </div>
              {c.currentRun?.status === 'running' && <button onClick={() => runAction(c.id, 'stop')}>Stop</button>}
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <article className="user-result">
          <h3>Live: {selected.name}</h3>
          <div className="meta">
            <span>Progress: {Math.round((status?.progress || 0) * 100)}%</span>
            <span>Added: {status?.documentsAdded || 0}</span>
            <span>Updated: {status?.documentsUpdated || 0}</span>
            <span>Errors: {status?.errorMessage || 'none'}</span>
            <label>Log level:
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">all</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </label>
          </div>
          <pre className="full-content">{logs.map((l) => l.message || l).join('\n')}</pre>
        </article>
      )}
    </div>
  );
}
