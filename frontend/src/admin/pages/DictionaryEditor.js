import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDictionary,
  addDictionaryTerm,
  updateDictionaryTerm,
  deleteDictionaryTerm,
  importDictionaryCSV,
} from '../utils/api';

function DictionaryEditor() {
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  
  const [termForm, setTermForm] = useState({
    term: '',
    synonyms: '',
    acronyms: '',
    boostWeight: 1.0,
    domain: '',
    definition: '',
  });

  // Fetch dictionary
  const { data: dictionary, isLoading } = useQuery({
    queryKey: ['dictionary', { search: searchQuery, domain: domainFilter }],
    queryFn: () => fetchDictionary({ search: searchQuery, domain: domainFilter }),
    placeholderData: { terms: [], domains: [] },
  });

  const terms = dictionary?.terms || [];
  const domains = dictionary?.domains || [];

  // Mutations
  const addMutation = useMutation({
    mutationFn: addDictionaryTerm,
    onSuccess: () => {
      queryClient.invalidateQueries(['dictionary']);
      setShowAddModal(false);
      resetForm();
    },
    onError: (err) => alert('Failed to add term: ' + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDictionaryTerm(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dictionary']);
      setEditingTerm(null);
      resetForm();
    },
    onError: (err) => alert('Failed to update term: ' + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDictionaryTerm,
    onSuccess: () => {
      queryClient.invalidateQueries(['dictionary']);
    },
    onError: (err) => alert('Failed to delete term: ' + err.message),
  });

  const importMutation = useMutation({
    mutationFn: () => importDictionaryCSV(importFile),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['dictionary']);
      setShowImportModal(false);
      setImportFile(null);
      alert(`Imported ${data.imported} terms`);
    },
    onError: (err) => alert('Failed to import: ' + err.message),
  });

  const resetForm = () => {
    setTermForm({
      term: '',
      synonyms: '',
      acronyms: '',
      boostWeight: 1.0,
      domain: '',
      definition: '',
    });
  };

  const handleEdit = (term) => {
    setEditingTerm(term);
    setTermForm({
      term: term.term,
      synonyms: (term.synonyms || []).join(', '),
      acronyms: (term.acronyms || []).join(', '),
      boostWeight: term.boostWeight || 1.0,
      domain: term.domain || '',
      definition: term.definition || '',
    });
  };

  const handleSubmit = () => {
    const data = {
      term: termForm.term,
      synonyms: termForm.synonyms.split(',').map(s => s.trim()).filter(Boolean),
      acronyms: termForm.acronyms.split(',').map(s => s.trim()).filter(Boolean),
      boostWeight: parseFloat(termForm.boostWeight) || 1.0,
      domain: termForm.domain || null,
      definition: termForm.definition || null,
    };

    if (editingTerm) {
      updateMutation.mutate({ id: editingTerm.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const TermFormModal = () => (
    <div className="admin-modal-overlay" onClick={() => { setShowAddModal(false); setEditingTerm(null); resetForm(); }}>
      <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">
            {editingTerm ? 'Edit Term' : 'Add New Term'}
          </h3>
          <button 
            className="admin-modal-close" 
            onClick={() => { setShowAddModal(false); setEditingTerm(null); resetForm(); }}
          >×</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-group">
            <label className="admin-label">Term *</label>
            <input
              type="text"
              className="admin-input"
              value={termForm.term}
              onChange={(e) => setTermForm({ ...termForm, term: e.target.value })}
              placeholder="Primary term"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-form-group">
              <label className="admin-label">Synonyms</label>
              <input
                type="text"
                className="admin-input"
                value={termForm.synonyms}
                onChange={(e) => setTermForm({ ...termForm, synonyms: e.target.value })}
                placeholder="syn1, syn2, syn3"
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                Comma-separated
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Acronyms</label>
              <input
                type="text"
                className="admin-input"
                value={termForm.acronyms}
                onChange={(e) => setTermForm({ ...termForm, acronyms: e.target.value })}
                placeholder="ACR, ABBR"
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                Comma-separated
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-form-group">
              <label className="admin-label">Domain</label>
              <input
                type="text"
                className="admin-input"
                value={termForm.domain}
                onChange={(e) => setTermForm({ ...termForm, domain: e.target.value })}
                placeholder="e.g., technology, medical"
                list="domains-list"
              />
              <datalist id="domains-list">
                {domains.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Boost Weight</label>
              <input
                type="number"
                className="admin-input"
                value={termForm.boostWeight}
                onChange={(e) => setTermForm({ ...termForm, boostWeight: e.target.value })}
                min={0.1}
                max={10}
                step={0.1}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                1.0 = normal, higher = more important
              </div>
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Definition</label>
            <textarea
              className="admin-textarea"
              value={termForm.definition}
              onChange={(e) => setTermForm({ ...termForm, definition: e.target.value })}
              placeholder="Optional definition or description"
              rows={3}
            />
          </div>
        </div>
        <div className="admin-modal-footer">
          <button 
            className="admin-btn admin-btn-secondary" 
            onClick={() => { setShowAddModal(false); setEditingTerm(null); resetForm(); }}
          >
            Cancel
          </button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleSubmit}
            disabled={!termForm.term || addMutation.isPending || updateMutation.isPending}
          >
            {editingTerm ? 'Save Changes' : 'Add Term'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dictionary-editor">
      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">Dictionary</h1>
          <p className="admin-page-subtitle">
            Manage terms, synonyms, and search boost weights
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            📥 Import CSV
          </button>
          <button 
            className="admin-btn admin-btn-primary"
            onClick={() => { resetForm(); setShowAddModal(true); }}
          >
            ➕ Add Term
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="admin-search" style={{ flex: 1, maxWidth: '400px' }}>
            <span className="admin-search-icon">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search terms..."
            />
          </div>

          <select
            className="admin-select"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">All Domains</option>
            {domains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>

          <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
            {terms.length} terms
          </div>
        </div>
      </div>

      {/* Terms List */}
      <div className="admin-card">
        {isLoading ? (
          <div className="admin-loading">
            <div className="admin-spinner"></div>
          </div>
        ) : terms.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">📖</div>
            <div className="admin-empty-state-text">
              {searchQuery ? `No terms found for "${searchQuery}"` : 'No terms in dictionary yet'}
            </div>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => { resetForm(); setShowAddModal(true); }}
            >
              Add Your First Term
            </button>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Synonyms</th>
                  <th>Acronyms</th>
                  <th>Domain</th>
                  <th>Boost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map(term => (
                  <tr key={term.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{term.term}</div>
                      {term.definition && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          {term.definition.substring(0, 60)}{term.definition.length > 60 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(term.synonyms || []).slice(0, 4).map((syn, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.375rem',
                            background: 'rgba(99, 102, 241, 0.15)',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: '#a5b4fc',
                          }}>
                            {syn}
                          </span>
                        ))}
                        {(term.synonyms?.length || 0) > 4 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                            +{term.synonyms.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {(term.acronyms || []).map((acr, idx) => (
                          <span key={idx} style={{
                            padding: '0.125rem 0.375rem',
                            background: 'rgba(245, 158, 11, 0.15)',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: '#fbbf24',
                            fontWeight: 500,
                          }}>
                            {acr}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {term.domain ? (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(16, 185, 129, 0.15)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: '#34d399',
                        }}>
                          {term.domain}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontWeight: term.boostWeight > 1 ? 600 : 400,
                        color: term.boostWeight > 1 ? 'var(--admin-success)' : 'var(--admin-text-secondary)',
                      }}>
                        {term.boostWeight?.toFixed(1) || '1.0'}×
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => handleEdit(term)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => {
                            if (window.confirm(`Delete "${term.term}"?`)) {
                              deleteMutation.mutate(term.id);
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
      {(showAddModal || editingTerm) && <TermFormModal />}

      {/* Import Modal */}
      {showImportModal && (
        <div className="admin-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Import from CSV</h3>
              <button className="admin-modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-label">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="admin-input"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  style={{ padding: '0.5rem' }}
                />
              </div>
              <div style={{ 
                padding: '1rem',
                background: 'var(--admin-bg-primary)',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                marginTop: '1rem',
              }}>
                <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Expected CSV format:</div>
                <code style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                  term,synonyms,acronyms,domain,boost_weight
                  <br />
                  machine learning,"ML,AI",ML,technology,1.5
                  <br />
                  kubernetes,k8s,"K8S,K8",devops,1.2
                </code>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => importMutation.mutate()}
                disabled={!importFile || importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DictionaryEditor;
