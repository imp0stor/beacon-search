/**
 * TagCloud.jsx
 * 
 * Interactive tag cloud with drill-down navigation
 * Features:
 *   - Visual representation of tags sized by frequency
 *   - Click to drill down (add tag to filter)
 *   - Breadcrumb navigation to track drill-down path
 *   - Cloud reshapes based on co-occurrence with selected tags
 *   - Color coding for visual distinction
 *   - Integrates with shared FilterContext for cross-panel synchronization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useFilters } from '../context/FilterContext';
import './TagCloud.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function TagCloud({
  // Props can be used for backwards compatibility or override context
  maxTags = 50,
  minCount = 1
}) {
  const { filters, setTags, clearFilters } = useFilters();
  const selectedTags = filters.tags || [];

  const [tags, setTagsState] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch tag cloud data
  useEffect(() => {
    const fetchTagCloud = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedTags.length > 0) {
          params.append('selectedTags', selectedTags.join(','));
        }
        params.append('maxTags', maxTags.toString());
        params.append('minCount', minCount.toString());

        const response = await fetch(`${API_URL}/api/tags/cloud?${params}`);
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        setTagsState(data.tags);
      } catch (err) {
        console.error('Failed to fetch tag cloud:', err);
        setError('Failed to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTagCloud();
  }, [selectedTags, maxTags, minCount]);

  const handleTagClick = useCallback((tag) => {
    // Add tag to filter context (not replace)
    const newTags = selectedTags.includes(tag)
      ? selectedTags
      : [...selectedTags, tag];
    setTags(newTags);
  }, [selectedTags, setTags]);

  const handleRemoveFromBreadcrumb = useCallback((index) => {
    // Remove tag at index and all tags after it
    const newTags = selectedTags.slice(0, index);
    setTags(newTags);
  }, [selectedTags, setTags]);

  const handleClear = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  if (error) {
    return <div className="tag-cloud-error">{error}</div>;
  }

  return (
    <div className="tag-cloud-container">
      {/* Breadcrumb Navigation */}
      {selectedTags.length > 0 && (
        <div className="tag-cloud-breadcrumb">
          <div className="breadcrumb-path">
            <span className="breadcrumb-item breadcrumb-root" onClick={() => handleRemoveFromBreadcrumb(0)}>
              All Tags
            </span>
            {selectedTags.map((tag, idx) => (
              <React.Fragment key={`${tag}-${idx}`}>
                <span className="breadcrumb-separator">/</span>
                <span
                  className="breadcrumb-item breadcrumb-tag"
                  onClick={() => handleRemoveFromBreadcrumb(idx + 1)}
                  title={`Click to go back to after ${tag}`}
                >
                  {tag}
                </span>
              </React.Fragment>
            ))}
          </div>
          <button className="breadcrumb-clear-btn" onClick={handleClear} title="Clear all filters">
            ✕ Clear All
          </button>
        </div>
      )}

      {/* Tag Cloud Title */}
      <h3 className="tag-cloud-title">
        {selectedTags.length > 0 ? `Related to: ${selectedTags.join(' > ')}` : 'Explore Topics'}
      </h3>

      {/* Loading State */}
      {loading && <div className="tag-cloud-loading">Loading tags...</div>}

      {/* Tag Cloud Grid */}
      {!loading && tags.length > 0 && (
        <div className="tag-cloud-grid">
          {tags.map((item, idx) => (
            <button
              key={`${item.tag}-${idx}`}
              className="tag-cloud-item"
              style={{
                fontSize: `${item.size}%`,
                backgroundColor: item.color,
                opacity: 0.85
              }}
              onClick={() => handleTagClick(item.tag)}
              title={`${item.tag} (${item.count} documents)`}
            >
              <span className="tag-cloud-text">{item.tag}</span>
              <span className="tag-cloud-count">{item.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && tags.length === 0 && (
        <div className="tag-cloud-empty">
          <p>No tags found</p>
          {selectedTags.length > 0 && (
            <button onClick={handleClear} className="empty-state-reset">
              Clear filters and try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TagCloud;
