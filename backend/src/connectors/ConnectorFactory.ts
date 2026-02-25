import { Pool } from 'pg';
import { BaseConnector, CrawlerRecord, ServerRecord } from './BaseConnector';
import { ProductCrawler } from './ProductCrawler';
import { NostrConnector } from './NostrConnector';

export class ConnectorFactory {
  static create(pool: Pool, server: ServerRecord, crawler: CrawlerRecord): BaseConnector {
    switch (server.type) {
      case 'postgresql':
      case 'mysql':
        return new ProductCrawler(pool, server, crawler);
      case 'nostr':
        return new NostrConnector(pool, server, crawler);
      default:
        throw new Error(`Unsupported connector type: ${server.type}`);
    }
  }
}
