import { Filter as NostrFilter, Event as NostrEvent } from 'nostr-tools';
import { Pool } from 'pg';
import { RelayManager } from './relay-manager';
import { DocumentTypeClassifier } from './document-classifier';
import { ContentExtractorFactory } from './content-extractor';
import { AntiSpamFilter } from './spam-filter';

interface AuthorStats {
  pubkey: string;
  eventCount: number;
  mentions: number;
  score: number; // Engagement score
}

/**
 * Author-based crawler: Query popular authors' full history
 * This gets MUCH more content per relay than kind-based queries
 */
export class AuthorCrawler {
  private relayManager: RelayManager;
  private classifier: DocumentTypeClassifier;
  private spamFilter: AntiSpamFilter;
  private db: Pool;
  private authors: Map<string, AuthorStats> = new Map();
  
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
      'wss://nostr.mom',
      'wss://relay.primal.net',
      'wss://nostr.wine',
    ];
    
    console.log('Discovering relay capabilities...');
    
    for (const relay of relays) {
      await this.relayManager.discoverRelayInfo(relay);
    }
    
    console.log('✓ Relay discovery complete\n');
  }
  
  /**
   * Discover popular authors from existing events
   */
  async discoverPopularAuthors(limit: number = 100): Promise<string[]> {
    console.log('🔍 Discovering popular authors from database...\n');
    
    const client = await this.db.connect();
    
    try {
      // Get authors by event count
      const result = await client.query(`
        SELECT 
          pubkey,
          COUNT(*) as event_count
        FROM nostr_events
        GROUP BY pubkey
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT $1
      `, [limit]);
      
      for (const row of result.rows) {
        this.authors.set(row.pubkey, {
          pubkey: row.pubkey,
          eventCount: parseInt(row.event_count),
          mentions: 0,
          score: parseInt(row.event_count),
        });
      }
      
      console.log(`Found ${this.authors.size} popular authors`);
      console.log(`Top 10:`);
      
      const sorted = Array.from(this.authors.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      for (const author of sorted) {
        console.log(`  ${author.pubkey.slice(0, 16)}... - ${author.eventCount} events`);
      }
      
      console.log('');
      
      return Array.from(this.authors.keys());
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Fetch ALL events from a specific author
   */
  async fetchAuthorHistory(
    pubkey: string,
    kinds: number[] = [1, 30023, 30024]
  ): Promise<{ total: number; indexed: number }> {
    let until = Math.floor(Date.now() / 1000);
    let totalFetched = 0;
    let totalIndexed = 0;
    let hasMore = true;
    
    while (hasMore) {
      const filter: NostrFilter = {
        authors: [pubkey],
        kinds: kinds,
        limit: 500,
        until: until,
      };
      
      const relays = this.relayManager.selectRelays(filter, 5);
      const events = await this.relayManager.fetchWithRateLimit(relays, filter, 500);
      
      if (events.length === 0) {
        hasMore = false;
        break;
      }
      
      totalFetched += events.length;
      
      for (const event of events) {
        try {
          const docType = this.classifier.classify(event);
          
          if (docType.priority < 3) {
            continue;
          }
          
          const extractor = ContentExtractorFactory.create(docType);
          const extracted = extractor.extract(event);
          
          const spamCheck = this.spamFilter.check(event, extracted);
          
          if (spamCheck.isSpam) {
            continue;
          }
          
          await this.indexEvent(event, extracted);
          totalIndexed++;
          
        } catch (error) {
          // Skip errors
        }
      }
      
      // Update cursor
      const oldestEvent = events.reduce((oldest, e) => 
        e.created_at < oldest.created_at ? e : oldest
      );
      until = oldestEvent.created_at - 1;
      
      // Stop if we got less than a full batch
      if (events.length < 500) {
        hasMore = false;
      }
    }
    
    return { total: totalFetched, indexed: totalIndexed };
  }
  
  /**
   * Crawl all popular authors' full history
   */
  async crawlPopularAuthors(): Promise<any> {
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(60));
    console.log('AUTHOR-BASED CRAWLER');
    console.log('Deep history: Query authors\' full timelines');
    console.log('='.repeat(60) + '\n');
    
    // Discover popular authors
    const authors = await this.discoverPopularAuthors(50);
    
    console.log('🚀 Crawling full history for top 50 authors...\n');
    
    let grandTotal = 0;
    let grandIndexed = 0;
    let processedAuthors = 0;
    
    for (const pubkey of authors) {
      const authorInfo = this.authors.get(pubkey)!;
      
      console.log(`[${processedAuthors + 1}/50] ${pubkey.slice(0, 16)}... (${authorInfo.eventCount} existing)`);
      
      const result = await this.fetchAuthorHistory(pubkey);
      
      grandTotal += result.total;
      grandIndexed += result.indexed;
      processedAuthors++;
      
      console.log(`  → Fetched ${result.total}, Indexed ${result.indexed} (Total: ${grandIndexed})\n`);
      
      // Progress update every 10 authors
      if (processedAuthors % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = grandIndexed / elapsed;
        console.log(`📊 Progress: ${processedAuthors}/50 authors | ${grandIndexed} indexed | ${rate.toFixed(1)} events/sec\n`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Authors Crawled: ${processedAuthors}`);
    console.log(`Total Fetched: ${grandTotal} events`);
    console.log(`Total Indexed: ${grandIndexed} events`);
    console.log(`Rate: ${(grandIndexed / (duration / 1000)).toFixed(1)} events/sec`);
    console.log(`\nAverage per author: ${(grandIndexed / processedAuthors).toFixed(0)} events`);
    console.log('='.repeat(60));
    
    return {
      duration,
      authors: processedAuthors,
      totalFetched: grandTotal,
      totalIndexed: grandIndexed,
    };
  }
  
  private async indexEvent(event: NostrEvent, extracted: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
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
