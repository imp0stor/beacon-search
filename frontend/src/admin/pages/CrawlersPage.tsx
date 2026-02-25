import React, { useEffect, useMemo, useState } from 'react';
import { createCrawler, deleteCrawler, getCrawlerHistory, listCrawlers, listDocumentTypes, listServers, syncCrawler, updateCrawler } from '../../services/adminApi.ts';

const EMPTY_FORM = { name: '', type: 'manual', status: 'inactive', server_id: '', document_type_id: '' };

export default function CrawlersPage() {
  const [rows, setRows] = useState([]);
  const [servers, setServers] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyByCrawler, setHistoryByCrawler] = useState({});
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const all = await Promise.all([listCrawlers(), listServers(), listDocumentTypes()]);
      setRows(all[0]);
      setServers(all[1]);
      setDocumentTypes(all[2]);
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Failed to load crawlers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const submitLabel = useMemo(() => (editingId ? 'Update Crawler' : 'Add Crawler'), [editingId]);

  const reset = () => { setForm(EMPTY_FORM); setEditingId(''); };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = { ...form, server_id: form.server_id || null, document_type_id: form.document_type_id || null, extraction_config: {} };

    try {
      if (editingId) {
        await updateCrawler(editingId, payload);
        setMessage('Crawler updated');
      } else {
        await createCrawler(payload);
        setMessage('Crawler created');
      }
      reset();
      await load();
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className='admin-page admin-page--full'>
      <h2 className='admin-page__title'>Crawlers</h2>
      <p className='admin-page__subtitle'>Manage ingestion crawlers, status, and sync runs.</p>
      {message ? <div className='admin-inline-note'>{message}</div> : null}

      <form className='admin-form-grid' onSubmit={onSubmit}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Crawler name' required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value='manual'>manual</option><option value='external'>external</option><option value='product'>product</option></select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value='inactive'>inactive</option><option value='active'>active</option><option value='error'>error</option></select>
        <select value={form.server_id} onChange={(e) => setForm({ ...form, server_id: e.target.value })}><option value=''>No server</option>{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={form.document_type_id} onChange={(e) => setForm({ ...form, document_type_id: e.target.value })}><option value=''>No document type</option>{documentTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <div className='admin-form-actions'><button className='admin-btn' type='submit' disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>{editingId ? <button className='admin-btn admin-btn--ghost' type='button' onClick={reset}>Cancel</button> : null}</div>
      </form>

      {loading ? <div className='admin-widget__loading'>Loading crawlers…</div> : (
        <div className='admin-table-wrap' style={{ marginTop: '1rem' }}>
          <table className='admin-table'>
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Server</th><th>Document Type</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td><td>{row.type}</td><td>{row.status}</td>
                  <td>{(servers.find((s) => s.id === row.server_id) || {}).name || '—'}</td>
                  <td>{(documentTypes.find((d) => d.id === row.document_type_id) || {}).name || '—'}</td>
                  <td className='admin-table-actions'>
                    <button className='admin-btn' type='button' onClick={() => { setEditingId(row.id); setForm({ name: row.name || '', type: row.type || 'manual', status: row.status || 'inactive', server_id: row.server_id || '', document_type_id: row.document_type_id || '' }); }}>Edit</button>
                    <button className='admin-btn' type='button' onClick={async () => { const res = await syncCrawler(row.id); setMessage('Sync queued: ' + ((res && (res.runId || res.sync_id)) || row.name)); await load(); }}>Sync</button>
                    <button className='admin-btn' type='button' onClick={async () => { const history = await getCrawlerHistory(row.id, 5); setHistoryByCrawler((prev) => ({ ...prev, [row.id]: history })); }}>History</button>
                    <button className='admin-btn admin-btn--ghost' type='button' onClick={async () => { await deleteCrawler(row.id); await load(); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Object.entries(historyByCrawler).map((entry) => {
        const crawlerId = entry[0];
        const history = entry[1] || [];
        const crawler = rows.find((row) => row.id === crawlerId);
        return (
          <div key={crawlerId} className='admin-history-block'>
            <h4>Recent history for {(crawler && crawler.name) || crawlerId}</h4>
            <ul>{history.map((item) => <li key={String(item.id || item.started_at || item.status)}>{item.status} — {item.started_at ? new Date(item.started_at).toLocaleString() : 'unknown time'}</li>)}</ul>
          </div>
        );
      })}
    </section>
  );
}
