# NostrCast Migration Checklist (Shared UI)

## Preparation
- [ ] Document current theme + component variants
- [ ] Add `shared-ui.css` import to app entry
- [ ] Identify UI surfaces (cards, panels, KPIs, modals)

## App Shell
- [ ] Wrap top-level layout with `.ui-app`
- [ ] Apply token-based backgrounds on main view

## Navigation / Sidebar
- [ ] Sidebar container → `.ui-rail`
- [ ] Items → `.ui-rail-item`
- [ ] Active state via `data-active='true'`

## Cards & Panels
- [ ] Primary panels → `.ui-card`
- [ ] Secondary panels → `.ui-card-subtle`
- [ ] KPI metrics → `.ui-kpi`

## Actions
- [ ] Primary actions → `.ui-cta`
- [ ] Secondary actions → `.ui-button`

## Lists & Tables
- [ ] Convert list/table to `.ui-table` styling
- [ ] Validate row spacing/rounding

## Status & Badges
- [ ] Status chips → `.ui-status` with `data-variant`
- [ ] Tags → `.ui-pill`
- [ ] Label text → `.ui-label`

## Forms
- [ ] Inputs → `.ui-input`

## Regression Sweep
- [ ] Run responsive QA checklist
- [ ] Capture screenshots for acceptance rubric
