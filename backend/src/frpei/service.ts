import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { FrpeiCache } from './cache';
import { FrpeiMetrics } from './metrics';
import { CircuitBreaker } from './circuit-breaker';
import { BeaconProvider } from './providers/beacon';
import { SearxngProvider } from './providers/searxng';
import {
  Candidate,
  FrpeiEnrichRequest,
  FrpeiFeedbackRequest,
  FrpeiRankRequest,
  FrpeiRetrieveRequest,
  ProviderSearchResult,
  RankedCandidate
} from './types';
import { canonicalizeUrl, dedupeCandidates, deriveContentType } from './normalization';
import { resolveCanonicalEntity } from './canonicalization';
import { enrichCandidate } from './enrichment';
import { rankCandidates } from './ranking';

interface ProviderAdapter {
  name: string;
  trustTier: 'high' | 'medium' | 'low';
  search(query: string, options: { limit: number; timeoutMs?: number; filters?: Record<string, any> }): Promise<ProviderSearchResult>;
}

export class FrpeiService {
  private pool: Pool;
  private cache: FrpeiCache<any>;
  private metrics: FrpeiMetrics;
  private circuitBreaker: CircuitBreaker;
  private providers: Map<string, ProviderAdapter>;
  private defaultSources: string[];
  private defaultLimit: number;
  private defaultTimeoutMs: number;
  private cacheTtlMs: number;
  private fallbackSources: string[];

