import React from 'react';

const formatDate = (value) => {
  if (!value) return 'Never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};

export default function SystemStatusWidget({ status, loading }) {
  const healthClass = status?.health === 'ok' ? 'admin-badge--ok' : status?.health === 'degraded' ? 'admin-badge--warn' : 'admin-badge--muted';

  return (
    <section className="admin-widget">
      <div className="admin-widget__header">
        <h3>System Status</h3>
        <span className={`admin-badge ${healthClass}`}>{status?.health || 'unknown'}</span>
      </div>

      {loading ? (
        <div className="admin-widget__loading">Loading system status…</div>
      ) : (
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <div className="admin-kpi-card__label">Documents</div>
            <div className="admin-kpi-card__value">{status?.docs ?? 0}</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-card__label">Crawlers</div>
            <div className="admin-kpi-card__value">{status?.crawlers ?? 0}</div>
            <div className="admin-kpi-card__meta">{status?.activeCrawlers ?? 0} active</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-card__label">Last Sync</div>
            <div className="admin-kpi-card__value admin-kpi-card__value--small">{formatDate(status?.lastSyncAt)}</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-card__label">Failures</div>
            <div className="admin-kpi-card__value">{status?.failures ?? 0}</div>
          </div>
        </div>
      )}
    </section>
  );
}
