/**
 * API utility functions for Beacon Search Admin
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ===== Dashboard Stats =====
export const fetchDashboardStats = () => fetchAPI('/api/admin/stats');
export const fetchSystemHealth = () => fetchAPI('/api/admin/health');
export const fetchRecentActivity = () => fetchAPI('/api/admin/activity');

// ===== Sources =====
export const fetchSources = () => fetchAPI('/api/sources');
export const fetchSource = (id) => fetchAPI(`/api/sources/${id}`);
export const createSource = (data) => fetchAPI('/api/sources', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateSource = (id, data) => fetchAPI(`/api/sources/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const deleteSource = (id) => fetchAPI(`/api/sources/${id}`, {
  method: 'DELETE',
});
export const testSourceConnection = (id) => fetchAPI(`/api/sources/${id}/test`, {
  method: 'POST',
});
export const triggerSourceSync = (id) => fetchAPI(`/api/sources/${id}/sync`, {
  method: 'POST',
});
export const fetchSourceSyncHistory = (id) => fetchAPI(`/api/sources/${id}/history`);
export const fetchSourceSampleDocs = (id) => fetchAPI(`/api/sources/${id}/sample`);

// ===== Documents =====
export const fetchDocuments = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/documents${query ? `?${query}` : ''}`);
};
export const fetchDocument = (id) => fetchAPI(`/api/documents/${id}`);
export const deleteDocument = (id) => fetchAPI(`/api/documents/${id}`, {
  method: 'DELETE',
});
export const bulkDeleteDocuments = (ids) => fetchAPI('/api/documents/bulk-delete', {
  method: 'POST',
  body: JSON.stringify({ ids }),
});
export const reindexDocument = (id) => fetchAPI(`/api/documents/${id}/reindex`, {
  method: 'POST',
});
export const updateDocumentTags = (id, tags) => fetchAPI(`/api/documents/${id}/tags`, {
  method: 'PUT',
  body: JSON.stringify({ tags }),
});
export const fetchEmbeddingsVisualization = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/documents/embeddings${query ? `?${query}` : ''}`);
};

// ===== Ontology =====
export const fetchOntology = () => fetchAPI('/api/ontology');
export const updateOntology = (data) => fetchAPI('/api/ontology', {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const addOntologyConcept = (data) => fetchAPI('/api/ontology/concepts', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateOntologyConcept = (id, data) => fetchAPI(`/api/ontology/concepts/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const deleteOntologyConcept = (id) => fetchAPI(`/api/ontology/concepts/${id}`, {
  method: 'DELETE',
});
export const importOntologyYAML = (yaml) => fetchAPI('/api/ontology/import', {
  method: 'POST',
  body: JSON.stringify({ yaml }),
});
export const exportOntologyYAML = () => fetchAPI('/api/ontology/export');

// ===== Dictionary =====
export const fetchDictionary = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/dictionary${query ? `?${query}` : ''}`);
};
export const addDictionaryTerm = (data) => fetchAPI('/api/dictionary', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateDictionaryTerm = (id, data) => fetchAPI(`/api/dictionary/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const deleteDictionaryTerm = (id) => fetchAPI(`/api/dictionary/${id}`, {
  method: 'DELETE',
});
export const importDictionaryCSV = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return fetch(`${API_URL}/api/dictionary/import`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json());
};

// ===== Triggers =====
export const fetchTriggers = () => fetchAPI('/api/triggers');
export const createTrigger = (data) => fetchAPI('/api/triggers', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateTrigger = (id, data) => fetchAPI(`/api/triggers/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const deleteTrigger = (id) => fetchAPI(`/api/triggers/${id}`, {
  method: 'DELETE',
});
export const toggleTrigger = (id, enabled) => fetchAPI(`/api/triggers/${id}/toggle`, {
  method: 'POST',
  body: JSON.stringify({ enabled }),
});
export const testTrigger = (id, query) => fetchAPI(`/api/triggers/${id}/test`, {
  method: 'POST',
  body: JSON.stringify({ query }),
});
export const reorderTriggers = (order) => fetchAPI('/api/triggers/reorder', {
  method: 'POST',
  body: JSON.stringify({ order }),
});

// ===== Webhooks =====
export const fetchWebhooks = () => fetchAPI('/api/webhooks');
export const createWebhook = (data) => fetchAPI('/api/webhooks', {
  method: 'POST',
  body: JSON.stringify(data),
});
export const updateWebhook = (id, data) => fetchAPI(`/api/webhooks/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const deleteWebhook = (id) => fetchAPI(`/api/webhooks/${id}`, {
  method: 'DELETE',
});
export const fetchWebhookDeliveries = (id) => fetchAPI(`/api/webhooks/${id}/deliveries`);
export const retryWebhookDelivery = (webhookId, deliveryId) => 
  fetchAPI(`/api/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, {
    method: 'POST',
  });

// ===== Analytics =====
export const fetchSearchAnalytics = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/analytics/search${query ? `?${query}` : ''}`);
};
export const fetchSyncAnalytics = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/analytics/sync${query ? `?${query}` : ''}`);
};
export const fetchPopularSearches = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/analytics/popular-searches${query ? `?${query}` : ''}`);
};
export const fetchZeroResultQueries = () => fetchAPI('/api/analytics/zero-results');
export const fetchUserEngagement = () => fetchAPI('/api/analytics/engagement');

// ===== Settings =====
export const fetchSettings = () => fetchAPI('/api/settings');
export const updateSettings = (data) => fetchAPI('/api/settings', {
  method: 'PUT',
  body: JSON.stringify(data),
});
export const clearCache = () => fetchAPI('/api/admin/clear-cache', {
  method: 'POST',
});
export const fetchGitConfig = () => fetchAPI('/api/config/status');
export const syncGitConfig = () => fetchAPI('/api/config/sync', {
  method: 'POST',
});

export default {
  fetchDashboardStats,
  fetchSystemHealth,
  fetchRecentActivity,
  fetchSources,
  fetchSource,
  createSource,
  updateSource,
  deleteSource,
  testSourceConnection,
  triggerSourceSync,
  fetchSourceSyncHistory,
  fetchSourceSampleDocs,
  fetchDocuments,
  fetchDocument,
  deleteDocument,
  bulkDeleteDocuments,
  reindexDocument,
  updateDocumentTags,
  fetchEmbeddingsVisualization,
  fetchOntology,
  updateOntology,
  addOntologyConcept,
  updateOntologyConcept,
  deleteOntologyConcept,
  importOntologyYAML,
  exportOntologyYAML,
  fetchDictionary,
  addDictionaryTerm,
  updateDictionaryTerm,
  deleteDictionaryTerm,
  importDictionaryCSV,
  fetchTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  toggleTrigger,
  testTrigger,
  reorderTriggers,
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  retryWebhookDelivery,
  fetchSearchAnalytics,
  fetchSyncAnalytics,
  fetchPopularSearches,
  fetchZeroResultQueries,
  fetchUserEngagement,
  fetchSettings,
  updateSettings,
  clearCache,
  fetchGitConfig,
  syncGitConfig,
};
