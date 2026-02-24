# Movie & Mixed-Media Catalog (MVP)

This document covers the movie ingestion pipeline, mixed-media discovery endpoints, and operational guardrails.

## Overview

The movie pipeline mirrors TV/podcast ingestion and stores:
- Movies + collections + genres
- Cast/crew entities
- Availability providers (streaming/rent/buy)
- Subtitle variants + canonical transcripts
- Search chunks in the shared `documents` table (`document_type = 'movie_transcript_chunk'`)

Mixed-media discovery endpoints aggregate TV/podcast/movie chunks for cross-domain search and recommendations.

## Provider Configuration

### TMDB / TMDB-Compatible

- **Primary provider** for movie metadata, credits, collections, and watch providers.
- Supports TMDB-compatible API hosts.

**Env Vars**
- `MOVIE_TMDB_API_KEY` (or `TMDB_API_KEY` fallback)
- `MOVIE_TMDB_BASE_URL` (default: `https://api.themoviedb.org/3`)
- `MOVIE_TMDB_IMAGE_BASE_URL` (default: `https://image.tmdb.org/t/p/original`)
- `MOVIE_PROVIDER_REGION` (default: `US`)

### OMDb (Fallback)

- Used only when `MOVIE_OMDB_API_KEY` (or `OMDB_API_KEY`) is configured.
- Provides basic metadata + cast/crew names.

**Env Vars**
- `MOVIE_OMDB_API_KEY` (or `OMDB_API_KEY` fallback)

## Subtitle & Transcript Ingestion

Movie subtitles/transcripts are **opt-in only**:
- Provide explicit `subtitleVariants` in the ingest request.
- Store provenance in `metadata.provenance` (source URL, license, rights).
- **Do not** ingest copyrighted subtitles without permission.

Optional transcription:
- `transcribeMissing` only uses user-supplied `audioUrlByMovie`.
- No automated scraping of protected media sources.

**Env Vars**
- `MOVIE_TRANSCRIBE_SCRIPT` (defaults to `TV_TRANSCRIBE_SCRIPT` or `~/.openclaw/bin/transcribe-audio.py`)

## Licensing & Compliance Notes

- Respect TMDB and OMDb terms of service (API key usage, branding attribution, caching rules).
- Do not store or redistribute protected subtitles/transcripts.
- Ensure `subtitleVariants` are sourced from public-domain or licensed providers.
- Avoid indexing or embedding any media content without rights or explicit permission.

## Rollout Checklist

1. **DB Migration**
   - Apply `migrations/007_movie_media_catalog.sql`.
   - Verify new tables in schema.
2. **Secrets & Config**
   - Set `MOVIE_TMDB_API_KEY` (and optionally `MOVIE_OMDB_API_KEY`).
   - Set `MOVIE_PROVIDER_REGION` to match deployment region.
3. **API Smoke Tests**
   - `POST /api/movies/ingest` with a known TMDB title.
   - `GET /api/movies/browse` and `GET /api/movies/facets`.
   - `POST /api/movies/search` with a simple query.
4. **Mixed Media**
   - `POST /api/media/search` across podcast/TV/movie types.
   - `POST /api/media/recommendations/preview` with a sample profile.
5. **Compliance Audit**
   - Confirm subtitle sources include provenance + license.
   - Remove any unlicensed content from inputs.
6. **Observability**
   - Monitor ingest errors and ensure `movie_ingest_runs` log entries.
