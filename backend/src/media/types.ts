export type MediaType = 'podcast' | 'tv' | 'movie';

export interface MediaSearchRequest {
  query: string;
  limit?: number;
  mode?: 'vector' | 'text' | 'hybrid';
  types?: MediaType[];
}

export interface MediaRecommendationRequest {
  profile: {
    keywords?: string[];
    topics?: string[];
    entities?: string[];
    cast?: string[];
    series?: string[];
    movies?: string[];
    excludeTopics?: string[];
    excludeEntities?: string[];
  };
  limit?: number;
  types?: MediaType[];
}
