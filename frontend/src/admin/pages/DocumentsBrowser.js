import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  fetchDocuments,
  fetchDocument,
  deleteDocument,
  bulkDeleteDocuments,
  reindexDocument,
  updateDocumentTags,
  fetchEmbeddingsVisualization,
} from '../utils/api';

function DocumentsBrowser() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showEmbeddings, setShowEmbeddings] = useState(false);
  const [editingTags, setEditingTags] = useState(null);
  const [tagInput, setTagInput] = useState('');
  
  const search = searchParams.get('search') || '';
  const source = searchParams.get('source') || '';
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = 20;

  // Fetch documents
  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', { search, source, page, limit }],
    queryFn: () => fetchDocuments({ q: search, source_id: source, page, limit }),
    placeholderData: { documents: [], total: 0 },
  });

  const documents = docsData?.documents || docsData || [];
  const totalDocs = docsData?.total || documents.length;
  const totalPages = Math.ceil(totalDocs / limit);

  // Fetch document detail
  const { data: docDetail } = useQuery({
    queryKey: ['document', viewingDoc],
    queryFn: () => fetchDocument(viewingDoc),
    enabled: !!viewingDoc,
  });

  // Fetch embeddings visualization
  const { data: embeddingsData } = useQuery({
    queryKey: ['embeddings', { limit: 200 }],
    queryFn: () => fetchEmbeddingsVisualization({ limit: 200 }),
    enabled: showEmbeddings,
    placeholderData: { points: [] },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries(['documents']);
      setViewingDoc(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries(['documents']);
      setSelectedDocs(new Set());
    },
  });

  const reindexMutation = useMutation({
    mutationFn: reindexDocument,
    onSuccess: () => {
      queryClient.invalidateQueries(['documents']);
      alert('Document queued for reindexing');
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: ({ id, tags }) => updateDocumentTags(id, tags),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents']);
      queryClient.invalidateQueries(['document', editingTags]);
      setEditingTags(null);
      setTagInput('');
    },
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newSearch = formData.get('search');
    setSearchParams({ search: newSearch, page: 1 });
  };

  const handleSelectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(d => d.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocs(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedDocs.size === 0) return;
    if (window.confirm(`Delete ${selectedDocs.size} document(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedDocs));
    }
  };

  const handleBulkReindex = () => {
    if (selectedDocs.size === 0) return;
    Array.from(selectedDocs).forEach(id => reindexMutation.mutate(id));
    setSelectedDocs(new Set());
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const truncate = (str, len = 100) => {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  };

  return (
    <div className="documents-browser">
      {/* Page Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Documents</h1>
        <p className="admin-page-subtitle">
          Browse, search, and manage indexed documents
        </p>
      </div>

      {/* Toolbar */}
      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <form onSubmit={handleSearch} className="admin-search" style={{ flex: 1, maxWidth: '400px' }}>
            <span className="admin-search-icon">🔍</span>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search documents..."
            />
          </form>

          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`admin-btn admin-btn-sm ${!showEmbeddings ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
              onClick={() => setShowEmbeddings(false)}
            >
              📋 List
            </button>
            <button
              className={`admin-btn admin-btn-sm ${showEmbeddings ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
              onClick={() => setShowEmbeddings(true)}
            >
              🎯 Embeddings
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedDocs.size > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem', alignSelf: 'center' }}>
                {selectedDocs.size} selected
              </span>
              <button
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={handleBulkReindex}
              >
                🔄 Re-index
              </button>
              <button
                className="admin-btn admin-btn-danger admin-btn-sm"
                onClick={handleBulkDelete}
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Embeddings Visualization */}
      {showEmbeddings && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Embeddings Visualization (t-SNE)</h3>
          </div>
          <div style={{ height: '500px', position: 'relative', background: 'var(--admin-bg-primary)', borderRadius: '8px' }}>
            {embeddingsData?.points?.length > 0 ? (
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                {embeddingsData.points.map((point, idx) => (
                  <circle
                    key={idx}
                    cx={point.x * 100}
                    cy={point.y * 100}
                    r={0.8}
                    fill={point.color || '#6366f1'}
                    opacity={0.7}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewingDoc(point.id)}
                  >
                    <title>{point.title}</title>
                  </circle>
                ))}
              </svg>
            ) : (
              <div className="admin-empty-state">
                <div className="admin-empty-state-icon">🎯</div>
                <div className="admin-empty-state-text">
                  Embeddings visualization requires processed documents
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents List */}
      {!showEmbeddings && (
        <div className="admin-card">
          {isLoading ? (
            <div className="admin-loading">
              <div className="admin-spinner"></div>
            </div>
          ) : documents.length === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-state-icon">📄</div>
              <div className="admin-empty-state-text">
                {search ? `No documents found for "${search}"` : 'No documents indexed yet'}
              </div>
            </div>
          ) : (
            <>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={selectedDocs.size === documents.length && documents.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>Title</th>
                      <th>Source</th>
                      <th>Tags</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedDocs.has(doc.id)}
                            onChange={() => toggleSelect(doc.id)}
                          />
                        </td>
                        <td>
                          <div 
                            style={{ fontWeight: 500, cursor: 'pointer', color: 'var(--admin-accent)' }}
                            onClick={() => setViewingDoc(doc.id)}
                          >
                            {truncate(doc.title, 60)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                            {truncate(doc.content, 100)}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {doc.source_name || doc.source_id?.substring(0, 8) || '-'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {(doc.tags || []).slice(0, 3).map((tag, idx) => (
                              <span key={idx} style={{
                                padding: '0.125rem 0.375rem',
                                background: 'rgba(99, 102, 241, 0.15)',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                color: '#a5b4fc',
                              }}>
                                {tag}
                              </span>
                            ))}
                            {(doc.tags?.length || 0) > 3 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                                +{doc.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                          {formatDate(doc.created_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => setViewingDoc(doc.id)}
                              title="View"
                            >
                              👁️
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => setEditingTags(doc.id)}
                              title="Edit tags"
                            >
                              🏷️
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => reindexMutation.mutate(doc.id)}
                              title="Re-index"
                            >
                              🔄
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => {
                                if (window.confirm('Delete this document?')) {
                                  deleteMutation.mutate(doc.id);
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--admin-border)',
                }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
                    Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalDocs)} of {totalDocs}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      disabled={page <= 1}
                      onClick={() => setSearchParams({ search, page: page - 1 })}
                    >
                      ← Prev
                    </button>
                    <span style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => setSearchParams({ search, page: page + 1 })}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Document Detail Modal */}
      {viewingDoc && docDetail && (
        <div className="admin-modal-overlay" onClick={() => setViewingDoc(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{docDetail.title}</h3>
              <button className="admin-modal-close" onClick={() => setViewingDoc(null)}>×</button>
            </div>
            <div className="admin-modal-body" style={{ overflow: 'auto' }}>
              {/* Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.25rem' }}>
                    Source
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>{docDetail.source_name || docDetail.source_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.25rem' }}>
                    Created
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>{formatDate(docDetail.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.25rem' }}>
                    Updated
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>{formatDate(docDetail.updated_at)}</div>
                </div>
              </div>

              {/* URL */}
              {docDetail.url && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.25rem' }}>
                    URL
                  </div>
                  <a href={docDetail.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-accent)', fontSize: '0.875rem' }}>
                    {docDetail.url}
                  </a>
                </div>
              )}

              {/* Tags */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                  Tags
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {(docDetail.tags || []).map((tag, idx) => (
                    <span key={idx} style={{
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(99, 102, 241, 0.15)',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      color: '#a5b4fc',
                    }}>
                      {tag}
                    </span>
                  ))}
                  {(!docDetail.tags || docDetail.tags.length === 0) && (
                    <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No tags</span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                  Content
                </div>
                <div style={{
                  background: 'var(--admin-bg-primary)',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}>
                  {docDetail.content}
                </div>
              </div>

              {/* All Metadata */}
              {docDetail.metadata && Object.keys(docDetail.metadata).length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                    All Metadata
                  </div>
                  <div className="code-editor">
                    <pre>{JSON.stringify(docDetail.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setEditingTags(docDetail.id)}
              >
                Edit Tags
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={() => {
                  if (window.confirm('Delete this document?')) {
                    deleteMutation.mutate(docDetail.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tags Modal */}
      {editingTags && (
        <div className="admin-modal-overlay" onClick={() => setEditingTags(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Edit Tags</h3>
              <button className="admin-modal-close" onClick={() => setEditingTags(null)}>×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="admin-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setEditingTags(null)}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => {
                  const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
                  updateTagsMutation.mutate({ id: editingTags, tags });
                }}
              >
                Save Tags
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsBrowser;
