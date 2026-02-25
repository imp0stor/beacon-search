export type CrawlerType = 'product' | 'external' | 'manual';

export type CrawlerStatus = 'active' | 'inactive' | 'error';

export type CrawlerScheduleType = 'cron' | 'interval' | 'manual';

export interface Crawler {
  id: string;
  name: string;
  type: CrawlerType;
  server_id: string | null;
  document_type_id: string | null;
  status: CrawlerStatus;
  schedule_type: CrawlerScheduleType | null;
  schedule_config: Record<string, unknown> | null;
  extraction_config: Record<string, unknown>;
  property_mapping: Record<string, unknown> | null;
  access_control: Record<string, unknown> | null;
  last_sync_at: Date | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCrawlerInput {
  name: string;
  type: CrawlerType;
  server_id?: string | null;
  document_type_id?: string | null;
  status?: CrawlerStatus;
  schedule_type?: CrawlerScheduleType | null;
  schedule_config?: Record<string, unknown> | null;
  extraction_config: Record<string, unknown>;
  property_mapping?: Record<string, unknown> | null;
  access_control?: Record<string, unknown> | null;
}

export interface UpdateCrawlerInput extends Partial<CreateCrawlerInput> {}
