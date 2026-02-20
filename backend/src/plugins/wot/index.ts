/**
 * Web of Trust (WoT) Plugin for Beacon Search
 * Integrates Nostr WoT scores into search ranking
 * Supports multiple WoT providers (NostrMaxi, local, custom)
 */

import { Plugin, PluginContext, SearchDocument, SearchQuery } from '../types';
import { WoTProvider, createWoTProvider } from './providers';

export interface WoTPluginConfig {
  enabled: boolean;
  provider: 'nostrmaxi' | 'local';
  nostrmaxi_url?: string;
  weight: number; // Max boost multiplier (default: 1.0)
  cache_ttl: number; // Cache TTL in seconds (default: 3600)
}

export class WoTPlugin implements Plugin {
  name = 'wot';
  version = '2.0.0';
  description = 'Web of Trust integration for Nostr content ranking (multi-provider)';

  private provider: WoTProvider;
  private cache: Map<string, { score: number; timestamp: number }> = new Map();
  private cacheTTL: number;
  private wotWeight: number;
  private enabled: boolean;
  private context: PluginContext;

  constructor(private config: WoTPluginConfig) {
    this.enabled = config.enabled ?? true;
    this.wotWeight = config.weight ?? 1.0;
    this.cacheTTL = (config.cache_ttl ?? 3600) * 1000;
  }

  async init(context: PluginContext): Promise<void> {
    this.context = context;

    if (!this.enabled) {
      context.logger.info('WoT Plugin: Disabled by config');
      return;
    }

    // Create WoT provider
    try {
      this.provider = createWoTProvider(
        this.config.provider,
        {
          nostrmaxi_url: this.config.nostrmaxi_url || process.env.NOSTRMAXI_URL || 'http://localhost:3000',
        },
        context.db
      );

      // Health check
      const healthy = await this.provider.healthCheck();
      if (healthy) {
        context.logger.info(`WoT Plugin: Using ${this.provider.name} provider (weight: ${this.wotWeight})`);
      } else {
        context.logger.warn(`WoT Plugin: ${this.provider.name} provider not healthy, falling back to local`);
        
        // Fallback to local provider if external fails
        if (this.config.provider !== 'local') {
          this.provider = createWoTProvider('local', {}, context.db);
          context.logger.info('WoT Plugin: Switched to local provider');
        }
      }
    } catch (error) {
      context.logger.error(`WoT Plugin: Failed to initialize provider: ${error.message}`);
      this.enabled = false;
    }
  }

  /**
   * Modify search score based on WoT
   */
  async modifySearchScore(
    doc: SearchDocument,
    query: SearchQuery,
    baseScore: number
  ): Promise<number> {
    // Skip if disabled
    if (!this.enabled || !this.provider) {
      return baseScore;
    }

    // Only apply to Nostr content
    if (!doc.author_pubkey || doc.source !== 'nostr') {
      return baseScore;
    }

    // Need user pubkey for WoT calculation
    if (!query.user_pubkey) {
      return baseScore;
    }

    // Get WoT score (cached or fresh)
    const wotScore = await this.getWoTScore(query.user_pubkey, doc.author_pubkey);

    // Apply WoT multiplier (1.0 + score * weight)
    // Example: wotScore=0.85, weight=1.0 → multiplier=1.85
    const multiplier = 1.0 + (wotScore * this.wotWeight);
    const finalScore = baseScore * multiplier;

    return finalScore;
  }

  /**
   * Get WoT score with caching
   */
  private async getWoTScore(fromPubkey: string, toPubkey: string): Promise<number> {
    const cacheKey = `${fromPubkey}:${toPubkey}`;
    const cached = this.cache.get(cacheKey);

    // Check cache
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.score;
    }

    // Fetch from provider
    const score = await this.provider.getScore(fromPubkey, toPubkey);

    // Cache result
    this.cache.set(cacheKey, { score, timestamp: Date.now() });

    // Clean old cache entries periodically
    if (this.cache.size > 10000) {
      this.cleanCache();
    }

    return score;
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Batch pre-fetch WoT scores for search results
   */
  async prefetchWoTScores(userPubkey: string, authorPubkeys: string[]): Promise<void> {
    if (!this.enabled || !this.provider || !userPubkey || authorPubkeys.length === 0) {
      return;
    }

    // Filter out already cached
    const uncached = authorPubkeys.filter(pk => {
      const cacheKey = `${userPubkey}:${pk}`;
      const cached = this.cache.get(cacheKey);
      return !cached || (Date.now() - cached.timestamp) >= this.cacheTTL;
    });

    if (uncached.length === 0) {
      return;
    }

    // Batch fetch
    const scores = await this.provider.batchLookup(userPubkey, uncached);

    // Cache all results
    const now = Date.now();
    for (const [pubkey, score] of scores.entries()) {
      const cacheKey = `${userPubkey}:${pubkey}`;
      this.cache.set(cacheKey, { score, timestamp: now });
    }
  }

  async destroy(): Promise<void> {
    this.cache.clear();
  }
}
