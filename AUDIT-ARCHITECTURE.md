# Beacon Search Architecture Audit (Phase 1A)

Date: 2026-02-24  
Scope: `/home/owner/strangesignal/projects/beacon-search`

---

## Executive Summary

The codebase currently contains **two parallel ingestion systems**:

1. **Real connector pipeline** (`connectors` + `documents.source_id`) that is mostly valid and wired.
2. **New admin “sources/spider” pipeline** (`admin/spider-service` + `sources` table) that is wired to UI but currently a **stub heartbeat flow**, not real crawling/connector execution.

This creates the core mismatch:
- **User search UI (`/search`) calls real search APIs**.
- **Admin UI (`/admin/sources`) calls admin/sources APIs** that do not create/run real connectors.

So admin actions can look successful while not feeding the real connector ingestion path.

---

## 1) Real Working Code (existing architecture)

## 1.1 `backend/src/connectors/nostr.ts`

### What works
- Implements Nostr connector class (`NostrConnector`) extending `BaseConnector`.
- Uses `SimplePool` from `nostr-tools`.
- Supports one-shot sync and subscribe mode.
- Parses and normalizes Nostr events, emits documents for indexing.

### Critical finding (broken in current implementation)
- In `sync()` it calls:
  - `this.pool.querySync(relays, [filter] as any)`
- In this repo’s `nostr-tools` behavior, this is wrong for relay protocol compatibility in practice; relay expects filter object(s), and this form resulted in relay error.

### Runtime test performed
Executed directly with installed `nostr-tools`:
- `querySync(relays, [filter])` ⇒ relay responded: **"bad req: provided filter is not an object"**, returned 0 events.
- `querySync(relays, filter)` ⇒ returned events successfully (3 events from `wss://relay.damus.io`).

### Conclusion
- Nostr connector is architecturally real, but **current querySync call signature likely prevents real ingestion** in sync path.

---

## 1.2 `backend/src/connectors/web-spider.ts`

### What works
- Real crawler implementation with:
  - queue + visited set
  - depth/page limits
  - same-domain filtering
  - robots.txt handling
  - rate limiting
  - HTML extraction via cheerio
  - link extraction and URL normalization
  - emits extracted docs to connector manager

### Conclusion
- This is real crawling logic and appears functional from code path.

---

## 1.3 `backend/src/ingestion/pipeline.ts`

### What works
- Contains real ingestion strategy framework:
  - `STRATEGIES` (RECENT_QUALITY, POPULAR_CONTENT, COMPREHENSIVE_CRAWL)
  - relay selection/rate limiting integration
  - classification + content extraction + anti-spam
  - indexing into `documents` and `nostr_events`

### Caveat
- This pipeline is not the same as connector manager flow; it is a separate ingestion system and not the primary UI-triggered path.

---

## 1.4 `backend/src/connectors/manager.ts`

### What works
- This is the real connector orchestrator.
- `runConnector(id)` instantiates connector by type (`web`, `folder`, `nostr`), listens for emitted documents, and indexes into `documents` table.
- Handles lifecycle + run history (`connector_runs`).

### Who calls connector execution?
- There is no method named `executeConnector()`.
- Real trigger path:
  - `POST /api/connectors/:id/run` (in `connectors/routes.ts`)
  - calls `manager.runConnector(id)`
  - which internally calls `BaseConnector.run()` -> protected connector `execute()`.

---

## 1.5 `backend/src/connectors/routes.ts`

### Endpoints (real connector API)
- `GET /api/connectors`
- `GET /api/connectors/:id`
- `POST /api/connectors`
- `PUT /api/connectors/:id`
- `DELETE /api/connectors/:id`
- `POST /api/connectors/:id/run`
- `POST /api/connectors/:id/stop`
- `GET /api/connectors/:id/status`
- `GET /api/connectors/:id/history`
- `PUT /api/connectors/:id/templates`

### Wiring status
- Mounted in `backend/src/index.ts` via:
  - `app.use('/api/connectors', createConnectorRoutes(...))`
- So these endpoints are live in backend routing.

---

## 1.6 Database tables: `connectors`, `documents`

### Schema usage in code
- `connectors`: actively used by `ConnectorManager` CRUD and run orchestration.
- `documents`: actively used by search APIs + connector indexing + admin stub sync inserts.

### Live data state (requested SELECTs)
Attempted direct DB queries, but local Postgres auth failed for configured credentials (`beacon/beacon_secret`) and backend service wasn’t running to query through API.

So **exact live row counts could not be confirmed from this host session**.

What can be confirmed from repository SQL:
- `init.sql` seeds demo rows into `documents` (manual examples).
- No equivalent seeded operational `connectors` rows in `init.sql`.

---

## 2) Orphaned/New Code (refactor path)

## 2.1 `frontend/src/user/UserApp.js`

- Calls real endpoints:
  - `GET /api/search?...`
  - fallback `GET /api/documents?limit=20`
- This is a real path to backend search/docs APIs.

✅ Uses real API, not fake.

---

## 2.2 `frontend/src/admin/pages/SourcesManagement.js`

- Uses API helpers from `frontend/src/admin/utils/api.js`.
- Those helpers call:
  - `/api/admin/sources`
  - `/api/admin/sources/:id`
  - `/api/admin/sources/:id/sync`
  - `/api/admin/logs`
- It does **not** call `/api/connectors`.

❌ Admin Sources UI is wired to admin/sources system, not real connectors API.

---

## 2.3 `backend/src/admin/` (`spider-service.ts`, `routes.ts`)

