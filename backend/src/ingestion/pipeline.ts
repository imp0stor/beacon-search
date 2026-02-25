import { Filter as NostrFilter, Event as NostrEvent } from 'nostr-tools';
import { Pool } from 'pg';
import { RelayManager } from './relay-manager';
import { DocumentTypeClassifier } from './document-classifier';
import { ContentExtractorFactory } from './content-extractor';
import { AntiSpamFilter } from './spam-filter';

export interface IngestionStrategy {
  name: string;
  filters: NostrFilter[];
  batchSize: number;
  estimatedEvents: number;
  timeframe?: { since: number; until: number };
}

export interface IngestionResult {
  strategy: string;
  duration: number;
  stats: {
    fetched: number;
    indexed: number;
    filtered: number;
    errors: number;
    byKind: Record<number, { fetched: number; indexed: number; filtered: number }>;
  };
  eventsPerSecond: number;
  relayStats: any;
}

// Predefined strategies
export const STRATEGIES = {
  // Small test run - recent quality content
  RECENT_QUALITY: {
    name: 'Recent Quality Content',
    filters: [
      { kinds: [30023], limit: 1000 }, // Long-form articles
      { kinds: [1], '#t': ['nostr', 'bitcoin', 'tech'], limit: 5000 }, // Tagged notes
    ],
    batchSize: 100,
    estimatedEvents: 6000,
    timeframe: {
      since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60, // Last 7 days
      until: Math.floor(Date.now() / 1000),
    },
  } as IngestionStrategy,
  
  // Medium run - popular content types
  POPULAR_CONTENT: {
    name: 'Popular Content Types',
    filters: [
      { kinds: [1], limit: 10000 }, // Short notes
      { kinds: [30023], limit: 3000 }, // Articles
      { kinds: [30024], limit: 1000 }, // Drafts
    ],
    batchSize: 200,
    estimatedEvents: 14000,
    timeframe: {
      since: Math.floor(Date.now() / 1000) - 14 * 24 * 60 * 60, // Last 14 days
      until: Math.floor(Date.now() / 1000),
    },
  } as IngestionStrategy,
  
  // Large comprehensive crawl
  COMPREHENSIVE_CRAWL: {
    name: 'Comprehensive Crawl',
    filters: [
      { kinds: [1], limit: 50000 }, // All text notes
      { kinds: [30023], limit: 10000 }, // Long-form
      { kinds: [30024], limit: 5000 }, // Drafts
      { kinds: [30402, 30040], limit: 5000 }, // Structured content
      { kinds: [1063, 30311], limit: 3000 }, // Media metadata
    ],
    batchSize: 500,
    estimatedEvents: 73000,
    timeframe: {
      since: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60, // Last 30 days
      until: Math.floor(Date.now() / 1000),
    },
  } as IngestionStrategy,
};

export class IngestionPipeline {
  private relayManager: RelayManager;
  private classifier: DocumentTypeClassifier;
  private spamFilter: AntiSpamFilter;
  private db: Pool;
  
  constructor(relays: string[], db: Pool) {
    this.relayManager = new RelayManager(relays);
    this.classifier = new DocumentTypeClassifier();
    this.spamFilter = new AntiSpamFilter();
    this.db = db;
  }
  
  async initialize(): Promise<void> {
    // Discover relay capabilities
    const relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://nostr.mom',
    ];
    
    console.log('Discovering relay capabilities...');
    
    for (const relay of relays) {
      await this.relayManager.discoverRelayInfo(relay);
    }
    
