import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

const toArray = (value) => (Array.isArray(value) ? value : []);

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const firstDate = (...values) => {
  for (const value of values) {
    const parsed = parseDate(value);
    if (parsed) return parsed;
  }
  return null;
};

export async function fetchDashboardData() {
  const [healthRes, statsRes, connectorsRes] = await Promise.allSettled([
    client.get('/health'),
    client.get('/api/stats'),
    client.get('/api/connectors')
  ]);

  const health = healthRes.status === 'fulfilled' ? healthRes.value.data : null;
  const stats = statsRes.status === 'fulfilled' ? statsRes.value.data : null;
  const crawlers = connectorsRes.status === 'fulfilled' ? toArray(connectorsRes.value.data) : [];

  const docCount = Number(stats?.totalDocuments || 0);
  const activeCrawlers = crawlers.filter((crawler) => crawler?.isActive !== false).length;

  const lastSyncDate = crawlers
    .map((crawler) => firstDate(crawler?.last_sync_at, crawler?.lastSyncAt, crawler?.updated_at, crawler?.updatedAt, crawler?.currentRun?.startedAt, crawler?.currentRun?.finishedAt))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const connectorFailures = crawlers.filter((crawler) => {
    const runStatus = crawler?.currentRun?.status;
    return Boolean(crawler?.lastError || runStatus === 'failed' || runStatus === 'error');
  }).length;

  const alerts = [];

  if (health?.status && health.status !== 'ok') {
    alerts.push({
      id: 'health-degraded',
      level: 'critical',
      title: 'System health is degraded',
      message: 'One or more backend checks are failing.',
      source: 'system',
      createdAt: new Date().toISOString()
    });
  }

  crawlers.forEach((crawler) => {
    if (crawler?.lastError) {
      alerts.push({
        id: `crawler-${crawler.id}-last-error`,
        level: 'warning',
        title: `${crawler.name || 'Crawler'} reported an error`,
        message: crawler.lastError,
        source: crawler.name || 'crawler',
        createdAt: crawler.updatedAt || crawler.updated_at || new Date().toISOString()
      });
    }

    if (crawler?.currentRun?.status === 'failed') {
      alerts.push({
        id: `crawler-${crawler.id}-run-failed`,
        level: 'critical',
        title: `${crawler.name || 'Crawler'} sync failed`,
        message: crawler.currentRun?.error || 'The latest crawler run failed.',
        source: crawler.name || 'crawler',
        createdAt: crawler.currentRun?.finishedAt || crawler.currentRun?.startedAt || new Date().toISOString()
      });
    }
  });

  const indexByType = toArray(stats?.sourceStats)
    .map((source) => ({
      type: source?.connector_type || source?.name || 'unknown',
      count: Number(source?.document_count || 0)
    }))
    .sort((a, b) => b.count - a.count);

  const recentSyncs = [];
  await Promise.all(
    crawlers.slice(0, 10).map(async (crawler) => {
      try {
        const response = await client.get(`/api/connectors/${crawler.id}/history`, { params: { limit: 3 } });
        toArray(response.data).forEach((entry) => {
          const startedAt = entry?.startedAt || entry?.started_at || entry?.createdAt || entry?.created_at;
          const finishedAt = entry?.finishedAt || entry?.finished_at || entry?.updatedAt || entry?.updated_at;
          recentSyncs.push({
            id: entry?.id || `${crawler.id}-${startedAt || Date.now()}`,
            crawlerName: crawler?.name || 'Crawler',
            status: entry?.status || 'unknown',
            fetched: entry?.fetched ?? entry?.stats?.fetched,
            indexed: entry?.indexed ?? entry?.stats?.indexed,
            skipped: entry?.skipped ?? entry?.stats?.skipped,
            startedAt,
            finishedAt,
            error: entry?.error || null
          });
        });
      } catch (_err) {
        // best-effort history load
      }
    })
  );

  recentSyncs.sort((a, b) => {
    const ad = firstDate(a.finishedAt, a.startedAt);
    const bd = firstDate(b.finishedAt, b.startedAt);
    return (bd?.getTime() || 0) - (ad?.getTime() || 0);
  });

  const indexSizeEstimateBytes = docCount * 2400;

  return {
    systemStatus: {
      health: health?.status || 'unknown',
      docs: docCount,
      crawlers: crawlers.length,
      activeCrawlers,
      lastSyncAt: lastSyncDate ? lastSyncDate.toISOString() : null,
      failures: connectorFailures
    },
    alerts: alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    indexStatus: {
      totalDocuments: docCount,
      byType: indexByType,
      estimatedSizeBytes: indexSizeEstimateBytes
    },
    recentSyncs: recentSyncs.slice(0, 10)
  };
}

export async function acknowledgeAlert(alertId) {
  try {
    await client.post(`/api/admin/alerts/${encodeURIComponent(alertId)}/ack`);
  } catch (_error) {
    // Optional endpoint; local ack is still supported in the UI.
  }
  return { ok: true, id: alertId };
}
