/**
 * useUrlFilters.js
 * 
 * Hook for synchronizing filter state with URL query parameters
 * Enables bookmarking and sharing of filtered views
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import { useEffect, useRef } from 'react';
import { useFilters } from '../context/FilterContext';

const DEBOUNCE_DELAY = 300; // ms

export const useUrlFilters = () => {
  const { filters } = useFilters();
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Debounce URL updates to avoid excessive history spam
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      // Build URL params from current filters
      const params = new URLSearchParams();

      if (filters.tags && filters.tags.length > 0) {
        params.set('tags', filters.tags.join(','));
      }

      if (filters.contentTypes && filters.contentTypes.length > 0) {
        params.set('types', filters.contentTypes.join(','));
      }

      if (filters.authors && filters.authors.length > 0) {
        params.set('authors', filters.authors.join(','));
      }

      if (filters.search) {
        params.set('q', filters.search);
      }

      if (filters.quality && filters.quality !== 0.3) {
        params.set('quality', filters.quality.toString());
      }

      if (filters.hasMedia) {
        params.set('media', 'true');
      }

      // Update URL without full page reload
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname;

      window.history.replaceState({}, '', newUrl);
    }, DEBOUNCE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [filters]);
};
