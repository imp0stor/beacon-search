/**
 * Connector Types for Beacon Search
 * Supports: sql, web, folder connector types
 */

export type ConnectorType = 'sql' | 'web' | 'folder' | 'nostr';

export type ConnectorStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

export interface BaseConnectorConfig {
  type: ConnectorType;
}

export interface SqlConnectorConfig extends BaseConnectorConfig {
  type: 'sql';
  connectionString: string;
  metadataQuery: string;
  dataQuery: string;
}

export interface WebConnectorConfig extends BaseConnectorConfig {
  type: 'web';
  seedUrl: string;
  maxDepth: number;
  sameDomainOnly: boolean;
  respectRobotsTxt: boolean;
  rateLimit: number;
  maxPages: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface FolderConnectorConfig extends BaseConnectorConfig {
  type: 'folder';
  folderPath: string;
  recursive: boolean;
  fileTypes: string[];
  watchForChanges: boolean;
  excludePatterns?: string[];
}

export interface NostrConnectorConfig extends BaseConnectorConfig {
  type: 'nostr';
  relays: string[];
  kinds?: number[];
  authors?: string[];
  tags?: Record<string, string[]>;
  since?: number;
  until?: number;
  limit?: number;
  subscribeMode?: boolean;
}

export type ConnectorConfig = SqlConnectorConfig | WebConnectorConfig | FolderConnectorConfig | NostrConnectorConfig;

export interface Connector {
  id: string;
  name: string;
  description?: string;
  config: ConnectorConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  lastRunStatus?: ConnectorStatus;
  documentCount?: number;
  // Source Portal URL Templates
  portalUrl?: string;
  itemUrlTemplate?: string;
  searchUrlTemplate?: string;
  editUrlTemplate?: string;
}

export interface ConnectorRun {
  id: string;
  connectorId: string;
  status: ConnectorStatus;
  startedAt: Date;
  completedAt?: Date;
  documentsAdded: number;
  documentsUpdated: number;
  documentsRemoved: number;
  currentUrl?: string;
  currentFile?: string;
  progress: number;
  totalItems?: number;
  processedItems?: number;
  errorMessage?: string;
  log: string[];
}

export interface ExtractedDocument {
  externalId: string;
  title: string;
  content: string;
  url?: string;
  attributes?: Record<string, any>;
  lastModified?: Date;
  content_type?: string;
}

export interface ConnectorEvents {
  onProgress: (run: ConnectorRun) => void;
  onDocument: (doc: ExtractedDocument) => void;
  onComplete: (run: ConnectorRun) => void;
  onError: (error: Error, run: ConnectorRun) => void;
}
