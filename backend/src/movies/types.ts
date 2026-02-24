export type MovieMetadataProviderName = 'tmdb' | 'omdb' | 'custom';

export interface MovieIdentifier {
  tmdbId?: string;
  imdbId?: string;
  title?: string;
  year?: number;
  externalIds?: Record<string, string>;
}

export interface MovieSubtitleVariantInput {
  movieTitle?: string;
  movieId?: string;
  language?: string;
  variants: Array<{
    url: string;
    sourceName: string;
    provider?: string;
    reliabilityWeight?: number;
    format?: 'srt' | 'vtt' | 'auto';
    notes?: string;
    provenance?: {
      sourceUrl?: string;
      license?: string;
      rights?: string;
      collectedAt?: string;
    };
  }>;
}

export interface MovieIngestRequest {
  movies: MovieIdentifier[];
  language?: string;
  subtitleVariants?: MovieSubtitleVariantInput[];
  fetchSubtitles?: boolean;
  transcribeMissing?: boolean;
  audioUrlByMovie?: Record<string, string>;
  options?: {
    providerPreference?: MovieMetadataProviderName[];
    providerRegion?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    consensusWindowMs?: number;
    conflictThreshold?: number;
    similarityThreshold?: number;
    minSegmentConfidence?: number;
  };
}

export interface MovieIngestResult {
  movieId: string;
  title: string;
  subtitlesProcessed: number;
  transcriptsCreated: number;
  transcriptsTranscribed: number;
  errors: string[];
}

export interface MovieRecommendationRequest {
  profile: {
    keywords?: string[];
    topics?: string[];
    entities?: string[];
    cast?: string[];
    movies?: string[];
    excludeTopics?: string[];
    excludeEntities?: string[];
  };
  limit?: number;
}

export interface MovieSearchRequest {
  query: string;
  limit?: number;
  mode?: 'vector' | 'text' | 'hybrid';
  filters?: {
    movieId?: string;
    title?: string;
    genre?: string;
    collection?: string;
    releaseYear?: number;
    provider?: string;
    cast?: string;
  };
}

export interface MovieSubtitleVariant {
  id: string;
  movieId: string;
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
