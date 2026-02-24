# Beacon UX Bundle — Integration Notes

## What Was Merged (2026-02-20)

### ✅ Fully Done

| File | Destination | Status |
|------|-------------|--------|
| beacon-tag-filter.jsx | frontend/src/components/TagFilterSidebar.jsx | ✅ Copied |
| beacon-tag-filter.css | frontend/src/components/TagFilterSidebar.css | ✅ Copied |
| beacon-infinite-scroll.jsx | frontend/src/components/InfiniteScrollResults.jsx | ✅ Copied |
| beacon-infinite-scroll.css | frontend/src/components/InfiniteScrollResults.css | ✅ Copied |
| beacon-media-viewer.jsx | frontend/src/components/MediaViewer.jsx | ✅ Copied |
| beacon-media-viewer.css | frontend/src/components/MediaViewer.css | ✅ Copied |
| beacon-quality-scoring.ts | backend/src/services/quality.ts | ✅ Copied |
| beacon-api-updates.ts | backend/src/routes/ux.ts (wrapped as Express Router) | ✅ Integrated |
| beacon-ux-migration.sql | migrations/010_ux_bundle.sql | ✅ Copied (renumbered from 004 — existing 004-009 conflict) |

### Backend Routes Added (active immediately)
- `GET /api/tags` — tags with counts, category and search filters
- `GET /api/tags/categories` — tag counts grouped by category
- `GET /api/search/advanced` — infinite-scroll search with quality/tag/media filters
- `POST /api/documents/:id/recalculate-quality`
- `POST /api/documents/recalculate-all-quality`

### Pre-existing Build Issues (NOT caused by this bundle)
- `backend/src/plugins/wot/providers.ts` — 4 TypeScript errors about `RequestInit` and unknown types. Already present before merge.
- `frontend/src/App.js` — imports `../../../shared-ui/feature-flags` outside src/. Already broken before merge.

---

## ⚠️ Manual Wiring Required: App.js

App.js is 900+ lines. Rather than make risky edits, here are the **exact changes** needed:

### 1. Add imports (after the existing imports at top of App.js)

```jsx
import TagFilterSidebar from './components/TagFilterSidebar';
import InfiniteScrollResults from './components/InfiniteScrollResults';
// MediaViewer is imported internally by InfiniteScrollResults — no need to import here
```

### 2. Add state variables (inside the App() function, with existing useState declarations)

```jsx
const [minQuality, setMinQuality] = useState(0.3);
const [showMediaOnly, setShowMediaOnly] = useState(false);
```

### 3. Replace the results `<div className="results">` block in the `search` workspace

Find this block (around line 750 in App.js):
```jsx
<div className="results">
  {searchResults.map((result) => (
    <article ...>
```

Replace it with:
```jsx
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
```

> **Note:** `InfiniteScrollResults` calls `GET /api/search/advanced` directly, so it bypasses the existing `search()` function. The existing search form can remain for keyword entry.

### 4. Run the database migration before deploying

```bash
node apply-migration.js 010_ux_bundle.sql
```

---

## Component API Reference

### `<TagFilterSidebar>`
Props: `selectedTags`, `onTagToggle`, `onClearFilters`, `minQuality`, `onMinQualityChange`, `showMediaOnly`, `onShowMediaOnlyChange`
Fetches: `GET /api/tags`, `GET /api/tags/categories`

### `<InfiniteScrollResults>`
Props: `query`, `mode`, `filters: { tags, minQuality, hasMedia }`, `onResultClick`
Fetches: `GET /api/search/advanced` with infinite scroll via IntersectionObserver

### `<MediaViewer>`
Props: `mediaUrls`, `currentIndex`, `onClose`
Used internally by InfiniteScrollResults result cards.
