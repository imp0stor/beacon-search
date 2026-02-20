# Beacon Search UI Enhancements (Visual Browse + Drill-Down)

## What shipped
- **Iterative tag drill-down** with AND/OR toggle and live recomputed tag counts from the current subset.
- **Concept Navigator** (ontology drill-down) with shared filter state and content filtering.
- **Metadata Explorer** (sources, types, authors) for quick slicing.
- **Shared filter state** across Search, Explore, and Bookshelf (tags + concepts), including removable chips + clear-all.
- **Accessible breadcrumb trail** to step backward through the drill-down path.
- **Bookshelf cross-filtering** using the same shared tag/concept state.

## Interaction map
- **Search > Tag click** → filters results (AND by default) → tag cloud recomputes using current subset.
- **AND/OR toggle** → switches tag filter logic immediately across panels.
- **Explore > Concept Navigator** → click concept → filters results & updates breadcrumb.
- **Breadcrumb trail** → click any crumb to jump back and clear deeper filters.
- **Metadata Explorer** → click Source/Type/Author chips → filter results & update chips.
- **Bookshelf** → tag click (cards/detail) → updates shared tag filters, cross-filtering all panels.

## API wiring + placeholders
- **/api/search/filtered**: attempted when filters are active; fallback to basic `/api/search` or `/api/documents` when not available. TODO hooks remain in code.
- **/api/ontology?tree=true**: used for concept drill-down; placeholder UI is shown if not available.
- **/api/tags/cloud**: optional; local recomputed tag cloud used for drill-down subsets.

## Test commands
```bash
# install deps
npm install

# dev server
npm start

# production build
npm run build
```

## Manual QA checklist
- [ ] Select multiple tags → results reduce with AND logic; OR toggle broadens.
- [ ] Breadcrumb reflects: Home > Explore > Tag A > Tag B > Concept C; clicks step back.
- [ ] Concept drill-down filters results and updates tags in Explore + Bookshelf.
- [ ] Bookshelf tag clicks update Search/Explore in real time.
- [ ] Clear Filters resets all chips and breadcrumb path.
