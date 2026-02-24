/**
 * FilterContext.js
 * 
 * Global filter state management for Beacon
 * Enables seamless coordination between Tag Cloud, Search Results, Bookshelf, etc.
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    tags: [],
    contentTypes: [],
    dateRange: null,
    quality: 0.3,
    authors: [],
    search: '',
    hasMedia: false,
    minQuality: 0.3
  });

  // Load filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const newFilters = {
      tags: params.get('tags') ? params.get('tags').split(',').map(t => t.trim()) : [],
      contentTypes: params.get('types') ? params.get('types').split(',').map(t => t.trim()) : [],
      quality: parseFloat(params.get('quality')) || 0.3,
      search: params.get('q') || '',
      authors: params.get('authors') ? params.get('authors').split(',').map(a => a.trim()) : [],
      hasMedia: params.get('media') === 'true',
      minQuality: parseFloat(params.get('minQuality')) || 0.3
    };

    // Only update if different from current
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    }
  }, []); // Only on mount

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      tags: [],
      contentTypes: [],
      dateRange: null,
      quality: 0.3,
      authors: [],
      search: '',
      hasMedia: false,
      minQuality: 0.3
    });
  }, []);

  const addTag = useCallback((tag) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag]
    }));
  }, []);

  const removeTag = useCallback((tag) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  }, []);

  const setTags = useCallback((tags) => {
    setFilters(prev => ({
      ...prev,
      tags: Array.isArray(tags) ? tags : []
    }));
  }, []);

  const value = {
    filters,
    updateFilters,
    clearFilters,
    addTag,
    removeTag,
    setTags,
    hasActiveFilters: () => {
      return filters.tags.length > 0 ||
             filters.contentTypes.length > 0 ||
             filters.authors.length > 0 ||
             filters.search.length > 0 ||
             filters.hasMedia ||
             filters.quality > 0.3;
    }
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

/**
 * Hook to use filter context
 */
export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
};
