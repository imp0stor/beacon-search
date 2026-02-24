# Unified UI Framework Spec (Shared UI)

## Purpose
Single source of truth for shared tokens + component primitives used across Strange Signal products. This spec describes the available tokens, CSS primitives, and usage rules for consistent implementation.

---

## Design Tokens (CSS Variables)
Defined in `shared-ui.css` under `:root`.

### Core Surfaces & Borders
- `--ui-bg` → App background
- `--ui-surface` → Primary card/surface
- `--ui-surface-2` → Secondary surface (tables/KPIs)
- `--ui-surface-3` → Tertiary surface (inputs)
- `--ui-border` → Default border
- `--ui-border-strong` → Higher contrast border

### Text & Accents
- `--ui-text` → Primary text
- `--ui-muted` → Secondary text
- `--ui-muted-2` → Tertiary text
- `--ui-accent` → Primary accent
- `--ui-accent-2` → Secondary accent
- `--ui-accent-3` → Deep accent
- `--ui-gradient` → CTA gradient

### Status Colors
- `--ui-success` → Success/Active
- `--ui-warning` → Warning/Pending
- `--ui-danger` → Error/Unverified
- `--ui-info` → Info/Neutral

### Depth & Shape
- `--ui-shadow` → Core shadow
- `--ui-radius-lg` → 20px
- `--ui-radius-md` → 14px
- `--ui-radius-sm` → 10px

### Typography
- `--ui-font` → Inter + system stack

---

## Component Primitives (CSS Classes)

### App Shell
- `.ui-app` → App root wrapper (background, font, text, min-height)

### Navigation Rail
- `.ui-rail` → Vertical nav container
- `.ui-rail-item` → Nav item (hover + active styles)
- `.ui-rail-item[data-active='true']` → Active state

### Cards & KPIs
- `.ui-card` → Primary card
- `.ui-card-subtle` → Secondary card
- `.ui-kpi` → KPI tile

### CTA & Buttons
- `.ui-cta` → Primary gradient call-to-action (hover lift)
- `.ui-button` → Secondary action button

### Tables
- `.ui-table` → Styled table (row cards)
- `.ui-table thead th` → Header text styles
- `.ui-table tbody tr` → Surface + rounding

### Status Pills
- `.ui-status` → Base status pill
- `.ui-status[data-variant='active']`
- `.ui-status[data-variant='pending']`
- `.ui-status[data-variant='unverified']`
- `.ui-status[data-variant='info']`

### Inputs & Text Helpers
- `.ui-input` → Text inputs
- `.ui-label` → Uppercase label
- `.ui-muted` / `.ui-muted-2` → Muted text
- `.ui-highlight` → Accent highlight

### Misc
- `.ui-divider` → Thin divider line
- `.ui-pill` → Neutral pill
- `.ui-chart-line` / `.ui-chart-dot` → Chart styling

---

## Usage Rules

1. **Import Once**: `shared-ui.css` should be imported once per app entry point (e.g., `src/index.css`).
2. **No Token Overrides**: Do not override `:root` tokens inside product scopes unless approved. Local tweaks should use utility wrappers or custom classes outside `shared-ui.css`.
3. **Keep Primitives Atomic**: Use primitives as base building blocks. Product-specific components should compose these classes rather than re-implementing styles.
4. **Status Variants**: Use `data-variant` for `.ui-status` instead of additional classes.
5. **Tables as Cards**: `.ui-table` expects `tbody tr` to represent card-like rows; keep spacing and row rounding intact.
6. **Typography**: Use `.ui-label` for section headers/metadata labels to keep consistent casing and letter-spacing.
7. **Accessibility**: Maintain color contrast; don’t swap tokens for low-contrast custom hues.
8. **Dark Theme Assumption**: Tokens are optimized for dark navy surfaces. If a light theme is needed, it should be a separate `:root` override file.

---

## Adoption Checklist (Quick)
- [ ] CSS imported into app root
- [ ] Root wrapper uses `.ui-app`
- [ ] Cards and KPIs mapped to `.ui-card` / `.ui-kpi`
- [ ] Primary CTA uses `.ui-cta`
- [ ] Status labels mapped to `.ui-status`
- [ ] Tables refactored to `.ui-table`
