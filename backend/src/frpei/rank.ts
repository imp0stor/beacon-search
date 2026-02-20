import { FrpeiCandidate, RankExplanation } from './types';

const PROVIDER_WEIGHTS: Record<string, number> = {
  beacon: 0.95,
  media: 0.85,
  searxng: 0.6
};

function freshnessBoost(publishedAt?: string): { boost: number; days?: number } {
  if (!publishedAt) return { boost: 0 };
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return { boost: 0 };
  const days = Math.max(0, (Date.now() - published) / (1000 * 60 * 60 * 24));
  const boost = days <= 30 ? (1 - days / 30) * 0.08 : 0;
  return { boost, days };
}

export function buildExplanation(candidate: FrpeiCandidate): RankExplanation {
  const baseScore = candidate.signals.score || candidate.signals.providerScore || 0;
  const providerWeight = PROVIDER_WEIGHTS[candidate.source.provider] ?? 0.7;
  const canonicalBoost = candidate.canonical ? candidate.canonical.confidence * 0.1 : 0;
  const { boost: freshBoost } = freshnessBoost(candidate.publishedAt);
  const feedbackBoost = 0;
  const totalScore = baseScore * providerWeight + canonicalBoost + freshBoost + feedbackBoost;

  const notes: string[] = [];
  if (candidate.canonical) notes.push(`Matched ontology concept ${candidate.canonical.preferredTerm}`);
  if (freshBoost > 0) notes.push('Freshness boost applied');

  return {
    totalScore,
    breakdown: {
      baseScore,
      providerWeight,
      canonicalBoost,
      freshnessBoost: freshBoost,
      feedbackBoost
    },
    notes
  };
}

export function rankCandidates(candidates: FrpeiCandidate[]): FrpeiCandidate[] {
  const ranked = candidates.map(candidate => {
    const explanation = buildExplanation(candidate);
    const { days } = freshnessBoost(candidate.publishedAt);
    return {
      ...candidate,
      rankScore: explanation.totalScore,
      explanation,
      signals: {
        ...candidate.signals,
        freshnessDays: days
      }
    };
  });

  ranked.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0));
  return ranked.map((candidate, index) => ({
    ...candidate,
    rank: index + 1
  }));
}
