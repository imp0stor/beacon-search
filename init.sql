-- Beacon Search Schema
-- Includes Knova-lite patterns: SQL connectors, metadata-first sync, URL templates
-- Extended with web spider and folder connectors

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- CONNECTORS (New unified connector system)
-- ============================================

CREATE TABLE IF NOT EXISTS connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    connector_type VARCHAR(50) NOT NULL,  -- 'sql', 'web', 'folder'
    
    -- Configuration (JSON based on type)
    config JSONB NOT NULL DEFAULT '{}',
    -- Web: {"seedUrl": "...", "maxDepth": 2, "sameDomainOnly": true, ...}
    -- Folder: {"folderPath": "/data", "recursive": true, "fileTypes": [".txt", ".md"], ...}
    -- SQL: {"connectionString": "...", "metadataQuery": "...", "dataQuery": "..."}
    
    -- Source Portal URL Templates
    portal_url VARCHAR(2000),                -- Base URL of the source system
    item_url_template VARCHAR(2000),         -- Deep link: {portal_url}/view/{external_id}
    search_url_template VARCHAR(2000),       -- Search in source: {portal_url}/search?q={query}
    edit_url_template VARCHAR(2000),         -- Edit in source: {portal_url}/edit/{external_id}
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),  -- 'idle', 'running', 'completed', 'failed', 'stopped'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONNECTOR RUNS (Run history)
-- ============================================

CREATE TABLE IF NOT EXISTS connector_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    documents_added INTEGER DEFAULT 0,
    documents_updated INTEGER DEFAULT 0,
    documents_removed INTEGER DEFAULT 0,
    error_message TEXT,
    log JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_connector_runs_connector 
ON connector_runs(connector_id, started_at DESC);

-- ============================================
-- WEBHOOKS (Callback/notification system)
-- ============================================

CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2000) NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',  -- Event types to subscribe to
    headers JSONB DEFAULT '{}',           -- Custom headers to include
    enabled BOOLEAN DEFAULT true,
    secret VARCHAR(255) NOT NULL,         -- HMAC signing secret
    
    -- Status tracking
    last_triggered_at TIMESTAMPTZ,
    last_status INTEGER,                  -- HTTP status of last delivery
    failure_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);

-- ============================================
-- WEBHOOK DELIVERIES (Delivery history & retry queue)
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'failed'
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook 
ON webhook_deliveries(webhook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status 
ON webhook_deliveries(status, created_at) WHERE status = 'pending';

-- ============================================
-- DATA SOURCES (Legacy - keeping for backwards compat)
-- ============================================

CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(255) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL DEFAULT 'postgresql',
    connection_config JSONB NOT NULL DEFAULT '{}',
    metadata_query TEXT NOT NULL,
    data_query TEXT NOT NULL,
    permission_query TEXT,
    permission_field VARCHAR(255),
    url_template VARCHAR(2000),
    sync_schedule VARCHAR(100),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS (Enhanced with connector support)
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source tracking (can be connector or legacy data_source)
    source_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    document_type VARCHAR(255) NOT NULL DEFAULT 'manual',
    
    -- Standard fields
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    url VARCHAR(2000),
    
    -- Timestamps
    last_modified TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Dynamic attributes
    attributes JSONB DEFAULT '{}',
    
    -- Permissions
    permission_groups TEXT[] DEFAULT '{}',
    
    -- Search vectors
    embedding vector(384)
);

-- Unique constraint for connector documents
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_source_external 
ON documents(source_id, external_id) 
WHERE source_id IS NOT NULL AND external_id IS NOT NULL;

-- ============================================
-- SYNC HISTORY (Legacy)
-- ============================================

CREATE TABLE IF NOT EXISTS sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    documents_added INTEGER DEFAULT 0,
    documents_updated INTEGER DEFAULT 0,
    documents_removed INTEGER DEFAULT 0,
    error_message TEXT,
    CONSTRAINT sync_history_source_time_idx UNIQUE (source_id, started_at)
);

-- ============================================
-- INDEXES
-- ============================================

-- Vector similarity search
CREATE INDEX IF NOT EXISTS idx_documents_embedding 
ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_documents_content 
ON documents USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_documents_title 
ON documents USING gin(to_tsvector('english', title));

-- Document type filtering
CREATE INDEX IF NOT EXISTS idx_documents_type 
ON documents(document_type);

