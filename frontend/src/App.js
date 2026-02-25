import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Bookshelf from './Bookshelf';
import ConfigWizard from './ConfigWizard';
import { LayoutShell, NavRail, KpiCard, TableCard, StatusPanel, ChartCard } from './ui';
import { useSharedUI } from './shared-ui/feature-flags.js';
import RichContentView from './components/RichContentView';
import TagCloud from './components/TagCloud.jsx';
import TagFilterSidebar from './components/TagFilterSidebar.jsx';
import InfiniteScrollResults from './components/InfiniteScrollResults.jsx';
import AdminLayout from './admin/AdminLayout.tsx';
import AdminRoute from './admin/components/AdminRoute.tsx';
import Dashboard from './admin/pages/Dashboard.tsx';
import ServersPage from './admin/pages/ServersPage.tsx';
import DocumentTypesPage from './admin/pages/DocumentTypesPage.tsx';
import CrawlersPage from './admin/pages/CrawlersPage.tsx';
import SystemSettingsPage from './admin/pages/SystemSettingsPage.tsx';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ENTITY_ICONS = {
  PERSON: '👤',
  ORGANIZATION: '🏢',
  LOCATION: '📍',
  DATE: '📅',
  MONEY: '💰',
  EMAIL: '✉️',
  PHONE: '📞',
  URL: '🔗',
  PRODUCT: '📦',
  EVENT: '🎉'
};

const WORKSPACES = [
  {
    id: 'search',
    label: 'Search',
    icon: '🔎',
    description: 'Semantic + keyword retrieval across the knowledge base.'
  },
  {
    id: 'explore',
    label: 'Faceted Explore',
    icon: '🧭',
    description: 'Pivot by tags, entities, and sentiment to refine discovery.'
  },
  {
    id: 'connectors',
    label: 'Source Connectors',
    icon: '🔌',
    description: 'Monitor ingestion sources and coverage health.'
  },
  {
    id: 'relationships',
    label: 'Relationships',
    icon: '🧩',
    description: 'Inspect document + entity relationships and shared context.'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: '📈',
    description: 'Track usage signals, knowledge gaps, and enrichment progress.'
  }
];

const CONNECTOR_STATUS = [
  { name: 'File Share', detail: '32 sources', status: 'Connected' },
  { name: 'Nostr Relay', detail: '7 relays', status: 'Connected' },
  { name: 'RSS Feeds', detail: '18 feeds', status: 'Paused' },
  { name: 'API Pull', detail: '5 endpoints', status: 'Connected' },
  { name: 'Ticketing Export', detail: 'Zendesk', status: 'Pending' }
];

