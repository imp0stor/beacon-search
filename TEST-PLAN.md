# Beacon Search - Nostr E2E Test Plan

**Version:** 1.0  
**Date:** 2026-02-13  
**Status:** Ready for Execution

---

## Objectives

1. ✅ Verify Nostr connector can index events from multiple relays
2. ✅ Verify search functionality (hybrid, vector, text modes)
3. ✅ Verify multi-relay indexing works correctly
4. ✅ Test WoT integration (optional, if enabled)
5. ✅ Validate end-to-end flow: Relay → Index → Search → Results

---

## Test Environment

### Prerequisites

```bash
# 1. Backend running
cd ~/strangesignal/projects/beacon-search/backend
npm install
npm run dev  # Port 3001

# 2. Database running
docker-compose up -d postgres redis

# 3. (Optional) NostrMaxi running for WoT tests
# Port 3000
```

### Test Data

**Relays:**
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.nostr.band`

**Event Kinds:**
- `0` - User metadata
- `1` - Short text notes
- `30023` - Long-form articles

**Test Queries:**
- "bitcoin" (common term)
- "nostr" (platform-specific)
- "decentralized social media" (semantic)

---

## Test Cases

### TC1: Backend Health Check

**Objective:** Verify backend is reachable

```bash
curl http://localhost:3001/health
```

**Expected:** `200 OK` with JSON response

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC2: Create Nostr Connector

**Objective:** Create connector via API

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-nostr",
    "type": "nostr",
    "enabled": true,
    "config": {
      "relays": ["wss://relay.damus.io", "wss://nos.lol"],
      "kinds": [0, 1, 30023],
      "limit": 50
    }
  }'
```

**Expected:** 
- Status: `201 Created`
- Response contains `id` field
- Connector appears in database

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC3: Run Connector (Index Events)

**Objective:** Execute connector and index Nostr events

```bash
curl -X POST http://localhost:3001/api/connectors/{id}/run
```

**Expected:**
- Status: `200 OK`
- Connector status: `running` → `completed`
- Documents indexed: >0
- No errors in logs

**Validation:**
```sql
SELECT COUNT(*) FROM documents WHERE source = 'nostr';
```

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC4: Multi-Relay Indexing

**Objective:** Verify events are fetched from all configured relays

**Method:**
1. Create connector with 3 relays
2. Run connector
3. Check if events have relay metadata

**Expected:**
- Events from all 3 relays present
- No relay timeout errors
- Relay health tracked

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC5: Hybrid Search

**Objective:** Test hybrid (vector + full-text) search

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "bitcoin",
    "mode": "hybrid",
    "limit": 10
  }'
```

**Expected:**
- Results returned (count > 0)
- Results ranked by relevance
- Both vector and text matches present

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC6: Vector-Only Search

**Objective:** Test semantic search

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "decentralized social media",
    "mode": "vector",
    "limit": 10
  }'
```

**Expected:**
- Semantically related results (may not contain exact keywords)
- Nostr-related content ranked high

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC7: Text-Only Search

**Objective:** Test full-text search

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "nostr",
    "mode": "text",
    "limit": 10
  }'
```

**Expected:**
- Exact keyword matches
- Fast response time (<100ms)

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC8: Faceted Search (Filter by Source)

**Objective:** Filter results by source

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "bitcoin",
    "mode": "hybrid",
    "filters": {
      "source": "nostr"
    },
    "limit": 10
  }'
```

**Expected:**
- All results have `source: "nostr"`
- Result count matches filter

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC9: WoT-Aware Search (Optional)

**Objective:** Test WoT ranking boost

**Prerequisites:**
- WoT plugin enabled
- NostrMaxi running (or local provider)

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "bitcoin",
    "mode": "hybrid",
    "user_pubkey": "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
    "limit": 10
  }'
```

**Expected:**
- Results from trusted users ranked higher
- WoT scores visible in response (if returned)
- No errors if WoT service unavailable

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC10: Connector Status Tracking

**Objective:** Verify connector status is tracked correctly

```bash
curl http://localhost:3001/api/connectors/{id}/status
```

**Expected:**
- Status: `idle` | `running` | `completed` | `error`
- Progress tracking: `documents_indexed`, `last_run`
- Error messages (if failed)

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC11: Relay Health Monitoring

**Objective:** Track relay connectivity and errors

**Method:**
1. Configure connector with 1 invalid relay
2. Run connector
3. Check logs for relay errors

**Expected:**
- Valid relays: data indexed
- Invalid relays: logged as errors
- Connector doesn't fail completely

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

### TC12: Incremental Indexing

**Objective:** Verify incremental updates (subscribeMode)

```bash
# Create connector with subscribeMode: true
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-nostr-live",
    "type": "nostr",
    "config": {
      "relays": ["wss://relay.damus.io"],
      "kinds": [1],
      "subscribeMode": true
    }
  }'
