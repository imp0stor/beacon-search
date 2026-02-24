# Beacon Search MVP

A semantic search platform powered by PostgreSQL + pgvector, Transformers.js, and a comprehensive NLP pipeline.

## Features

- **Hybrid Search**: Combines vector similarity and full-text search
- **Vector Search**: Pure semantic similarity using embeddings
- **Text Search**: Traditional PostgreSQL full-text search
- **Faceted Search**: Filter by tags, entities, sentiment, and more
- **Real-time Indexing**: Add documents with automatic embedding generation
- **Nostr Integration**: ⚡ **NEW!** Index and search Nostr events (Q&A, KB, Podcasts, Bounties)
- **Web Spider Connector**: Crawl websites and index their content
- **Folder Connector**: Index local files (txt, md, pdf, docx, html)
- **NLP Pipeline**: Auto-tagging, NER, metadata extraction, relationship mapping
- **Admin UI**: Manage connectors with progress tracking
- **Modern UI**: Clean React interface with dark theme and facet sidebar

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL 16 with pgvector extension
- **Embeddings**: Transformers.js (all-MiniLM-L6-v2 model)
- **Frontend**: React 18
- **Deployment**: Docker Compose

## Quick Start

```bash
# Start all services
docker-compose up --build

# Wait for services to start, then generate embeddings for seed data
curl -X POST http://localhost:3001/api/generate-embeddings
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:3001

## Runtime Verification (P1)

```bash
# From repo root
cd backend && npm run build && npm test
cd ../frontend && npm run build
cd ..

# Runs integration checks; auto-starts db+backend via docker if needed
BOOTSTRAP_DOCKER=true ./test-p1-features.sh
```

Notes:
- `test-p1-features.sh` checks `http://localhost:3001` by default.
- `BOOTSTRAP_DOCKER=true` requires Docker and uses `docker-compose.yml` unless `COMPOSE_FILE` is set.
- If default ports are occupied, set `DB_PORT`, `BACKEND_PORT`, `FRONTEND_PORT` before running.
- DB credentials are aligned via `.env`/`.env.example` and compose defaults: `beacon / beacon_secret / beacon_search`.

## Connectors

### ⚡ Nostr Connector
Index Nostr events from relay pools:
- Supports all major event kinds (Q&A, KB, Podcasts, Bounties, Studios)
- One-time sync or live subscription mode
- Filter by kinds, authors, tags, and time ranges
- WoT-weighted search and ranking
- Custom event type templates

**See [NOSTR_INTEGRATION.md](./NOSTR_INTEGRATION.md) for full documentation**

**Quick Start:**
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr Q&A",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io", "wss://nos.lol"],
      "kinds": [30400, 6400],
      "limit": 1000
    }
  }'
```

### Web Spider Connector
Crawl websites starting from a seed URL:
- Configurable crawl depth and max pages
- Same-domain restriction option
- Respects robots.txt
- Rate limiting to avoid hammering servers
- Extracts title, content, and links
- Progress tracking with current URL

### Folder/File Connector
Index local folders and files:
- Recursive folder scanning
- Supports: `.txt`, `.md`, `.pdf`, `.docx`, `.html`
- Optional file watching for real-time updates
- Extracts text from PDFs and Word documents

### Creating a Connector

**Via UI**: Click the "🔌 Connectors" button in the sidebar

**Via API**:
```bash
# Create a web spider connector
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Documentation Crawler",
    "description": "Crawls our docs site",
    "config": {
      "type": "web",
      "seedUrl": "https://docs.example.com",
      "maxDepth": 2,
      "maxPages": 100,
      "sameDomainOnly": true,
      "respectRobotsTxt": true,
      "rateLimit": 1000
    }
  }'

# Create a folder connector
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Documents",
    "config": {
      "type": "folder",
      "folderPath": "/data/documents",
      "recursive": true,
      "fileTypes": [".txt", ".md", ".pdf", ".docx"],
      "watchForChanges": false
    }
  }'

# Run a connector
curl -X POST http://localhost:3001/api/connectors/:id/run

# Check status
curl http://localhost:3001/api/connectors/:id/status

# Stop a running connector
curl -X POST http://localhost:3001/api/connectors/:id/stop
```

## API Endpoints

### Search
```bash
GET /api/search?q=<query>&mode=<hybrid|vector|text>&limit=10&sourceId=<connector-id>
```

### Documents
```bash
# List all documents
GET /api/documents

# Add a document (auto-generates embedding)
POST /api/documents
Content-Type: application/json
{
  "title": "Document Title",
  "content": "Document content...",
  "url": "https://example.com" (optional)
}

