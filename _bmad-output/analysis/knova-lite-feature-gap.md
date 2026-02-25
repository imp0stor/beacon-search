# Feature Gap Analysis: Beacon vs Knova-lite (Insight)

**Created:** 2026-02-25  
**Source:** Aptean Insight 1.0 documentation (6 PDFs)  
**Purpose:** Identify missing enterprise features for Beacon V2+ roadmap  

---

## Executive Summary

Beacon was built using Knova-lite as the foundation. After analyzing the full Insight documentation, we've identified **significant feature gaps** in:
- Admin/configuration UI
- Advanced search behaviors
- Connector management
- Access control
- Dashboard/monitoring
- API layer

**Strategic Recommendation:** Prioritize admin features + connector management in V2/V3 to reach feature parity with Insight.

---

## 1. Search Features

### ✅ Beacon Has
- Semantic search (vector embeddings)
- Keyword matching
- Search history
- Basic relevancy scoring
- Highlighting (in snippets)

### ❌ Beacon Missing
#### P0 - Critical
- **Synonyms** - Define synonym mappings for query expansion
- **Stemming** - Word root reduction (walks → walk)
- **Auto-suggest** - Real-time query suggestions (we have basic, needs enhancement)
- **Trigger Terms** - Special keywords that change search behavior
- **Tab Prioritization** - Weight results by document type/source
- **Exact Match Search** - Force exact phrase matching
- **Special Characters** - Proper handling of @, #, -, etc.

#### P1 - Important
- **Relevancy Tuning UI** - Admin interface to adjust scoring weights
- **Query Rewriting** - Automatic query transformation rules
- **Faceted Search** - Filter by multiple dimensions (date, type, author, etc.)
- **Advanced Search Syntax** - Boolean operators (AND, OR, NOT), field targeting

---

## 2. User Interface

### ✅ Beacon Has
- Modern React UI
- Mobile responsive (basic)
- Dark theme
- Rich content rendering (images, links, embeds)
- User/content toggle

### ❌ Beacon Missing
#### P0
- **Admin Console** - Full configuration UI (we have none)
  - Server management
  - Document type configuration
  - Crawler setup
  - Live view builder
  - Actions configuration
- **Dashboard** - System health overview
  - System alerts
  - Index status
  - Sync history
  - Performance metrics
- **Settings Panel** - User preferences
  - Default sort/filter
  - Results per page
  - Theme selection
  - Notification preferences

#### P1
- **Search Actions** - Contextual actions on results
  - Execute workflows
  - Send to external systems
  - Archive/delete
  - Export
- **Live Views** - Saved custom queries with filters
- **Portrait/Landscape Mobile Modes** - Optimized layouts
- **Map Section** - Geographic visualization (if applicable)

---

## 3. Administration & Configuration

### ✅ Beacon Has
- Basic connector configuration (manual)
- Environment variables for config
- Docker compose setup

### ❌ Beacon Missing (MASSIVE GAP)
#### P0 - Critical
- **Servers Configuration** - Manage external data sources
  - Add/edit/delete servers
  - Connection testing
  - Authentication settings
  - Server-level access control

- **Document Types** - Schema management
  - Define custom document types
  - Field mapping
  - Display templates
  - Type-specific relevancy rules

- **Product Crawlers** - Native data source connectors
  - General settings (schedule, batch size)
  - Extraction rules (SQL queries, filters)
  - Property mapping (field → index)
  - Attribute transformation
  - Presentation templates
  - Access control per crawler

- **External Crawlers** - Apache ManifoldCF integration
  - Web crawlers
  - File system crawlers
  - SharePoint connectors
  - Database crawlers

- **Live Views** - Saved search templates
  - Pre-configured filters
  - Custom sort orders
  - Shareable links
  - Role-based visibility

- **Actions** - Workflow integration
  - HTTP webhooks
  - Email notifications
  - External system updates
  - Custom scripts

- **Preferences** - System-wide settings
  - Default relevancy weights
  - Synonym dictionaries
  - Stemming rules
  - UI customization (logo, colors, branding)

#### P1
- **User Management** - Admin can manage users
- **Role-Based Access Control** - Granular permissions
- **Audit Logging** - Track all config changes
- **Backup/Restore** - Config export/import

---

## 4. Authentication & Authorization

### ✅ Beacon Has
- Basic (none deployed yet, planned for V2)

### ❌ Beacon Missing
#### P0
- **LDAP Authentication** - Enterprise directory integration
- **Database Authentication** - Internal user store
- **Admin vs Non-Admin Roles** - Permission levels
- **Access Level Enforcement** - Document-level security
  - Permission groups per document
  - User group membership
  - Role-based filtering

#### P1
- **OAuth/SAML** - SSO integration
- **API Key Management** - Programmatic access
- **Session Management** - Timeout, concurrent sessions

---

