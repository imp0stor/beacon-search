-- ============================================
-- Beacon Search UX Improvements Migration
-- Features: Tags, Infinite Scroll, Media, Quality Filtering
-- Date: 2026-02-13
-- ============================================

-- Add quality scoring and media fields to documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS has_media BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';

-- Create tags summary table for efficient tag counts
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT, -- 'concept', 'technology', 'person', 'nostr', etc.
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on tag name for fast lookups
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_count ON tags(count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- Create index on document quality score
CREATE INDEX IF NOT EXISTS idx_documents_quality ON documents(quality_score DESC);

-- Create index on media flag for filtering
CREATE INDEX IF NOT EXISTS idx_documents_has_media ON documents(has_media) WHERE has_media = true;

-- Function to update tag counts
CREATE OR REPLACE FUNCTION update_tag_counts()
RETURNS void AS $$
BEGIN
  -- Insert or update tags table with counts from document_tags
  INSERT INTO tags (name, count, updated_at)
  SELECT 
    tag, 
    COUNT(*) as count,
    NOW()
  FROM document_tags
  GROUP BY tag
  ON CONFLICT (name) 
  DO UPDATE SET 
    count = EXCLUDED.count,
    updated_at = EXCLUDED.updated_at;
  
  -- Remove tags with zero count
  DELETE FROM tags WHERE count = 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tag counts when document_tags changes
CREATE OR REPLACE FUNCTION trigger_update_tag_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count for affected tag
  IF TG_OP = 'INSERT' THEN
    INSERT INTO tags (name, count) 
    VALUES (NEW.tag, 1)
    ON CONFLICT (name) DO UPDATE SET count = tags.count + 1, updated_at = NOW();
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET count = count - 1, updated_at = NOW() WHERE name = OLD.tag;
    DELETE FROM tags WHERE name = OLD.tag AND count <= 0;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_tags_count_trigger ON document_tags;
CREATE TRIGGER document_tags_count_trigger
AFTER INSERT OR DELETE ON document_tags
FOR EACH ROW EXECUTE FUNCTION trigger_update_tag_count();

-- Initialize tag counts from existing data
SELECT update_tag_counts();

-- Add comments
COMMENT ON COLUMN documents.quality_score IS 'Document quality score 0-1 based on title, content length, engagement';
COMMENT ON COLUMN documents.has_media IS 'Whether document contains images or videos';
COMMENT ON COLUMN documents.media_urls IS 'Array of media URLs extracted from content';
COMMENT ON TABLE tags IS 'Tag names with document counts for efficient filtering';
