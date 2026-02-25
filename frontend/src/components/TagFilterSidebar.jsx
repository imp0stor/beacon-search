/**
 * TagFilterSidebar Component
 * Enhanced tag filtering with counts and categories
 */

import React, { useState, useEffect } from 'react';
import './TagFilterSidebar.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function TagFilterSidebar({ 
  selectedTags,
  tagFilterMode,
  onTagFilterModeChange,
  wotMode,
  onWotModeChange,
  wotThreshold,
  onWotThresholdChange,
  onTagToggle, 
  onClearFilters,
  minQuality,
  onMinQualityChange,
  showMediaOnly,
  onShowMediaOnlyChange
}) {
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadTags();
    loadCategories();
  }, [selectedCategory, searchTerm]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`${API_URL}/api/tags?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags);
      }
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tags/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleTagClick = (tagName) => {
    onTagToggle(tagName);
  };

  const hasActiveFilters = selectedTags.length > 0 || minQuality > 0.3 || showMediaOnly || (wotMode && wotMode !== 'off');

  return (
    <aside className="tag-filter-sidebar">
      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="active-filters">
          <div className="filter-header">
            <h3>Active Filters</h3>
            <button 
              className="clear-all-btn"
              onClick={onClearFilters}
              title="Clear all filters"
            >
              Clear All
            </button>
          </div>
          
          {selectedTags.length > 0 && (
            <div className="selected-tags">
              {selectedTags.map(tag => (
                <span 
                  key={tag} 
                  className="selected-tag"
                  onClick={() => handleTagClick(tag)}
                >
                  {tag} <span className="remove-icon">×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quality Filter */}
      <div className="filter-section quality-filter">
        <h3>
          <span className="icon">⭐</span> Quality Score
        </h3>
        <div className="quality-slider-container">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={minQuality}
            onChange={(e) => onMinQualityChange(parseFloat(e.target.value))}
            className="quality-slider"
          />
          <div className="quality-value">
            Min: {minQuality.toFixed(1)} {minQuality > 0.3 && '(filtering)'}
          </div>
        </div>
      </div>

      {/* Media Filter */}
      <div className="filter-section media-filter">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showMediaOnly}
            onChange={(e) => onShowMediaOnlyChange(e.target.checked)}
          />
          <span className="icon">🖼️</span> Media only
        </label>
      </div>

      {/* WoT Filter */}
      <div className="filter-section wot-filter">
        <h3>
          <span className="icon">🤝</span> Web of Trust
        </h3>
        <select
          aria-label="WoT mode"
          value={wotMode || 'off'}
          onChange={(e) => onWotModeChange(e.target.value)}
          className="tag-search-input"
        >
          <option value="off">Off</option>
          <option value="open">Open</option>
          <option value="moderate">Moderate</option>
          <option value="strict">Strict</option>
        </select>
        {wotMode !== 'off' && (
          <div className="quality-slider-container" style={{ marginTop: '0.5rem' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={wotThreshold}
              onChange={(e) => onWotThresholdChange(parseFloat(e.target.value))}
              className="quality-slider"
              aria-label="WoT threshold"
            />
            <div className="quality-value">Min WoT: {Number(wotThreshold).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Tag Logic Toggle */}
      {selectedTags.length > 1 && (
        <div className="filter-section tag-logic">
          <label className="radio-group">
            <input
              type="radio"
              value="AND"
              checked={(tagFilterMode || 'and') === 'and'}
              onChange={() => onTagFilterModeChange('and')}
            />
            Match ALL tags
          </label>
          <label className="radio-group">
            <input
              type="radio"
              value="OR"
              checked={(tagFilterMode || 'and') === 'or'}
              onChange={() => onTagFilterModeChange('or')}
            />
            Match ANY tag
          </label>
        </div>
      )}

      {/* Tag Search */}
      <div className="filter-section tag-search">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="tag-search-input"
        />
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="filter-section categories">
          <h3>
            <span className="icon">📁</span> Categories
          </h3>
          <div className="category-list">
            <button
              className={`category-btn ${!selectedCategory ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              All Categories ({categories.reduce((sum, cat) => sum + cat.tag_count, 0)})
            </button>
            {categories.map(cat => (
              <button
                key={cat.category || 'uncategorized'}
                className={`category-btn ${selectedCategory === cat.category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.category)}
              >
                {cat.category || 'Uncategorized'} ({cat.tag_count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="filter-section tags">
        <h3>
          <span className="icon">🏷️</span> Tags
          {loading && <span className="loading-spinner-small"></span>}
        </h3>
        
        {tags.length === 0 && !loading && (
          <div className="no-tags">No tags found</div>
        )}

        <div className="tag-cloud">
          {tags.map(({ name, count, category }) => (
            <button
              key={name}
              className={`tag-item ${selectedTags.includes(name) ? 'active' : ''}`}
              onClick={() => handleTagClick(name)}
              title={category ? `Category: ${category}` : ''}
            >
              <span className="tag-name">{name}</span>
              <span className="tag-count">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Stats */}
      <div className="filter-stats">
        <div className="stat">
          <span className="icon">🏷️</span>
          {tags.length} tags available
        </div>
        {selectedTags.length > 0 && (
          <div className="stat">
            <span className="icon">✓</span>
            {selectedTags.length} selected
          </div>
        )}
      </div>
    </aside>
  );
}

export default TagFilterSidebar;
