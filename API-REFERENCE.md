# Beacon Search - Complete API Reference

**Version:** 1.0  
**Base URL:** `http://localhost:3001` (development) | `https://search.yourdomain.com` (production)  
**Date:** 2026-02-13

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Search Endpoints](#search-endpoints)
4. [FRPEI Federated Retrieval](#frpei-federated-retrieval)
5. [RAG (AI-Powered Answers)](#rag-ai-powered-answers)
6. [Processing Endpoints](#processing-endpoints)
7. [Health & Status](#health--status)
8. [Integration Examples](#integration-examples)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)
11. [Best Practices](#best-practices)

---

## Overview

Beacon Search is an **API-first search backend** designed for integration into other applications. It provides:

- **Hybrid Search** - Combines vector (semantic) and full-text (keyword) search
- **RAG (Retrieval-Augmented Generation)** - LLM-powered answers using search results as context
- **Multi-Source Indexing** - Unified search across web pages, documents, databases, Nostr events
- **NLP Processing** - Auto-tagging, entity extraction, sentiment analysis
- **Advanced Processing** - OCR, translation, AI descriptions

**Use Cases:**
- Add search to NostrCast (podcast search)
- Add search to NostrMaxi (identity/WoT search)
- Add search to Fragstr (game/content search)
- Unified search across all Strange Signal products

---

## Authentication

**Current Version:** No authentication required (v1.0)

**Future:** API key authentication planned for production deployments.

```bash
# All requests currently work without auth
curl "http://localhost:3001/api/search?q=test"
```

**Headers:**
- `Content-Type: application/json` (for POST requests)

---

## Search Endpoints

### GET /api/search

**Primary search endpoint** - Hybrid semantic + keyword search.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | ✅ Yes | - | Search query text |
| `limit` | number | No | 10 | Max results to return (1-100) |
| `mode` | string | No | `hybrid` | Search mode: `hybrid`, `vector`, `text` |
| `user_pubkey` | string | No | - | Nostr pubkey for WoT ranking (future) |

#### Modes

- **`hybrid`** (default) - Combines vector similarity + keyword matching (best results)
- **`vector`** - Semantic similarity only (finds conceptually related content)
- **`text`** - Full-text keyword search only (exact matches)

#### Request

```bash
GET /api/search?q=machine+learning&limit=5&mode=hybrid
```

#### Response

```json
{
  "query": "machine learning",
  "mode": "hybrid",
  "count": 5,
  "results": [
    {
      "id": "64b6c998-348f-4e99-9181-2daf1a40afb7",
      "title": "Machine Learning Basics",
      "content": "Machine learning is a subset of artificial intelligence...",
      "url": "https://example.com/ml-basics",
      "source_id": null,
      "document_type": "manual",
      "score": 0.92,
      "metadata": {
        "author": "John Doe",
        "published": "2024-01-15"
      }
    },
    {
      "id": "60963ffb-4662-49d1-96e4-b0252e818d82",
      "title": "Natural Language Processing",
      "content": "NLP is a field of AI focused on enabling computers...",
      "url": "https://example.com/nlp",
      "source_id": null,
      "document_type": "manual",
      "score": 0.87
    }
    // ... more results
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Original search query |
| `mode` | string | Search mode used |
| `count` | number | Number of results returned |
| `results` | array | Array of document objects |
| `results[].id` | string | Unique document ID |
| `results[].title` | string | Document title |
| `results[].content` | string | Document content (full or snippet) |
| `results[].url` | string | Source URL (if available) |
| `results[].score` | number | Relevance score (0.0-1.0) |
| `results[].metadata` | object | Additional metadata (tags, author, date, etc.) |

#### Examples

**Semantic Search (Vector Mode):**
```bash
curl "http://localhost:3001/api/search?q=how+to+learn+programming&mode=vector&limit=10"
```

**Keyword Search (Text Mode):**
```bash
curl "http://localhost:3001/api/search?q=bitcoin&mode=text&limit=5"
```

**Best Results (Hybrid Mode):**
```bash
curl "http://localhost:3001/api/search?q=nostr+relay+setup&mode=hybrid&limit=10"
```

---

## FRPEI Federated Retrieval

FRPEI (Federated Retrieval + Proprietary Enrichment Index) delivers **parallel fan-out retrieval**, **ontology-backed canonicalization**, **enrichment**, **ranking**, and **explainability** in one API-first pipeline.

### POST /api/frpei/retrieve
Run the full FRPEI pipeline (retrieve → canonicalize → enrich → rank).
`POST /api/frpei/ingest` is an alias.

**Request Body**
| Field | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | ✅ Yes | Search query |
| `limit` | number | No | Max results (default 10) |
| `providers` | string[] | No | Force providers (e.g., `"beacon"`, `"searxng"`, `"media"`) |
| `types` | string[] | No | Content types (`podcast`, `tv`, `movie`, `web`, `doc`) |
| `mode` | string | No | `hybrid`, `vector`, `text` |
| `expand` | boolean | No | Enable ontology expansion (default true) |
| `explain` | boolean | No | Include ranking explanations |
| `enableCache` | boolean | No | Use result cache (default true) |
| `dedupe` | boolean | No | Deduplicate results (default true) |
| `timeoutMs` | number | No | Global timeout budget (ms) |

**Example**
```bash
curl -X POST "http://localhost:3001/api/frpei/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"nostr podcast analytics","limit":8,"types":["podcast","web"],"explain":true}'
```

### POST /api/frpei/enrich
Enrich pre-fetched candidates with ontology + metadata.

### POST /api/frpei/rank
Rank candidates using FRPEI scoring signals.

### POST /api/frpei/explain
Return a rank explanation for a candidate.

### POST /api/frpei/feedback
Capture feedback signals for training and tuning.

### GET /api/frpei/metrics
Return FRPEI observability metrics (cache hits, provider latency, errors).

### GET /api/frpei/status
Return provider circuit-breaker status.

---

## RAG (AI-Powered Answers)

### POST /api/ask

**Get AI-powered answers** using search results as context (Retrieval-Augmented Generation).

#### Request

```bash
POST /api/ask
Content-Type: application/json

{
  "question": "What is machine learning?",
  "limit": 5
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | ✅ Yes | User's question |
| `limit` | number | No | Max search results to use as context (default: 5) |

#### Response

```json
{
  "question": "What is machine learning?",
  "answer": "Machine learning is a subset of artificial intelligence that enables systems to learn from data without being explicitly programmed. It involves training algorithms on datasets to identify patterns and make predictions. Common applications include image recognition, natural language processing, and predictive analytics. Neural networks, particularly deep learning techniques, have revolutionized the field in recent years.",
  "sources": [
    {
      "id": "64b6c998-348f-4e99-9181-2daf1a40afb7",
      "title": "Machine Learning Basics",
      "url": "https://example.com/ml-basics",
      "relevance": 0.92
    },
    {
      "id": "60963ffb-4662-49d1-96e4-b0252e818d82",
      "title": "Natural Language Processing",
      "url": "https://example.com/nlp",
      "relevance": 0.87
    }
  ],
  "model": "gpt-4o-mini"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `question` | string | Original question |
| `answer` | string | AI-generated answer based on search results |
| `sources` | array | Documents used as context |
| `model` | string | LLM model used |

#### Example

```bash
curl -X POST "http://localhost:3001/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"How does vector search work?","limit":3}'
```

---

## Processing Endpoints

### POST /api/process/ocr

**Extract text from images or PDFs** using OCR (Optical Character Recognition).

#### Request

```bash
POST /api/process/ocr
Content-Type: application/json

{
  "url": "https://example.com/document.pdf"
}
```

OR

```bash
POST /api/process/ocr
Content-Type: application/json

{
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | One of | URL to image/PDF |
| `base64` | string | One of | Base64-encoded image/PDF |

#### Response

```json
{
  "text": "Extracted text from the image or PDF...",
  "confidence": 0.95
}
```

---

### POST /api/process/translate

**Translate text** to another language.

#### Request

```bash
POST /api/process/translate
Content-Type: application/json

{
  "text": "Hello world",
  "targetLanguage": "es"
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ Yes | Text to translate |
| `targetLanguage` | string | ✅ Yes | Target language code (ISO 639-1) |
| `sourceLanguage` | string | No | Source language (auto-detected if omitted) |

#### Response

```json
{
  "original": "Hello world",
  "translated": "Hola mundo",
  "sourceLanguage": "en",
  "targetLanguage": "es"
}
```

---

### POST /api/process/describe

**Get AI-generated descriptions** of images or audio.

#### Request

```bash
POST /api/process/describe
Content-Type: application/json

{
  "url": "https://example.com/image.jpg",
  "type": "image"
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ Yes | URL to image/audio file |
| `type` | string | ✅ Yes | Media type: `image` or `audio` |

#### Response

```json
{
  "description": "A sunset over the ocean with palm trees in the foreground",
  "type": "image",
  "confidence": 0.89
}
```

---

## Health & Status

### GET /health

**System health check** - Check if backend is operational.

#### Request

```bash
GET /health
```

#### Response

```json
{
  "status": "ok",
  "timestamp": "2026-02-13T23:36:26.163Z",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 37
    },
    "embedding": {
      "status": "ok",
      "latency": 0
    }
  }
}
```

#### Status Values

- `ok` - All systems operational
- `degraded` - Partial functionality (e.g., database slow)
- `error` - Critical failure

---

## Integration Examples

### NostrCast Integration

**Add search to podcast platform:**

```javascript
// Search NostrCast podcasts
async function searchPodcasts(query) {
  const response = await fetch(
    `http://localhost:3001/api/search?q=${encodeURIComponent(query)}&limit=10&mode=hybrid`
  );
  const data = await response.json();
  
  return data.results.map(result => ({
    title: result.title,
    description: result.content,
    url: result.url,
    relevance: result.score
  }));
}

// Example usage
const results = await searchPodcasts("bitcoin podcast");
console.log(results);
```

---

### NostrMaxi Integration

**Search NIP-05 identities and WoT data:**

```javascript
// Search Nostr identities
async function searchIdentities(query, userPubkey = null) {
  const url = new URL('http://localhost:3001/api/search');
  url.searchParams.set('q', query);
  url.searchParams.set('mode', 'hybrid');
  if (userPubkey) {
    url.searchParams.set('user_pubkey', userPubkey);  // WoT ranking
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  return data.results;
}

// Example usage
const identities = await searchIdentities(
  "bitcoin developer",
  "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"
);
```

---

### Fragstr Integration

**Search game content:**

```javascript
// Search games and content
async function searchGames(query) {
  const response = await fetch(
    `http://localhost:3001/api/search?q=${encodeURIComponent(query)}&limit=20&mode=hybrid`
  );
  const data = await response.json();
  
  return data.results.filter(r => r.document_type === 'game');
}

// Example usage
const games = await searchGames("retro fps");
```

---

### RAG for User Support

**AI-powered help system:**

```javascript
// Get AI answer to user question
async function getAnswer(question) {
  const response = await fetch('http://localhost:3001/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, limit: 5 })
  });
  
  const data = await response.json();
  
  return {
    answer: data.answer,
    sources: data.sources
  };
}

// Example usage
const help = await getAnswer("How do I setup a Lightning node?");
console.log(help.answer);
console.log("Sources:", help.sources);
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters |
| 404 | Not Found | Endpoint doesn't exist |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Backend down or overloaded |

### Example Error Handling

```javascript
async function safeSearch(query) {
  try {
    const response = await fetch(
      `http://localhost:3001/api/search?q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Search failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Search error:', error.message);
    return { results: [] };  // Fallback to empty results
  }
}
```

---

## Rate Limiting

**Current Version:** No rate limiting (v1.0)

**Recommended Client-Side:**
- Debounce search queries (300-500ms)
- Cache results locally
- Batch requests when possible

**Future:** Rate limiting planned for production (100 req/min per IP).

---

## Best Practices

### 1. Use Hybrid Mode by Default

```javascript
// ✅ Good: Hybrid mode for best results
const results = await fetch('/api/search?q=bitcoin&mode=hybrid');

// ❌ Avoid: Text-only misses semantic matches
const results = await fetch('/api/search?q=bitcoin&mode=text');
```

### 2. Specify Reasonable Limits

```javascript
// ✅ Good: Limit results to avoid over-fetching
const results = await fetch('/api/search?q=test&limit=10');

// ❌ Avoid: No limit or excessive limit
const results = await fetch('/api/search?q=test&limit=1000');
```

### 3. Encode Query Parameters

```javascript
// ✅ Good: URL-encode query
const query = encodeURIComponent("How to setup Lightning?");
const url = `/api/search?q=${query}`;

// ❌ Bad: Unencoded special characters
const url = `/api/search?q=How to setup Lightning?`;  // Breaks on spaces
```

### 4. Handle Empty Results Gracefully

```javascript
const data = await fetch('/api/search?q=rare_query').then(r => r.json());

if (data.results.length === 0) {
  console.log("No results found. Try a different query.");
} else {
  console.log(`Found ${data.count} results`);
}
```

### 5. Use RAG for Natural Language Questions

```javascript
// ✅ Good: Use /api/ask for questions
const answer = await fetch('/api/ask', {
  method: 'POST',
  body: JSON.stringify({ question: "What is Nostr?" })
});

// ❌ Less effective: Search for questions
const results = await fetch('/api/search?q=What+is+Nostr');
```

### 6. Cache Frequently Accessed Results

```javascript
const cache = new Map();

async function cachedSearch(query) {
  if (cache.has(query)) {
    return cache.get(query);
  }
  
  const response = await fetch(`/api/search?q=${query}`);
  const data = await response.json();
  
  cache.set(query, data);
  return data;
}
```

---

## Performance Tips

### Response Times

| Endpoint | Expected Latency | Notes |
|----------|------------------|-------|
| `/health` | <50ms | Cached |
| `/api/search` (hybrid) | <200ms | Depends on index size |
| `/api/search` (vector) | <300ms | Embedding calculation |
| `/api/search` (text) | <100ms | Fastest mode |
| `/api/ask` | 1-3s | LLM inference time |

### Optimization

1. **Use `text` mode** for simple keyword searches (fastest)
2. **Limit results** to what you'll display (default: 10)
3. **Cache search results** client-side (especially for pagination)
4. **Debounce user input** (wait 300-500ms before searching)
5. **Index optimization** - Ensure embeddings are pre-generated

---

## Future Endpoints (Planned)

### POST /api/index

**Index content programmatically:**

```json
{
  "title": "My Document",
  "content": "Full text content...",
  "url": "https://example.com/doc",
  "metadata": {
    "author": "John Doe",
    "tags": ["bitcoin", "nostr"]
  }
}
```

### GET /api/connectors

**List and manage data connectors** (web spider, Nostr, SQL, etc.)

### GET /api/stats

**Search analytics and usage statistics**

---

## Support & Documentation

**GitHub:** https://github.com/strangesignal/beacon-search  
**Issues:** Report bugs via GitHub Issues  
**Docs:** See `README.md` and `DEPLOYMENT.md` in repository

---

**API Version:** 1.0.0  
**Last Updated:** 2026-02-13  
**Status:** Production Ready (Core Features)

---

# Podcast Content Intelligence (MVP)

## POST /api/podcasts/ingest
Ingest RSS feeds and episode/transcript pages, optionally transcribing missing audio.

**Request**
```json
{
  "sources": [{ "rssUrl": "https://example.com/rss" }],
  "transcribeMissing": true,
  "maxEpisodes": 25,
  "chunkSize": 1200,
  "chunkOverlap": 200,
  "forceReindex": false
}
```

**Response**
```json
{
  "results": [
    {
      "runId": "...",
      "sourceId": "...",
      "rssUrl": "https://example.com/rss",
      "title": "Example Podcast",
      "episodesDiscovered": 25,
      "episodesUpdated": 25,
      "transcriptsCreated": 10,
      "transcriptsTranscribed": 2,
      "errors": []
    }
  ]
}
```

## GET /api/podcasts/ingest/:runId
Get ingest run status.

## GET /api/podcasts/episodes/:episodeId/transcript
Fetch stored transcript text.

## GET /api/podcasts/facets
Return tag/entity/source facet counts for podcast content.

## POST /api/podcasts/recommendations/preview
Score and rank podcast episodes for a profile.

**Request**
```json
{
  "profile": {
    "keywords": ["retrieval", "vector search"],
    "topics": ["ai"],
    "entities": ["OpenAI"],
    "speakers": ["Sam Altman"],
    "excludeTopics": ["crypto"],
    "excludeEntities": ["NFT"]
  },
  "limit": 5
}
```

**Response**
```json
{
  "recommendations": [
    {
      "episodeId": "...",
      "title": "Building AI Agents",
      "episodeUrl": "https://example.com/ep-1",
      "audioUrl": "https://cdn.example.com/ep-1.mp3",
      "publishedAt": "2026-02-10T00:00:00.000Z",
      "sourceId": "...",
      "sourceTitle": "Example Podcast",
      "rssUrl": "https://example.com/rss",
      "summary": "...",
      "score": 0.82
    }
  ]
}
```
