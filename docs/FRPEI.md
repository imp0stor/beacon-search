# FRPEI (Federated Retrieval + Proprietary Enrichment Index)

FRPEI unifies federated retrieval across **SearXNG (open web)**, **Beacon Search (local KB)**, and **Media modules** (podcast/tv/movie). Results are normalized, canonicalized via the Beacon ontology, enriched with synonyms/relations/taxonomies, and ranked with explainability.

---

## Environment Variables

```bash
# SearXNG
SEARXNG_URL=http://10.1.10.143:8080
SEARXNG_TIMEOUT_MS=2500
SEARXNG_LANGUAGE=en
SEARXNG_CATEGORIES=general

# Provider timeouts
BEACON_TIMEOUT_MS=1800
MEDIA_TIMEOUT_MS=2000

# Caching + guardrails
FRPEI_CACHE_TTL_MS=300000
FRPEI_BREAKER_FAILURE_THRESHOLD=3
FRPEI_BREAKER_SUCCESS_THRESHOLD=2
FRPEI_BREAKER_RESET_MS=30000
```

---

## API Endpoints

### 1) Retrieve (Federated Search)
```http
POST /api/frpei/retrieve
POST /api/frpei/ingest   # alias
```

**Request**
```json
{
  "query": "matrix cast",
  "limit": 20,
  "providers": ["searxng", "beacon", "media"],
  "types": ["movie", "tv"],
  "mode": "hybrid",
  "expand": true,
  "explain": true,
  "enableCache": true,
  "dedupe": true,
  "timeoutMs": 2500
}
```

**Response**
```json
{
  "requestId": "req-123",
  "query": "matrix cast",
  "results": [
    {
      "candidateId": "uuid",
      "title": "The Matrix (1999)",
      "url": "https://www.imdb.com/title/tt0133093/",
      "normalizedUrl": "https://imdb.com/title/tt0133093",
      "snippet": "Cast and crew...",
      "contentType": "movie",
      "source": { "provider": "media", "trustTier": "medium" },
      "canonical": {
        "conceptId": "...",
        "preferredTerm": "The Matrix",
        "confidence": 0.9
      },
      "enrichment": {
        "synonyms": ["Matrix (1999)", "La Matrice"],
        "related": [{ "term": "Cyberpunk", "type": "related", "weight": 0.8 }]
      },
      "rank": 1,
      "rankScore": 0.92,
      "explanation": {
        "totalScore": 0.92,
        "breakdown": { "baseScore": 0.85, "providerWeight": 0.85, "canonicalBoost": 0.09 }
      }
    }
  ],
  "providers": [
    { "provider": "searxng", "elapsedMs": 520, "items": [] },
    { "provider": "beacon", "elapsedMs": 120, "items": [] },
    { "provider": "media", "elapsedMs": 90, "items": [] }
  ],
  "metrics": { "requests": 1, "cacheHits": 0 }
}
```

---

### 2) Enrich
```http
POST /api/frpei/enrich
```

**Request**
```json
{ "candidates": [ { "candidateId": "uuid", "title": "The Matrix" } ] }
```

**Response**
```json
{ "enriched": [ { "candidateId": "uuid", "enrichment": { "synonyms": ["Matrix"], "confidence": { "overall": 0.8 } } } ] }
```

---

### 3) Rank
```http
POST /api/frpei/rank
```

**Request**
```json
{ "candidates": [ { "candidateId": "uuid", "title": "The Matrix" } ] }
```

**Response**
```json
{ "ranked": [ { "candidateId": "uuid", "rank": 1, "rankScore": 0.91 } ] }
```

---

### 4) Explain
```http
POST /api/frpei/explain
```

**Request**
```json
{ "candidate": { "candidateId": "uuid", "title": "The Matrix" } }
```

**Response**
```json
{ "candidateId": "uuid", "explanation": { "totalScore": 0.91, "breakdown": { "baseScore": 0.8 } } }
```

---

### 5) Feedback
```http
POST /api/frpei/feedback
```

**Request**
```json
{
  "requestId": "req-123",
  "candidateId": "uuid",
  "provider": "searxng",
  "feedback": "positive",
  "rating": 5,
  "notes": "Great result",
  "metadata": { "query": "matrix cast" }
}
```

**Action alias (optional)**
```json
{ "candidateId": "uuid", "action": "click" }
```

**Response**
```json
{ "id": "feedback-uuid", "createdAt": "2026-02-16T22:10:00Z" }
```

---

### Metrics + Status
```http
GET /api/frpei/metrics
GET /api/frpei/status
```

---

## Notes
- **Deduping** happens by normalized URL or title.
- **Canonicalization** uses ontology terms/aliases/synonyms.
- **Enrichment** layers in ontology relations + dictionary synonyms.
- **Media provider** ties into podcast/tv/movie ingestion for domain-aware results.
