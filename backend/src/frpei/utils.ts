import { v4 as uuidv4 } from 'uuid';
import { ContentType, FrpeiCandidate, ProviderSource } from './types';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'ref', 'source', 'spm', 'igshid'
]);

export function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    [...parsed.searchParams.keys()].forEach(key => {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    });
    const normalized = parsed.toString();
    return normalized.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function mapDocumentTypeToContentType(documentType?: string): ContentType {
  if (!documentType) return 'unknown';
  const lowered = documentType.toLowerCase();
  if (lowered.includes('podcast')) return 'podcast';
  if (lowered.includes('tv')) return 'tv';
  if (lowered.includes('movie')) return 'movie';
  if (lowered.includes('news')) return 'news';
  if (lowered.includes('web')) return 'web';
  return 'doc';
}

export function createCandidate(input: {
  title: string;
  url?: string;
  snippet?: string;
  contentType?: ContentType;
  source: ProviderSource;
  publishedAt?: string;
  score?: number;
  rank?: number;
  metadata?: Record<string, any>;
}): FrpeiCandidate {
  const normalizedUrl = normalizeUrl(input.url);
  const domain = extractDomain(normalizedUrl);
  return {
    candidateId: uuidv4(),
    title: input.title,
    url: input.url,
    normalizedUrl,
    snippet: input.snippet,
    contentType: input.contentType ?? 'unknown',
    source: input.source,
    retrievedAt: new Date().toISOString(),
    publishedAt: input.publishedAt,
    signals: {
      score: input.score ?? 0,
      rank: input.rank,
      providerScore: input.score,
      domain
    },
    metadata: input.metadata
  };
}

export function dedupeCandidates(candidates: FrpeiCandidate[]): FrpeiCandidate[] {
  const seen = new Map<string, FrpeiCandidate>();
  for (const candidate of candidates) {
    const key = candidate.normalizedUrl || candidate.url || candidate.title.toLowerCase();
    const existing = seen.get(key);
    if (!existing || candidate.signals.score > existing.signals.score) {
      seen.set(key, candidate);
    }
  }
  return Array.from(seen.values());
}

export function truncateSnippet(content?: string, maxLength = 240): string | undefined {
  if (!content) return undefined;
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength)}...`;
}
