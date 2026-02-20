# Podcast Content Intelligence MVP

This MVP adds podcast-specific ingestion, transcription, enrichment, and recommendation endpoints on top of Beacon Search.

## ✅ Capabilities

- RSS + episode page + transcript page ingestion
- Local transcription via `~/.openclaw/bin/transcribe-audio.py`
- Transcript chunking + semantic indexing in `documents`
- Auto-tagging + entity extraction via NLP pipeline
- Facets for tags/entities/sources/series
- Profile-driven recommendation preview endpoint

---

## Database Additions

Migration: `migrations/004_podcast_ingestion.sql`

New tables:
- `podcast_sources`
- `podcast_episodes`
- `podcast_transcripts`
- `podcast_ingest_runs`

Transcript chunks are indexed in `documents` with:
- `document_type = 'podcast_transcript_chunk'`
- `attributes.podcast.*` metadata

---

## API Endpoints

### POST `/api/podcasts/ingest`
Ingest RSS feeds and optional episode/transcript pages.

**Request**
```json
{
  "sources": [
    {
      "rssUrl": "https://example.com/podcast/rss",
      "title": "Example Podcast",
      "siteUrl": "https://example.com/podcast",
      "transcriptPages": ["https://example.com/ep-1/transcript"],
      "episodePages": ["https://example.com/ep-1"],
      "transcriptUrlByEpisode": {
        "https://example.com/ep-1": "https://example.com/ep-1/transcript"
      }
    }
  ],
  "transcribeMissing": true,
  "maxEpisodes": 25,
  "chunkSize": 1200,
  "chunkOverlap": 200,
  "forceReindex": false
}
```

**Response**
```json
{
  "results": [
    {
      "runId": "b2b0c4f0-3e4a-4b1e-acde-2d0f83f3c2ef",
      "sourceId": "1c57c66a-3c4b-4a8e-acde-45f2b4a78dc7",
      "rssUrl": "https://example.com/podcast/rss",
      "title": "Example Podcast",
      "episodesDiscovered": 25,
      "episodesUpdated": 25,
      "transcriptsCreated": 10,
      "transcriptsTranscribed": 2,
      "errors": []
    }
  ]
}
```

### GET `/api/podcasts/ingest/:runId`
Check ingest run status.

**Response**
```json
{
  "id": "b2b0c4f0-3e4a-4b1e-acde-2d0f83f3c2ef",
  "source_id": "1c57c66a-3c4b-4a8e-acde-45f2b4a78dc7",
  "status": "completed",
  "started_at": "2026-02-16T19:00:00.000Z",
  "completed_at": "2026-02-16T19:05:00.000Z",
  "episodes_discovered": 25,
  "episodes_updated": 25,
  "transcripts_created": 10,
  "transcripts_transcribed": 2,
  "errors": []
}
```

### GET `/api/podcasts/episodes/:episodeId/transcript`
Fetch transcript text for an episode.

**Response**
```json
{
  "episodeId": "9f00f567-4a7b-41c1-ae4f-5bcb99f6d1b9",
  "transcriptText": "...",
  "source": "whisper",
  "updatedAt": "2026-02-16T19:05:00.000Z",
  "wordCount": 8230
}
```

### GET `/api/podcasts/facets`
Facet counts for tags/entities/sources/series.

**Response**
```json
{
  "tags": [{ "value": "ai", "count": 24 }],
  "entityTypes": {
    "PERSON": [{ "value": "Sam Altman", "count": 5 }],
    "ORGANIZATION": [{ "value": "OpenAI", "count": 4 }]
  },
  "sources": [{ "value": "Example Podcast", "count": 25 }],
  "series": [{ "value": "Example Podcast", "count": 25 }]
}
```

### POST `/api/podcasts/recommendations/preview`
Score and rank podcast episodes based on profile signals.

**Request**
```json
{
  "profile": {
    "keywords": ["vector search", "retrieval"],
    "topics": ["ai"],
    "entities": ["OpenAI"],
    "speakers": ["Sam Altman"],
    "excludeTopics": ["crypto"],
    "excludeEntities": ["NFT"]
  },
  "limit": 5
}
```

**Response**
```json
{
  "recommendations": [
    {
      "episodeId": "9f00f567-4a7b-41c1-ae4f-5bcb99f6d1b9",
      "title": "Building AI Agents",
      "episodeUrl": "https://example.com/ep-1",
      "audioUrl": "https://cdn.example.com/ep-1.mp3",
      "publishedAt": "2026-02-10T00:00:00.000Z",
      "sourceId": "1c57c66a-3c4b-4a8e-acde-45f2b4a78dc7",
      "sourceTitle": "Example Podcast",
      "rssUrl": "https://example.com/podcast/rss",
      "summary": "...",
      "score": 0.82
    }
  ]
}
```

---

## Transcription Settings

Environment variables:
- `PODCAST_TRANSCRIBE_SCRIPT` (default: `~/.openclaw/bin/transcribe-audio.py`)
- `PODCAST_TRANSCRIBE_MAX_CHARS` (default: `200000`)

---

## Rollout Checklist

1. Apply migrations:
   ```bash
   node apply-migration.js migrations/004_podcast_ingestion.sql
   ```
2. Install dependencies:
   ```bash
   cd backend && npm install
   ```
3. Start backend and verify endpoints:
   ```bash
   cd backend && npm run dev
   ```
4. Run a test ingest against a sample RSS feed.
5. Verify transcripts were stored + chunks indexed.
6. Validate facets and recommendation preview endpoint outputs.

---

## Notes

- Transcript chunks are indexed as standalone documents, enabling existing `/api/search` to work out of the box.
- Auto-tagging + entities are persisted in `document_tags` and `document_entities` via the NLP processor.
- To force re-indexing of transcripts, use `forceReindex: true` in the ingest request.
