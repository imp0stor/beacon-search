/**
 * Plugin Architecture for Beacon Search
 * Allows extensibility without modifying core code
 */

export interface Plugin {
  name: string;
  version: string;
  description: string;
  
  /**
   * Initialize plugin (called on server startup)
   */
  init?(context: PluginContext): Promise<void>;
  
  /**
   * Hook into search ranking
   */
  modifySearchScore?(doc: SearchDocument, query: SearchQuery, baseScore: number): Promise<number>;
  
  /**
   * Hook into document indexing
   */
  beforeIndex?(doc: any): Promise<any>;
  afterIndex?(doc: any): Promise<void>;
  
  /**
   * Hook into connector execution
   */
  beforeConnect?(connector: any): Promise<void>;
  afterConnect?(connector: any, results: any): Promise<void>;
  
  /**
   * Add custom routes
   */
  routes?: PluginRoute[];
  
  /**
   * Cleanup on shutdown
   */
  destroy?(): Promise<void>;
}

export interface PluginContext {
  db: any; // Database connection
  config: any; // Server config
  logger: Logger;
  cache: CacheClient;
}

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: (req: any, res: any) => Promise<void>;
  middleware?: any[];
}

export interface SearchDocument {
  id: string;
  content: string;
  title?: string;
  url?: string;
  source?: string;
  metadata?: Record<string, any>;
  author_pubkey?: string; // For Nostr content
}

export interface SearchQuery {
  text: string;
  user_pubkey?: string; // For WoT-based ranking
  filters?: Record<string, any>;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface CacheClient {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}
