/**
 * InfiniteScrollResults Component
 * Handles infinite scroll with virtual scrolling for performance
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import MediaViewer from './MediaViewer';
import './InfiniteScrollResults.css';

const resolveApiUrl = () => {
  const envApi = process.env.REACT_APP_API_URL;

  if (typeof window === 'undefined') {
    return envApi || 'http://localhost:3001';
  }

  if (envApi) {
    const envIsLocal = /localhost|127\.0\.0\.1/.test(envApi);
    const clientIsLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
    if (!(envIsLocal && !clientIsLocal)) return envApi;
  }

  return `${window.location.protocol}//${window.location.hostname}:3001`;
};

const API_URL = resolveApiUrl();

function InfiniteScrollResults({ 
  query, 
  mode, 
  filters, 
  onResultClick 
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;
  
  const observerTarget = useRef(null);
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Reset when search parameters change
  useEffect(() => {
    setResults([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
  }, [query, mode, filters]);

  // Load more results
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      params.append('mode', mode);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      
      // Add filters
      if (filters.tags?.length > 0) {
        params.append('tags', filters.tags.join(','));
      }
      if (filters.minQuality !== undefined) {
        params.append('minQuality', filters.minQuality.toString());
      }
      if (filters.hasMedia) {
        params.append('hasMedia', 'true');
      }

      const response = await fetch(`${API_URL}/api/search/advanced?${params}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      setResults(prev => [...prev, ...data.results]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setOffset(prev => prev + limit);

    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to load results');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [query, mode, filters, offset, loading, hasMore]);

  // Initial load
  useEffect(() => {
    if (results.length === 0 && offset === 0) {
      loadMore();
    }
  }, [query, mode, filters, results.length, offset, loadMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadMore]);

  const handleMediaClick = (mediaUrls, index = 0) => {
    setSelectedMedia({ urls: mediaUrls, currentIndex: index });
  };

  const closeMediaViewer = () => {
    setSelectedMedia(null);
  };

  if (error && results.length === 0) {
    return (
      <div className="search-error">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
        <button onClick={loadMore} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="infinite-scroll-container">
      {/* Results Header */}
      {total > 0 && (
        <div className="results-header">
          <span className="results-count">
            {results.length} of {total} results
          </span>
          {filters.tags?.length > 0 && (
            <span className="filter-indicator">
              🏷️ Filtered by {filters.tags.length} tag{filters.tags.length !== 1 ? 's' : ''}
            </span>
          )}
          {filters.minQuality > 0.3 && (
            <span className="filter-indicator">
              ⭐ Quality ≥ {filters.minQuality.toFixed(1)}
            </span>
          )}
          {filters.hasMedia && (
            <span className="filter-indicator">
              🖼️ With media
            </span>
          )}
        </div>
      )}

      {/* Results Grid */}
      <div className="results-grid">
        {results.map((result, index) => (
          <ResultCard
            key={`${result.id}-${index}`}
            result={result}
            onClick={onResultClick}
            onMediaClick={handleMediaClick}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="loading-more">
          <div className="spinner"></div>
          <p>Loading more results...</p>
        </div>
      )}

      {/* Intersection observer target */}
      {hasMore && !loading && (
        <div ref={observerTarget} className="load-more-trigger">
          <button onClick={loadMore} className="load-more-btn">
            Load More
          </button>
        </div>
      )}

      {/* End of results */}
      {!hasMore && results.length > 0 && (
        <div className="end-of-results">
          <p>✓ End of results ({total} total)</p>
        </div>
      )}

      {/* No results */}
      {!loading && results.length === 0 && (
        <div className="no-results">
          <span className="icon">🔍</span>
          <h3>No results found</h3>
          <p>Try adjusting your search query or filters</p>
        </div>
      )}

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <MediaViewer
          mediaUrls={selectedMedia.urls}
          currentIndex={selectedMedia.currentIndex}
          onClose={closeMediaViewer}
        />
      )}
    </div>
  );
}

/* Result Card Component */
function ResultCard({ result, onClick, onMediaClick }) {
  const mediaUrls = (() => {
    if (Array.isArray(result.media_urls)) return result.media_urls;
    if (typeof result.media_urls === 'string' && result.media_urls.trim().length > 0) {
      try {
        return JSON.parse(result.media_urls);
      } catch {
        return [];
      }
    }
    return [];
  })();
  const hasMedia = mediaUrls.length > 0;

  // Quality indicator
  const getQualityClass = (score) => {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'low';
  };

  const qualityClass = getQualityClass(result.quality_score || 0.5);

  return (
    <div 
      className={`result-card ${hasMedia ? 'has-media' : ''}`}
      onClick={() => onClick && onClick(result)}
    >
      {/* Quality Indicator */}
      <div className={`quality-badge ${qualityClass}`} title={`Quality: ${(result.quality_score * 100).toFixed(0)}%`}>
        <span className="quality-stars">
          {result.quality_score >= 0.8 ? '⭐⭐⭐' :
           result.quality_score >= 0.6 ? '⭐⭐' :
           result.quality_score >= 0.4 ? '⭐' : ''}
        </span>
      </div>

      {/* Media Preview */}
      {hasMedia && (
        <div 
          className="media-preview"
          onClick={(e) => {
            e.stopPropagation();
            onMediaClick(mediaUrls, 0);
          }}
        >
          <img 
            src={mediaUrls[0]} 
            alt={result.title}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          {mediaUrls.length > 1 && (
            <div className="media-count">
              🖼️ +{mediaUrls.length - 1}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="card-content">
        <h3 className="card-title">{result.title}</h3>
        
        <p className="card-snippet">
          {(result.content || '').substring(0, 200)}
          {(result.content || '').length > 200 && '...'}
        </p>

        {/* Tags */}
        {result.tags && result.tags.length > 0 && (
          <div className="card-tags">
            {result.tags.slice(0, 5).map(tag => (
              <span key={tag} className="card-tag">
                {tag}
              </span>
            ))}
            {result.tags.length > 5 && (
              <span className="card-tag more">+{result.tags.length - 5}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="card-footer">
          {result.url && (
            <a 
              href={result.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="card-url"
              onClick={(e) => e.stopPropagation()}
            >
              🔗 {(() => {
                try { return new URL(result.url).hostname; }
                catch { return result.url; }
              })()}
            </a>
          )}
          
          {result.score !== undefined && (
            <span className="card-score" title="Relevance score">
              {(result.score * 100).toFixed(0)}% match
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default InfiniteScrollResults;