# Delete a document
DELETE /api/documents/:id

# Generate embeddings for documents without them
POST /api/generate-embeddings
```

### Connectors
```bash
# List all connectors
GET /api/connectors

# Get a connector
GET /api/connectors/:id

# Create a connector
POST /api/connectors

# Update a connector
PUT /api/connectors/:id

# Delete a connector
DELETE /api/connectors/:id

# Run a connector
POST /api/connectors/:id/run

# Stop a running connector
POST /api/connectors/:id/stop

# Get run status
GET /api/connectors/:id/status

# Get run history
GET /api/connectors/:id/history
```

### Stats
```bash
GET /api/stats
# Returns document count, connector count, and per-source document counts
```

## Search Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **Hybrid** | 70% vector + 30% text relevance | General use, best results |
| **Vector** | Pure semantic similarity | Finding conceptually similar content |
| **Text** | PostgreSQL full-text search | Exact keyword matching |

## Development

```bash
# Backend only
cd backend
npm install
npm run dev

# Frontend only  
cd frontend
npm install
npm start

# Database only
docker-compose up db
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   React     │────▶│   Express   │────▶│   PostgreSQL    │
│   Frontend  │     │   Backend   │     │   + pgvector    │
└─────────────┘     └─────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Transformers│
                    │     .js     │
                    │             │
                    │ Connectors: │
                    │ - Web Spider│
                    │ - Folder    │
                    └─────────────┘
```

## Demo Data

The database is seeded with 5 sample documents about:
- Vector Search
- pgvector Guide
- Building Search Engines
- Machine Learning Basics
- Natural Language Processing

Try searching for: "how do search engines work" or "AI and machine learning"

## AI-Powered Content Extraction

Beacon Search includes advanced AI processing capabilities for extracting text from images, translating content, and generating descriptions for media files.

### Processing Endpoints

```bash
# Check processing service status
GET /api/process/status

# OCR an image or PDF
POST /api/process/ocr
# Form data: file (upload), or body: { base64: "...", language: "eng" }

# Translate text
POST /api/process/translate
# Body: { text: "Hallo Welt", targetLanguage: "en" }

# Detect language
POST /api/process/detect-language
# Body: { text: "Bonjour le monde" }

# Generate AI description for image/audio
POST /api/process/describe
# Form data: file (upload), or body: { base64: "...", detailed: true }

# Full pipeline processing for a file
POST /api/process/file
# Form data: file (upload), or body: { path: "/path/to/file" }

# Process text (detect language + translate)
POST /api/process/text
# Body: { text: "Content to process" }
```

### Processing Features

| Feature | Provider | Description |
|---------|----------|-------------|
| **OCR** | Tesseract.js | Extract text from images and scanned PDFs |
| **Translation** | Ollama/LibreTranslate | Translate non-English content to English |
| **Language Detection** | franc | Automatically detect source language |
| **Image Description** | Ollama (llava) | Generate AI descriptions of images |
| **Audio Transcription** | Whisper (local) | Transcribe audio files to text |

### Configuration

Set via environment variables:

```bash
# OCR
OCR_ENABLED=true
OCR_LANGUAGE=eng

# Translation
TRANSLATION_ENABLED=true
TRANSLATION_PROVIDER=ollama  # ollama, libretranslate, or none
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# AI Description
AI_DESCRIPTION_ENABLED=true
OLLAMA_VISION_MODEL=llava

# Media Processing
MEDIA_PROCESSING_ENABLED=true
WHISPER_PROVIDER=local  # local or openai

# General
AUTO_PROCESS=true  # Auto-process uploaded files
MAX_FILE_SIZE_MB=100
```

### Supported File Types

- **Images**: .jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff
- **Documents**: .pdf (text extraction + OCR fallback)
- **Audio**: .mp3, .wav, .m4a, .ogg, .flac
- **Video**: .mp4, .mkv, .avi, .mov, .webm (requires ffmpeg)

### Auto-Processing Pipeline

When a file is uploaded:
1. **Content Type Detection** - Determine file type
2. **Text Extraction** - OCR for images, parse for documents
3. **Language Detection** - Identify source language using franc
4. **Translation** - Translate non-English content to English
5. **AI Description** - Generate descriptions for media files
6. **Embedding Generation** - Create vector embedding for search

## New Features

### Web Spider Configuration
| Option | Description | Default |
|--------|-------------|---------|
| `seedUrl` | Starting URL for the crawl | Required |
| `maxDepth` | Maximum link depth to follow | 2 |
| `maxPages` | Maximum pages to crawl | 100 |
| `sameDomainOnly` | Only crawl links on same domain | true |
| `respectRobotsTxt` | Honor robots.txt rules | true |
| `rateLimit` | Milliseconds between requests | 1000 |
| `includePatterns` | Regex patterns for URLs to include | [] |
| `excludePatterns` | Regex patterns for URLs to exclude | [] |

### Folder Connector Configuration
| Option | Description | Default |
|--------|-------------|---------|
| `folderPath` | Path to folder to scan | Required |
| `recursive` | Scan subfolders | true |
| `fileTypes` | File extensions to process | [".txt", ".md", ".html"] |
| `watchForChanges` | Enable real-time file watching | false |
| `excludePatterns` | Glob patterns to exclude | [] |

### Required Dependencies for Full File Support
```bash
# For PDF support
npm install pdf-parse

