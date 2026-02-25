-- Ensure connector upserts work for BaseConnector.indexDocument()
-- Needed for ON CONFLICT (source_id, external_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_source_external
ON documents(source_id, external_id)
WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
