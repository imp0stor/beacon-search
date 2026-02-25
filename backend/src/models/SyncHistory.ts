export type SyncStatus = 'running' | 'success' | 'failed';

export interface SyncHistory {
  id: string;
  crawler_id: string;
  started_at: Date;
  completed_at: Date | null;
  status: SyncStatus | null;
  documents_added: number;
  documents_updated: number;
  documents_deleted: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateSyncHistoryInput {
  crawler_id: string;
  started_at: Date;
  completed_at?: Date | null;
  status?: SyncStatus | null;
  documents_added?: number;
  documents_updated?: number;
  documents_deleted?: number;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}
