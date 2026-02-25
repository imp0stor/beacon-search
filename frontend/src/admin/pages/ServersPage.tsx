import React, { useEffect, useMemo, useState } from 'react';
import { createServer, deleteServer, listServers, testServer, updateServer } from '../../services/adminApi.ts';

const EMPTY_FORM = { name: '', type: 'postgres', host: '', port: 5432, database_name: '' };

export default function ServersPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listServers());
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submitLabel = useMemo(() => (editingId ? 'Update Server' : 'Add Server'), [editingId]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...form, port: form.port ? Number(form.port) : null };
      if (editingId) {
        await updateServer(editingId, payload);
        setMessage('Server updated');
      } else {
        await createServer(payload);
        setMessage('Server created');
      }
      resetForm();
      await load();
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      type: row.type || 'postgres',
      host: row.host || '',
      port: row.port || 5432,
      database_name: row.database_name || ''
    });
  };

  return (
    <section className='admin-page admin-page--full'>
      <h2 className='admin-page__title'>Servers</h2>
      <p className='admin-page__subtitle'>Manage data source servers and validate connectivity.</p>
      {message ? <div className='admin-inline-note'>{message}</div> : null}
      <form className='admin-form-grid' onSubmit={onSubmit}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Name' required />
        <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder='Type (postgres)' required />
        <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder='Host' />
        <input type='number' value={form.port || ''} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder='Port' />
        <input value={form.database_name} onChange={(e) => setForm({ ...form, database_name: e.target.value })} placeholder='Database' />
        <div className='admin-form-actions'>
          <button className='admin-btn' type='submit' disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
          {editingId ? <button className='admin-btn admin-btn--ghost' type='button' onClick={resetForm}>Cancel</button> : null}
        </div>
      </form>
      {loading ? <div className='admin-widget__loading'>Loading servers…</div> : (
        <div className='admin-table-wrap' style={{ marginTop: '1rem' }}>
          <table className='admin-table'>
            <thead><tr><th>Name</th><th>Type</th><th>Host</th><th>Port</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.type}</td>
                  <td>{row.host || '—'}</td>
                  <td>{row.port || '—'}</td>
                  <td className='admin-table-actions'>
                    <button className='admin-btn' type='button' onClick={() => beginEdit(row)}>Edit</button>
                    <button className='admin-btn' type='button' onClick={async () => {
                      try {
                        const result = await testServer(row.id);
                        setMessage(result.success ? ('Connection OK (' + result.latency_ms + 'ms)') : ('Connection failed: ' + (result.error || 'unknown')));
                      } catch (err) {
                        setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Connection test failed');
                      }
                    }}>Test</button>
                    <button className='admin-btn admin-btn--ghost' type='button' onClick={async () => { await deleteServer(row.id); await load(); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
