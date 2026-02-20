# Beacon Search Administrator Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-12

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [User Management](#user-management)
4. [Source Management](#source-management)
5. [NLP Pipeline Configuration](#nlp-pipeline-configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

- **Docker** 20.10+ with Docker Compose v2
- **Minimum Hardware:**
  - 4 CPU cores
  - 8GB RAM (16GB recommended for production)
  - 50GB SSD storage
- **Network:** Ports 80, 443 (production) or 3000, 3001 (development)

### Quick Start (Development)

```bash
# Clone the repository
git clone https://github.com/your-org/beacon-search.git
cd beacon-search

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env  # Set POSTGRES_PASSWORD, OPENAI_API_KEY, etc.

# Start all services
docker-compose up -d

# Wait for services to initialize (~60 seconds)
# Then generate embeddings for demo data
curl -X POST http://localhost:3001/api/generate-embeddings

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

### Production Deployment

For production, use `docker-compose.prod.yml` with Caddy reverse proxy:

```bash
# Copy and configure environment
cp .env.example .env.prod
nano .env.prod

# Deploy with production compose file
docker-compose -f docker-compose.prod.yml up -d

# Run initial setup
./scripts/deploy.sh
```

See [docker-compose.prod.yml](../docker-compose.prod.yml) for full production configuration.

### Manual Installation (Without Docker)

#### 1. Install PostgreSQL with pgvector

```bash
# Ubuntu/Debian
sudo apt install postgresql-16 postgresql-16-pgvector

# Or compile from source
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

#### 2. Create Database

```bash
sudo -u postgres psql
CREATE USER beacon WITH PASSWORD 'your_secure_password';
CREATE DATABASE beacon_search OWNER beacon;
\c beacon_search
CREATE EXTENSION vector;
\q
```

#### 3. Initialize Schema

```bash
psql -U beacon -d beacon_search -f init.sql
```

#### 4. Install Node.js Backend

```bash
cd backend
npm install
npm run build

# Set environment variables
export DATABASE_URL="postgresql://beacon:password@localhost:5432/beacon_search"
export PORT=3001
export OPENAI_API_KEY="sk-..."

npm start
```

#### 5. Install React Frontend

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:3001 npm run build
npx serve -s build -l 3000
```

---

## Configuration

### Environment Variables

All configuration is managed via environment variables. Copy `.env.example` to `.env` and customize:

#### Core Settings

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `PORT` | Backend API port | `3001` | |
| `NODE_ENV` | Environment (`development`/`production`) | `development` | |

#### AI & Search

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key for RAG | - | For `/api/ask` |
| `OPENAI_MODEL` | Model for RAG responses | `gpt-4o-mini` | |

#### Processing Features

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_OCR` | Enable Tesseract.js OCR | `true` |
| `ENABLE_TRANSLATION` | Enable translation via OpenAI | `false` |
| `ENABLE_AI_DESCRIPTION` | Enable AI image/audio description | `false` |

#### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL for frontend | `http://localhost:3001` |

### Example .env File

```bash
# Database
DATABASE_URL=postgresql://beacon:secure_password_here@db:5432/beacon_search
POSTGRES_USER=beacon
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=beacon_search

# Backend
PORT=3001
NODE_ENV=production

# AI Features
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o-mini

# Processing
ENABLE_OCR=true
ENABLE_TRANSLATION=false
ENABLE_AI_DESCRIPTION=false

# Frontend
REACT_APP_API_URL=https://api.beacon.example.com
```

### Resource Limits

Configure Docker resource limits in `docker-compose.prod.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
        reservations:
          memory: 2G
          cpus: '1'
```

**Recommended limits:**
- **Database:** 1-2GB RAM, depends on index size
- **Backend:** 2-4GB RAM (embedding model uses ~1GB)
- **Frontend:** 256MB RAM
- **Redis:** 512MB RAM (if using caching)

---

## User Management

Beacon Search currently uses a simple, admin-centric model. Authentication is planned for v2.0.

### Current Access Model

- **All users** have read access to search and documents
- **API consumers** can index documents via POST endpoints
- **Administrators** have full CRUD access

### API Key Authentication (Recommended for Production)

Add API key middleware to protect write endpoints:

```typescript
// Add to backend/src/index.ts
const API_KEY = process.env.ADMIN_API_KEY;

app.use('/api', (req, res, next) => {
  // Allow read endpoints without auth
  if (req.method === 'GET') return next();
  
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});
```

Set `ADMIN_API_KEY` in your environment.

### Permission Groups (Document-Level)

Documents support permission filtering via the `permission_groups` field:

```bash
# Index a document with permission groups
curl -X POST http://localhost:3001/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Confidential Report",
    "content": "...",
    "permission_groups": ["engineering", "leadership"]
  }'
```

Query with permission filtering:

```sql
SELECT * FROM documents
WHERE permission_groups = '{}'  -- Public documents
   OR permission_groups && ARRAY['engineering']::text[]  -- User has access
```

### Planned Features (v2.0)

- [ ] OAuth2 / OIDC integration (Google, Microsoft, Okta)
- [ ] Role-based access control (Admin, Editor, Viewer)
- [ ] Per-source permissions
- [ ] Audit logging

---

## Source Management

### Source Types

Beacon Search supports three connector types:

| Type | Description | Use Case |
|------|-------------|----------|
| `web` | Web spider/crawler | Index websites, documentation sites |
| `folder` | Local file system | Index local documents, PDFs, markdown |
| `sql` | Database connector | Index data from PostgreSQL, MySQL |

### Creating a Web Spider

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Docs",
    "description": "Documentation website",
    "connector_type": "web",
    "config": {
      "type": "web",
      "seedUrl": "https://docs.company.com",
      "maxDepth": 3,
      "maxPages": 500,
      "sameDomainOnly": true,
      "respectRobotsTxt": true,
      "rateLimit": 1000,
      "includePatterns": [".*\\/docs\\/.*"],
      "excludePatterns": [".*\\/api\\/.*", ".*\\.pdf$"]
    },
    "portal_url": "https://docs.company.com",
    "item_url_template": "{url}",
    "search_url_template": "https://docs.company.com/search?q={query}"
  }'
```

#### Web Spider Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `seedUrl` | string | Starting URL | Required |
| `maxDepth` | number | Maximum link depth | `2` |
| `maxPages` | number | Maximum pages to crawl | `100` |
| `sameDomainOnly` | boolean | Stay on same domain | `true` |
| `respectRobotsTxt` | boolean | Honor robots.txt | `true` |
| `rateLimit` | number | Delay between requests (ms) | `1000` |
| `includePatterns` | string[] | URL regex patterns to include | `[]` |
| `excludePatterns` | string[] | URL regex patterns to exclude | `[]` |

### Creating a Folder Connector

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering Wiki",
    "description": "Local markdown files",
    "connector_type": "folder",
    "config": {
      "type": "folder",
      "folderPath": "/data/wiki",
      "recursive": true,
      "fileTypes": [".md", ".txt", ".pdf", ".docx", ".html"],
      "watchForChanges": true,
      "excludePatterns": ["node_modules/**", "*.tmp"]
    }
  }'
```

#### Folder Connector Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `folderPath` | string | Path to folder | Required |
| `recursive` | boolean | Scan subfolders | `true` |
| `fileTypes` | string[] | File extensions to process | `[".txt", ".md", ".html"]` |
| `watchForChanges` | boolean | Real-time file watching | `false` |
| `excludePatterns` | string[] | Glob patterns to exclude | `[]` |

### Running Connectors

```bash
# Start a connector run
curl -X POST http://localhost:3001/api/connectors/{id}/run

# Check status
curl http://localhost:3001/api/connectors/{id}/status

# Stop a running connector
curl -X POST http://localhost:3001/api/connectors/{id}/stop

# View run history
curl http://localhost:3001/api/connectors/{id}/history
```

### Scheduling Syncs

Use cron to schedule periodic syncs:

```bash
# /etc/cron.d/beacon-search
# Run documentation sync every 6 hours
0 */6 * * * curl -X POST http://localhost:3001/api/connectors/{doc-connector-id}/run

# Run wiki sync daily at 2 AM
0 2 * * * curl -X POST http://localhost:3001/api/connectors/{wiki-connector-id}/run
```

### Managing Integrations

For pre-configured integrations (Notion, Slack, Jira, etc.), see [INTEGRATIONS.md](./INTEGRATIONS.md).

Each integration is defined via YAML templates:

```yaml
# integrations/enterprise/notion.yaml
name: "Notion"
type: "rest"
auth:
  type: "oauth2"
  ...
endpoints:
  list_items: ...
  get_item: ...
```

---

## NLP Pipeline Configuration

### Auto-Processing Features

| Feature | Description | Toggle |
|---------|-------------|--------|
| **TF-IDF Tagging** | Auto-extract keywords | Always on |
| **NER** | Extract people, places, orgs | Always on |
| **Sentiment** | Analyze document sentiment | Always on |
| **OCR** | Extract text from images | `ENABLE_OCR` |
| **Translation** | Translate non-English content | `ENABLE_TRANSLATION` |
| **AI Description** | Describe images/audio | `ENABLE_AI_DESCRIPTION` |

### Training the TF-IDF Model

The TF-IDF model needs corpus training for optimal keyword extraction:

```bash
# Train on all indexed documents
curl -X POST http://localhost:3001/api/nlp/train

# Response
{
  "message": "TF-IDF model trained",
  "documentCount": 1234,
  "vocabularySize": 5678
}
```

Re-train periodically after adding significant content.

### Batch NLP Processing

Process NLP for all unprocessed documents:

```bash
curl -X POST http://localhost:3001/api/nlp/process-all

# Response
{
  "message": "NLP processing started",
  "queuedDocuments": 150
}
```

### Custom Dictionary

Add domain-specific terms to improve search:

```bash
# Add acronym expansion
curl -X POST http://localhost:3001/api/dictionary \
  -H "Content-Type: application/json" \
  -d '{
    "term": "API",
    "synonyms": ["interface", "endpoint"],
    "acronym_for": "Application Programming Interface",
    "domain": "technology",
    "boost_weight": 1.5
  }'
```

### Custom Ontology

Build hierarchical term relationships:

```bash
# Create parent term
curl -X POST http://localhost:3001/api/ontology \
  -H "Content-Type: application/json" \
  -d '{
    "term": "Programming Language",
    "description": "Languages for software development",
    "synonyms": ["coding language", "development language"]
  }'

# Create child term
curl -X POST http://localhost:3001/api/ontology \
  -H "Content-Type: application/json" \
  -d '{
    "term": "JavaScript",
    "parent_id": "{parent-id}",
    "synonyms": ["JS", "ECMAScript"]
  }'
```

Now searching for "programming language" will also match documents about JavaScript.

### Search Triggers

Create triggers for query-time behavior:

```bash
# Boost KB articles for "how to" queries
curl -X POST http://localhost:3001/api/triggers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "How-to Boost",
    "pattern": "^how (to|do|can)",
    "actions": {
      "boost_doc_type": "kb_article",
      "inject_terms": ["guide", "tutorial"]
    },
    "priority": 10,
    "enabled": true
  }'
```

---

## Monitoring & Maintenance

### Health Check Endpoint

```bash
curl http://localhost:3001/health

# Response
{
  "status": "ok",
  "timestamp": "2026-02-12T14:30:00Z",
  "checks": {
    "database": { "status": "ok", "latency": 5 },
    "embedding": { "status": "ok", "latency": 0 }
  }
}
```

### Stats Endpoint

```bash
curl http://localhost:3001/api/stats

# Response
{
  "totalDocuments": 5432,
  "totalConnectors": 8,
  "ontologyTerms": 156,
  "dictionaryEntries": 89,
  "activeTriggers": 12,
  "sourceStats": [
    { "id": "...", "name": "Docs Site", "connector_type": "web", "document_count": 2100 },
    { "id": "...", "name": "Wiki", "connector_type": "folder", "document_count": 850 }
  ]
}
```

### Webhook Monitoring

Monitor webhook deliveries:

```bash
# List webhooks
curl http://localhost:3001/api/webhooks

# View delivery history
curl http://localhost:3001/api/webhooks/{id}/deliveries?limit=50

# Retry failed delivery
curl -X POST http://localhost:3001/api/webhooks/deliveries/{delivery-id}/retry
```

### Database Maintenance

```bash
# Vacuum and analyze (run weekly)
docker exec beacon-db psql -U beacon -d beacon_search -c "VACUUM ANALYZE;"

# Rebuild vector index (after bulk indexing)
docker exec beacon-db psql -U beacon -d beacon_search -c "REINDEX INDEX idx_documents_embedding;"

# Check index health
docker exec beacon-db psql -U beacon -d beacon_search -c "
SELECT indexrelname, idx_scan, idx_tup_read 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public';"
```

### Backup & Restore

```bash
# Backup
docker exec beacon-db pg_dump -U beacon beacon_search > backup.sql

# Restore
cat backup.sql | docker exec -i beacon-db psql -U beacon beacon_search
```

### Log Management

```bash
# View backend logs
docker logs beacon-backend -f --tail 100

# View database logs
docker logs beacon-db -f --tail 100

# Export logs
docker logs beacon-backend > /var/log/beacon/backend.log 2>&1
```

---

## Troubleshooting

### Common Issues

#### "Embedding model not loaded"

The embedding model loads on first use (~30s). If it fails:

```bash
# Check backend logs
docker logs beacon-backend | grep -i embedding

# Ensure /tmp is writable (model cache)
docker exec beacon-backend ls -la /tmp/transformers-cache
```

#### "Database connection refused"

```bash
# Check database is running
docker ps | grep beacon-db

# Test connection
docker exec beacon-db pg_isready -U beacon -d beacon_search

# Check connection string
echo $DATABASE_URL
```

#### "Search returns no results"

```bash
# Check documents exist
curl http://localhost:3001/api/documents | jq '.length'

# Check embeddings are generated
docker exec beacon-db psql -U beacon -d beacon_search -c \
  "SELECT COUNT(*) FROM documents WHERE embedding IS NULL;"

# Generate missing embeddings
curl -X POST http://localhost:3001/api/generate-embeddings
```

#### "Connector stuck in 'running' state"

```bash
# Force stop
curl -X POST http://localhost:3001/api/connectors/{id}/stop

# Check for zombie processes
docker exec beacon-backend ps aux

# Restart backend
docker restart beacon-backend
```

#### "Out of memory"

```bash
# Check memory usage
docker stats

# Increase backend memory limit
# Edit docker-compose.prod.yml:
#   backend.deploy.resources.limits.memory: 6G

# Or reduce batch sizes in connector configs
```

### Getting Help

- **GitHub Issues:** Report bugs and feature requests
- **Documentation:** [docs/](../docs/)
- **API Reference:** [API-REFERENCE.md](./API-REFERENCE.md)
- **Integration Catalog:** [INTEGRATIONS.md](./INTEGRATIONS.md)

---

## Appendix: Database Schema Reference

### Core Tables

| Table | Description |
|-------|-------------|
| `documents` | Indexed documents with embeddings |
| `connectors` | Source connector configurations |
| `connector_runs` | Connector execution history |
| `webhooks` | Webhook subscriptions |
| `webhook_deliveries` | Webhook delivery log |
| `ontology` | Hierarchical term taxonomy |
| `dictionary` | Synonym and acronym mappings |
| `triggers` | Query-time search modifiers |
| `document_processing` | AI processing metadata |

### Key Indexes

| Index | Purpose |
|-------|---------|
| `idx_documents_embedding` | Vector similarity search (IVFFlat) |
| `idx_documents_content` | Full-text search (GIN) |
| `idx_documents_source` | Filter by source |
| `idx_documents_permissions` | Permission filtering |

For full schema, see [init.sql](../init.sql).
