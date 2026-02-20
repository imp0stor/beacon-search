# Beacon Search - Developer Guide

**Version:** 2.0  
**Last Updated:** 2026-02-13  
**Audience:** Developers, Contributors, DevOps Engineers

---

## 📖 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Adding New Data Sources](#adding-new-data-sources)
4. [Content Type Taxonomy](#content-type-taxonomy)
5. [Spider Development](#spider-development)
6. [Plugin System](#plugin-system)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Testing Guide](#testing-guide)
10. [Deployment Guide](#deployment-guide)
11. [Performance Optimization](#performance-optimization)
12. [Contributing](#contributing)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     BEACON SEARCH                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───▶│   Backend    │───▶│   Database   │  │
│  │  (React 18)  │◀───│  (Express)   │◀───│(PostgreSQL)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   UI Kit     │    │   Plugins    │    │    Redis     │  │
│  │  (Tailwind)  │    │  (WoT, etc.) │    │   (Cache)    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                              │                               │
│                              ▼                               │
│                      ┌──────────────┐                        │
│                      │  Connectors  │                        │
│                      │  (Spiders)   │                        │
│                      └──────────────┘                        │
│                              │                               │
│         ┌────────────────────┼────────────────────┐          │
│         ▼                    ▼                    ▼          │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐     │
│  │  Nostr   │         │  GitHub  │         │   Docs   │     │
│  │  Relays  │         │   API    │         │  Sites   │     │
│  └──────────┘         └──────────┘         └──────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Nostr tools (NIP-07)

**Backend:**
- Node.js 20+
- Express
- TypeScript
- Transformers.js (embeddings)
- PostgreSQL client (pg)
- Redis client (ioredis)

**Database:**
- PostgreSQL 16 + pgvector
- Redis 7+

**Infrastructure:**
- Docker + Docker Compose
- Caddy (reverse proxy)

### Directory Structure

```
beacon-search/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Express app entry
│   │   ├── config/                  # Configuration
│   │   ├── db/                      # Database connection
│   │   ├── search/                  # Search engine
│   │   │   ├── embeddings.ts        # Transformers.js embeddings
│   │   │   ├── hybrid-search.ts     # Hybrid algorithm
│   │   │   └── query-parser.ts      # Query parsing
│   │   ├── connectors/              # Data source connectors
│   │   │   ├── base-connector.ts
│   │   │   ├── web-spider.ts
│   │   │   ├── folder-scanner.ts
│   │   │   ├── sql-connector.ts
│   │   │   └── nostr-connector.ts
│   │   ├── ingestion/               # Nostr ingestion system
│   │   │   ├── relay-manager.ts     # Relay health, NIP-11
│   │   │   ├── document-classifier.ts # Content type classification
│   │   │   ├── content-extractor.ts # Content extraction
│   │   │   ├── spam-filter.ts       # Anti-spam
│   │   │   └── pipeline.ts          # Orchestration
│   │   ├── plugins/                 # Plugin system
│   │   │   ├── types.ts             # Plugin interfaces
│   │   │   ├── manager.ts           # Plugin lifecycle
│   │   │   ├── index.ts             # Exports
│   │   │   ├── README.md            # Plugin docs
│   │   │   └── wot/                 # WoT plugin
│   │   │       ├── providers.ts     # WoT providers
│   │   │       ├── index.ts         # WoT plugin
│   │   │       └── README.md        # WoT docs
│   │   ├── nlp/                     # NLP pipeline
│   │   │   ├── tagging.ts
│   │   │   ├── ner.ts
│   │   │   └── sentiment.ts
│   │   ├── rag/                     # RAG system
│   │   │   ├── query-handler.ts
│   │   │   └── context-builder.ts
│   │   ├── routes/                  # API routes
│   │   │   ├── search.ts
│   │   │   ├── documents.ts
│   │   │   └── admin.ts
│   │   └── utils/                   # Utilities
│   ├── package.json
│   ├── tsconfig.json
│   ├── wot-config.example.json      # WoT config example
│   └── wot-config-local.example.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Main app
│   │   ├── components/
│   │   │   ├── Search.tsx           # Search interface
│   │   │   ├── SearchResult.tsx     # Expandable results
│   │   │   ├── NostrAuth.tsx        # NIP-07 login
│   │   │   ├── NostrActions.tsx     # Like/zap/repost
│   │   │   ├── ContentTypeFilter.tsx # Type filtering
│   │   │   └── WoTFilter.tsx        # WoT controls
│   │   ├── pages/
│   │   │   ├── SearchPage.tsx
│   │   │   └── AdminPage.tsx
│   │   ├── utils/
│   │   │   ├── nostr.ts             # Nostr helpers
│   │   │   └── api.ts               # API client
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── migrations/                      # Database migrations
│   ├── 001_initial.sql
│   ├── 002_nostr_events.sql
│   └── 003_unique_event_id.sql
├── scripts/
│   └── deploy.sh                    # Deployment script
├── docker-compose.prod.yml          # Production Docker Compose
├── Caddyfile                        # Reverse proxy config
├── init.sql                         # Initial database setup
└── test-nostr-e2e.sh               # E2E test script
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ with pgvector
- Redis 7+ (optional, for caching)
- Docker + Docker Compose (for production deployment)

### Local Development (Without Docker)

**1. Clone the repository:**
```bash
cd ~/strangesignal/projects/beacon-search
```

**2. Install dependencies:**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

**3. Setup PostgreSQL:**
```bash
# Create database
psql -U postgres -c "CREATE DATABASE beacon_search;"

# Install pgvector extension
psql -U postgres beacon_search -c "CREATE EXTENSION vector;"

# Run initial schema
psql -U postgres beacon_search < init.sql
```

**4. Configure environment:**
```bash
# Copy example .env
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Required environment variables:**
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/beacon_search

# Redis (optional)
REDIS_URL=redis://localhost:6379

# OpenAI (for RAG, optional)
OPENAI_API_KEY=sk-...

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# WoT Plugin (optional)
WOT_ENABLED=true
WOT_PROVIDER=local  # or 'nostrmaxi'
NOSTRMAXI_URL=http://localhost:3000  # if using NostrMaxi
WOT_WEIGHT=1.0
WOT_CACHE_TTL=3600
```

**5. Run development servers:**
```bash
# Backend (port 3001)
cd backend
npm run dev

# Frontend (port 3000)
cd frontend
npm run dev
```

**6. Access the app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

### Docker Development

**1. Build and start containers:**
```bash
docker compose up -d
```

**2. View logs:**
```bash
docker compose logs -f
```

**3. Access the app:**
- Frontend: http://localhost:3002
- Backend API: http://localhost:3001
- Database: localhost:5432

**4. Stop containers:**
```bash
docker compose down
```

---

## Adding New Data Sources

### Step 1: Create a Connector

**File:** `backend/src/connectors/github-connector.ts`

```typescript
import { BaseConnector, ConnectorConfig, Document } from './base-connector';

export interface GitHubConfig extends ConnectorConfig {
  github_token?: string;
  repositories?: string[];  // e.g., ["nostr-protocol/nostr"]
  include_issues?: boolean;
  include_prs?: boolean;
}

export class GitHubConnector extends BaseConnector {
  private token: string;
  private repos: string[];

  constructor(config: GitHubConfig) {
    super(config);
    this.token = config.github_token || process.env.GITHUB_TOKEN;
    this.repos = config.repositories || [];
  }

  async connect(): Promise<void> {
    // Test GitHub API connection
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API connection failed: ${response.statusText}`);
    }
    
    this.logger.info('GitHub connector connected');
  }

  async fetchDocuments(): Promise<Document[]> {
    const documents: Document[] = [];

    for (const repo of this.repos) {
      // Fetch repository info
      const repoDoc = await this.fetchRepository(repo);
      documents.push(repoDoc);

      // Fetch README
      const readmeDoc = await this.fetchReadme(repo);
      if (readmeDoc) documents.push(readmeDoc);

      // Fetch issues (if enabled)
      if (this.config.include_issues) {
        const issueDocs = await this.fetchIssues(repo);
        documents.push(...issueDocs);
      }

      // Fetch PRs (if enabled)
      if (this.config.include_prs) {
        const prDocs = await this.fetchPullRequests(repo);
        documents.push(...prDocs);
      }
    }

    return documents;
  }

  private async fetchRepository(repo: string): Promise<Document> {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const data = await response.json();

    return {
      title: data.name,
      content: data.description,
      source: 'github',
      source_url: data.html_url,
      content_type: 'github:repo',
      metadata: {
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        topics: data.topics
      }
    };
  }

  private async fetchReadme(repo: string): Promise<Document | null> {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/readme`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return {
      title: `${repo} - README`,
      content,
      source: 'github',
      source_url: data.html_url,
      content_type: 'github:readme',
      metadata: { repo, file: 'README.md' }
    };
  }

  private async fetchIssues(repo: string): Promise<Document[]> {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=all&per_page=100`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    const issues = await response.json();

    return issues.map(issue => ({
      title: issue.title,
      content: issue.body,
      source: 'github',
      source_url: issue.html_url,
      content_type: 'github:issue',
      metadata: {
        repo,
        number: issue.number,
        state: issue.state,
        labels: issue.labels.map(l => l.name)
      }
    }));
  }

  private async fetchPullRequests(repo: string): Promise<Document[]> {
    // Similar to fetchIssues
    // ...
  }

  async disconnect(): Promise<void> {
    this.logger.info('GitHub connector disconnected');
  }
}
```

### Step 2: Register the Connector

**File:** `backend/src/connectors/index.ts`

```typescript
import { GitHubConnector } from './github-connector';

export const ConnectorRegistry = {
  web: WebSpider,
  folder: FolderScanner,
  sql: SQLConnector,
  nostr: NostrConnector,
  github: GitHubConnector,  // NEW
};

export function createConnector(type: string, config: any) {
  const ConnectorClass = ConnectorRegistry[type];
  if (!ConnectorClass) {
    throw new Error(`Unknown connector type: ${type}`);
  }
  return new ConnectorClass(config);
}
```

### Step 3: Add Content Types

**File:** `backend/src/db/migrations/004_github_content_types.sql`

```sql
-- Add GitHub content types
INSERT INTO content_types (name, parent_type, description) VALUES
  ('github', NULL, 'GitHub content'),
  ('github:repo', 'github', 'Repository information'),
  ('github:readme', 'github', 'README files'),
  ('github:issue', 'github', 'Issues'),
  ('github:pr', 'github', 'Pull requests'),
  ('github:code', 'github', 'Source code');
```

### Step 4: Create Spider Script

**File:** `backend/src/scripts/run-github-spider.ts`

```typescript
import { GitHubConnector } from '../connectors/github-connector';
import { db } from '../db';

async function runGitHubSpider() {
  const connector = new GitHubConnector({
    name: 'GitHub Nostr Ecosystem',
    github_token: process.env.GITHUB_TOKEN,
    repositories: [
      'nostr-protocol/nostr',
      'nostr-protocol/nips',
      'nostr-dev-kit/nostr-sdk',
      'fiatjaf/nostr-tools',
      'damus-io/damus'
    ],
    include_issues: true,
    include_prs: true
  });

  console.log('🔧 Connecting to GitHub...');
  await connector.connect();

  console.log('📥 Fetching documents...');
  const documents = await connector.fetchDocuments();

  console.log(`✅ Fetched ${documents.length} documents`);

  console.log('💾 Indexing to database...');
  for (const doc of documents) {
    await db.indexDocument(doc);
  }

  console.log('✨ Done!');
  await connector.disconnect();
}

runGitHubSpider().catch(console.error);
```

### Step 5: Add to Package Scripts

**File:** `backend/package.json`

```json
{
  "scripts": {
    "spider:github": "ts-node src/scripts/run-github-spider.ts"
  }
}
```

### Step 6: Test the Connector

```bash
cd backend
npm run spider:github
```

---

## Content Type Taxonomy

### Design Principles

1. **Hierarchical:** Parent types → subtypes
2. **Namespaced:** `source:type` format (e.g., `nostr:article`)
3. **Extensible:** Easy to add new types
4. **Filterable:** Enable multi-select filtering in UI

### Current Taxonomy

```
nostr
├── nostr:note (kind 1)
├── nostr:article (kind 30023)
├── nostr:draft (kind 30024)
├── nostr:file (kind 1063)
└── nostr:video (kind 30311)

github
├── github:repo
├── github:readme
├── github:issue
├── github:pr
└── github:code

docs
├── docs:api
├── docs:tutorial
└── docs:reference

stackoverflow

library
├── library:book
├── library:paper
└── library:course
```

### Database Schema

**Table:** `content_types`

```sql
CREATE TABLE content_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,           -- e.g., 'github:repo'
  parent_type TEXT REFERENCES content_types(name),  -- e.g., 'github'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for hierarchy queries
CREATE INDEX idx_content_types_parent ON content_types(parent_type);
```

### Adding a New Content Type

**1. Add to database:**
```sql
INSERT INTO content_types (name, parent_type, description) VALUES
  ('podcast:episode', 'podcast', 'Podcast episodes');
```

**2. Use in connector:**
```typescript
const document = {
  title: 'Episode 42: Bitcoin Privacy',
  content: transcriptText,
  source: 'nostrcast',
  content_type: 'podcast:episode',  // NEW
  metadata: { duration: 3600, guest: 'Alice' }
};
```

**3. Add filter to frontend:**
```tsx
<ContentTypeFilter
  types={[
    { name: 'podcast:episode', label: 'Podcast Episodes', count: 50 }
  ]}
/>
```

---

## Spider Development

### Spider Architecture

Spiders are specialized connectors that crawl external sources.

**Base Spider Interface:**
```typescript
interface Spider {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Crawling
  fetchDocuments(options?: CrawlOptions): Promise<Document[]>;
  
  // Health
  healthCheck(): Promise<boolean>;
}

interface CrawlOptions {
  limit?: number;          // Max documents to fetch
  since?: Date;            // Fetch only content since this date
  filters?: any;           // Source-specific filters
}
```

### Nostr Spider Example

**File:** `backend/src/ingestion/pipeline.ts`

```typescript
export class IngestionPipeline {
  private relayManager: RelayManager;
  private classifier: DocumentTypeClassifier;
  private extractor: ContentExtractor;
  private spamFilter: AntiSpamFilter;

  async ingest(strategy: IngestionStrategy): Promise<IngestionResult> {
    const startTime = Date.now();
    const results: IngestionResult = {
      total: 0,
      indexed: 0,
      filtered: 0,
      errors: []
    };

    // 1. Discover relay capabilities (NIP-11)
    await this.relayManager.discoverCapabilities();

    // 2. Fetch events from relays
    const events = await this.fetchEvents(strategy);
    results.total = events.length;

    // 3. Process each event
    for (const event of events) {
      try {
        // 3a. Classify document type
        const docType = this.classifier.classify(event);
        if (docType.priority < 5) continue;  // Skip low-priority

        // 3b. Extract content
        const content = this.extractor.extract(event, docType);

        // 3c. Check for spam
        const isSpam = this.spamFilter.check(content);
        if (isSpam) {
          results.filtered++;
          continue;
        }

        // 3d. Index to database
        await this.indexDocument(content);
        results.indexed++;

      } catch (error) {
        results.errors.push({ event, error });
      }
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  private async fetchEvents(strategy: IngestionStrategy): Promise<NostrEvent[]> {
    const filters = strategy.filters;  // REQ filters
    const relays = await this.relayManager.selectHealthyRelays(3);
    
    const events: NostrEvent[] = [];
    for (const relay of relays) {
      const relayEvents = await relay.fetch(filters);
      events.push(...relayEvents);
    }

    return events;
  }
}
```

**Key Components:**

**1. RelayManager** - Health monitoring, NIP-11 discovery, rate limiting  
**2. DocumentTypeClassifier** - Priority-based event classification  
**3. ContentExtractor** - Extract searchable content from events  
**4. AntiSpamFilter** - Multi-layered spam detection

### Spider Best Practices

**1. Respect Rate Limits:**
```typescript
class RateLimiter {
  private requests: number = 0;
  private window: number = 1000;  // 1 second
  private limit: number = 10;     // 10 req/sec

  async throttle() {
    if (this.requests >= this.limit) {
      await sleep(this.window);
      this.requests = 0;
    }
    this.requests++;
  }
}
```

**2. Handle Errors Gracefully:**
```typescript
try {
  const data = await fetchFromAPI(url);
} catch (error) {
  if (error.status === 429) {
    // Rate limited - exponential backoff
    await sleep(Math.pow(2, retryCount) * 1000);
    return retry();
  } else {
    // Log error, continue with next item
    logger.error(`Failed to fetch ${url}:`, error);
  }
}
```

**3. Incremental Crawling:**
```typescript
async function incrementalCrawl() {
  // Get last crawl timestamp
  const lastCrawl = await db.query(
    'SELECT MAX(created_at) FROM documents WHERE source = ?',
    ['github']
  );

  // Only fetch new content
  const newDocs = await connector.fetchDocuments({
    since: lastCrawl.rows[0].max
  });

  // Index new documents
  await db.bulkIndex(newDocs);
}
```

**4. Health Checks:**
```typescript
async function healthCheck() {
  try {
    const response = await fetch(apiUrl, { timeout: 5000 });
    return response.ok;
  } catch {
    return false;
  }
}
```

---

## Plugin System

### Architecture

Plugins extend Beacon Search functionality without modifying core code.

**Plugin Interface:**
```typescript
export interface Plugin {
  name: string;
  version: string;
  
  // Lifecycle
  init(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;

  // Hooks
  beforeIndex?(document: Document): Promise<Document>;
  afterIndex?(document: Document): Promise<void>;
  modifySearchScore?(document: Document, query: Query, baseScore: number): Promise<number>;
  beforeConnect?(connectorConfig: any): Promise<any>;
  afterConnect?(connector: BaseConnector): Promise<void>;

  // Routes (optional)
  routes?: Router;
}
```

**Plugin Context:**
```typescript
export interface PluginContext {
  db: DatabaseClient;       // Database access
  cache: CacheClient;       // Redis cache
  config: Config;           // App config
  logger: Logger;           // Logger instance
}
```

### Creating a Plugin

**Example: Sentiment Analysis Plugin**

**File:** `backend/src/plugins/sentiment/index.ts`

```typescript
import { Plugin, PluginContext, Document } from '../types';
import Sentiment from 'sentiment';

export class SentimentPlugin implements Plugin {
  name = 'sentiment';
  version = '1.0.0';
  
  private sentiment: Sentiment;
  private context: PluginContext;

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    this.sentiment = new Sentiment();
    context.logger.info('[SentimentPlugin] Initialized');
  }

  async beforeIndex(document: Document): Promise<Document> {
    // Analyze sentiment before indexing
    const result = this.sentiment.analyze(document.content);
    
    document.metadata = {
      ...document.metadata,
      sentiment_score: result.score,
      sentiment_label: this.getLabel(result.score)
    };

    return document;
  }

  private getLabel(score: number): string {
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  async destroy(): Promise<void> {
    this.context.logger.info('[SentimentPlugin] Destroyed');
  }
}
```

### Registering Plugins

**File:** `backend/src/index.ts`

```typescript
import { PluginManager } from './plugins/manager';
import { WoTPlugin } from './plugins/wot';
import { SentimentPlugin } from './plugins/sentiment';

const pluginManager = new PluginManager(context);

// Register plugins
pluginManager.register(new WoTPlugin(wotConfig));
pluginManager.register(new SentimentPlugin());

// Initialize all plugins
await pluginManager.initAll();

// Use in search route
app.get('/api/search', async (req, res) => {
  const results = await search(req.query);
  
  // Apply plugin score modifications
  for (const result of results) {
    result.score = await pluginManager.modifySearchScore(
      result.document,
      req.query,
      result.score
    );
  }

  res.json(results);
});
```

### WoT Plugin Deep Dive

**Multi-Provider Architecture:**

```typescript
// Provider interface
export interface WoTProvider {
  getScore(fromPubkey: string, toPubkey: string): Promise<number>;
  batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Record<string, number>>;
  healthCheck(): Promise<boolean>;
}

// NostrMaxi provider (external API)
export class NostrMaxiProvider implements WoTProvider {
  private baseUrl: string;

  async getScore(fromPubkey: string, toPubkey: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/wot/score/${toPubkey}?from=${fromPubkey}`
    );
    const data = await response.json();
    return data.wot_score;
  }

  async batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Record<string, number>> {
    const response = await fetch(`${this.baseUrl}/api/v1/wot/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_pubkey: fromPubkey, to_pubkeys: toPubkeys })
    });
    return await response.json();
  }
}

// Local provider (built-in calculation)
export class LocalWoTProvider implements WoTProvider {
  private db: DatabaseClient;

  async getScore(fromPubkey: string, toPubkey: string): Promise<number> {
    // Load contact lists (kind:3) from database
    const contacts = await this.loadContactLists(fromPubkey);
    
    // Build follow graph
    const graph = this.buildFollowGraph(contacts);
    
    // BFS to calculate score (max 3 hops)
    return this.calculateScore(fromPubkey, toPubkey, graph);
  }

  private calculateScore(from: string, to: string, graph: FollowGraph): number {
    // Direct follow = 1.0
    if (graph[from]?.includes(to)) return 1.0;

    // Friend-of-friend (2 hops) = 0.5-0.7
    // Friend-of-friend-of-friend (3 hops) = 0.3-0.5
    // Beyond 3 hops = 0.0

    const visited = new Set<string>();
    const queue: [string, number][] = [[from, 1.0]];

    while (queue.length > 0) {
      const [current, score] = queue.shift()!;
      if (current === to) return score;
      if (visited.has(current)) continue;
      visited.add(current);

      const follows = graph[current] || [];
      for (const follow of follows) {
        const newScore = score * 0.7;  // Decay per hop
        if (newScore > 0.3) {  // Stop at 3 hops
          queue.push([follow, newScore]);
        }
      }
    }

    return 0.0;  // No path found
  }
}

// Factory function
export function createWoTProvider(config: WoTPluginConfig): WoTProvider {
  if (config.provider === 'nostrmaxi') {
    return new NostrMaxiProvider(config.nostrmaxi_url);
  } else {
    return new LocalWoTProvider(db);
  }
}
```

**Configuration:**
```json
{
  "enabled": true,
  "provider": "local",
  "weight": 1.0,
  "cache_ttl": 3600
}
```

**See:** `backend/src/plugins/wot/README.md` for full documentation

---

## Database Schema

### Core Tables

**documents** - Main search index
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),              -- pgvector embedding
  source TEXT NOT NULL,               -- 'nostr', 'github', 'docs', etc.
  source_url TEXT,
  content_type TEXT,                  -- 'nostr:article', 'github:repo', etc.
  quality_score REAL DEFAULT 0.5,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_embedding ON documents 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_documents_source ON documents(source);
CREATE INDEX idx_documents_content_type ON documents(content_type);
CREATE INDEX idx_documents_quality ON documents(quality_score DESC);
CREATE INDEX idx_documents_fts ON documents USING gin(to_tsvector('english', content));
```

**nostr_events** - Nostr-specific metadata
```sql
CREATE TABLE nostr_events (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  event_id TEXT UNIQUE NOT NULL,      -- Nostr event ID (unique!)
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  event_created_at TIMESTAMP,
  tags JSONB,
  relay_urls TEXT[],
  
  CONSTRAINT unique_event_id UNIQUE (event_id)
);

CREATE INDEX idx_nostr_events_pubkey ON nostr_events(pubkey);
CREATE INDEX idx_nostr_events_kind ON nostr_events(kind);
CREATE INDEX idx_nostr_events_event_id ON nostr_events(event_id);
```

**content_types** - Content type taxonomy
```sql
CREATE TABLE content_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  parent_type TEXT REFERENCES content_types(name),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_types_parent ON content_types(parent_type);
```

**wot_scores** - WoT score cache (optional)
```sql
CREATE TABLE wot_scores (
  id SERIAL PRIMARY KEY,
  from_pubkey TEXT NOT NULL,
  to_pubkey TEXT NOT NULL,
  score REAL NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(from_pubkey, to_pubkey)
);

CREATE INDEX idx_wot_from ON wot_scores(from_pubkey);
CREATE INDEX idx_wot_to ON wot_scores(to_pubkey);
```

### Migrations

**Creating a Migration:**

**File:** `migrations/004_add_github_tables.sql`
```sql
-- GitHub-specific tables
CREATE TABLE github_repositories (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  repo_full_name TEXT UNIQUE NOT NULL,  -- e.g., 'nostr-protocol/nostr'
  stars INTEGER,
  forks INTEGER,
  language TEXT,
  topics TEXT[],
  last_push_at TIMESTAMP
);

CREATE INDEX idx_github_repos_name ON github_repositories(repo_full_name);
CREATE INDEX idx_github_repos_stars ON github_repositories(stars DESC);
```

**Applying a Migration:**
```bash
node backend/apply-migration.js migrations/004_add_github_tables.sql
```

**Or manually:**
```bash
psql beacon_search < migrations/004_add_github_tables.sql
```

---

## API Reference

**See:** [API-REFERENCE.md](./API-REFERENCE.md) for complete API documentation.

### Key Endpoints

**Search:**
```
GET /api/search?q=<query>&mode=<hybrid|vector|text>&type=<content_type>&user_pubkey=<npub>
```

**Document Details:**
```
GET /api/documents/:id
```

**Index Document:**
```
POST /api/documents
{
  "title": "...",
  "content": "...",
  "source": "...",
  "content_type": "..."
}
```

**Health Check:**
```
GET /health
```

---

## Testing Guide

### Unit Tests

**File:** `backend/src/search/embeddings.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { EmbeddingGenerator } from './embeddings';

describe('EmbeddingGenerator', () => {
  it('generates embeddings', async () => {
    const generator = new EmbeddingGenerator();
    await generator.init();
    
    const embedding = await generator.generate('hello world');
    
    expect(embedding).toHaveLength(384);
    expect(embedding[0]).toBeTypeOf('number');
  });

  it('generates consistent embeddings', async () => {
    const generator = new EmbeddingGenerator();
    await generator.init();
    
    const emb1 = await generator.generate('hello');
    const emb2 = await generator.generate('hello');
    
    expect(emb1).toEqual(emb2);
  });
});
```

**Run tests:**
```bash
cd backend
npm test
```

### E2E Tests

**File:** `test-nostr-e2e.sh`

```bash
#!/bin/bash

# Health check
curl http://localhost:3001/health | jq .

# Search test
curl "http://localhost:3001/api/search?q=nostr&limit=5" | jq .

# Check results
# ...
```

**Run E2E tests:**
```bash
./test-nostr-e2e.sh
```

### Performance Testing

**Load test with `wrk`:**
```bash
wrk -t4 -c100 -d30s "http://localhost:3001/api/search?q=bitcoin"
```

**Benchmarking:**
```typescript
console.time('search');
const results = await search('bitcoin privacy');
console.timeEnd('search');
// search: 47ms
```

---

## Deployment Guide

### Production Deployment (Docker Compose)

**1. Copy project to production server:**
```bash
scp -r beacon-search user@server:/opt/
```

**2. Configure environment:**
```bash
cd /opt/beacon-search
cp .env.example .env
nano .env  # Edit with production values
```

**3. Start services:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

**4. Verify health:**
```bash
curl https://your-domain.com/health
```

**See:** [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

---

## Performance Optimization

### Database Optimization

**1. Optimize indexes:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM documents 
  WHERE embedding <=> '[...]' < 0.5 
  ORDER BY embedding <=> '[...]' 
  LIMIT 10;

-- Increase IVFFLAT lists for larger datasets
CREATE INDEX idx_documents_embedding_large ON documents 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 500);
```

**2. Connection pooling:**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  max: 20,              // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**3. Query optimization:**
```typescript
// Bad: N+1 queries
for (const doc of documents) {
  const metadata = await db.query('SELECT * FROM nostr_events WHERE document_id = $1', [doc.id]);
}

// Good: Single join
const docsWithMetadata = await db.query(`
  SELECT d.*, ne.* FROM documents d
  LEFT JOIN nostr_events ne ON ne.document_id = d.id
  WHERE d.id = ANY($1)
`, [documentIds]);
```

### Caching

**1. Redis caching:**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedSearch(query: string) {
  const cacheKey = `search:${query}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const results = await search(query);
  await redis.setex(cacheKey, 3600, JSON.stringify(results));  // 1 hour TTL
  
  return results;
}
```

**2. In-memory caching:**
```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 });

function getCached(key: string, fetcher: () => Promise<any>) {
  const cached = cache.get(key);
  if (cached) return cached;
  
  const data = await fetcher();
  cache.set(key, data);
  return data;
}
```

### Embedding Optimization

**1. Batch generation:**
```typescript
// Bad: Generate one at a time
for (const doc of documents) {
  doc.embedding = await generateEmbedding(doc.content);
}

// Good: Batch generation
const embeddings = await generateEmbeddingsBatch(
  documents.map(d => d.content)
);
documents.forEach((doc, i) => {
  doc.embedding = embeddings[i];
});
```

**2. Use GPU acceleration (if available):**
```typescript
import { pipeline } from '@xenova/transformers';

const generator = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', {
  device: 'cuda',  // GPU
});
```

---

## Contributing

### Code Style

**TypeScript:**
- Use `async/await` (not callbacks)
- Use `const` over `let`
- Prefer `interface` over `type`
- Use descriptive variable names

**Example:**
```typescript
// Good
async function fetchDocuments(connector: Connector): Promise<Document[]> {
  const documents = await connector.fetch();
  return documents.filter(doc => doc.quality > 0.5);
}

// Bad
function fetchDocuments(c) {
  return c.fetch().then(docs => docs.filter(d => d.quality > 0.5));
}
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/github-spider`
3. Make changes with tests
4. Run tests: `npm test`
5. Commit with descriptive messages
6. Push and create PR

### Documentation

- Update relevant `.md` files
- Add JSDoc comments to public APIs
- Include examples in documentation

**Example:**
```typescript
/**
 * Generate embedding vector for text content
 * 
 * @param text - Input text to embed
 * @returns 384-dimensional embedding vector
 * 
 * @example
 * const embedding = await generateEmbedding('hello world');
 * console.log(embedding.length);  // 384
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // ...
}
```

---

## Troubleshooting

**Database connection failed:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -d beacon_search -c "SELECT 1;"
```

**Embeddings not generating:**
```bash
# Check Transformers.js installation
cd backend
npm list @xenova/transformers

# Test manually
node -e "require('@xenova/transformers').pipeline('feature-extraction', 'all-MiniLM-L6-v2').then(() => console.log('OK'))"
```

**Slow search queries:**
```sql
-- Check if index is being used
EXPLAIN SELECT * FROM documents ORDER BY embedding <=> '[...]' LIMIT 10;

-- Rebuild index if needed
REINDEX INDEX idx_documents_embedding;
```

---

**Last Updated:** 2026-02-13 23:21 EST  
**Version:** 2.0  
**Maintained By:** Beacon Search Team
