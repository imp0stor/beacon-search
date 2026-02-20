import crypto from 'crypto';
import { Candidate, TrustTier } from './types';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'yclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src'
]);

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"“”‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function canonicalizeUrl(value?: string): { url?: string; domain?: string; hash?: string } {
  if (!value) return {};
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.substring(4);
    }
    let canonical = url.toString();
    if (canonical.endsWith('/')) {
      canonical = canonical.slice(0, -1);
    }
    const hash = crypto.createHash('sha1').update(canonical).digest('hex');
    return { url: canonical, domain: url.hostname, hash };
  } catch (error) {
    return { url: value };
  }
}

export function deriveContentType(url?: string, existing?: string): string {
  if (existing) return existing;
  if (!url) return 'web';
  const lower = url.toLowerCase();
  if (lower.includes('podcast') || lower.includes('spotify.com/episode') || lower.includes('podcasts.apple.com')) {
    return 'podcast';
  }
  if (lower.includes('imdb.com/title') || lower.includes('themoviedb.org') || lower.includes('tmdb.org')) {
    return 'movie';
  }
  if (lower.includes('thetvdb.com') || lower.includes('tvdb') || lower.includes('/tv/')) {
    return 'tv';
  }
  return 'web';
}

export function trustTierScore(tier: TrustTier): number {
  switch (tier) {
    case 'high':
      return 0.95;
    case 'medium':
      return 0.75;
    case 'low':
    default:
      return 0.55;
  }
}

export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const map = new Map<string, Candidate>();

  for (const candidate of candidates) {
    const key = candidate.canonical_url || candidate.canonical_title || normalizeTitle(candidate.title) || candidate.candidate_id;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, candidate);
      continue;
    }

    const existingScore = trustTierScore(existing.source.trust_tier) + (existing.signals?.score || 0);
    const candidateScore = trustTierScore(candidate.source.trust_tier) + (candidate.signals?.score || 0);
    if (candidateScore > existingScore) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values());
}
