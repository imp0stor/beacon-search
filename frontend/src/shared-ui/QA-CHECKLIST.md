# Responsive QA Checklist + Screenshot Acceptance Rubric

## Responsive QA Checklist
Test all key views on the following widths (or nearest device presets):
- **1440px** (desktop)
- **1280px** (desktop)
- **1024px** (tablet landscape)
- **834px** (tablet portrait)
- **768px** (small tablet)
- **430px** (large phone)
- **390px** (phone)

### Layout & Spacing
- [ ] `.ui-card` / `.ui-kpi` spacing stays consistent
- [ ] Rail does not overlap content at smaller widths
- [ ] Tables maintain row padding and rounding
- [ ] CTA buttons remain visible and clickable

### Typography & Color
- [ ] Text contrast meets readability on dark surfaces
- [ ] `.ui-label` remains legible (no clipping)
- [ ] Muted text does not drop below readable threshold

### Components
- [ ] `.ui-input` aligns with buttons/labels
- [ ] `.ui-status` pills scale without truncation
- [ ] `.ui-table` headers stay aligned with rows

### Interaction
- [ ] Hover styles appear on desktop
- [ ] CTA hover lift is smooth (no jitter)
- [ ] Focus states visible for inputs and buttons

---

## Screenshot Acceptance Rubric

### Required Screenshots
Capture the following for each app:
1. **Dashboard/Home** (primary card layout)
2. **Detail View** (table/list view)
3. **Settings/Config** (forms/inputs)
4. **Status/Activity** (status pills, tags)
5. **CTA State** (primary action visible)

### Acceptance Criteria
- ✅ Tokens match spec (background, surfaces, border, accents)
- ✅ Cards/kpis use correct radius and shadow
- ✅ CTA uses gradient and rounded pill style
- ✅ Status pills use correct variant colors
- ✅ Table rows show surface 2 + rounding
- ✅ No custom colors overriding tokens
- ✅ Typography consistent across pages

### Failure Conditions (Reject)
- ❌ Mixed legacy styles alongside shared UI primitives
- ❌ Off-brand accent colors
- ❌ Missing CTA gradient
- ❌ Incorrect status pill variants
- ❌ Table rows without spacing or rounding

### Naming Convention
`<app>-<view>-<width>.png`

Example: `beacon-dashboard-1440.png`
