-- NLP Pipeline Schema Extensions for Beacon Search
-- Adds: tags, entities, metadata, and relationship mapping

-- ============================================
-- TAGS TABLE
-- ============================================
-- Stores both auto-generated and manual tags for documents

CREATE TABLE IF NOT EXISTS document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag VARCHAR(255) NOT NULL,
    confidence FLOAT DEFAULT 1.0,  -- 0.0 to 1.0, manual tags = 1.0
    source VARCHAR(50) NOT NULL DEFAULT 'manual',  -- 'auto', 'manual', 'suggested'
    algorithm VARCHAR(100),  -- 'tfidf', 'rake', 'topic-model', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate tags per document
    UNIQUE(document_id, tag)
);

-- Index for fast tag lookups
CREATE INDEX IF NOT EXISTS idx_document_tags_document ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
CREATE INDEX IF NOT EXISTS idx_document_tags_source ON document_tags(source);

-- ============================================
-- ENTITIES TABLE (Named Entity Recognition)
-- ============================================
-- Stores extracted entities: People, Organizations, Locations, etc.

CREATE TABLE IF NOT EXISTS document_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,  -- 'PERSON', 'ORG', 'LOCATION', 'DATE', 'MONEY', 'PRODUCT'
    entity_value VARCHAR(500) NOT NULL,
    normalized_value VARCHAR(500),  -- Canonical form for deduplication
    position_start INTEGER,  -- Character offset in content
    position_end INTEGER,
    confidence FLOAT DEFAULT 1.0,
    context TEXT,  -- Surrounding text for context
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for deduplication
    CONSTRAINT entity_position_unique UNIQUE(document_id, entity_type, entity_value, position_start)
);

-- Indexes for entity lookups
CREATE INDEX IF NOT EXISTS idx_entities_document ON document_entities(document_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON document_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_value ON document_entities(entity_value);
CREATE INDEX IF NOT EXISTS idx_entities_normalized ON document_entities(normalized_value);
CREATE INDEX IF NOT EXISTS idx_entities_type_value ON document_entities(entity_type, normalized_value);

-- ============================================
-- METADATA TABLE
-- ============================================
-- Stores extracted and computed metadata for documents

CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    meta_key VARCHAR(100) NOT NULL,
    meta_value TEXT NOT NULL,
    meta_type VARCHAR(50) DEFAULT 'string',  -- 'string', 'number', 'date', 'boolean', 'json'
    confidence FLOAT DEFAULT 1.0,
    extracted_by VARCHAR(100),  -- Algorithm/method that extracted this
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One value per key per document
    UNIQUE(document_id, meta_key)
);

-- Indexes for metadata lookups
CREATE INDEX IF NOT EXISTS idx_metadata_document ON document_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_metadata_key ON document_metadata(meta_key);
CREATE INDEX IF NOT EXISTS idx_metadata_key_value ON document_metadata(meta_key, meta_value);

-- ============================================
-- ENTITY RELATIONSHIPS
-- ============================================
-- Links documents that share entities for relationship mapping

CREATE TABLE IF NOT EXISTS entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    normalized_value VARCHAR(500) NOT NULL,
    document_ids UUID[] NOT NULL,  -- Array of document IDs mentioning this entity
    document_count INTEGER DEFAULT 0,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- One entry per unique entity
    UNIQUE(entity_type, normalized_value)
);

-- Indexes for relationship queries
CREATE INDEX IF NOT EXISTS idx_entity_rel_type ON entity_relationships(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_rel_value ON entity_relationships(normalized_value);
CREATE INDEX IF NOT EXISTS idx_entity_rel_count ON entity_relationships(document_count DESC);
CREATE INDEX IF NOT EXISTS idx_entity_rel_docs ON entity_relationships USING GIN(document_ids);

-- ============================================
-- NLP PROCESSING STATUS
-- ============================================
-- Tracks NLP processing status per document

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
    processing_version INTEGER DEFAULT 1  -- Bump to reprocess all docs
);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Tag cloud view with counts
CREATE OR REPLACE VIEW tag_cloud AS
SELECT 
    tag,
    COUNT(*) as usage_count,
    AVG(confidence) as avg_confidence,
    array_agg(DISTINCT source) as sources
FROM document_tags
GROUP BY tag
ORDER BY usage_count DESC;

-- Entity summary view
CREATE OR REPLACE VIEW entity_summary AS
SELECT 
    entity_type,
    normalized_value,
    COUNT(*) as mention_count,
    COUNT(DISTINCT document_id) as document_count,
    AVG(confidence) as avg_confidence
FROM document_entities
GROUP BY entity_type, normalized_value
ORDER BY document_count DESC;

-- Document NLP completeness view
CREATE OR REPLACE VIEW document_nlp_status AS
SELECT 
    d.id,
    d.title,
    COALESCE(ps.tags_extracted, false) as has_tags,
    COALESCE(ps.entities_extracted, false) as has_entities,
    COALESCE(ps.metadata_extracted, false) as has_metadata,
    (SELECT COUNT(*) FROM document_tags WHERE document_id = d.id) as tag_count,
    (SELECT COUNT(*) FROM document_entities WHERE document_id = d.id) as entity_count
FROM documents d
LEFT JOIN nlp_processing_status ps ON d.id = ps.document_id;

-- ============================================
-- FUNCTIONS FOR RELATIONSHIP UPDATES
-- ============================================

-- Function to update entity relationships after entity extraction
CREATE OR REPLACE FUNCTION update_entity_relationships(p_document_id UUID)
RETURNS void AS $$
BEGIN
    -- Insert or update entity relationships for this document
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
