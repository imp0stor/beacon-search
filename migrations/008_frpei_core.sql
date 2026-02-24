-- FRPEI core tables (federated retrieval + enrichment)

CREATE TABLE IF NOT EXISTS frpei_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  sources TEXT[] DEFAULT '{}',
  requested_limit INTEGER,
  timeout_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  provider_stats JSONB DEFAULT '{}',
  candidate_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_frpei_requests_started ON frpei_requests(started_at DESC);

CREATE TABLE IF NOT EXISTS frpei_candidates (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES frpei_requests(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_ref VARCHAR(255),
  trust_tier VARCHAR(20),
  url VARCHAR(2000),
  canonical_url VARCHAR(2000),
  canonical_domain VARCHAR(255),
  title VARCHAR(1000),
  canonical_title VARCHAR(1000),
  snippet TEXT,
  language VARCHAR(50),
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ,
  content_type VARCHAR(50),
  raw JSONB DEFAULT '{}',
  signals JSONB DEFAULT '{}',
  entity_id UUID REFERENCES ontology(id) ON DELETE SET NULL,
  entity_term VARCHAR(500),
  entity_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frpei_candidates_request ON frpei_candidates(request_id);
CREATE INDEX IF NOT EXISTS idx_frpei_candidates_canonical_url ON frpei_candidates(canonical_url);
CREATE INDEX IF NOT EXISTS idx_frpei_candidates_entity ON frpei_candidates(entity_id);

CREATE TABLE IF NOT EXISTS frpei_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES frpei_candidates(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES ontology(id) ON DELETE SET NULL,
  topics TEXT[] DEFAULT '{}',
  taxonomy JSONB DEFAULT '{}',
  domain_enrichment JSONB DEFAULT '{}',
  provenance JSONB DEFAULT '{}',
  confidence JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id)
);

CREATE TABLE IF NOT EXISTS frpei_rank_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES frpei_requests(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES frpei_candidates(id) ON DELETE CASCADE,
  score FLOAT,
  rank INTEGER,
  signals JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frpei_rank_request ON frpei_rank_log(request_id, rank);

-- Feedback table defined in 009_frpei_feedback.sql
