# NostrMaxi Migration Checklist (Shared UI)

## Preparation
- [ ] Audit UI elements using non-standard colors
- [ ] Add `shared-ui.css` import to app entry
- [ ] List primary UI views to migrate

## App Shell
- [ ] Apply `.ui-app` to root container
- [ ] Remove duplicate font/background styles

## Navigation
- [ ] Sidebar/rail container → `.ui-rail`
- [ ] Items → `.ui-rail-item` with `data-active='true'`

## Cards & KPIs
- [ ] Primary panels → `.ui-card`
- [ ] Secondary panels → `.ui-card-subtle`
- [ ] Metrics tiles → `.ui-kpi`

## Actions
- [ ] Primary actions → `.ui-cta`
- [ ] Secondary actions → `.ui-button`

## Tables & Lists
- [ ] Convert tables to `.ui-table`
- [ ] Ensure row rounding preserved

## Status & Meta
- [ ] Status pills → `.ui-status` with `data-variant`
- [ ] Labels → `.ui-label`
- [ ] Use `.ui-muted` for secondary text

## Inputs
- [ ] Input fields → `.ui-input`

## Regression Sweep
- [ ] Run responsive QA checklist
- [ ] Capture screenshots for acceptance rubric
