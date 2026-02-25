import { Pool } from 'pg';
import { CreateCrawlerInput, UpdateCrawlerInput } from '../models/Crawler';

const ALLOWED_TYPES = new Set(['product', 'external', 'manual']);
const ALLOWED_STATUS = new Set(['active', 'inactive', 'error']);
const ALLOWED_SCHEDULE_TYPES = new Set(['cron', 'interval', 'manual']);

function sanitize(input: Partial<CreateCrawlerInput>) {
  return {
    name: typeof input.name === 'string' ? input.name.trim() : '',
    type: input.type,
    server_id: input.server_id ?? null,
    document_type_id: input.document_type_id ?? null,
    status: input.status ?? 'inactive',
    schedule_type: input.schedule_type ?? null,
    schedule_config: input.schedule_config ?? null,
    extraction_config: input.extraction_config ?? {},
    property_mapping: input.property_mapping ?? null,
    access_control: input.access_control ?? null
  };
}

export class CrawlersController {
  constructor(private readonly pool: Pool) {}

  validateCreate(input: Partial<CreateCrawlerInput>): string | null {
    const payload = sanitize(input);
    if (!payload.name) return 'name is required';
    if (!payload.type || !ALLOWED_TYPES.has(payload.type)) {
      return 'type must be one of: product, external, manual';
    }
    if (!payload.extraction_config || typeof payload.extraction_config !== 'object' || Array.isArray(payload.extraction_config)) {
      return 'extraction_config is required and must be an object';
    }
    if (payload.status && !ALLOWED_STATUS.has(payload.status)) {
      return 'status must be one of: active, inactive, error';
    }
    if (payload.schedule_type && !ALLOWED_SCHEDULE_TYPES.has(payload.schedule_type)) {
      return 'schedule_type must be one of: cron, interval, manual';
    }
    return null;
  }

  validateUpdate(input: Partial<UpdateCrawlerInput>): string | null {
    if (Object.keys(input).length === 0) return 'request body is empty';
    if (input.type && !ALLOWED_TYPES.has(input.type)) {
      return 'type must be one of: product, external, manual';
    }
    if (input.status && !ALLOWED_STATUS.has(input.status)) {
      return 'status must be one of: active, inactive, error';
    }
    if (input.schedule_type && !ALLOWED_SCHEDULE_TYPES.has(input.schedule_type)) {
      return 'schedule_type must be one of: cron, interval, manual';
    }
    if (input.extraction_config !== undefined && (!input.extraction_config || typeof input.extraction_config !== 'object' || Array.isArray(input.extraction_config))) {
      return 'extraction_config must be an object';
    }
    return null;
  }

  async list() {
    const result = await this.pool.query('SELECT * FROM crawlers ORDER BY created_at DESC');
    return result.rows;
  }

  async getById(id: string) {
    const result = await this.pool.query('SELECT * FROM crawlers WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async create(input: Partial<CreateCrawlerInput>) {
    const payload = sanitize(input);
    const result = await this.pool.query(
      `INSERT INTO crawlers (name, type, server_id, document_type_id, status, schedule_type, schedule_config, extraction_config, property_mapping, access_control)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        payload.name,
        payload.type,
        payload.server_id,
        payload.document_type_id,
        payload.status,
        payload.schedule_type,
        payload.schedule_config,
        payload.extraction_config,
        payload.property_mapping,
        payload.access_control
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: Partial<UpdateCrawlerInput>) {
    const current = await this.getById(id);
    if (!current) return null;
    const payload = {
      ...current,
      ...input,
      extraction_config: input.extraction_config ?? current.extraction_config ?? {},
      property_mapping: input.property_mapping ?? current.property_mapping,
      access_control: input.access_control ?? current.access_control
    };

    const result = await this.pool.query(
      `UPDATE crawlers
       SET name = $1,
           type = $2,
           server_id = $3,
           document_type_id = $4,
           status = $5,
           schedule_type = $6,
           schedule_config = $7,
           extraction_config = $8,
           property_mapping = $9,
           access_control = $10,
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        payload.name,
        payload.type,
        payload.server_id,
        payload.document_type_id,
        payload.status,
        payload.schedule_type,
        payload.schedule_config,
        payload.extraction_config,
        payload.property_mapping,
        payload.access_control,
        id
      ]
    );

    return result.rows[0] ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM crawlers WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async triggerSync(id: string) {
    const crawler = await this.getById(id);
    if (!crawler) return null;

    const history = await this.pool.query(
      `INSERT INTO sync_history (crawler_id, started_at, status, metadata)
       VALUES ($1, NOW(), 'running', $2)
       RETURNING *`,
      [id, { triggered_by: 'admin_api' }]
    );

    await this.pool.query(
      `UPDATE crawlers
       SET last_sync_at = NOW(),
           last_sync_status = 'running',
           last_sync_error = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return { crawler_id: id, sync: history.rows[0] };
  }

  async deleteDocuments(id: string) {
    const crawler = await this.getById(id);
    if (!crawler) return null;

    const result = await this.pool.query('DELETE FROM documents WHERE source_id = $1', [id]);
    return { crawler_id: id, deleted: result.rowCount ?? 0 };
  }

  async history(id: string, limit = 50) {
    const crawler = await this.getById(id);
    if (!crawler) return null;

    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 50;
    const result = await this.pool.query(
      `SELECT *
       FROM sync_history
       WHERE crawler_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [id, safeLimit]
    );

    return result.rows;
  }
}
