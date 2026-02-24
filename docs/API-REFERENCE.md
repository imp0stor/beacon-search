# Beacon Search API Reference

**Version:** 1.0.0  
**Base URL:** `http://localhost:3001` (development) or your configured API URL  
**Content-Type:** `application/json`

## Table of Contents

1. [Health & Status](#health--status)
2. [Search](#search)
3. [FRPEI (Federated Retrieval)](#frpei-federated-retrieval)
4. [RAG Query](#rag-query)
5. [Documents](#documents)
6. [Connectors](#connectors)
7. [Webhooks](#webhooks)
8. [Ontology](#ontology)
9. [Dictionary](#dictionary)
10. [Triggers](#triggers)
11. [NLP Pipeline](#nlp-pipeline)
12. [Processing](#processing)
13. [Media Catalog](#media-catalog)
14. [Error Handling](#error-handling)

---

## Health & Status

### Health Check

Check system health and component status.

```http
GET /health
```

**Response** `200 OK` or `503 Service Unavailable`

```json
{
  "status": "ok",
  "timestamp": "2026-02-12T14:30:00.000Z",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 5
    },
    "embedding": {
      "status": "ok",
      "latency": 0
    }
  }
}
```

### System Stats

Get aggregate statistics about the system.

```http
GET /api/stats
```

**Response** `200 OK`

```json
{
  "totalDocuments": 5432,
  "totalConnectors": 8,
  "ontologyTerms": 156,
  "dictionaryEntries": 89,
  "activeTriggers": 12,
  "sourceStats": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Documentation Site",
      "connector_type": "web",
      "document_count": 2100
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Engineering Wiki",
      "connector_type": "folder",
      "document_count": 850
    }
  ]
}
```

---

## Search

### Hybrid Search

Search documents using hybrid (vector + text), pure vector, or pure text mode.

```http
GET /api/search
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `q` | string | Search query (required) | - |
| `mode` | string | `hybrid`, `vector`, or `text` | `hybrid` |
| `limit` | integer | Max results to return | `10` |
| `sourceId` | string | Filter by source/connector ID | - |
| `explain` | boolean | Include query expansion details | `false` |
| `expand` | boolean | Enable ontology/dictionary expansion | `true` |

**Example Request**

```bash
curl "http://localhost:3001/api/search?q=how%20to%20use%20vector%20search&mode=hybrid&limit=5&explain=true"
```

**Response** `200 OK`

```json
{
  "query": "how to use vector search",
  "mode": "hybrid",
  "count": 5,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Introduction to Vector Search",
      "content": "Vector search is a method of finding similar items...",
      "url": "https://docs.example.com/vector-search",
      "source_id": "550e8400-e29b-41d4-a716-446655440000",
      "document_type": "web",
      "score": 0.89
    }
  ],
  "explanation": {
    "originalQuery": "how to use vector search",
    "expandedTerms": ["similarity", "semantic", "embedding"],
    "ontologyExpansions": [
      {
        "term": "vector search",
        "expanded": ["similarity search", "semantic search", "embedding search"]
      }
    ],
    "dictionaryExpansions": [],
    "triggersApplied": [
      {
        "name": "How-to Boost",
        "pattern": "^how (to|do|can)",
        "actions": { "boost_doc_type": "kb_article" }
      }
    ],
    "finalQuery": "how to use vector search similarity semantic embedding"
  }
}
```

### Faceted Search

Search with filters for tags, entities, and sentiment.

```http
GET /api/search/filtered
```

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `tags` | string | Comma-separated tags |
| `entityType` | string | Entity type (PERSON, ORGANIZATION, etc.) |
| `entityValue` | string | Entity value to match |
| `sentiment` | string | `positive`, `negative`, or `neutral` |
| `limit` | integer | Max results |

**Example Request**

```bash
curl "http://localhost:3001/api/search/filtered?q=machine%20learning&tags=AI,tutorial&sentiment=positive"
```

### Get Search Facets

Get available facets for filtering.

```http
GET /api/search/facets
```

**Response** `200 OK`

```json
{
  "tags": [
    { "tag": "AI", "count": 234 },
    { "tag": "tutorial", "count": 156 },
    { "tag": "documentation", "count": 89 }
  ],
  "entityTypes": [
    { "type": "PERSON", "count": 567 },
    { "type": "ORGANIZATION", "count": 234 },
    { "type": "LOCATION", "count": 189 }
  ],
  "sentiments": [
    { "sentiment": "positive", "count": 1234 },
    { "sentiment": "neutral", "count": 3456 },
    { "sentiment": "negative", "count": 234 }
  ],
  "sources": [
    { "id": "...", "name": "Docs", "count": 2100 }
  ]
}
```

---

## FRPEI (Federated Retrieval)

### Retrieve (Federated Search)
```http
POST /api/frpei/retrieve
POST /api/frpei/ingest
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
  "results": [{ "candidateId": "uuid", "title": "The Matrix" }],
  "providers": [{ "provider": "beacon", "elapsedMs": 120 }],
  "metrics": { "requests": 1, "cacheHits": 0 }
}
```

### Enrich
```http
POST /api/frpei/enrich
```

**Request**
```json
{ "candidates": [{ "candidateId": "uuid", "title": "The Matrix" }] }
```

**Response**
```json
{ "enriched": [{ "candidateId": "uuid", "enrichment": { "synonyms": ["Matrix"] } }] }
```

### Rank
```http
POST /api/frpei/rank
```

**Request**
```json
{ "candidates": [{ "candidateId": "uuid", "title": "The Matrix" }] }
```

**Response**
```json
{ "ranked": [{ "candidateId": "uuid", "rank": 1, "rankScore": 0.91 }] }
```

### Explain
```http
POST /api/frpei/explain
```

**Request**
```json
{ "candidate": { "candidateId": "uuid", "title": "The Matrix" } }
```

**Response**
```json
{ "candidateId": "uuid", "explanation": { "totalScore": 0.91 } }
```

### Feedback
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

### Metrics & Provider Health
```http
GET /api/frpei/metrics
GET /api/frpei/status
```

---

## RAG Query

### Ask a Question

Use RAG (Retrieval-Augmented Generation) to answer questions using indexed documents.

```http
POST /api/ask
```

**Request Body**

```json
{
  "question": "How do I implement vector search in PostgreSQL?",
  "limit": 5,
  "sourceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `question` | string | Question to answer | ✅ |
| `limit` | integer | Number of context documents | |
| `sourceId` | string | Limit to specific source | |

**Response** `200 OK`

```json
{
  "question": "How do I implement vector search in PostgreSQL?",
  "answer": "To implement vector search in PostgreSQL, you can use the pgvector extension [Source 1]. First, install the extension with `CREATE EXTENSION vector;`, then create a table with a vector column [Source 2]...",
  "sources": [
    {
      "index": 1,
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "PostgreSQL pgvector Guide",
      "url": "https://docs.example.com/pgvector",
      "score": 0.92,
      "excerpt": "pgvector is an open-source extension for PostgreSQL that enables storing and querying vector embeddings..."
    },
    {
      "index": 2,
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "title": "Introduction to Vector Search",
      "url": "https://docs.example.com/vector-search",
      "score": 0.87,
      "excerpt": "Vector search is a method of finding similar items by comparing their vector representations..."
    }
  ],
  "model": "gpt-4o-mini"
}
```

**Error Response** `503 Service Unavailable`

```json
{
  "error": "OpenAI API not configured. Set OPENAI_API_KEY environment variable."
}
```

---

## Documents

### List Documents

```http
GET /api/documents
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `sourceId` | string | Filter by source | - |
| `limit` | integer | Max results | `100` |

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Introduction to Vector Search",
    "content": "Vector search is a method of finding similar items...",
    "url": "https://docs.example.com/vector-search",
    "source_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-02-12T10:00:00.000Z"
  }
]
```

### Create Document

Index a new document with automatic embedding generation.

```http
POST /api/documents
```

**Request Body**

```json
{
  "title": "My Document Title",
  "content": "Full text content of the document...",
  "url": "https://example.com/doc",
  "sourceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `title` | string | Document title | ✅ |
| `content` | string | Document content | ✅ |
| `url` | string | Source URL | |
| `sourceId` | string | Connector/source ID | |

**Response** `201 Created`

```json
{
  "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "title": "My Document Title",
  "content": "Full text content of the document...",
  "url": "https://example.com/doc",
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-02-12T14:30:00.000Z"
}
```

### Delete Document

```http
DELETE /api/documents/:id
```

**Response** `204 No Content`

### Generate Embeddings

Generate embeddings for documents that don't have them.

```http
POST /api/generate-embeddings
```

**Response** `200 OK`

```json
{
  "message": "Generated embeddings for 42 documents"
}
```

### Get Document Tags

```http
GET /api/documents/:id/tags
```

**Response** `200 OK`

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "tags": [
    { "tag": "vector-search", "confidence": 0.95, "source": "auto", "algorithm": "tfidf" },
    { "tag": "tutorial", "confidence": 0.88, "source": "auto", "algorithm": "rake" },
    { "tag": "important", "confidence": 1.0, "source": "manual", "algorithm": null }
  ]
}
```

### Add Tag to Document

```http
POST /api/documents/:id/tags
```

**Request Body**

```json
{
  "tag": "important"
}
```

**Response** `201 Created`

### Remove Tag from Document

```http
DELETE /api/documents/:id/tags/:tag
```

**Response** `204 No Content`

### Get Document Entities

```http
GET /api/documents/:id/entities
```

**Response** `200 OK`

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "entities": [
    {
      "entity_type": "PERSON",
      "entity_value": "Dr. John Smith",
      "normalized_value": "john smith",
      "confidence": 0.92,
      "context": "...authored by Dr. John Smith, who specializes in..."
    },
    {
      "entity_type": "ORGANIZATION",
      "entity_value": "OpenAI",
      "normalized_value": "openai",
      "confidence": 0.95,
      "context": "...using models from OpenAI to generate..."
    }
  ]
}
```

### Get Document Metadata

```http
GET /api/documents/:id/metadata
```

**Response** `200 OK`

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "metadata": {
    "word_count": 1234,
    "reading_time_minutes": 5,
    "sentiment": "positive",
    "sentiment_confidence": 0.78,
    "document_class": "documentation",
    "has_code_blocks": true,
    "has_lists": true,
    "has_tables": false
  }
}
```

### Get Related Documents

```http
GET /api/documents/:id/related
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Max results | `5` |

**Response** `200 OK`

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "related": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "title": "PostgreSQL pgvector Guide",
      "score": 0.85,
      "shared_entities": ["pgvector", "PostgreSQL"],
      "shared_tags": ["database", "tutorial"]
    }
  ]
}
```

### Get Tag Suggestions

```http
GET /api/documents/:id/tag-suggestions
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Max suggestions | `10` |

**Response** `200 OK`

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "suggestions": [
    { "tag": "postgresql", "confidence": 0.89 },
    { "tag": "vector-database", "confidence": 0.76 }
  ]
}
```

---

## Connectors

### List Connectors

```http
GET /api/connectors
```

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Documentation Site",
    "description": "Company documentation",
    "connector_type": "web",
    "config": {
      "type": "web",
      "seedUrl": "https://docs.example.com",
      "maxDepth": 2,
      "maxPages": 500
    },
    "is_active": true,
    "last_run_at": "2026-02-12T10:00:00.000Z",
    "last_run_status": "completed",
    "created_at": "2026-02-01T00:00:00.000Z"
  }
]
```

### Get Connector

```http
GET /api/connectors/:id
```

**Response** `200 OK`

Returns single connector object.

### Create Connector

```http
POST /api/connectors
```

**Request Body (Web Spider)**

```json
{
  "name": "Documentation Site",
  "description": "Company documentation",
  "connector_type": "web",
  "config": {
    "type": "web",
    "seedUrl": "https://docs.example.com",
    "maxDepth": 3,
    "maxPages": 500,
    "sameDomainOnly": true,
    "respectRobotsTxt": true,
    "rateLimit": 1000,
    "includePatterns": [".*\\/docs\\/.*"],
    "excludePatterns": [".*\\.pdf$"]
  },
  "portal_url": "https://docs.example.com",
  "item_url_template": "{url}",
  "search_url_template": "https://docs.example.com/search?q={query}"
}
```

**Request Body (Folder)**

```json
{
  "name": "Local Wiki",
  "connector_type": "folder",
  "config": {
    "type": "folder",
    "folderPath": "/data/wiki",
    "recursive": true,
    "fileTypes": [".md", ".txt", ".pdf", ".docx"],
    "watchForChanges": true,
    "excludePatterns": ["node_modules/**"]
  }
}
```

**Response** `201 Created`

### Update Connector

```http
PUT /api/connectors/:id
```

**Request Body**

Same as create, all fields optional.

**Response** `200 OK`

### Delete Connector

```http
DELETE /api/connectors/:id
```

**Response** `204 No Content`

### Run Connector

Start a connector sync.

```http
POST /api/connectors/:id/run
```

**Response** `200 OK`

```json
{
  "message": "Connector started",
  "runId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

### Stop Connector

Stop a running connector.

```http
POST /api/connectors/:id/stop
```

**Response** `200 OK`

```json
{
  "message": "Connector stopped"
}
```

### Get Connector Status

```http
GET /api/connectors/:id/status
```

**Response** `200 OK`

```json
{
  "status": "running",
  "progress": {
    "current_url": "https://docs.example.com/page/42",
    "pages_crawled": 42,
    "pages_indexed": 38,
    "errors": 2
  },
  "started_at": "2026-02-12T14:00:00.000Z"
}
```

### Get Connector History

```http
GET /api/connectors/:id/history
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Max results | `10` |

**Response** `200 OK`

```json
[
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "connector_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "started_at": "2026-02-12T10:00:00.000Z",
    "completed_at": "2026-02-12T10:15:32.000Z",
    "documents_added": 156,
    "documents_updated": 42,
    "documents_removed": 3,
    "error_message": null
  }
]
```

---

## Webhooks

### List Webhooks

```http
GET /api/webhooks
```

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "Slack Notification",
    "url": "https://hooks.slack.com/services/...",
    "events": ["document.indexed", "connector.completed"],
    "enabled": true,
    "last_triggered_at": "2026-02-12T14:00:00.000Z",
    "last_status": 200,
    "failure_count": 0
  }
]
```

### Create Webhook

```http
POST /api/webhooks
```

**Request Body**

```json
{
  "name": "Slack Notification",
  "url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
  "events": ["document.indexed", "document.deleted", "connector.completed", "connector.error"],
  "headers": {
    "X-Custom-Header": "value"
  },
  "enabled": true
}
```

**Available Events**

| Event | Description |
|-------|-------------|
| `document.indexed` | New document indexed |
| `document.updated` | Document updated |
| `document.deleted` | Document deleted |
| `search.performed` | Search query executed |
| `answer.generated` | RAG answer generated |
| `connector.started` | Connector run started |
| `connector.completed` | Connector run completed |
| `connector.error` | Connector error occurred |

**Response** `201 Created`

```json
{
  "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "name": "Slack Notification",
  "url": "https://hooks.slack.com/services/...",
  "events": ["document.indexed", "connector.completed"],
  "secret": "whsec_abc123...",
  "enabled": true,
  "created_at": "2026-02-12T14:30:00.000Z"
}
```

### Update Webhook

```http
PUT /api/webhooks/:id
```

**Response** `200 OK`

### Delete Webhook

```http
DELETE /api/webhooks/:id
```

**Response** `204 No Content`

### Test Webhook

Send a test event to a webhook.

```http
POST /api/webhooks/:id/test
```

**Response** `200 OK`

```json
{
  "message": "Test event sent",
  "response_status": 200
}
```

### Get Webhook Deliveries

```http
GET /api/webhooks/:id/deliveries
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Max results | `50` |
| `status` | string | Filter by status | - |

**Response** `200 OK`

```json
[
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "webhook_id": "550e8400-e29b-41d4-a716-446655440010",
    "event": "document.indexed",
    "payload": { "event": "document.indexed", "data": { ... } },
    "status": "success",
    "attempts": 1,
    "response_status": 200,
    "created_at": "2026-02-12T14:00:00.000Z"
  }
]
```

### Retry Delivery

```http
POST /api/webhooks/deliveries/:deliveryId/retry
```

**Response** `200 OK`

### Webhook Payload Format

All webhook payloads follow this structure:

```json
{
  "event": "document.indexed",
  "timestamp": "2026-02-12T14:30:00.000Z",
  "data": {
    "document_id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Document Title",
    "source_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Signature Verification**

Webhooks include an HMAC-SHA256 signature in the `X-Beacon-Signature` header:

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

---

## Ontology

### List Ontology Terms

```http
GET /api/ontology
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `tree` | boolean | Return hierarchical tree | `false` |

**Response** `200 OK` (flat)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "parent_id": null,
    "term": "Programming Language",
    "description": "Languages for software development",
    "synonyms": ["coding language", "development language"],
    "created_at": "2026-02-01T00:00:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440021",
    "parent_id": "550e8400-e29b-41d4-a716-446655440020",
    "term": "JavaScript",
    "synonyms": ["JS", "ECMAScript"],
    "created_at": "2026-02-01T00:00:00.000Z"
  }
]
```

**Response** `200 OK` (tree)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "term": "Programming Language",
    "children": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440021",
        "term": "JavaScript",
        "children": []
      }
    ]
  }
]
```

### Get Ontology Term

```http
GET /api/ontology/:id
```

### Create Ontology Term

```http
POST /api/ontology
```

**Request Body**

```json
{
  "term": "JavaScript",
  "parent_id": "550e8400-e29b-41d4-a716-446655440020",
  "description": "A programming language for the web",
  "synonyms": ["JS", "ECMAScript", "ES6"]
}
```

**Response** `201 Created`

### Update Ontology Term

```http
PUT /api/ontology/:id
```

**Response** `200 OK`

### Delete Ontology Term

```http
DELETE /api/ontology/:id
```

**Response** `204 No Content`

Children are preserved with `parent_id` set to `NULL`.

### Expand Term

Get all child terms and synonyms for a term.

```http
GET /api/ontology/expand/:term
```

**Response** `200 OK`

```json
{
  "term": "Programming Language",
  "expanded": [
    "Programming Language",
    "coding language",
    "JavaScript",
    "JS",
    "Python",
    "TypeScript"
  ]
}
```

---

## Dictionary

### List Dictionary Entries

```http
GET /api/dictionary
```

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Filter by domain |

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "term": "API",
    "synonyms": ["interface", "endpoint"],
    "acronym_for": "Application Programming Interface",
    "domain": "technology",
    "boost_weight": 1.5,
    "created_at": "2026-02-01T00:00:00.000Z"
  }
]
```

### Get Dictionary Entry

```http
GET /api/dictionary/:id
```

### Create Dictionary Entry

```http
POST /api/dictionary
```

**Request Body**

```json
{
  "term": "ML",
  "synonyms": ["machine learning", "statistical learning"],
  "acronym_for": "Machine Learning",
  "domain": "ai",
  "boost_weight": 1.2
}
```

**Response** `201 Created`

### Update Dictionary Entry

```http
PUT /api/dictionary/:id
```

### Delete Dictionary Entry

```http
DELETE /api/dictionary/:id
```

**Response** `204 No Content`

### Lookup Term

Find dictionary entries matching a term.

```http
GET /api/dictionary/lookup/:term
```

**Response** `200 OK`

```json
{
  "term": "ML",
  "found": true,
  "entries": [
    {
      "term": "ML",
      "synonyms": ["machine learning"],
      "acronym_for": "Machine Learning",
      "boost_weight": 1.2
    }
  ]
}
```

---

## Triggers

### List Triggers

```http
GET /api/triggers
```

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `enabled` | boolean | Filter by enabled status |

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "name": "How-to Boost",
    "pattern": "^how (to|do|can)",
    "conditions": { "min_terms": 3 },
    "actions": {
      "boost_doc_type": "kb_article",
      "inject_terms": ["guide", "tutorial"]
    },
    "priority": 10,
    "enabled": true,
    "description": "Boost KB articles for how-to queries"
  }
]
```

### Get Trigger

```http
GET /api/triggers/:id
```

### Create Trigger

```http
POST /api/triggers
```

**Request Body**

```json
{
  "name": "Error Boost",
  "pattern": "(error|exception|bug|issue)",
  "conditions": {},
  "actions": {
    "boost_doc_type": "troubleshooting",
    "inject_terms": ["fix", "solution", "resolve"]
  },
  "priority": 5,
  "enabled": true,
  "description": "Boost troubleshooting docs for error-related queries"
}
```

**Response** `201 Created`

### Update Trigger

```http
PUT /api/triggers/:id
```

### Delete Trigger

```http
DELETE /api/triggers/:id
```

**Response** `204 No Content`

### Test Trigger

Test a trigger pattern against a query.

```http
POST /api/triggers/test
```

**Request Body**

```json
{
  "query": "how do I fix this error",
  "pattern": "^how (to|do|can)"
}
```

**Response** `200 OK`

```json
{
  "query": "how do I fix this error",
  "pattern": "^how (to|do|can)",
  "matches": true,
  "matchGroups": ["how do", "do"]
}
```

---

## NLP Pipeline

### Process All Documents

Run NLP processing on all unprocessed documents.

```http
POST /api/nlp/process-all
```

**Response** `200 OK`

```json
{
  "message": "NLP processing started",
  "queuedDocuments": 150
}
```

### Process Single Document

```http
POST /api/documents/:id/process-nlp
```

**Response** `200 OK`

```json
{
  "message": "NLP processing complete",
  "tags": 5,
  "entities": 12,
  "metadata": 8
}
```

### Train TF-IDF Model

Train the TF-IDF model on the corpus for keyword extraction.

```http
POST /api/nlp/train
```

**Response** `200 OK`

```json
{
  "message": "TF-IDF model trained",
  "documentCount": 5432,
  "vocabularySize": 15678
}
```

### Get NLP Status

```http
GET /api/nlp/status
```

**Response** `200 OK`

```json
{
  "tfidf_trained": true,
  "documents_processed": 5432,
  "documents_pending": 0,
  "last_training": "2026-02-12T10:00:00.000Z"
}
```

### Get Entities by Type

```http
GET /api/entities/:type
```

**Response** `200 OK`

```json
[
  {
    "entity_value": "John Smith",
    "normalized_value": "john smith",
    "document_count": 15
  },
  {
    "entity_value": "Jane Doe",
    "normalized_value": "jane doe",
    "document_count": 8
  }
]
```

### Get Tag Cloud

```http
GET /api/tags/cloud
```

**Query Parameters**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Max tags | `50` |

**Response** `200 OK`

```json
[
  { "tag": "documentation", "count": 234, "weight": 1.0 },
  { "tag": "tutorial", "count": 156, "weight": 0.67 },
  { "tag": "api", "count": 89, "weight": 0.38 }
]
```

---

## Processing

### Get Processing Status

```http
GET /api/process/status
```

**Response** `200 OK`

```json
{
  "ocr": {
    "enabled": true,
    "provider": "tesseract.js"
  },
  "translation": {
    "enabled": false,
    "provider": null
  },
  "aiDescription": {
    "enabled": false,
    "provider": null
  }
}
```

### OCR Image/PDF

Extract text from images or scanned PDFs.

```http
POST /api/process/ocr
```

**Request (File Upload)**

```bash
curl -X POST http://localhost:3001/api/process/ocr \
  -F "file=@document.png" \
  -F "language=eng"
```

**Request (Base64)**

```json
{
  "base64": "data:image/png;base64,iVBORw0KGgo...",
  "language": "eng"
}
```

**Response** `200 OK`

```json
{
  "text": "Extracted text from the image...",
  "confidence": 0.92,
  "language": "eng"
}
```

### Translate Text

```http
POST /api/process/translate
```

**Request Body**

```json
{
  "text": "Hallo Welt, wie geht es dir?",
  "targetLanguage": "en",
  "sourceLanguage": "de"
}
```

**Response** `200 OK`

```json
{
  "original": "Hallo Welt, wie geht es dir?",
  "translated": "Hello world, how are you?",
  "sourceLanguage": "de",
  "targetLanguage": "en"
}
```

### Detect Language

```http
POST /api/process/detect-language
```

**Request Body**

```json
{
  "text": "Bonjour le monde"
}
```

**Response** `200 OK`

```json
{
  "language": "fr",
  "confidence": 0.95,
  "name": "French"
}
```

### AI Describe Media

Generate AI descriptions for images or audio.

```http
POST /api/process/describe
```

**Request (File Upload)**

```bash
curl -X POST http://localhost:3001/api/process/describe \
  -F "file=@photo.jpg" \
  -F "detailed=true"
```

**Response** `200 OK`

```json
{
  "description": "A scenic mountain landscape with snow-capped peaks reflected in a calm alpine lake. The sky is clear blue with a few wispy clouds.",
  "mediaType": "image",
  "detailed": true
}
```

### Process File (Full Pipeline)

Run the full processing pipeline on a file.

```http
POST /api/process/file
```

**Request (File Upload)**

```bash
curl -X POST http://localhost:3001/api/process/file \
  -F "file=@document.pdf"
```

**Request (Path)**

```json
{
  "path": "/data/documents/report.pdf"
}
```

**Response** `200 OK`

```json
{
  "mediaType": "document",
  "extractedText": "Content of the document...",
  "detectedLanguage": "en",
  "ocrApplied": false,
  "translationApplied": false,
  "aiDescription": null,
  "metadata": {
    "pages": 5,
    "wordCount": 2340
  }
}
```

---

## Media Catalog

### Movie Ingestion

```http
POST /api/movies/ingest
```

**Request Body**

```json
{
  "movies": [
    { "title": "Arrival", "year": 2016, "imdbId": "tt2543164" }
  ],
  "language": "en",
  "subtitleVariants": [
    {
      "movieTitle": "Arrival",
      "language": "en",
      "variants": [
        {
          "url": "https://public-subtitles.example.com/arrival-en.srt",
          "sourceName": "Public Domain Archive",
          "provider": "direct",
          "reliabilityWeight": 0.7,
          "format": "srt",
          "provenance": {
            "sourceUrl": "https://public-subtitles.example.com",
            "license": "Public Domain"
          }
        }
      ]
    }
  ],
  "transcribeMissing": false,
  "options": {
    "providerPreference": ["tmdb", "omdb"],
    "providerRegion": "US"
  }
}
```

### Movie Browse

```http
GET /api/movies/browse
GET /api/movies/browse?movieId=UUID
```

### Movie Facets

```http
GET /api/movies/facets
```

### Movie Search

```http
POST /api/movies/search
```

**Request Body**

```json
{
  "query": "first contact",
  "mode": "hybrid",
  "filters": {
    "genre": "Science Fiction",
    "releaseYear": 2016
  }
}
```

### Movie Transcripts

```http
GET /api/movies/:movieId/transcripts
```

### Movie Recommendations

```http
POST /api/movies/recommendations/preview
```

### Mixed Media Browse

```http
GET /api/media/browse
```

### Mixed Media Facets

```http
GET /api/media/facets?types=podcast,tv,movie
```

### Mixed Media Search

```http
POST /api/media/search
```

**Request Body**

```json
{
  "query": "space exploration",
  "mode": "hybrid",
  "types": ["movie", "tv", "podcast"]
}
```

### Mixed Media Recommendations

```http
POST /api/media/recommendations/preview
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Brief error message",
  "details": "More detailed explanation (optional)"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful delete) |
| `400` | Bad Request - Invalid input |
| `404` | Not Found |
| `409` | Conflict - Duplicate entry |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

### Common Errors

**400 Bad Request**

```json
{
  "error": "Title and content are required"
}
```

**404 Not Found**

```json
{
  "error": "Document not found"
}
```

**409 Conflict**

```json
{
  "error": "Term already exists"
}
```

**500 Internal Server Error**

```json
{
  "error": "Search failed",
  "details": "Connection to database timed out"
}
```

**503 Service Unavailable**

```json
{
  "error": "OpenAI API not configured. Set OPENAI_API_KEY environment variable."
}
```

---

## Rate Limiting

Currently, Beacon Search does not implement rate limiting. For production deployments, consider adding rate limiting at the reverse proxy level (Caddy, nginx) or implementing middleware.

Recommended limits:
- Search: 100 requests/minute
- Document indexing: 60 requests/minute
- RAG queries: 20 requests/minute

---

## SDK Examples

### Python

```python
import requests

BASE_URL = "http://localhost:3001"

# Search
response = requests.get(f"{BASE_URL}/api/search", params={
    "q": "vector search",
    "mode": "hybrid",
    "limit": 10
})
results = response.json()

# Index document
response = requests.post(f"{BASE_URL}/api/documents", json={
    "title": "My Document",
    "content": "Document content here..."
})
doc = response.json()

# Ask question
response = requests.post(f"{BASE_URL}/api/ask", json={
    "question": "How does vector search work?"
})
answer = response.json()
```

### JavaScript/TypeScript

```typescript
const BASE_URL = "http://localhost:3001";

// Search
const searchResponse = await fetch(
  `${BASE_URL}/api/search?q=vector%20search&mode=hybrid&limit=10`
);
const results = await searchResponse.json();

// Index document
const docResponse = await fetch(`${BASE_URL}/api/documents`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "My Document",
    content: "Document content here..."
  })
});
const doc = await docResponse.json();

// Ask question
const askResponse = await fetch(`${BASE_URL}/api/ask`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    question: "How does vector search work?"
  })
});
const answer = await askResponse.json();
```

### cURL

```bash
# Search
curl "http://localhost:3001/api/search?q=vector%20search&mode=hybrid"

# Index document
curl -X POST http://localhost:3001/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "My Doc", "content": "Content..."}'

# Ask question
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How does vector search work?"}'
```
