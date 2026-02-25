-- Foundation Rebuild (Phase 1): Admin configuration schema
-- Source: prd-foundation-rebuild.md (Database Schema)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Replace any legacy table definitions with the Foundation schema
DROP TABLE IF EXISTS sync_history CASCADE;
DROP TABLE IF EXISTS system_alerts CASCADE;
DROP TABLE IF EXISTS crawlers CASCADE;
DROP TABLE IF EXISTS document_types CASCADE;
DROP TABLE IF EXISTS servers CASCADE;

-- Servers (data source definitions)
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'postgresql', 'mysql', 'web', 'nostr', 'api'
  host VARCHAR(500),
  port INT,
  database_name VARCHAR(255),
  auth_type VARCHAR(50), -- 'password', 'apikey', 'oauth', 'none'
  auth_config JSONB, -- encrypted credentials
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Document Types (schema definitions)
CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  fields JSONB NOT NULL, -- [{name, type, required, searchable}]
  display_template TEXT, -- Handlebars template
  relevancy_config JSONB, -- custom scoring rules
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crawlers (ingestion job definitions)
CREATE TABLE crawlers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'product', 'external', 'manual'
  server_id UUID REFERENCES servers(id),
  document_type_id UUID REFERENCES document_types(id),
  status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'inactive', 'error'
  schedule_type VARCHAR(50), -- 'cron', 'interval', 'manual'
  schedule_config JSONB, -- cron expression or interval seconds
  extraction_config JSONB NOT NULL, -- SQL query, filters, transformations
  property_mapping JSONB, -- {source_field: index_field}
  access_control JSONB, -- permission groups
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(50),
  last_sync_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync History (execution logs)
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_id UUID REFERENCES crawlers(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(50), -- 'running', 'success', 'failed'
  documents_added INT DEFAULT 0,
  documents_updated INT DEFAULT 0,
  documents_deleted INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- System Alerts
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'sync_failure', 'index_error', 'performance'
  severity VARCHAR(20), -- 'info', 'warning', 'error', 'critical'
  message TEXT NOT NULL,
  source VARCHAR(255), -- crawler name or system component
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes from PRD + FK/status helpers
CREATE INDEX idx_servers_type ON servers(type);
CREATE INDEX idx_document_types_name ON document_types(name);
CREATE INDEX idx_crawlers_server_id ON crawlers(server_id);
CREATE INDEX idx_crawlers_document_type_id ON crawlers(document_type_id);
CREATE INDEX idx_crawlers_status ON crawlers(status);
CREATE INDEX idx_crawlers_schedule_type ON crawlers(schedule_type);
CREATE INDEX idx_sync_history_crawler ON sync_history(crawler_id, started_at DESC);
CREATE INDEX idx_alerts_unacknowledged ON system_alerts(acknowledged, created_at DESC);

COMMIT;
