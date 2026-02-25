import { Pool } from 'pg';

export interface ServerInput {
  name: string;
  type: string;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  auth_type?: string | null;
  auth_config?: Record<string, any>;
  metadata?: Record<string, any>;
}

function isValidHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  return /^[a-zA-Z0-9.-]+$/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function sanitizeInput(input: Partial<ServerInput>) {
  return {
    name: typeof input.name === 'string' ? input.name.trim() : '',
    type: typeof input.type === 'string' ? input.type.trim().toLowerCase() : '',
    host: input.host ?? null,
    port: input.port ?? null,
    database_name: input.database_name ?? null,
    auth_type: input.auth_type ?? null,
    auth_config: input.auth_config ?? {},
    metadata: input.metadata ?? {}
  };
}

export class ServersController {
  constructor(private readonly pool: Pool) {}

  async list() {
    const result = await this.pool.query('SELECT * FROM servers ORDER BY created_at DESC');
    return result.rows;
  }

  async getById(id: string) {
    const result = await this.pool.query('SELECT * FROM servers WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  validateCreate(input: Partial<ServerInput>): string | null {
    const payload = sanitizeInput(input);

    if (!payload.name) return 'name is required';
    if (!payload.type) return 'type is required';
    if (payload.host && !isValidHost(payload.host)) return 'host is invalid';
    if (payload.port !== null && (!Number.isInteger(payload.port) || payload.port < 1 || payload.port > 65535)) {
      return 'port must be between 1 and 65535';
    }

    return null;
  }

  validateUpdate(input: Partial<ServerInput>): string | null {
    if (Object.keys(input).length === 0) return 'request body is empty';
    if (input.host !== undefined && input.host !== null && !isValidHost(input.host)) return 'host is invalid';
    if (input.port !== undefined && input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
      return 'port must be between 1 and 65535';
    }
    return null;
  }

  async create(input: Partial<ServerInput>) {
    const payload = sanitizeInput(input);

    const result = await this.pool.query(
      `INSERT INTO servers (name, type, host, port, database_name, auth_type, auth_config, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        payload.name,
        payload.type,
        payload.host,
        payload.port,
        payload.database_name,
        payload.auth_type,
        payload.auth_config,
        payload.metadata
      ]
    );

    return result.rows[0];
  }

  async update(id: string, input: Partial<ServerInput>) {
    const current = await this.getById(id);
    if (!current) return null;

    const payload = {
      ...current,
      ...input,
      auth_config: input.auth_config ?? current.auth_config ?? {},
      metadata: input.metadata ?? current.metadata ?? {}
    };

    const result = await this.pool.query(
      `UPDATE servers
       SET name = $1,
           type = $2,
           host = $3,
           port = $4,
           database_name = $5,
           auth_type = $6,
           auth_config = $7,
           metadata = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        payload.name,
        payload.type,
        payload.host,
        payload.port,
        payload.database_name,
        payload.auth_type,
        payload.auth_config,
        payload.metadata,
        id
      ]
    );

    return result.rows[0];
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM servers WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async testConnection(id: string) {
    const server = await this.getById(id);
    if (!server) return null;

    const startedAt = Date.now();
    let ok = false;
    let error: string | null = null;

    try {
      if ((server.type || '').toLowerCase() === 'postgres') {
        const probe = new Pool({
          host: server.host,
          port: server.port || 5432,
          database: server.database_name,
          user: server.auth_config?.user,
          password: server.auth_config?.password,
          ssl: server.auth_config?.ssl ? { rejectUnauthorized: false } : undefined,
          max: 1,
          idleTimeoutMillis: 1000,
          connectionTimeoutMillis: 5000
        });
        await probe.query('SELECT 1');
        await probe.end();
        ok = true;
      } else {
        ok = true;
      }
    } catch (err) {
      error = (err as Error).message;
    }

    return {
      server_id: id,
      success: ok,
      latency_ms: Date.now() - startedAt,
      error
    };
  }
}
