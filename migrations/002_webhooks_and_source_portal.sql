-- Migration: Add webhooks and source portal URL templates
-- Run this on existing databases to add the new features

-- ============================================
-- Add URL template columns to connectors
-- ============================================

ALTER TABLE connectors 
ADD COLUMN IF NOT EXISTS portal_url VARCHAR(2000);

ALTER TABLE connectors 
ADD COLUMN IF NOT EXISTS item_url_template VARCHAR(2000);

ALTER TABLE connectors 
ADD COLUMN IF NOT EXISTS search_url_template VARCHAR(2000);

ALTER TABLE connectors 
ADD COLUMN IF NOT EXISTS edit_url_template VARCHAR(2000);

-- ============================================
-- Create webhooks table
-- ============================================

CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2000) NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    secret VARCHAR(255) NOT NULL,
    last_triggered_at TIMESTAMPTZ,
    last_status INTEGER,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);

-- ============================================
-- Create webhook deliveries table
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
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
-- Comments
-- ============================================

COMMENT ON TABLE webhooks IS 'Webhook subscriptions for event notifications';
COMMENT ON COLUMN webhooks.events IS 'Array of event types: document.indexed, document.updated, document.deleted, search.performed, answer.generated, connector.started, connector.completed, connector.error';
COMMENT ON COLUMN webhooks.secret IS 'HMAC secret for payload signature verification';

COMMENT ON TABLE webhook_deliveries IS 'History of webhook delivery attempts';
COMMENT ON COLUMN webhook_deliveries.status IS 'pending, success, or failed';

COMMENT ON COLUMN connectors.portal_url IS 'Base URL of the source system for deep linking';
COMMENT ON COLUMN connectors.item_url_template IS 'URL template for opening items: {portal_url}/view/{external_id}';
COMMENT ON COLUMN connectors.search_url_template IS 'URL template for searching: {portal_url}/search?q={query}';
COMMENT ON COLUMN connectors.edit_url_template IS 'URL template for editing: {portal_url}/edit/{external_id}';