## 5. Connector & Ingestion System

### ✅ Beacon Has
- Nostr event ingestion (custom)
- PostgreSQL storage
- Basic deduplication

### ❌ Beacon Missing (HUGE GAP)
#### P0 - Critical
- **Connector Framework** - Plugin architecture for data sources
  - Product crawlers (native DB connectors)
  - External crawlers (ManifoldCF)
  - API-based ingestion
  - File watchers

- **Sync Management**
  - Scheduled syncs (cron)
  - Manual sync triggers
  - Incremental vs full sync
  - Sync status monitoring
  - Error handling + retry logic

- **Document Lifecycle**
  - Delete documents from specific crawler
  - Re-sync single source
  - Purge old documents
  - Version tracking

- **Extraction Rules**
  - SQL query builder
  - Field mapping UI
  - Data transformation (regex, scripts)
  - Conditional extraction

#### P1
- **Multiple Data Source Types**
  - SQL databases (MySQL, PostgreSQL, SQL Server, Oracle)
  - NoSQL (MongoDB, Elasticsearch)
  - REST APIs
  - File systems (SMB, NFS, S3)
  - Web sites (HTML crawling)
  - Email servers (IMAP, Exchange)
  - SharePoint/OneDrive
  - Confluence/Jira

- **Content Processing**
  - OCR for images/PDFs
  - Audio transcription
  - Video frame extraction
  - Language detection + translation

---

## 6. Dashboard & Monitoring

### ✅ Beacon Has
- None

### ❌ Beacon Missing (ENTIRE SYSTEM)
#### P0
- **System Alerts**
  - Sync failures
  - Index errors
  - Low disk space
  - Performance degradation
  - Acknowledgment + resolution tracking

- **Index Status**
  - Total documents indexed
  - Index size on disk
  - Last index update time
  - Documents pending ingestion
  - Failed documents

- **Sync History**
  - Per-crawler sync logs
  - Success/failure rates
  - Documents added/updated/deleted
  - Duration + performance metrics
  - Error details

- **Search Analytics**
  - Top queries
  - Zero-result searches
  - Click-through rates
  - User engagement metrics

#### P1
- **Performance Monitoring**
  - Query latency (p50, p95, p99)
  - CPU/memory usage
  - Index fragmentation
  - Slow query log

- **Usage Reports**
  - Daily active users
  - Search volume trends
  - Most viewed documents
  - Export to CSV/PDF

---

## 7. API Layer

### ✅ Beacon Has
- Basic search API (`/api/search`)
- User search API (`/api/search/users`)
- Link preview API (`/api/link-preview`)

### ❌ Beacon Missing (MAJOR GAP)
#### P0
- **Login APIs**
  - `/api/bootstrap` - Get app config
  - `/api/auth/login` - Authenticate user
  - `/api/auth/logout` - End session
  - `/api/session/config` - User settings

- **Admin APIs** (full CRUD for all entities)
  - Servers: GET, POST, PUT, DELETE
  - Document Types: GET, POST, PUT, DELETE
  - Product Crawlers: GET, POST, PUT, DELETE + sync/delete-docs
  - External Crawlers: GET, POST, PUT, DELETE
  - Live Views: GET, POST, PUT, DELETE + validate
  - Actions: GET, POST, PUT, DELETE

- **Dashboard APIs**
  - `/api/alerts` - GET, acknowledge
  - `/api/index/status` - Index metrics
  - `/api/sync/history` - Sync logs by crawler
  - `/api/sync/status` - Current sync state

- **Search APIs (enhanced)**
  - `/api/search/execute` - Run search with full options
  - `/api/search/suggest` - Auto-suggest
  - `/api/search/history` - User search history (GET, DELETE)
  - `/api/liveview/execute` - Run saved live view

#### P1
- **Bulk Operations APIs**
  - `/api/bulk/reindex` - Re-index all documents
  - `/api/bulk/delete` - Batch delete by query
  - `/api/bulk/export` - Export search results

- **Webhooks**
  - Push notifications on events (new doc, sync complete, alert)

---

## 8. Performance & Scalability

### ✅ Beacon Has
- PostgreSQL with pgvector
- Docker containerized
- Nginx proxy

### ❌ Beacon Missing
#### P0
- **Horizontal Scaling** - Multi-node index
- **Load Balancing** - Distribute search load
- **Index Sharding** - Split large indices
- **Cache Layer** - Redis for hot queries

#### P1
- **Performance Testing** - Load tests, soak tests
- **Query Optimization** - Slow query analysis
- **Index Optimization** - Compaction, merge
- **CDN Integration** - Static asset delivery

---

## 9. Enterprise Features

### ✅ Beacon Has
- None

