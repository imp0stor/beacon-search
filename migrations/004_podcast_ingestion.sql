-- Podcast ingestion + transcript indexing schema (MVP)

-- ============================================
-- PODCAST SOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS podcast_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    rss_url VARCHAR(2000) NOT NULL UNIQUE,
    site_url VARCHAR(2000),
    description TEXT,
    language VARCHAR(50),
    categories TEXT[] DEFAULT '{}',
    image_url VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_sources_title ON podcast_sources(title);

-- ============================================
-- PODCAST EPISODES
-- ============================================
CREATE TABLE IF NOT EXISTS podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES podcast_sources(id) ON DELETE CASCADE,
    guid VARCHAR(1000) NOT NULL,
    title VARCHAR(500) NOT NULL,
    episode_url VARCHAR(2000),
    audio_url VARCHAR(2000),
    published_at TIMESTAMPTZ,
    season_number INTEGER,
    episode_number INTEGER,
    duration_seconds INTEGER,
    summary TEXT,
    transcript_url VARCHAR(2000),
    transcript_status VARCHAR(50) DEFAULT 'missing', -- missing | available | transcribed | failed
    transcript_source VARCHAR(50),
    transcript_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_source ON podcast_episodes(source_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published ON podcast_episodes(published_at DESC);

-- ============================================
-- PODCAST TRANSCRIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS podcast_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    word_count INTEGER,
    language VARCHAR(50),
    source VARCHAR(50) DEFAULT 'provided', -- provided | whisper
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(episode_id)
);

CREATE INDEX IF NOT EXISTS idx_podcast_transcripts_episode ON podcast_transcripts(episode_id);

-- ============================================
-- PODCAST INGEST RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS podcast_ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES podcast_sources(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- running | completed | failed
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    episodes_discovered INTEGER DEFAULT 0,
    episodes_updated INTEGER DEFAULT 0,
    transcripts_created INTEGER DEFAULT 0,
    transcripts_transcribed INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_podcast_ingest_runs_source ON podcast_ingest_runs(source_id, started_at DESC);
