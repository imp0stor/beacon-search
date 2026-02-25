import React from 'react';

const statusClass = {
  success: 'admin-dot--ok',
  completed: 'admin-dot--ok',
  running: 'admin-dot--info',
  failed: 'admin-dot--danger',
  error: 'admin-dot--danger'
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

export default function RecentSyncsWidget({ syncs, loading }) {
  return (
    <section className="admin-widget">
      <div className="admin-widget__header">
        <h3>Recent Syncs</h3>
        <span className="admin-muted">Last 10</span>
      </div>

      {loading ? (
        <div className="admin-widget__loading">Loading sync history…</div>
      ) : syncs.length === 0 ? (
        <div className="admin-widget__empty">No syncs yet.</div>
      ) : (
        <div className="admin-sync-list">
          {syncs.slice(0, 10).map((sync) => (
            <div key={sync.id} className="admin-sync-row">
              <div className="admin-sync-row__left">
                <span className={`admin-dot ${statusClass[sync.status] || 'admin-dot--muted'}`} />
                <div>
                  <div className="admin-sync-row__name">{sync.crawlerName}</div>
                  <div className="admin-sync-row__time">{formatDate(sync.finishedAt || sync.startedAt)}</div>
                </div>
              </div>
              <div className="admin-sync-row__stats">
                <span>Indexed: {sync.indexed ?? '—'}</span>
                <span>Status: {sync.status || 'unknown'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
