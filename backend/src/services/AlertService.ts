import { Pool } from 'pg';
import { SystemAlertSeverity, SystemAlertType } from '../models/SystemAlert';

export interface CreateAlertInput {
  type: SystemAlertType;
  message: string;
  source?: string | null;
  severity?: SystemAlertSeverity;
}

export class AlertService {
  constructor(private readonly pool: Pool) {}

  async createAlert(input: CreateAlertInput) {
    const result = await this.pool.query(
      `INSERT INTO system_alerts (type, severity, message, source)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.type, input.severity ?? 'error', input.message, input.source ?? null]
    );

    return result.rows[0];
  }
}
