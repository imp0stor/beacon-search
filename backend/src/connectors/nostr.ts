/**
 * Nostr Relay Connector
 * Indexes Nostr events from relay pools
 */

import { BaseConnector } from './base';
import { Connector, NostrConnectorConfig, ExtractedDocument } from './types';
import { SimplePool, Event, Filter } from 'nostr-tools';
import { parseNostrEvent, normalizeNostrEvent } from '../templates/nostr/parser';
import { getSearchableKinds } from '../templates/nostr/kinds';
import { kindToContentType } from '../services/contentTypeMapper';

export class NostrConnector extends BaseConnector {
  private pool: SimplePool;
  private config: NostrConnectorConfig;

  constructor(connector: Connector) {
    super(connector);
    this.config = connector.config as NostrConnectorConfig;
    this.pool = new SimplePool();
  }

  protected async execute(): Promise<void> {
    const { relays, kinds, authors, tags, since, until, limit, subscribeMode } = this.config;

    // Build Nostr filter
    const filter: Filter = {
      kinds: kinds || getSearchableKinds(),
    };

    if (authors && authors.length > 0) {
      filter.authors = authors;
    }

    if (since) {
      filter.since = since;
    }

    if (until) {
      filter.until = until;
    }

    if (limit) {
      filter.limit = limit;
    }

    // Add tag filters
    if (tags) {
      Object.entries(tags).forEach(([key, values]) => {
        (filter as any)[`#${key}`] = values;
      });
    }

    this.log(`Connecting to ${relays.length} relay(s)`);
    this.log(`Filter: ${JSON.stringify(filter)}`);

    if (subscribeMode) {
      // Live subscription mode
      await this.subscribe(relays, filter);
    } else {
      // One-time sync mode
      await this.sync(relays, filter);
    }
  }

  /**
   * One-time sync: fetch events and close
   */
  private async sync(relays: string[], filter: Filter): Promise<void> {
    try {
      const events = await this.pool.querySync(relays, [filter] as any);
      
      this.log(`Fetched ${events.length} events`);
      this.updateProgress(0, events.length);

      let processed = 0;
      let indexed = 0;

      for (const event of events) {
        if (!this.shouldContinue()) break;

        const doc = this.processEvent(event);
        if (doc) {
          this.emitDocument(doc);
          indexed++;
        }

        processed++;
        this.updateProgress(processed, events.length, event.id.slice(0, 8));
      }

      this.log(`Processed ${processed} events, indexed ${indexed} documents`);
    } catch (error) {
      this.log(`Sync error: ${(error as Error).message}`);
      throw error;
    } finally {
      this.pool.close(relays);
    }
  }

  /**
   * Live subscription mode
   */
  private async subscribe(relays: string[], filter: Filter): Promise<void> {
    this.log('Starting live subscription...');

    let eventCount = 0;
    let indexedCount = 0;

    const sub = this.pool.subscribeMany(
      relays,
      [filter] as any,
      {
        onevent: (event: Event) => {
          if (!this.shouldContinue()) {
            sub.close();
            return;
          }

          eventCount++;
          const doc = this.processEvent(event);
          
          if (doc) {
            this.emitDocument(doc);
            indexedCount++;
          }

          if (eventCount % 10 === 0) {
            this.log(`Received ${eventCount} events, indexed ${indexedCount}`);
          }
        },
        oneose: () => {
          this.log('Reached end of stored events (EOSE)');
          if (!this.config.subscribeMode) {
            sub.close();
          }
        },
      }
    );

    // Wait for stop signal
    while (this.shouldContinue()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    sub.close();
    this.log(`Subscription closed. Total: ${eventCount} events, ${indexedCount} indexed`);
  }

  /**
   * Process a single Nostr event
   */
  private processEvent(event: Event): ExtractedDocument | null {
    try {
      const parsed = parseNostrEvent(event);
      if (!parsed) return null;

      const normalized = normalizeNostrEvent(parsed);
      
      const contentType = kindToContentType(event.kind);
      return {
        externalId: normalized.externalId,
        title: normalized.title,
        content: normalized.content,
        url: normalized.url,
        attributes: normalized.attributes,
        lastModified: new Date(event.created_at * 1000),
        ...(contentType ? { content_type: contentType } : {}),
      };
    } catch (error) {
      this.log(`Failed to process event ${event.id}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Cleanup
   */
  public async cleanup(): Promise<void> {
    this.pool.close(this.config.relays);
  }
}
