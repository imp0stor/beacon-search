export type TVMetadataProviderName = 'tvdb' | 'tvmaze' | 'custom';

export interface TVSeriesIdentifier {
  tvdbId?: string;
  tvmazeId?: string;
  title?: string;
  year?: number;
  externalIds?: Record<string, string>;
}

export interface TVSubtitleVariantInput {
  seriesTitle?: string;
  seriesId?: string;
  seasonNumber: number;
  episodeNumber: number;
  language?: string;
  variants: Array<{
    url: string;
    sourceName: string;
    provider?: string;
    reliabilityWeight?: number;
    format?: 'srt' | 'vtt' | 'auto';
    notes?: string;
  }>;
}

export interface TVIngestRequest {
  series: TVSeriesIdentifier[];
  maxSeasons?: number;
  maxEpisodes?: number;
  language?: string;
  subtitleVariants?: TVSubtitleVariantInput[];
  fetchSubtitles?: boolean;
  transcribeMissing?: boolean;
  audioUrlByEpisode?: Record<string, string>;
  options?: {
    providerPreference?: TVMetadataProviderName[];
    chunkSize?: number;
    chunkOverlap?: number;
    consensusWindowMs?: number;
    conflictThreshold?: number;
    similarityThreshold?: number;
    minSegmentConfidence?: number;
  };
}

export interface TVIngestResult {
  seriesId: string;
  title: string;
  seasons: number;
  episodes: number;
  subtitlesProcessed: number;
  transcriptsCreated: number;
  transcriptsTranscribed: number;
  errors: string[];
}

export interface TVRecommendationRequest {
  profile: {
    keywords?: string[];
    topics?: string[];
    entities?: string[];
    cast?: string[];
    series?: string[];
    excludeTopics?: string[];
    excludeEntities?: string[];
  };
  limit?: number;
}

export interface TVSearchRequest {
  query: string;
  limit?: number;
  mode?: 'vector' | 'text' | 'hybrid';
  filters?: {
    seriesId?: string;
    seriesTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    topic?: string;
    entity?: string;
  };
}

export interface TVSubtitleVariant {
  id: string;
  episodeId: string;
  sourceName: string;
  provider: string;
  url: string | null;
  language: string | null;
  format: string | null;
  reliabilityWeight: number;
  metadata?: Record<string, any>;
}

export interface SubtitleSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface ConsensusSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
  conflict: boolean;
  sources: Array<{
    variantId: string;
    sourceName: string;
    provider: string;
    reliabilityWeight: number;
  }>;
}

export interface ConsensusResult {
  transcriptText: string;
  segments: ConsensusSegment[];
  overallConfidence: number;
  conflicts: number;
}