# For DOCX support  
npm install mammoth

# For file watching
npm install chokidar
```

All three are already included in package.json.

### AI Processing Dependencies
```bash
# OCR
npm install tesseract.js sharp

# Translation & Language Detection
npm install franc iso-639-3

# Media Processing
npm install @xenova/transformers  # Whisper for audio
npm install fluent-ffmpeg         # Video frame extraction

# File Upload
npm install multer
```

All AI processing dependencies are included in package.json.

## NLP Pipeline

Beacon Search includes a comprehensive NLP pipeline that runs locally without external API calls.

### Auto-Tagging
- **TF-IDF Keyword Extraction**: Identifies important terms based on corpus statistics
- **RAKE Algorithm**: Extracts multi-word keyword phrases
- **Topic Classification**: Categorizes documents (Technology, Business, Science, Health, etc.)
- **Manual Tags**: Users can add/edit tags via the UI

### Named Entity Recognition (NER)
Extracts entities using rule-based pattern matching:
- **PERSON**: Names (Dr. John Smith, Mary Jane)
- **ORGANIZATION**: Companies, institutions (Google Inc., MIT)
- **LOCATION**: Places, addresses (New York, California)
- **DATE**: Various formats (2024-01-15, January 15th 2024, last week)
- **MONEY**: Currency amounts ($1,234.56, 500 USD)
- **EMAIL**: Email addresses
- **PHONE**: Phone numbers
- **URL**: Web links

### Metadata Extraction
- **Reading Time**: Estimated minutes to read
- **Word Count**: Total words
- **Sentiment Analysis**: Positive/Negative/Neutral with confidence score
- **Document Classification**: article, documentation, email, legal, financial, academic, marketing, support
- **Author Detection**: Extracts bylines and author names
- **Content Analysis**: Detects code blocks, lists, tables, images

### Relationship Mapping
- Links documents sharing the same entities
- Builds entity graph for who/what/where connections
- "Related Documents" recommendations based on shared entities and tags
- Tag suggestions from similar documents

### NLP API Endpoints

```bash
# Process NLP for all unprocessed documents
POST /api/nlp/process-all

# Process NLP for a single document
POST /api/documents/:id/process-nlp

# Train TF-IDF model on corpus
POST /api/nlp/train

# Get NLP processing status
GET /api/nlp/status

# Get document tags
GET /api/documents/:id/tags

# Add manual tag
POST /api/documents/:id/tags
Content-Type: application/json
{"tag": "important"}

# Remove tag
DELETE /api/documents/:id/tags/:tag

# Get document entities
GET /api/documents/:id/entities

# Get document metadata
GET /api/documents/:id/metadata

# Get related documents
GET /api/documents/:id/related?limit=5

# Get tag suggestions
GET /api/documents/:id/tag-suggestions?limit=10

# Get all entities of a type
GET /api/entities/PERSON
GET /api/entities/ORGANIZATION
GET /api/entities/LOCATION

# Get search facets (for sidebar)
GET /api/search/facets

# Get tag cloud
GET /api/tags/cloud?limit=50

# Faceted search with filters
GET /api/search/filtered?q=<query>&tags=tag1,tag2&entityType=PERSON&entityValue=John&sentiment=positive
```

### Database Schema (NLP Tables)

```sql
-- Tags (auto and manual)
document_tags (document_id, tag, confidence, source, algorithm)

-- Named Entities
document_entities (document_id, entity_type, entity_value, normalized_value, position_start, position_end, confidence, context)

-- Extracted Metadata
document_metadata (document_id, meta_key, meta_value, meta_type, confidence, extracted_by)

-- Entity Relationships (for document linking)
entity_relationships (entity_type, normalized_value, document_ids[], document_count)

-- Processing Status
nlp_processing_status (document_id, tags_extracted, entities_extracted, metadata_extracted, relationships_updated)
```
