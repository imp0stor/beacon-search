# Shared UI

Unified design tokens + primitives for Strange Signal products.

## Contents
- `shared-ui.css` — tokens and component primitives (dark navy surfaces, purple gradient CTA, card/nav/table/status).

## Usage
Import the CSS once in each product frontend (e.g., in `src/index.css`).

```css
@import "../../../shared-ui/shared-ui.css";
```

Then use classes like `.ui-app`, `.ui-card`, `.ui-cta`, `.ui-table`, `.ui-status`.
