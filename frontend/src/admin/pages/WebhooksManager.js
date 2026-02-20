import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  retryWebhookDelivery,
} from '../utils/api';

const EVENT_TYPES = [
  { id: 'document.created', label: 'Document Created', icon: '📄' },
  { id: 'document.updated', label: 'Document Updated', icon: '✏️' },
  { id: 'document.deleted', label: 'Document Deleted', icon: '🗑️' },
  { id: 'source.sync.started', label: 'Sync Started', icon: '🔄' },
  { id: 'source.sync.completed', label: 'Sync Completed', icon: '✅' },
  { id: 'source.sync.failed', label: 'Sync Failed', icon: '❌' },
  { id: 'search.performed', label: 'Search Performed', icon: '🔍' },
  { id: 'trigger.matched', label: 'Trigger Matched', icon: '⚡' },
];

function WebhooksManager() {
  const queryClient = useQueryClient();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [viewingDeliveries, setViewingDeliveries] = useState(null);
  const [expandedDelivery, setExpandedDelivery] = useState(null);
  
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: [],
    enabled: true,
    headers: {},
  });

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: fetchWebhooks,
    placeholderData: [],
  });

  // Fetch deliveries for selected webhook
  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['webhook-deliveries', viewingDeliveries],
    queryFn: () => fetchWebhookDeliveries(viewingDeliveries),
    enabled: !!viewingDeliveries,
    placeholderData: [],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries(['webhooks']);
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateWebhook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['webhooks']);
      setEditingWebhook(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => queryClient.invalidateQueries(['webhooks']),
  });

  const retryMutation = useMutation({
    mutationFn: ({ webhookId, deliveryId }) => retryWebhookDelivery(webhookId, deliveryId),
    onSuccess: () => queryClient.invalidateQueries(['webhook-deliveries', viewingDeliveries]),
  });

  const resetForm = () => {
    setWebhookForm({
      name: '',
      url: '',
      secret: '',
      events: [],
      enabled: true,
      headers: {},
    });
  };

  const handleEdit = (webhook) => {
    setEditingWebhook(webhook);
    setWebhookForm({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events || [],
      enabled: webhook.enabled,
      headers: webhook.headers || {},
    });
  };

  const handleSubmit = () => {
    const data = { ...webhookForm };
    
    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleEvent = (eventId) => {
    setWebhookForm(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 400) return 'error';
    return 'warning';
  };

  return (
    <div className="webhooks-manager">
      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">Webhooks</h1>
          <p className="admin-page-subtitle">
            Configure HTTP callbacks for system events
          </p>
        </div>
        <button 
          className="admin-btn admin-btn-primary"
          onClick={() => { resetForm(); setShowAddModal(true); }}
        >
          ➕ Add Webhook
        </button>
      </div>

      {/* Webhooks List */}
      <div className="admin-card">
        {isLoading ? (
          <div className="admin-loading">
            <div className="admin-spinner"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">🔗</div>
            <div className="admin-empty-state-text">
              No webhooks configured yet
            </div>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => { resetForm(); setShowAddModal(true); }}
            >
              Create Your First Webhook
            </button>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Last Delivery</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map(webhook => (
                  <tr key={webhook.id} style={{ opacity: webhook.enabled ? 1 : 0.5 }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{webhook.name}</div>
                    </td>
                    <td>
                      <code style={{ 
                        fontSize: '0.75rem', 
                        background: 'var(--admin-bg-primary)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                      }}>
                        {webhook.url.length > 40 ? webhook.url.substring(0, 40) + '...' : webhook.url}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(webhook.events || []).slice(0, 3).map(event => {
                          const eventInfo = EVENT_TYPES.find(e => e.id === event);
                          return (
                            <span key={event} style={{
                              padding: '0.125rem 0.375rem',
                              background: 'rgba(99, 102, 241, 0.15)',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              color: '#a5b4fc',
                            }}>
                              {eventInfo?.icon} {event.split('.').pop()}
                            </span>
                          );
                        })}
                        {(webhook.events?.length || 0) > 3 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                            +{webhook.events.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${webhook.enabled ? 'active' : 'disabled'}`}>
                        {webhook.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                      {webhook.lastDelivery ? (
                        <div>
                          <span className={`status-badge ${getStatusBadge(webhook.lastDelivery.status)}`}>
                            {webhook.lastDelivery.status}
                          </span>
                          <div style={{ marginTop: '0.25rem' }}>
                            {formatDate(webhook.lastDelivery.timestamp)}
                          </div>
                        </div>
                      ) : (
                        'Never'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => setViewingDeliveries(webhook.id)}
                          title="View deliveries"
                        >
                          📋
                        </button>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => handleEdit(webhook)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => {
                            if (window.confirm(`Delete webhook "${webhook.name}"?`)) {
                              deleteMutation.mutate(webhook.id);
                            }
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingWebhook) && (
        <div className="admin-modal-overlay" onClick={() => { setShowAddModal(false); setEditingWebhook(null); resetForm(); }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
              </h3>
              <button 
                className="admin-modal-close" 
                onClick={() => { setShowAddModal(false); setEditingWebhook(null); resetForm(); }}
              >×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-label">Name *</label>
                <input
                  type="text"
                  className="admin-input"
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  placeholder="My Webhook"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Endpoint URL *</label>
                <input
                  type="url"
                  className="admin-input"
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Secret (for signature verification)</label>
                <input
                  type="password"
                  className="admin-input"
                  value={webhookForm.secret}
                  onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                  placeholder="Optional secret key"
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                  Used to sign payloads with HMAC-SHA256
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Events *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {EVENT_TYPES.map(event => (
                    <div
                      key={event.id}
                      onClick={() => toggleEvent(event.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        background: webhookForm.events.includes(event.id) 
                          ? 'rgba(99, 102, 241, 0.2)' 
                          : 'var(--admin-bg-tertiary)',
                        border: `1px solid ${webhookForm.events.includes(event.id) ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <span>{event.icon}</span>
                      <span>{event.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={webhookForm.enabled}
                    onChange={(e) => setWebhookForm({ ...webhookForm, enabled: e.target.checked })}
                  />
                  <span className="admin-toggle-slider"></span>
                </label>
                <span style={{ fontSize: '0.875rem' }}>Enable this webhook</span>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button 
                className="admin-btn admin-btn-secondary" 
                onClick={() => { setShowAddModal(false); setEditingWebhook(null); resetForm(); }}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSubmit}
                disabled={!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}
              >
                {editingWebhook ? 'Save Changes' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliveries Modal */}
      {viewingDeliveries && (
        <div className="admin-modal-overlay" onClick={() => setViewingDeliveries(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Delivery History</h3>
              <button 
                className="admin-modal-close" 
                onClick={() => setViewingDeliveries(null)}
              >×</button>
            </div>
            <div className="admin-modal-body" style={{ overflow: 'auto' }}>
              {deliveriesLoading ? (
                <div className="admin-loading">
                  <div className="admin-spinner"></div>
                </div>
              ) : deliveries.length === 0 ? (
                <div className="admin-empty-state">
                  <div className="admin-empty-state-icon">📭</div>
                  <div className="admin-empty-state-text">No deliveries yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {deliveries.map(delivery => (
                    <div key={delivery.id} style={{
                      background: 'var(--admin-bg-primary)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}>
                      <div
                        onClick={() => setExpandedDelivery(expandedDelivery === delivery.id ? null : delivery.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                        }}
                      >
                        <span className={`status-badge ${getStatusBadge(delivery.statusCode)}`}>
                          {delivery.statusCode}
                        </span>
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>
                          {delivery.event}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          {delivery.duration}ms
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                          {formatDate(delivery.timestamp)}
                        </span>
                        {delivery.statusCode >= 400 && (
                          <button
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              retryMutation.mutate({ webhookId: viewingDeliveries, deliveryId: delivery.id });
                            }}
                          >
                            🔄 Retry
                          </button>
                        )}
                        <span>{expandedDelivery === delivery.id ? '▼' : '▶'}</span>
                      </div>
                      
                      {expandedDelivery === delivery.id && (
                        <div style={{ 
                          padding: '1rem',
                          borderTop: '1px solid var(--admin-border)',
                          background: 'var(--admin-bg-secondary)',
                        }}>
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.375rem' }}>
                              Request Payload
                            </div>
                            <div className="code-editor" style={{ maxHeight: '150px', overflow: 'auto' }}>
                              <pre>{JSON.stringify(delivery.payload, null, 2)}</pre>
                            </div>
                          </div>
                          
                          <div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.375rem' }}>
                              Response
                            </div>
                            <div className="code-editor" style={{ maxHeight: '150px', overflow: 'auto' }}>
                              <pre>{delivery.response || 'No response body'}</pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebhooksManager;
