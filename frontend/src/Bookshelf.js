import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Bookshelf.css';
import { SourceBadge, SourceActions } from './DocumentCard';
import './DocumentCard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Color palette for book spines based on category
const CATEGORY_COLORS = {
  'documentation': { bg: '#1e3a5f', text: '#e0f0ff' },
  'article': { bg: '#5c3d2e', text: '#ffeedd' },
  'research': { bg: '#2d4a3e', text: '#d0f0d0' },
  'tutorial': { bg: '#4a3d5c', text: '#e8d8f8' },
  'reference': { bg: '#5c4a3d', text: '#fff0e0' },
  'blog': { bg: '#3d4a5c', text: '#e0e8f8' },
  'news': { bg: '#5c3d4a', text: '#f8e0e8' },
  'book': { bg: '#3d5c4a', text: '#e0f8e8' },
  'default': { bg: '#4a4a5c', text: '#e8e8f8' }
};

// Icon mapping for document types
const TYPE_ICONS = {
  'documentation': '📖',
  'article': '📰',
  'research': '🔬',
  'tutorial': '📚',
  'reference': '📋',
  'blog': '✍️',
  'news': '📢',
  'book': '📕',
  'video': '🎬',
  'audio': '🎧',
  'image': '🖼️',
  'pdf': '📄',
  'default': '📄'
};

