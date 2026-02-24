import { SimplePool, Filter as NostrFilter, Event as NostrEvent } from 'nostr-tools';
import fetch from 'node-fetch';
import 'websocket-polyfill';

interface RelayConfig {
  url: string;
  maxConnections: number;
  rateLimit: {
    maxEventsPerSecond: number;
    burstSize: number;
    cooldownMs: number;
  };
  policies: {
    maxFilterSize: number;
    maxSubscriptionsPerClient: number;
    requireAuth: boolean;
  };
  health: {
    lastSuccess: number;
    failureCount: number;
    averageLatencyMs: number;
  };
}

interface RelayInfo {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supported_nips?: number[];
  software?: string;
  version?: string;
  limitation?: {
    max_message_length?: number;
    max_subscriptions?: number;
    max_filters?: number;
    max_limit?: number;
    max_subid_length?: number;
    max_event_tags?: number;
    max_content_length?: number;
    min_pow_difficulty?: number;
    auth_required?: boolean;
    payment_required?: boolean;
  };
}

export class RelayManager {
  private pool: SimplePool;
  private configs: Map<string, RelayConfig> = new Map();
  private requestCounts: Map<string, number[]> = new Map(); // Track requests per second
  
  constructor(relayUrls: string[]) {
    this.pool = new SimplePool();
    
    // Initialize configs with defaults
    for (const url of relayUrls) {
      this.configs.set(url, this.createDefaultConfig(url));
    }
  }
  
  private createDefaultConfig(url: string): RelayConfig {
    return {
      url,
      maxConnections: 2,
      rateLimit: {
        maxEventsPerSecond: 10, // Conservative default
        burstSize: 50,
        cooldownMs: 2000,
      },
      policies: {
        maxFilterSize: 100,
        maxSubscriptionsPerClient: 10,
        requireAuth: false,
      },
      health: {
        lastSuccess: Date.now(),
        failureCount: 0,
        averageLatencyMs: 0,
      },
    };
  }
  
  /**
   * Discover relay capabilities via NIP-11
   */
  async discoverRelayInfo(url: string): Promise<void> {
    try {
      // Ensure config exists for this relay
      if (!this.configs.has(url)) {
        this.configs.set(url, this.createDefaultConfig(url));
      }
      
      const httpUrl = url.replace('wss://', 'https://').replace('ws://', 'http://');
      
      const response = await fetch(httpUrl, {
        headers: {
          'Accept': 'application/nostr+json',
        },
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch relay info for ${url}: ${response.status}`);
        return;
      }
      
      const info: RelayInfo = await response.json();
      const config = this.configs.get(url)!;
      
      // Update config based on relay info
      if (info.limitation) {
        config.policies.maxSubscriptionsPerClient = 
          info.limitation.max_subscriptions || config.policies.maxSubscriptionsPerClient;
        
        config.policies.maxFilterSize = 
          info.limitation.max_filters || config.policies.maxFilterSize;
        
        config.policies.requireAuth = 
          info.limitation.auth_required || false;
      }
      
      console.log(`✓ Discovered info for ${url}:`, {
        software: info.software,
        nips: info.supported_nips?.slice(0, 10),
        limits: info.limitation,
      });
      
    } catch (error) {
      console.error(`Error discovering relay info for ${url}:`, error);
    }
  }
  
  /**
   * Fetch events with automatic rate limiting
   */
  async fetchWithRateLimit(
    relays: string[],
    filter: NostrFilter,
    batchSize: number = 100
  ): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];
    
    for (const relayUrl of relays) {
      try {
        // Check rate limit before making request
        await this.enforceRateLimit(relayUrl);
        
        const config = this.configs.get(relayUrl)!;
        const startTime = Date.now();
        
        // Fetch events
        const batch = await this.pool.querySync(
          [relayUrl],
          { ...filter, limit: Math.min(batchSize, config.rateLimit.burstSize) }
        );
        
        const latency = Date.now() - startTime;
        
        // Update health metrics
        config.health.lastSuccess = Date.now();
        config.health.failureCount = 0;
        config.health.averageLatencyMs = 
          (config.health.averageLatencyMs * 0.9) + (latency * 0.1); // Exponential moving average
        
        events.push(...batch);
        
        // Track request for rate limiting
        this.trackRequest(relayUrl);
        
        console.log(`Fetched ${batch.length} events from ${relayUrl} (${latency}ms)`);
        
      } catch (error) {
        const config = this.configs.get(relayUrl)!;
        config.health.failureCount++;
        
        console.error(`Error fetching from ${relayUrl}:`, error);
        
        // Exponential backoff on repeated failures
        if (config.health.failureCount > 3) {
          const backoffMs = Math.min(
            config.rateLimit.cooldownMs * Math.pow(2, config.health.failureCount - 3),
            60000 // Max 1 minute backoff
          );
          
          console.warn(`Backing off ${relayUrl} for ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    // Deduplicate by event ID
    return [...new Map(events.map(e => [e.id, e])).values()];
  }
  
  /**
   * Track request timestamp for rate limiting
   */
  private trackRequest(relayUrl: string): void {
    const now = Date.now();
    const requests = this.requestCounts.get(relayUrl) || [];
    
    // Keep only requests from last second
    const recentRequests = requests.filter(t => now - t < 1000);
    recentRequests.push(now);
    
    this.requestCounts.set(relayUrl, recentRequests);
  }
  
  /**
   * Enforce rate limits with cooldown
   */
  private async enforceRateLimit(relayUrl: string): Promise<void> {
    const config = this.configs.get(relayUrl)!;
    const requests = this.requestCounts.get(relayUrl) || [];
    
    // Count requests in last second
    const now = Date.now();
    const recentRequests = requests.filter(t => now - t < 1000);
    
    // If we've hit the burst limit, wait for cooldown
    if (recentRequests.length >= config.rateLimit.burstSize) {
      console.warn(
        `Rate limit hit for ${relayUrl}, waiting ${config.rateLimit.cooldownMs}ms`
      );
      await new Promise(resolve => setTimeout(resolve, config.rateLimit.cooldownMs));
      return;
    }
    
    // If we're at the per-second limit, wait until next second
    if (recentRequests.length >= config.rateLimit.maxEventsPerSecond) {
      const oldestRequest = Math.min(...recentRequests);
      const waitMs = 1000 - (now - oldestRequest);
      
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  
  /**
   * Select best relays for a given filter
   */
  selectRelays(filter: NostrFilter, maxRelays: number = 3): string[] {
    const allRelays = Array.from(this.configs.entries());
    
    // Sort by health score (lower failure count, lower latency = better)
    allRelays.sort(([, a], [, b]) => {
      const scoreA = a.health.failureCount * 1000 + a.health.averageLatencyMs;
      const scoreB = b.health.failureCount * 1000 + b.health.averageLatencyMs;
      return scoreA - scoreB;
    });
    
    return allRelays.slice(0, maxRelays).map(([url]) => url);
  }
  
  /**
   * Get relay statistics
   */
  getStats() {
    const stats: Record<string, any> = {};
    
    for (const [url, config] of this.configs.entries()) {
      const requests = this.requestCounts.get(url) || [];
      const now = Date.now();
      const recentRequests = requests.filter(t => now - t < 1000);
      
      stats[url] = {
        health: config.health,
        currentRate: recentRequests.length,
        maxRate: config.rateLimit.maxEventsPerSecond,
      };
    }
    
    return stats;
  }
  
  /**
   * Clean up resources
   */
  close() {
    this.pool.close(Array.from(this.configs.keys()));
  }
}
