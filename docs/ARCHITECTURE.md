# Architecture: Beacon

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Clients                                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                    │
│  │  Admin UI     │  │  Search UI    │  │  API Clients  │                    │
│  │  (Next.js)    │  │  (Embedded)   │  │  (REST/GQL)   │                    │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘                    │
└──────────┼──────────────────┼──────────────────┼────────────────────────────┘
           │                  │                  │
           └──────────────────┴──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │
                    │   (Express/Hono)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────────────────┐
│                            Core Services                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Search     │  │   Index      │  │    RAG       │  │  Connectors  │     │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                            Data Layer                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │   PostgreSQL     │  │      Redis       │  │   Object Store   │           │
│  │   + pgvector     │  │     (cache)      │  │   (S3/local)     │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                          External Systems                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  External   │  │  REST APIs  │  │   Files     │  │  OpenAI /   │         │
│  │  Databases  │  │             │  │   (docs)    │  │   Ollama    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Services

### 1. Search Service

Handles all search operations.

```typescript
interface SearchService {
  // Full-text + semantic hybrid search
  search(query: SearchQuery): Promise<SearchResults>;
  
  // Get suggestions based on partial input
  suggest(prefix: string, options: SuggestOptions): Promise<Suggestion[]>;
  
  // Explain why a document matched
  explain(query: string, documentId: string): Promise<Explanation>;
}

interface SearchQuery {
  text: string;
  userId?: string;           // For permission filtering
  documentTypes?: string[];  // Filter by type
  dateRange?: DateRange;
  attributes?: Record<string, string>;
  semantic?: boolean;        // Enable vector search
  limit?: number;
  offset?: number;
}

interface SearchResults {
  results: SearchResult[];
  total: number;
  queryTimeMs: number;
  semanticResults?: SearchResult[];  // If hybrid, separate semantic matches
}
```

**Implementation Notes:**
- Hybrid search: keyword (PostgreSQL FTS) + semantic (pgvector)
- Permission filtering via RLS or filter injection
- Highlighting using `ts_headline`
- Snippet extraction with fallback to first N chars

### 2. Index Service

Manages document indexing and embeddings.

```typescript
interface IndexService {
  // Index a batch of documents
  indexDocuments(docs: DocumentInput[]): Promise<IndexResult>;
  
  // Remove documents by ID
  removeDocuments(ids: string[]): Promise<number>;
  
  // Get indexing status
  getStatus(documentType: string): Promise<IndexStatus>;
  
  // Trigger re-embedding (e.g., after model change)
  reEmbed(documentType: string): Promise<void>;
}

interface DocumentInput {
  externalId: string;
  documentType: string;
  title: string;
  content: string;
  url?: string;
  lastModified: Date;
  attributes?: Record<string, any>;
  permissionGroups?: string[];
}
```

**Implementation Notes:**
- Chunk long documents (512-token chunks with overlap)
- Generate embeddings via OpenAI or Ollama
- Store chunks with parent document reference
- Update parent document's aggregate embedding

### 3. RAG Service

Retrieval-Augmented Generation for answers.

```typescript
interface RAGService {
  // Generate an answer with citations
  answer(question: string, options: RAGOptions): Promise<RAGResponse>;
  
  // Follow-up question in context
  followUp(sessionId: string, question: string): Promise<RAGResponse>;
}

interface RAGOptions {
  userId?: string;
  documentTypes?: string[];
  maxContextChunks?: number;
  temperature?: number;
  model?: string;
}

interface RAGResponse {
  answer: string;
  confidence: number;
  citations: Citation[];
  suggestedFollowUps?: string[];
}

interface Citation {
  documentId: string;
  documentTitle: string;
  url?: string;
  snippet: string;
  relevance: number;
}
```

**Implementation Notes:**
- Retrieve top-k relevant chunks
- Re-rank by relevance
- Construct prompt with context
- Parse citations from response
- Cache common questions

### 4. Connector Service

Manages external data source connections.

```typescript
interface ConnectorService {
  // List all configured connectors
  list(): Promise<Connector[]>;
  
  // Test a connector configuration
  test(config: ConnectorConfig): Promise<TestResult>;
  
  // Trigger a sync
  sync(connectorId: string): Promise<SyncJob>;
  
  // Get sync history
  getHistory(connectorId: string): Promise<SyncHistory[]>;
}

interface ConnectorConfig {
  id: string;
  type: 'postgresql' | 'mysql' | 'rest' | 'file';
  name: string;
  documentType: string;
  connectionString?: string;
  metadataQuery: string;    // Returns (external_id, last_modified)
  dataQuery: string;        // Returns full document
  permissionQuery?: string;  // Returns user's permission groups
  permissionField?: string;
  urlTemplate?: string;
  schedule?: string;        // Cron expression
}
```

