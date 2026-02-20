# Beacon Search Enterprise UI Overhaul (Dark Premium)

## Goals
- Deliver a knowledge-base grade UX with enterprise polish and a NostrMaxi-style dark premium tone.
- Preserve API-first compatibility (existing endpoints unchanged).
- Add responsive + accessibility improvements.
- Keep changes additive/reversible (CSS + layout only).

---

## UX Architecture (Knowledge-Base Grade Workflows)

### 1) Search Workspace (Primary)
- **Intent:** Fast retrieval (semantic + keyword) with rich document drill-in.
- **Primary widgets:** Search bar, mode selector, results list, metadata/relationship tabs.
- **Secondary widgets:** Active filters, quick insights, NLP health.

### 2) Faceted Explore
- **Intent:** Discovery via tags/entities/sentiment.
- **Primary widgets:** Tag cloud, entity groups, sentiment toggles.
- **Actions:** “Apply Filters to Search” to pivot back to retrieval.

### 3) Source Connectors
- **Intent:** Visibility into ingestion coverage.
- **Primary widgets:** Connector cards, status pills, onboarding actions.
- **Design note:** UI supports live data when connector API endpoints are added.

### 4) Relationship View
- **Intent:** Relationship inspection and context graph exploration.
- **Primary widgets:** Entity clusters, related documents, shared-tag metadata.
- **Design note:** For the first iteration this leverages existing entity + related doc endpoints.

### 5) Analytics Panel
- **Intent:** Health + coverage analytics for knowledge operations.
- **Primary widgets:** KPI tiles, top tag trends, sentiment distribution.
- **Design note:** KPI tiles are bound to existing NLP status + facet data.

---

## Component Map

### App Shell
- `TopBar` (brand + status + global actions)
- `SideNav` (workspace selection)
- `Workspace` (main content area)
- `ContextPanel` (filters + quick insights + intake)

### Search Flow
- `SearchForm` (query + mode)
- `ResultsList`
- `ResultCard`
- `DocumentDetailPanel` (metadata, entities, tags, related)

### Faceted Explore
- `FacetExplorer`
- `SentimentPanel`

### Connectors
- `ConnectorList`
- `ConnectorActions`

### Relationships
- `RelationshipGrid` (entity clusters + related docs)

### Analytics
- `AnalyticsGrid`
- `TopTagsPanel`
- `SentimentDistribution`

---

## Theming Tokens (CSS Variables)

```css
:root {
  --bg-primary: #0b111b;
  --bg-secondary: #0f172a;
  --bg-tertiary: #141c2f;
  --bg-elevated: #1b233a;
  --border-subtle: rgba(148, 163, 184, 0.15);
  --border-strong: rgba(148, 163, 184, 0.3);
  --text-primary: #f8fafc;
  --text-secondary: #cbd5f5;
  --text-muted: #8b96b4;
  --accent-primary: #7c5cff;
  --accent-secondary: #a855f7;
  --success: #2dd4bf;
  --warning: #facc15;
  --danger: #f87171;
  --shadow-soft: 0 12px 30px rgba(15, 23, 42, 0.35);
  --shadow-strong: 0 18px 45px rgba(8, 15, 29, 0.5);
  --radius-lg: 20px;
}
```

---

## Accessibility & Responsive Notes

### Accessibility
- Added `aria-label` attributes for search input, actions, and filter chips.
- Added focus-visible outlines for keyboard navigation.
- Buttons/controls preserve semantic HTML.

### Responsive Behavior
- **≤1200px:** Context panel stacks below workspace.
- **≤960px:** Side navigation becomes horizontal.
- **≤720px:** Top bar stacks; search input becomes vertical.

---

## Rollout Plan
1. **Stage 1:** Ship UI shell + new layout (current patch). No backend changes.
2. **Stage 2:** Wire real connector health + analytics metrics endpoints.
3. **Stage 3:** Relationship graph visualization (D3/vis-network optional).
4. **Stage 4:** Role-based workspace personalization + saved filter sets.

---

## Build / Artifact
- Run `npm --prefix frontend run build` to produce `/frontend/build`.

---

## Files Touched
- `frontend/src/App.js`
- `frontend/src/App.css`
- `docs/ENTERPRISE-UI-OVERHAUL.md`
