# Beacon Search - Quick Start Guide

**For developers and admins who want to get Beacon Search running quickly.**

---

## TL;DR - I Just Want It Running

```bash
# Prerequisites: Docker installed

cd ~/strangesignal/projects/beacon-search
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY

# Start everything
docker-compose up -d

# Wait 30 seconds for embedding model to load, then:
curl http://localhost:3001/health
# Should return: {"status":"ok"}

# Access the app
open http://localhost:3000  # Search UI
open http://localhost:3000/admin  # Admin UI
```

**That's it! 🎉**

---

## What You Get

### Search UI (http://localhost:3000)
- **Search bar** - Type queries like "machine learning basics"
- **Mode selector** - Hybrid (best), Vector (semantic), Text (keyword)
- **Facet filters** - Filter by tags, entities, document types
- **Document cards** - Title, snippet, metadata, source links

### Admin UI (http://localhost:3000/admin)
- **Dashboard** - Stats, charts, recent activity
- **Data Sources** - Manage connectors (SQL, web spider, folder)
- **Documents** - Browse, edit, delete documents
- **Ontology** - Manage hierarchical terms
- **Dictionary** - Define synonyms, acronyms
- **Webhooks** - Configure event notifications
- **Triggers** - Set up automation rules

### API (http://localhost:3001)
Full REST API for programmatic access (see API-REFERENCE.md)

---

## First Steps After Install

### 1. Add Some Documents

**Option A: Via API**
```bash
curl -X POST http://localhost:3001/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with AI",
    "content": "Artificial intelligence is transforming how we build software...",
    "url": "https://example.com/ai-guide"
  }'
```

**Option B: Via Web Crawler**
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Docs",
    "connector_type": "web",
    "config": {
      "seedUrl": "https://docs.yourcompany.com",
      "maxDepth": 3,
      "maxPages": 100,
      "sameDomainOnly": true
    }
  }'

# Get the connector ID from the response, then run it:
curl -X POST http://localhost:3001/api/connectors/<ID>/run
```

**Option C: Via Folder Scanner**
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Docs",
    "connector_type": "folder",
    "config": {
      "folderPath": "/path/to/documents",
      "recursive": true,
      "fileTypes": [".txt", ".md", ".pdf", ".docx"]
    }
  }'
```

### 2. Try a Search

```bash
# Hybrid search (best results)
curl "http://localhost:3001/api/search?q=machine+learning&mode=hybrid&limit=5"

# Pure semantic search
curl "http://localhost:3001/api/search?q=AI+ethics&mode=vector"

# Keyword search
curl "http://localhost:3001/api/search?q=neural+networks&mode=text"
```

### 3. Ask Questions (RAG)

Requires `OPENAI_API_KEY` in .env:

```bash
curl -X POST http://localhost:3001/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does machine learning work?",
    "limit": 5
  }'
```

Returns an AI-generated answer based on your indexed documents!

---

## Common Configuration

### Enable Advanced Features

Edit `.env`:

```bash
# OCR for images/PDFs (enabled by default)
ENABLE_OCR=true

# Translation (requires Ollama or LibreTranslate)
ENABLE_TRANSLATION=true
OLLAMA_URL=http://localhost:11434

# AI image descriptions (requires Ollama with vision model)
ENABLE_AI_DESCRIPTION=true
OLLAMA_VISION_MODEL=llava

# Processing features
ENABLE_AUDIO_TRANSCRIPTION=true
WHISPER_PROVIDER=local  # or 'openai'
```

Restart after changes:
```bash
docker-compose restart backend
```

### Configure Ontology

Add hierarchical terms via API or Admin UI:

```bash
curl -X POST http://localhost:3001/api/ontology \
  -H "Content-Type: application/json" \
  -d '{
    "term": "Machine Learning",
    "parent_id": null,
    "description": "AI systems that learn from data"
  }'

curl -X POST http://localhost:3001/api/ontology \
  -H "Content-Type: application/json" \
  -d '{
    "term": "Neural Networks",
    "parent_id": "<ML_ID>",
    "synonyms": ["Deep Learning", "Artificial Neural Networks"]
  }'
```

### Set Up Webhooks

Get notified when documents are indexed:

```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Document Indexer",
    "url": "https://yourapp.com/webhook",
    "events": ["document.created", "document.updated"],
    "enabled": true
  }'
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Database not ready - wait 30 seconds and retry
# 2. Embedding model downloading - first run takes 1-2 minutes
# 3. Out of memory - increase Docker memory to 4GB+
```