## Database Schema

### Core Tables

```sql
-- Configuration key-value store
CREATE TABLE config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data source connectors
CREATE TABLE connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    document_type VARCHAR(255) NOT NULL UNIQUE,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexed documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) NOT NULL,
    document_type VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    url VARCHAR(2000),
    last_modified TIMESTAMPTZ NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    attributes JSONB DEFAULT '{}',
    permission_groups TEXT[] DEFAULT '{}',
    
    -- Full-text search vector
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED,
    
    -- Aggregate embedding for document-level similarity
    embedding vector(1536),
    
    UNIQUE(document_type, external_id)
);

-- Document chunks for RAG
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    
    UNIQUE(document_id, chunk_index)
);

-- Sync history
CREATE TABLE sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES connectors(id),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL,  -- 'running', 'completed', 'failed'
    documents_added INTEGER DEFAULT 0,
    documents_updated INTEGER DEFAULT 0,
    documents_removed INTEGER DEFAULT 0,
    error_message TEXT
);

-- User sessions for RAG context
CREATE TABLE rag_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    context JSONB DEFAULT '[]'
);
```

### Indexes

```sql
-- Full-text search
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);

-- Vector similarity (use IVFFlat for large datasets)
CREATE INDEX idx_documents_embedding ON documents 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_chunks_embedding ON chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Permission filtering
CREATE INDEX idx_documents_permissions ON documents USING GIN(permission_groups);

-- Document type filtering
CREATE INDEX idx_documents_type ON documents(document_type);

-- Sync lookups
CREATE INDEX idx_documents_type_external ON documents(document_type, external_id);
```

### Row-Level Security (Optional)

```sql
-- Enable RLS on documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy for permission-based access
CREATE POLICY documents_access ON documents
    FOR SELECT
    USING (
        permission_groups = '{}' OR
        permission_groups && current_setting('app.user_groups')::text[]
    );
```

## Search Implementation

### Hybrid Search Query

```sql
-- Hybrid search combining FTS and semantic
WITH semantic_results AS (
    SELECT 
        id,
        1 - (embedding <=> $1::vector) AS semantic_score
    FROM documents
    WHERE document_type = ANY($2)
    ORDER BY embedding <=> $1::vector
    LIMIT 50
),
keyword_results AS (
    SELECT 
        id,
        ts_rank(search_vector, websearch_to_tsquery('english', $3)) AS keyword_score
    FROM documents
    WHERE 
        document_type = ANY($2)
        AND search_vector @@ websearch_to_tsquery('english', $3)
    LIMIT 50
),
combined AS (
    SELECT 
        COALESCE(s.id, k.id) AS id,
        COALESCE(s.semantic_score, 0) * 0.5 + 
        COALESCE(k.keyword_score, 0) * 0.5 AS combined_score
    FROM semantic_results s
    FULL OUTER JOIN keyword_results k ON s.id = k.id
)
SELECT 
    d.id,
    d.external_id,
    d.title,
    ts_headline('english', d.content, websearch_to_tsquery('english', $3),
        'MaxWords=50, MinWords=20, StartSel=<b>, StopSel=</b>') AS snippet,
    d.url,
    d.document_type,
    d.attributes,
    c.combined_score AS score
FROM combined c
JOIN documents d ON c.id = d.id
ORDER BY c.combined_score DESC
LIMIT $4 OFFSET $5;
```

### Permission Filtering

Option 1: **Filter injection** (like legacy system)
```typescript
function buildPermissionFilter(userId: string, connectors: Connector[]): string {
  const clauses = connectors.map(c => {
    const groups = await getPermissionGroups(c, userId);
    return `(document_type = '${c.documentType}' AND permission_groups && ARRAY[${groups}])`;
  });
  return clauses.join(' OR ');
}
```

Option 2: **Row-Level Security**
```typescript
// Set session variable before query
await db.query(`SET app.user_groups = $1`, [userGroups]);
// RLS policy automatically filters
```

## Embedding Pipeline

