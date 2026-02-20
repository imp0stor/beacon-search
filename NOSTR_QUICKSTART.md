# Nostr Quick Start Guide

Get Beacon Search indexing Nostr content in 5 minutes!

## Prerequisites

- Node.js 18+
- PostgreSQL 16 with pgvector
- Docker (optional, recommended)

## Step 1: Install and Start

### Option A: Docker (Recommended)

```bash
cd ~/strangesignal/projects/beacon-search

# Start all services
docker-compose up --build

# Wait for services to start (~30 seconds)
```

### Option B: Local Development

```bash
# Terminal 1: Database
docker-compose up db

# Terminal 2: Backend
cd backend
npm install
npm run build
npm start

# Terminal 3: Frontend
cd frontend
npm install
npm start
```

## Step 2: Create Your First Nostr Connector

```bash
# Create a Q&A connector
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr Q&A",
    "description": "Index questions and answers from public relays",
    "config": {
      "type": "nostr",
      "relays": [
        "wss://relay.damus.io",
        "wss://nos.lol"
      ],
      "kinds": [30400, 6400],
      "limit": 100,
      "subscribeMode": false
    }
  }'
```

**Response:**
```json
{
  "id": "abc-123-...",
  "name": "Nostr Q&A",
  "connector_type": "nostr",
  ...
}
```

**Save the ID!** You'll need it to run the connector.

## Step 3: Run the Connector

```bash
# Replace <connector-id> with the ID from step 2
curl -X POST http://localhost:3001/api/connectors/<connector-id>/run

# Check status
curl http://localhost:3001/api/connectors/<connector-id>/status

# Watch the logs
curl http://localhost:3001/api/connectors/<connector-id>/status | jq '.log[-5:]'
```

**You should see:**
```json
{
  "status": "running",
  "processedItems": 45,
  "totalItems": 100,
  "progress": 45,
  "documentsAdded": 42,
  "log": [
    "[2026-02-13T...] Starting nostr connector: Nostr Q&A",
    "[2026-02-13T...] Connecting to 2 relay(s)",
    "[2026-02-13T...] Fetched 100 events",
    "[2026-02-13T...] Processed 100 events, indexed 87 documents",
    "[2026-02-13T...] Connector completed successfully"
  ]
}
```

## Step 4: Search Nostr Content

### Search All Content
```bash
curl "http://localhost:3001/api/nostr/search?q=bitcoin+lightning&limit=10" | jq '.'
```

### Filter by Event Kind
```bash
# Only questions
curl "http://localhost:3001/api/nostr/search?q=bitcoin&kinds=30400&limit=10"

# Only answers
curl "http://localhost:3001/api/nostr/search?q=bitcoin&kinds=6400&limit=10"
```

### Filter by Tags
```bash
curl "http://localhost:3001/api/nostr/search?q=&tags=bitcoin,lightning&limit=10"
```

### Get Event by ID
```bash
curl "http://localhost:3001/api/nostr/events/<event-id>"
```

## Step 5: View in Browser

Open http://localhost:3000

1. **Search bar** - Type your query (e.g., "bitcoin lightning")
2. **Nostr filters** - Enable Nostr facets in sidebar
3. **Results** - See beautifully rendered Nostr events!

## More Connector Examples

### Index Knowledge Base Articles
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr KB",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io"],
      "kinds": [30023],
      "limit": 50
    }
  }'
```

### Index Podcast Episodes
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr Podcasts",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io"],
      "kinds": [30383, 30384],
      "limit": 50
    }
  }'
```

### Live Subscription Mode
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Live Q&A",
    "description": "Real-time indexing",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io"],
      "kinds": [30400, 6400],
      "subscribeMode": true
    }
  }'
```

**Note:** Live mode keeps running until you stop it:
```bash
curl -X POST http://localhost:3001/api/connectors/<id>/stop
```

## Verify Everything Works

```bash
# 1. Check Nostr stats
curl http://localhost:3001/api/nostr/stats | jq '.'

# Should show:
{
  "total": 87,
  "byKind": [
    { "kind": 30400, "kind_name": "Question", "count": 45 },
    { "kind": 6400, "kind_name": "Answer", "count": 42 }
  ],
  "byCategory": [
    { "category": "qa", "count": 87 }
  ]
}

# 2. Check facets
curl http://localhost:3001/api/nostr/facets | jq '.kinds'

# 3. List indexed documents
curl http://localhost:3001/api/documents | jq '.[0:3]'

# 4. Search test
curl "http://localhost:3001/api/nostr/search?q=nostr&limit=5" | jq '.results[].title'
```

## Troubleshooting

### "No events found"

**Problem:** Connector runs but indexes 0 events.

**Solutions:**
1. Try different relays: `wss://relay.nostr.band`, `wss://nostr.wine`
2. Check if events exist on relay for those kinds
3. Increase `limit` to 500-1000
4. Remove `tags` filter if too restrictive

### "Connection timeout"

**Problem:** Relay connection fails.

**Solutions:**
1. Check internet connection
2. Try alternative relays
3. Reduce number of relays to 1-2
4. Check relay status: https://nostr.watch

### "Slow indexing"

**Problem:** Taking a long time to index.

**Solutions:**
1. Reduce `limit` to 100-200 for testing
2. Set `subscribeMode: false` for one-time sync
3. Use fewer event kinds
4. Check CPU usage (embedding generation is CPU-intensive)

### "TypeScript errors"

**Problem:** Build fails.

**Solutions:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Next Steps

### Add More Content
1. Create connectors for each event category (KB, Podcasts, Bounties, Studios)
2. Index from multiple specialized relays
3. Set up time-based indexing (only recent events)

### Customize Search
1. Enable WoT weighting (see NOSTR_INTEGRATION.md)
2. Adjust hybrid search weights
3. Create custom facets
4. Build saved searches

### Advanced Features
1. Set up cron jobs for periodic indexing
2. Monitor relay health
3. Build Nostr login (NIP-07)
4. Publish events from Beacon

## Resources

- **Full Documentation**: [NOSTR_INTEGRATION.md](./NOSTR_INTEGRATION.md)
- **Code Examples**: [NOSTR_EXAMPLES.md](./NOSTR_EXAMPLES.md)
- **Deployment Summary**: [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
- **Main README**: [README.md](./README.md)

## Quick Reference

### Event Kinds
| Kind | Name | Category |
|------|------|----------|
| 30400 | Question | qa |
| 6400 | Answer | qa |
| 30023 | KB Article | kb |
| 30383 | Show | podcast |
| 30384 | Episode | podcast |
| 31990 | Studio | studio |
| 37100 | Bounty | bounty |

### API Endpoints
- `POST /api/connectors` - Create connector
- `POST /api/connectors/:id/run` - Run connector
- `GET /api/nostr/search` - Search events
- `GET /api/nostr/facets` - Get facets
- `GET /api/nostr/stats` - Get stats
- `GET /api/nostr/authors/:pubkey/events` - Author's events
- `GET /api/nostr/tags/:tag/events` - Tag search

### Default Relays
```json
[
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
  "wss://relay.snort.social"
]
```

---

**Happy Nostr searching! 🚀⚡**
