import { Pool } from 'pg';

export interface DocumentTypeInput {
  name: string;
  display_name?: string | null;
  description?: string | null;
  fields: Record<string, any>;
  display_template?: string | null;
  relevancy_config?: Record<string, any>;
}

function normalize(input: Partial<DocumentTypeInput>) {
  return {
    name: typeof input.name === 'string' ? input.name.trim().toLowerCase() : '',
    display_name: input.display_name ?? null,
    description: input.description ?? null,
    fields: input.fields ?? {},
    display_template: input.display_template ?? null,
    relevancy_config: input.relevancy_config ?? {}
  };
}

export class DocumentTypesController {
  constructor(private readonly pool: Pool) {}

  validateCreate(input: Partial<DocumentTypeInput>): string | null {
    const payload = normalize(input);
    if (!payload.name) return 'name is required';
    if (!/^[a-z0-9_-]+$/.test(payload.name)) return 'name must contain only a-z, 0-9, _ or -';
    if (typeof payload.fields !== 'object' || Array.isArray(payload.fields)) return 'fields must be an object';
    return null;
  }

  validateUpdate(input: Partial<DocumentTypeInput>): string | null {
    if (Object.keys(input).length === 0) return 'request body is empty';
    if (input.name !== undefined && !/^[a-z0-9_-]+$/.test(input.name)) return 'name must contain only a-z, 0-9, _ or -';
    if (input.fields !== undefined && (typeof input.fields !== 'object' || Array.isArray(input.fields))) {
      return 'fields must be an object';
    }
    return null;
  }

  async list() {
    const result = await this.pool.query('SELECT * FROM document_types ORDER BY created_at DESC');
    return result.rows;
  }

  async getById(id: string) {
    const result = await this.pool.query('SELECT * FROM document_types WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async create(input: Partial<DocumentTypeInput>) {
    const payload = normalize(input);
    const result = await this.pool.query(
      `INSERT INTO document_types (name, display_name, description, fields, display_template, relevancy_config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [payload.name, payload.display_name, payload.description, payload.fields, payload.display_template, payload.relevancy_config]
    );
    return result.rows[0];
  }

  async update(id: string, input: Partial<DocumentTypeInput>) {
    const existing = await this.getById(id);
    if (!existing) return null;

    const payload = {
      ...existing,
      ...input,
      name: input.name !== undefined ? input.name.trim().toLowerCase() : existing.name,
      fields: input.fields ?? existing.fields ?? {},
      relevancy_config: input.relevancy_config ?? existing.relevancy_config ?? {}
    };

    const result = await this.pool.query(
      `UPDATE document_types
       SET name = $1,
           display_name = $2,
           description = $3,
           fields = $4,
           display_template = $5,
           relevancy_config = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [payload.name, payload.display_name, payload.description, payload.fields, payload.display_template, payload.relevancy_config, id]
    );

    return result.rows[0];
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM document_types WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
