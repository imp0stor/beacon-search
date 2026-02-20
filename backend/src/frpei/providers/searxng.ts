import fetch from 'node-fetch';
import { FrpeiRetrieveRequest } from '../types';
import { createCandidate, truncateSnippet } from '../utils';
import { FrpeiProvider, ProviderContext, ProviderSearchResult } from './provider';

interface SearxngResult {
  title: string;
  url: string;
  content?: string;
  publishedDate?: string;
  score?: number;
  engine?: string;
  engines?: string[];
  category?: string;
}

interface SearxngResponse {
  results: SearxngResult[];
}

export class SearxngProvider implements FrpeiProvider {
  name = 'searxng' as const;
  trustTier: 'low' = 'low';
  weight = 0.6;
  timeoutMs: number;
  private baseUrl: string;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    this.baseUrl = options?.baseUrl || process.env.SEARXNG_URL || 'http://localhost:8080';
    this.timeoutMs = options?.timeoutMs ?? Number(process.env.SEARXNG_TIMEOUT_MS || 2500);
  }

  async search(request: FrpeiRetrieveRequest, _context: ProviderContext): Promise<ProviderSearchResult> {
    const limit = request.limit ?? 10;
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', request.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', process.env.SEARXNG_LANGUAGE || 'en');
    url.searchParams.set('safesearch', '0');
    url.searchParams.set('categories', process.env.SEARXNG_CATEGORIES || 'general');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`SearXNG error: ${response.status}`);
    }

    const data = await response.json() as SearxngResponse;
    const results = data?.results || [];

    const items = results.slice(0, limit).map((result, index) =>
      createCandidate({
        title: result.title,
        url: result.url,
        snippet: truncateSnippet(result.content),
        contentType: result.category === 'news' ? 'news' : 'web',
        publishedAt: result.publishedDate,
        score: result.score ?? Math.max(0, 1 - index / Math.max(1, limit)),
        rank: index + 1,
        source: {
          provider: this.name,
          providerRef: result.engine || result.engines?.[0],
          trustTier: this.trustTier
        },
        metadata: {
          engines: result.engines || (result.engine ? [result.engine] : []),
          category: result.category
        }
      })
    );

    return {
      provider: this.name,
      items,
      raw: { resultCount: results.length }
    };
  }
}
