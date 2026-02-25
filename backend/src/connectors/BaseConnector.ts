import { Pool } from 'pg';

export interface ServerRecord {
  id: string;
  type: 'postgresql' | 'mysql' | 'nostr' | string;
  host?: string;
  port?: number;
  database_name?: string;
  auth_config?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface CrawlerRecord {
  id: string;
  name: string;
  type: string;
  server_id: string;
  extraction_config: Record<string, any>;
  property_mapping?: Record<string, string> | null;
  access_control?: Record<string, any> | null;
  last_sync_at?: Date | null;
}

export interface ConnectorDocument {
  externalId: string;
  title: string;
  content: string;
  url?: string;
  attributes?: Record<string, any>;
  documentType?: string;
  lastModified?: Date;
}

export interface SyncResult {
  fetched: number;
  indexed: number;
  skipped: number;
}

export abstract class BaseConnector {
  protected readonly pool: Pool;
  protected readonly server: ServerRecord;
  protected readonly crawler: CrawlerRecord;

  constructor(pool: Pool, server: ServerRecord, crawler: CrawlerRecord) {
    this.pool = pool;
    this.server = server;
    this.crawler = crawler;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract fetchDocuments(since?: Date): Promise<any[]>;
  abstract syncIncremental(): Promise<SyncResult>;
  abstract syncFull(): Promise<SyncResult>;

  transformDocument(row: Record<string, any>): ConnectorDocument | null {
    const mapping = this.crawler.property_mapping || {};
    const getValue = (target: string, fallback?: string): any => {
      const source = Object.keys(mapping).find((k) => mapping[k] === target) || fallback || target;
      return row[source];
    };

    const externalId = String(getValue('externalId', 'id') ?? '').trim();
    const title = String(getValue('title', 'title') ?? '').trim();
    const content = String(getValue('content', 'content') ?? '').trim();

    if (!externalId || !title || !content) {
      return null;
    }

    const maybeDate = getValue('lastModified', 'modified_at');
    const lastModified = maybeDate ? new Date(maybeDate) : undefined;

    return {
      externalId,
      title,
      content,
      url: getValue('url', 'url') || undefined,
      attributes: getValue('attributes', 'attributes') || {},
      documentType: getValue('documentType', 'document_type') || this.crawler.type,
      lastModified: lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : undefined,
    };
  }

  async indexDocument(document: ConnectorDocument): Promise<void> {
    if (!document.externalId || !document.title || !document.content) {
      throw new Error('Cannot index invalid document');
    }

    await this.pool.query(
      `INSERT INTO documents (source_id, external_id, title, content, url, attributes, document_type, last_modified, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
       ON CONFLICT (source_id, external_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         url = EXCLUDED.url,
         attributes = EXCLUDED.attributes,
         document_type = EXCLUDED.document_type,
         last_modified = EXCLUDED.last_modified,
         updated_at = NOW()`,
      [
        this.server.id,
        document.externalId,
        document.title,
        document.content,
        document.url || null,
        JSON.stringify(document.attributes || {}),
        document.documentType || this.crawler.type,
        document.lastModified || null,
      ]
    );
  }

  protected async markSync(status: 'success' | 'failed', error?: string): Promise<void> {
    await this.pool.query(
      `UPDATE crawlers
       SET last_sync_at = NOW(),
           last_sync_status = $2,
           last_sync_error = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [this.crawler.id, status, error || null]
    );
  }
}
