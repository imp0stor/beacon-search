import { Pool } from 'pg';
import { ConnectorFactory } from '../connectors/ConnectorFactory';
import { AlertService } from '../services/AlertService';

interface CrawlerRow {
  id: string;
  name: string;
  type: string;
  server_id: string;
  extraction_config: Record<string, any>;
  property_mapping: Record<string, any> | null;
  access_control: Record<string, any> | null;
  last_sync_at: Date | null;
}

interface ServerRow {
  id: string;
  type: string;
  host: string | null;
  port: number | null;
  database_name: string | null;
  auth_config: Record<string, any> | null;
  metadata: Record<string, any> | null;
}

export class SyncExecutor {
  constructor(
    private readonly pool: Pool,
    private readonly alertService: AlertService = new AlertService(pool)
  ) {}

  async executeCrawler(crawlerId: string, reason: 'manual' | 'schedule' = 'manual') {
    const crawlerResult = await this.pool.query(
      `SELECT * FROM crawlers WHERE id = $1`,
      [crawlerId]
    );

    const crawler = crawlerResult.rows[0] as CrawlerRow | undefined;
    if (!crawler) {
      throw new Error('Crawler not found');
    }

    if (!crawler.server_id) {
      throw new Error('Crawler has no server configured');
    }

    const serverResult = await this.pool.query('SELECT * FROM servers WHERE id = $1', [crawler.server_id]);
    const server = serverResult.rows[0] as ServerRow | undefined;

    if (!server) {
      throw new Error('Server not found for crawler');
    }

    const startedAt = new Date();
    const history = await this.pool.query(
      `INSERT INTO sync_history (crawler_id, started_at, status, metadata)
       VALUES ($1, $2, 'running', $3)
       RETURNING *`,
      [crawler.id, startedAt, { reason }]
    );

    const historyId = history.rows[0].id as string;

    try {
      const connector = ConnectorFactory.create(this.pool, server as any, crawler as any);
      const mode = ((crawler.extraction_config || {}).mode || 'incremental') as string;
      const syncResult = mode === 'full'
        ? await connector.syncFull()
        : await connector.syncIncremental();

      await this.pool.query(
        `UPDATE sync_history
         SET completed_at = NOW(),
             status = 'success',
             documents_added = $2,
             documents_updated = 0,
             documents_deleted = 0,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $1`,
        [historyId, syncResult.indexed, JSON.stringify({ fetched: syncResult.fetched, skipped: syncResult.skipped, mode })]
      );

      await this.pool.query(
        `UPDATE crawlers
         SET last_sync_at = NOW(),
             last_sync_status = 'success',
             last_sync_error = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [crawler.id]
      );

      return {
        crawler_id: crawler.id,
        status: 'success',
        ...syncResult,
        history_id: historyId
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';

      await this.pool.query(
        `UPDATE sync_history
         SET completed_at = NOW(),
             status = 'failed',
             error_message = $2
         WHERE id = $1`,
        [historyId, message]
      );

      await this.pool.query(
        `UPDATE crawlers
         SET last_sync_at = NOW(),
             last_sync_status = 'failed',
             last_sync_error = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [crawler.id, message]
      );

      await this.alertService.createAlert({
        type: 'sync_failure',
        severity: 'error',
        message: `Crawler \"${crawler.name}\" sync failed: ${message}`,
        source: crawler.name
      });

      throw error;
    }
  }
}
