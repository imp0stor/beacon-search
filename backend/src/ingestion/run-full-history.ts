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
import { PaginatedIngestionPipeline } from './paginated-pipeline';
import dotenv from 'dotenv';

dotenv.config();

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.mom',
];

async function main() {
  // Connect to database
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('✓ Database connected');
    
    // Ensure nostr_events table exists
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
    
    // Create indexes if they don't exist
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_nostr_events_kind ON nostr_events(kind);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey ON nostr_events(pubkey);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_created_at ON nostr_events(event_created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_quality ON nostr_events(quality_score DESC);
      CREATE INDEX IF NOT EXISTS idx_nostr_events_document ON nostr_events(document_id);
    `);
    
    console.log('✓ Database schema ready');
    
    // Initialize pipeline
    const pipeline = new PaginatedIngestionPipeline(RELAYS, db);
    await pipeline.initialize();
    
    // Run full historical crawl
    const result = await pipeline.fetchAllHistory();
    
    // Print results
    console.log('\n📊 FINAL STATISTICS');
    console.log(JSON.stringify(result, null, 2));
    
    // Cleanup
    pipeline.cleanup();
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Handle signals
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main();
