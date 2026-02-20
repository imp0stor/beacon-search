export interface ProviderMetric {
  successes: number;
  failures: number;
  timeouts: number;
  totalLatencyMs: number;
  lastError?: string;
  lastLatencyMs?: number;
}

export class FrpeiMetrics {
  requests = 0;
  cacheHits = 0;
  cacheMisses = 0;
  providerStats: Record<string, ProviderMetric> = {};

  recordRequest(): void {
    this.requests += 1;
  }

  recordCacheHit(): void {
    this.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  recordProviderSuccess(provider: string, latencyMs: number): void {
    const stats = this.ensureProvider(provider);
    stats.successes += 1;
    stats.totalLatencyMs += latencyMs;
    stats.lastLatencyMs = latencyMs;
  }

  recordProviderFailure(provider: string, latencyMs: number, error: string, timeout = false): void {
    const stats = this.ensureProvider(provider);
    stats.failures += 1;
    stats.totalLatencyMs += latencyMs;
    stats.lastLatencyMs = latencyMs;
    stats.lastError = error;
    if (timeout) stats.timeouts += 1;
  }

  snapshot(): Record<string, any> {
    const providerStats: Record<string, any> = {};
    for (const [provider, stat] of Object.entries(this.providerStats)) {
      providerStats[provider] = {
        successes: stat.successes,
        failures: stat.failures,
        timeouts: stat.timeouts,
        lastError: stat.lastError,
        lastLatencyMs: stat.lastLatencyMs,
        avgLatencyMs: stat.successes + stat.failures > 0
          ? Math.round(stat.totalLatencyMs / (stat.successes + stat.failures))
          : 0
      };
    }

    return {
      requests: this.requests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.cacheHits + this.cacheMisses > 0
        ? Number((this.cacheHits / (this.cacheHits + this.cacheMisses)).toFixed(3))
        : 0,
      providerStats
    };
  }

  private ensureProvider(provider: string): ProviderMetric {
    if (!this.providerStats[provider]) {
      this.providerStats[provider] = {
        successes: 0,
        failures: 0,
        timeouts: 0,
        totalLatencyMs: 0
      };
    }
    return this.providerStats[provider];
  }
}
