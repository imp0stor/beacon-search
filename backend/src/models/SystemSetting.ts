import { Pool } from 'pg';

export interface SystemSetting {
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertSystemSettingInput {
  value: unknown;
  category?: string;
  description?: string | null;
}

export class SystemSettingModel {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<SystemSetting[]> {
    const result = await this.pool.query('SELECT * FROM system_settings ORDER BY category, key');
    return result.rows;
  }

  async getByKey(key: string): Promise<SystemSetting | null> {
    const result = await this.pool.query('SELECT * FROM system_settings WHERE key = $1', [key]);
    return result.rows[0] ?? null;
  }

  async upsert(key: string, input: UpsertSystemSettingInput): Promise<SystemSetting> {
    const existing = await this.getByKey(key);

    const result = await this.pool.query(
      `INSERT INTO system_settings (key, value, category, description)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           updated_at = NOW()
       RETURNING *`,
      [
        key,
        JSON.stringify(input.value ?? null),
        input.category ?? existing?.category ?? 'system',
        input.description ?? existing?.description ?? null
      ]
    );

    return result.rows[0];
  }
}
