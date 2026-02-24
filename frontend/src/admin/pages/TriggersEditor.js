import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  toggleTrigger,
  testTrigger,
  reorderTriggers,
} from '../utils/api';

const ACTION_TYPES = [
  { id: 'boost', label: 'Boost Results', icon: '⬆️', description: 'Increase relevance score' },
  { id: 'filter', label: 'Filter Results', icon: '🔍', description: 'Add search filters' },
  { id: 'inject', label: 'Inject Content', icon: '💉', description: 'Add custom results' },
  { id: 'redirect', label: 'Redirect', icon: '↩️', description: 'Redirect to URL' },
  { id: 'modify', label: 'Modify Query', icon: '✏️', description: 'Transform the query' },
  { id: 'notify', label: 'Send Notification', icon: '🔔', description: 'Trigger webhook' },
];

const CONDITION_TYPES = [
  { id: 'contains', label: 'Query contains' },
  { id: 'starts_with', label: 'Query starts with' },
  { id: 'ends_with', label: 'Query ends with' },
  { id: 'matches', label: 'Query matches (regex)' },
  { id: 'length_gt', label: 'Query length greater than' },
  { id: 'length_lt', label: 'Query length less than' },
];

function TriggersEditor() {
  const queryClient = useQueryClient();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  
  const [triggerForm, setTriggerForm] = useState({
    name: '',
    description: '',
    pattern: '',
    patternType: 'contains',
    conditions: [],
    action: 'boost',
    actionConfig: {},
    priority: 0,
    enabled: true,
  });

  // Fetch triggers
  const { data: triggers, isLoading } = useQuery({
    queryKey: ['triggers'],
    queryFn: fetchTriggers,
    placeholderData: [],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries(['triggers']);
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTrigger(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['triggers']);
      setEditingTrigger(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrigger,
    onSuccess: () => queryClient.invalidateQueries(['triggers']),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => toggleTrigger(id, enabled),
    onSuccess: () => queryClient.invalidateQueries(['triggers']),
  });

  const testMutation = useMutation({
    mutationFn: ({ id, query }) => testTrigger(id, query),
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ error: err.message }),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderTriggers,
    onSuccess: () => queryClient.invalidateQueries(['triggers']),
  });

  const resetForm = () => {
    setTriggerForm({
      name: '',
      description: '',
      pattern: '',
      patternType: 'contains',
      conditions: [],
      action: 'boost',
      actionConfig: {},
      priority: 0,
      enabled: true,
    });
  };

  const handleEdit = (trigger) => {
    setEditingTrigger(trigger);
    setTriggerForm({
      name: trigger.name,
      description: trigger.description || '',
      pattern: trigger.pattern,
      patternType: trigger.patternType || 'contains',
      conditions: trigger.conditions || [],
      action: trigger.action,
      actionConfig: trigger.actionConfig || {},
      priority: trigger.priority || 0,
      enabled: trigger.enabled,
    });
  };

  const handleSubmit = () => {
    const data = { ...triggerForm };
    
    if (editingTrigger) {
      updateMutation.mutate({ id: editingTrigger.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleTest = (triggerId) => {
    if (!testQuery.trim()) {
      alert('Please enter a test query');
      return;
    }
    setTestingId(triggerId);
    testMutation.mutate({ id: triggerId, query: testQuery });
  };

  const handleDragStart = (idx) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const newOrder = [...triggers];
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, removed);
    
    // Visual reorder (will be committed on drop)
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      return;
    }
    
    const newOrder = triggers.map(t => t.id);
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, removed);
    
    reorderMutation.mutate(newOrder);
    setDraggedIdx(null);
  };

  const addCondition = () => {
    setTriggerForm({
      ...triggerForm,
      conditions: [...triggerForm.conditions, { type: 'contains', value: '' }],
    });
  };

  const updateCondition = (idx, field, value) => {
    const newConditions = [...triggerForm.conditions];
    newConditions[idx] = { ...newConditions[idx], [field]: value };
    setTriggerForm({ ...triggerForm, conditions: newConditions });
  };

  const removeCondition = (idx) => {
    setTriggerForm({
      ...triggerForm,
      conditions: triggerForm.conditions.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="triggers-editor">
      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">Triggers</h1>
          <p className="admin-page-subtitle">
            Create rules to modify search behavior based on query patterns
          </p>
        </div>
        <button 
          className="admin-btn admin-btn-primary"
          onClick={() => { resetForm(); setShowAddModal(true); }}
        >
          ➕ Add Trigger
        </button>
      </div>

      {/* Test Query Bar */}
      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="admin-search" style={{ flex: 1, maxWidth: '500px' }}>
            <span className="admin-search-icon">🧪</span>
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Enter a test query to see which triggers match..."
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
            Drag triggers to reorder priority
          </span>
        </div>
      </div>

      {/* Triggers List */}
      <div className="admin-card">
        {isLoading ? (
          <div className="admin-loading">
            <div className="admin-spinner"></div>
          </div>
        ) : triggers.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">⚡</div>
            <div className="admin-empty-state-text">
              No triggers configured yet
            </div>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => { resetForm(); setShowAddModal(true); }}
            >
              Create Your First Trigger
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {triggers.map((trigger, idx) => {
              const actionInfo = ACTION_TYPES.find(a => a.id === trigger.action);
              const isMatch = testResult?.triggerId === trigger.id && testingId === trigger.id;
              
              return (
                <div
                  key={trigger.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: isMatch ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.5)',
                    border: isMatch ? '1px solid var(--admin-success)' : '1px solid var(--admin-border)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    opacity: !trigger.enabled ? 0.5 : 1,
                  }}
                >
                  {/* Drag Handle */}
                  <div style={{ color: 'var(--admin-text-muted)', fontSize: '1rem' }}>⋮⋮</div>

                  {/* Toggle */}
                  <label className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={trigger.enabled}
                      onChange={(e) => toggleMutation.mutate({ id: trigger.id, enabled: e.target.checked })}
                    />
                    <span className="admin-toggle-slider"></span>
                  </label>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500 }}>{trigger.name}</span>
                      <span style={{
                        padding: '0.125rem 0.375rem',
                        background: 'rgba(99, 102, 241, 0.15)',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: '#a5b4fc',
                      }}>
                        {actionInfo?.icon} {actionInfo?.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                      Pattern: <code style={{ background: 'var(--admin-bg-primary)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                        {trigger.patternType}: "{trigger.pattern}"
                      </code>
                    </div>
                  </div>

                  {/* Priority */}
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-muted)', textTransform: 'uppercase' }}>Priority</div>
                    <div style={{ fontWeight: 600 }}>#{idx + 1}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button
                      className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => handleTest(trigger.id)}
                      title="Test trigger"
                    >
                      🧪
                    </button>
                    <button
                      className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => handleEdit(trigger)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete trigger "${trigger.name}"?`)) {
                          deleteMutation.mutate(trigger.id);
                        }
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div 
          className="admin-card" 
          style={{ 
            marginTop: '1rem',
            border: testResult.matched ? '1px solid var(--admin-success)' : '1px solid var(--admin-border)',
          }}
        >
          <div className="admin-card-header">
            <h3 className="admin-card-title">Test Result</h3>
            <button 
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => setTestResult(null)}
            >
              ×
            </button>
          </div>
          {testResult.error ? (
            <div style={{ color: 'var(--admin-danger)' }}>{testResult.error}</div>
          ) : (
            <div>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: testResult.matched ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
                  {testResult.matched ? '✓ Trigger matched!' : '✗ No match'}
                </span>
              </div>
              {testResult.transformedQuery && (
                <div style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--admin-text-muted)' }}>Transformed query: </span>
                  <code>{testResult.transformedQuery}</code>
                </div>
              )}
              {testResult.actions && (
                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--admin-text-muted)' }}>Actions: </span>
                  <code>{JSON.stringify(testResult.actions)}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingTrigger) && (
        <div className="admin-modal-overlay" onClick={() => { setShowAddModal(false); setEditingTrigger(null); resetForm(); }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {editingTrigger ? 'Edit Trigger' : 'Create Trigger'}
              </h3>
              <button 
                className="admin-modal-close" 
                onClick={() => { setShowAddModal(false); setEditingTrigger(null); resetForm(); }}
              >×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-label">Name *</label>
                <input
                  type="text"
                  className="admin-input"
                  value={triggerForm.name}
                  onChange={(e) => setTriggerForm({ ...triggerForm, name: e.target.value })}
                  placeholder="My Trigger"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Description</label>
                <input
                  type="text"
                  className="admin-input"
                  value={triggerForm.description}
                  onChange={(e) => setTriggerForm({ ...triggerForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              {/* Pattern */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1rem' }}>
                <div className="admin-form-group">
                  <label className="admin-label">Pattern Type</label>
                  <select
                    className="admin-select"
                    value={triggerForm.patternType}
                    onChange={(e) => setTriggerForm({ ...triggerForm, patternType: e.target.value })}
                  >
                    {CONDITION_TYPES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Pattern Value</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={triggerForm.pattern}
                    onChange={(e) => setTriggerForm({ ...triggerForm, pattern: e.target.value })}
                    placeholder={triggerForm.patternType === 'matches' ? '.*\\bhelp\\b.*' : 'search term'}
                  />
                </div>
              </div>

              {/* Action */}
              <div className="admin-form-group">
                <label className="admin-label">Action</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {ACTION_TYPES.map(action => (
                    <div
                      key={action.id}
                      onClick={() => setTriggerForm({ ...triggerForm, action: action.id })}
                      style={{
                        padding: '0.75rem',
                        background: triggerForm.action === action.id ? 'rgba(99, 102, 241, 0.2)' : 'var(--admin-bg-tertiary)',
                        border: `1px solid ${triggerForm.action === action.id ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{action.icon}</div>
                      <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{action.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Config */}
              {triggerForm.action === 'boost' && (
                <div className="admin-form-group">
                  <label className="admin-label">Boost Factor</label>
                  <input
                    type="number"
                    className="admin-input"
                    value={triggerForm.actionConfig.factor || 1.5}
                    onChange={(e) => setTriggerForm({
                      ...triggerForm,
                      actionConfig: { ...triggerForm.actionConfig, factor: parseFloat(e.target.value) }
                    })}
                    min={0.1}
                    max={10}
                    step={0.1}
                    style={{ width: '150px' }}
                  />
                </div>
              )}

              {triggerForm.action === 'redirect' && (
                <div className="admin-form-group">
                  <label className="admin-label">Redirect URL</label>
                  <input
                    type="url"
                    className="admin-input"
                    value={triggerForm.actionConfig.url || ''}
                    onChange={(e) => setTriggerForm({
                      ...triggerForm,
                      actionConfig: { ...triggerForm.actionConfig, url: e.target.value }
                    })}
                    placeholder="https://example.com/page"
                  />
                </div>
              )}

              {triggerForm.action === 'modify' && (
                <div className="admin-form-group">
                  <label className="admin-label">Query Transformation</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={triggerForm.actionConfig.transform || ''}
                    onChange={(e) => setTriggerForm({
                      ...triggerForm,
                      actionConfig: { ...triggerForm.actionConfig, transform: e.target.value }
                    })}
                    placeholder="$query AND category:docs"
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                    Use $query to reference the original query
                  </div>
                </div>
              )}

              {/* Enable */}
              <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={triggerForm.enabled}
                    onChange={(e) => setTriggerForm({ ...triggerForm, enabled: e.target.checked })}
                  />
                  <span className="admin-toggle-slider"></span>
                </label>
                <span style={{ fontSize: '0.875rem' }}>Enable this trigger</span>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button 
                className="admin-btn admin-btn-secondary" 
                onClick={() => { setShowAddModal(false); setEditingTrigger(null); resetForm(); }}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSubmit}
                disabled={!triggerForm.name || !triggerForm.pattern || createMutation.isPending || updateMutation.isPending}
              >
                {editingTrigger ? 'Save Changes' : 'Create Trigger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TriggersEditor;