### ❌ Beacon Missing (ENTERPRISE REQUIREMENTS)
#### P0
- **Multi-Tenancy** - Separate data per tenant
- **White-Label Branding** - Custom logos, colors, domain
- **Backup & Disaster Recovery** - Automated backups, point-in-time restore
- **Compliance & Audit** - GDPR, SOC2 compliance features
- **SLA Monitoring** - Uptime tracking, alerting

#### P1
- **High Availability** - Failover, replication
- **Data Residency** - Control where data is stored
- **Custom SSL Certificates** - Bring-your-own-cert
- **API Rate Limiting** - Prevent abuse
- **IP Whitelisting** - Restrict access by IP

---

## 10. Mobile Experience

### ✅ Beacon Has
- Responsive UI (basic)
- Touch-friendly

### ❌ Beacon Missing
#### P1
- **Native Mobile Apps** - iOS, Android
- **Offline Mode** - Cache results for offline viewing
- **Push Notifications** - New content alerts
- **Portrait/Landscape Optimized Modes** - Insight has separate layouts

---

## Feature Priority Matrix

### V2 Priorities (Already Planned)
- ✅ Advanced UX (sort/filter) - **Epic 1**
- ✅ Intelligent Ranking - **Epic 2**
- ✅ Nostr Auth - **Epic 3**
- ✅ Social Features (zap/like) - **Epic 4**
- ✅ WoT Integration - **Epic 5**

### V3 Priorities (NEW - Based on Knova Gap)
#### P0 - Must Have
1. **Admin Console** (Epic 6)
   - Server management
   - Document type configuration
   - Basic connector setup UI
   - **Estimate:** 10-12 agent days

2. **Dashboard** (Epic 7)
   - System alerts
   - Index status
   - Sync history widget
   - **Estimate:** 6-8 agent days

3. **Product Crawlers** (Epic 8)
   - SQL database connectors
   - Web crawlers (ManifoldCF)
   - Sync scheduling + monitoring
   - **Estimate:** 12-15 agent days

4. **Access Control** (Epic 9)
   - LDAP authentication
   - Role-based permissions
   - Document-level security
   - **Estimate:** 8-10 agent days

#### P1 - Should Have
5. **Live Views** (Epic 10)
   - Saved search builder
   - Shareable links
   - **Estimate:** 5-6 agent days

6. **Search Actions** (Epic 11)
   - Workflow hooks
   - External integrations
   - **Estimate:** 6-7 agent days

7. **Enhanced Search** (Epic 12)
   - Synonyms + stemming
   - Advanced query syntax
   - Faceted search
   - **Estimate:** 8-10 agent days

#### P2 - Nice to Have
8. **Multi-Source Support** (Epic 13)
   - MongoDB, Elasticsearch connectors
   - File system crawlers
   - **Estimate:** 10-12 agent days

9. **Performance Suite** (Epic 14)
   - Horizontal scaling
   - Cache layer (Redis)
   - Query optimization
   - **Estimate:** 8-10 agent days

---

## Strategic Recommendations

### Immediate (Post-V2)
1. **Build Admin Console** - Biggest gap, critical for enterprise adoption
2. **Add Dashboard** - Essential for operations/monitoring
3. **Implement Product Crawlers** - Unlock non-Nostr data sources

### Short-Term (V3)
4. **Add LDAP Auth + RBAC** - Enterprise security requirements
5. **Deploy Live Views** - Power-user feature, high ROI
6. **Enhance Search** - Synonyms, facets, advanced syntax

### Long-Term (V4+)
7. **Multi-Source Connectors** - MongoDB, SharePoint, S3
8. **Scale Infrastructure** - Horizontal scaling, HA, DR
9. **Mobile Apps** - Native iOS/Android

---

## Competitive Analysis

**Insight (Knova-lite):**
- Pros: Mature admin features, connector ecosystem, enterprise-ready
- Cons: Complex deployment, dated UI, expensive licensing

**Beacon:**
- Pros: Modern UI, Nostr-native, open source, rich content rendering
- Cons: No admin UI, limited connectors, missing monitoring

**Position:** Beacon is a **modern, Nostr-first search engine** that needs **enterprise admin tooling** to compete with Insight in B2B markets.

---

## ROI Estimate

**With Admin Console + Connectors (V3):**
- TAM expands from "Nostr community" → "Enterprise knowledge management"
- Potential customer base: 10x increase
- Pricing: $500-5K/mo enterprise plans (vs $10-30/mo community)

**Investment:** ~60 agent days (8-10 weeks with parallel execution)  
**Return:** Enterprise-ready product, B2B SaaS revenue stream

---

## Next Steps

1. **Review this gap analysis** with stakeholders
2. **Prioritize V3 epics** - Which admin features are must-haves?
3. **Create V3 PRD** - Full planning for Admin Console + Dashboard + Connectors
4. **Estimate timeline** - Target V3 launch date
5. **Allocate resources** - Spawn sub-agents for parallel development

---

**End of Gap Analysis**
