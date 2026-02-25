import React, { useEffect, useMemo, useState } from 'react';
import { createDocumentType, deleteDocumentType, listDocumentTypes, updateDocumentType } from '../../services/adminApi.ts';

const EMPTY_FORM = { name: '', display_name: '', description: '' };

export default function DocumentTypesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listDocumentTypes());
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Failed to load document types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const submitLabel = useMemo(() => (editingId ? 'Update Type' : 'Add Type'), [editingId]);

  const reset = () => { setForm(EMPTY_FORM); setEditingId(''); };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = { ...form, fields: {}, relevancy_config: {} };

    try {
      if (editingId) {
        await updateDocumentType(editingId, payload);
        setMessage('Document type updated');
      } else {
        await createDocumentType(payload);
        setMessage('Document type created');
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
      <h2 className='admin-page__title'>Document Types</h2>
      <p className='admin-page__subtitle'>Configure document schemas and metadata behavior.</p>
      {message ? <div className='admin-inline-note'>{message}</div> : null}

      <form className='admin-form-grid' onSubmit={onSubmit}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Name (e.g. article)' required />
        <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder='Display name' />
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='Description' />
        <div className='admin-form-actions'>
          <button className='admin-btn' type='submit' disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
          {editingId ? <button className='admin-btn admin-btn--ghost' type='button' onClick={reset}>Cancel</button> : null}
        </div>
      </form>

      {loading ? <div className='admin-widget__loading'>Loading document types…</div> : (
        <div className='admin-table-wrap' style={{ marginTop: '1rem' }}>
          <table className='admin-table'>
            <thead><tr><th>Name</th><th>Display</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.display_name || '—'}</td>
                  <td>{row.description || '—'}</td>
                  <td className='admin-table-actions'>
                    <button className='admin-btn' type='button' onClick={() => { setEditingId(row.id); setForm({ name: row.name || '', display_name: row.display_name || '', description: row.description || '' }); }}>Edit</button>
                    <button className='admin-btn admin-btn--ghost' type='button' onClick={async () => { await deleteDocumentType(row.id); await load(); }}>Delete</button>
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
