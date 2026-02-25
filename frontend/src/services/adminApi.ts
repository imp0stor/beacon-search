import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

const toArray = (value) => (Array.isArray(value) ? value : []);

const toAlertLevel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'critical' || normalized === 'error') return 'critical';
  if (normalized === 'warning' || normalized === 'warn') return 'warning';
  return 'info';
};

export async function fetchDashboardData() {
  const [healthRes, indexStatusRes, alertsRes, syncHistoryRes] = await Promise.allSettled([
    client.get('/health'),
    client.get('/api/admin/dashboard/index-status'),
    client.get('/api/admin/dashboard/alerts', { params: { acknowledged: false, limit: 50 } }),
    client.get('/api/admin/dashboard/sync-history', { params: { limit: 10 } })
  ]);

  const health = healthRes.status === 'fulfilled' ? healthRes.value.data : null;
  const indexStatus = indexStatusRes.status === 'fulfilled' ? indexStatusRes.value.data : null;
  const alertsRaw = alertsRes.status === 'fulfilled' ? toArray(alertsRes.value.data) : [];
  const syncRaw = syncHistoryRes.status === 'fulfilled' ? toArray(syncHistoryRes.value.data) : [];

  const alerts = alertsRaw.map((alert) => ({
    id: alert && alert.id,
    level: toAlertLevel(alert && (alert.level || alert.severity || alert.status)),
    title: (alert && (alert.title || alert.message)) || 'System alert',
    message: (alert && (alert.message || alert.description)) || 'No additional details.',
    source: (alert && alert.source) || 'system',
    createdAt: (alert && (alert.created_at || alert.createdAt)) || new Date().toISOString()
  }));

  const syncRows = syncRaw.map((row) => ({
    id: (row && row.id) || ((row && row.crawler_id) ? row.crawler_id : 'sync') + '-' + ((row && row.started_at) || Date.now()),
    crawlerName: (row && (row.crawler_name || row.crawlerName || row.crawler_id)) || 'Crawler',
    status: (row && row.status) || 'unknown',
    fetched: row && (row.fetched ?? (row.metadata && row.metadata.fetched)),
    indexed: row && (row.indexed ?? (row.metadata && row.metadata.indexed)),
    skipped: row && (row.skipped ?? (row.metadata && row.metadata.skipped)),
    startedAt: row && (row.started_at || row.startedAt),
    finishedAt: row && (row.finished_at || row.finishedAt),
    error: (row && (row.error || (row.metadata && row.metadata.error))) || null
  }));

  const docs = Number((indexStatus && indexStatus.documents) || 0);
  const totalCrawlers = Number((indexStatus && indexStatus.crawlers && indexStatus.crawlers.total) || 0);
  const activeCrawlers = Number((indexStatus && indexStatus.crawlers && indexStatus.crawlers.active) || 0);
  const failures = Number((indexStatus && indexStatus.crawlers && indexStatus.crawlers.error) || 0) + Number((indexStatus && indexStatus.sync && indexStatus.sync.failed) || 0);

  const byType = toArray(indexStatus && indexStatus.documents_by_type)
    .map((row) => ({
      type: (row && row.type) || 'unknown',
      count: Number((row && row.count) || 0)
    }))
    .sort((a, b) => b.count - a.count);

  return {
    systemStatus: {
      health: (health && health.status) || 'unknown',
      docs,
      crawlers: totalCrawlers,
      activeCrawlers,
      lastSyncAt: indexStatus && indexStatus.sync ? indexStatus.sync.last_sync_at : null,
      failures
    },
    alerts,
    indexStatus: {
      totalDocuments: docs,
      byType,
      estimatedSizeBytes: docs * 2400
    },
    recentSyncs: syncRows
  };
}

export async function acknowledgeAlert(alertId) {
  await client.post('/api/admin/dashboard/alerts/' + encodeURIComponent(alertId) + '/ack', {
    acknowledged_by: 'admin-ui',
    acknowledged: true
  });
  return { ok: true, id: alertId };
}

export async function listServers() {
  const response = await client.get('/api/admin/servers');
  return toArray(response.data);
}

export async function createServer(payload) {
  const response = await client.post('/api/admin/servers', payload);
  return response.data;
}

export async function updateServer(id, payload) {
  const response = await client.put('/api/admin/servers/' + id, payload);
  return response.data;
}

export async function deleteServer(id) {
  await client.delete('/api/admin/servers/' + id);
}

export async function testServer(id) {
  const response = await client.post('/api/admin/servers/' + id + '/test');
  return response.data;
}

export async function listDocumentTypes() {
  const response = await client.get('/api/admin/document-types');
  return toArray(response.data);
}

export async function createDocumentType(payload) {
  const response = await client.post('/api/admin/document-types', payload);
  return response.data;
}

export async function updateDocumentType(id, payload) {
  const response = await client.put('/api/admin/document-types/' + id, payload);
  return response.data;
}

export async function deleteDocumentType(id) {
  await client.delete('/api/admin/document-types/' + id);
}

export async function listCrawlers() {
  const response = await client.get('/api/admin/crawlers');
  return toArray(response.data);
}

export async function createCrawler(payload) {
  const response = await client.post('/api/admin/crawlers', payload);
  return response.data;
}

export async function updateCrawler(id, payload) {
  const response = await client.put('/api/admin/crawlers/' + id, payload);
  return response.data;
}

export async function deleteCrawler(id) {
  await client.delete('/api/admin/crawlers/' + id);
}

export async function syncCrawler(id) {
  const response = await client.post('/api/admin/crawlers/' + id + '/sync', { mode: 'manual' });
  return response.data;
}

export async function getCrawlerHistory(id, limit = 20) {
  const response = await client.get('/api/admin/crawlers/' + id + '/history', { params: { limit } });
  return toArray(response.data);
}

export async function fetchSystemHealth() {
  const response = await client.get('/health');
  return response.data;
}


export async function listSystemSettings() {
  const response = await client.get('/api/admin/settings');
  return toArray(response.data);
}

export async function updateSystemSetting(key, payload) {
  const response = await client.put('/api/admin/settings/' + encodeURIComponent(key), payload);
  return response.data;
}
