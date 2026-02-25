import { Pool } from 'pg';
import { Event, Filter, SimplePool } from 'nostr-tools';
import { BaseConnector, CrawlerRecord, ServerRecord, SyncResult } from './BaseConnector';

export class NostrConnector extends BaseConnector {
  private readonly relayPool: SimplePool;
  private relays: string[] = [];

  constructor(pool: Pool, server: ServerRecord, crawler: CrawlerRecord) {
    super(pool, server, crawler);
    this.relayPool = new SimplePool();
  }

  async connect(): Promise<void> {
    const relayList = this.server.metadata?.relays || this.crawler.extraction_config?.relays || [];
    if (!Array.isArray(relayList) || relayList.length === 0) {
      throw new Error('Nostr connector requires at least one relay URL');
    }
    this.relays = relayList;
  }

  async disconnect(): Promise<void> {
    if (this.relays.length) {
      this.relayPool.close(this.relays);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.relays.length) await this.connect();
      const events = await this.relayPool.querySync(this.relays, { kinds: [1], limit: 1 } as any);
      return Array.isArray(events);
    } catch {
      return false;
    }
  }

  async fetchDocuments(since?: Date): Promise<Event[]> {
    if (!this.relays.length) throw new Error('Relay pool is not connected');

    const filter: Filter = {
      kinds: [0, 1],
      limit: this.crawler.extraction_config?.limit || 1000,
    };

    if (since) {
      filter.since = Math.floor(since.getTime() / 1000);
    }

    const events = await this.relayPool.querySync(this.relays, filter as any);
    return events.filter((evt) => evt.kind === 0 || evt.kind === 1);
  }

  async syncFull(): Promise<SyncResult> {
    return this.syncInternal();
  }

  async syncIncremental(): Promise<SyncResult> {
    return this.syncInternal(this.crawler.last_sync_at || undefined);
  }

  private async syncInternal(since?: Date): Promise<SyncResult> {
    let indexed = 0;
    let skipped = 0;

    try {
      await this.connect();
      const ok = await this.testConnection();
      if (!ok) throw new Error('Unable to connect to Nostr relay set');

      const events = await this.fetchDocuments(since);
      for (const event of events) {
        const doc = this.transformNostrEvent(event);
        if (!doc) {
          skipped += 1;
          continue;
        }
        await this.indexDocument(doc);
        indexed += 1;
      }

      await this.markSync('success');
      return { fetched: events.length, indexed, skipped };
    } catch (error) {
      await this.markSync('failed', (error as Error).message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  private transformNostrEvent(event: Event) {
    if (!event.id || !event.pubkey) {
      return null;
    }

    if (event.kind === 0) {
      let profile: Record<string, any> = {};
      try {
        profile = event.content ? JSON.parse(event.content) : {};
      } catch {
        profile = { raw: event.content };
      }

      return {
        externalId: event.id,
        title: profile.display_name || profile.name || `Nostr profile ${event.pubkey.slice(0, 8)}`,
        content: profile.about || event.content || '',
        url: `nostr:${event.pubkey}`,
        documentType: 'nostr_profile',
        attributes: {
          nostr: true,
          kind: event.kind,
          pubkey: event.pubkey,
          tags: event.tags,
          profile,
        },
        lastModified: new Date(event.created_at * 1000),
      };
    }

    if (event.kind === 1) {
      return {
        externalId: event.id,
        title: `Note by ${event.pubkey.slice(0, 8)}`,
        content: event.content || '',
        url: `nostr:${event.id}`,
        documentType: 'nostr_note',
        attributes: {
          nostr: true,
          kind: event.kind,
          pubkey: event.pubkey,
          tags: event.tags,
        },
        lastModified: new Date(event.created_at * 1000),
      };
    }

    return null;
  }
}