```

**Expected:**
- Connector stays running (live subscription)
- New events indexed as they arrive
- Can be stopped gracefully

**Status:** ⬜ Not Run | ✅ Pass | ❌ Fail

---

## Automated Test Execution

### Run All Tests

```bash
chmod +x test-nostr-e2e.sh
./test-nostr-e2e.sh
```

### Expected Output

```
🧪 Beacon Search - Nostr E2E Test
==================================

1️⃣  Health Check
   ✅ Backend is running

2️⃣  Creating Nostr Connector
   ✅ Connector created (ID: xyz)

3️⃣  Running Nostr Connector
   ✅ Indexing complete (42 documents)

4️⃣  Testing Search
   ✅ Found 12 results
   ✅ Found 8 Nostr results
   ✅ Found 10 semantic results

5️⃣  Testing WoT Integration
   ✅ WoT-aware search returned 7 results

6️⃣  Database Verification
   ℹ️  Use: SELECT COUNT(*) FROM documents WHERE source = 'nostr';

7️⃣  Multi-Relay Test
   ✅ Connector accepts multiple relays

8️⃣  Cleanup
   ✅ Test connector deleted

==================================
✅ END-TO-END TEST COMPLETE
```

---

## Performance Benchmarks

| Operation | Target | Measured | Status |
|-----------|--------|----------|--------|
| Index 50 events | <10s | — | ⬜ |
| Hybrid search | <200ms | — | ⬜ |
| Vector search | <300ms | — | ⬜ |
| Text search | <100ms | — | ⬜ |
| WoT lookup (cached) | <50ms | — | ⬜ |
| WoT lookup (API) | <200ms | — | ⬜ |

---

## Troubleshooting

### Issue: Connector fails to start

**Symptoms:** `POST /api/connectors/{id}/run` returns error

**Checks:**
1. Relays reachable: `wscat -c wss://relay.damus.io`
2. Database connection: Check logs
3. Permissions: Connector enabled?

**Fix:** Check connector logs, verify relay URLs

---

### Issue: No search results

**Symptoms:** Search returns `results: []`

**Checks:**
1. Documents indexed: `SELECT COUNT(*) FROM documents;`
2. Embeddings generated: Check `embedding` column not NULL
3. Search query syntax correct

**Fix:** Re-run connector, check indexing logs

---

### Issue: WoT scores not applied

**Symptoms:** All results have same score

**Checks:**
1. WoT plugin enabled: Check config
2. NostrMaxi reachable: `curl http://localhost:3000/health`
3. `user_pubkey` provided in search request

**Fix:** Enable WoT plugin, start NostrMaxi, or use local provider

---

## Success Criteria

✅ All test cases pass  
✅ Performance benchmarks met  
✅ No errors in logs  
✅ Multi-relay indexing works  
✅ Search returns relevant results  
✅ WoT integration functional (if enabled)

---

## Next Steps After Passing

1. Deploy to production VPS
2. Configure production relays (add more for coverage)
3. Setup continuous indexing (cron job or subscribeMode)
4. Enable WoT with NostrMaxi in production
5. Add monitoring/alerting
6. Load testing (1000+ concurrent searches)

---

## Test Log Template

```
Test Run: YYYY-MM-DD HH:MM
Backend: http://localhost:3001
Database: PostgreSQL (Docker)
WoT: Enabled/Disabled

TC1 (Health Check): ✅ Pass
TC2 (Create Connector): ✅ Pass
TC3 (Run Connector): ✅ Pass (42 docs indexed)
TC4 (Multi-Relay): ✅ Pass
TC5 (Hybrid Search): ✅ Pass (12 results)
TC6 (Vector Search): ✅ Pass (10 results)
TC7 (Text Search): ✅ Pass (15 results)
TC8 (Faceted Search): ✅ Pass (8 results)
TC9 (WoT Search): ⚠️  Skip (WoT disabled)
TC10 (Connector Status): ✅ Pass
TC11 (Relay Health): ✅ Pass
TC12 (Incremental): ⚠️  Skip (manual test)

Overall: ✅ PASS
```
