# Beacon Data Restore & Re-Ingest (Operator)

See canonical runbook in `/home/owner/strangesignal/projects/beacon-search/docs/DATA-RESTORE-AND-INGEST.md`.

## Snapshot + safe ports
```bash
cd /home/neo/beacon-search
DB_PORT=55432 FRONTEND_PORT=3002 docker compose up -d db backend frontend
```

## Current forensic result
- No recoverable Beacon DB dump found on operator or owner host.
- All beacon pgdata volumes show same minimal state (`documents=5`, connector tables empty).

## Current blockers
- Nostr connector validation was patched, but run fetched `0` events in this deployment.
- `npm run spider:small` fails with websocket-polyfill runtime error in container.
- Folder connector on nonexistent path crashes backend.

## Verification command
```bash
docker exec beacon-search-db-1 psql -U beacon -d beacon_search -Atqc \
"select 'documents='||count(*) from documents;
 select 'nostr_documents='||count(*) from documents where attributes->>'nostr'='true';
 select 'connectors='||count(*) from connectors;
 select 'connector_runs='||count(*) from connector_runs;
 select 'sync_history='||count(*) from sync_history;"
```
