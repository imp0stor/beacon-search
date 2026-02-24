#!/bin/bash
# Capture responsive evidence for shared-ui implementation

set -e

EVIDENCE_DIR="/home/owner/.openclaw/workspace/ui-evidence/shared-ui-wave1"
mkdir -p "$EVIDENCE_DIR"

echo "📸 Capturing responsive evidence for shared-ui Wave 1..."

# Viewport sizes to test
VIEWPORTS=(
  "320x568:mobile-small"
  "375x667:mobile-standard"
  "768x1024:tablet"
  "1024x768:laptop"
  "1440x900:desktop"
)

# Products to capture
PRODUCTS=(
  "http://localhost:5173:nostrmaxi"
  "http://localhost:3001:beacon"
)

capture_viewport() {
  local url=$1
  local viewport=$2
  local name=$3
  local product=$4
  
  echo "  📱 $product @ $viewport ($name)"
  
  # Would use Playwright/Puppeteer in real implementation
  # For now, document the required captures
  cat >> "$EVIDENCE_DIR/capture-manifest.txt" <<EOF
Required capture: $product at $viewport ($name)
URL: $url
Viewport: $viewport
Output: ${EVIDENCE_DIR}/${product}-${name}.png
EOF
}

for product_url in "${PRODUCTS[@]}"; do
  IFS=':' read -r url product <<< "$product_url"
  echo "🎯 Product: $product"
  
  for viewport_spec in "${VIEWPORTS[@]}"; do
    IFS=':' read -r viewport name <<< "$viewport_spec"
    capture_viewport "$url" "$viewport" "$name" "$product"
  done
done

echo ""
echo "✅ Evidence manifest created: $EVIDENCE_DIR/capture-manifest.txt"
echo ""
echo "📋 Manual validation checklist:"
echo "  [ ] NostrMaxi: All status badges use unified vocabulary"
echo "  [ ] NostrMaxi: Payment modal uses Lightning extensions"
echo "  [ ] NostrMaxi: Mobile nav rail converts to bottom bar"
echo "  [ ] Beacon: Search highlights visible with 4.5:1 contrast"
echo "  [ ] Beacon: Facet panels responsive on mobile"
echo "  [ ] Beacon: Result cards readable at 320px width"
echo "  [ ] Both: No horizontal scroll at any viewport"
echo "  [ ] Both: Touch targets ≥44px on mobile"
echo "  [ ] Both: Focus indicators visible on tab navigation"
echo "  [ ] Both: Text readable with system font scaling"
echo ""
echo "Run Lighthouse audits:"
echo "  npm run lighthouse:nostrmaxi"
echo "  npm run lighthouse:beacon"
