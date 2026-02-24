/**
 * FilterBreadcrumb.jsx
 * 
 * Displays all active filters in a breadcrumb-style navigation
 * Allows quick removal of individual filters
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import React from 'react';
import { useFilters } from '../context/FilterContext';
import './FilterBreadcrumb.css';

function FilterBreadcrumb() {
  const { filters, removeTag, updateFilters, clearFilters, hasActiveFilters } = useFilters();

  if (!hasActiveFilters()) {
    return null;
  }

  const handleRemoveTag = (tag) => {
    removeTag(tag);
  };

  const handleRemoveContentType = (type) => {
    updateFilters({
      contentTypes: filters.contentTypes.filter(t => t !== type)
    });
  };

  const handleRemoveAuthor = (author) => {
    updateFilters({
      authors: filters.authors.filter(a => a !== author)
    });
  };

  const handleClearSearch = () => {
    updateFilters({ search: '' });
  };

  return (
    <div className="filter-breadcrumb">
      <div className="breadcrumb-content">
        <span className="breadcrumb-label">Active Filters:</span>

        {/* Tags */}
        {filters.tags && filters.tags.map(tag => (
          <div key={`tag-${tag}`} className="breadcrumb-item tag">
            <span className="item-label">🏷️ {tag}</span>
            <button
              className="remove-btn"
              onClick={() => handleRemoveTag(tag)}
              title="Remove tag filter"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Content Types */}
        {filters.contentTypes && filters.contentTypes.map(type => (
          <div key={`type-${type}`} className="breadcrumb-item type">
            <span className="item-label">📄 {type}</span>
            <button
              className="remove-btn"
              onClick={() => handleRemoveContentType(type)}
              title="Remove content type filter"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Authors */}
        {filters.authors && filters.authors.map(author => (
          <div key={`author-${author}`} className="breadcrumb-item author">
            <span className="item-label">👤 {author}</span>
            <button
              className="remove-btn"
              onClick={() => handleRemoveAuthor(author)}
              title="Remove author filter"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Search */}
        {filters.search && (
          <div className="breadcrumb-item search">
            <span className="item-label">🔍 "{filters.search}"</span>
            <button
              className="remove-btn"
              onClick={handleClearSearch}
              title="Clear search"
            >
              ✕
            </button>
          </div>
        )}

        {/* Media Filter */}
        {filters.hasMedia && (
          <div className="breadcrumb-item media">
            <span className="item-label">📸 Has Media</span>
            <button
              className="remove-btn"
              onClick={() => updateFilters({ hasMedia: false })}
              title="Remove media filter"
            >
              ✕
            </button>
          </div>
        )}

        {/* Clear All */}
        <button className="clear-all-btn" onClick={clearFilters}>
          Clear All
        </button>
      </div>
    </div>
  );
}

export default FilterBreadcrumb;
