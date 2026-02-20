import { ConsensusResult, ConsensusSegment, MovieSubtitleVariant, SubtitleSegment } from './types';
import { estimateSegmentDuration, jaccardSimilarity } from '../tv/subtitles';

interface VariantScore {
  variant: MovieSubtitleVariant;
  segments: SubtitleSegment[];
  score: number;
  coverageMs: number;
}

interface ConsensusOptions {
  windowMs?: number;
  conflictThreshold?: number;
  similarityThreshold?: number;
  minSegmentConfidence?: number;
}

function calculateVariantScore(variant: MovieSubtitleVariant, segments: SubtitleSegment[], maxDuration: number): VariantScore {
  const coverageMs = estimateSegmentDuration(segments);
  const coverageScore = maxDuration ? Math.min(1, coverageMs / maxDuration) : 0;

  const textLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
  const avgLength = segments.length ? textLength / segments.length : 0;
  const lengthScore = Math.min(1, avgLength / 80);

  const reliability = Math.min(1, Math.max(0, variant.reliabilityWeight ?? 0.6));
  const score = reliability * 0.5 + coverageScore * 0.3 + lengthScore * 0.2;

  return { variant, segments, score, coverageMs };
}

export function buildConsensusTranscript(
  variants: MovieSubtitleVariant[],
  segmentsByVariant: Map<string, SubtitleSegment[]>,
  options: ConsensusOptions = {}
): ConsensusResult {
  if (!variants.length) {
    return { transcriptText: '', segments: [], overallConfidence: 0, conflicts: 0 };
  }

  const maxDuration = Math.max(...Array.from(segmentsByVariant.values()).map(estimateSegmentDuration));
  const scoredVariants = variants.map(variant =>
    calculateVariantScore(variant, segmentsByVariant.get(variant.id) || [], maxDuration)
  );

  const windowMs = options.windowMs ?? 3000;
  const conflictThreshold = options.conflictThreshold ?? 0.35;
  const similarityThreshold = options.similarityThreshold ?? 0.3;
  const minSegmentConfidence = options.minSegmentConfidence ?? 0.35;

  const totalWindows = Math.ceil(maxDuration / windowMs);
  const consensusSegments: ConsensusSegment[] = [];
  let conflictCount = 0;
  let confidenceSum = 0;

  for (let i = 0; i < totalWindows; i += 1) {
    const windowStart = i * windowMs;
    const windowEnd = windowStart + windowMs;

    const candidates: Array<{
      variantScore: VariantScore;
      segment: SubtitleSegment;
      similarity: number;
    }> = [];

    for (const scored of scoredVariants) {
      const seg = (segmentsByVariant.get(scored.variant.id) || []).find(s => s.startMs <= windowEnd && s.endMs >= windowStart);
      if (!seg) continue;

      let similaritySum = 0;
      let comparisons = 0;
      for (const other of scoredVariants) {
        if (other.variant.id === scored.variant.id) continue;
        const otherSeg = (segmentsByVariant.get(other.variant.id) || []).find(s => s.startMs <= windowEnd && s.endMs >= windowStart);
        if (!otherSeg) continue;
        similaritySum += jaccardSimilarity(seg.text, otherSeg.text);
        comparisons += 1;
      }

      const similarity = comparisons ? similaritySum / comparisons : 0;
      candidates.push({ variantScore: scored, segment: seg, similarity });
    }

    if (!candidates.length) continue;

    candidates.sort((a, b) => {
      const scoreA = a.variantScore.score * (0.6 + 0.4 * a.similarity);
      const scoreB = b.variantScore.score * (0.6 + 0.4 * b.similarity);
      return scoreB - scoreA;
    });

    const top = candidates[0];
    const topScore = top.variantScore.score * (0.6 + 0.4 * top.similarity);
    const second = candidates[1];
    const secondScore = second ? second.variantScore.score * (0.6 + 0.4 * second.similarity) : 0;

    const similarityGap = second ? jaccardSimilarity(top.segment.text, second.segment.text) : 1;
    const conflict = second && (similarityGap < conflictThreshold || Math.abs(topScore - secondScore) < conflictThreshold * 0.5);

    if (conflict) conflictCount += 1;

    const confidence = Math.max(
      minSegmentConfidence,
      Math.min(1, topScore * (top.similarity >= similarityThreshold ? 1 : 0.85))
    );

    confidenceSum += confidence;

    consensusSegments.push({
      startMs: windowStart,
      endMs: windowEnd,
      text: top.segment.text,
      confidence,
      conflict: Boolean(conflict),
      sources: candidates.map(candidate => ({
        variantId: candidate.variantScore.variant.id,
        sourceName: candidate.variantScore.variant.sourceName,
        provider: candidate.variantScore.variant.provider,
        reliabilityWeight: candidate.variantScore.variant.reliabilityWeight
      }))
    });
  }

  const transcriptText = consensusSegments.map(seg => seg.text).join('\n');
  const overallConfidence = consensusSegments.length ? confidenceSum / consensusSegments.length : 0;

  return {
    transcriptText,
    segments: consensusSegments,
    overallConfidence,
    conflicts: conflictCount
  };
}
