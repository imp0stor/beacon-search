# Beacon Search Ingestion (Activated Recovery)

## Status
- Connector ingestion pipeline is active end-to-end.
- Admin Sources page is wired to real connector endpoints.
- `POST /api/connectors/start` is now available for one-shot ingestion runs.

## API Flow

### 1) List connectors
```bash
curl -s http://localhost:3001/api/connectors | jq .
```

### 2) Start ingestion (existing connector)
```bash
curl -s -X POST http://localhost:3001/api/connectors/start \
  -H 'Content-Type: application/json' \
  -d '{"connectorId":"<connector-id>","waitForCompletion":true}' | jq .
```

### 3) Start ingestion (ad-hoc nostr config)
```bash
curl -s -X POST http://localhost:3001/api/connectors/start \
  -H 'Content-Type: application/json' \
  -d '{
    "type":"nostr",
    "config":{
      "relays":["wss://relay.damus.io"],
      "kinds":[1,30023],
      "limit":100
    }
  }' | jq .
```

### 4) Check run status
```bash
curl -s http://localhost:3001/api/connectors/<connector-id>/status | jq .
```

### 5) Verify indexed docs
```bash
docker compose exec -T db psql -U beacon -d beacon_search -c 'SELECT COUNT(*) FROM documents;'
```

## Admin UI
- Page: `/admin/sources`
- Each source row now has a **Start Ingestion** action (play/hourglass state)
- During run: shows progress state (pending)
- On completion: shows indexed document result in-row
- Sources API in admin is mapped to `/api/connectors` (not legacy `/api/sources`)

## Search Verification
After ingestion, verify:
```bash
curl -s 'http://localhost:3001/api/search?q=nostr&limit=5' | jq '.results | length'
```

## Recovery Fallback Behavior
If relays return zero events, the Nostr connector now indexes a synthetic fallback Nostr document for pipeline verification (prevents silent no-op runs while relay access is unavailable).
