#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:3001}

curl -s "$BASE_URL/api/frpei/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"nostr podcast","limit":3,"types":["podcast","web"],"explain":true}' \
  | head -c 800

echo ""

echo "FRPEI smoke test completed."