  constructor(pool: Pool, generateEmbedding?: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.cache = new FrpeiCache(parseInt(process.env.FRPEI_CACHE_MAX_ENTRIES || '500', 10));
    this.metrics = new FrpeiMetrics();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: parseInt(process.env.FRPEI_CIRCUIT_BREAKER_THRESHOLD || '3', 10),
      cooldownMs: parseInt(process.env.FRPEI_CIRCUIT_BREAKER_COOLDOWN_MS || '30000', 10)
    });

    const searxngBase = process.env.SEARXNG_BASE_URL || 'http://10.1.10.143:8080';
    const searxngCategories = process.env.SEARXNG_CATEGORIES || 'general';
    const searxngLanguage = process.env.SEARXNG_LANGUAGE || 'en';

    const beaconProvider = new BeaconProvider(pool, generateEmbedding);
    const searxngProvider = new SearxngProvider({
      baseUrl: searxngBase,
      categories: searxngCategories,
      language: searxngLanguage
    });

    this.providers = new Map([
      [beaconProvider.name, beaconProvider],
      [searxngProvider.name, searxngProvider]
    ]);

    this.defaultSources = (process.env.FRPEI_DEFAULT_SOURCES || 'searxng,beacon')
      .split(',')
      .map(source => source.trim())
      .filter(Boolean);
    this.defaultLimit = parseInt(process.env.FRPEI_DEFAULT_LIMIT || '20', 10);
    this.defaultTimeoutMs = parseInt(process.env.FRPEI_PROVIDER_TIMEOUT_MS || '2500', 10);
    this.cacheTtlMs = parseInt(process.env.FRPEI_CACHE_TTL_MS || '300000', 10);
    this.fallbackSources = (process.env.FRPEI_FALLBACK_SOURCES || 'beacon')
      .split(',')
      .map(source => source.trim())
      .filter(Boolean);
  }

  getMetricsSnapshot() {
    return {
      metrics: this.metrics.snapshot(),
      circuit_breakers: this.circuitBreaker.snapshot(),
      cache: this.cache.stats()
    };
  }

  private buildCacheKey(query: string, sources: string[], limit: number, filters?: Record<string, any>) {
    return JSON.stringify({ query, sources: sources.sort(), limit, filters: filters || {} });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<{ result?: T; timeout: boolean; error?: string }> {
    let timer: NodeJS.Timeout;
    return Promise.race([
      promise.then(result => ({ result, timeout: false })),
      new Promise<{ result?: T; timeout: boolean; error?: string }>(resolve => {
        timer = setTimeout(() => resolve({ timeout: true, error: 'timeout' }), timeoutMs);
      })
    ]).finally(() => clearTimeout(timer!));
  }

  async retrieve(request: FrpeiRetrieveRequest) {
    const requestId = uuidv4();
    const query = request.query;
    const sources = request.sources?.length ? request.sources : this.defaultSources;
    const limit = request.limit ?? this.defaultLimit;
    const timeoutMs = request.timeout_ms ?? this.defaultTimeoutMs;
    const useCache = request.use_cache !== false;
    const filters = request.filters || {};

    this.metrics.recordRequest();

    const cacheKey = this.buildCacheKey(query, sources, limit, filters);
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.recordCacheHit();
        await this.pool.query(
          `INSERT INTO frpei_requests (id, query, sources, requested_limit, timeout_ms, cache_hit, candidate_count, provider_stats)
           VALUES ($1, $2, $3, $4, $5, true, $6, $7)` ,
          [requestId, query, sources, limit, timeoutMs, cached.candidates.length, cached.stats]
        );
        return { ...cached, request_id: requestId, cache_hit: true };
      }
    }

    const startedAt = Date.now();
    await this.pool.query(
      `INSERT INTO frpei_requests (id, query, sources, requested_limit, timeout_ms, cache_hit, started_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [requestId, query, sources, limit, timeoutMs]
    );

    const runProviders = async (sourceList: string[]) => {
      const providerCalls = sourceList.map(async source => {
        const provider = this.providers.get(source);
        if (!provider) {
          return {
            provider: source,
            result: { candidates: [], stats: { provider: source, duration_ms: 0, count: 0, error: 'provider_not_configured' } }
          };
        }

        if (!this.circuitBreaker.canRequest(provider.name)) {
          return {
            provider: provider.name,
            result: { candidates: [], stats: { provider: provider.name, duration_ms: 0, count: 0, error: 'circuit_open' } }
          };
        }

        const configuredTimeout = parseInt(process.env[`FRPEI_${provider.name.toUpperCase()}_TIMEOUT_MS`] || String(timeoutMs), 10);
        const { result, timeout, error } = await this.withTimeout(
          provider.search(query, { limit, timeoutMs: configuredTimeout, filters }),
          configuredTimeout
        );

        if (!result) {
          const stats = { provider: provider.name, duration_ms: configuredTimeout, count: 0, error: error || 'timeout', timeout };
          this.metrics.recordProvider(provider.name, configuredTimeout, false, timeout);
          this.circuitBreaker.recordFailure(provider.name, stats.error);
          return { provider: provider.name, result: { candidates: [], stats } };
        }

        const success = !result.stats.error;
        this.metrics.recordProvider(provider.name, result.stats.duration_ms, success, Boolean(result.stats.timeout));
        if (success) {
          this.circuitBreaker.recordSuccess(provider.name);
        } else {
          this.circuitBreaker.recordFailure(provider.name, result.stats.error);
        }

        return { provider: provider.name, result };
      });

      const settled = await Promise.all(providerCalls);
      const providerStats: Record<string, any> = {};

      let candidates: Candidate[] = [];
      for (const call of settled) {
        providerStats[call.provider] = call.result.stats;
        candidates = candidates.concat(call.result.candidates);
      }

      return { providerStats, candidates };
    };

    let { providerStats, candidates } = await runProviders(sources);

    if (!candidates.length && this.fallbackSources.length) {
      const fallbackList = this.fallbackSources.filter(source => !sources.includes(source));
      if (fallbackList.length) {
        const fallback = await runProviders(fallbackList);
        providerStats = { ...providerStats, ...fallback.providerStats };
        candidates = candidates.concat(fallback.candidates);
      }
    }

    candidates.forEach(candidate => {
      if (!candidate.canonical_url) {
        const canonical = canonicalizeUrl(candidate.url);
        candidate.canonical_url = canonical.url;
        candidate.canonical_domain = canonical.domain;
      }
      candidate.canonical_title = candidate.canonical_title || candidate.title;
      candidate.content_type = deriveContentType(candidate.url, candidate.content_type);
      candidate.request_id = requestId;
    });

    candidates = dedupeCandidates(candidates);
    const latencyMs = Date.now() - startedAt;

    await this.storeCandidates(requestId, candidates);

    await this.pool.query(
      `UPDATE frpei_requests
       SET completed_at = NOW(), latency_ms = $2, provider_stats = $3, candidate_count = $4
       WHERE id = $1`,
      [requestId, latencyMs, providerStats, candidates.length]
    );

    const response = {
      request_id: requestId,
      query,
      candidates,
      stats: {
        providers: providerStats,
        count: candidates.length,
        latency_ms: latencyMs
      }
    };

    if (useCache) {
      this.cache.set(cacheKey, response, this.cacheTtlMs);
    }

    return response;
  }

  async enrich(request: FrpeiEnrichRequest) {
    const candidates = await this.fetchCandidates(request.candidate_ids);

    const enriched: Candidate[] = [];
    for (const candidate of candidates) {
      if (!candidate.entity?.entity_id) {
        const entity = await resolveCanonicalEntity(this.pool, candidate.title);
        candidate.entity = entity;
      }
      const enrichment = await enrichCandidate(this.pool, candidate);
      candidate.enrichment = enrichment;

      await this.upsertEnrichment(candidate, enrichment);
      enriched.push(candidate);
    }

    return {
      enriched,
      stats: {
        enriched_count: enriched.length
      }
    };
  }

  async rank(request: FrpeiRankRequest) {
    const candidates = await this.fetchCandidates(request.candidate_ids, true);
    const ranked = rankCandidates(request.query, candidates);

    await this.storeRankLog(ranked);

    return {
      ranked,
      stats: {
        ranked_count: ranked.length
      }
    };
  }

  async explain(candidateId: string, query?: string) {
    if (query) {
      const candidates = await this.fetchCandidates([candidateId], true);
      if (!candidates.length) return null;
      const ranked = rankCandidates(query, candidates);
      return ranked[0];
    }

    const result = await this.pool.query(
      `SELECT candidate_id, score, rank, signals
       FROM frpei_rank_log
       WHERE candidate_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [candidateId]
    );

    if (!result.rows.length) return null;
    return result.rows[0];
  }

  async feedback(request: FrpeiFeedbackRequest) {
    await this.pool.query(
      `INSERT INTO frpei_feedback (candidate_id, action, weight, context)
       VALUES ($1, $2, $3, $4)`,
      [request.candidate_id, request.action, request.weight || 1.0, request.context || {}]
    );
    return { status: 'ok' };
  }

  private async fetchCandidates(candidateIds: string[], includeEnrichment = false): Promise<Candidate[]> {
    if (!candidateIds.length) return [];

    const query = includeEnrichment
      ? `SELECT c.id, c.request_id, c.provider, c.provider_ref, c.trust_tier, c.url, c.canonical_url, c.canonical_domain,
                c.title, c.canonical_title, c.snippet, c.language, c.published_at, c.retrieved_at, c.content_type,
                c.raw, c.signals, c.entity_id, c.entity_term, c.entity_confidence,
                e.topics, e.taxonomy, e.domain_enrichment, e.provenance, e.confidence
         FROM frpei_candidates c
         LEFT JOIN frpei_enrichment e ON e.candidate_id = c.id
         WHERE c.id = ANY($1)`
      : `SELECT id, request_id, provider, provider_ref, trust_tier, url, canonical_url, canonical_domain,
                title, canonical_title, snippet, language, published_at, retrieved_at, content_type,
                raw, signals, entity_id, entity_term, entity_confidence
         FROM frpei_candidates
         WHERE id = ANY($1)`;

    const result = await this.pool.query(query, [candidateIds]);
    return result.rows.map(row => ({
      candidate_id: row.id,
      request_id: row.request_id,
      source: {
        provider: row.provider,
        provider_ref: row.provider_ref,
        trust_tier: row.trust_tier
      },
      url: row.url,
      canonical_url: row.canonical_url,
      canonical_domain: row.canonical_domain,
      title: row.title,
      canonical_title: row.canonical_title,
      snippet: row.snippet,
      language: row.language,
      published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
      retrieved_at: row.retrieved_at ? new Date(row.retrieved_at).toISOString() : new Date().toISOString(),
      content_type: row.content_type,
      raw: row.raw,
      signals: row.signals,
      entity: row.entity_id ? { entity_id: row.entity_id, term: row.entity_term || row.canonical_title, confidence: row.entity_confidence } : undefined,
      enrichment: includeEnrichment && row.topics ? {
        topics: row.topics,
        taxonomy: row.taxonomy,
        domain_enrichment: row.domain_enrichment,
        provenance: row.provenance,
        confidence: row.confidence
      } : undefined
    }));
  }

  private async storeCandidates(requestId: string, candidates: Candidate[]) {
    if (!candidates.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const candidate of candidates) {
        await client.query(
          `INSERT INTO frpei_candidates
            (id, request_id, provider, provider_ref, trust_tier, url, canonical_url, canonical_domain,
             title, canonical_title, snippet, language, published_at, retrieved_at, content_type,
             raw, signals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO NOTHING`,
          [
            candidate.candidate_id,
            requestId,
            candidate.source.provider,
            candidate.source.provider_ref || null,
            candidate.source.trust_tier,
            candidate.url || null,
            candidate.canonical_url || null,
            candidate.canonical_domain || null,
            candidate.title,
            candidate.canonical_title || candidate.title,
            candidate.snippet || null,
            candidate.language || null,
            candidate.published_at ? new Date(candidate.published_at) : null,
            candidate.retrieved_at ? new Date(candidate.retrieved_at) : new Date(),
            candidate.content_type || null,
            candidate.raw || {},
            candidate.signals || {}
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertEnrichment(candidate: Candidate, enrichment: Record<string, any>) {
    await this.pool.query(
      `UPDATE frpei_candidates
       SET entity_id = $2, entity_term = $3, entity_confidence = $4
       WHERE id = $1`,
      [candidate.candidate_id, candidate.entity?.entity_id || null, candidate.entity?.term || null, candidate.entity?.confidence || null]
    );

    await this.pool.query(
      `INSERT INTO frpei_enrichment (candidate_id, entity_id, topics, taxonomy, domain_enrichment, provenance, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (candidate_id) DO UPDATE SET
         entity_id = EXCLUDED.entity_id,
         topics = EXCLUDED.topics,
         taxonomy = EXCLUDED.taxonomy,
         domain_enrichment = EXCLUDED.domain_enrichment,
         provenance = EXCLUDED.provenance,
         confidence = EXCLUDED.confidence,
         updated_at = NOW()`,
      [
        candidate.candidate_id,
        candidate.entity?.entity_id || null,
        enrichment.topics || [],
        enrichment.taxonomy || {},
        enrichment.domain_enrichment || {},
        enrichment.provenance || {},
        enrichment.confidence || {}
      ]
    );
  }

  private async storeRankLog(ranked: RankedCandidate[]) {
    if (!ranked.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of ranked) {
        await client.query(
          `INSERT INTO frpei_rank_log (request_id, candidate_id, score, rank, signals)
           VALUES ($1, $2, $3, $4, $5)`,
          [entry.candidate.request_id || null, entry.candidate_id, entry.score, entry.rank, entry.signals]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