    console.log('✓ Relay discovery complete');
  }
  
  async execute(strategy: IngestionStrategy): Promise<IngestionResult> {
    const startTime = Date.now();
    const stats = {
      fetched: 0,
      indexed: 0,
      filtered: 0,
      errors: 0,
      byKind: {} as Record<number, { fetched: number; indexed: number; filtered: number }>,
    };
    
    console.log('\n' + '='.repeat(60));
    console.log(`Starting ingestion: ${strategy.name}`);
    console.log(`Estimated events: ${strategy.estimatedEvents}`);
    console.log('='.repeat(60) + '\n');
    
    for (const filter of strategy.filters) {
      // Add timeframe if specified
      if (strategy.timeframe) {
        filter.since = strategy.timeframe.since;
        filter.until = strategy.timeframe.until;
      }
      
      console.log(`\nProcessing filter:`, {
        kinds: filter.kinds,
        limit: filter.limit,
        timeframe: strategy.timeframe,
      });
      
      // Select best relays for this query
      const relays = this.relayManager.selectRelays(filter, 3);
      console.log(`Using relays: ${relays.join(', ')}`);
      
      // Fetch events
      const events = await this.relayManager.fetchWithRateLimit(
        relays,
        filter,
        strategy.batchSize
      );
      
      console.log(`Fetched ${events.length} events, processing...`);
      
      // Process each event
      for (const event of events) {
        stats.fetched++;
        
        // Initialize kind stats
        if (!stats.byKind[event.kind]) {
          stats.byKind[event.kind] = { fetched: 0, indexed: 0, filtered: 0 };
        }
        stats.byKind[event.kind].fetched++;
        
        try {
          // 1. Classify document type
          const docType = this.classifier.classify(event);
          
          if (docType.priority < 3) {
            // Skip low-priority events
            continue;
          }
          
          // 2. Extract content
          const extractor = ContentExtractorFactory.create(docType);
          const extracted = extractor.extract(event);
          
          // 3. Check for spam
          const spamCheck = this.spamFilter.check(event, extracted);
          
          if (spamCheck.isSpam) {
            stats.filtered++;
            stats.byKind[event.kind].filtered++;
            
            if (stats.filtered % 10 === 0) {
              console.log(
                `[SPAM] Filtered ${stats.filtered} spam events (${spamCheck.reasons.join(', ')})`
              );
            }
            continue;
          }
          
          // 4. Index the content
          await this.indexEvent(event, extracted);
          
          stats.indexed++;
          stats.byKind[event.kind].indexed++;
          
          if (stats.indexed % 100 === 0) {
            const progress = ((stats.indexed / strategy.estimatedEvents) * 100).toFixed(1);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const rate = (stats.indexed / (Date.now() - startTime) * 1000).toFixed(1);
            
            console.log(
              `Progress: ${stats.indexed}/${strategy.estimatedEvents} (${progress}%) | ` +
              `${rate} events/sec | ${elapsed}s elapsed`
            );
          }
          
        } catch (error) {
          stats.errors++;
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    const relayStats = this.relayManager.getStats();
    
    // Print final stats
    console.log('\n' + '='.repeat(60));
    console.log('Ingestion Complete!');
    console.log('='.repeat(60));
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Fetched: ${stats.fetched} events`);
    console.log(`Indexed: ${stats.indexed} events`);
    console.log(`Filtered: ${stats.filtered} spam (${((stats.filtered / stats.fetched) * 100).toFixed(1)}%)`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Rate: ${(stats.indexed / (duration / 1000)).toFixed(1)} events/sec`);
    console.log('\nBy Event Kind:');
    
    for (const [kind, kindStats] of Object.entries(stats.byKind)) {
      console.log(
        `  kind:${kind} - ${kindStats.indexed}/${kindStats.fetched} indexed ` +
        `(${kindStats.filtered} filtered)`
      );
    }
    
    return {
      strategy: strategy.name,
      duration,
      stats,
      eventsPerSecond: stats.indexed / (duration / 1000),
      relayStats,
    };
  }
  
  private async indexEvent(event: NostrEvent, extracted: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Insert into documents table
      const documentResult = await client.query(
        `INSERT INTO documents (
          title, content, url, document_type, 
          last_modified, attributes, external_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (source_id, external_id) 
        WHERE source_id IS NOT NULL AND external_id IS NOT NULL
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          updated_at = NOW()
        RETURNING id`,
        [
          extracted.title || `Nostr Event ${event.kind}`,
          extracted.body,
          extracted.metadata.url || null,
          `nostr_kind_${event.kind}`,
          new Date(event.created_at * 1000),
          JSON.stringify({
            ...extracted.metadata,
            tags: extracted.tags,
            quality_score: extracted.quality_score,
            author: event.pubkey, // Store pubkey for author display
          }),
          event.id, // Set external_id to Nostr event ID
        ]
      );
      
      const documentId = documentResult.rows[0].id;
      
      // 2. Insert into nostr_events table
      await client.query(
        `INSERT INTO nostr_events (
          document_id, event_id, pubkey, kind, event_created_at,
          tags, event_metadata, quality_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (event_id) DO UPDATE SET
          quality_score = EXCLUDED.quality_score,
          indexed_at = NOW()`,
        [
          documentId,
          event.id,
          event.pubkey,
          event.kind,
          new Date(event.created_at * 1000),
          JSON.stringify(extracted.tags),
          JSON.stringify(extracted.metadata),
          extracted.quality_score,
        ]
      );
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  cleanup(): void {
    this.relayManager.close();
    this.spamFilter.cleanup();
  }
}
