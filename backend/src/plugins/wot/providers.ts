/**
 * WoT Provider Interface
 * Allows plugging in different WoT calculation services
 */

export interface WoTProvider {
  name: string;
  
  /**
   * Calculate WoT score for a single pubkey
   */
  getScore(fromPubkey: string, toPubkey: string): Promise<number>;
  
  /**
   * Batch calculate WoT scores
   */
  batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Map<string, number>>;
  
  /**
   * Check if provider is available
   */
  healthCheck(): Promise<boolean>;
}

/**
 * NostrMaxi WoT Provider
 * Uses NostrMaxi API for WoT scores
 */
export class NostrMaxiProvider implements WoTProvider {
  name = 'nostrmaxi';
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async getScore(fromPubkey: string, toPubkey: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/wot/score/${toPubkey}?from=${fromPubkey}`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        return 0.1; // Default low score
      }

      const data = await response.json() as any;
      return data.wot_score || 0.1;
    } catch (error) {
      console.error('NostrMaxi API error:', error);
      return 0.1;
    }
  }

  async batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Map<string, number>> {
    if (toPubkeys.length === 0) {
      return new Map();
    }

    try {
      const response = await fetch(`${this.baseURL}/api/v1/wot/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_pubkey: fromPubkey, to_pubkeys: toPubkeys }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return new Map();
      }

      const data = await response.json() as any;
      const scores = new Map<string, number>();

      if (Array.isArray(data)) {
        for (const item of data) {
          scores.set(item.pubkey, item.wot_score || 0.1);
        }
      }

      return scores;
    } catch (error) {
      console.error('NostrMaxi batch lookup error:', error);
      return new Map();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Local WoT Provider (Fallback)
 * Uses Beacon's built-in WoT calculation
 */
export class LocalWoTProvider implements WoTProvider {
  name = 'local';
  private graph: any = null; // WoTGraph from templates/nostr/wot.ts

  constructor(private db: any) {}

  async getScore(fromPubkey: string, toPubkey: string): Promise<number> {
    // Load graph if not loaded
    if (!this.graph) {
      await this.loadGraph();
    }

    // Use local WoT calculation
    const { calculateWoTScore } = await import('../../templates/nostr/wot');
    const result = calculateWoTScore(toPubkey, fromPubkey, this.graph, 3);
    
    return result.score;
  }

  async batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Map<string, number>> {
    if (!this.graph) {
      await this.loadGraph();
    }

    const { calculateWoTScores } = await import('../../templates/nostr/wot');
    const results = calculateWoTScores(toPubkeys, fromPubkey, this.graph, 3);
    
    const scores = new Map<string, number>();
    for (const [pubkey, result] of results.entries()) {
      scores.set(pubkey, result.score);
    }

    return scores;
  }

  async healthCheck(): Promise<boolean> {
    return true; // Local provider always available
  }

  /**
   * Load follow graph from database
   */
  private async loadGraph(): Promise<void> {
    const { buildFollowGraph } = await import('../../templates/nostr/wot');
    
    // Fetch kind:3 contact list events from DB
    const contactLists = await this.db.query(
      'SELECT * FROM documents WHERE metadata->\'kind\' = \'3\' AND source = \'nostr\''
    );

    this.graph = buildFollowGraph(contactLists.rows);
  }
}

/**
 * Factory for creating WoT providers
 */
export function createWoTProvider(type: 'nostrmaxi' | 'local', config: any, db?: any): WoTProvider {
  switch (type) {
    case 'nostrmaxi':
      return new NostrMaxiProvider(config.nostrmaxi_url || 'http://localhost:3000');
    case 'local':
      if (!db) {
        throw new Error('LocalWoTProvider requires database connection');
      }
      return new LocalWoTProvider(db);
    default:
      throw new Error(`Unknown WoT provider: ${type}`);
  }
}
