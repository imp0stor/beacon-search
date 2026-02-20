import { Pool } from 'pg';
import { NLPProcessor } from '../nlp';
import { chunkTranscript } from '../podcasts/utils';
import { buildConsensusTranscript } from './consensus';
import { parseSubtitleFromUrl } from './subtitles';
import { TVDBProvider, TVMazeProvider, TVMetadataProvider, TVSeriesMetadata } from './providers';
import {
  ConsensusResult,
  SubtitleSegment,
  TVIngestRequest,
  TVIngestResult,
  TVRecommendationRequest,
  TVSearchRequest,
  TVSubtitleVariant
} from './types';
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

export class TVService {
  private pool: Pool;
  private generateEmbedding: (text: string) => Promise<number[]>;
  private nlp: NLPProcessor;
  private nlpReady: Promise<void> | null = null;

  constructor(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.generateEmbedding = generateEmbedding;
    this.nlp = new NLPProcessor(pool);
  }

  private async ensureNlpReady(): Promise<void> {
    if (!this.nlpReady) {
      this.nlpReady = this.nlp.trainOnCorpus().catch(err => {
        console.warn('[TV] NLP training skipped:', err);
      });
    }
    await this.nlpReady;
  }

  async ingest(request: TVIngestRequest): Promise<TVIngestResult[]> {
    const results: TVIngestResult[] = [];
    const providers = this.resolveProviders(request);
    const chunkSize = request.options?.chunkSize ?? 1200;
    const chunkOverlap = request.options?.chunkOverlap ?? 200;

    for (const seriesInput of request.series) {
      const result: TVIngestResult = {
        seriesId: '',
        title: seriesInput.title || seriesInput.tvdbId || seriesInput.tvmazeId || 'Unknown',
        seasons: 0,
        episodes: 0,
        subtitlesProcessed: 0,
        transcriptsCreated: 0,
        transcriptsTranscribed: 0,
        errors: []
      };

      try {
        const metadata = await this.fetchSeriesMetadata(providers, seriesInput);
        if (!metadata) {
          throw new Error(`No metadata found for ${seriesInput.title || seriesInput.tvdbId || 'series'}`);
        }

        const seriesRecord = await this.upsertSeries(metadata);
        result.seriesId = seriesRecord.id;
        result.title = seriesRecord.title;

        const seasons = await this.fetchSeasons(providers, metadata);
        const episodes = await this.fetchEpisodes(providers, metadata);

        await this.upsertSeasons(seriesRecord.id, seasons);
        await this.upsertEpisodes(seriesRecord.id, seasons, episodes);

        result.seasons = seasons.length;
        result.episodes = episodes.length;

        const episodeMap = await this.fetchEpisodeMap(seriesRecord.id);

        for (const episode of episodeMap.values()) {
          const variantInput = this.matchSubtitleVariants(request, seriesRecord.id, episode.season_number, episode.episode_number, seriesRecord.title);
          if (!variantInput.length && !request.transcribeMissing) continue;

          const variants: TVSubtitleVariant[] = [];
          const segmentsByVariant = new Map<string, SubtitleSegment[]>();

          for (const variant of variantInput) {
            const variantRecord = await this.insertVariant(episode.id, variant);
            const segments = await parseSubtitleFromUrl(variant.url, variant.format || 'auto');
            await this.storeVariantSegments(variantRecord.id, segments);
            variants.push(variantRecord);
            segmentsByVariant.set(variantRecord.id, segments);
            result.subtitlesProcessed += 1;
          }

          if (!variants.length && request.transcribeMissing) {
            const audioUrl = request.audioUrlByEpisode?.[this.episodeKey(seriesRecord.title, episode.season_number, episode.episode_number)];
            if (audioUrl) {
              const transcript = await this.transcribeAudioFromUrl(audioUrl);
              const variantRecord = await this.insertVariant(episode.id, {
                url: audioUrl,
                sourceName: 'local_transcription',
                provider: 'whisper',
                reliabilityWeight: 0.7,
                format: 'auto'
              });
              const segments = [{ startMs: 0, endMs: 1, text: transcript }];
              await this.storeVariantSegments(variantRecord.id, segments);
              variants.push(variantRecord);
              segmentsByVariant.set(variantRecord.id, segments);
              result.subtitlesProcessed += 1;
              result.transcriptsTranscribed += 1;
            }
          }

          if (!variants.length) continue;

          const consensus = buildConsensusTranscript(variants, segmentsByVariant, {
            windowMs: request.options?.consensusWindowMs,
            conflictThreshold: request.options?.conflictThreshold,
            similarityThreshold: request.options?.similarityThreshold,
            minSegmentConfidence: request.options?.minSegmentConfidence
          });

          await this.storeCanonicalTranscript(episode.id, consensus, request.language || 'en');
          await this.indexCanonicalTranscript(episode, consensus, chunkSize, chunkOverlap);
          result.transcriptsCreated += 1;
        }

        await this.completeRun(seriesRecord.id, 'completed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(message);
        await this.completeRun(result.seriesId, 'failed');
      }

      results.push(result);
    }

    return results;
  }

  async getBrowse(seriesId?: string) {
    if (!seriesId) {
      const series = await this.pool.query('SELECT * FROM tv_series ORDER BY title');
      return { series: series.rows };
    }

    const seriesResult = await this.pool.query('SELECT * FROM tv_series WHERE id = $1', [seriesId]);
    const seasonsResult = await this.pool.query('SELECT * FROM tv_seasons WHERE series_id = $1 ORDER BY season_number', [seriesId]);
    const episodesResult = await this.pool.query('SELECT * FROM tv_episodes WHERE series_id = $1 ORDER BY season_number, episode_number', [seriesId]);

    return {
      series: seriesResult.rows[0] || null,
      seasons: seasonsResult.rows,
      episodes: episodesResult.rows
    };
  }

  async getTranscriptDetails(episodeId: string) {
    const transcriptResult = await this.pool.query(
      'SELECT * FROM tv_episode_transcripts WHERE episode_id = $1',
      [episodeId]
    );
    const segmentsResult = await this.pool.query(
      'SELECT * FROM tv_episode_transcript_segments WHERE episode_id = $1 ORDER BY start_ms',
      [episodeId]
    );
    const variantsResult = await this.pool.query(
      'SELECT * FROM tv_episode_subtitle_variants WHERE episode_id = $1 ORDER BY created_at',
      [episodeId]
    );
    const variantIds = variantsResult.rows.map((row: any) => row.id);
    const variantSegmentsResult = variantIds.length
      ? await this.pool.query(
          'SELECT * FROM tv_episode_subtitle_segments WHERE variant_id = ANY($1) ORDER BY start_ms',
          [variantIds]
        )
      : { rows: [] };

    return {
      canonical: transcriptResult.rows[0] || null,
      canonicalSegments: segmentsResult.rows,
      variants: variantsResult.rows,
      variantSegments: variantSegmentsResult.rows
    };
  }

  async getFacets() {
    const seriesResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'tv_transcript_chunk'
        AND dm.meta_key = 'tv_series'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const seasonResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'tv_transcript_chunk'
        AND dm.meta_key = 'tv_season'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const episodeResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'tv_transcript_chunk'
        AND dm.meta_key = 'tv_episode'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const tagResult = await this.pool.query(`
      SELECT dt.tag as value, COUNT(*) as count
      FROM document_tags dt
      JOIN documents d ON dt.document_id = d.id
      WHERE d.document_type = 'tv_transcript_chunk'
      GROUP BY dt.tag
      ORDER BY count DESC
      LIMIT 40
    `);

    const entityResult = await this.pool.query(`
      SELECT de.entity_type, COALESCE(de.normalized_value, de.entity_value) as value, COUNT(DISTINCT de.document_id) as count
      FROM document_entities de
      JOIN documents d ON de.document_id = d.id
      WHERE d.document_type = 'tv_transcript_chunk'
        AND de.entity_type IN ('PERSON', 'ORGANIZATION', 'LOCATION')
      GROUP BY de.entity_type, COALESCE(de.normalized_value, de.entity_value)
      ORDER BY count DESC
      LIMIT 60
    `);

    const entityTypes: Record<string, { value: string; count: number }[]> = {};
    for (const row of entityResult.rows) {
      if (!entityTypes[row.entity_type]) entityTypes[row.entity_type] = [];
      entityTypes[row.entity_type].push({ value: row.value, count: parseInt(row.count, 10) });
    }

    return {
      series: seriesResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      seasons: seasonResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      episodes: episodeResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      tags: tagResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      entities: entityTypes
    };
  }

  async search(request: TVSearchRequest) {
    const limit = request.limit ?? 10;
    const mode = request.mode || 'hybrid';
    const query = request.query;

    const embedding = await this.generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const filters: Array<{ clause: string; value: any }> = [];

    if (request.filters?.seriesId) {
      filters.push({ clause: "attributes->'tv'->>'series_id' = $IDX", value: request.filters.seriesId });
    }
    if (request.filters?.seriesTitle) {
      filters.push({ clause: "attributes->'tv'->>'series_title' = $IDX", value: request.filters.seriesTitle });
    }
    if (request.filters?.seasonNumber !== undefined) {
      filters.push({ clause: "attributes->'tv'->>'season_number' = $IDX", value: String(request.filters.seasonNumber) });
    }
    if (request.filters?.episodeNumber !== undefined) {
      filters.push({ clause: "attributes->'tv'->>'episode_number' = $IDX", value: String(request.filters.episodeNumber) });
    }

    const buildWhere = (offset: number, alias?: string) => {
      const clauses = [`${alias ? alias + '.' : ''}document_type = 'tv_transcript_chunk'`];
      let idx = offset;
      for (const filter of filters) {
        idx += 1;
        clauses.push(filter.clause.replace('$IDX', `$${idx}`).replace('attributes', alias ? `${alias}.attributes` : 'attributes'));
      }
      return `WHERE ${clauses.join(' AND ')}`;
    };

    let queryText = '';
    let params: any[] = [];

    if (mode === 'vector') {
      const whereClause = buildWhere(1);
      params = [vectorStr, ...filters.map(f => f.value), limit];
      queryText = `
        SELECT id, title, content, url, attributes, 1 - (embedding <=> $1::vector) as score
        FROM documents
        ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT $${params.length}
      `;
    } else if (mode === 'text') {
      const whereClause = buildWhere(1);
      params = [query, ...filters.map(f => f.value), limit];
      queryText = `
        SELECT id, title, content, url, attributes,
          ts_rank(to_tsvector('english', content || ' ' || title), plainto_tsquery('english', $1)) as score
        FROM documents
        ${whereClause}
          AND to_tsvector('english', content || ' ' || title) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $${params.length}
      `;
    } else {
      const whereClause = buildWhere(2);
      params = [vectorStr, query, ...filters.map(f => f.value), limit];
      queryText = `
        WITH vector_scores AS (
          SELECT id, 1 - (embedding <=> $1::vector) as vscore
          FROM documents
          ${whereClause}
        ),
        text_scores AS (
          SELECT id, ts_rank(to_tsvector('english', content || ' ' || title), plainto_tsquery('english', $2)) as tscore
          FROM documents
          ${whereClause}
        )
        SELECT d.id, d.title, d.content, d.url, d.attributes,
          COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
        FROM documents d
        LEFT JOIN vector_scores v ON d.id = v.id
        LEFT JOIN text_scores t ON d.id = t.id
        WHERE d.id IN (SELECT id FROM vector_scores UNION SELECT id FROM text_scores)
        ORDER BY score DESC
        LIMIT $${params.length}
      `;
    }

    const result = await this.pool.query(queryText, params);
    return {
      query,
      mode,
      count: result.rows.length,
      results: result.rows
    };
  }

  async recommend(request: TVRecommendationRequest) {
    const limit = request.limit ?? 10;
    const profile = request.profile;

    const keywords = [...(profile.keywords || []), ...(profile.topics || [])];
    const entities = [...(profile.entities || []), ...(profile.cast || [])];

    const profileText = [...keywords, ...entities, ...(profile.series || [])].join(' ');
    if (!profileText) {
      throw new Error('Profile must include keywords, topics, entities, cast, or series');
    }

    const embedding = await this.generateEmbedding(profileText);
    const vectorStr = `[${embedding.join(',')}]`;

    const maxDocs = Math.max(50, limit * 5);

    const docsResult = await this.pool.query(`
      WITH vector_docs AS (
        SELECT id, title, content, url, attributes,
               1 - (embedding <=> $1::vector) as vscore
        FROM documents
        WHERE document_type = 'tv_transcript_chunk'
        ORDER BY embedding <=> $1::vector
        LIMIT $4
      ),
      tag_matches AS (
        SELECT document_id, COUNT(*) as match_count
        FROM document_tags
        WHERE document_id IN (SELECT id FROM vector_docs)
          AND tag = ANY($2)
        GROUP BY document_id
      ),
      entity_matches AS (
        SELECT document_id, COUNT(*) as match_count
        FROM document_entities
        WHERE document_id IN (SELECT id FROM vector_docs)
          AND COALESCE(normalized_value, entity_value) = ANY($3)
        GROUP BY document_id
      )
      SELECT v.*, COALESCE(t.match_count, 0) as tag_matches, COALESCE(e.match_count, 0) as entity_matches
      FROM vector_docs v
      LEFT JOIN tag_matches t ON v.id = t.document_id
      LEFT JOIN entity_matches e ON v.id = e.document_id
      ORDER BY (vscore + (COALESCE(t.match_count, 0) * 0.05) + (COALESCE(e.match_count, 0) * 0.05)) DESC
      LIMIT $4
    `, [vectorStr, keywords, entities, maxDocs]);

    const docRows = docsResult.rows;
    if (!docRows.length) return [];

    const episodeScores: Record<string, { score: number; episodeId: string; payload: any }> = {};
    const excludedTags = new Set(profile.excludeTopics || []);
    const excludedEntities = new Set(profile.excludeEntities || []);

    for (const row of docRows) {
      const attributes = row.attributes || {};
      const episodeId = attributes?.tv?.episode_id;
      if (!episodeId) continue;

      const score = parseFloat(row.vscore) + row.tag_matches * 0.05 + row.entity_matches * 0.05;
      if (!episodeScores[episodeId] || score > episodeScores[episodeId].score) {
        episodeScores[episodeId] = { score, episodeId, payload: attributes?.tv };
      }
    }

    const episodeIds = Object.keys(episodeScores).slice(0, limit * 3);
    if (!episodeIds.length) return [];

    const episodeResult = await this.pool.query(`
      SELECT e.*, s.title as series_title
      FROM tv_episodes e
      JOIN tv_series s ON e.series_id = s.id
      WHERE e.id = ANY($1)
    `, [episodeIds]);

    const episodes = episodeResult.rows.map((row: any) => ({
      episodeId: row.id,
      title: row.title,
      seriesId: row.series_id,
      seriesTitle: row.series_title,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      airDate: row.air_date,
      overview: row.overview,
      score: episodeScores[row.id]?.score || 0
    })).filter((episode: any) => {
      if (excludedTags.size || excludedEntities.size) {
        return true;
      }
      return true;
    });

    episodes.sort((a: any, b: any) => b.score - a.score);
    return episodes.slice(0, limit);
  }

  private resolveProviders(request: TVIngestRequest): TVMetadataProvider[] {
    const providers: TVMetadataProvider[] = [];
    const preference = request.options?.providerPreference || [];
    const hasTVDB = Boolean(process.env.TVDB_API_KEY);

    const tvdb = new TVDBProvider();
    const tvmaze = new TVMazeProvider();

    const pushIf = (name: string, provider: TVMetadataProvider, condition: boolean) => {
      if (condition && !providers.find(p => p.name === provider.name)) providers.push(provider);
    };

    if (preference.length) {
      for (const pref of preference) {
        if (pref === 'tvdb') pushIf('tvdb', tvdb, hasTVDB);
        if (pref === 'tvmaze') pushIf('tvmaze', tvmaze, true);
      }
    }

    if (hasTVDB) pushIf('tvdb', tvdb, true);
    pushIf('tvmaze', tvmaze, true);

    return providers;
  }

  private async fetchSeriesMetadata(providers: TVMetadataProvider[], identifier: any): Promise<TVSeriesMetadata | null> {
    for (const provider of providers) {
      const series = await provider.fetchSeries(identifier);
      if (series) {
        series.externalIds = { ...identifier.externalIds, ...series.externalIds };
        return series;
      }
    }
    return null;
  }

  private async fetchSeasons(providers: TVMetadataProvider[], series: TVSeriesMetadata) {
    for (const provider of providers) {
      const seasons = await provider.fetchSeasons(series);
      if (seasons.length) return seasons;
    }
    return [];
  }

  private async fetchEpisodes(providers: TVMetadataProvider[], series: TVSeriesMetadata) {
    for (const provider of providers) {
      const episodes = await provider.fetchEpisodes(series);
      if (episodes.length) return episodes;
    }
    return [];
  }

  private async upsertSeries(series: TVSeriesMetadata) {
    const result = await this.pool.query(`
      INSERT INTO tv_series (
        title, overview, status, network, genres, language, first_air_date, last_air_date, image_url, external_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (title) DO UPDATE SET
        overview = COALESCE(EXCLUDED.overview, tv_series.overview),
        status = COALESCE(EXCLUDED.status, tv_series.status),
        network = COALESCE(EXCLUDED.network, tv_series.network),
        genres = COALESCE(EXCLUDED.genres, tv_series.genres),
        language = COALESCE(EXCLUDED.language, tv_series.language),
        first_air_date = COALESCE(EXCLUDED.first_air_date, tv_series.first_air_date),
        last_air_date = COALESCE(EXCLUDED.last_air_date, tv_series.last_air_date),
        image_url = COALESCE(EXCLUDED.image_url, tv_series.image_url),
        external_ids = COALESCE(tv_series.external_ids, '{}'::jsonb) || EXCLUDED.external_ids,
        updated_at = NOW()
      RETURNING *
    `, [
      series.title,
      series.overview || null,
      series.status || null,
      series.network || null,
      series.genres || [],
      series.language || null,
      series.firstAirDate || null,
      series.lastAirDate || null,
      series.imageUrl || null,
      JSON.stringify(series.externalIds || {})
    ]);

    return result.rows[0];
  }

  private async upsertSeasons(seriesId: string, seasons: any[]) {
    for (const season of seasons) {
      await this.pool.query(`
        INSERT INTO tv_seasons (
          series_id, season_number, title, overview, air_date, episode_count, image_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (series_id, season_number) DO UPDATE SET
          title = COALESCE(EXCLUDED.title, tv_seasons.title),
          overview = COALESCE(EXCLUDED.overview, tv_seasons.overview),
          air_date = COALESCE(EXCLUDED.air_date, tv_seasons.air_date),
          episode_count = COALESCE(EXCLUDED.episode_count, tv_seasons.episode_count),
          image_url = COALESCE(EXCLUDED.image_url, tv_seasons.image_url),
          updated_at = NOW()
      `, [seriesId, season.seasonNumber, season.title || `Season ${season.seasonNumber}`, season.overview || null, season.airDate || null, season.episodeCount || null, season.imageUrl || null]);
    }
  }

  private async upsertEpisodes(seriesId: string, seasons: any[], episodes: any[]) {
    const seasonMap = new Map<number, any>();
    seasons.forEach((season: any) => seasonMap.set(season.seasonNumber, season));

    const seasonRecords = await this.pool.query('SELECT id, season_number FROM tv_seasons WHERE series_id = $1', [seriesId]);
    const seasonIdMap = new Map<number, string>();
    for (const row of seasonRecords.rows) {
      seasonIdMap.set(row.season_number, row.id);
    }

    for (const episode of episodes) {
      const seasonId = seasonIdMap.get(episode.seasonNumber) || null;
      await this.pool.query(`
        INSERT INTO tv_episodes (
          series_id, season_id, season_number, episode_number, title, overview, air_date,
          runtime_minutes, rating, image_url, external_ids, cast
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (series_id, season_number, episode_number) DO UPDATE SET
          title = COALESCE(EXCLUDED.title, tv_episodes.title),
          overview = COALESCE(EXCLUDED.overview, tv_episodes.overview),
          air_date = COALESCE(EXCLUDED.air_date, tv_episodes.air_date),
          runtime_minutes = COALESCE(EXCLUDED.runtime_minutes, tv_episodes.runtime_minutes),
          rating = COALESCE(EXCLUDED.rating, tv_episodes.rating),
          image_url = COALESCE(EXCLUDED.image_url, tv_episodes.image_url),
          external_ids = COALESCE(tv_episodes.external_ids, '{}'::jsonb) || EXCLUDED.external_ids,
          cast = COALESCE(EXCLUDED.cast, tv_episodes.cast),
          updated_at = NOW()
      `, [
        seriesId,
        seasonId,
        episode.seasonNumber,
        episode.episodeNumber,
        episode.title,
        episode.overview || null,
        episode.airDate || null,
        episode.runtimeMinutes || null,
        episode.rating || null,
        episode.imageUrl || null,
        JSON.stringify(episode.externalIds || {}),
        JSON.stringify(episode.cast || [])
      ]);
    }
  }

  private async fetchEpisodeMap(seriesId: string) {
    const result = await this.pool.query(
      `SELECT e.*, s.title as series_title
       FROM tv_episodes e
       JOIN tv_series s ON e.series_id = s.id
       WHERE e.series_id = $1
       ORDER BY e.season_number, e.episode_number`,
      [seriesId]
    );
    const map = new Map<string, any>();
    for (const row of result.rows) {
      map.set(`${row.season_number}:${row.episode_number}`, row);
    }
    return map;
  }

  private matchSubtitleVariants(request: TVIngestRequest, seriesId: string, seasonNumber: number, episodeNumber: number, seriesTitle: string) {
    const variants: Array<any> = [];
    const inputs = request.subtitleVariants || [];

    for (const input of inputs) {
      const matchesSeries = (input.seriesId && input.seriesId === seriesId) ||
        (input.seriesTitle && input.seriesTitle.toLowerCase() === seriesTitle.toLowerCase());
      if (!matchesSeries) continue;
      if (input.seasonNumber !== seasonNumber || input.episodeNumber !== episodeNumber) continue;

      for (const variant of input.variants) {
        variants.push({
          url: variant.url,
          sourceName: variant.sourceName,
          provider: variant.provider || 'direct',
          reliabilityWeight: variant.reliabilityWeight ?? 0.6,
          format: variant.format || 'auto',
          notes: variant.notes
        });
      }
    }

    return variants;
  }

  private async insertVariant(episodeId: string, variant: any): Promise<TVSubtitleVariant> {
    const result = await this.pool.query(`
      INSERT INTO tv_episode_subtitle_variants (
        episode_id, source_name, provider, url, language, format, reliability_weight, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      episodeId,
      variant.sourceName,
      variant.provider,
      variant.url || null,
      variant.language || 'en',
      variant.format || null,
      variant.reliabilityWeight ?? 0.6,
      JSON.stringify({ notes: variant.notes || null })
    ]);

    return {
      id: result.rows[0].id,
      episodeId,
      sourceName: result.rows[0].source_name,
      provider: result.rows[0].provider,
      url: result.rows[0].url,
      language: result.rows[0].language,
      format: result.rows[0].format,
      reliabilityWeight: result.rows[0].reliability_weight,
      metadata: result.rows[0].metadata
    };
  }

  private async storeVariantSegments(variantId: string, segments: SubtitleSegment[]) {
    for (const segment of segments) {
      await this.pool.query(`
        INSERT INTO tv_episode_subtitle_segments (
          variant_id, start_ms, end_ms, text
        ) VALUES ($1,$2,$3,$4)
      `, [variantId, segment.startMs, segment.endMs, segment.text]);
    }
  }

  private async storeCanonicalTranscript(episodeId: string, consensus: ConsensusResult, language: string) {
    await this.pool.query(`
      INSERT INTO tv_episode_transcripts (
        episode_id, transcript_text, language, consensus_score, conflicts, updated_at
      ) VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (episode_id) DO UPDATE SET
        transcript_text = EXCLUDED.transcript_text,
        language = EXCLUDED.language,
        consensus_score = EXCLUDED.consensus_score,
        conflicts = EXCLUDED.conflicts,
        updated_at = NOW()
    `, [episodeId, consensus.transcriptText, language, consensus.overallConfidence, consensus.conflicts]);

    await this.pool.query('DELETE FROM tv_episode_transcript_segments WHERE episode_id = $1', [episodeId]);

    for (const segment of consensus.segments) {
      await this.pool.query(`
        INSERT INTO tv_episode_transcript_segments (
          episode_id, start_ms, end_ms, text, confidence, conflict, sources
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [episodeId, segment.startMs, segment.endMs, segment.text, segment.confidence, segment.conflict, JSON.stringify(segment.sources)]);
    }

    await this.pool.query(`
      UPDATE tv_episodes
      SET transcript_status = 'available',
          transcript_updated_at = NOW()
      WHERE id = $1
    `, [episodeId]);
  }

  private async indexCanonicalTranscript(episode: any, consensus: ConsensusResult, chunkSize: number, chunkOverlap: number) {
    await this.ensureNlpReady();

    await this.pool.query(`
      DELETE FROM documents
      WHERE document_type = 'tv_transcript_chunk'
        AND attributes->'tv'->>'episode_id' = $1
    `, [episode.id]);

    const chunks = chunkTranscript(consensus.transcriptText, chunkSize, chunkOverlap);
    const totalChunks = chunks.length;

    for (const chunk of chunks) {
      const title = `${episode.title} (Part ${chunk.index + 1}/${totalChunks})`;
      const embedding = await this.generateEmbedding(`${title} ${chunk.text}`);
      const vectorStr = `[${embedding.join(',')}]`;

      const attributes = {
        episode_id: episode.id,
        tv: {
          episode_id: episode.id,
          series_id: episode.series_id,
          series_title: episode.series_title || episode.series_name || null,
          season_number: episode.season_number,
          episode_number: episode.episode_number,
          air_date: episode.air_date,
          consensus_score: consensus.overallConfidence
        }
      };

      const result = await this.pool.query(`
        INSERT INTO documents (
          title, content, url, document_type, attributes, embedding, created_at, updated_at
        ) VALUES ($1, $2, $3, 'tv_transcript_chunk', $4::jsonb, $5::vector, NOW(), NOW())
        RETURNING id
      `, [title, chunk.text, null, JSON.stringify(attributes), vectorStr]);

      const documentId = result.rows[0].id;
      await this.storeMetadata(documentId, episode, consensus.overallConfidence);

      await this.nlp.processAndStore({
        id: documentId,
        title,
        content: chunk.text,
        url: undefined,
        createdAt: new Date(),
        attributes
      });
    }
  }

  private async storeMetadata(documentId: string, episode: any, consensusScore: number) {
    const entries = [
      { key: 'tv_episode_id', value: episode.id, type: 'string' },
      { key: 'tv_episode', value: `${episode.season_number}x${episode.episode_number} ${episode.title}`, type: 'string' },
      { key: 'tv_series', value: episode.series_title || episode.series_name || '', type: 'string' },
      { key: 'tv_season', value: String(episode.season_number), type: 'number' },
      { key: 'tv_episode_number', value: String(episode.episode_number), type: 'number' },
      { key: 'tv_consensus_score', value: String(consensusScore), type: 'number' }
    ];

    if (episode.air_date) {
      entries.push({ key: 'tv_air_date', value: new Date(episode.air_date).toISOString(), type: 'date' });
    }

    for (const entry of entries) {
      await this.pool.query(`
        INSERT INTO document_metadata (document_id, meta_key, meta_value, meta_type, confidence, extracted_by)
        VALUES ($1, $2, $3, $4, 1.0, 'tv_ingest')
        ON CONFLICT (document_id, meta_key) DO UPDATE SET
          meta_value = EXCLUDED.meta_value,
          meta_type = EXCLUDED.meta_type,
          confidence = EXCLUDED.confidence,
          extracted_by = EXCLUDED.extracted_by,
          updated_at = NOW()
      `, [documentId, entry.key, entry.value, entry.type]);
    }
  }

  private async transcribeAudioFromUrl(audioUrl: string): Promise<string> {
    const response = await fetch(audioUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const tempPath = path.join(os.tmpdir(), `tv-audio-${Date.now()}`);
    const buffer = await response.buffer();
    await fs.writeFile(tempPath, buffer);

    try {
      const scriptPath = process.env.TV_TRANSCRIBE_SCRIPT || `${process.env.HOME}/.openclaw/bin/transcribe-audio.py`;
      const { stdout } = await execFileAsync('python3', [scriptPath, tempPath], {
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 20
      });
      return stdout.trim();
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  private episodeKey(seriesTitle: string, seasonNumber: number, episodeNumber: number) {
    return `${seriesTitle}::S${seasonNumber}E${episodeNumber}`;
  }

  private async completeRun(seriesId: string, status: string) {
    if (!seriesId) return;
    await this.pool.query(`
      INSERT INTO tv_ingest_runs (series_id, status)
      VALUES ($1, $2)
    `, [seriesId, status]);
  }
}
