-- Foundation alignment: documents.source_id should accept server IDs for crawler connectors.
-- Legacy FK to connectors table blocks admin crawler ingestion.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_source_id_fkey;
