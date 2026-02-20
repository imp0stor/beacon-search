export interface PodcastIngestSource {
  rssUrl: string;
  title?: string;
  siteUrl?: string;
  transcriptPages?: string[];
  episodePages?: string[];
  transcriptUrlByEpisode?: Record<string, string>; // key = guid or episode URL
}

export interface PodcastIngestRequest {
  sources: PodcastIngestSource[];
  transcribeMissing?: boolean;
  maxEpisodes?: number;
  maxTranscriptions?: number;
  maxTranscriptionsPerSource?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  forceReindex?: boolean;
}

export interface PodcastIngestResult {
  runId: string;
  sourceId: string;
  rssUrl: string;
  title: string;
  episodesDiscovered: number;
  episodesUpdated: number;
  transcriptsCreated: number;
  transcriptsTranscribed: number;
  errors: string[];
}

export interface PodcastTranscriptResult {
  episodeId: string;
  transcriptText: string;
  source: string;
  updatedAt: string;
  wordCount: number;
}

export interface PodcastRecommendationProfile {
  keywords?: string[];
  topics?: string[];
  entities?: string[];
  speakers?: string[];
  series?: string[];
  excludeTopics?: string[];
  excludeEntities?: string[];
}

export interface PodcastRecommendationRequest {
  profile: PodcastRecommendationProfile;
  limit?: number;
}
