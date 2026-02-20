-- Migration 003: Add UNIQUE constraint on nostr_events.event_id
-- This prevents duplicate Nostr events from appearing in search results

-- Create nostr_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS nostr_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    kind INTEGER NOT NULL,
    event_created_at TIMESTAMP NOT NULL,
    tags JSONB,
    event_metadata JSONB,
    quality_score FLOAT,
    indexed_at TIMESTAMP DEFAULT NOW()
);

-- Add UNIQUE constraint on event_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_event_id'
    ) THEN
        ALTER TABLE nostr_events 
        ADD CONSTRAINT unique_event_id UNIQUE (event_id);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_nostr_events_kind ON nostr_events(kind);
CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey ON nostr_events(pubkey);
CREATE INDEX IF NOT EXISTS idx_nostr_events_created_at ON nostr_events(event_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nostr_events_quality ON nostr_events(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_nostr_events_document ON nostr_events(document_id);
