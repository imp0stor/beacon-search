export type SystemAlertType = 'sync_failure' | 'index_error' | 'performance';

export type SystemAlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SystemAlert {
  id: string;
  type: SystemAlertType;
  severity: SystemAlertSeverity | null;
  message: string;
  source: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  created_at: Date;
}

export interface CreateSystemAlertInput {
  type: SystemAlertType;
  severity?: SystemAlertSeverity | null;
  message: string;
  source?: string | null;
  acknowledged?: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: Date | null;
}

export interface AcknowledgeSystemAlertInput {
  acknowledged: boolean;
  acknowledged_by: string;
  acknowledged_at?: Date;
}
