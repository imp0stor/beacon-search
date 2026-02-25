import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SystemStatusWidget from '../components/SystemStatusWidget.tsx';
import AlertsWidget from '../components/AlertsWidget.tsx';
import IndexStatusWidget from '../components/IndexStatusWidget.tsx';
import RecentSyncsWidget from '../components/RecentSyncsWidget.tsx';
import { acknowledgeAlert, fetchDashboardData } from '../../services/adminApi.ts';

const REFRESH_INTERVAL_MS = 30000;

export default function Dashboard() {
  const [data, setData] = useState({
    systemStatus: null,
    alerts: [],
    indexStatus: null,
    recentSyncs: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const next = await fetchDashboardData();
      setData(next);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load({ initial: true });
    const timer = setInterval(() => {
      load({ initial: false });
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [load]);

  const visibleAlerts = useMemo(
    () => data.alerts.filter((alert) => !acknowledgedIds.has(alert.id)),
    [data.alerts, acknowledgedIds]
  );

  const handleAcknowledge = async (id) => {
    setAcknowledgedIds((prev) => new Set([...prev, id]));
    try {
      await acknowledgeAlert(id);
    } catch (_err) {
      // Keep optimistic local state
    }
  };

  return (
    <section className="admin-page admin-page--dashboard">
      <div className="admin-page__head">
        <div>
          <h2 className="admin-page__title">Dashboard</h2>
          <p className="admin-page__subtitle">Realtime monitoring for indexing, crawler health, and sync status.</p>
        </div>
        <button type="button" className="admin-btn" onClick={() => load({ initial: false })} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="admin-error-banner">{error}</div> : null}

      <div className="admin-dashboard-grid">
        <SystemStatusWidget status={data.systemStatus} loading={loading} />
        <AlertsWidget
          alerts={visibleAlerts}
          loading={loading}
          acknowledgedIds={acknowledgedIds}
          onAcknowledge={handleAcknowledge}
        />
        <IndexStatusWidget indexStatus={data.indexStatus} loading={loading} />
        <RecentSyncsWidget syncs={data.recentSyncs} loading={loading} />
      </div>
    </section>
  );
}
