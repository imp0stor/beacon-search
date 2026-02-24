# Migration Path: From Knova-lite to Beacon

This document outlines how to migrate from the legacy Java EJB system to the modern TypeScript implementation.

## Migration Strategy

We recommend a **parallel deployment** approach:
1. Deploy Beacon alongside legacy system
2. Migrate connectors one at a time
3. Validate results match
4. Switch traffic gradually
5. Decommission legacy when stable

**Do NOT attempt a direct data migration.** The schema is completely different, and you'll want fresh embeddings anyway.

## Phase 1: Environment Setup

### 1.1 Deploy Core Infrastructure

```bash
# Clone the project
git clone https://github.com/strangesignal/beacon-search.git
cd beacon-search

# Create .env file
cat > .env << EOF
DATABASE_URL=postgres://knova:your-password@localhost:5432/knova
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
PORT=3000
EOF

# Start with Docker Compose
docker compose up -d
```

### 1.2 Initialize Database

```bash
# Run migrations
npm run db:migrate

# Verify tables created
docker compose exec db psql -U knova -c '\dt'
```

### 1.3 Verify API is Running

```bash
curl http://localhost:3000/api/status
# Should return: {"status":"healthy","version":"0.1.0"}
```

## Phase 2: Connector Migration

### 2.1 Extract Legacy Connector Config

From the legacy system, export your `data_definitions` table:

```sql
-- Run on legacy database
SELECT 
    document_type,
    description,
    metadata_query,
    data_query,
    permission_query,
    permission_field,
    url_pattern,
    is_binary
FROM data_definitions
WHERE product_id = 'your-product';
```

### 2.2 Convert to Beacon Format

Legacy format:
```sql
-- Metadata query
SELECT article_id AS search_external_id, 
       modified_date AS search_last_modified 
FROM kb_articles

-- Data query
SELECT article_id AS search_external_id,
       modified_date AS search_last_modified,
       title AS search_title,
       body AS search_content,
       category AS attr_category
FROM kb_articles 
WHERE article_id IN ({IDS})
```

Modern format (JSON):
```json
{
  "name": "Knowledge Base Articles",
  "type": "postgresql",
  "documentType": "kb_article",
  "config": {
    "connectionString": "postgres://user:pass@legacy-db:5432/kb"
  },
  "metadataQuery": "SELECT article_id AS external_id, modified_date AS last_modified FROM kb_articles",
  "dataQuery": "SELECT article_id AS external_id, modified_date AS last_modified, title, body AS content, category AS attr_category FROM kb_articles WHERE article_id = ANY($1)",
  "permissionQuery": "SELECT group_id FROM user_groups WHERE user_id = $1",
  "permissionField": "permission_groups",
  "urlTemplate": "https://kb.example.com/article/{external_id}",
  "schedule": "0 */6 * * *"
}
```

**Key differences:**
- Field names changed: `search_*` → plain names
- `{IDS}` → `$1` (PostgreSQL parameter)
- `{USER}` → `$1` (PostgreSQL parameter)
- Added `schedule` for automatic sync
- Added `connectionString` for external database

### 2.3 Create Connector via API

```bash
curl -X POST http://localhost:3000/api/connectors \
  -H "Content-Type: application/json" \
  -d @connector.json
```

### 2.4 Test Connection

```bash
curl http://localhost:3000/api/connectors/{id}/test
```

### 2.5 Initial Sync

```bash
# Trigger manual sync
curl -X POST http://localhost:3000/api/connectors/{id}/sync

# Watch progress
curl http://localhost:3000/api/connectors/{id}/history | jq '.[0]'
```

### 2.6 Validate Results

Run the same search on both systems and compare:

```bash
# Legacy
curl "http://legacy:8080/knovalite/search/query/database%20migration?pageSize=10"

# Modern
curl "http://localhost:3000/api/search?q=database%20migration&limit=10"
```

Compare:
- Total result counts
- Top 10 results (order may differ due to semantic)
- Snippets and highlights

## Phase 3: Permission Migration

### 3.1 Verify Permission Queries Work

```bash
# Test permission resolution
curl "http://localhost:3000/api/debug/permissions?userId=jsmith&documentType=kb_article"
```

Expected response:
```json
{
  "userId": "jsmith",
  "documentType": "kb_article",
  "groups": ["engineering", "all-staff"]
}
```

### 3.2 Compare Permission Filtering

```bash
# Legacy (with user)
curl "http://legacy:8080/knovalite/search/query/secret?user=jsmith"

# Modern (with user header or token)
curl -H "X-User-Id: jsmith" "http://localhost:3000/api/search?q=secret"
```

Verify that both systems return the same documents (not more, not fewer).

## Phase 4: Binary Document Migration

If you have binary documents (PDFs, Word docs, etc.):

### 4.1 Legacy Approach
Legacy used Solr's content extraction (`/update/extract`) to index binary files.

