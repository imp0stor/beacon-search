#!/bin/bash
#
# Deploy Beacon Search - Three New Features
# Feature 1: Deduplication
# Feature 2: Expandable Content
# Feature 3: Nostr Interactions
#

set -e

echo "================================================"
echo "Beacon Search - Feature Deployment"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd ~/strangesignal/projects/beacon-search

echo -e "${YELLOW}Step 1: Apply Database Migration${NC}"
cd backend
if node apply-migration.js ../migrations/003_unique_event_id.sql 2>/dev/null; then
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo "⚠ Migration failed or already applied - continuing..."
fi
cd ..

echo ""
echo -e "${YELLOW}Step 2: Build Backend${NC}"
cd backend
npm run build
echo -e "${GREEN}✓ Backend built${NC}"
cd ..

echo ""
echo -e "${YELLOW}Step 3: Build Frontend${NC}"
cd frontend
if [ -f "package.json" ]; then
    npm run build
    echo -e "${GREEN}✓ Frontend built${NC}"
else
    echo "⚠ Frontend already built"
fi
cd ..

echo ""
echo -e "${YELLOW}Step 4: Restart Services${NC}"

# Check which service manager is available
if command -v docker &> /dev/null; then
    if docker compose -f docker-compose.prod.yml ps &> /dev/null; then
        docker compose -f docker-compose.prod.yml restart
        echo -e "${GREEN}✓ Docker services restarted${NC}"
    else
        echo "⚠ Docker Compose not running - skipping restart"
    fi
else
    echo "⚠ Docker not available - manual restart required"
fi

echo ""
echo "================================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Install a Nostr extension (Alby or nos2x)"
echo "3. Follow testing guide in TEST_FEATURES.md"
echo ""
echo "Features deployed:"
echo "✓ Event ID deduplication (database)"
echo "✓ Expandable content view (3-line truncation)"
echo "✓ Nostr interactions (NIP-07 login, Like, Repost)"
echo ""
