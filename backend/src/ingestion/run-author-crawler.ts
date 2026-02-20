#!/usr/bin/env node

// Polyfill for nostr-tools
(global as any).window = {
  printer: {
    maybe: (...args: any[]) => {}
  }
};

import { Pool } from 'pg';
import { AuthorCrawler } from './author-crawler';
import dotenv from 'dotenv';

dotenv.config();

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://relay.primal.net',
  'wss://nostr.wine',
];

async function main() {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await db.query('SELECT NOW()');
    console.log('✓ Database connected');
    
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
    `);
    
    console.log('✓ Database schema ready\n');
    
    const crawler = new AuthorCrawler(RELAYS, db);
    await crawler.initialize();
    
    const result = await crawler.crawlPopularAuthors();
    
    console.log('\n✓ Author crawl complete');
    
    crawler.cleanup();
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