### 4.2 Modern Approach
Options:
1. **Apache Tika service** — HTTP service for content extraction
2. **pdf-parse / mammoth** — Node.js libraries for PDF/Word
3. **External extraction pipeline** — Pre-extract content before indexing

Recommended approach for MVP:
```typescript
// Use Tika via HTTP
async function extractContent(binary: Buffer, filename: string): Promise<string> {
  const response = await fetch('http://tika:9998/tika', {
    method: 'PUT',
    body: binary,
    headers: { 'Accept': 'text/plain' }
  });
  return response.text();
}
```

Add Tika to docker-compose:
```yaml
services:
  tika:
    image: apache/tika:latest
    ports:
      - "9998:9998"
```

## Phase 5: UI Migration

### 5.1 Replace Search Widget

If you had the legacy search embedded in other apps:

Legacy JSF include:
```xhtml
<ui:include src="/knovalite/search.xhtml" />
```

Modern React component:
```tsx
import { KnovaSearch } from '@knova/react';

<KnovaSearch 
  endpoint="http://localhost:3000/api"
  documentTypes={['kb_article', 'wiki']}
  onSelect={(doc) => window.open(doc.url)}
/>
```

Or use the JavaScript embed:
```html
<script src="http://localhost:3000/embed.js"></script>
<div id="knova-search" data-types="kb_article,wiki"></div>
```

### 5.2 Admin Console

The new admin UI is at `http://localhost:3000/admin`.

Features:
- Connector management
- Sync status and history
- Search testing
- System health

## Phase 6: Traffic Cutover

### 6.1 Configure Load Balancer

Route based on header or gradual percentage:

```nginx
upstream knova {
    server beacon-search:3000 weight=10;
    server knova-legacy:8080 weight=0;  # Start at 0
}

server {
    location /search {
        proxy_pass http://knova;
    }
}
```

### 6.2 Gradual Rollout

1. **10%** — Monitor for errors
2. **50%** — Compare metrics
3. **90%** — Final validation
4. **100%** — Full cutover

### 6.3 Rollback Plan

```bash
# Immediately revert traffic
upstream knova {
    server beacon-search:3000 weight=0;
    server knova-legacy:8080 weight=10;
}
nginx -s reload
```

## Phase 7: Decommission Legacy

### 7.1 Remove from Load Balancer

```nginx
upstream knova {
    server beacon-search:3000;
}
```

### 7.2 Stop Legacy Services

```bash
# Stop WildFly
systemctl stop wildfly

# Stop Solr
systemctl stop solr
```

### 7.3 Archive Data (Optional)

```bash
# Export Solr data for archive
curl "http://solr:8983/solr/knova/select?q=*:*&rows=1000000&wt=json" > solr-archive.json

# Backup legacy database
pg_dump legacy_db > legacy-backup.sql
```

### 7.4 Update Documentation

- Remove references to legacy endpoints
- Update integration guides
- Notify consuming applications

## Appendix: Field Mapping Reference

| Legacy Field | Modern Field | Notes |
|--------------|--------------|-------|
| `search_external_id` | `external_id` | Primary key in source |
| `search_last_modified` | `last_modified` | Timestamp for sync |
| `search_title` | `title` | Document title |
| `search_content` | `content` | Full text content |
| `search_doc_type` | `document_type` | Type identifier |
| `search_snippet` | (computed) | Now generated at query time |
| `attr_*` | `attributes.*` | Custom attributes in JSONB |

## Appendix: Query Syntax Migration

| Legacy Syntax | Modern Syntax | Notes |
|---------------|---------------|-------|
| `word1 word2` | `word1 word2` | Same: AND by default |
| `"exact phrase"` | `"exact phrase"` | Same: phrase search |
| `field:value` | `attr.field:value` | Attribute prefix |
| `*wild*` | `*wild*` | Same: wildcards work |
| `-exclude` | `-exclude` | Same: NOT |
| `word1 OR word2` | `word1 OR word2` | Same: OR |

## Appendix: API Endpoint Mapping

| Legacy Endpoint | Modern Endpoint |
|-----------------|-----------------|
| `GET /search/query/{query}` | `GET /api/search?q={query}` |
| `GET /search/json/{query}` | `GET /api/search?q={query}` |
| `GET /search/config/{name}` | `GET /api/config/{name}` |
| `GET /search/status/{instance}` | `GET /api/connectors/{id}/history` |

## Troubleshooting

### Search returns no results

1. Check connector status: `GET /api/connectors/{id}`
2. Check sync history: `GET /api/connectors/{id}/history`
3. Check document count: `GET /api/stats`
4. Test with admin user (no permission filtering)

### Permission filtering too strict

1. Verify permission query returns groups
2. Check `permission_groups` array in document
3. Compare with legacy query results

### Embeddings not generated

1. Check OpenAI API key is set
2. Check API quota/billing
3. Fall back to keyword-only search
4. Use local model via Ollama
