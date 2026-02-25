# Product Requirements Document: Beacon Foundation Rebuild

**Product:** Beacon Search Foundation  
**Version:** Foundation 1.0 (replaces "V2" planning)  
**Status:** APPROVED - EXECUTE NOW  
**Created:** 2026-02-25  
**Owner:** Adam (OpenClaw Agent)  

---

## Executive Summary

**The Problem:** Beacon was built as a search-only port of Knova-lite, skipping critical foundation layers (admin console, connector framework, configuration management). Current architecture is hardcoded, unmaintainable, and prevents proper multi-source ingestion.

**The Solution:** Rebuild the foundation properly - admin console + pluggable connector framework + configuration management system. Model after Insight/Knova-lite architecture.

**Timeline:** 10-14 agent days with parallel execution  
**Priority:** P0 - BLOCKS ALL OTHER WORK  

---

## Problem Statement

### Current Architecture (Broken)
```
Hardcoded Nostr Ingestion
    ↓
PostgreSQL + pgvector
    ↓
React Search UI
```

**Issues:**
- ❌ No configuration UI - everything manual SQL
- ❌ Ingestion hardcoded - can't add new sources without code changes
- ❌ No admin controls - can't manage connectors, servers, document types
- ❌ No monitoring - blind to sync status, errors, performance
- ❌ Single source only - Nostr events, nothing else

### Target Architecture (Correct)
```
Admin Console (React)
    ↓
Configuration Layer (API + Database)
    ↓
Connector Framework (Pluggable)
    ↓
Sync Engine (Scheduled + Manual)
    ↓
Search Index (PostgreSQL + pgvector)
    ↓
User Search UI (React)
```

**Capabilities:**
- ✅ Full admin UI for configuration
- ✅ Pluggable connectors (SQL, Web, Files, Nostr, APIs)
- ✅ Database-backed configuration (not hardcoded)
- ✅ Dashboard for monitoring sync status
- ✅ Multi-source ingestion

---

## Product Vision

**Beacon Foundation = Enterprise-grade configuration & ingestion system**

A search platform that:
- Lets admins configure data sources through a UI (no code)
- Supports multiple connector types (databases, web, files, APIs)
- Monitors sync health and performance
- Scales to hundreds of data sources
- Provides proper access control and RBAC

**Inspiration:** Aptean Insight/Knova-lite admin architecture  
**Differentiation:** Modern React UI, Nostr-native, open source

---

## Key Features (Foundation Layer)

### 1. Admin Console

#### User Story
> "As an admin, I want a web UI to configure data sources, manage connectors, and monitor sync status - without touching code or SQL."

#### Features
- **Servers Management** - Configure external data sources
  - Add/edit/delete servers
  - Connection testing
  - Authentication settings (username/password, API keys, OAuth)
  - Server-level metadata (name, description, tags)

- **Document Types** - Define schema for indexed content
  - Create custom document types
  - Define fields and data types
  - Set display templates
  - Configure type-specific relevancy rules

- **Crawler Configuration** - Set up data ingestion
  - Product crawlers (native database connectors)
  - External crawlers (web, files, APIs)
  - Extraction rules (SQL queries, filters, transformations)
  - Property mapping (source field → index field)
  - Schedule configuration (cron, interval)
  - Access control per crawler

- **Dashboard** - System health overview
  - System alerts (sync failures, errors)
  - Index status (doc count, size, last update)
  - Sync history (per-crawler logs)
  - Performance metrics (query latency, throughput)

- **Settings/Preferences** - System-wide configuration
  - Default relevancy weights
  - Synonym dictionaries
  - Stemming rules
  - UI customization (logo, colors, branding)
  - User management (admin vs user roles)

