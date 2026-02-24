# Legacy Analysis: Knova-lite

**Source:** `~/Documents/knova-lite/` (Java EJB enterprise search platform, circa 2015)

## Overview

Knova-lite was a Java EE enterprise search platform built on:
- **JBoss/WildFly** application server
- **EJB 3.x** for business logic (Stateless Session Beans, Singletons, MDBs)
- **Apache Solr** for full-text search
- **JSF/PrimeFaces** for the admin UI
- **JAX-RS** for REST API

It provided a unified search interface across multiple database sources, with permission-aware filtering and configurable data connectors.

## Architecture

### Module Structure

```
knova-lite/
├── knovalite_ejb/       # Core business logic (EJBs)
├── knovalite_client/    # Remote interfaces and DTOs
├── knovalite_ui/        # JSF web application
├── knovalite_ws/        # REST web services
└── knovalite/           # EAR packaging
```

### Key Components

#### 1. Search Manager (`SearchManager.java`)
The heart of the system. Responsibilities:
- Execute Solr queries
- Apply permission filters
- Format results with highlights
- Construct URLs back to source documents

```java
@Stateless
@Remote(SearchManagerRemote.class)
public class SearchManager implements SearchManagerRemote {
    @Inject ConfigurationDAO _dao;
    @Inject ConfigurationManager _config;
    @EJB DBSourceManager _repo;
    
    public SearchResults doSearch(String searchString, int start, int rows, String user) {
        // Query Solr
        // Apply permission filters
        // Map results with highlights
        // Generate URLs from templates
    }
}
```

**What was good:**
- Clean separation of search logic from data access
- Permission filtering happens at query time, not post-filter
- Configurable field lists and highlighting

**What to keep:**
- The concept of filter queries for permissions
- URL template system for deep links
- Attribute extraction pattern

#### 2. Solr Manager (`SolrManager.java`)
Handles document indexing to Solr.

```java
@Stateless
public class SolrManager implements SolrManagementRemote {
    public void addDocumentsFromRecords(String documentType, ArrayList<Map<String, Object>> recordList);
    public void addBinaryFilesFromRecords(String documentType, ArrayList<Map<String, Object>> recordList);
    public HashMap<Object, SolrMetaDataDTO> getMetaData(String documentType);
    public int removeDocuments(ArrayList<String> solrIdsToRemove);
}
```

**What was good:**
- Separation of text vs binary document handling
- Chunked processing (1000 docs at a time)
- Metadata-first approach for sync comparison

**What to modernize:**
- Replace Solr with PostgreSQL + pgvector
- Add embedding generation step

#### 3. DB Source Manager (`DBSourceManager.java`)
Connects to external databases and extracts records.

```java
@Stateless
public class DBSourceManager implements DBSourceManagerRemote {
    public HashMap<Object, String> getMetaData(DataDefinitionDTO dataDefinition);
    public ArrayList<String> getPermissionGroupsForUser(DataDefinitionDTO dataDefinition, String currentUser);
    public void addDocumentsByIds(RepositoryProcessIDsDTO dto);
}
```

Uses JMS queues for async processing:
```java
@JMSDestinationDefinition(
    name = "java:/jms/queue/DBDocumentQueue",
    interfaceName = "javax.jms.Queue"
)
```

**What was good:**
- SQL-based connector configuration (no code changes for new sources)
- Async document processing via JMS
- Permission query abstraction

**What to keep:**
- SQL-based connector pattern
- Async processing for large batches
- Separation of metadata fetch vs full document fetch

#### 4. Data Definition DTO
The core configuration model:

```java
public class DataDefinitionDTO {
    String guid;
    String productId;
    String description;
    String documentType;
    Boolean isBinary;
    String metaDataQuery;     // SQL to get IDs and timestamps
    String permissionQuery;   // SQL to get user's permission groups
    String permissionField;   // Solr field for permission filtering
    String dataQuery;         // SQL to get full document content
    String urlTemplate;       // Template with {field} placeholders
}
```

**This is brilliant.** The entire connector is configured via SQL queries:
- `metaDataQuery` returns `(search_external_id, search_last_modified)` — used for sync comparison
- `dataQuery` returns full document with `{IDS}` placeholder for batch fetch
- `permissionQuery` resolves `{USER}` to their permission groups
- `permissionField` specifies which Solr field to filter on

**Must keep this pattern** — it allows new data sources without code changes.

#### 5. Sync Timer (`DBSourceTimer.java`)
Orchestrates incremental synchronization:

```java
public void processRecords(DataDefinitionDTO dataDefinition) {
    // 1. Get metadata from source database (ID + timestamp)
    HashMap<Object, String> repositoryList = _dbSourceMgr.getMetaData(dataDefinition);
    
    // 2. Get metadata from Solr (ID + timestamp)
    HashMap<Object, SolrMetaDataDTO> solrRecordList = _solrMgr.getMetaData(docType);
    
    // 3. Compare: find adds, updates, deletes
    ArrayList<IdPair> repositoryIdsToAdd = new ArrayList<>();
    for (entry : repositoryList) {
        if (solrRecordList.containsKey(externalId)) {
            if (!timestamps.match()) {
                repositoryIdsToAdd.add(new IdPair(externalId, solrId)); // Update
            }
        } else {
            repositoryIdsToAdd.add(new IdPair(externalId, null)); // Add
        }
    }
    
    // 4. Queue for async processing
    _dbSourceMgr.publishDocumentIds(new RepositoryProcessIDsDTO(dataDefinition, repositoryIdsToAdd));
}
```

