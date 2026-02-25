import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
import { BaseConnector, CrawlerRecord, ServerRecord, SyncResult } from './BaseConnector';

type SqlClient = PgPool | mysql.Connection | null;

export class ProductCrawler extends BaseConnector {
  private sqlClient: SqlClient = null;

  constructor(pool: PgPool, server: ServerRecord, crawler: CrawlerRecord) {
    super(pool, server, crawler);
  }

  async connect(): Promise<void> {
    const auth = this.server.auth_config || {};

    if (this.server.type === 'postgresql') {
      this.sqlClient = new PgPool({
        host: this.server.host,
        port: this.server.port || 5432,
        user: auth.username,
        password: auth.password,
        database: this.server.database_name,
        ssl: auth.ssl ? { rejectUnauthorized: false } : undefined,
      });
      return;
    }

    if (this.server.type === 'mysql') {
      this.sqlClient = await mysql.createConnection({
        host: this.server.host,
        port: this.server.port || 3306,
        user: auth.username,
        password: auth.password,
        database: this.server.database_name,
      });
      return;
    }

    throw new Error(`Unsupported SQL server type: ${this.server.type}`);
  }

  async disconnect(): Promise<void> {
    if (!this.sqlClient) return;

    if (this.server.type === 'postgresql') {
      await (this.sqlClient as PgPool).end();
    } else {
      await (this.sqlClient as mysql.Connection).end();
    }

    this.sqlClient = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.sqlClient) await this.connect();

      if (this.server.type === 'postgresql') {
        await (this.sqlClient as PgPool).query('SELECT 1');
      } else {
        await (this.sqlClient as mysql.Connection).query('SELECT 1');
      }

      return true;
    } catch {
      return false;
    }
  }

  async fetchDocuments(since?: Date): Promise<any[]> {
    if (!this.sqlClient) throw new Error('SQL client is not connected');

    const extraction = this.crawler.extraction_config || {};
    const baseQuery = extraction.query || extraction.sql || extraction.data_query;
    if (!baseQuery) {
      throw new Error('Missing extraction_config.query for SQL crawler');
    }

    const modifiedField = extraction.modified_at_field || 'modified_at';
    const sql = since
      ? `${baseQuery} ${baseQuery.toLowerCase().includes(' where ') ? 'AND' : 'WHERE'} ${modifiedField} > ?`
      : baseQuery;

    if (this.server.type === 'postgresql') {
      const pgSql = since ? sql.replace('?', '$1') : sql;
      const result = await (this.sqlClient as PgPool).query(pgSql, since ? [since] : []);
      return result.rows;
    }

    const [rows] = await (this.sqlClient as mysql.Connection).query(sql, since ? [since] : []);
    return rows as any[];
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
      if (!ok) throw new Error('Unable to connect to SQL database');

      const rows = await this.fetchDocuments(since);
      for (const row of rows) {
        const doc = this.transformDocument(row);
        if (!doc) {
          skipped += 1;
          continue;
        }
        await this.indexDocument(doc);
        indexed += 1;
      }

      await this.markSync('success');
      return { fetched: rows.length, indexed, skipped };
    } catch (error) {
      await this.markSync('failed', (error as Error).message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}