#### UI Design
```
┌─────────────────────────────────────────────────────┐
│ 🔦 Beacon Admin                     [User: admin ▼] │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐  │
│ │Dashboard│ │Servers   │ │Crawlers │ │Settings │  │
│ └─────────┘ └──────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 System Status                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Total Documents: 1,827                       │  │
│  │ Active Crawlers: 3                           │  │
│  │ Last Sync: 5 minutes ago                     │  │
│  │ Sync Failures (24h): 0                       │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  🔄 Recent Syncs                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Nostr Relay Sync   ✅ 1,200 docs   2 min ago │  │
│  │ PostgreSQL Sync    ✅ 450 docs     10 min    │  │
│  │ Web Crawler        ⚠️ 0 docs (failed)        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

### 2. Configuration Storage Layer

#### Database Schema
```sql
-- Servers (data source definitions)
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'postgresql', 'mysql', 'web', 'nostr', 'api'
  host VARCHAR(500),
  port INT,
  database_name VARCHAR(255),
  auth_type VARCHAR(50), -- 'password', 'apikey', 'oauth', 'none'
  auth_config JSONB, -- encrypted credentials
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Document Types (schema definitions)
CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  fields JSONB NOT NULL, -- [{name, type, required, searchable}]
  display_template TEXT, -- Handlebars template
  relevancy_config JSONB, -- custom scoring rules
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crawlers (ingestion job definitions)
CREATE TABLE crawlers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'product', 'external', 'manual'
  server_id UUID REFERENCES servers(id),
  document_type_id UUID REFERENCES document_types(id),
  status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'inactive', 'error'
  schedule_type VARCHAR(50), -- 'cron', 'interval', 'manual'
  schedule_config JSONB, -- cron expression or interval seconds
  extraction_config JSONB NOT NULL, -- SQL query, filters, transformations
  property_mapping JSONB, -- {source_field: index_field}
  access_control JSONB, -- permission groups
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(50),
  last_sync_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync History (execution logs)
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_id UUID REFERENCES crawlers(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(50), -- 'running', 'success', 'failed'
  documents_added INT DEFAULT 0,
  documents_updated INT DEFAULT 0,
  documents_deleted INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_sync_history_crawler ON sync_history(crawler_id, started_at DESC);

-- System Alerts
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'sync_failure', 'index_error', 'performance'
  severity VARCHAR(20), -- 'info', 'warning', 'error', 'critical'
  message TEXT NOT NULL,
  source VARCHAR(255), -- crawler name or system component
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alerts_unacknowledged ON system_alerts(acknowledged, created_at DESC);
```

---

### 3. Connector Framework

#### Abstract Connector Interface
```typescript
// backend/src/connectors/BaseConnector.ts
export abstract class BaseConnector {
  protected config: CrawlerConfig;
  protected server: Server;
  
  constructor(crawler: Crawler, server: Server) {
    this.config = crawler.extraction_config;
    this.server = server;
  }
  
  // Abstract methods - must implement
  abstract async connect(): Promise<void>;
  abstract async disconnect(): Promise<void>;
  abstract async testConnection(): Promise<boolean>;
  abstract async fetchDocuments(since?: Date): Promise<Document[]>;
  abstract async syncIncremental(): Promise<SyncResult>;
  abstract async syncFull(): Promise<SyncResult>;
  
  // Common methods - provided by base
  async transformDocument(raw: any): Promise<Document> {
    // Apply property mapping
    // Apply field transformations
    // Validate against document type schema
  }
  
  async indexDocument(doc: Document): Promise<void> {
    // Store in documents table
    // Generate embedding
    // Index for search
  }
}
```

#### Product Crawler (SQL Databases)
```typescript
// backend/src/connectors/ProductCrawler.ts
export class ProductCrawler extends BaseConnector {
  private dbConnection: any;
  
  async connect(): Promise<void> {
    // Connect to SQL database using server config
    // Support PostgreSQL, MySQL, SQL Server, Oracle
  }
  
  async fetchDocuments(since?: Date): Promise<Document[]> {
    // Execute SQL query from extraction_config
    // Apply filters
    // Transform rows to documents
  }
  
  async syncIncremental(): Promise<SyncResult> {
    // Query for records modified since last sync
    // Fetch and index new/updated documents
    // Mark deleted documents
  }
}
```

#### External Crawler (Web, Files, APIs)
```typescript
// backend/src/connectors/ExternalCrawler.ts
export class ExternalCrawler extends BaseConnector {
  // Web crawling via Puppeteer
  // File system via fs/S3 SDK
  // REST APIs via axios
}
```

#### Nostr Connector (Refactor Existing)
```typescript
// backend/src/connectors/NostrConnector.ts
export class NostrConnector extends BaseConnector {
  // Refactor existing Nostr ingestion code
  // Make it pluggable like other connectors
  // Support kind 0 (profiles), kind 1 (notes), etc.
}
```

---

### 4. Sync Engine

#### Job Scheduler
```typescript
// backend/src/sync/SyncScheduler.ts
export class SyncScheduler {
  private jobs: Map<string, CronJob> = new Map();
  
  async loadCrawlers(): Promise<void> {
    // Load all active crawlers from database
    // Schedule based on schedule_config
  }
  
  async scheduleCrawler(crawler: Crawler): Promise<void> {
    if (crawler.schedule_type === 'cron') {
      // Create cron job
      const job = new CronJob(crawler.schedule_config.expression, () => {
        this.executeCrawler(crawler);
      });
      job.start();
      this.jobs.set(crawler.id, job);
    } else if (crawler.schedule_type === 'interval') {
      // Create interval job
      const intervalMs = crawler.schedule_config.seconds * 1000;
      const interval = setInterval(() => {
        this.executeCrawler(crawler);
      }, intervalMs);
      this.jobs.set(crawler.id, interval);
    }
  }
  
  async executeCrawler(crawler: Crawler): Promise<void> {
    // Load server config
    // Instantiate appropriate connector
    // Run sync (incremental or full)
    // Log to sync_history
    // Create alerts on failure
  }
}
```

#### Manual Sync Trigger
```typescript
// backend/src/routes/admin/crawlers.ts
router.post('/api/admin/crawlers/:id/sync', async (req, res) => {
  const { id } = req.params;
  const { type = 'incremental' } = req.body;
  
  // Load crawler
  const crawler = await db.crawlers.findById(id);
  
  // Trigger sync in background
  syncScheduler.executeCrawler(crawler, type);
  
  res.json({ message: 'Sync started', crawler_id: id });
});
```

---

### 5. Admin API Layer

#### Full CRUD for All Entities
```typescript
// Servers
GET    /api/admin/servers          - List all
POST   /api/admin/servers          - Create
GET    /api/admin/servers/:id      - Get one
PUT    /api/admin/servers/:id      - Update
DELETE /api/admin/servers/:id      - Delete
POST   /api/admin/servers/:id/test - Test connection

// Document Types
GET    /api/admin/document-types
POST   /api/admin/document-types
GET    /api/admin/document-types/:id
PUT    /api/admin/document-types/:id
DELETE /api/admin/document-types/:id

// Crawlers
GET    /api/admin/crawlers
POST   /api/admin/crawlers
GET    /api/admin/crawlers/:id
PUT    /api/admin/crawlers/:id
DELETE /api/admin/crawlers/:id
POST   /api/admin/crawlers/:id/sync          - Trigger sync
POST   /api/admin/crawlers/:id/delete-docs   - Purge documents
GET    /api/admin/crawlers/:id/history       - Sync logs

// Dashboard
GET    /api/admin/dashboard/alerts
POST   /api/admin/dashboard/alerts/:id/ack
GET    /api/admin/dashboard/index-status
GET    /api/admin/dashboard/sync-history

// Settings
GET    /api/admin/settings
PUT    /api/admin/settings
```

---

## Implementation Plan

### Parallel Workstreams (10-14 days total)

#### Stream A: Backend Foundation (8-10 days)
**Agent:** Backend specialist

**Tasks:**
1. Database schema (servers, document_types, crawlers, sync_history, alerts)
2. Configuration API layer (CRUD for all entities)
3. BaseConnector abstract class
4. ProductCrawler implementation (PostgreSQL, MySQL)
5. NostrConnector refactor (use connector framework)
6. SyncScheduler (cron + interval jobs)
7. Manual sync triggers
8. Alert generation system

**Deliverable:** Working backend with API + connector framework

---

#### Stream B: Admin Console (8-10 days)
**Agent:** Frontend specialist

**Tasks:**
1. Admin layout (sidebar nav, header, content area)
2. Dashboard page (alerts, index status, sync history widgets)
3. Servers management (list, create, edit, delete, test)
4. Document Types management
5. Crawlers management (list, create, edit, delete, sync trigger)
6. Settings page (preferences, branding)
7. Authentication (admin vs user roles)
8. Real-time updates (WebSocket for sync status)

**Deliverable:** Full admin UI connected to API

---

#### Stream C: Testing & Integration (Days 9-14)
**Agent:** Integration specialist

**Tasks:**
1. End-to-end testing (create server → create crawler → sync → verify docs)
2. Error handling verification
3. Performance testing (1000+ docs sync)
4. Documentation (admin guide, API docs)
5. Migration script (existing Nostr data → new schema)
6. Deployment verification

**Deliverable:** Production-ready foundation

---

## Success Criteria

### Must Have (Foundation 1.0)
- ✅ Admin console accessible at `/admin`
- ✅ Create server (PostgreSQL) via UI
- ✅ Create crawler (SQL query) via UI
- ✅ Trigger sync manually → documents indexed
- ✅ Dashboard shows sync status
- ✅ Alerts generated on sync failure
- ✅ Existing Nostr data migrated to new schema
- ✅ No regressions in user search UI

### Should Have
- ⏺ Scheduled syncs (cron) working
- ⏺ Incremental sync (only new/updated docs)
- ⏺ Multiple server types (PostgreSQL, MySQL, Web)
- ⏺ Document type templates
- ⏺ Real-time sync status updates

### Nice to Have (Defer to Foundation 1.1)
- ⏺ API key authentication
- ⏺ Backup/restore configs
- ⏺ Audit logs
- ⏺ Performance profiling

---

## Technical Architecture

### Backend Stack
- **Framework:** Express.js (TypeScript)
- **Database:** PostgreSQL
- **ORM:** TypeORM or Prisma
- **Scheduling:** node-cron
- **WebSocket:** Socket.io (for real-time updates)
- **Auth:** JWT + bcrypt

### Frontend Stack
- **Framework:** React
- **UI Library:** Tailwind CSS + shadcn/ui components
- **State:** React Context + hooks
- **API Client:** axios
- **Real-time:** Socket.io-client

### Directory Structure
```
backend/
├── src/
│   ├── connectors/
│   │   ├── BaseConnector.ts
│   │   ├── ProductCrawler.ts
│   │   ├── ExternalCrawler.ts
│   │   └── NostrConnector.ts
│   ├── sync/
│   │   ├── SyncScheduler.ts
│   │   └── SyncExecutor.ts
│   ├── routes/
│   │   ├── admin/
│   │   │   ├── servers.ts
│   │   │   ├── documentTypes.ts
│   │   │   ├── crawlers.ts
│   │   │   └── dashboard.ts
│   │   └── search.ts (existing)
│   ├── models/
│   │   ├── Server.ts
│   │   ├── DocumentType.ts
│   │   ├── Crawler.ts
│   │   └── SyncHistory.ts
│   └── services/
│       ├── ConnectorFactory.ts
│       └── AlertService.ts

frontend/
├── src/
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ServersPage.tsx
│   │   ├── DocumentTypesPage.tsx
│   │   ├── CrawlersPage.tsx
│   │   └── SettingsPage.tsx
│   ├── user/ (existing search UI)
│   └── components/
│       ├── ServerForm.tsx
│       ├── CrawlerForm.tsx
│       ├── SyncStatusWidget.tsx
│       └── AlertsWidget.tsx
```

---

## Migration Strategy

### Phase 1: Build New Foundation (Days 1-10)
- Build in parallel with existing system
- No impact on current search UI
- Use `/admin` route for new console

### Phase 2: Migrate Existing Data (Days 11-12)
```sql
-- Migrate Nostr ingestion to new schema
INSERT INTO servers (name, type, metadata)
VALUES ('Default Nostr Relays', 'nostr', '{"relays": [...]}');

INSERT INTO document_types (name, display_name, fields)
VALUES ('nostr_event', 'Nostr Event', '[...]');

INSERT INTO crawlers (name, type, server_id, document_type_id, extraction_config)
SELECT ...;

-- Existing documents table remains unchanged
-- Just link via crawler_id
```

### Phase 3: Cut Over (Days 13-14)
- Switch from hardcoded ingestion to connector framework
- Verify all existing features work
- Update documentation
- Deploy to production

---

## Risk Mitigation

### Risk 1: Breaking Existing Search
**Mitigation:** Keep existing API unchanged, build new system alongside, migrate data carefully

### Risk 2: Connector Framework Complexity
**Mitigation:** Start with simplest connector (SQL), prove pattern, then add others

### Risk 3: Performance Degradation
**Mitigation:** Profile sync operations, add indexes, optimize queries early

### Risk 4: Timeline Slip
**Mitigation:** Parallel execution, clear task breakdown, daily standups, cut scope if needed

---

## Post-Foundation Roadmap

### Foundation 1.1 (Week 3-4)
- WebCrawler connector
- File system connector
- API connector
- Advanced scheduling (dependencies, priorities)

### Foundation 1.2 (Week 5-6)
- LDAP authentication
- RBAC (admin, curator, user roles)
- Audit logging
- Backup/restore

### User Features (After Foundation)
- Advanced UX (sort/filter)
- Social features (zap/like)
- WoT integration
- Nostr authentication

---

## Definition of Done

Foundation 1.0 is DONE when:
1. ✅ Admin console deployed at `/admin`
2. ✅ Can create server + crawler via UI (no code)
3. ✅ Trigger manual sync → documents indexed
4. ✅ Dashboard shows sync status + alerts
5. ✅ Existing Nostr data works with new system
6. ✅ User search UI unchanged and functional
7. ✅ All tests passing
8. ✅ Documentation complete
9. ✅ Production deployment successful
10. ✅ Zero downtime for users

---

**End of PRD**

**Status:** APPROVED - BEGIN EXECUTION IMMEDIATELY
