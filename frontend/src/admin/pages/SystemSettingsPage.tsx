import React, { useEffect, useState } from 'react';
import { listSystemSettings, updateSystemSetting } from '../../services/adminApi.ts';

export default function SystemSettingsPage() {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const settings = await listSystemSettings();
      setRows(settings);
      const nextDrafts = {};
      settings.forEach((row) => {
        nextDrafts[row.key] = row.value;
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const parseValue = (rawValue, original) => {
    if (typeof original === 'boolean') return Boolean(rawValue);
    if (typeof original === 'number') {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : original;
    }
    if (original && typeof original === 'object') {
      try {
        return JSON.parse(String(rawValue || '{}'));
      } catch (_err) {
        return original;
      }
    }
    return rawValue == null ? '' : String(rawValue);
  };

  const onSave = async (row) => {
    setSavingKey(row.key);
    setMessage('');
    try {
      const parsed = parseValue(drafts[row.key], row.value);
      await updateSystemSetting(row.key, {
        value: parsed,
        category: row.category,
        description: row.description
      });
      setMessage('Saved ' + row.key + (['WOT_ENABLED', 'WOT_PROVIDER', 'NOSTRMAXI_URL', 'WOT_WEIGHT', 'WOT_CACHE_TTL'].includes(row.key) ? ' (WoT plugin changes apply on service restart)' : ''));
      await load();
    } catch (err) {
      setMessage((err && err.response && err.response.data && err.response.data.error) || err.message || 'Failed to save setting');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <section className='admin-page admin-page--full'>
      <h2 className='admin-page__title'>System Settings</h2>
      <p className='admin-page__subtitle'>Application-level configuration loaded from database with environment fallback.</p>
      {message ? <div className='admin-inline-note'>{message}</div> : null}

      {loading ? <div className='admin-widget__loading'>Loading settings…</div> : (
        <div className='admin-table-wrap' style={{ marginTop: '1rem' }}>
          <table className='admin-table'>
            <thead><tr><th>Key</th><th>Category</th><th>Value</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const value = drafts[row.key];
                const isObject = row.value && typeof row.value === 'object' && !Array.isArray(row.value);
                return (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td>{row.category || 'system'}</td>
                    <td>
                      {typeof row.value === 'boolean' ? (
                        <input type='checkbox' checked={Boolean(value)} onChange={(e) => setDrafts({ ...drafts, [row.key]: e.target.checked })} />
                      ) : typeof row.value === 'number' ? (
                        <input type='number' value={value ?? ''} onChange={(e) => setDrafts({ ...drafts, [row.key]: e.target.value })} />
                      ) : isObject ? (
                        <textarea rows={3} value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)} onChange={(e) => setDrafts({ ...drafts, [row.key]: e.target.value })} />
                      ) : (
                        <input type='text' value={value ?? ''} onChange={(e) => setDrafts({ ...drafts, [row.key]: e.target.value })} />
                      )}
                    </td>
                    <td>{row.description || '—'}</td>
                    <td className='admin-table-actions'>
                      <button className='admin-btn' type='button' disabled={savingKey === row.key} onClick={() => onSave(row)}>{savingKey === row.key ? 'Saving…' : 'Save'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
