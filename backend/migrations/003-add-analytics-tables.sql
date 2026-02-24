-- P2 Feature: Analytics Mode
-- Created: 2026-02-20

-- Table: author_analytics
-- Tracks aggregated statistics for each author
CREATE TABLE IF NOT EXISTS author_analytics (
  id SERIAL PRIMARY KEY,
  author_pubkey VARCHAR(255) NOT NULL UNIQUE,
  total_zaps_earned BIGINT DEFAULT 0,
  total_documents INT DEFAULT 0,
  total_engagement INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_author_analytics_pubkey ON author_analytics(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_author_analytics_earned ON author_analytics(total_zaps_earned DESC);

-- Table: zap_heatmap
-- Paragraph-level zap tracking for documents
CREATE TABLE IF NOT EXISTS zap_heatmap (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255) NOT NULL,
  paragraph_index INT NOT NULL,
  zap_count INT DEFAULT 0,
  total_sats BIGINT DEFAULT 0,
  last_zapped TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id, paragraph_index)
);

CREATE INDEX IF NOT EXISTS idx_zap_heatmap_document ON zap_heatmap(document_id);
CREATE INDEX IF NOT EXISTS idx_zap_heatmap_sats ON zap_heatmap(total_sats DESC);
CREATE INDEX IF NOT EXISTS idx_zap_heatmap_zap_count ON zap_heatmap(zap_count DESC);

-- Table: zap_engagement
-- Detailed log of individual zaps (for audit trail and trends)
CREATE TABLE IF NOT EXISTS zap_engagement (
  id SERIAL PRIMARY KEY,
  document_id VARCHAR(255) NOT NULL,
  author_pubkey VARCHAR(255) NOT NULL,
  zapper_pubkey VARCHAR(255),
  amount_sats BIGINT NOT NULL,
  paragraph_index INT,
  timestamp TIMESTAMP DEFAULT NOW(),
  nostr_event_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_zap_engagement_document ON zap_engagement(document_id);
CREATE INDEX IF NOT EXISTS idx_zap_engagement_author ON zap_engagement(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_zap_engagement_timestamp ON zap_engagement(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_zap_engagement_author_timestamp ON zap_engagement(author_pubkey, timestamp DESC);

-- View: author_stats_summary
-- Quick access to aggregated author statistics
CREATE OR REPLACE VIEW author_stats_summary AS
SELECT 
  author_pubkey,
  total_zaps_earned,
  total_documents,
  total_engagement,
  CASE 
    WHEN total_documents > 0 THEN total_zaps_earned / total_documents
    ELSE 0 
  END as avg_zaps_per_document,
  last_updated
FROM author_analytics
ORDER BY total_zaps_earned DESC;

-- Function: update_author_analytics()
-- Called when new zap is recorded
CREATE OR REPLACE FUNCTION update_author_analytics(
  p_author_pubkey VARCHAR(255),
  p_amount_sats BIGINT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO author_analytics (author_pubkey, total_zaps_earned)
  VALUES (p_author_pubkey, p_amount_sats)
  ON CONFLICT (author_pubkey) DO UPDATE SET
    total_zaps_earned = author_analytics.total_zaps_earned + p_amount_sats,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: record_zap_engagement()
-- Called when a zap receipt is processed
CREATE OR REPLACE FUNCTION record_zap_engagement(
  p_document_id VARCHAR(255),
  p_author_pubkey VARCHAR(255),
  p_zapper_pubkey VARCHAR(255),
  p_amount_sats BIGINT,
  p_paragraph_index INT,
  p_nostr_event_id VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
  -- Record individual zap
  INSERT INTO zap_engagement 
    (document_id, author_pubkey, zapper_pubkey, amount_sats, paragraph_index, nostr_event_id)
  VALUES 
    (p_document_id, p_author_pubkey, p_zapper_pubkey, p_amount_sats, p_paragraph_index, p_nostr_event_id);

  -- Update heatmap if paragraph_index provided
  IF p_paragraph_index IS NOT NULL THEN
    INSERT INTO zap_heatmap (document_id, paragraph_index, zap_count, total_sats, last_zapped)
    VALUES (p_document_id, p_paragraph_index, 1, p_amount_sats, NOW())
    ON CONFLICT (document_id, paragraph_index) DO UPDATE SET
      zap_count = zap_heatmap.zap_count + 1,
      total_sats = zap_heatmap.total_sats + p_amount_sats,
      last_zapped = NOW();
  END IF;

  -- Update author analytics
  PERFORM update_author_analytics(p_author_pubkey, p_amount_sats);
END;
$$ LANGUAGE plpgsql;
