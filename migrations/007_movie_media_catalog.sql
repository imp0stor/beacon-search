-- Movie metadata + transcript ingestion schema (MVP)

-- ============================================
-- MOVIE COLLECTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS movie_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL UNIQUE,
    overview TEXT,
    image_url VARCHAR(2000),
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_collections_name ON movie_collections(name);

-- ============================================
-- MOVIE GENRES
-- ============================================
CREATE TABLE IF NOT EXISTS movie_genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_genres_name ON movie_genres(name);

-- ============================================
-- MOVIE PEOPLE (CAST/CREW)
-- ============================================
CREATE TABLE IF NOT EXISTS movie_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_movie_people_name ON movie_people(name);

-- ============================================
-- MOVIES
-- ============================================
CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    status VARCHAR(100),
    release_date DATE,
    runtime_minutes INTEGER,
    rating FLOAT,
    language VARCHAR(50),
    image_url VARCHAR(2000),
    collection_id UUID REFERENCES movie_collections(id) ON DELETE SET NULL,
    external_ids JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(title, release_date)
);

CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date);

-- ============================================
-- MOVIE GENRE LINKS
-- ============================================
CREATE TABLE IF NOT EXISTS movie_genre_links (
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES movie_genres(id) ON DELETE CASCADE,
    PRIMARY KEY(movie_id, genre_id)
);

-- ============================================
-- MOVIE CAST
-- ============================================
CREATE TABLE IF NOT EXISTS movie_cast (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES movie_people(id) ON DELETE CASCADE,
    character_name VARCHAR(255),
    billing_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_cast_movie ON movie_cast(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);

-- ============================================
-- MOVIE CREW
-- ============================================
CREATE TABLE IF NOT EXISTS movie_crew (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES movie_people(id) ON DELETE CASCADE,
    job VARCHAR(255),
    department VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_crew_movie ON movie_crew(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_crew_person ON movie_crew(person_id);

-- ============================================
-- MOVIE PROVIDERS (STREAMING/RETAIL)
-- ============================================
CREATE TABLE IF NOT EXISTS movie_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    provider_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL,
    region VARCHAR(10),
    provider_id VARCHAR(100),
    link VARCHAR(2000),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_providers_movie ON movie_providers(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_providers_name ON movie_providers(provider_name);

-- ============================================
-- MOVIE SUBTITLE VARIANTS
-- ============================================
CREATE TABLE IF NOT EXISTS movie_subtitle_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    source_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    url VARCHAR(2000),
    language VARCHAR(50),
    format VARCHAR(20),
    reliability_weight FLOAT DEFAULT 0.6,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_subtitle_variants_movie ON movie_subtitle_variants(movie_id);

-- ============================================
-- MOVIE SUBTITLE SEGMENTS (raw variants)
-- ============================================
CREATE TABLE IF NOT EXISTS movie_subtitle_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES movie_subtitle_variants(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movie_subtitle_segments_variant ON movie_subtitle_segments(variant_id);

-- ============================================
-- MOVIE CANONICAL TRANSCRIPT
-- ============================================
CREATE TABLE IF NOT EXISTS movie_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    consensus_score FLOAT DEFAULT 0,
    conflicts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(movie_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_transcripts_movie ON movie_transcripts(movie_id);

-- ============================================
-- MOVIE CANONICAL TRANSCRIPT SEGMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS movie_transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence FLOAT DEFAULT 0,
    conflict BOOLEAN DEFAULT false,
    sources JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_movie_transcript_segments_movie ON movie_transcript_segments(movie_id);

-- ============================================
-- MOVIE INGEST RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS movie_ingest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movie_ingest_runs_movie ON movie_ingest_runs(movie_id, started_at DESC);
