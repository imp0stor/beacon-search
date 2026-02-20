-- TV metadata + transcript ingestion schema (MVP)

-- ============================================
-- TV SERIES
-- ============================================
CREATE TABLE IF NOT EXISTS tv_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL UNIQUE,
    overview TEXT,
    status VARCHAR(100),
    network VARCHAR(255),
    genres TEXT[] DEFAULT '{}',
    language VARCHAR(50),
    first_air_date DATE,
    last_air_date DATE,
    image_url VARCHAR(2000),
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_series_title ON tv_series(title);

-- ============================================
-- TV SEASONS
-- ============================================
CREATE TABLE IF NOT EXISTS tv_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    title VARCHAR(500),
    overview TEXT,
    air_date DATE,
    episode_count INTEGER,
    image_url VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_tv_seasons_series ON tv_seasons(series_id);

-- ============================================
-- TV EPISODES
-- ============================================
CREATE TABLE IF NOT EXISTS tv_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
    season_id UUID REFERENCES tv_seasons(id) ON DELETE SET NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    air_date DATE,
    runtime_minutes INTEGER,
    rating FLOAT,
    image_url VARCHAR(2000),
    external_ids JSONB DEFAULT '{}',
    cast JSONB DEFAULT '[]',
    transcript_status VARCHAR(50) DEFAULT 'missing',
    transcript_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_tv_episodes_series ON tv_episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_tv_episodes_airdate ON tv_episodes(air_date);

-- ============================================
-- TV SUBTITLE VARIANTS
-- ============================================
CREATE TABLE IF NOT EXISTS tv_episode_subtitle_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    url VARCHAR(2000),
    language VARCHAR(50),
    format VARCHAR(20),
    reliability_weight FLOAT DEFAULT 0.6,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_subtitle_variants_episode ON tv_episode_subtitle_variants(episode_id);

-- ============================================
-- TV SUBTITLE SEGMENTS (raw variants)
-- ============================================
CREATE TABLE IF NOT EXISTS tv_episode_subtitle_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES tv_episode_subtitle_variants(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tv_subtitle_segments_variant ON tv_episode_subtitle_segments(variant_id);

-- ============================================
-- TV CANONICAL TRANSCRIPT
-- ============================================
CREATE TABLE IF NOT EXISTS tv_episode_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    consensus_score FLOAT DEFAULT 0,
    conflicts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(episode_id)
);

CREATE INDEX IF NOT EXISTS idx_tv_transcripts_episode ON tv_episode_transcripts(episode_id);

-- ============================================
-- TV CANONICAL TRANSCRIPT SEGMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS tv_episode_transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence FLOAT DEFAULT 0,
    conflict BOOLEAN DEFAULT false,
    sources JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_tv_transcript_segments_episode ON tv_episode_transcript_segments(episode_id);

-- ============================================
-- TV INGEST RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS tv_ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_ingest_runs_series ON tv_ingest_runs(series_id, started_at DESC);
