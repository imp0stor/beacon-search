import { Filter as NostrFilter, Event as NostrEvent } from 'nostr-tools';
import { Pool } from 'pg';
import { RelayManager } from './relay-manager';
import { DocumentTypeClassifier } from './document-classifier';
import { ContentExtractorFactory } from './content-extractor';
import { AntiSpamFilter } from './spam-filter';
import { AdaptiveRelayCrawler } from './relay-discovery';

/**
 * Adaptive pipeline that discovers new relays as it crawls
 */
export class AdaptiveIngestionPipeline {
  private relayManager: RelayManager;
  private classifier: DocumentTypeClassifier;
  private spamFilter: AntiSpamFilter;
  private db: Pool;
  private crawler: AdaptiveRelayCrawler;
  
  constructor(initialRelays: string[], db: Pool) {
    this.relayManager = new RelayManager(initialRelays);
    this.classifier = new DocumentTypeClassifier();
    this.spamFilter = new AntiSpamFilter();
    this.db = db;
    this.crawler = new AdaptiveRelayCrawler(initialRelays);
  }
  
  async initialize(): Promise<void> {
    const relays = this.crawler.getAllRelays();
    
    console.log('Discovering relay capabilities...');
    
    for (const relay of relays) {
      await this.relayManager.discoverRelayInfo(relay);
    }
    
    console.log('✓ Relay discovery complete\n');
  }
  
  /**
   * Fetch events for a kind, discovering and adding new relays as we go
   */
  async fetchAllEventsForKind(
    kind: number,
    batchSize: number = 500
  ): Promise<{ total: number; indexed: number; filtered: number }> {
    let until = Math.floor(Date.now() / 1000);
    let totalFetched = 0;
    let totalIndexed = 0;
    let totalFiltered = 0;
    let hasMore = true;
    let iteration = 0;
    
    console.log(`\n🔍 Fetching ALL events for kind:${kind} with adaptive relay discovery`);
    console.log('──────────────────────────────────────────────────────────');
    
    while (hasMore) {
      iteration++;
      
      const filter: NostrFilter = {
        kinds: [kind],
        limit: batchSize,
        until: until,
      };
      
      // Get relays from RelayManager (only those with initialized configs)
      // This ensures we only query relays we've successfully connected to
      const relays = this.relayManager.selectRelays(filter, 5);
      
      // Fetch batch
      const events = await this.relayManager.fetchWithRateLimit(relays, filter, batchSize);
      
      if (events.length === 0) {
        console.log(`No more events found for kind:${kind}`);
        hasMore = false;
        break;
      }
      
      totalFetched += events.length;
      
      // Process events AND extract relay URLs
      let newRelaysThisBatch = 0;
      
      for (const event of events) {
        // 🔍 Extract relay URLs from this event
        const newRelays = this.crawler.processEvent(event);
        
        if (newRelays.length > 0) {
          newRelaysThisBatch += newRelays.length;
          
          // Add new relays to RelayManager (async, don't block on failures)
          for (const relayUrl of newRelays) {
            try {
              await this.relayManager.discoverRelayInfo(relayUrl);
            } catch (error) {
              // Silently skip relays that fail discovery
              // They won't be added to the query pool
            }
          }
        }
        
        try {
          const docType = this.classifier.classify(event);
          
          if (docType.priority < 3) {
            continue;
          }
          
          const extractor = ContentExtractorFactory.create(docType);
          const extracted = extractor.extract(event);
          
          const spamCheck = this.spamFilter.check(event, extracted);
          
          if (spamCheck.isSpam) {
            totalFiltered++;
            continue;
          }
          
          await this.indexEvent(event, extracted);
          totalIndexed++;
          
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
      
      // Update cursor
      const oldestEvent = events.reduce((oldest, e) => 
        e.created_at < oldest.created_at ? e : oldest
      );
      until = oldestEvent.created_at - 1;
      
      // Progress update
      const crawlerStats = this.crawler.getStats();
      const workingRelays = this.relayManager.getStats();
      const workingCount = Object.keys(workingRelays).length;
      console.log(
        `Iter ${iteration}: Fetched ${totalFetched} | Indexed ${totalIndexed} | ` +
        `Discovered: ${crawlerStats.total} relays (${workingCount} working) | ` +
        `Last: ${new Date(until * 1000).toISOString().split('T')[0]}`
      );
      
      if (events.length < batchSize) {
        console.log(`Reached end for kind:${kind} (last batch: ${events.length})`);
        hasMore = false;
      }
    }
    
    const stats = this.crawler.getStats();
    console.log(`✓ Completed kind:${kind} - Indexed ${totalIndexed}/${totalFetched}`);
    console.log(`  Discovered ${stats.discovered} new relays (total: ${stats.total})\n`);
    
    return {
      total: totalFetched,
      indexed: totalIndexed,
      filtered: totalFiltered,
    };
  }
  
  /**
   * Fetch ALL history with adaptive relay discovery
   */
  async fetchAllHistory(): Promise<any> {
    const startTime = Date.now();
    
    // First, fetch kind:10002 (NIP-65 relay lists) to bootstrap discovery
    console.log('\n🚀 PHASE 1: Bootstrap relay discovery');
    console.log('Fetching NIP-65 relay lists (kind:10002)...\n');
    
    await this.fetchAllEventsForKind(10002, 500);
    
    const bootstrapStats = this.crawler.getStats();
    console.log(`✓ Bootstrap complete - Discovered ${bootstrapStats.discovered} new relays`);
    console.log(`  Total relay pool: ${bootstrapStats.total} relays\n`);
    
    // Now fetch other content types
    console.log('🚀 PHASE 2: Comprehensive content crawl');
    const kinds = [1, 30023, 30024, 30402, 30040, 1063, 30311];
    
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
    const finalStats = this.crawler.getStats();
    
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Total Fetched: ${grandTotal} events`);
    console.log(`Total Indexed: ${grandIndexed} events`);
    console.log(`Total Filtered: ${grandFiltered} spam`);
    console.log(`\n📡 Relay Discovery:`);
    console.log(`  Started with: ${finalStats.initial} relays`);
    console.log(`  Discovered: ${finalStats.discovered} new relays`);
    console.log(`  Total pool: ${finalStats.total} relays`);
    console.log(`\nBreakdown by Kind:`);
    
    for (const [kind, result] of Object.entries(results)) {
      console.log(`  kind:${kind} - ${result.indexed}/${result.total} indexed`);
    }
    
    console.log('\n🔗 Discovered Relays:');
    const newRelays = this.crawler.getNewRelays();
    newRelays.slice(0, 20).forEach(url => console.log(`  • ${url}`));
    if (newRelays.length > 20) {
      console.log(`  ... and ${newRelays.length - 20} more`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
      duration,
      totalFetched: grandTotal,
      totalIndexed: grandIndexed,
      totalFiltered: grandFiltered,
      relayDiscovery: finalStats,
      discoveredRelays: newRelays,
      byKind: results,
    };
  }
  
  private async indexEvent(event: NostrEvent, extracted: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
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