### "OpenAI API key not configured"
Add to `.env`:
```bash
OPENAI_API_KEY=sk-your-actual-key-here
```
Then restart:
```bash
docker-compose restart backend
```

### Search returns no results
1. Check if documents exist:
   ```bash
   curl http://localhost:3001/api/stats
   ```
2. Generate embeddings if missing:
   ```bash
   curl -X POST http://localhost:3001/api/generate-embeddings
   ```

### Frontend can't reach backend
Check `REACT_APP_API_URL` in `.env`:
```bash
REACT_APP_API_URL=http://localhost:3001
```
Rebuild frontend:
```bash
docker-compose up -d --build frontend
```

---

## Production Deployment

See [DEPLOY.md](./DEPLOY.md) for full production guide.

**Quick production setup:**

1. **Get a server** with Docker (4GB+ RAM, 2+ CPUs)

2. **Configure domain**
   ```bash
   # In Caddyfile
   yourdomain.com {
       reverse_proxy frontend:80
   }
   
   api.yourdomain.com {
       reverse_proxy backend:3001
   }
   ```

3. **Update .env for production**
   ```bash
   POSTGRES_PASSWORD=super-secret-random-password
   OPENAI_API_KEY=sk-real-key-here
   REACT_APP_API_URL=https://api.yourdomain.com
   ```

4. **Deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ./scripts/deploy.sh --migrate
   ```

5. **Verify**
   ```bash
   curl https://api.yourdomain.com/health
   # Should return: {"status":"ok"}
   ```

**Caddy handles SSL automatically via Let's Encrypt!** 🔒

---

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Restart a service
docker-compose restart backend

# Rebuild and restart
docker-compose up -d --build backend

# Stop everything
docker-compose down

# Stop and remove data (⚠️ destructive)
docker-compose down -v

# Backup database
docker exec beacon-db pg_dump -U beacon beacon_search > backup.sql

# Restore database
cat backup.sql | docker exec -i beacon-db psql -U beacon -d beacon_search

# Check service health
docker-compose ps
curl http://localhost:3001/health

# Run deployment script with health checks
./scripts/deploy.sh --build --migrate
```

---

## Example Workflows

### Index a Documentation Site
```bash
# 1. Create web spider connector
CONNECTOR_ID=$(curl -s -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "React Docs",
    "connector_type": "web",
    "config": {
      "seedUrl": "https://react.dev/learn",
      "maxDepth": 2,
      "maxPages": 50
    }
  }' | jq -r '.id')

# 2. Run the connector
curl -X POST http://localhost:3001/api/connectors/$CONNECTOR_ID/run

# 3. Monitor progress
watch -n 2 "curl -s http://localhost:3001/api/connectors/$CONNECTOR_ID/status | jq"

# 4. Search the indexed docs
curl "http://localhost:3001/api/search?q=hooks&mode=hybrid" | jq '.results[].title'
```

### Set Up Scheduled Indexing
```bash
# Add cron job to re-index daily
crontab -e

# Add line:
0 2 * * * curl -X POST http://localhost:3001/api/connectors/<ID>/run
```

### Build a Custom Search UI
```javascript
// Simple search integration
async function search(query) {
  const response = await fetch(
    `http://localhost:3001/api/search?q=${encodeURIComponent(query)}&mode=hybrid&limit=10`
  );
  const data = await response.json();
  return data.results;
}

// Usage
const results = await search('machine learning');
console.log(results);
```

---

## Next Steps

1. **Read the docs:**
   - [API-REFERENCE.md](./docs/API-REFERENCE.md) - Full API documentation
   - [USER-GUIDE.md](./docs/USER-GUIDE.md) - End-user guide
   - [ADMIN-GUIDE.md](./docs/ADMIN-GUIDE.md) - Admin guide

2. **Explore features:**
   - Set up connectors for your data sources
   - Configure ontology and dictionary
   - Create webhooks for integrations
   - Set up triggers for automation

3. **Customize:**
   - Frontend: Edit `frontend/src/App.js`
   - Backend: Add custom routes in `backend/src/routes/`
   - Styling: Modify `frontend/src/App.css`

4. **Scale:**
   - Add more backend replicas for high load
   - Configure database read replicas
   - Set up Redis caching
   - Enable Typesense for faster full-text search

---

**Questions?** Check [STATUS.md](./STATUS.md) for detailed project information.

**Issues?** Review [FIXES-APPLIED.md](./FIXES-APPLIED.md) for recent changes.

**Need help?** The codebase is well-commented - dive into the source!
