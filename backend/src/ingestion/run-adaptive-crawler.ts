#!/usr/bin/env node

// Polyfill for nostr-tools in Node.js environment
(global as any).window = {
  printer: {
    maybe: (...args: any[]) => {
      // Silently ignore printer calls in Node.js
    }
  }
};

import { Pool } from 'pg';
import { AdaptiveIngestionPipeline } from './adaptive-pipeline';
import dotenv from 'dotenv';

dotenv.config();

// Start with a small set of well-known relays
// The crawler will discover many more as it runs
const INITIAL_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://relay.nostr.band',
];

async function main() {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await db.query('SELECT NOW()');
    console.log('✓ Database connected');
    
    // Ensure tables exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS nostr_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
        event_id TEXT UNIQUE NOT NULL,
        pubkey TEXT NOT NULL,
        kind INTEGER NOT NULL,
        event_created_at TIMESTAMP NOT NULL,
        tags JSONB,
        event_metadata JSONB,
        quality_score FLOAT,
        indexed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_nostr_events_kind ON nostr_events(kind);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey ON nostr_events(pubkey);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_created_at ON nostr_events(event_created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_quality ON nostr_events(quality_score DESC);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_document ON nostr_events(document_id);
    `);
    
    console.log('✓ Database schema ready\n');
    
    console.log('═'.repeat(60));
    console.log('ADAPTIVE NOSTR CRAWLER');
    console.log('Web-style discovery: Find relays → Crawl relays → Repeat');
    console.log('═'.repeat(60));
    console.log(`Starting with ${INITIAL_RELAYS.length} seed relays`);
    console.log('Will discover and crawl new relays as they appear in events\n');
    
    const pipeline = new AdaptiveIngestionPipeline(INITIAL_RELAYS, db);
    await pipeline.initialize();
    
    const result = await pipeline.fetchAllHistory();
    
    console.log('\n📄 Full results saved');
    
    pipeline.cleanup();
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main();