```typescript
async function embedDocument(doc: Document): Promise<void> {
  // 1. Chunk the content
  const chunks = chunkText(doc.content, {
    maxTokens: 512,
    overlap: 50
  });
  
  // 2. Generate embeddings for chunks
  const embeddings = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks.map(c => c.text)
  });
  
  // 3. Store chunks with embeddings
  await db.transaction(async (tx) => {
    // Delete old chunks
    await tx.query('DELETE FROM chunks WHERE document_id = $1', [doc.id]);
    
    // Insert new chunks
    for (let i = 0; i < chunks.length; i++) {
      await tx.query(
        'INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)',
        [doc.id, i, chunks[i].text, embeddings.data[i].embedding]
      );
    }
    
    // Update document aggregate embedding (average of chunks)
    const avgEmbedding = averageEmbeddings(embeddings.data.map(e => e.embedding));
    await tx.query('UPDATE documents SET embedding = $1 WHERE id = $2', [avgEmbedding, doc.id]);
  });
}
```

## Sync Engine

```typescript
async function syncConnector(connector: Connector): Promise<SyncResult> {
  const result = { added: 0, updated: 0, removed: 0 };
  
  // 1. Get metadata from source
  const sourceMetadata = await fetchSourceMetadata(connector);
  // Map<externalId, lastModified>
  
  // 2. Get metadata from index
  const indexMetadata = await db.query(
    'SELECT external_id, last_modified FROM documents WHERE document_type = $1',
    [connector.documentType]
  );
  
  // 3. Diff
  const toAdd: string[] = [];
  const toUpdate: string[] = [];
  const toRemove: string[] = [];
  
  for (const [externalId, lastModified] of sourceMetadata) {
    const indexed = indexMetadata.get(externalId);
    if (!indexed) {
      toAdd.push(externalId);
    } else if (indexed.lastModified < lastModified) {
      toUpdate.push(externalId);
    }
  }
  
  for (const externalId of indexMetadata.keys()) {
    if (!sourceMetadata.has(externalId)) {
      toRemove.push(externalId);
    }
  }
  
  // 4. Fetch and index documents in batches
  const idsToFetch = [...toAdd, ...toUpdate];
  for (const batch of chunk(idsToFetch, 100)) {
    const docs = await fetchDocuments(connector, batch);
    await indexDocuments(docs);
    result.added += toAdd.filter(id => batch.includes(id)).length;
    result.updated += toUpdate.filter(id => batch.includes(id)).length;
  }
  
  // 5. Remove deleted documents
  if (toRemove.length > 0) {
    await removeDocuments(connector.documentType, toRemove);
    result.removed = toRemove.length;
  }
  
  return result;
}
```

## API Design

### REST Endpoints

```
GET  /api/search?q=query&types=kb,docs&limit=20
GET  /api/suggest?q=prefix&limit=10
POST /api/ask          { question, options }
GET  /api/documents/:id
GET  /api/connectors
POST /api/connectors
PUT  /api/connectors/:id
DELETE /api/connectors/:id
POST /api/connectors/:id/sync
GET  /api/connectors/:id/history
GET  /api/status
```

### GraphQL Schema (Alternative)

```graphql
type Query {
  search(query: SearchInput!): SearchResults!
  suggest(prefix: String!, limit: Int): [Suggestion!]!
  ask(question: String!, options: RAGOptions): RAGResponse!
  document(id: ID!): Document
  connectors: [Connector!]!
  connector(id: ID!): Connector
  status: SystemStatus!
}

type Mutation {
  createConnector(input: ConnectorInput!): Connector!
  updateConnector(id: ID!, input: ConnectorInput!): Connector!
  deleteConnector(id: ID!): Boolean!
  syncConnector(id: ID!): SyncJob!
}
```

## Caching Strategy

### Redis Usage

```typescript
const CACHE_TTL = {
  search: 60,           // 1 minute
  suggest: 300,         // 5 minutes
  permissions: 600,     // 10 minutes
  embeddings: 86400,    // 24 hours (expensive to compute)
};

// Search cache key
function searchCacheKey(query: SearchQuery): string {
  return `search:${hash(query)}`;
}

// Permission groups cache
function permissionsCacheKey(connectorId: string, userId: string): string {
  return `perms:${connectorId}:${userId}`;
}
```

### Invalidation

- Search cache: Invalidate on any index change
- Permissions: Invalidate on user/group change
- Embeddings: Don't cache in Redis (stored in DB)

## Deployment Options

### Docker Compose (Development)

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://knova:knova@db:5432/knova
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - db
      - redis

  db:
    image: pgvector/pgvector:pg16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: knova
      POSTGRES_USER: knova
      POSTGRES_PASSWORD: knova

  redis:
    image: redis:7-alpine
    volumes:
      - redis:/data

volumes:
  pgdata:
  redis:
```

### Production (Kubernetes)

- API: Deployment with HPA
- PostgreSQL: Managed (RDS/Cloud SQL) or StatefulSet
- Redis: Managed (ElastiCache) or StatefulSet
- Ingress: nginx with TLS