**Elegant sync algorithm:**
1. Fetch only metadata (cheap)
2. Compare in memory
3. Batch fetch only changed documents
4. Process asynchronously

**Must keep this pattern.**

#### 6. Solr Schema
Standard fields for all documents:

```java
public class SolrSchema {
    public static final String ID = "id";
    public static final String EXTERNAL_ID = "search_doc_external_id";
    public static final String LAST_MODIFIED = "search_doc_last_modified";
    public static final String TITLE = "search_doc_title";
    public static final String FILENAME = "search_doc_filename";
    public static final String CONTENT = "search_doc_content";
    public static final String DOC_TYPE = "search_doc_type";
    public static final String FALLBACK_SNIPPET = "search_snippet";
    public static final String SEARCH_TEXT = "search_text";  // Derived/copyField
}
```

Plus dynamic fields: `attr_*` for custom attributes per document type.

**Good design.** Standard fields + extensible attributes.

#### 7. Permission Filtering
At search time, generates Solr filter queries:

```java
public String resolveAccessFilters(String user) {
    StringBuilder permFilter = new StringBuilder();
    for (DataDefinitionDTO def : defs) {
        ArrayList<String> perms = _repo.getPermissionGroupsForUser(def, user);
        // Build: (search_doc_type:KB AND (perm_field:group1 OR perm_field:group2))
    }
    return permFilter.toString();
}
```

**This is the key insight:** Permissions are enforced via Solr filter queries, not post-filtering. Fast and secure.

#### 8. REST API (`Atlantis.java`)
Clean JSON API:

```java
@Path("/")
public class Atlantis {
    @GET @Path("query/{query}")
    public JsonObject executeQuery(
        @PathParam("query") String query,
        @QueryParam("start") int first,
        @QueryParam("pageSize") int pageSize,
        @QueryParam("user") String user
    ) {
        SearchResults response = solrSearch.doSearch(query, first, pageSize, user);
        // Return JSON with results, totalResults, queryTime, etc.
    }
    
    @GET @Path("status/{instance}")
    public JsonObject getStatus(@PathParam("instance") String instance);
}
```

**Good API design.** Pagination, user context, status endpoints.

## Data Model

### Configuration Tables

```sql
CREATE TABLE config (
    name VARCHAR(255) PRIMARY KEY,
    value VARCHAR(2000)
);

CREATE TABLE data_definitions (
    guid VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(255),
    description VARCHAR(255),
    document_type VARCHAR(255),
    is_binary BIT,
    metadata_query TEXT,
    data_query TEXT,
    url_pattern VARCHAR(500),
    permission_query TEXT,
    permission_field VARCHAR(255)
);

CREATE TABLE sync_history (
    id VARCHAR(36) PRIMARY KEY,
    start_time DATETIME,
    end_time DATETIME,
    to_delete BIGINT,
    to_update BIGINT,
    to_add BIGINT,
    doc_type VARCHAR(255)
);
```

### Example Data Definition

```sql
INSERT INTO data_definitions VALUES (
    'uuid-here',
    'product-1',
    'Knowledge Base Articles',
    'KB_ARTICLE',
    0,  -- not binary
    'SELECT article_id AS search_external_id, modified_date AS search_last_modified FROM kb_articles',
    'SELECT article_id AS search_external_id, modified_date AS search_last_modified, 
            title AS search_title, body AS search_content,
            category AS attr_category, author AS attr_author
     FROM kb_articles WHERE article_id IN ({IDS})',
    'https://kb.example.com/article/{search_external_id}',
    'SELECT group_id FROM user_groups WHERE user_id = {USER}',
    'article_access_group'
);
```

## What Worked Well

1. **SQL-based connectors** — No code changes for new data sources
2. **Metadata-first sync** — Efficient incremental updates
3. **Permission at query time** — Secure and fast
4. **URL templates** — Deep links back to source systems
5. **Async processing** — JMS queues for large batch operations
6. **Clean separation** — EJB layers, DAO pattern, DTOs

## What Needs Modernization

1. **Java EJB** — Heavyweight, complex deployment, slow development
2. **Solr** — Separate service to manage; PostgreSQL FTS is often enough
3. **JSF/PrimeFaces** — Outdated UI technology
4. **No semantic search** — Pure keyword matching
5. **No AI integration** — No RAG, no suggestions
6. **Manual sync trigger** — No smart scheduling
7. **Limited observability** — Basic status only

## Patterns to Preserve

| Pattern | Why It's Good | Modern Implementation |
|---------|---------------|----------------------|
| SQL connector config | No-code extensibility | Keep as-is, maybe add JSON/YAML option |
| Metadata-first sync | Efficient | Keep algorithm, use modern queue |
| Permission filter injection | Secure, fast | Keep approach, use PostgreSQL RLS option |
| URL templates | User convenience | Keep pattern |
| Document type system | Organized | Keep, add schema validation |
| Async batch processing | Scalable | Bull/BullMQ instead of JMS |

## Migration Notes

### Data Migration
- Config values → environment variables or config file
- Data definitions → migrate to new schema
- Sync history → optional, start fresh

### Search Index Migration
- Not recommended to migrate Solr → PostgreSQL
- Re-index from source databases
- Take opportunity to generate embeddings

### API Compatibility
- Consider maintaining `/query/{query}` endpoint shape
- Add GraphQL as new option, keep REST for compatibility
