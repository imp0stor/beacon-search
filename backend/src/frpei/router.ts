import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { ResultCache } from './cache';
import { CircuitBreaker } from './circuit-breaker';
import { canonicalizeCandidates } from './canonicalize';
import { enrichCandidates } from './enrich';
import { FrpeiMetrics } from './metrics';
import { rankCandidates } from './rank';
import { dedupeCandidates } from './utils';
import {
  FrpeiEnrichRequest,
  FrpeiEnrichResponse,
  FrpeiExplainRequest,
  FrpeiExplainResponse,
  FrpeiRankRequest,
  FrpeiRankResponse,
  FrpeiRetrieveRequest,
  FrpeiRetrieveResponse,
  ProviderExecutionResult,
  ProviderHealth
} from './types';
import { BeaconProvider } from './providers/beacon';
import { MediaProvider } from './providers/media';
import { SearxngProvider } from './providers/searxng';
import { FrpeiProvider, ProviderContext } from './providers/provider';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export class FrpeiRouter {
  private pool: Pool;
  private generateEmbedding: (text: string) => Promise<number[]>;
  private cache: ResultCache<FrpeiRetrieveResponse>;
  private metrics: FrpeiMetrics;
  private providers: Map<string, FrpeiProvider>;
  private breakers: Map<string, CircuitBreaker>;

  constructor(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.generateEmbedding = generateEmbedding;
    this.cache = new ResultCache();
    this.metrics = new FrpeiMetrics();
    this.providers = new Map();
    this.breakers = new Map();

    const providerList: FrpeiProvider[] = [
      new BeaconProvider(),
      new SearxngProvider(),
      new MediaProvider()
    ];

    providerList.forEach(provider => {
      this.providers.set(provider.name, provider);
      this.breakers.set(provider.name, new CircuitBreaker());
    });
  }

  async retrieve(request: FrpeiRetrieveRequest): Promise<FrpeiRetrieveResponse> {
    this.metrics.recordRequest();
    const requestId = uuidv4();
    const cacheKey = this.buildCacheKey(request);
    const useCache = request.enableCache !== false;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.recordCacheHit();
        return {
          ...cached,
          requestId,
          metrics: this.metricsSnapshot()
        };
      }
      this.metrics.recordCacheMiss();
    }

    const providerNames = this.resolveProviders(request);
    const providerResults = await Promise.all(providerNames.map(name => this.executeProvider(name, request)));

    let candidates = providerResults.flatMap(result => result.items);
    const errors = providerResults.filter(result => result.error).map(result => `${result.provider}: ${result.error}`);

    if (!candidates.length && !providerNames.includes('beacon')) {
      const fallback = await this.executeProvider('beacon', request);
      candidates = fallback.items;
      providerResults.push(fallback);
      if (fallback.error) errors.push(`beacon: ${fallback.error}`);
    }

    if (request.dedupe !== false) {
      candidates = dedupeCandidates(candidates);
    }

    const canonicalized = await canonicalizeCandidates(this.pool, candidates);
    const enriched = await enrichCandidates(this.pool, canonicalized);
    const limit = request.limit ?? 10;
    const ranked = rankCandidates(enriched).slice(0, limit);

    const results = request.explain ? ranked : ranked.map(candidate => ({
      ...candidate,
      explanation: undefined
    }));

    const response: FrpeiRetrieveResponse = {
      requestId,
      query: request.query,
      results,
      providers: providerResults,
      metrics: this.metricsSnapshot(),
      errors: errors.length ? errors : undefined
    };

    if (useCache) {
      this.cache.set(cacheKey, response);
    }

    return response;
  }

  async enrich(request: FrpeiEnrichRequest): Promise<FrpeiEnrichResponse> {
    const canonicalized = await canonicalizeCandidates(this.pool, request.candidates || []);
    const enriched = await enrichCandidates(this.pool, canonicalized);
    return { enriched };
  }

  async rank(request: FrpeiRankRequest): Promise<FrpeiRankResponse> {
    return { ranked: rankCandidates(request.candidates || []) };
  }

  async explain(request: FrpeiExplainRequest): Promise<FrpeiExplainResponse> {
    const candidate = request.candidate;
    if (!candidate.explanation) {
      const ranked = rankCandidates([candidate]);
      return { candidateId: candidate.candidateId, explanation: ranked[0].explanation! };
    }
    return { candidateId: candidate.candidateId, explanation: candidate.explanation };
  }

  metricsSnapshot(): Record<string, any> {
    return {
      ...this.metrics.snapshot(),
      cacheSize: this.cache.size()
    };
  }

  providerHealth(): Record<string, ProviderHealth> {
    const health: Record<string, ProviderHealth> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      health[name] = breaker.snapshot();
    }
    return health;
  }

  private resolveProviders(request: FrpeiRetrieveRequest): string[] {
    if (request.providers && request.providers.length) {
      return request.providers.filter(provider => this.providers.has(provider));
    }

    const providers = ['beacon', 'searxng'];
    if (!request.types || request.types.some(type => ['podcast', 'tv', 'movie'].includes(type))) {
      providers.push('media');
    }
    return providers;
  }

  private async executeProvider(providerName: string, request: FrpeiRetrieveRequest): Promise<ProviderExecutionResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        provider: providerName,
        items: [],
        elapsedMs: 0,
        error: 'Provider not registered'
      };
    }

    const breaker = this.breakers.get(providerName);
    if (breaker && !breaker.canRequest()) {
      return {
        provider: providerName,
        items: [],
        elapsedMs: 0,
        error: 'Circuit breaker open'
      };
    }

    const context: ProviderContext = {
      pool: this.pool,
      generateEmbedding: this.generateEmbedding
    };

    const timeoutMs = request.timeoutMs ? Math.min(request.timeoutMs, provider.timeoutMs) : provider.timeoutMs;
    const start = Date.now();

    try {
      const result = await withTimeout(provider.search(request, context), timeoutMs);
      const elapsedMs = Date.now() - start;
      this.metrics.recordProviderSuccess(providerName, elapsedMs);
      breaker?.recordSuccess();

      return {
        provider: providerName,
        items: result.items,
        warnings: result.warnings,
        raw: result.raw,
        elapsedMs
      };
    } catch (error) {
      const elapsedMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      this.metrics.recordProviderFailure(providerName, elapsedMs, message, message.includes('timeout'));
      breaker?.recordFailure();
      return {
        provider: providerName,
        items: [],
        elapsedMs,
        error: message
      };
    }
  }

  private buildCacheKey(request: FrpeiRetrieveRequest): string {
    const providers = (request.providers || []).join(',');
    const types = (request.types || []).join(',');
    return [request.query, request.limit, request.mode, providers, types, request.expand].join('|');
  }
}
