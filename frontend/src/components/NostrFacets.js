/**
 * Nostr Faceted Search Component
 * Provides filters for Nostr event search
 */

import React, { useState, useEffect } from 'react';
import './NostrFacets.css';

const NostrFacets = ({ onFilterChange, apiUrl }) => {
  const [facets, setFacets] = useState(null);
  const [selectedKinds, setSelectedKinds] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacets();
  }, []);

  useEffect(() => {
    // Notify parent of filter changes
    onFilterChange({
      kinds: selectedKinds,
      categories: selectedCategories,
      tags: selectedTags,
    });
  }, [selectedKinds, selectedCategories, selectedTags]);

  const fetchFacets = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/nostr/facets`);
      const data = await response.json();
      setFacets(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch Nostr facets:', error);
      setLoading(false);
    }
  };

  const toggleKind = (kind) => {
    setSelectedKinds(prev =>
      prev.includes(kind)
        ? prev.filter(k => k !== kind)
        : [...prev, kind]
    );
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedKinds([]);
    setSelectedCategories([]);
    setSelectedTags([]);
  };

  if (loading) {
    return <div className="nostr-facets loading">Loading filters...</div>;
  }

  if (!facets) {
    return null;
  }

  const hasActiveFilters = selectedKinds.length > 0 || selectedCategories.length > 0 || selectedTags.length > 0;

  return (
    <div className="nostr-facets">
      <div className="facets-header">
        <h3>⚡ Nostr Filters</h3>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="clear-filters">Clear All</button>
        )}
      </div>

      {/* Categories */}
      {facets.categories && facets.categories.length > 0 && (
        <div className="facet-group">
          <h4>Category</h4>
          <div className="facet-items">
            {facets.categories.map(({ category, count }) => (
              <label key={category} className="facet-item">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span className="facet-label">
                  {category} <span className="facet-count">({count})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Event Kinds */}
      {facets.kinds && facets.kinds.length > 0 && (
        <div className="facet-group">
          <h4>Event Type</h4>
          <div className="facet-items">
            {facets.kinds.slice(0, 10).map(({ kind, name, count }) => (
              <label key={kind} className="facet-item">
                <input
                  type="checkbox"
                  checked={selectedKinds.includes(kind)}
                  onChange={() => toggleKind(kind)}
                />
                <span className="facet-label">
                  {name} <span className="facet-count">({count})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {facets.tags && facets.tags.length > 0 && (
        <div className="facet-group">
          <h4>Tags</h4>
          <div className="facet-items tag-cloud">
            {facets.tags.slice(0, 20).map(({ tag, count }) => (
              <button
                key={tag}
                className={`tag-button ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                #{tag} ({count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NostrFacets;