### Is it wired?
Yes.
- Mounted in `index.ts`: `app.use('/api/admin', createAdminRoutes(pool, spiderService))`

### Is it real ingestion?
Mostly no (currently stub behavior):
- `triggerSync()` does not execute connector manager or web-spider connector.
- It inserts a synthetic “sync snapshot” document as heartbeat:
  - title: `"<source name> sync snapshot"`
  - content: timestamp message
  - attributes include `source_key`.

So admin sync can mark source healthy and add a heartbeat doc without real crawling/indexing.

---

## 2.4 Does Admin UI trigger real ingestion?

**No, not currently.**
- Admin UI -> `/api/admin/sources/:id/sync`
- backend admin service -> inserts heartbeat doc only
- does not create/run `connectors` records
- does not call `ConnectorManager.runConnector()`

---

## 3) Database State Analysis (connectors vs sources vs documents)

Because DB auth was unavailable from this session, exact `SELECT *` outputs are not included.

Still, code-level truth is clear:

- `connectors` table = real connector system backing `/api/connectors` and `documents.source_id` link.
- `sources` table = admin spider-discovery catalog backing `/api/admin/sources`.
- `documents` table = shared sink for search.

### Data model confusion
- Two source models coexist:
  1) `connectors` (actionable real ingestion)
  2) `sources` (integration catalog + scheduling + status)
- Current admin sync writes into `documents` using `attributes.source_key`, not `source_id` connector linkage.
- This fragments provenance and operational control.

---

## 4) Endpoints Analysis

## 4.1 Major `/api` endpoint groups currently mounted
From `backend/src/index.ts`:
- Core: `/api/search`, `/api/ask`, `/api/documents`, `/api/stats`, `/api/generate-embeddings`
- Connectors: `/api/connectors/*`
- Admin spider/sources: `/api/admin/*`
- Config/Webhooks/Process/Wizard
- Media domains: `/api/podcasts`, `/api/tv`, `/api/movies`, `/api/media`, `/api/frpei`
- UX bundle under `/api` (`/tags`, `/search/advanced`, `/search/facets`, etc.)
- `/api/nostr/*`

## 4.2 Which call real connector logic?
- ✅ `/api/connectors/:id/run` -> real connector execution (`ConnectorManager`).
- ✅ `/api/connectors/*` CRUD/history/status -> real connector domain.

## 4.3 Which are stubs or non-real ingestion?
- ⚠️ `/api/admin/sources/:id/sync` -> heartbeat insert, not real crawl/connector run.
- ⚠️ Admin utility functions `createSource`/`deleteSource` intentionally reject (not implemented in spider mode).

## 4.4 Which endpoints frontend actually calls
- User `/search` UI (`UserApp`) -> `/api/search`, `/api/documents` (real).
- Admin new UI (`SourcesManagement`) -> `/api/admin/sources*` (stub-ish ingestion).
- Legacy/other UI pieces still call `/api/connectors` (e.g., `frontend/src/Connectors.js`).

## 4.5 What’s missing
- Missing bridge: `/api/admin/sources` actions should create/manage/run real connectors or map 1:1 to connectors.
- Missing unified source model (single truth for source metadata, scheduling, and run execution).

---

## Real Working Code Path (end-to-end)

Current real ingest path:
1. Frontend/Client calls `POST /api/connectors` to create connector.
2. Client calls `POST /api/connectors/:id/run`.
3. `ConnectorManager.runConnector()` creates concrete connector (`web`/`folder`/`nostr`).
4. Connector emits documents.
5. Manager `indexDocument()` writes to `documents` with `source_id = connector.id`.
6. User search (`GET /api/search`) reads from `documents`.

This path is coherent except for the Nostr sync filter call bug.

---

## Orphaned/Broken Code Paths

1. **Admin Sources flow (`/api/admin/sources`)**
   - wired and visible, but does not invoke real connector ingestion.
2. **Nostr connector sync call signature**
   - `querySync(relays, [filter])` appears broken against relay behavior tested.
3. **Dual frontend paradigms**
   - new admin uses `/api/admin/sources`; legacy connector UI uses `/api/connectors`.
   - operationally split and confusing.

---

## What Needs Connecting (UI -> Real API)

1. `SourcesManagement` actions should ultimately drive `/api/connectors` lifecycle:
   - create/update/delete connector
   - run/stop connector
   - poll `/status` + `/history`
2. Keep `sources` only as optional catalog metadata OR remove it.
3. Ensure sync from admin triggers actual connector run, not heartbeat insert.

---

## Recommended Fix Order (high-impact first)

1. **Fix Nostr connector sync call** (`querySync` signature) so Nostr ingestion actually returns events.
2. **Replace admin sync stub behavior**:
   - `/api/admin/sources/:id/sync` should call connector manager run path.
3. **Unify data model**:
   - choose `connectors` as source-of-truth; deprecate or map `sources` cleanly.
4. **Unify admin UI to real connector endpoints**:
   - either rewire `SourcesManagement` to `/api/connectors` or add backend adapter that translates sources->connectors.
5. **Backfill provenance consistency**:
   - prefer `documents.source_id` linkage over only `attributes.source_key`.
6. **Clean dead/legacy UI paths** once unified (either keep legacy Connectors UI or migrate fully).

---

## Notes / Verification Limits

- Direct DB `SELECT * FROM connectors/documents/sources` could not be executed due local DB auth mismatch in this session.
- Backend process was not running locally at audit time, so endpoint runtime checks were static code-level except for direct Nostr `querySync` behavior test via node.
