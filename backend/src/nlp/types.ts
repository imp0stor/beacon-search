// NLP Pipeline Types

export interface ExtractedTag {
  tag: string;
  confidence: number;
  algorithm: string;
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalizedValue?: string;
  positionStart?: number;
  positionEnd?: number;
  confidence: number;
  context?: string;
}

export type EntityType = 
  | 'PERSON'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'DATE'
  | 'MONEY'
  | 'PRODUCT'
  | 'EVENT'
  | 'EMAIL'
  | 'URL'
  | 'PHONE';

export interface ExtractedMetadata {
  key: string;
  value: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'json';
  confidence: number;
  extractedBy: string;
}

export interface NLPResult {
  tags: ExtractedTag[];
  entities: ExtractedEntity[];
  metadata: ExtractedMetadata[];
}

export interface DocumentForNLP {
  id: string;
  title: string;
  content: string;
  url?: string;
  createdAt?: Date;
  attributes?: Record<string, any>;
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

export interface RelatedDocument {
  id: string;
  title: string;
  score: number;
  sharedEntities: string[];
  sharedTags: string[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface SearchFacets {
  tags: FacetCount[];
  entityTypes: Record<string, FacetCount[]>;
  authors: FacetCount[];
  dateRanges: FacetCount[];
  documentTypes: FacetCount[];
  sentiment: FacetCount[];
}
