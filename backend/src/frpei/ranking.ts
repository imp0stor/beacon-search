import { Candidate, RankedCandidate } from './types';
import { normalizeTitle, trustTierScore } from './normalization';

function tokenSet(value: string): Set<string> {
  return new Set(normalizeTitle(value).split(' ').filter(Boolean));
}

function similarityScore(query: string, text: string): number {
  if (!query || !text) return 0;
  const queryTokens = tokenSet(query);
  const textTokens = tokenSet(text);
  if (!queryTokens.size || !textTokens.size) return 0;
  let intersection = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) intersection += 1;
  }
  const union = new Set([...queryTokens, ...textTokens]).size;
  return union ? intersection / union : 0;
}

function freshnessScore(publishedAt?: string | null): number {
  if (!publishedAt) return 0.5;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return 0.5;
  const days = Math.max(0, (Date.now() - published) / (1000 * 60 * 60 * 24));
  return Math.exp(-days / 30);
}

function providerScore(rawScore?: number): number {
  if (rawScore === undefined || rawScore === null) return 0.4;
  const normalized = rawScore / (Math.abs(rawScore) + 1);
  return Math.max(0, Math.min(1, normalized));
}

export function rankCandidates(query: string, candidates: Candidate[]): RankedCandidate[] {
  const ranked = candidates.map(candidate => {
    const semantic = similarityScore(query, `${candidate.title} ${candidate.snippet || ''}`);
    const sourceTrust = trustTierScore(candidate.source.trust_tier);
    const freshness = freshnessScore(candidate.published_at);
    const entity = candidate.entity?.confidence || 0;
    const provider = providerScore(candidate.signals?.score);

    const score =
      semantic * 0.35 +
      provider * 0.2 +
      sourceTrust * 0.2 +
      entity * 0.15 +
      freshness * 0.1;

    return {
      candidate_id: candidate.candidate_id,
      score,
      rank: 0,
      signals: {
        semantic,
        provider,
        source_trust: sourceTrust,
        entity,
        freshness
      },
      candidate
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((item, index) => {
    item.rank = index + 1;
  });

  return ranked;
}
