# Beacon Search ⇄ Knova-lite Feature Parity Analysis

**Last Updated:** 2026-02-13  
**Analyst:** Deep source code audit of both systems  
**Status:** Comprehensive enterprise feature comparison

---

## 🎯 Executive Summary

Beacon Search has **significantly evolved** beyond the original Knova-lite MVP assessment. Major progress has been made, but critical enterprise features remain missing.

| Category | Knova-lite | Beacon Search | Status |
|----------|-----------|---------------|--------|
| **Core Search** | Solr full-text | Hybrid (FTS + Vector) | ✅ Enhanced |
| **Connectors** | SQL-only, no-code | Web, Folder, Nostr (SQL planned) | ⚠️ Partial |
| **SQL Connectors** | Full implementation | Type defined, not implemented | ❌ Missing |
| **Sync Engine** | Metadata-first incremental | Implemented for web/folder | ⚠️ Partial |
| **Permissions** | Query-time filter injection | Schema ready, not implemented | ❌ Missing |
| **Binary Files** | Solr Tika extraction | Not implemented | ❌ Missing |
| **Admin UI** | JSF/PrimeFaces full console | React admin dashboard | ✅ Enhanced |
| **REST API** | Basic JAX-RS | Comprehensive Express API | ✅ Enhanced |
| **NLP/Tagging** | None | Full NLP pipeline + entities | ✅ New Feature |
| **Webhooks** | None | Full webhook system | ✅ New Feature |

