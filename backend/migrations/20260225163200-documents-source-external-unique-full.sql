-- Required for INSERT ... ON CONFLICT (source_id, external_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_source_external
ON documents(source_id, external_id);
