# Beacon Migration Checklist (Shared UI)

## Preparation
- [ ] Identify existing UI tokens, colors, typography
- [ ] Inventory components to migrate (cards, CTAs, tables, status pills, inputs)
- [ ] Add `shared-ui.css` import to app entry

## App Shell
- [ ] Wrap root container with `.ui-app`
- [ ] Replace existing background + font with tokens

## Navigation
- [ ] Map side rail/container to `.ui-rail`
- [ ] Map nav items to `.ui-rail-item`
- [ ] Apply active state via `data-active='true'`

## Content Components
- [ ] Migrate primary cards to `.ui-card`
- [ ] Migrate secondary info tiles to `.ui-card-subtle`
- [ ] Convert KPI blocks to `.ui-kpi`

## Actions
- [ ] Primary CTA buttons → `.ui-cta`
- [ ] Secondary actions → `.ui-button`

## Tables + Lists
- [ ] Replace table styles with `.ui-table`
- [ ] Ensure row layout matches card-row style

## Status + Labels
- [ ] Status chips → `.ui-status` with `data-variant`
- [ ] Metadata labels → `.ui-label`
- [ ] Use `.ui-muted` for secondary text

## Inputs
- [ ] Replace input styling with `.ui-input`

## Regression Sweep
- [ ] Compare key pages with previous UI
- [ ] Run responsive QA checklist
- [ ] Capture screenshots for acceptance rubric