const Bookshelf = ({
  onClose,
  filters = {},
  onToggleTag,
  onClearFilters,
  onTagFilterModeChange,
  onSelectSource
}) => {
  // State
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('shelf'); // shelf, grid, list, card
  const [browseMode, setBrowseMode] = useState('category'); // category, date, source, author, recent, favorites
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('beacon-favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    const saved = localStorage.getItem('beacon-recently-viewed');
    return saved ? JSON.parse(saved) : [];
  });
  const [sortOrder, setSortOrder] = useState('title'); // title, date, score
  const [filterSource, setFilterSource] = useState('');
  const [sources, setSources] = useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('beacon-theme') || 'dark';
  });
  const [hoveredDoc, setHoveredDoc] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [draggedDoc, setDraggedDoc] = useState(null);

  const selectedTags = filters.tags || [];
  const selectedSource = filters.source || '';
  const selectedDocType = filters.docType || '';
  const selectedAuthor = filters.author || '';
  const selectedConcept = filters.concept || null;
  const tagFilterMode = filters.tagFilterMode || 'and';

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_URL}/api/documents?limit=100`;
      if (searchQuery) {
        url = `${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}&limit=100`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(searchQuery ? data.results : data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Fetch sources
  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats`);
      if (response.ok) {
        const data = await response.json();
        setSources(data.sourceStats || []);
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchSources();
  }, [fetchDocuments, fetchSources]);

  // Save favorites and recently viewed to localStorage
  useEffect(() => {
    localStorage.setItem('beacon-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('beacon-recently-viewed', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  useEffect(() => {
    localStorage.setItem('beacon-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (selectedSource !== filterSource) {
      setFilterSource(selectedSource || '');
    }
  }, [selectedSource]);

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
    const normalizedTerm = normalizeTag(term);

    const docTags = extractTags(doc).map((tag) => normalizeTag(tag));
    if (docTags.includes(normalizedTerm)) return true;

    // TODO: Wire to backend concept taxonomy when available.
    return (
      (doc.title && doc.title.toLowerCase().includes(normalizedTerm)) ||
      (doc.content && doc.content.toLowerCase().includes(normalizedTerm))
    );
  };

  const applySharedFilters = (docs) => {
    return docs.filter((doc) => {
      const docTags = extractTags(doc);

      if (!matchesTagFilter(docTags)) return false;
      if (selectedSource && doc.source_id !== selectedSource) return false;
      if (selectedDocType && (doc.type || doc.category) !== selectedDocType) return false;
      if (selectedAuthor && (doc.author || doc.metadata?.author) !== selectedAuthor) return false;
      if (!matchesConcept(doc, selectedConcept)) return false;

      return true;
    });
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

  // Group documents based on browse mode
  const groupedDocuments = useMemo(() => {
    let docs = [...documents];
    
    // Apply source filter
    if (filterSource) {
      docs = docs.filter(d => d.source_id === filterSource);
    }

    // Apply shared filters
    docs = applySharedFilters(docs);

    // Sort documents
    docs.sort((a, b) => {
      switch (sortOrder) {
        case 'date':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'score':
          return (b.score || 0) - (a.score || 0);
        default:
          return (a.title || '').localeCompare(b.title || '');
      }
    });

    // Group based on browse mode
    const groups = {};
    
    switch (browseMode) {
      case 'category':
        docs.forEach(doc => {
          const category = doc.category || doc.type || 'Uncategorized';
          if (!groups[category]) groups[category] = [];
          groups[category].push(doc);
        });
        break;
      
      case 'date':
        docs.forEach(doc => {
          const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown Date';
          if (!groups[date]) groups[date] = [];
          groups[date].push(doc);
        });
        break;
      
      case 'source':
        docs.forEach(doc => {
          const source = sources.find(s => s.id === doc.source_id);
          const sourceName = source ? source.name : 'Unknown Source';
          if (!groups[sourceName]) groups[sourceName] = [];
          groups[sourceName].push(doc);
        });
        break;
      
      case 'author':
        docs.forEach(doc => {
          const author = doc.author || doc.metadata?.author || 'Unknown Author';
          if (!groups[author]) groups[author] = [];
          groups[author].push(doc);
        });
        break;
      
      case 'recent':
        const recentIds = new Set(recentlyViewed);
        const recentDocs = docs.filter(d => recentIds.has(d.id));
        if (recentDocs.length > 0) {
          groups['Recently Viewed'] = recentDocs.sort((a, b) => 
            recentlyViewed.indexOf(a.id) - recentlyViewed.indexOf(b.id)
          );
        }
        break;
      
      case 'favorites':
        const favIds = new Set(favorites);
        const favDocs = docs.filter(d => favIds.has(d.id));
        if (favDocs.length > 0) {
          groups['Favorites'] = favDocs;
        }
        break;
      
      default:
        groups['All Documents'] = docs;
    }

    return groups;
  }, [documents, browseMode, sortOrder, filterSource, sources, favorites, recentlyViewed, selectedTags, tagFilterMode, selectedSource, selectedDocType, selectedAuthor, selectedConcept]);

  const filteredDocuments = useMemo(() => {
    let docs = documents;
    if (filterSource) {
      docs = docs.filter((doc) => doc.source_id === filterSource);
    }
    return applySharedFilters(docs);
  }, [documents, filterSource, selectedTags, tagFilterMode, selectedSource, selectedDocType, selectedAuthor, selectedConcept]);

  const tagCounts = useMemo(() => (
    buildTagCounts(filteredDocuments)
  ), [filteredDocuments]);

  // Handle document selection
  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    // Add to recently viewed
    setRecentlyViewed(prev => {
      const filtered = prev.filter(id => id !== doc.id);
      return [doc.id, ...filtered].slice(0, 50);
    });
  };

  // Toggle favorite
  const toggleFavorite = (docId, e) => {
    e?.stopPropagation();
    setFavorites(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // Get color for document
  const getDocColor = (doc) => {
    const category = (doc.category || doc.type || 'default').toLowerCase();
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  // Get icon for document
  const getDocIcon = (doc) => {
    const type = (doc.type || 'default').toLowerCase();
    return TYPE_ICONS[type] || TYPE_ICONS.default;
  };

  // Handle hover preview
  const handleMouseMove = (e, doc) => {
    if (viewMode === 'shelf') {
      setPreviewPosition({ x: e.clientX + 20, y: e.clientY - 100 });
      setHoveredDoc(doc);
    }
  };

  // Handle drag start
  const handleDragStart = (e, doc) => {
    setDraggedDoc(doc);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', doc.id);
  };

  // Handle drop on favorites
  const handleDropOnFavorites = (e) => {
    e.preventDefault();
    if (draggedDoc && !favorites.includes(draggedDoc.id)) {
      toggleFavorite(draggedDoc.id);
    }
    setDraggedDoc(null);
  };

  // Search handler
  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  // Render book spine (Shelf View)
  const renderBookSpine = (doc) => {
    const colors = getDocColor(doc);
    const isFavorite = favorites.includes(doc.id);
    const titleLength = (doc.title || '').length;
    const spineHeight = Math.min(Math.max(titleLength * 3, 120), 220);
    
    return (
      <div
        key={doc.id}
        className={`book-spine ${isFavorite ? 'favorite' : ''}`}
        style={{
          '--spine-bg': colors.bg,
          '--spine-text': colors.text,
          height: `${spineHeight}px`
        }}
        onClick={() => handleDocSelect(doc)}
        onMouseMove={(e) => handleMouseMove(e, doc)}
        onMouseLeave={() => setHoveredDoc(null)}
        draggable
        onDragStart={(e) => handleDragStart(e, doc)}
      >
        <div className="spine-content">
          <span className="spine-title">{doc.title}</span>
          {doc.author && <span className="spine-author">{doc.author}</span>}
        </div>
        <div className="spine-decoration"></div>
        {isFavorite && <span className="spine-favorite">★</span>}
      </div>
    );
  };

  // Render book cover (Grid View)
  const renderBookCover = (doc) => {
    const colors = getDocColor(doc);
    const isFavorite = favorites.includes(doc.id);
    const icon = getDocIcon(doc);
    
    return (
      <div
        key={doc.id}
        className={`book-cover ${isFavorite ? 'favorite' : ''}`}
        onClick={() => handleDocSelect(doc)}
        draggable
        onDragStart={(e) => handleDragStart(e, doc)}
      >
        <div className="cover-image" style={{ background: colors.bg }}>
          <span className="cover-icon">{icon}</span>
          <div className="cover-title-overlay">
            <h4>{doc.title}</h4>
          </div>
        </div>
        <div className="cover-info">
          <h4 className="cover-title">{doc.title}</h4>
          {doc.author && <p className="cover-author">{doc.author}</p>}
        </div>
        <button 
          className={`favorite-btn ${isFavorite ? 'active' : ''}`}
          onClick={(e) => toggleFavorite(doc.id, e)}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
    );
  };

  // Render document card (Card View)
  const renderDocumentCard = (doc) => {
    const icon = getDocIcon(doc);
    const isFavorite = favorites.includes(doc.id);
    const snippet = (doc.content || '').slice(0, 200);
    const docTags = extractTags(doc);
    
    return (
      <div
        key={doc.id}
        className={`document-card ${isFavorite ? 'favorite' : ''}`}
        onClick={() => handleDocSelect(doc)}
        draggable
        onDragStart={(e) => handleDragStart(e, doc)}
      >
        <div className="card-header">
          <span className="card-icon">{icon}</span>
          {doc.source_id && (
            <SourceBadge 
              sourceSystem={{ type: doc.connector_type || 'unknown' }}
              size="small"
            />
          )}
          <h3 className="card-title">{doc.title}</h3>
          <button 
            className={`favorite-btn ${isFavorite ? 'active' : ''}`}
            onClick={(e) => toggleFavorite(doc.id, e)}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </div>
        <p className="card-snippet">{snippet}{snippet.length >= 200 ? '...' : ''}</p>
        <div className="card-meta">
          {doc.author && <span className="meta-author">By {doc.author}</span>}
          {doc.created_at && (
            <span className="meta-date">
              {new Date(doc.created_at).toLocaleDateString()}
            </span>
          )}
          {doc.type && <span className="meta-type">{doc.type}</span>}
          {doc.score !== undefined && (
            <span className="meta-score">{Math.round(doc.score * 100)}%</span>
          )}
        </div>
        {docTags.length > 0 && (
          <div className="card-tags">
            {docTags.slice(0, 5).map((tag, i) => (
              <button
                key={i}
                type="button"
                className={`tag ${selectedTags.includes(normalizeTag(tag)) ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTag && onToggleTag(tag);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        {/* Source portal actions */}
        {doc.id && doc.source_id && (
          <div className="card-source-actions" onClick={(e) => e.stopPropagation()}>
            <SourceActions documentId={doc.id} query={doc.title} />
          </div>
        )}
      </div>
    );
  };

  // Render article row (List View)
  const renderArticleRow = (doc) => {
    const icon = getDocIcon(doc);
    const isFavorite = favorites.includes(doc.id);
    
    return (
      <div
        key={doc.id}
        className={`article-row ${isFavorite ? 'favorite' : ''}`}
        onClick={() => handleDocSelect(doc)}
        draggable
        onDragStart={(e) => handleDragStart(e, doc)}
      >
        <span className="row-icon">{icon}</span>
        <div className="row-content">
          <h4 className="row-title">{doc.title}</h4>
          <div className="row-meta">
            {doc.author && <span className="meta-author">{doc.author}</span>}
            {doc.created_at && (
              <span className="meta-date">
                {new Date(doc.created_at).toLocaleDateString()}
              </span>
            )}
            {doc.type && <span className="meta-type">{doc.type}</span>}
          </div>
        </div>
        <button 
          className={`favorite-btn ${isFavorite ? 'active' : ''}`}
          onClick={(e) => toggleFavorite(doc.id, e)}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
    );
  };

  // Render document based on view mode
  const renderDocument = (doc) => {
    switch (viewMode) {
      case 'shelf': return renderBookSpine(doc);
      case 'grid': return renderBookCover(doc);
      case 'list': return renderArticleRow(doc);
      case 'card': return renderDocumentCard(doc);
      default: return renderBookSpine(doc);
    }
  };

  // Render detail panel
  const renderDetailPanel = () => {
    if (!selectedDoc) return null;
    
    const isFavorite = favorites.includes(selectedDoc.id);
    const icon = getDocIcon(selectedDoc);
    
    return (
      <div className="detail-overlay" onClick={() => setSelectedDoc(null)}>
        <div className="detail-panel" onClick={e => e.stopPropagation()}>
          <button className="close-btn" onClick={() => setSelectedDoc(null)}>×</button>
          
          <div className="detail-header">
            <span className="detail-icon">{icon}</span>
            <h2>{selectedDoc.title}</h2>
            <button 
              className={`favorite-btn large ${isFavorite ? 'active' : ''}`}
              onClick={() => toggleFavorite(selectedDoc.id)}
            >
              {isFavorite ? '★ Favorited' : '☆ Add to Favorites'}
            </button>
          </div>
          
          <div className="detail-meta">
            {selectedDoc.author && (
              <div className="meta-item">
                <span className="label">Author</span>
                <span className="value">{selectedDoc.author}</span>
              </div>
            )}
            {selectedDoc.created_at && (
              <div className="meta-item">
                <span className="label">Date</span>
                <span className="value">{new Date(selectedDoc.created_at).toLocaleDateString()}</span>
              </div>
            )}
            {selectedDoc.type && (
              <div className="meta-item">
                <span className="label">Type</span>
                <span className="value">{selectedDoc.type}</span>
              </div>
            )}
            {selectedDoc.source_id && (
              <div className="meta-item">
                <span className="label">Source</span>
                <span className="value">
                  <SourceBadge 
                    sourceSystem={{ type: selectedDoc.connector_type || 'unknown' }}
                    connectorName={selectedDoc.connector_name}
                    size="medium"
                  />
                </span>
              </div>
            )}
            {selectedDoc.url && (
              <div className="meta-item">
                <span className="label">URL</span>
                <a href={selectedDoc.url} target="_blank" rel="noopener noreferrer" className="value link">
                  {selectedDoc.url}
                </a>
              </div>
            )}
          </div>
          
          <div className="detail-content">
            <h3>Content</h3>
            <div className="content-text">
              {selectedDoc.content}
            </div>
          </div>
          
          {extractTags(selectedDoc).length > 0 && (
            <div className="detail-tags">
              <h3>Tags</h3>
              <div className="tags-list">
                {extractTags(selectedDoc).map((tag, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`tag ${selectedTags.includes(normalizeTag(tag)) ? 'active' : ''}`}
                    onClick={() => onToggleTag && onToggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="detail-actions">
            {/* Source Portal Launch Actions */}
            {selectedDoc.id && (
              <SourceActions 
                documentId={selectedDoc.id}
                query={selectedDoc.title}
              />
            )}
            
            {/* Fallback to direct URL if no source actions */}
            {selectedDoc.url && !selectedDoc.source_id && (
              <a 
                href={selectedDoc.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="action-btn primary"
              >
                Open Original →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render hover preview
  const renderHoverPreview = () => {
    if (!hoveredDoc || viewMode !== 'shelf') return null;
    
    return (
      <div 
        className="hover-preview"
        style={{
          left: previewPosition.x,
          top: previewPosition.y
        }}
      >
        <h4>{hoveredDoc.title}</h4>
        {hoveredDoc.author && <p className="preview-author">By {hoveredDoc.author}</p>}
        <p className="preview-snippet">
          {(hoveredDoc.content || '').slice(0, 150)}...
        </p>
      </div>
    );
  };

  return (
    <div className={`bookshelf-container theme-${theme}`}>
      {/* Header */}
      <header className="bookshelf-header">
        <div className="header-left">
          <button className="back-btn" onClick={onClose}>← Back</button>
          <h1>📚 Library</h1>
        </div>
        
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your library..."
            className="search-input"
          />
          <button type="submit" className="search-btn">🔍</button>
        </form>
        
        <div className="header-right">
          <button 
            className={`theme-toggle ${theme}`}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bookshelf-toolbar">
        <div className="view-modes">
          <button 
            className={viewMode === 'shelf' ? 'active' : ''}
            onClick={() => setViewMode('shelf')}
            title="Shelf View"
          >
            📚 Shelf
          </button>
          <button 
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            ⊞ Grid
          </button>
          <button 
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            ☰ List
          </button>
          <button 
            className={viewMode === 'card' ? 'active' : ''}
            onClick={() => setViewMode('card')}
            title="Card View"
          >
            ▢ Cards
          </button>
        </div>

        <div className="browse-modes">
          <button 
            className={browseMode === 'category' ? 'active' : ''}
            onClick={() => setBrowseMode('category')}
          >
            📂 Category
          </button>
          <button 
            className={browseMode === 'date' ? 'active' : ''}
            onClick={() => setBrowseMode('date')}
          >
            📅 Date
          </button>
          <button 
            className={browseMode === 'source' ? 'active' : ''}
            onClick={() => setBrowseMode('source')}
          >
            🔗 Source
          </button>
          <button 
            className={browseMode === 'author' ? 'active' : ''}
            onClick={() => setBrowseMode('author')}
          >
            👤 Author
          </button>
          <button 
            className={browseMode === 'recent' ? 'active' : ''}
            onClick={() => setBrowseMode('recent')}
          >
            🕐 Recent
          </button>
          <button 
            className={`${browseMode === 'favorites' ? 'active' : ''} favorites-browse`}
            onClick={() => setBrowseMode('favorites')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnFavorites}
          >
            ⭐ Favorites ({favorites.length})
          </button>
        </div>

        <div className="filters">
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            className="sort-select"
          >
            <option value="title">Sort by Title</option>
            <option value="date">Sort by Date</option>
            <option value="score">Sort by Relevance</option>
          </select>
          
          {sources.length > 0 && (
            <select 
              value={filterSource} 
              onChange={(e) => {
                const value = e.target.value;
                setFilterSource(value);
                if (onSelectSource) {
                  onSelectSource(value || null);
                }
              }}
              className="source-select"
            >
              <option value="">All Sources</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="bookshelf-filter-bar">
        <div className="filter-bar-header">
          <div className="filter-chip-row">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="filter-chip"
                onClick={() => onToggleTag && onToggleTag(tag)}
              >
                🏷️ {tag}
                <span className="remove">×</span>
              </button>
            ))}
            {selectedSource && (
              <span className="filter-chip static">
                🔗 {sources.find((s) => s.id === selectedSource)?.name || selectedSource.substring(0, 8)}
              </span>
            )}
            {selectedDocType && (
              <span className="filter-chip static">📄 {selectedDocType}</span>
            )}
            {selectedAuthor && (
              <span className="filter-chip static">👤 {selectedAuthor}</span>
            )}
            {selectedConcept && (
              <span className="filter-chip static">🧭 {selectedConcept.term || selectedConcept.label || selectedConcept.name || selectedConcept}</span>
            )}
            {selectedTags.length === 0 && !selectedSource && !selectedDocType && !selectedAuthor && !selectedConcept && (
              <span className="filter-muted">No active filters</span>
            )}
          </div>
          <div className="filter-bar-actions">
            <div className="tag-filter-toggle compact" role="group" aria-label="Tag filter mode">
              <button
                type="button"
                className={tagFilterMode === 'and' ? 'active' : ''}
                onClick={() => onTagFilterModeChange && onTagFilterModeChange('and')}
                aria-pressed={tagFilterMode === 'and'}
              >
                AND
              </button>
              <button
                type="button"
                className={tagFilterMode === 'or' ? 'active' : ''}
                onClick={() => onTagFilterModeChange && onTagFilterModeChange('or')}
                aria-pressed={tagFilterMode === 'or'}
              >
                OR
              </button>
            </div>
            {onClearFilters && (
              <button className="ghost-button" type="button" onClick={onClearFilters}>
                Clear All
              </button>
            )}
          </div>
        </div>
        <div className="filter-tag-cloud">
          {tagCounts.length > 0 ? (
            tagCounts.slice(0, 20).map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                className={`tag-item ${selectedTags.includes(normalizeTag(tag)) ? 'active' : ''}`}
                onClick={() => onToggleTag && onToggleTag(tag)}
              >
                {tag} <span className="tag-count">({count})</span>
              </button>
            ))
          ) : (
            <span className="filter-muted">No tags in subset yet.</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="bookshelf-main">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading your library...</p>
          </div>
        ) : error ? (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <button onClick={fetchDocuments}>Try Again</button>
          </div>
        ) : Object.keys(groupedDocuments).length === 0 ? (
          <div className="empty-state">
            <p>📭 No documents found</p>
            {browseMode === 'favorites' && <p>Drag items here or click ☆ to add favorites</p>}
            {browseMode === 'recent' && <p>Your recently viewed items will appear here</p>}
          </div>
        ) : (
          <div className={`documents-container view-${viewMode}`}>
            {Object.entries(groupedDocuments).map(([groupName, docs]) => (
              <section key={groupName} className="document-group">
                <h2 className="group-title">
                  {groupName}
                  <span className="group-count">{docs.length}</span>
                </h2>
                
                {viewMode === 'shelf' ? (
                  <div className="wooden-shelf">
                    <div className="shelf-books">
                      {docs.map(renderDocument)}
                    </div>
                    <div className="shelf-wood"></div>
                    <div className="shelf-shadow"></div>
                  </div>
                ) : (
                  <div className={`documents-${viewMode}`}>
                    {docs.map(renderDocument)}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Hover Preview */}
      {renderHoverPreview()}

      {/* Detail Panel */}
      {renderDetailPanel()}

      {/* Drag indicator */}
      {draggedDoc && (
        <div className="drag-indicator">
          Drop on ⭐ Favorites to save
        </div>
      )}
    </div>
  );
};

export default Bookshelf;