function App() {
  const isAdminPath = window.location.pathname.startsWith('/admin');
  if (isAdminPath) {
    return (
      <Routes>
        <Route
          path="/admin"
          element={(
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          )}
        >
          <Route index element={<Dashboard />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="document-types" element={<DocumentTypesPage />} />
          <Route path="crawlers" element={<CrawlersPage />} />
          <Route path="settings" element={<SystemSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  const { enabled: sharedUiEnabled } = useSharedUI();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchMode, setSearchMode] = useState('hybrid');
  const [searchTime, setSearchTime] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [documentSample, setDocumentSample] = useState([]);

  const [facets, setFacets] = useState(null);
  const [tagCloud, setTagCloud] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [minQuality, setMinQuality] = useState(0.3);
  const [showMediaOnly, setShowMediaOnly] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [tagFilterMode, setTagFilterMode] = useState('and');

  const [metadataStats, setMetadataStats] = useState({ sources: [], types: [], authors: [] });
  const [ontologyTree, setOntologyTree] = useState([]);
  const [conceptPath, setConceptPath] = useState([]);

  const [expandedDoc, setExpandedDoc] = useState(null);
  const [docDetail, setDocDetail] = useState({ tags: [], entities: [], metadata: [], related: [], suggestions: [] });
  const [detailTab, setDetailTab] = useState('metadata');
  const [newTag, setNewTag] = useState('');

  const [expandedContent, setExpandedContent] = useState(new Set());

  const [nostrPubkey, setNostrPubkey] = useState(null);
  const [nostrLoading, setNostrLoading] = useState(false);

  const [nlpStatus, setNlpStatus] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: '', content: '', url: '' });

  const [showBookshelf, setShowBookshelf] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const [activeWorkspace, setActiveWorkspace] = useState('search');

  useEffect(() => {
    loadFacets();
    loadTagCloud();
    loadMetadataStats();
    loadOntologyTree();
    loadNlpStatus();

    const savedPubkey = localStorage.getItem('nostr_pubkey');
    if (savedPubkey) {
      setNostrPubkey(savedPubkey);
    }
  }, []);

  const loadFacets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/search/facets`);
      if (response.ok) {
        const data = await response.json();
        setFacets(data);
      }
    } catch (err) {
      console.error('Failed to load facets:', err);
    }
  };

  const loadTagCloud = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tags/cloud?limit=30`);
      if (response.ok) {
        const data = await response.json();
        setTagCloud(data);
      } else {
        // TODO: backend endpoint /api/tags/cloud not available; using local adapter instead.
        setTagCloud([]);
      }
    } catch (err) {
      console.error('Failed to load tag cloud:', err);
      // TODO: fallback to local adapter when endpoint is unavailable.
      setTagCloud([]);
    }
  };

  const loadMetadataStats = async () => {
    try {
      const [statsRes, docsRes] = await Promise.all([
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/documents?limit=200`)
      ]);

      let sources = [];
      if (statsRes.ok) {
        const stats = await statsRes.json();
        sources = stats.sourceStats || [];
      }

      let docs = [];
      if (docsRes.ok) {
        docs = await docsRes.json();
        setDocumentSample(docs);
      }

      const typeCounts = new Map();
      const authorCounts = new Map();
      docs.forEach((doc) => {
        const type = doc.type || doc.category || 'Unknown';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
        const author = doc.author || doc.metadata?.author;
        if (author) {
          authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
        }
      });

      setMetadataStats({
        sources,
        types: Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count })),
        authors: Array.from(authorCounts.entries()).map(([author, count]) => ({ author, count }))
      });
    } catch (err) {
      console.error('Failed to load metadata stats:', err);
    }
  };

  const loadOntologyTree = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ontology?tree=true`);
      if (response.ok) {
        const data = await response.json();
        setOntologyTree(data);
      } else {
        // TODO: Provide ontology tree endpoint to enable concept drill-down.
        setOntologyTree([]);
      }
    } catch (err) {
      console.error('Failed to load ontology tree:', err);
      setOntologyTree([]);
    }
  };

  const loadNlpStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/nlp/status`);
      if (response.ok) {
        const data = await response.json();
        setNlpStatus(data);
      }
    } catch (err) {
      console.error('Failed to load NLP status:', err);
    }
  };

  const normalizeTag = (tag) => (tag || '').toString().trim().toLowerCase();

  const extractTags = (doc) => {
    if (!doc) return [];
    const rawTags = [];

    if (Array.isArray(doc.tags)) {
      doc.tags.forEach((tag) => {
        if (typeof tag === 'string') {
          rawTags.push(tag);
        } else if (tag?.tag) {
          rawTags.push(tag.tag);
        }
      });
    }

    if (Array.isArray(doc.metadata?.tags)) {
      rawTags.push(...doc.metadata.tags);
    }

    if (Array.isArray(doc.attributes?.tags)) {
      rawTags.push(...doc.attributes.tags);
    }

    return rawTags
      .map((tag) => tag?.toString().trim())
      .filter(Boolean);
  };

  const buildTagCounts = (docs) => {
    const counts = new Map();
    docs.forEach((doc) => {
      extractTags(doc).forEach((tag) => {
        const key = normalizeTag(tag);
        if (!key) return;
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { tag, count: 1 });
        }
      });
    });

    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  };

  const selectedConcept = conceptPath.length > 0 ? conceptPath[conceptPath.length - 1] : null;

  const matchesTagFilter = (docTags) => {
    if (selectedTags.length === 0) return true;
    if (docTags.length === 0) return false;

    const docTagSet = new Set(docTags.map((tag) => normalizeTag(tag)));

    if (tagFilterMode === 'or') {
      return selectedTags.some((tag) => docTagSet.has(normalizeTag(tag)));
    }

    return selectedTags.every((tag) => docTagSet.has(normalizeTag(tag)));
  };

  const matchesConcept = (doc, concept) => {
    if (!concept) return true;
    const term = concept.term || concept.label || concept.name || concept;
    if (!term) return true;

    const docTags = extractTags(doc).map((tag) => normalizeTag(tag));
    const normalizedTerm = normalizeTag(term);

    if (docTags.includes(normalizedTerm)) return true;

    // TODO: Wire to backend concept taxonomy when available.
    return (
      (doc.title && doc.title.toLowerCase().includes(normalizedTerm)) ||
      (doc.content && doc.content.toLowerCase().includes(normalizedTerm))
    );
  };

  const applyFilters = (docs) => {
    return docs.filter((doc) => {
      const docTags = extractTags(doc);

      if (!matchesTagFilter(docTags)) return false;

      if (selectedEntity) {
        const entities = doc.entities || doc.metadata?.entities || [];
        const entityMatch = entities.some((entity) => {
          const type = entity.type || entity.entity_type;
          const value = entity.normalizedValue || entity.value || entity.name;
          return type === selectedEntity.type && value === selectedEntity.value;
        });
        if (!entityMatch) return false;
      }

      if (selectedSentiment) {
        const sentiment = doc.sentiment || doc.metadata?.sentiment;
        if (sentiment !== selectedSentiment) return false;
      }

      if (selectedSource && doc.source_id !== selectedSource) return false;
      if (selectedDocType && (doc.type || doc.category) !== selectedDocType) return false;
      if (selectedAuthor && (doc.author || doc.metadata?.author) !== selectedAuthor) return false;
      if (!matchesConcept(doc, selectedConcept)) return false;

      return true;
    });
  };

  const search = useCallback(async (e) => {
    e?.preventDefault();

    setLoading(true);
    setError(null);
    setExpandedDoc(null);
    const startTime = Date.now();

    try {
      let url;
      const params = new URLSearchParams();

      if (query) params.append('q', query);
      params.append('limit', '20');

      const filterActive = selectedTags.length > 0 || selectedEntity || selectedSentiment || selectedSource || selectedDocType || selectedAuthor || selectedConcept;

      if (filterActive) {
        // Try server-side filtered search when available, otherwise fallback to client-side filtering.
        url = `${API_URL}/api/search/filtered?${params.toString()}`;
        if (selectedTags.length > 0) url += `&tags=${selectedTags.join(',')}`;
        if (selectedEntity) url += `&entityType=${selectedEntity.type}&entityValue=${selectedEntity.value}`;
        if (selectedSentiment) url += `&sentiment=${selectedSentiment}`;
      } else if (query) {
        params.append('mode', searchMode);
        url = `${API_URL}/api/search?${params.toString()}`;
      } else {
        url = `${API_URL}/api/documents?limit=20`;
      }

      let response = await fetch(url);
      if (!response.ok && filterActive) {
        // TODO: /api/search/filtered not available yet; fall back to basic search.
        if (query) {
          params.append('mode', searchMode);
          response = await fetch(`${API_URL}/api/search?${params.toString()}`);
        } else {
          response = await fetch(`${API_URL}/api/documents?limit=20`);
        }
      }

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();

      setResults(data.results || data);
      setHasSearched(true);
      setSearchTime(Date.now() - startTime);
    } catch (err) {
      setError('Search failed. Make sure the backend is running.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, searchMode, selectedTags, selectedEntity, selectedSentiment, selectedSource, selectedDocType, selectedAuthor, selectedConcept]);

  const baseResults = useMemo(() => (
    hasSearched ? results : documentSample
  ), [hasSearched, results, documentSample]);

  const filteredResults = useMemo(() => (
    applyFilters(baseResults)
  ), [baseResults, selectedTags, tagFilterMode, selectedEntity, selectedSentiment, selectedSource, selectedDocType, selectedAuthor, selectedConcept]);

  const recomputedTagCloud = useMemo(() => (
    buildTagCounts(filteredResults)
  ), [filteredResults]);

  const displayedTagCloud = useMemo(() => (
    recomputedTagCloud.length > 0 ? recomputedTagCloud : tagCloud
  ), [recomputedTagCloud, tagCloud]);

  const sourceNameLookup = useMemo(() => (
    new Map(metadataStats.sources.map((source) => [source.id, source.name]))
  ), [metadataStats.sources]);

  const derivedMetadata = useMemo(() => {
    const counts = {
      sources: new Map(),
      types: new Map(),
      authors: new Map()
    };

    filteredResults.forEach((doc) => {
      if (doc.source_id) {
        const name = sourceNameLookup.get(doc.source_id) || doc.source_id.substring(0, 8);
        const current = counts.sources.get(doc.source_id) || { id: doc.source_id, name, count: 0 };
        current.count += 1;
        counts.sources.set(doc.source_id, current);
      }

      const type = doc.type || doc.category;
      if (type) {
        counts.types.set(type, (counts.types.get(type) || 0) + 1);
      }

      const author = doc.author || doc.metadata?.author;
      if (author) {
        counts.authors.set(author, (counts.authors.get(author) || 0) + 1);
      }
    });

    return {
      sources: Array.from(counts.sources.values()).sort((a, b) => b.count - a.count),
      types: Array.from(counts.types.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      authors: Array.from(counts.authors.entries()).map(([author, count]) => ({ author, count })).sort((a, b) => b.count - a.count)
    };
  }, [filteredResults, metadataStats.sources]);

  const loadDocDetail = async (docId) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
      return;
    }

    setExpandedDoc(docId);

    try {
      const [tagsRes, entitiesRes, metadataRes, relatedRes, suggestionsRes] = await Promise.all([
        fetch(`${API_URL}/api/documents/${docId}/tags`),
        fetch(`${API_URL}/api/documents/${docId}/entities`),
        fetch(`${API_URL}/api/documents/${docId}/metadata`),
        fetch(`${API_URL}/api/documents/${docId}/related?limit=5`),
        fetch(`${API_URL}/api/documents/${docId}/tag-suggestions?limit=8`)
      ]);

      const [tags, entities, metadata, related, suggestions] = await Promise.all([
        tagsRes.ok ? tagsRes.json() : [],
        entitiesRes.ok ? entitiesRes.json() : [],
        metadataRes.ok ? metadataRes.json() : [],
        relatedRes.ok ? relatedRes.json() : [],
        suggestionsRes.ok ? suggestionsRes.json() : []
      ]);

      setDocDetail({ tags, entities, metadata, related, suggestions });
    } catch (err) {
      console.error('Failed to load document details:', err);
    }
  };

  const addTag = async (docId, tag) => {
    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      });

      if (response.ok) {
        const tags = await response.json();
        setDocDetail(prev => ({ ...prev, tags }));
        setNewTag('');
        loadTagCloud();
      }
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const removeTag = async (docId, tag) => {
    try {
      await fetch(`${API_URL}/api/documents/${docId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE'
      });
      setDocDetail(prev => ({
        ...prev,
        tags: prev.tags.filter(t => t.tag !== tag)
      }));
      loadTagCloud();
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const processAllNlp = async () => {
    try {
      const response = await fetch(`${API_URL}/api/nlp/process-all`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        loadFacets();
        loadTagCloud();
        loadNlpStatus();
      }
    } catch (err) {
      alert('Failed to process NLP');
    }
  };

  const addDocument = async (e) => {
    e.preventDefault();
    if (!newDoc.title.trim() || !newDoc.content.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      });

      if (!response.ok) throw new Error('Failed to add document');

      const doc = await response.json();
      await fetch(`${API_URL}/api/documents/${doc.id}/process-nlp`, { method: 'POST' });

      setNewDoc({ title: '', content: '', url: '' });
      setShowAddForm(false);
      loadFacets();
      loadTagCloud();
      alert('Document added and processed!');
    } catch (err) {
      alert('Failed to add document');
    }
  };

  const toggleTag = (tag) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;

    setSelectedTags(prev =>
      prev.includes(normalized)
        ? prev.filter(t => t !== normalized)
        : [...prev, normalized]
    );
  };

  const toggleEntity = (type, value) => {
    if (selectedEntity?.type === type && selectedEntity?.value === value) {
      setSelectedEntity(null);
    } else {
      setSelectedEntity({ type, value });
    }
  };

  const toggleSource = (sourceId) => {
    setSelectedSource(prev => (prev === sourceId ? null : sourceId));
  };

  const toggleDocType = (docType) => {
    setSelectedDocType(prev => (prev === docType ? null : docType));
  };

  const toggleAuthor = (author) => {
    setSelectedAuthor(prev => (prev === author ? null : author));
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setMinQuality(0.3);
    setShowMediaOnly(false);
    setSelectedEntity(null);
    setSelectedSentiment(null);
    setSelectedSource(null);
    setSelectedDocType(null);
    setSelectedAuthor(null);
    setConceptPath([]);
  };

  const handleBreadcrumbClick = (crumb) => {
    if (crumb.type === 'home') {
      clearFilters();
      setActiveWorkspace('search');
      return;
    }

    if (crumb.type === 'workspace') {
      clearFilters();
      setActiveWorkspace(crumb.workspaceId);
      return;
    }

    if (crumb.type === 'tag') {
      setSelectedTags((prev) => prev.slice(0, crumb.index + 1));
      setSelectedSource(null);
      setSelectedDocType(null);
      setSelectedAuthor(null);
      setConceptPath([]);
      return;
    }

    if (crumb.type === 'source') {
      setSelectedSource(crumb.sourceId);
      setSelectedDocType(null);
      setSelectedAuthor(null);
      setConceptPath([]);
      return;
    }

    if (crumb.type === 'type') {
      setSelectedDocType(crumb.docType);
      setSelectedAuthor(null);
      setConceptPath([]);
      return;
    }

    if (crumb.type === 'author') {
      setSelectedAuthor(crumb.author);
      setConceptPath([]);
      return;
    }

    if (crumb.type === 'concept') {
      setConceptPath((prev) => prev.slice(0, crumb.index + 1));
    }
  };

  const handleConceptSelect = (concept) => {
    setConceptPath((prev) => [...prev, concept]);
  };

  const currentConceptChildren = useMemo(() => {
    if (!ontologyTree || ontologyTree.length === 0) return [];
    if (conceptPath.length === 0) return ontologyTree;

    let children = ontologyTree;
    for (const concept of conceptPath) {
      const term = concept.term || concept.label || concept.name || concept;
      const match = children.find((node) => node.id === concept.id || node.term === term || node.label === term);
      if (!match) return [];
      children = match.children || [];
    }

    return children;
  }, [ontologyTree, conceptPath]);

  const hasActiveFilters = selectedTags.length > 0 || selectedEntity || selectedSentiment || selectedSource || selectedDocType || selectedAuthor || conceptPath.length > 0;

  const groupedEntities = docDetail.entities.reduce((acc, entity) => {
    if (!acc[entity.type]) acc[entity.type] = [];
    if (!acc[entity.type].find(e => (e.normalizedValue || e.value) === (entity.normalizedValue || entity.value))) {
      acc[entity.type].push(entity);
    }
    return acc;
  }, {});

  const toggleContentExpansion = (docId) => {
    setExpandedContent(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const loginWithNostr = async () => {
    if (!window.nostr) {
      alert('Please install a Nostr extension (Alby, nos2x, etc.)');
      return;
    }

    setNostrLoading(true);
    try {
      const pubkey = await window.nostr.getPublicKey();
      setNostrPubkey(pubkey);
      localStorage.setItem('nostr_pubkey', pubkey);
      alert('Connected to Nostr! 🟣');
    } catch (error) {
      console.error('Nostr login failed:', error);
      alert('Failed to connect. Please try again.');
    } finally {
      setNostrLoading(false);
    }
  };

  const logoutNostr = () => {
    setNostrPubkey(null);
    localStorage.removeItem('nostr_pubkey');
  };

  const likeNostrEvent = async (eventId) => {
    if (!window.nostr || !nostrPubkey) {
      alert('Please login with Nostr first');
      return;
    }

    try {
      const event = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', eventId],
          ['p', eventId.substring(0, 64)]
        ],
        content: '+'
      };

      const signedEvent = await window.nostr.signEvent(event);
      console.log('Like event signed:', signedEvent);
      alert('Liked! 👍');
    } catch (error) {
      console.error('Failed to like:', error);
      alert('Failed to like event');
    }
  };

  const repostNostrEvent = async (eventId) => {
    if (!window.nostr || !nostrPubkey) {
      alert('Please login with Nostr first');
      return;
    }

    try {
      const event = {
        kind: 6,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', eventId],
          ['p', eventId.substring(0, 64)]
        ],
        content: ''
      };

      const signedEvent = await window.nostr.signEvent(event);
      console.log('Repost event signed:', signedEvent);
      alert('Reposted! 🔄');
    } catch (error) {
      console.error('Failed to repost:', error);
      alert('Failed to repost event');
    }
  };

  const activeWorkspaceMeta = WORKSPACES.find((workspace) => workspace.id === activeWorkspace);

  const searchResults = hasSearched ? filteredResults : [];
  const totalResults = hasSearched ? results.length : 0;
  const filteredCount = hasSearched ? filteredResults.length : 0;

  const breadcrumbs = useMemo(() => {
    const crumbs = [
      { type: 'home', label: 'Home' },
      { type: 'workspace', label: activeWorkspaceMeta?.label || 'Workspace', workspaceId: activeWorkspace }
    ];

    selectedTags.forEach((tag, index) => {
      crumbs.push({ type: 'tag', label: `#${tag}`, tag, index });
    });

    if (selectedSource) {
      crumbs.push({
        type: 'source',
        label: `Source: ${sourceNameLookup.get(selectedSource) || selectedSource.substring(0, 8)}`,
        sourceId: selectedSource
      });
    }

    if (selectedDocType) {
      crumbs.push({ type: 'type', label: `Type: ${selectedDocType}`, docType: selectedDocType });
    }

    if (selectedAuthor) {
      crumbs.push({ type: 'author', label: `Author: ${selectedAuthor}`, author: selectedAuthor });
    }

    conceptPath.forEach((concept, index) => {
      const label = concept.term || concept.label || concept.name || concept;
      crumbs.push({ type: 'concept', label, index });
    });

    return crumbs;
  }, [activeWorkspace, activeWorkspaceMeta, selectedTags, selectedSource, selectedDocType, selectedAuthor, conceptPath, sourceNameLookup]);

  const metricValue = (value) => (value !== null && value !== undefined ? value : '—');

  const analyticsCards = [
    {
      label: 'Documents Indexed',
      value: metricValue(nlpStatus?.total_documents ?? nlpStatus?.documents_total ?? nlpStatus?.documents_with_tags),
      sublabel: 'Knowledge corpus'
    },
    {
      label: 'Tagged Coverage',
      value: metricValue(nlpStatus?.documents_with_tags),
      sublabel: 'Docs enriched'
    },
    {
      label: 'Entity Types',
      value: metricValue(facets?.entityTypes ? Object.keys(facets.entityTypes).length : 0),
      sublabel: 'Recognized types'
    },
    {
      label: 'Sentiment Signals',
      value: metricValue(facets?.sentiment ? facets.sentiment.length : 0),
      sublabel: 'Tone clusters'
    }
  ];

  return (
    <LayoutShell>
      <header className="top-bar">
        <div className="brand">
          <div className="brand-icon">🛰️</div>
          <div>
            <div className="brand-title">Beacon Search</div>
            <div className="brand-subtitle">Enterprise Knowledge Intelligence</div>
          </div>
        </div>
        <div className="top-bar-actions">
          <div
            className={`status-pill ${sharedUiEnabled ? 'ui-status' : ''}`}
            data-variant={sharedUiEnabled ? 'active' : undefined}
          >
            <span className="status-dot"></span>
            NLP Online
          </div>
          <button
            className="primary-button ui-cta"
            onClick={() => setShowAddForm(!showAddForm)}
            aria-label="Add new document"
          >
            + Add Document
          </button>
          <button
            className="ghost-button ui-button"
            onClick={processAllNlp}
            aria-label="Process NLP pipeline"
          >
            ⚡ Process NLP
          </button>
          {nostrPubkey ? (
            <button className="ghost-button ui-button" onClick={logoutNostr} aria-label="Logout of Nostr">
              🟣 {nostrPubkey.substring(0, 8)}... Logout
            </button>
          ) : (
            <button className="ghost-button ui-button" onClick={loginWithNostr} disabled={nostrLoading} aria-label="Login with Nostr">
              {nostrLoading ? 'Connecting...' : '🟣 Login Nostr'}
            </button>
          )}
        </div>
      </header>

      <div className="app-body">
        <NavRail>
          <div className="nav-section">
            {WORKSPACES.map((workspace) => (
              <button
                key={workspace.id}
                className={`ui-rail-item nav-item ${activeWorkspace === workspace.id ? 'active' : ''}`}
                data-active={activeWorkspace === workspace.id}
                onClick={() => setActiveWorkspace(workspace.id)}
                aria-pressed={activeWorkspace === workspace.id}
              >
                <span className="nav-icon">{workspace.icon}</span>
                <span>{workspace.label}</span>
              </button>
            ))}
          </div>
          <div className="nav-divider"></div>
          <div className="nav-section">
            <button className="ui-rail-item nav-item" data-active={false} onClick={() => setShowBookshelf(true)}>
              <span className="nav-icon">📚</span>
              Library
            </button>
            <button className="ui-rail-item nav-item" data-active={false} onClick={() => setShowWizard(true)}>
              <span className="nav-icon">🧙</span>
              Config Wizard
            </button>
          </div>
        </NavRail>

        <main className="workspace">
          <div className="workspace-header">
            <div>
              <h2>{activeWorkspaceMeta?.label}</h2>
              <p>{activeWorkspaceMeta?.description}</p>
              <nav className="breadcrumb-trail" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => {
                  const isCurrent = index === breadcrumbs.length - 1;
                  return (
                    <span key={`${crumb.type}-${crumb.label}-${index}`} className="breadcrumb-item">
                      <button
                        type="button"
                        className={`breadcrumb-link ${isCurrent ? 'current' : ''}`}
                        onClick={() => handleBreadcrumbClick(crumb)}
                        disabled={isCurrent}
                        aria-current={isCurrent ? 'page' : undefined}
                      >
                        {crumb.label}
                      </button>
                      {index < breadcrumbs.length - 1 && (
                        <span className="breadcrumb-separator" aria-hidden="true">›</span>
                      )}
                    </span>
                  );
                })}
              </nav>
            </div>
            <div className="workspace-controls">
              <button className="ghost-button ui-button" onClick={search} aria-label="Run search">
                Refresh Results
              </button>
              <button className="ghost-button ui-button" onClick={clearFilters} aria-label="Clear filters">
                Clear Filters
              </button>
            </div>
          </div>

          {activeWorkspace === 'search' && (
            <section className="workspace-section">
              <form onSubmit={search} className="search-form">
                <div className="search-box">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search across documents, tickets, and knowledge..."
                    className="search-input"
                    aria-label="Search query"
                  />
                  <button type="submit" className="search-button" disabled={loading} aria-label="Submit search">
                    {loading ? <span className="loading-spinner"></span> : 'Search'}
                  </button>
                </div>

                <div className="search-options">
                  <div className="mode-selector" role="radiogroup" aria-label="Search mode">
                    {['hybrid', 'vector', 'text'].map(mode => (
                      <label key={mode} className={searchMode === mode ? 'active' : ''}>
                        <input
                          type="radio"
                          value={mode}
                          checked={searchMode === mode}
                          onChange={(e) => setSearchMode(e.target.value)}
                        />
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </label>
                    ))}
                  </div>
                  <div className="tag-filter-toggle" role="group" aria-label="Tag filter mode">
                    <button
                      type="button"
                      className={tagFilterMode === 'and' ? 'active' : ''}
                      onClick={() => setTagFilterMode('and')}
                      aria-pressed={tagFilterMode === 'and'}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      className={tagFilterMode === 'or' ? 'active' : ''}
                      onClick={() => setTagFilterMode('or')}
                      aria-pressed={tagFilterMode === 'or'}
                    >
                      OR
                    </button>
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="active-filters">
                    {selectedTags.map(tag => (
                      <span key={tag} className="filter-chip">
                        🏷️ {tag}
                        <button className="remove-btn" onClick={() => toggleTag(tag)} aria-label={`Remove ${tag}`}>
                          ×
                        </button>
                      </span>
                    ))}
                    {selectedEntity && (
                      <span className="filter-chip">
                        {ENTITY_ICONS[selectedEntity.type]} {selectedEntity.value}
                        <button className="remove-btn" onClick={() => setSelectedEntity(null)} aria-label="Remove entity filter">
                          ×
                        </button>
                      </span>
                    )}
                    {selectedSentiment && (
                      <span className="filter-chip">
                        {selectedSentiment === 'positive' ? '😊' : selectedSentiment === 'negative' ? '😞' : '😐'} {selectedSentiment}
                        <button className="remove-btn" onClick={() => setSelectedSentiment(null)} aria-label="Remove sentiment filter">
                          ×
                        </button>
                      </span>
                    )}
                    {selectedSource && (
                      <span className="filter-chip">
                        🔗 {sourceNameLookup.get(selectedSource) || selectedSource.substring(0, 8)}
                        <button className="remove-btn" onClick={() => setSelectedSource(null)} aria-label="Remove source filter">
                          ×
                        </button>
                      </span>
                    )}
                    {selectedDocType && (
                      <span className="filter-chip">
                        📄 {selectedDocType}
                        <button className="remove-btn" onClick={() => setSelectedDocType(null)} aria-label="Remove document type filter">
                          ×
                        </button>
                      </span>
                    )}
                    {selectedAuthor && (
                      <span className="filter-chip">
                        👤 {selectedAuthor}
                        <button className="remove-btn" onClick={() => setSelectedAuthor(null)} aria-label="Remove author filter">
                          ×
                        </button>
                      </span>
                    )}
                    {conceptPath.length > 0 && (
                      <span className="filter-chip">
                        🧭 {conceptPath.map((c) => c.term || c.label || c.name || c).join(' / ')}
                        <button className="remove-btn" onClick={() => setConceptPath([])} aria-label="Clear concept path">
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </form>

              {error && <div className="error">{error}</div>}

              {searchTime !== null && totalResults > 0 && (
                <div className="search-meta">
                  {hasActiveFilters && filteredCount !== totalResults
                    ? `Filtered to ${filteredCount} of ${totalResults} results in ${searchTime}ms`
                    : `Found ${totalResults} results in ${searchTime}ms`
                  }
                </div>
              )}

              <div className="search-layout" style={{ display: 'flex', gap: '0' }}>
                <TagFilterSidebar
                  selectedTags={selectedTags}
                  onTagToggle={toggleTag}
                  onClearFilters={clearFilters}
                  minQuality={minQuality}
                  onMinQualityChange={setMinQuality}
                  showMediaOnly={showMediaOnly}
                  onShowMediaOnlyChange={setShowMediaOnly}
                />
                <div style={{ marginLeft: '280px', flex: 1 }}>
                  <InfiniteScrollResults
                    query={query}
                    mode={searchMode}
                    filters={{
                      tags: selectedTags,
                      minQuality,
                      hasMedia: showMediaOnly
                    }}
                    onResultClick={(result) => loadDocDetail(result.id)}
                  />
                </div>
              </div>

              {hasSearched && searchResults.length === 0 && !loading && !error && (
                <div className="no-results">
                  {query || hasActiveFilters
                    ? `No results found${query ? ` for "${query}"` : ''}`
                    : 'Enter a search query or select filters to find documents'
                  }
                </div>
              )}
            </section>
          )}

          {activeWorkspace === 'explore' && (
            <section className="workspace-section">
              <TagCloud 
                selectedTags={selectedTags}
                onTagSelect={(tags) => setSelectedTags(tags.map(normalizeTag))}
                onTagRemove={(tag) => setSelectedTags(selectedTags.filter(t => t !== normalizeTag(tag)))}
                onClearFilters={() => {
                  setSelectedTags([]);
                  setSelectedEntity(null);
                  setSelectedSentiment(null);
                }}
                maxTags={50}
                minCount={1}
              />
              <div className="panel-grid">
                <div className="panel">
                  <div className="panel-header">
                    <h3>Tag + Facet Explorer</h3>
                    <div className="tag-filter-toggle compact" role="group" aria-label="Tag filter mode">
                      <button
                        type="button"
                        className={tagFilterMode === 'and' ? 'active' : ''}
                        onClick={() => setTagFilterMode('and')}
                        aria-pressed={tagFilterMode === 'and'}
                      >
                        AND
                      </button>
                      <button
                        type="button"
                        className={tagFilterMode === 'or' ? 'active' : ''}
                        onClick={() => setTagFilterMode('or')}
                        aria-pressed={tagFilterMode === 'or'}
                      >
                        OR
                      </button>
                    </div>
                  </div>
                  <p className="panel-subtitle">Iteratively narrow the knowledge set using tags and entities.</p>
                  <div className="facet-section">
                    <h4>Tags in Current Subset</h4>
                    <div className="tag-cloud">
                      {recomputedTagCloud.length > 0 ? (
                        recomputedTagCloud.slice(0, 30).map(({ tag, count }) => (
                          <span
                            key={tag}
                            className={`tag-item ${selectedTags.includes(normalizeTag(tag)) ? 'active' : ''}`}
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}<span className="tag-count">({count})</span>
                          </span>
                        ))
                      ) : (
                        <div className="empty-text">No tags in the current subset yet.</div>
                      )}
                    </div>
                  </div>
                  {facets?.entityTypes && Object.keys(facets.entityTypes).length > 0 && (
                    <div className="facet-section">
                      <h4>Entities</h4>
                      {['PERSON', 'ORGANIZATION', 'LOCATION'].map(type => (
                        facets.entityTypes[type]?.length > 0 && (
                          <div key={type} className="entity-facet-group">
                            <div className="entity-type-label">{ENTITY_ICONS[type]} {type}</div>
                            <div className="entity-list">
                              {facets.entityTypes[type].slice(0, 5).map(({ value, count }) => (
                                <div
                                  key={value}
                                  className={`entity-item ${selectedEntity?.type === type && selectedEntity?.value === value ? 'active' : ''}`}
                                  onClick={() => toggleEntity(type, value)}
                                >
                                  <span>{value}</span>
                                  <span className="count">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h3>Concept Navigator</h3>
                    {conceptPath.length > 0 && (
                      <button className="ghost-button ui-button" onClick={() => setConceptPath([])}>
                        Clear Path
                      </button>
                    )}
                  </div>
                  <p className="panel-subtitle">Drill down the ontology to refine discovery flows.</p>
                  {conceptPath.length > 0 && (
                    <div className="concept-path">
                      {conceptPath.map((concept, index) => (
                        <span key={`${concept.term || concept.label || concept.name}-${index}`} className="concept-pill">
                          {concept.term || concept.label || concept.name || concept}
                        </span>
                      ))}
                    </div>
                  )}
                  {currentConceptChildren.length > 0 ? (
                    <div className="concept-list">
                      {currentConceptChildren.map((node) => (
                        <button
                          key={node.id || node.term}
                          className="concept-node"
                          onClick={() => handleConceptSelect(node)}
                        >
                          <span>{node.term || node.label || node.name}</span>
                          <span className="count">
                            {filteredResults.filter((doc) => matchesConcept(doc, node)).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-text">Ontology not available yet. TODO: enable /api/ontology?tree=true.</div>
                  )}
                </div>

                <div className="panel">
                  <h3>Metadata Explorer</h3>
                  <p className="panel-subtitle">Slice the subset by source, type, and author.</p>
                  <div className="facet-section">
                    <h4>Sources</h4>
                    <div className="meta-chip-grid">
                      {derivedMetadata.sources.length > 0 ? (
                        derivedMetadata.sources.slice(0, 8).map((source) => (
                          <button
                            key={source.id}
                            className={`meta-chip ${selectedSource === source.id ? 'active' : ''}`}
                            onClick={() => toggleSource(source.id)}
                          >
                            {source.name}
                            <span className="count">{source.count}</span>
                          </button>
                        ))
                      ) : (
                        <div className="empty-text">No sources in view.</div>
                      )}
                    </div>
                  </div>
                  <div className="facet-section">
                    <h4>Types</h4>
                    <div className="meta-chip-grid">
                      {derivedMetadata.types.length > 0 ? (
                        derivedMetadata.types.slice(0, 8).map(({ type, count }) => (
                          <button
                            key={type}
                            className={`meta-chip ${selectedDocType === type ? 'active' : ''}`}
                            onClick={() => toggleDocType(type)}
                          >
                            {type}
                            <span className="count">{count}</span>
                          </button>
                        ))
                      ) : (
                        <div className="empty-text">No document types available.</div>
                      )}
                    </div>
                  </div>
                  <div className="facet-section">
                    <h4>Authors</h4>
                    <div className="meta-chip-grid">
                      {derivedMetadata.authors.length > 0 ? (
                        derivedMetadata.authors.slice(0, 6).map(({ author, count }) => (
                          <button
                            key={author}
                            className={`meta-chip ${selectedAuthor === author ? 'active' : ''}`}
                            onClick={() => toggleAuthor(author)}
                          >
                            {author}
                            <span className="count">{count}</span>
                          </button>
                        ))
                      ) : (
                        <div className="empty-text">No authors detected.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <h3>Sentiment Signals</h3>
                  <p className="panel-subtitle">Reveal tone clusters and prioritize escalations.</p>
                  <div className="sentiment-filter">
                    {['positive', 'neutral', 'negative'].map(s => (
                      <button
                        key={s}
                        className={`sentiment-btn ${s} ${selectedSentiment === s ? 'active' : ''}`}
                        onClick={() => setSelectedSentiment(selectedSentiment === s ? null : s)}
                      >
                        {s === 'positive' ? '😊 Positive' : s === 'negative' ? '😞 Negative' : '😐 Neutral'}
                      </button>
                    ))}
                  </div>
                  <button className="primary-button" onClick={search}>
                    Apply Filters to Search
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeWorkspace === 'connectors' && (
            <section className="workspace-section">
              <div className="panel-grid">
                <TableCard
                  title="Ingestion Sources"
                  subtitle="Connector heartbeat and indexing coverage."
                >
                  <div className="connector-list">
                    {CONNECTOR_STATUS.map((connector) => (
                      <div key={connector.name} className="connector-card">
                        <div>
                          <div className="connector-name">{connector.name}</div>
                          <div className="connector-detail">{connector.detail}</div>
                        </div>
                        <span className={`connector-status ${connector.status.toLowerCase()}`}>{connector.status}</span>
                      </div>
                    ))}
                  </div>
                </TableCard>
                <StatusPanel
                  title="Connector Actions"
                  subtitle="Quick actions for onboarding and monitoring."
                >
                  <div className="action-list">
                    <button className="ghost-button ui-button">+ Add Connector</button>
                    <button className="ghost-button ui-button">Re-run Ingestion</button>
                    <button className="ghost-button ui-button">View Audit Logs</button>
                    <button className="ghost-button ui-button">Export Source Report</button>
                  </div>
                </StatusPanel>
              </div>
            </section>
          )}

          {activeWorkspace === 'relationships' && (
            <section className="workspace-section">
              <div className="panel">
                <h3>Relationship View</h3>
                <p className="panel-subtitle">Map the context graph for the selected document.</p>
                {expandedDoc ? (
                  <div className="relationship-grid">
                    <div>
                      <h4>Key Entities</h4>
                      {Object.entries(groupedEntities).map(([type, entities]) => (
                        <div key={type} className="entity-group">
                          <div className="entity-group-title">{ENTITY_ICONS[type]} {type}</div>
                          <div className="entity-badges">
                            {entities.slice(0, 8).map((e, i) => (
                              <span key={i} className={`entity-badge ${type}`}>
                                {e.normalizedValue || e.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4>Related Documents</h4>
                      <div className="related-docs">
                        {docDetail.related.map(r => (
                          <div key={r.id} className="related-doc">
                            <div>
                              <div className="related-doc-title">{r.title}</div>
                              <div className="related-doc-reason">
                                {r.sharedEntities.length > 0 && `Shares: ${r.sharedEntities.slice(0, 3).join(', ')}`}
                                {r.sharedTags.length > 0 && ` • Tags: ${r.sharedTags.slice(0, 3).join(', ')}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Select a document in Search to populate relationship insights.
                  </div>
                )}
              </div>
            </section>
          )}

          {activeWorkspace === 'analytics' && (
            <section className="workspace-section">
              <div className="analytics-grid">
                {analyticsCards.map((card) => (
                  <KpiCard
                    key={card.label}
                    value={card.value}
                    label={card.label}
                    sublabel={card.sublabel}
                  />
                ))}
              </div>
              <div className="panel-grid">
                <ChartCard
                  title="Top Tags"
                  subtitle="Most engaged concepts across your corpus."
                >
                  <div className="tag-cloud">
                    {displayedTagCloud.slice(0, 12).map(({ tag, count }) => (
                      <span key={tag} className="tag-item">
                        {tag}<span className="tag-count">({count})</span>
                      </span>
                    ))}
                  </div>
                </ChartCard>
                <ChartCard
                  title="Sentiment Distribution"
                  subtitle="Focus on emerging risk clusters."
                >
                  <div className="sentiment-stack">
                    {['positive', 'neutral', 'negative'].map((tone) => (
                      <div key={tone} className="sentiment-row">
                        <span>{tone}</span>
                        <span className="sentiment-value">
                          {metricValue(
                            facets?.sentiment?.find((s) => s.sentiment === tone)?.count
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
            </section>
          )}

          <footer className="footer">
            <p>Beacon Search • API-first • pgvector + NLP Pipeline • Local AI</p>
          </footer>
        </main>

        <aside className="context-panel">
          <StatusPanel
            title="Active Filters"
            subtitle="Current search context."
          >
            {hasActiveFilters ? (
              <div className="active-filters">
                {selectedTags.map(tag => (
                  <span key={tag} className="filter-chip">
                    🏷️ {tag}
                    <button className="remove-btn" onClick={() => toggleTag(tag)} aria-label={`Remove ${tag}`}>
                      ×
                    </button>
                  </span>
                ))}
                {selectedEntity && (
                  <span className="filter-chip">
                    {ENTITY_ICONS[selectedEntity.type]} {selectedEntity.value}
                    <button className="remove-btn" onClick={() => setSelectedEntity(null)} aria-label="Remove entity filter">
                      ×
                    </button>
                  </span>
                )}
                {selectedSentiment && (
                  <span className="filter-chip">
                    {selectedSentiment === 'positive' ? '😊' : selectedSentiment === 'negative' ? '😞' : '😐'} {selectedSentiment}
                    <button className="remove-btn" onClick={() => setSelectedSentiment(null)} aria-label="Remove sentiment filter">
                      ×
                    </button>
                  </span>
                )}
                {selectedSource && (
                  <span className="filter-chip">
                    🔗 {sourceNameLookup.get(selectedSource) || selectedSource.substring(0, 8)}
                    <button className="remove-btn" onClick={() => setSelectedSource(null)} aria-label="Remove source filter">
                      ×
                    </button>
                  </span>
                )}
                {selectedDocType && (
                  <span className="filter-chip">
                    📄 {selectedDocType}
                    <button className="remove-btn" onClick={() => setSelectedDocType(null)} aria-label="Remove document type filter">
                      ×
                    </button>
                  </span>
                )}
                {selectedAuthor && (
                  <span className="filter-chip">
                    👤 {selectedAuthor}
                    <button className="remove-btn" onClick={() => setSelectedAuthor(null)} aria-label="Remove author filter">
                      ×
                    </button>
                  </span>
                )}
                {conceptPath.length > 0 && (
                  <span className="filter-chip">
                    🧭 {conceptPath.map((c) => c.term || c.label || c.name || c).join(' / ')}
                    <button className="remove-btn" onClick={() => setConceptPath([])} aria-label="Clear concept path">
                      ×
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <div className="empty-text">No filters selected.</div>
            )}
          </StatusPanel>

          <div className="panel">
            <h3>Quick Insights</h3>
            <p className="panel-subtitle">Snapshot of corpus health.</p>
            <div className="insight-list">
              <div>
                <div className="insight-label">Tagged Documents</div>
                <div className="insight-value">{metricValue(nlpStatus?.documents_with_tags)}</div>
              </div>
              <div>
                <div className="insight-label">Entity Types</div>
                <div className="insight-value">{metricValue(facets?.entityTypes ? Object.keys(facets.entityTypes).length : 0)}</div>
              </div>
              <div>
                <div className="insight-label">Top Tags</div>
                <div className="insight-value">{displayedTagCloud.slice(0, 3).map(t => t.tag).join(', ') || '—'}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Document Intake</h3>
            <p className="panel-subtitle">Add new content to the knowledge base.</p>
            <button className="primary-button" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Close Form' : 'Add Document'}
            </button>
            {showAddForm && (
              <form onSubmit={addDocument} className="add-form">
                <input
                  type="text"
                  placeholder="Title"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  required
                />
                <textarea
                  placeholder="Content"
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                  required
                  rows={4}
                />
                <input
                  type="url"
                  placeholder="URL (optional)"
                  value={newDoc.url}
                  onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                />
                <button type="submit">Add</button>
              </form>
            )}
          </div>
        </aside>
      </div>

      {showBookshelf && (
        <div className="bookshelf-overlay">
          <Bookshelf
            onClose={() => setShowBookshelf(false)}
            filters={{
              tags: selectedTags,
              source: selectedSource,
              docType: selectedDocType,
              author: selectedAuthor,
              concept: selectedConcept,
              tagFilterMode
            }}
            onToggleTag={toggleTag}
            onClearFilters={clearFilters}
            onTagFilterModeChange={setTagFilterMode}
            onSelectSource={(value) => setSelectedSource(value)}
          />
        </div>
      )}

      {showWizard && (
        <div className="wizard-overlay">
          <ConfigWizard onClose={() => setShowWizard(false)} />
          <button
            className="wizard-close-btn"
            onClick={() => setShowWizard(false)}
            title="Close Wizard"
          >
            ✕
          </button>
        </div>
      )}
    </LayoutShell>
  );
}

export default App;
