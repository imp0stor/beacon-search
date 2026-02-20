import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchOntology,
  addOntologyConcept,
  updateOntologyConcept,
  deleteOntologyConcept,
  importOntologyYAML,
  exportOntologyYAML,
} from '../utils/api';

// Tree Node Component
function TreeNode({ node, level = 0, selectedId, onSelect, onDrop, draggedId }) {
  const [expanded, setExpanded] = useState(level < 2);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleDragStart = (e) => {
    e.dataTransfer.setData('nodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (draggedId !== node.id) {
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const sourceId = e.dataTransfer.getData('nodeId');
    if (sourceId && sourceId !== node.id) {
      onDrop(sourceId, node.id);
    }
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${selectedId === node.id ? 'selected' : ''} ${dragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${level * 1.5}rem` }}
        onClick={() => onSelect(node)}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span
          className="tree-toggle"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </span>
        <span className="tree-icon">📁</span>
        <span className="tree-label">{node.label || node.name}</span>
        {node.synonyms?.length > 0 && (
          <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginLeft: 'auto' }}>
            +{node.synonyms.length} synonyms
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDrop={onDrop}
              draggedId={draggedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OntologyManager() {
  const queryClient = useQueryClient();
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importYAML, setImportYAML] = useState('');
  const [editForm, setEditForm] = useState({ label: '', synonyms: '', description: '' });

  // Fetch ontology
  const { data: ontology, isLoading } = useQuery({
    queryKey: ['ontology'],
    queryFn: fetchOntology,
    placeholderData: { concepts: [] },
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: addOntologyConcept,
    onSuccess: () => {
      queryClient.invalidateQueries(['ontology']);
      setShowAddModal(false);
      setEditForm({ label: '', synonyms: '', description: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateOntologyConcept(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ontology']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOntologyConcept,
    onSuccess: () => {
      queryClient.invalidateQueries(['ontology']);
      setSelectedNode(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: () => importOntologyYAML(importYAML),
    onSuccess: () => {
      queryClient.invalidateQueries(['ontology']);
      setShowImportModal(false);
      setImportYAML('');
    },
  });

  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node);
    setEditForm({
      label: node.label || node.name || '',
      synonyms: (node.synonyms || []).join(', '),
      description: node.description || '',
    });
  }, []);

  const handleDrop = useCallback((sourceId, targetId) => {
    // Move node to new parent
    updateMutation.mutate({
      id: sourceId,
      data: { parentId: targetId },
    });
  }, [updateMutation]);

  const handleExport = async () => {
    try {
      const data = await exportOntologyYAML();
      const blob = new Blob([data.yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ontology.yaml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export: ' + err.message);
    }
  };

  const handleSaveNode = () => {
    if (!selectedNode) return;
    
    updateMutation.mutate({
      id: selectedNode.id,
      data: {
        label: editForm.label,
        synonyms: editForm.synonyms.split(',').map(s => s.trim()).filter(Boolean),
        description: editForm.description,
      },
    });
  };

  const handleAddChild = () => {
    setShowAddModal(true);
  };

  const handleCreateNode = () => {
    addMutation.mutate({
      label: editForm.label,
      synonyms: editForm.synonyms.split(',').map(s => s.trim()).filter(Boolean),
      description: editForm.description,
      parentId: selectedNode?.id || null,
    });
  };

  const concepts = ontology?.concepts || [];

  return (
    <div className="ontology-manager">
      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">Ontology Manager</h1>
          <p className="admin-page-subtitle">
            Organize concepts and semantic relationships
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            📥 Import YAML
          </button>
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={handleExport}
          >
            📤 Export YAML
          </button>
          <button 
            className="admin-btn admin-btn-primary"
            onClick={() => {
              setSelectedNode(null);
              setEditForm({ label: '', synonyms: '', description: '' });
              setShowAddModal(true);
            }}
          >
            ➕ Add Root Concept
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.5rem' }}>
        {/* Tree View */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Concept Hierarchy</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              Drag and drop to reorganize
            </span>
          </div>

          {isLoading ? (
            <div className="admin-loading">
              <div className="admin-spinner"></div>
            </div>
          ) : concepts.length === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-state-icon">🌳</div>
              <div className="admin-empty-state-text">
                No concepts defined yet. Add your first root concept to get started.
              </div>
            </div>
          ) : (
            <div className="tree-view">
              {concepts.map((concept) => (
                <TreeNode
                  key={concept.id}
                  node={concept}
                  selectedId={selectedNode?.id}
                  onSelect={handleSelectNode}
                  onDrop={handleDrop}
                  draggedId={draggedId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">
              {selectedNode ? 'Edit Concept' : 'Concept Details'}
            </h3>
          </div>

          {selectedNode ? (
            <div>
              <div className="admin-form-group">
                <label className="admin-label">Label</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editForm.label}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  placeholder="Concept name"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Synonyms</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editForm.synonyms}
                  onChange={(e) => setEditForm({ ...editForm, synonyms: e.target.value })}
                  placeholder="synonym1, synonym2, synonym3"
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                  Comma-separated list of synonyms
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Description</label>
                <textarea
                  className="admin-textarea"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Optional description of this concept"
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={handleSaveNode}
                  disabled={updateMutation.isPending}
                >
                  Save Changes
                </button>
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={handleAddChild}
                >
                  Add Child
                </button>
                <button
                  className="admin-btn admin-btn-danger"
                  onClick={() => {
                    if (window.confirm(`Delete "${selectedNode.label}"?`)) {
                      deleteMutation.mutate(selectedNode.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>

              {/* Node Info */}
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--admin-border)' }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.75rem' }}>
                  Node Info
                </h4>
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <span style={{ color: 'var(--admin-text-muted)' }}>ID: </span>
                    <code style={{ background: 'var(--admin-bg-primary)', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                      {selectedNode.id}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--admin-text-muted)' }}>Children: </span>
                    {selectedNode.children?.length || 0}
                  </div>
                  <div>
                    <span style={{ color: 'var(--admin-text-muted)' }}>Synonyms: </span>
                    {selectedNode.synonyms?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty-state" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌳</div>
              <div style={{ fontSize: '0.875rem' }}>
                Select a concept from the tree to view and edit its details
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {selectedNode ? `Add Child to "${selectedNode.label}"` : 'Add Root Concept'}
              </h3>
              <button className="admin-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-label">Label</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editForm.label}
                  onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  placeholder="Concept name"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Synonyms</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editForm.synonyms}
                  onChange={(e) => setEditForm({ ...editForm, synonyms: e.target.value })}
                  placeholder="synonym1, synonym2, synonym3"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Description</label>
                <textarea
                  className="admin-textarea"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleCreateNode}
                disabled={!editForm.label || addMutation.isPending}
              >
                Create Concept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="admin-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Import Ontology from YAML</h3>
              <button className="admin-modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-label">YAML Content</label>
                <textarea
                  className="admin-textarea"
                  value={importYAML}
                  onChange={(e) => setImportYAML(e.target.value)}
                  placeholder={`concepts:
  - label: Technology
    synonyms: [tech, IT]
    children:
      - label: Software
        synonyms: [apps, programs]
      - label: Hardware
        synonyms: [devices, equipment]`}
                  rows={12}
                  style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                ⚠️ This will replace your current ontology
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => importMutation.mutate()}
                disabled={!importYAML || importMutation.isPending}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OntologyManager;
