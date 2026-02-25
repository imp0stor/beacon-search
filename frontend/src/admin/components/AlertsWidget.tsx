import React from 'react';

const levelClass = {
  critical: 'admin-alert--critical',
  warning: 'admin-alert--warning',
  info: 'admin-alert--info'
};

export default function AlertsWidget({ alerts, loading, acknowledgedIds, onAcknowledge }) {
  return (
    <section className="admin-widget">
      <div className="admin-widget__header">
        <h3>Alerts</h3>
        <span className="admin-muted">{alerts.length}</span>
      </div>

      {loading ? (
        <div className="admin-widget__loading">Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="admin-widget__empty">No active alerts 🎉</div>
      ) : (
        <div className="admin-alert-list">
          {alerts.map((alert) => {
            const acked = acknowledgedIds.has(alert.id);
            return (
              <article key={alert.id} className={`admin-alert ${levelClass[alert.level] || 'admin-alert--info'} ${acked ? 'admin-alert--acked' : ''}`}>
                <div>
                  <div className="admin-alert__title">{alert.title}</div>
                  <div className="admin-alert__message">{alert.message}</div>
                </div>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => onAcknowledge(alert.id)}
                  disabled={acked}
                >
                  {acked ? 'Acknowledged' : 'Acknowledge'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
