# Beacon Data Restore & Re-Ingest Runbook

## Scope
Recover Beacon spidered corpus (Nostr + other connectors) on Operator deployment and prevent accidental data loss during stack churn.

## 1) Forensics Summary (2026-02-24)

### Observed state
- Active DB metrics:
  - `documents=5`
  - `connectors=0` (before restoration steps)
  - `connector_runs=0`
  - `sync_history=0`
- All beacon pgdata volumes inspected (`beacon-search_pgdata`, `beacon_pgdata`, `beaconwave2_pgdata`, `beaconwave4..7_pgdata`) showed same minimal state (`documents=5`, connector tables empty).
- `beaconwave3_pgdata` is not a valid PG cluster.

### Backup/artifact scan
- Operator (`/home/neo`) and owner host (`/home/owner`) scan found **no Beacon DB dump/backup artifacts** (`*.sql`, `*.dump`, `*.backup`, `*beacon*dump*`).
- Conclusion: no recoverable database backup artifact was found.

### Forensic conclusion
Most likely not recoverable from backup. Existing beacon-related volumes appear to have been reinitialized/overwritten into the same minimal seed state at some point (volume churn / rebootstrap), not a single surviving historical corpus volume.

---

## 2) Safety Before Any Restore/Re-Ingest

1. Stop write traffic to Beacon backend.
2. Snapshot active volume before changes:

```bash
# on operator
VOL=beacon-search_pgdata
STAMP=$(date +%Y%m%d-%H%M%S)
docker run --rm -v ${VOL}:/from -v /home/neo:/to alpine \
  sh -lc "cd /from && tar -czf /to/${VOL}-${STAMP}.tgz ."
```

3. Ensure port collisions are avoided (Operator has multiple Postgres services):

```bash
# run Beacon with non-conflicting host ports
DB_PORT=55432 FRONTEND_PORT=3002 docker compose up -d db backend frontend
```

---

## 3) Restore Path Decision Tree

### A) If dump exists (preferred)

```bash
# restore example
cat beacon_backup.sql | docker exec -i beacon-search-db-1 psql -U beacon -d beacon_search
```

Validate:

```bash
docker exec beacon-search-db-1 psql -U beacon -d beacon_search -Atqc \
"select 'documents='||count(*) from documents;
 select 'connectors='||count(*) from connectors;
 select 'connector_runs='||count(*) from connector_runs;
 select 'sync_history='||count(*) from sync_history;"
```

### B) If no dump exists (current case)
Recreate connectors and re-ingest from sources.

---

## 4) Re-Ingest (Current code reality)

### 4.1 Connector API
- Web/folder/sql connector creation works.
- Nostr connector runtime exists, but behavior currently fails to repopulate corpus (0 fetched in observed run).
- Folder connector can crash backend if path does not exist (must validate path first).

### 4.2 Nostr connector validation fix applied
File updated:
- `backend/src/connectors/routes.ts`

Change:
- Added `nostr` in `validateConfig()` switch.
- Added `validateNostrConfig()` (relays, kinds, limit validation).

### 4.3 Rebuild backend after code change

```bash
cd /home/neo/beacon-search
DB_PORT=55432 FRONTEND_PORT=3002 docker compose up -d --build backend
```

### 4.4 Create connectors

```bash
API=http://localhost:3001

# Nostr connector
curl -X POST $API/api/connectors -H 'Content-Type: application/json' -d '{
  "name":"Nostr Recovery Sync",
  "config":{
    "type":"nostr",
    "relays":["wss://relay.damus.io","wss://nos.lol"],
    "kinds":[1,30023],
    "limit":200
  }
}'

# Web connector example
curl -X POST $API/api/connectors -H 'Content-Type: application/json' -d '{
  "name":"Nostr Docs Crawl",
  "config":{
    "type":"web",
    "seedUrl":"https://nostr.com",
    "maxDepth":1,
    "maxPages":20,
    "sameDomainOnly":true,
    "respectRobotsTxt":true,
    "rateLimit":1000
  }
}'
```

### 4.5 Run connector

```bash
curl -X POST $API/api/connectors/<CONNECTOR_ID>/run
curl $API/api/connectors/<CONNECTOR_ID>/status
curl $API/api/connectors/<CONNECTOR_ID>/history
```

---

## 5) Verification Checklist

```bash
# database counts
docker exec beacon-search-db-1 psql -U beacon -d beacon_search -Atqc \
"select 'documents='||count(*) from documents;
 select 'nostr_documents='||count(*) from documents where attributes->>'nostr'='true';
 select 'connectors='||count(*) from connectors;
 select 'connector_runs='||count(*) from connector_runs;
 select 'sync_history='||count(*) from sync_history;"

# API checks
curl -s http://localhost:3001/api/connectors | jq .
curl -s "http://localhost:3001/api/search?q=nostr&limit=5" | jq .
```

Success criteria:
- Document count increases significantly above baseline.
- At least one Nostr run recorded and non-zero Nostr documents.
- Search returns restored spidered corpus entries.

---

## 6) Rollback / Recovery

If ingestion or migration destabilizes service:

1. Stop services:
```bash
docker compose down
```
2. Restore pre-change volume snapshot (`*.tgz`) to pgdata volume.
3. Restart with safe ports:
```bash
DB_PORT=55432 FRONTEND_PORT=3002 docker compose up -d db backend frontend
```

---

## 7) Known Blockers Requiring Human Input

1. No historical DB backup artifact was found; hard restore from previous corpus is blocked.
2. Nostr ingestion path currently does not repopulate expected corpus in this deployment (observed run fetched 0 events).
3. `npm run spider:small` currently fails in container (`websocket-polyfill` runtime error), blocking script-based fallback ingestion.
4. Folder connector must point to an existing in-container path or backend can crash due unhandled throw.

---

## 8) Immediate Hardening Recommendations

- Add nightly `pg_dump` backup rotation for `beacon_search`.
- Add startup guard to refuse `DB_PORT=5432` on Operator if already occupied.
- Add connector run isolation/error boundary so one bad connector cannot crash backend.
- Add ingest smoke test in CI/CD:
  - create nostr connector
  - run connector
  - assert `documents` increment.
