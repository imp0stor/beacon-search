export type ProviderName = 'searxng' | 'beacon' | 'media' | string;
export type TrustTier = 'high' | 'medium' | 'low';
export type SearchMode = 'hybrid' | 'vector' | 'text';
export type ContentType = 'web' | 'doc' | 'podcast' | 'tv' | 'movie' | 'news' | 'unknown';

export interface ProviderSource {
  provider: ProviderName;
  providerRef?: string;
  trustTier: TrustTier;
}

export interface CandidateSignals {
  score: number;
  rank?: number;
  providerScore?: number;
  domain?: string;
  freshnessDays?: number;
}

export interface Canonicalization {
  conceptId: string;
  preferredTerm: string;
  matchedBy: 'term' | 'synonym' | 'alias';
  matchedValue: string;
  confidence: number;
  taxonomies: string[];
  provenance: {
    source: 'ontology';
    matchedOn: string;
    timestamp: string;
  };
}

export interface Enrichment {
  synonyms: string[];
  related: { term: string; type: string; weight: number }[];
  metadata: Record<string, any>;
  provenance: {
    sources: string[];
    enrichedAt: string;
  };
  confidence: {
    overall: number;
    entityResolution: number;
  };
}

export interface RankExplanation {
  totalScore: number;
  breakdown: {
    baseScore: number;
    providerWeight: number;
    canonicalBoost: number;
    freshnessBoost: number;
    feedbackBoost: number;
  };
  notes: string[];
}

export interface FrpeiCandidate {
  candidateId: string;
  title: string;
  url?: string;
  normalizedUrl?: string;
  snippet?: string;
  contentType?: ContentType;
  source: ProviderSource;
  retrievedAt: string;
  publishedAt?: string;
  signals: CandidateSignals;
  metadata?: Record<string, any>;
  canonical?: Canonicalization;
  enrichment?: Enrichment;
  rank?: number;
  rankScore?: number;
  explanation?: RankExplanation;
}

export interface FrpeiRetrieveRequest {
  query: string;
  limit?: number;
  providers?: ProviderName[];
  explain?: boolean;
  expand?: boolean;
  mode?: SearchMode;
  types?: ContentType[];
  enableCache?: boolean;
  dedupe?: boolean;
  timeoutMs?: number;
}

export interface ProviderExecutionResult {
  provider: ProviderName;
  items: FrpeiCandidate[];
  warnings?: string[];
  raw?: any;
  elapsedMs: number;
  error?: string;
}

export interface FrpeiRetrieveResponse {
  requestId: string;
  query: string;
  results: FrpeiCandidate[];
  providers: ProviderExecutionResult[];
  metrics: Record<string, any>;
  errors?: string[];
}

export interface FrpeiEnrichRequest {
  candidates: FrpeiCandidate[];
}

export interface FrpeiEnrichResponse {
  enriched: FrpeiCandidate[];
}

export interface FrpeiRankRequest {
  query?: string;
  candidates: FrpeiCandidate[];
}

export interface FrpeiRankResponse {
  ranked: FrpeiCandidate[];
}

export interface FrpeiExplainRequest {
  candidate: FrpeiCandidate;
}

export interface FrpeiExplainResponse {
  candidateId: string;
  explanation: RankExplanation;
}

export interface FrpeiFeedbackRequest {
  requestId?: string;
  candidateId: string;
  provider?: ProviderName;
  feedback: 'positive' | 'negative' | 'neutral';
  rating?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ProviderHealth {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  openedAt?: string;
}
