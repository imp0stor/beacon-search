-- Foundation Rebuild (Phase 1): rollback admin configuration schema

BEGIN;

DROP TABLE IF EXISTS sync_history;
DROP TABLE IF EXISTS system_alerts;
DROP TABLE IF EXISTS crawlers;
DROP TABLE IF EXISTS document_types;
DROP TABLE IF EXISTS servers;

COMMIT;