**Critical Gap:** SQL-based connectors (Knova-lite's core strength) are NOT yet implemented in Beacon Search.

---

## 📋 Feature-by-Feature Comparison

### 1. SQL-Based Connectors ❌ MISSING (CRITICAL)

**Knova-lite Implementation:**
- **Location:** `knovalite_ejb/src/com/knova/lite/ejb/dbsource/DBSourceManager.java`
- **DAO Layer:** `DBSourceDAO.java` handles multi-database connectivity
- **Data Definition:** `DataDefinitionDTO.java` with fields:
  - `guid` - Unique identifier
  - `productId` - Product/tenant isolation
  - `description` - Human-readable description
  - `documentType` - Document type identifier
  - `isBinary` - Boolean flag for binary file handling
  - `metadataQuery` - SQL query returning `(external_id, last_modified)`
  - `dataQuery` - SQL query returning full documents (with `{IDS}` placeholder for batch fetch)
  - `permissionQuery` - SQL query returning user permission groups (with `{USER}` placeholder)
  - `permissionField` - Solr field name for permission filtering
  - `urlTemplate` - URL template with `{field_name}` placeholders

**Features:**
- Multi-database support: PostgreSQL, MySQL, Oracle, SQL Server
- Dynamic JDBC driver loading
- Connection pooling via JNDI DataSources
- Parameterized queries with placeholder replacement
- Batch document fetching (1000 docs at a time)
- JMS queue-based async processing

**Beacon Search Status:**
- **Type Definition:** ✅ `SqlConnectorConfig` defined in `connectors/types.ts`
  ```typescript
  export interface SqlConnectorConfig extends BaseConnectorConfig {
    type: 'sql';
    connectionString: string;
    metadataQuery: string;
    dataQuery: string;
  }
  ```
- **Implementation:** ❌ No `SqlConnector` class exists
- **DAO Layer:** ❌ Not implemented
- **Multi-DB Support:** ❌ Not implemented

**What's Needed:**
1. Create `backend/src/connectors/sql.ts` implementing `BaseConnector`
2. Add database client libraries (pg, mysql2, tedious, oracledb)
3. Implement query execution with parameter binding
4. Add connection testing and validation
5. Support `{IDS}` placeholder for batch fetching
6. Handle different SQL dialects

**Priority:** 🔴 CRITICAL (Core Knova-lite feature)

---

### 2. Metadata-First Incremental Sync ⚠️ PARTIAL

**Knova-lite Implementation:**
- **Location:** `knovalite_ejb/src/com/knova/lite/ejb/dbsource/DBSourceTimer.java`
- **Algorithm:**
  ```
  1. Fetch metadata from external source (cheap query: ID + timestamp only)
  2. Fetch metadata from Solr index
  3. Compare in memory:
     - If external_id exists in Solr:
       - If last_modified differs → mark for update
       - Else → skip (no change)
     - If external_id NOT in Solr → mark for add
  4. Remaining Solr IDs not in source → mark for delete
  5. Batch fetch changed documents (dataQuery with {IDS})
  6. Publish to JMS queue for async indexing
  7. Delete stale documents from Solr
  ```

**Key Features:**
- Minimizes data transfer (metadata only for comparison)
- Efficient diff algorithm (HashMap-based)
- Asynchronous processing via JMS queues
- Atomic batch operations
- Handles deletes cleanly

**Beacon Search Status:**
- ✅ Web connector implements incremental sync (URL-based deduplication)
- ✅ Folder connector watches file system changes
- ✅ Nostr connector uses event IDs for deduplication
- ❌ SQL connector not implemented (would use this pattern)
- ✅ Database schema supports `external_id` and `last_modified`
- ⚠️ Sync runs tracked in `connector_runs` table

**Implemented Connectors Using Incremental Sync:**
- **Web Spider:** Checks existing URLs before crawling
- **Folder:** Uses file modification timestamps
- **Nostr:** Uses event IDs + timestamps

**Missing:**
- SQL connector (the original use case)
- Efficient metadata-only comparison (current connectors fetch full content)

**Priority:** 🟡 HIGH (Performance optimization needed)

---

### 3. Permission Filtering at Query Time ❌ MISSING (IMPORTANT)

**Knova-lite Implementation:**
- **Location:** `knovalite_ejb/src/com/knova/lite/ejb/search/SearchManager.java`
- **Method:** `resolveAccessFilters(String user)`
- **Pattern:** Query-time filter injection (not post-filtering)

**Algorithm:**
```java
// For each data source with permissionQuery:
1. Execute permissionQuery with {USER} placeholder
   // Example: SELECT group_name FROM user_groups WHERE username = {USER}
2. Build Solr filter query:
   (doc_type:KB AND (perm_field:group1 OR perm_field:group2))
3. Inject as filter query (fq parameter in Solr)
```

**Example Permission Queries:**
```sql
-- From SharePoint source
SELECT DISTINCT group_name 
FROM sharepoint_permissions 
WHERE username = {USER} AND access_level >= 'Read'

-- From CRM source
SELECT account_id 
FROM crm_users 
WHERE email = {USER} AND is_active = true
```

**Benefits:**
- Filtering happens in search engine (fast)
- No post-query filtering overhead
- Scales to millions of documents
- Supports multi-tenant isolation

**Beacon Search Status:**
- ✅ Database schema has `permission_groups TEXT[]` column on `documents` table
- ✅ GIN index on `permission_groups` for fast filtering
- ❌ No user context in search API
- ❌ No permission resolution logic
- ❌ No filter injection in queries

**What's Needed:**
1. Add `userId` or `user` parameter to search endpoints
2. For each connector with `permissionQuery`, execute and resolve groups
3. Build PostgreSQL filter: `permission_groups && ARRAY['group1', 'group2']`
4. Inject filter into search queries (both vector and FTS)
5. Add permission testing UI in admin dashboard

**Priority:** 🟡 HIGH (Enterprise requirement)

---

### 4. URL Templates with Field Substitution ⚠️ PARTIAL

**Knova-lite Implementation:**
- **Location:** `SearchManager.formatUrl(String template, SolrDocument doc)`
- **Pattern:** Regex-based field substitution

**Examples:**
```
// Knowledge Base
https://kb.example.com/article/{search_external_id}

// CRM Cases
https://crm.example.com/case/{attr_case_number}/view

// SharePoint
{attr_site_url}/_layouts/15/WopiFrame.aspx?sourcedoc={search_external_id}

// Complex multi-field
https://erp.example.com/{attr_module}/record/{attr_record_type}/{attr_record_id}
```

**Regex Implementation:**
```java
private static final String regex = "\\{([^}]+)\\}";
private static final Pattern pattern = Pattern.compile(regex);

public static String formatUrl(String format, SolrDocument doc) {
    Matcher m = pattern.matcher(format);
    String result = format;
    while (m.find()) {
        String key = m.group(1);
        Object newVal = doc.getFirstValue(key);
        if (newVal == null) return null;
        result = result.replaceFirst(regex, newVal.toString());
    }
    return result;
}
```

**Beacon Search Status:**
- ✅ Database schema has URL template fields:
  - `portal_url` - Base URL of source system
  - `item_url_template` - Deep link template
  - `search_url_template` - Search in source template
  - `edit_url_template` - Edit link template
- ⚠️ Templates stored but not currently used
- ❌ No template resolution logic in search results
- ✅ Schema supports dynamic `attributes` JSONB field

**What's Needed:**
1. Implement template resolution function in `backend/src/utils/url-templates.ts`
2. Apply templates when returning search results
3. Support fallback if fields are missing
4. Add template preview/testing in admin UI

**Priority:** 🟢 MEDIUM (High value, easy to implement)

---

### 5. Binary File Handling (PDF, Office, etc.) ❌ MISSING

**Knova-lite Implementation:**
- **Location:** `SolrManager.addBinaryFilesFromRecords()`
- **Pattern:** Solr's `ExtractingRequestHandler` (Apache Tika integration)

**Features:**
- Automatic text extraction from:
  - PDF documents
  - Microsoft Office (Word, Excel, PowerPoint)
  - OpenOffice/LibreOffice
  - HTML/XML
  - Images (OCR not included)
- Metadata extraction (author, title, created date)
- Content type detection
- Binary content stored in `search_doc_content` field as bytes
- Full-text indexed content in `search_doc_searchtext` field

**Code Pattern:**
```java
ContentStreamUpdateRequest up = new ContentStreamUpdateRequest("/update/extract");
byte[] bytes = (byte[]) map.get(SolrSchema.CONTENT);
up.addContentStream(new ContentStreamBase.ByteArrayStream(bytes, filename));

// Map metadata fields
up.setParam("literal.search_doc_external_id", externalId);
up.setParam("literal.search_doc_title", title);
up.setParam("fmap.content", SolrSchema.CONTENT);

solr.request(up);
```

**Beacon Search Status:**
- ❌ No binary file handling
- ❌ No Tika integration
- ⚠️ Some file handling in folder connector (text files only)
- ✅ NLP system has OCR support but not integrated with connectors

**What's Needed:**
1. Add Apache Tika or alternative (pdf-parse, mammoth for DOCX)
2. Create `backend/src/processors/binary.ts` for extraction
3. Integrate with folder connector
4. Add to SQL connector for BLOB columns
5. Handle large files (streaming, chunking)

**Priority:** 🟡 HIGH (Common enterprise requirement)

---

### 6. Document Type System ✅ IMPLEMENTED

**Knova-lite:**
- Each connector defines `documentType`
- Standard Solr fields: `search_doc_type`, `search_doc_title`, `search_doc_content`
- Dynamic fields: `attr_*` for source-specific attributes
- Filtering/faceting by type

**Beacon Search:**
- ✅ `document_type` column in documents table
- ✅ Dynamic `attributes` JSONB field
- ✅ Faceting support in NLP system
- ✅ Can filter by document type in search

**Status:** ✅ COMPLETE (Enhanced with JSONB flexibility)

---

### 7. Multi-Source Search ✅ IMPLEMENTED

**Knova-lite:**
- Multiple data source definitions
- Unified Solr index
- Search across all sources simultaneously

**Beacon Search:**
- ✅ Multiple connectors (web, folder, nostr)
- ✅ Unified documents table
- ✅ Can filter by `source_id` in queries
- ✅ Search across all sources

**Status:** ✅ COMPLETE

---

### 8. Scheduled Indexing ⚠️ PARTIAL

**Knova-lite:**
- **Pattern:** EJB Timer Service with `@Schedule` annotation
- **Example:** `@Schedule(second="0", minute="*/30", hour="*", ...)`
- **Features:**
  - Per-connector cron schedules
  - Automatic retry on failure
  - Concurrent execution control
  - Persistent timers (survive server restart)

**Beacon Search:**
- ❌ No built-in scheduler
- ⚠️ Manual trigger via API: `POST /api/connectors/:id/run`
- ⚠️ Could integrate with external cron/scheduler

**What's Needed:**
1. Add `node-cron` or similar scheduler
2. Parse `sync_schedule` field from connectors
3. Create `backend/src/scheduler/index.ts`
4. Auto-schedule when connector is created/enabled
5. Add schedule management UI

**Priority:** 🟢 MEDIUM (Can use external scheduler for now)

---

### 9. Admin Dashboard ✅ ENHANCED

**Knova-lite:**
- JSF/PrimeFaces console
- Manage data sources (CRUD)
- Test connections
- Trigger manual sync
- View sync history
- Basic statistics

**Beacon Search:**
- ✅ **Full React admin dashboard** at `/admin`
- ✅ **Pages:**
  - Dashboard Home
  - Sources Management (Connectors)
  - Documents Browser
  - Ontology Manager
  - Dictionary Editor
  - Triggers Editor
  - Webhooks Manager
  - Analytics
  - Settings
- ✅ **Features Beyond Knova:**
  - Real-time connector status
  - Webhook management
  - NLP ontology editing
  - Tag/entity dictionaries
  - Query analytics
  - Modern responsive UI

**Status:** ✅ COMPLETE + ENHANCED (Far exceeds Knova-lite)

---

### 10. REST API ✅ ENHANCED

**Knova-lite:**
- **Location:** `knovalite_ws/src/com/knova/lite/ws/Atlantis.java`
- **Endpoints:**
  - `GET /search/json/{query}` - Basic search
  - `GET /search/query/{query}` - Full search with pagination
  - `GET /search/config/{name}` - Get config value
  - `GET /search/status/{instance}` - Sync status

**Beacon Search:**
- ✅ **Comprehensive Express API:**
  - **Search:**
    - `GET /api/search` - Hybrid search
    - `GET /api/search/filtered` - Faceted search
    - `GET /api/search/facets` - Get facets
  - **Documents:**
    - `GET /api/documents` - List documents
    - `GET /api/documents/:id` - Get document
    - `POST /api/documents` - Create document
    - `PUT /api/documents/:id` - Update document
    - `DELETE /api/documents/:id` - Delete document
  - **Connectors:**
    - Full CRUD operations
    - Run, stop, test connection
    - Get run history and logs
  - **NLP:**
    - Tags, entities, metadata
    - Process, train, status
  - **Webhooks:**
    - Full CRUD + test/trigger
  - **Git Config:**
    - Commit, push, pull, status

**Status:** ✅ COMPLETE + ENHANCED (Far exceeds Knova-lite)

---

### 11. Search Features Comparison

| Feature | Knova-lite | Beacon Search | Status |
|---------|-----------|---------------|--------|
| Full-text search | ✅ Solr | ✅ PostgreSQL FTS | ✅ Complete |
| Vector/semantic search | ❌ | ✅ pgvector | ✅ Enhanced |
| Hybrid search | ❌ | ✅ RRF fusion | ✅ Enhanced |
| Highlighting | ✅ Solr snippets | ✅ Implemented | ✅ Complete |
| Pagination | ✅ start/rows | ✅ offset/limit | ✅ Complete |
| Faceting | ⚠️ Basic | ✅ Advanced (tags, entities, sentiment) | ✅ Enhanced |
| Sorting | ✅ Score-based | ✅ Score + date | ✅ Complete |
| Query time | ✅ Reported | ✅ Reported | ✅ Complete |
| Result count | ✅ | ✅ | ✅ Complete |
| User context | ✅ Permission filtering | ❌ Not implemented | ❌ Missing |

---

### 12. NLP & Analytics ✅ NEW FEATURES (Beyond Knova-lite)

Beacon Search includes a **full NLP pipeline** that Knova-lite never had:

**Auto-Tagging:**
- ✅ TF-IDF keyword extraction with corpus training
- ✅ RAKE algorithm for multi-word phrases
- ✅ Topic classification (Technology, Business, Science, etc.)
- ✅ Manual tag management
- ✅ Tag suggestions based on similar documents

**Named Entity Recognition:**
- ✅ PERSON extraction (names with titles/suffixes)
- ✅ ORGANIZATION extraction
- ✅ LOCATION extraction
- ✅ DATE extraction (multiple formats)
- ✅ MONEY extraction
- ✅ EMAIL/PHONE/URL extraction
- ✅ Entity normalization

**Metadata Extraction:**
- ✅ Reading time estimation
- ✅ Word/character count
- ✅ Sentiment analysis
- ✅ Document type classification
- ✅ Author detection
- ✅ Content features (code, lists, tables)

**Analytics:**
- ✅ Search query logging
- ✅ Result click tracking
- ✅ Tag cloud visualization
- ✅ Entity relationship graphs

**Status:** ✅ COMPLETE (Major enhancement beyond Knova-lite)

---

### 13. Webhooks ✅ NEW FEATURE

**Beacon Search adds enterprise webhook system:**

**Features:**
- ✅ Event subscriptions (connector.*, document.*, search.*)
- ✅ HMAC signature verification
- ✅ Retry logic with exponential backoff
- ✅ Delivery history and status tracking
- ✅ Custom headers support
- ✅ Test webhook functionality
- ✅ Admin UI for webhook management

**Database Schema:**
- `webhooks` table with events, URL, secret
- `webhook_deliveries` table with retry queue

**Status:** ✅ COMPLETE (New feature not in Knova-lite)

---

### 14. Configuration Management

| Feature | Knova-lite | Beacon Search | Status |
|---------|-----------|---------------|--------|
| Config storage | ✅ Database table | ✅ .env + database | ✅ Complete |
| Multi-tenant | ✅ ProductId field | ❌ Not implemented | ❌ Missing |
| Config UI | ✅ Settings page | ✅ Settings page | ✅ Complete |
| Git-backed config | ❌ | ✅ Git sync support | ✅ Enhanced |
| Environment vars | ⚠️ JNDI | ✅ .env file | ✅ Complete |

---

### 15. Sync Status & Monitoring

**Knova-lite:**
- `SyncStatusSingleton` - EJB singleton for status tracking
- `SyncHistoryDAO` - Persistent sync history
- Status API endpoint
- Tracks: adds, updates, deletes, errors

**Beacon Search:**
- ✅ `connector_runs` table with full history
- ✅ Real-time status via REST API
- ✅ Detailed logs stored in JSONB
- ✅ Admin UI shows live progress
- ✅ Webhook events for sync completion

**Status:** ✅ COMPLETE + ENHANCED

---

## 🚨 Critical Missing Features Summary

### 1. SQL Connector Implementation ❌
**Impact:** Cannot connect to enterprise databases (core Knova-lite use case)  
**Effort:** 8-12 hours  
**Priority:** 🔴 CRITICAL

### 2. Permission Filtering ❌
**Impact:** Cannot secure multi-tenant/multi-user deployments  
**Effort:** 4-6 hours  
**Priority:** 🔴 CRITICAL

### 3. Binary File Handling ❌
**Impact:** Cannot index PDFs, Office docs  
**Effort:** 6-8 hours  
**Priority:** 🟡 HIGH

### 4. URL Template Resolution ⚠️
**Impact:** Cannot generate deep links to source systems  
**Effort:** 2-3 hours  
**Priority:** 🟢 MEDIUM

### 5. Multi-Tenancy ❌
**Impact:** Cannot isolate data between products/customers  
**Effort:** 4-6 hours  
**Priority:** 🟡 HIGH (for SaaS deployments)

### 6. Scheduled Sync ⚠️
**Impact:** Must manually trigger syncs  
**Effort:** 3-4 hours  
**Priority:** 🟢 MEDIUM

---

## 📊 Implementation Roadmap

### Phase 1: SQL Connector (CRITICAL) 🔴
**Goal:** Achieve feature parity with Knova-lite's core strength

**Tasks:**
1. Create `backend/src/connectors/sql.ts` extending `BaseConnector`
2. Add database drivers: `pg`, `mysql2`, `tedious` (SQL Server), `oracledb`
3. Implement connection pooling and testing
4. Support `metadataQuery` and `dataQuery` with placeholder substitution
5. Implement metadata-first sync algorithm
6. Add SQL connector UI in admin dashboard
7. Create example configurations for common databases

**Files to Create:**
- `backend/src/connectors/sql.ts`
- `backend/src/connectors/sql-dialects.ts` (database-specific handling)

**Files to Modify:**
- `backend/src/connectors/manager.ts` - Register SQL connector
- `backend/src/connectors/routes.ts` - Add SQL-specific validation
- `frontend/src/admin/pages/SourcesManagement.js` - Add SQL connector form

**Test Cases:**
- Connect to PostgreSQL
- Connect to MySQL
- Connect to SQL Server
- Metadata query execution
- Batch data fetch with {IDS}
- Error handling (connection failure, query error)

**Estimated Effort:** 8-12 hours  
**Deliverable:** Working SQL connector that matches Knova-lite behavior

---

### Phase 2: Permission System 🟡
**Goal:** Secure search with query-time filtering

**Tasks:**
1. Add `userId` parameter to search endpoints
2. Create `backend/src/permissions/resolver.ts`
3. For SQL connectors with `permissionQuery`, execute and resolve groups
4. Build PostgreSQL filter: `permission_groups && ARRAY[...]`
5. Inject filter into all search queries
6. Add permission testing UI
7. Document permission patterns

**Files to Create:**
- `backend/src/permissions/resolver.ts`
- `backend/src/permissions/filters.ts`

**Files to Modify:**
- `backend/src/index.ts` - Add auth middleware
- Search routes - Add permission filtering
- `frontend/src/App.js` - Add user context

**Estimated Effort:** 4-6 hours

---

### Phase 3: Binary File Handling 🟡
**Goal:** Index PDF, Office, and other binary documents

**Tasks:**
1. Add dependencies: `pdf-parse`, `mammoth` (DOCX), `xlsx` (Excel)
2. Create `backend/src/processors/binary.ts`
3. Detect content type and route to appropriate extractor
4. Integrate with folder connector
5. Add to SQL connector for BLOB columns
6. Handle large files (streaming, memory limits)

**Dependencies:**
```bash
npm install pdf-parse mammoth xlsx
```

**Estimated Effort:** 6-8 hours

---

### Phase 4: URL Templates & Polish 🟢
**Goal:** Complete remaining Knova-lite features

**Tasks:**
1. Implement template resolution function
2. Apply templates when returning search results
3. Add scheduled sync with node-cron
4. Multi-tenancy support (productId field)
5. Documentation and examples

**Estimated Effort:** 6-8 hours

---

## ✅ Feature Parity Checklist

### Core Knova-lite Features

- [x] Full-text search
- [ ] SQL-based connectors ❌
- [x] Metadata-first sync (for web/folder)
- [ ] Metadata-first sync for SQL ❌
- [ ] Permission query system ❌
- [ ] Query-time permission filtering ❌
- [x] URL templates (stored, not resolved)
- [ ] URL template resolution ❌
- [x] Document type system
- [x] Dynamic attributes
- [x] Multi-source search
- [ ] Scheduled indexing ⚠️
- [x] Admin dashboard
- [x] REST API
- [ ] Binary file handling ❌
- [x] Sync history
- [x] Manual sync trigger
- [ ] Multi-tenancy ❌

### Enhanced Features in Beacon Search

- [x] Vector/semantic search
- [x] Hybrid search with RRF
- [x] NLP auto-tagging
- [x] Named entity recognition
- [x] Sentiment analysis
- [x] Relationship mapping
- [x] Webhook system
- [x] Git-backed configuration
- [x] Modern React UI
- [x] Web crawler connector
- [x] Folder watcher connector
- [x] Nostr connector
- [x] Real-time connector status
- [x] Advanced analytics

---

## 🎯 Success Criteria

Beacon Search reaches **full feature parity** with Knova-lite when:

- ✅ Can define SQL data source via admin UI (no code changes)
- ✅ SQL connector executes `metadataQuery` and `dataQuery`
- ✅ Incremental sync detects and indexes only changed documents
- ✅ Permission filtering works at query time (not post-processing)
- ✅ Binary files (PDF, Office) are automatically extracted and indexed
- ✅ Search results include generated URLs from templates
- ✅ Multi-tenant isolation via productId

---

## 📚 References

### Knova-lite Source Files Reviewed

**EJB Layer:**
- `knovalite_ejb/src/com/knova/lite/ejb/dbsource/DBSourceManager.java`
- `knovalite_ejb/src/com/knova/lite/ejb/dbsource/DBSourceDAO.java`
- `knovalite_ejb/src/com/knova/lite/ejb/dbsource/DBSourceTimer.java`
- `knovalite_ejb/src/com/knova/lite/ejb/search/SearchManager.java`
- `knovalite_ejb/src/com/knova/lite/ejb/solr/SolrManager.java`
- `knovalite_ejb/src/com/knova/lite/ejb/solr/SolrSchema.java`
- `knovalite_ejb/src/com/knova/lite/ejb/configuration/ConfigurationManager.java`

**Client DTOs:**
- `knovalite_client/src/com/knova/lite/ejb/configuration/DataDefinitionDTO.java`
- `knovalite_client/src/com/knova/lite/ejb/search/SearchResult.java`
- `knovalite_client/src/com/knova/lite/ejb/search/SearchResults.java`

**UI Layer:**
- `knovalite_ui/src/com/knova/lite/ui/Console.java`
- `knovalite_ui/src/com/knova/lite/ui/Search.java`
- `knovalite_ui/WebContent/definitions.xhtml`
- `knovalite_ui/WebContent/search.xhtml`

**Web Services:**
- `knovalite_ws/src/com/knova/lite/ws/Atlantis.java`

### Beacon Search Files Reviewed

**Backend:**
- `backend/src/connectors/manager.ts`
- `backend/src/connectors/types.ts`
- `backend/src/connectors/base.ts`
- `backend/src/connectors/web-spider.ts`
- `backend/src/connectors/folder.ts`
- `backend/src/connectors/nostr.ts`
- `backend/src/connectors/routes.ts`
- `backend/src/index.ts`
- `init.sql`

**Frontend:**
- `frontend/src/App.js`
- `frontend/src/admin/index.js`
- `frontend/src/admin/pages/SourcesManagement.js`

---

## 🔍 Conclusion

Beacon Search has **evolved significantly beyond** the initial Knova-lite port and includes many enterprise features that Knova-lite never had (NLP, webhooks, vector search). However, the **critical SQL connector functionality** remains unimplemented.

**Key Takeaway:** Beacon Search is not a "port" anymore—it's a **modernized, enhanced successor** to Knova-lite. The main gap is SQL connectivity, which can be addressed in Phase 1 (8-12 hours of focused development).

**Recommendation:** Implement SQL connector first (Phase 1), then permissions (Phase 2), to achieve full enterprise feature parity while retaining all the modern enhancements.

---

**Document Status:** ✅ COMPLETE  
**Next Action:** Implement Phase 1 (SQL Connector)  
**Owner:** Development Team  
**Review Date:** 2026-02-13
