import { Filter as NostrFilter, Event as NostrEvent } from 'nostr-tools';
import { Pool } from 'pg';
import { RelayManager } from './relay-manager';
import { DocumentTypeClassifier } from './document-classifier';
import { ContentExtractorFactory } from './content-extractor';
import { AntiSpamFilter } from './spam-filter';

export class PaginatedIngestionPipeline {
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
    
    console.log('✓ Relay discovery complete\n');
  }
  
  /**
   * Fetch ALL events for a given kind, paginating through history
   */
  async fetchAllEventsForKind(
    kind: number,
    batchSize: number = 500
  ): Promise<{ total: number; indexed: number; filtered: number }> {
    let until = Math.floor(Date.now() / 1000); // Start from now
    let totalFetched = 0;
    let totalIndexed = 0;
    let totalFiltered = 0;
    let hasMore = true;
    
    console.log(`\n🔍 Fetching ALL events for kind:${kind} (paginated in ${batchSize} batches)`);
    console.log('──────────────────────────────────────────────────────────');
    
    while (hasMore) {
      const filter: NostrFilter = {
        kinds: [kind],
        limit: batchSize,
        until: until, // Fetch events older than this timestamp
      };
      
      // Select best relays
      const relays = this.relayManager.selectRelays(filter, 3);
      
      // Fetch batch
      const events = await this.relayManager.fetchWithRateLimit(relays, filter, batchSize);
      
      if (events.length === 0) {
        console.log(`No more events found for kind:${kind}`);
        hasMore = false;
        break;
      }
      
      totalFetched += events.length;
      
      // Process events
      for (const event of events) {
        try {
          const docType = this.classifier.classify(event);
          
          if (docType.priority < 3) {
            continue; // Skip low-priority
          }
          
          // Extract content
          const extractor = ContentExtractorFactory.create(docType);
          const extracted = extractor.extract(event);
          
          // Spam check
          const spamCheck = this.spamFilter.check(event, extracted);
          
          if (spamCheck.isSpam) {
            totalFiltered++;
            continue;
          }
          
          // Index
          await this.indexEvent(event, extracted);
          totalIndexed++;
          
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
      
      // Update cursor for next batch (oldest event timestamp)
      const oldestEvent = events.reduce((oldest, e) => 
        e.created_at < oldest.created_at ? e : oldest
      );
      until = oldestEvent.created_at - 1; // Fetch events older than this
      
      // Progress update
      console.log(
        `Progress: Fetched ${totalFetched} | Indexed ${totalIndexed} | Filtered ${totalFiltered} | ` +
        `Last: ${new Date(until * 1000).toISOString().split('T')[0]}`
      );
      
      // Check if we got a full batch (if not, we've reached the end)
      if (events.length < batchSize) {
        console.log(`Reached end of history for kind:${kind} (last batch: ${events.length} events)`);
        hasMore = false;
      }
    }
    
    console.log(`✓ Completed kind:${kind} - Indexed ${totalIndexed}/${totalFetched} events\n`);
    
    return {
      total: totalFetched,
      indexed: totalIndexed,
      filtered: totalFiltered,
    };
  }
  
  /**
   * Fetch ALL historical events across multiple kinds
   */
  async fetchAllHistory(): Promise<any> {
    const startTime = Date.now();
    const kinds = [1, 30023, 30024, 30402, 30040, 1063, 30311]; // All interesting kinds
    
    console.log('\n' + '='.repeat(60));
    console.log('COMPREHENSIVE HISTORICAL CRAWL');
    console.log('Fetching ALL events from ALL time');
    console.log('='.repeat(60) + '\n');
    
    const results: Record<number, any> = {};
    let grandTotal = 0;
    let grandIndexed = 0;
    let grandFiltered = 0;
    
    for (const kind of kinds) {
      const result = await this.fetchAllEventsForKind(kind, 500);
      results[kind] = result;
      grandTotal += result.total;
      grandIndexed += result.indexed;
      grandFiltered += result.filtered;
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Total Fetched: ${grandTotal} events`);
    console.log(`Total Indexed: ${grandIndexed} events`);
    console.log(`Total Filtered: ${grandFiltered} spam (${((grandFiltered / grandTotal) * 100).toFixed(1)}%)`);
    console.log(`Rate: ${(grandIndexed / (duration / 1000)).toFixed(1)} events/sec`);
    console.log('\nBreakdown by Kind:');
    
    for (const [kind, result] of Object.entries(results)) {
      console.log(`  kind:${kind} - ${result.indexed}/${result.total} indexed (${result.filtered} filtered)`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
      duration,
      totalFetched: grandTotal,
      totalIndexed: grandIndexed,
      totalFiltered: grandFiltered,
      byKind: results,
      relayStats: this.relayManager.getStats(),
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
          last_modified, attributes
        ) VALUES ($1, $2, $3, $4, $5, $6)
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
          }),
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