-- Source filtering
CREATE INDEX IF NOT EXISTS idx_documents_source 
ON documents(source_id);

-- Permission filtering
CREATE INDEX IF NOT EXISTS idx_documents_permissions 
ON documents USING GIN(permission_groups);

-- Connector indexes
CREATE INDEX IF NOT EXISTS idx_connectors_type 
ON connectors(connector_type);

CREATE INDEX IF NOT EXISTS idx_connectors_active 
ON connectors(is_active);

-- ============================================
-- ONTOLOGY TABLE (Hierarchical term expansion)
-- ============================================

CREATE TABLE IF NOT EXISTS ontology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES ontology(id) ON DELETE SET NULL,
    term VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    synonyms TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ontology_parent ON ontology(parent_id);
CREATE INDEX IF NOT EXISTS idx_ontology_term ON ontology(term);
CREATE INDEX IF NOT EXISTS idx_ontology_synonyms ON ontology USING GIN(synonyms);

-- ============================================
-- ONTOLOGY ALIASES (Synonyms, abbreviations, phrases)
-- ============================================

CREATE TABLE IF NOT EXISTS ontology_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50) NOT NULL DEFAULT 'synonym',
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (concept_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_ontology_aliases_alias ON ontology_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_ontology_aliases_type ON ontology_aliases(alias_type);

-- ============================================
-- ONTOLOGY RELATIONS (Broader, narrower, related)
-- ============================================

CREATE TABLE IF NOT EXISTS ontology_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
    relation_type VARCHAR(30) NOT NULL,
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source_id, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_ontology_relations_source ON ontology_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_target ON ontology_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_type ON ontology_relations(relation_type);

-- ============================================
-- ONTOLOGY TAXONOMIES (Domain groupings)
-- ============================================

CREATE TABLE IF NOT EXISTS ontology_taxonomies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ontology_concept_taxonomies (
    concept_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
    taxonomy_id UUID NOT NULL REFERENCES ontology_taxonomies(id) ON DELETE CASCADE,
    rank INTEGER DEFAULT 0,
    PRIMARY KEY (concept_id, taxonomy_id)
);

CREATE INDEX IF NOT EXISTS idx_ontology_concept_taxonomies_taxonomy ON ontology_concept_taxonomies(taxonomy_id);

-- ============================================
-- DICTIONARY TABLE (Synonyms and acronym expansion)
-- ============================================

CREATE TABLE IF NOT EXISTS dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term VARCHAR(255) NOT NULL UNIQUE,
    synonyms TEXT[] DEFAULT '{}',
    acronym_for VARCHAR(500),  -- If term is an acronym, what it expands to
    domain VARCHAR(100),       -- e.g., 'technology', 'medicine', 'finance'
    boost_weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dictionary_term ON dictionary(term);
CREATE INDEX IF NOT EXISTS idx_dictionary_synonyms ON dictionary USING GIN(synonyms);
CREATE INDEX IF NOT EXISTS idx_dictionary_domain ON dictionary(domain);
CREATE INDEX IF NOT EXISTS idx_dictionary_acronym ON dictionary(acronym_for) WHERE acronym_for IS NOT NULL;

-- ============================================
-- TRIGGERS TABLE (Query-time behavior modification)
-- ============================================

CREATE TABLE IF NOT EXISTS triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    pattern VARCHAR(1000) NOT NULL,  -- Regex pattern to match queries
    conditions JSONB DEFAULT '{}',   -- Additional conditions: {"min_terms": 2, "has_entity": "PERSON"}
    actions JSONB NOT NULL,          -- Actions to take: {"boost_doc_type": "KB_ARTICLE", "inject_terms": ["help"]}
    priority INTEGER DEFAULT 0,      -- Higher priority triggers run first
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON triggers(enabled, priority DESC);
CREATE INDEX IF NOT EXISTS idx_triggers_name ON triggers(name);

-- ============================================
-- AI PROCESSING METADATA
-- ============================================
-- Track AI processing status and extracted content

-- Processing status and metadata per document
CREATE TABLE IF NOT EXISTS document_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Processing status
    ocr_processed BOOLEAN DEFAULT false,
    ocr_processed_at TIMESTAMPTZ,
    ocr_confidence FLOAT,
    ocr_language VARCHAR(10),
    
    translation_processed BOOLEAN DEFAULT false,
    translation_processed_at TIMESTAMPTZ,
    source_language VARCHAR(10),
    target_language VARCHAR(10),
    
    ai_description_processed BOOLEAN DEFAULT false,
    ai_description_processed_at TIMESTAMPTZ,
    ai_description_provider VARCHAR(50),
    
    -- Original content (pre-processing)
    original_content TEXT,
    
    -- Extracted/processed content
    ocr_text TEXT,
    translated_text TEXT,
    ai_description TEXT,
    
    -- Media metadata
    media_type VARCHAR(50), -- 'image', 'audio', 'video', 'document'
    media_metadata JSONB DEFAULT '{}',
    -- Example: {"duration": 120, "width": 1920, "height": 1080, "format": "mp4"}
    
    -- Processing errors
    processing_errors JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(document_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_processing_document ON document_processing(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_processing_media_type ON document_processing(media_type);
CREATE INDEX IF NOT EXISTS idx_doc_processing_ocr ON document_processing(ocr_processed) WHERE ocr_processed = false;
CREATE INDEX IF NOT EXISTS idx_doc_processing_translation ON document_processing(translation_processed) WHERE translation_processed = false;

-- Processing queue for background processing
CREATE TABLE IF NOT EXISTS processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    file_path TEXT,
    file_type VARCHAR(50),
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    
    -- Processing options
    options JSONB DEFAULT '{}',
    -- Example: {"skip_ocr": false, "target_language": "en", "detailed_description": true}
    
    -- Results
    result JSONB,
    error_message TEXT,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status, priority DESC, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_processing_queue_document ON processing_queue(document_id);

-- ============================================
-- DEMO DATA
-- ============================================

-- Seed ontology taxonomies
INSERT INTO ontology_taxonomies (name, description) VALUES
('nostr', 'Nostr protocol and ecosystem'),
('podcast', 'Podcasting and audio shows'),
('knowledge-base', 'Knowledge base and documentation')
ON CONFLICT DO NOTHING;

-- Seed ontology concepts (Nostr, podcasts, knowledge base)
INSERT INTO ontology (term, description, synonyms) VALUES
('Nostr', 'Decentralized social protocol', ARRAY['nostr protocol']),
('Relay', 'Nostr relay server', ARRAY['nostr relay']),
('NIP', 'Nostr Improvement Proposal', ARRAY['nostr improvement proposal']),
('NIP-05', 'Nostr identity verification', ARRAY['nostr nip-05', 'nostr verification']),
('Public Key', 'Nostr public key', ARRAY['pubkey']),
('Event', 'Nostr event object', ARRAY['nostr event', 'note']),
('Zap', 'Nostr lightning tip', ARRAY['nostr zap', 'lightning tip']),
('Lightning Network', 'Bitcoin lightning network', ARRAY['lightning', 'ln']),
('Client', 'Nostr client application', ARRAY['nostr client']),
('Podcast', 'Audio show series', ARRAY['audio show']),
('Episode', 'Individual podcast episode', ARRAY['podcast episode']),
('RSS Feed', 'Podcast distribution feed', ARRAY['podcast rss', 'rss']),
('Transcript', 'Podcast transcript text', ARRAY['episode transcript']),
('Host', 'Podcast host', ARRAY['podcast host']),
('Show', 'Podcast show', ARRAY['series']),
('Audio Content', 'Audio-based content', ARRAY['audio']),
('Knowledge Base', 'Knowledge base collection', ARRAY['kb']),
('FAQ', 'Frequently asked questions', ARRAY['faqs']),
('Runbook', 'Operational runbook', ARRAY['ops runbook']),
('Playbook', 'Procedural playbook', ARRAY['ops playbook']),
('SOP', 'Standard operating procedure', ARRAY['standard operating procedure']),
('How-to Article', 'Instructional article', ARRAY['how to', 'guide']),
('Troubleshooting Guide', 'Issue resolution guide', ARRAY['troubleshooting', 'fix guide']),
('Documentation', 'Reference documentation', ARRAY['docs'])
ON CONFLICT DO NOTHING;

-- Seed ontology aliases
INSERT INTO ontology_aliases (concept_id, alias, alias_type, weight)
SELECT o.id, 'Notes and Other Stuff Transmitted by Relays', 'phrase', 1.0 FROM ontology o WHERE o.term = 'Nostr'
ON CONFLICT DO NOTHING;
INSERT INTO ontology_aliases (concept_id, alias, alias_type, weight)
SELECT o.id, 'npub', 'abbrev', 0.8 FROM ontology o WHERE o.term = 'Public Key'
ON CONFLICT DO NOTHING;
INSERT INTO ontology_aliases (concept_id, alias, alias_type, weight)
SELECT o.id, 'kb', 'abbrev', 0.8 FROM ontology o WHERE o.term = 'Knowledge Base'
ON CONFLICT DO NOTHING;
INSERT INTO ontology_aliases (concept_id, alias, alias_type, weight)
SELECT o.id, 'rss feed', 'phrase', 0.9 FROM ontology o WHERE o.term = 'RSS Feed'
ON CONFLICT DO NOTHING;

-- Seed ontology relations
INSERT INTO ontology_relations (source_id, target_id, relation_type, weight)
SELECT s.id, t.id, 'narrower', 1.0
FROM ontology s, ontology t
WHERE s.term = 'Podcast' AND t.term = 'Episode'
ON CONFLICT DO NOTHING;
INSERT INTO ontology_relations (source_id, target_id, relation_type, weight)
SELECT s.id, t.id, 'broader', 1.0
FROM ontology s, ontology t
WHERE s.term = 'Podcast' AND t.term = 'Audio Content'
ON CONFLICT DO NOTHING;
INSERT INTO ontology_relations (source_id, target_id, relation_type, weight)
SELECT s.id, t.id, 'related', 0.8
FROM ontology s, ontology t
WHERE s.term = 'Knowledge Base' AND t.term = 'FAQ'
ON CONFLICT DO NOTHING;
INSERT INTO ontology_relations (source_id, target_id, relation_type, weight)
SELECT s.id, t.id, 'related', 0.8
FROM ontology s, ontology t
WHERE s.term = 'Runbook' AND t.term = 'Playbook'
ON CONFLICT DO NOTHING;

-- Seed taxonomy assignments
INSERT INTO ontology_concept_taxonomies (concept_id, taxonomy_id)
SELECT o.id, t.id
FROM ontology o, ontology_taxonomies t
WHERE t.name = 'nostr'
  AND o.term IN ('Nostr', 'Relay', 'NIP', 'NIP-05', 'Public Key', 'Event', 'Zap', 'Lightning Network', 'Client')
ON CONFLICT DO NOTHING;
INSERT INTO ontology_concept_taxonomies (concept_id, taxonomy_id)
SELECT o.id, t.id
FROM ontology o, ontology_taxonomies t
WHERE t.name = 'podcast'
  AND o.term IN ('Podcast', 'Episode', 'RSS Feed', 'Transcript', 'Host', 'Show', 'Audio Content')
ON CONFLICT DO NOTHING;
INSERT INTO ontology_concept_taxonomies (concept_id, taxonomy_id)
SELECT o.id, t.id
FROM ontology o, ontology_taxonomies t
WHERE t.name = 'knowledge-base'
  AND o.term IN ('Knowledge Base', 'FAQ', 'Runbook', 'Playbook', 'SOP', 'How-to Article', 'Troubleshooting Guide', 'Documentation')
ON CONFLICT DO NOTHING;

-- Demo documents (embeddings generated via API)
INSERT INTO documents (title, content, url, document_type, attributes) VALUES
('Introduction to Vector Search', 
 'Vector search is a method of finding similar items by comparing their vector representations. It is widely used in recommendation systems, semantic search, and AI applications. The key advantage is finding conceptually similar content even when exact keywords don''t match.',
 'https://example.com/vector-search',
 'manual',
 '{"category": "Technology", "author": "Demo"}'),
 
('PostgreSQL pgvector Guide', 
 'pgvector is an open-source extension for PostgreSQL that enables storing and querying vector embeddings. It supports various distance metrics including cosine similarity, L2 distance, and inner product. This makes PostgreSQL a viable choice for AI applications without needing a separate vector database.',
 'https://example.com/pgvector',
 'manual',
 '{"category": "Database", "author": "Demo"}'),
 
('Building Search Engines', 
 'Modern search engines combine traditional keyword matching with semantic understanding. This hybrid approach delivers more relevant results by understanding the meaning behind queries. Key components include inverted indexes for text search and vector indexes for semantic similarity.',
 'https://example.com/search-engines',
 'manual',
 '{"category": "Technology", "author": "Demo"}'),
 
('Machine Learning Basics', 
 'Machine learning is a subset of artificial intelligence that enables systems to learn from data. Common applications include image recognition, natural language processing, and predictive analytics. Neural networks have revolutionized the field with deep learning techniques.',
 'https://example.com/ml-basics',
 'manual',
 '{"category": "AI", "author": "Demo"}'),
 
('Natural Language Processing', 
 'NLP is a field of AI focused on enabling computers to understand, interpret, and generate human language. Key techniques include tokenization, embeddings, and transformer models. Applications range from chatbots to sentiment analysis to machine translation.',
 'https://example.com/nlp',
 'manual',
 '{"category": "AI", "author": "Demo"}')
ON CONFLICT DO NOTHING;

-- Demo data source (example configuration)
INSERT INTO data_sources (
    name, 
    description, 
    document_type, 
    source_type,
    connection_config,
    metadata_query,
    data_query,
    url_template,
    is_active
) VALUES (
    'Demo Knowledge Base',
    'Example SQL connector configuration (not connected to real database)',
    'KB_ARTICLE',
    'postgresql',
    '{"host": "kb-db.example.com", "port": 5432, "database": "knowledge_base", "user": "reader", "password": "REPLACE_ME"}',
    'SELECT article_id AS search_external_id, modified_date AS search_last_modified FROM kb_articles WHERE is_published = true',
    'SELECT article_id AS search_external_id, modified_date AS search_last_modified, title AS search_title, body AS search_content, category AS attr_category, author AS attr_author FROM kb_articles WHERE article_id IN ({IDS})',
    'https://kb.example.com/article/{search_external_id}',
    false
) ON CONFLICT (document_type) DO NOTHING;

-- ============================================
-- NLP PIPELINE TABLES
-- ============================================

-- Tags table (auto-generated and manual)
CREATE TABLE IF NOT EXISTS document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag VARCHAR(255) NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    algorithm VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_document ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
CREATE INDEX IF NOT EXISTS idx_document_tags_source ON document_tags(source);

-- Entities table (Named Entity Recognition)
CREATE TABLE IF NOT EXISTS document_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_value VARCHAR(500) NOT NULL,
    normalized_value VARCHAR(500),
    position_start INTEGER,
    position_end INTEGER,
    confidence FLOAT DEFAULT 1.0,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT entity_position_unique UNIQUE(document_id, entity_type, entity_value, position_start)
);

CREATE INDEX IF NOT EXISTS idx_entities_document ON document_entities(document_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON document_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_value ON document_entities(entity_value);
CREATE INDEX IF NOT EXISTS idx_entities_normalized ON document_entities(normalized_value);
CREATE INDEX IF NOT EXISTS idx_entities_type_value ON document_entities(entity_type, normalized_value);

-- Metadata table
CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    meta_key VARCHAR(100) NOT NULL,
    meta_value TEXT NOT NULL,
    meta_type VARCHAR(50) DEFAULT 'string',
    confidence FLOAT DEFAULT 1.0,
    extracted_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, meta_key)
);

CREATE INDEX IF NOT EXISTS idx_metadata_document ON document_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_metadata_key ON document_metadata(meta_key);
CREATE INDEX IF NOT EXISTS idx_metadata_key_value ON document_metadata(meta_key, meta_value);

-- Entity relationships
CREATE TABLE IF NOT EXISTS entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    normalized_value VARCHAR(500) NOT NULL,
    document_ids UUID[] NOT NULL,
    document_count INTEGER DEFAULT 0,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_entity_rel_type ON entity_relationships(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_rel_value ON entity_relationships(normalized_value);
CREATE INDEX IF NOT EXISTS idx_entity_rel_count ON entity_relationships(document_count DESC);
CREATE INDEX IF NOT EXISTS idx_entity_rel_docs ON entity_relationships USING GIN(document_ids);

-- NLP processing status
CREATE TABLE IF NOT EXISTS nlp_processing_status (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    tags_extracted BOOLEAN DEFAULT false,
    tags_extracted_at TIMESTAMPTZ,
    entities_extracted BOOLEAN DEFAULT false,
    entities_extracted_at TIMESTAMPTZ,
    metadata_extracted BOOLEAN DEFAULT false,
    metadata_extracted_at TIMESTAMPTZ,
    relationships_updated BOOLEAN DEFAULT false,
    relationships_updated_at TIMESTAMPTZ,
    last_error TEXT,
    processing_version INTEGER DEFAULT 1
);

-- Function to update entity relationships
CREATE OR REPLACE FUNCTION update_entity_relationships(p_document_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO entity_relationships (entity_type, normalized_value, document_ids, document_count)
    SELECT 
        entity_type,
        COALESCE(normalized_value, entity_value) as normalized_value,
        ARRAY[p_document_id],
        1
    FROM document_entities
    WHERE document_id = p_document_id
    GROUP BY entity_type, COALESCE(normalized_value, entity_value)
    ON CONFLICT (entity_type, normalized_value) DO UPDATE SET
        document_ids = (
            SELECT array_agg(DISTINCT doc_id) 
            FROM unnest(entity_relationships.document_ids || ARRAY[p_document_id]) AS doc_id
        ),
        document_count = (
            SELECT COUNT(DISTINCT doc_id) 
            FROM unnest(entity_relationships.document_ids || ARRAY[p_document_id]) AS doc_id
        ),
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Demo ontology data
INSERT INTO ontology (term, description, synonyms) VALUES
('Technology', 'Technology and software topics', ARRAY['tech', 'software', 'computing']),
('Database', 'Database systems and technologies', ARRAY['db', 'data storage']),
('AI', 'Artificial Intelligence', ARRAY['artificial intelligence', 'machine learning', 'ML'])
ON CONFLICT (term) DO NOTHING;

-- Set up hierarchy (AI is child of Technology)
UPDATE ontology SET parent_id = (SELECT id FROM ontology WHERE term = 'Technology') WHERE term = 'AI';
UPDATE ontology SET parent_id = (SELECT id FROM ontology WHERE term = 'Technology') WHERE term = 'Database';

-- Demo dictionary data
INSERT INTO dictionary (term, synonyms, acronym_for, domain, boost_weight) VALUES
('K8s', ARRAY['kubernetes', 'kube'], 'Kubernetes', 'technology', 1.2),
('AWS', ARRAY['amazon web services', 'amazon cloud'], 'Amazon Web Services', 'technology', 1.1),
('ML', ARRAY['machine learning'], 'Machine Learning', 'technology', 1.15),
('NLP', ARRAY['natural language processing', 'text processing'], 'Natural Language Processing', 'technology', 1.15),
('API', ARRAY['interface', 'endpoint'], 'Application Programming Interface', 'technology', 1.0),
('DB', ARRAY['database', 'data store'], 'Database', 'technology', 1.0),
('pgvector', ARRAY['postgresql vector', 'pg vector', 'postgres vector'], NULL, 'database', 1.2),
('vector search', ARRAY['semantic search', 'embedding search', 'similarity search'], NULL, 'technology', 1.3)
ON CONFLICT (term) DO NOTHING;

-- Demo triggers data
INSERT INTO triggers (name, pattern, conditions, actions, priority, description, enabled) VALUES
('boost_documentation', 'how to|guide|tutorial|help', '{}', '{"boost_doc_type": "manual", "inject_terms": ["guide"]}', 10, 'Boost documentation results for how-to queries', true),
('database_queries', 'postgres|postgresql|sql|database', '{}', '{"boost_doc_type": "manual", "inject_terms": ["database"]}', 5, 'Boost database-related content', true),
('ai_queries', 'ai|machine learning|neural|deep learning', '{}', '{"boost_doc_type": "manual", "inject_terms": ["artificial intelligence"]}', 5, 'Enhance AI-related searches', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PODCAST INGESTION TABLES (MVP)
-- ============================================
CREATE TABLE IF NOT EXISTS podcast_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    rss_url VARCHAR(2000) NOT NULL UNIQUE,
    site_url VARCHAR(2000),
    description TEXT,
    language VARCHAR(50),
    categories TEXT[] DEFAULT '{}',
    image_url VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_sources_title ON podcast_sources(title);

CREATE TABLE IF NOT EXISTS podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES podcast_sources(id) ON DELETE CASCADE,
    guid VARCHAR(1000) NOT NULL,
    title VARCHAR(500) NOT NULL,
    episode_url VARCHAR(2000),
    audio_url VARCHAR(2000),
    published_at TIMESTAMPTZ,
    season_number INTEGER,
    episode_number INTEGER,
    duration_seconds INTEGER,
    summary TEXT,
    transcript_url VARCHAR(2000),
    transcript_status VARCHAR(50) DEFAULT 'missing',
    transcript_source VARCHAR(50),
    transcript_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_source ON podcast_episodes(source_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published ON podcast_episodes(published_at DESC);

CREATE TABLE IF NOT EXISTS podcast_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    word_count INTEGER,
    language VARCHAR(50),
    source VARCHAR(50) DEFAULT 'provided',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(episode_id)
);

CREATE INDEX IF NOT EXISTS idx_podcast_transcripts_episode ON podcast_transcripts(episode_id);

CREATE TABLE IF NOT EXISTS podcast_ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES podcast_sources(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    episodes_discovered INTEGER DEFAULT 0,
    episodes_updated INTEGER DEFAULT 0,
    transcripts_created INTEGER DEFAULT 0,
    transcripts_transcribed INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_podcast_ingest_runs_source ON podcast_ingest_runs(source_id, started_at DESC);

-- ============================================
-- TV METADATA + TRANSCRIPT INGESTION
-- ============================================
CREATE TABLE IF NOT EXISTS tv_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL UNIQUE,
    overview TEXT,
    status VARCHAR(100),
    network VARCHAR(255),
    genres TEXT[] DEFAULT '{}',
    language VARCHAR(50),
    first_air_date DATE,
    last_air_date DATE,
    image_url VARCHAR(2000),
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_series_title ON tv_series(title);

CREATE TABLE IF NOT EXISTS tv_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    title VARCHAR(500),
    overview TEXT,
    air_date DATE,
    episode_count INTEGER,
    image_url VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_tv_seasons_series ON tv_seasons(series_id);

CREATE TABLE IF NOT EXISTS tv_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
    season_id UUID REFERENCES tv_seasons(id) ON DELETE SET NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    air_date DATE,
    runtime_minutes INTEGER,
    rating FLOAT,
    image_url VARCHAR(2000),
    external_ids JSONB DEFAULT '{}',
    cast JSONB DEFAULT '[]',
    transcript_status VARCHAR(50) DEFAULT 'missing',
    transcript_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_tv_episodes_series ON tv_episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_tv_episodes_airdate ON tv_episodes(air_date);

CREATE TABLE IF NOT EXISTS tv_episode_subtitle_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    url VARCHAR(2000),
    language VARCHAR(50),
    format VARCHAR(20),
    reliability_weight FLOAT DEFAULT 0.6,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_subtitle_variants_episode ON tv_episode_subtitle_variants(episode_id);

CREATE TABLE IF NOT EXISTS tv_episode_subtitle_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES tv_episode_subtitle_variants(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tv_subtitle_segments_variant ON tv_episode_subtitle_segments(variant_id);

CREATE TABLE IF NOT EXISTS tv_episode_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    consensus_score FLOAT DEFAULT 0,
    conflicts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(episode_id)
);

CREATE INDEX IF NOT EXISTS idx_tv_transcripts_episode ON tv_episode_transcripts(episode_id);

CREATE TABLE IF NOT EXISTS tv_episode_transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence FLOAT DEFAULT 0,
    conflict BOOLEAN DEFAULT false,
    sources JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_tv_transcript_segments_episode ON tv_episode_transcript_segments(episode_id);

CREATE TABLE IF NOT EXISTS tv_ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_ingest_runs_series ON tv_ingest_runs(series_id, started_at DESC);

-- ============================================
-- MOVIE METADATA + TRANSCRIPT INGESTION
-- ============================================
CREATE TABLE IF NOT EXISTS movie_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL UNIQUE,
    overview TEXT,
    image_url VARCHAR(2000),
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_collections_name ON movie_collections(name);

CREATE TABLE IF NOT EXISTS movie_genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_genres_name ON movie_genres(name);

CREATE TABLE IF NOT EXISTS movie_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_movie_people_name ON movie_people(name);

CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    status VARCHAR(100),
    release_date DATE,
    runtime_minutes INTEGER,
    rating FLOAT,
    language VARCHAR(50),
    image_url VARCHAR(2000),
    collection_id UUID REFERENCES movie_collections(id) ON DELETE SET NULL,
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(title, release_date)
);

CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date);

CREATE TABLE IF NOT EXISTS movie_genre_links (
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES movie_genres(id) ON DELETE CASCADE,
    PRIMARY KEY(movie_id, genre_id)
);

CREATE TABLE IF NOT EXISTS movie_cast (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES movie_people(id) ON DELETE CASCADE,
    character_name VARCHAR(255),
    billing_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_cast_movie ON movie_cast(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);

CREATE TABLE IF NOT EXISTS movie_crew (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES movie_people(id) ON DELETE CASCADE,
    job VARCHAR(255),
    department VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_crew_movie ON movie_crew(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_crew_person ON movie_crew(person_id);

CREATE TABLE IF NOT EXISTS movie_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    provider_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    region VARCHAR(10),
    provider_id VARCHAR(100),
    link VARCHAR(2000),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_providers_movie ON movie_providers(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_providers_name ON movie_providers(provider_name);

CREATE TABLE IF NOT EXISTS movie_subtitle_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    url VARCHAR(2000),
    language VARCHAR(50),
    format VARCHAR(20),
    reliability_weight FLOAT DEFAULT 0.6,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_subtitle_variants_movie ON movie_subtitle_variants(movie_id);

CREATE TABLE IF NOT EXISTS movie_subtitle_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES movie_subtitle_variants(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movie_subtitle_segments_variant ON movie_subtitle_segments(variant_id);

CREATE TABLE IF NOT EXISTS movie_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    consensus_score FLOAT DEFAULT 0,
    conflicts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(movie_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_transcripts_movie ON movie_transcripts(movie_id);

CREATE TABLE IF NOT EXISTS movie_transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence FLOAT DEFAULT 0,
    conflict BOOLEAN DEFAULT false,
    sources JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_movie_transcript_segments_movie ON movie_transcript_segments(movie_id);

CREATE TABLE IF NOT EXISTS movie_ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_ingest_runs_movie ON movie_ingest_runs(movie_id, started_at DESC);

-- ============================================
-- FRPEI (Federated Retrieval + Enrichment)
-- ============================================

CREATE TABLE IF NOT EXISTS frpei_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  sources TEXT[] DEFAULT '{}',
  requested_limit INTEGER,
  timeout_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  provider_stats JSONB DEFAULT '{}',
  candidate_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_frpei_requests_started ON frpei_requests(started_at DESC);

CREATE TABLE IF NOT EXISTS frpei_candidates (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES frpei_requests(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_ref VARCHAR(255),
  trust_tier VARCHAR(20),
  url VARCHAR(2000),
  canonical_url VARCHAR(2000),
  canonical_domain VARCHAR(255),
  title VARCHAR(1000),
  canonical_title VARCHAR(1000),
  snippet TEXT,
  language VARCHAR(50),
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ,
  content_type VARCHAR(50),
  raw JSONB DEFAULT '{}',
  signals JSONB DEFAULT '{}',
  entity_id UUID REFERENCES ontology(id) ON DELETE SET NULL,
  entity_term VARCHAR(500),
  entity_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frpei_candidates_request ON frpei_candidates(request_id);
CREATE INDEX IF NOT EXISTS idx_frpei_candidates_canonical_url ON frpei_candidates(canonical_url);
CREATE INDEX IF NOT EXISTS idx_frpei_candidates_entity ON frpei_candidates(entity_id);

CREATE TABLE IF NOT EXISTS frpei_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES frpei_candidates(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES ontology(id) ON DELETE SET NULL,
  topics TEXT[] DEFAULT '{}',
  taxonomy JSONB DEFAULT '{}',
  domain_enrichment JSONB DEFAULT '{}',
  provenance JSONB DEFAULT '{}',
  confidence JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id)
);

CREATE TABLE IF NOT EXISTS frpei_rank_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES frpei_requests(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES frpei_candidates(id) ON DELETE CASCADE,
  score FLOAT,
  rank INTEGER,
  signals JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frpei_rank_request ON frpei_rank_log(request_id, rank);

CREATE TABLE IF NOT EXISTS frpei_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES frpei_requests(id) ON DELETE SET NULL,
  candidate_id UUID NOT NULL,
  provider VARCHAR(50),
  feedback VARCHAR(20) NOT NULL,
  rating FLOAT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frpei_feedback_candidate ON frpei_feedback(candidate_id);
CREATE INDEX IF NOT EXISTS idx_frpei_feedback_request ON frpei_feedback(request_id);
