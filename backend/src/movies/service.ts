import { Pool } from 'pg';
import { NLPProcessor } from '../nlp';
import { chunkTranscript } from '../podcasts/utils';
import { parseSubtitleFromUrl } from '../tv/subtitles';
import { buildConsensusTranscript } from './consensus';
import { MovieMetadataProvider, MovieMetadata, TMDBProvider, OMDBProvider } from './providers';
import {
  ConsensusResult,
  MovieIngestRequest,
  MovieIngestResult,
  MovieRecommendationRequest,
  MovieSearchRequest,
  MovieSubtitleVariant,
  SubtitleSegment
} from './types';
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

export class MovieService {
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
        console.warn('[Movie] NLP training skipped:', err);
      });
    }
    await this.nlpReady;
  }

  async ingest(request: MovieIngestRequest): Promise<MovieIngestResult[]> {
    const results: MovieIngestResult[] = [];
    const providers = this.resolveProviders(request);
    const chunkSize = request.options?.chunkSize ?? 1200;
    const chunkOverlap = request.options?.chunkOverlap ?? 200;
    const region = request.options?.providerRegion || process.env.MOVIE_PROVIDER_REGION || 'US';

    for (const movieInput of request.movies) {
      const result: MovieIngestResult = {
        movieId: '',
        title: movieInput.title || movieInput.imdbId || movieInput.tmdbId || 'Unknown',
        subtitlesProcessed: 0,
        transcriptsCreated: 0,
        transcriptsTranscribed: 0,
        errors: []
      };

      try {
        const metadata = await this.fetchMovieMetadata(providers, movieInput, region);
        if (!metadata) {
          throw new Error(`No metadata found for ${movieInput.title || movieInput.imdbId || 'movie'}`);
        }

        const collectionId = metadata.collection ? await this.upsertCollection(metadata.collection) : null;
        const movieRecord = await this.upsertMovie(metadata, collectionId);
        result.movieId = movieRecord.id;
        result.title = movieRecord.title;

        await this.upsertGenres(movieRecord.id, metadata.genres || []);
        await this.upsertCast(movieRecord.id, metadata.cast || []);
        await this.upsertCrew(movieRecord.id, metadata.crew || []);
        await this.upsertProviders(movieRecord.id, metadata.providers || []);

        const variantInput = this.matchSubtitleVariants(request, movieRecord.id, movieRecord.title);
        const variants: MovieSubtitleVariant[] = [];
        const segmentsByVariant = new Map<string, SubtitleSegment[]>();

        for (const variant of variantInput) {
          const variantRecord = await this.insertVariant(movieRecord.id, variant);
          const segments = await parseSubtitleFromUrl(variant.url, variant.format || 'auto');
          await this.storeVariantSegments(variantRecord.id, segments);
          variants.push(variantRecord);
          segmentsByVariant.set(variantRecord.id, segments);
          result.subtitlesProcessed += 1;
        }

        if (!variants.length && request.transcribeMissing) {
          const audioUrl = request.audioUrlByMovie?.[this.movieKey(movieRecord.title, movieRecord.release_date)];
          if (audioUrl) {
            const transcript = await this.transcribeAudioFromUrl(audioUrl);
            const variantRecord = await this.insertVariant(movieRecord.id, {
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

        if (variants.length) {
          const consensus = buildConsensusTranscript(variants, segmentsByVariant, {
            windowMs: request.options?.consensusWindowMs,
            conflictThreshold: request.options?.conflictThreshold,
            similarityThreshold: request.options?.similarityThreshold,
            minSegmentConfidence: request.options?.minSegmentConfidence
          });

          await this.storeCanonicalTranscript(movieRecord.id, consensus, request.language || 'en');
          await this.indexCanonicalTranscript(movieRecord, metadata, consensus, chunkSize, chunkOverlap);
          result.transcriptsCreated += 1;
        }

        await this.completeRun(movieRecord.id, 'completed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(message);
        await this.completeRun(result.movieId, 'failed');
      }

      results.push(result);
    }

    return results;
  }

  async getBrowse(movieId?: string) {
    if (!movieId) {
      const movies = await this.pool.query(`
        SELECT m.*, c.name as collection_name
        FROM movies m
        LEFT JOIN movie_collections c ON m.collection_id = c.id
        ORDER BY m.title
      `);
      return { movies: movies.rows };
    }

    const movieResult = await this.pool.query(`
      SELECT m.*, c.name as collection_name
      FROM movies m
      LEFT JOIN movie_collections c ON m.collection_id = c.id
      WHERE m.id = $1
    `, [movieId]);

    const genresResult = await this.pool.query(`
      SELECT g.*
      FROM movie_genres g
      JOIN movie_genre_links l ON l.genre_id = g.id
      WHERE l.movie_id = $1
      ORDER BY g.name
    `, [movieId]);

    const castResult = await this.pool.query(`
      SELECT p.*, c.character_name, c.billing_order
      FROM movie_cast c
      JOIN movie_people p ON p.id = c.person_id
      WHERE c.movie_id = $1
      ORDER BY c.billing_order NULLS LAST, p.name
    `, [movieId]);

    const crewResult = await this.pool.query(`
      SELECT p.*, c.job, c.department
      FROM movie_crew c
      JOIN movie_people p ON p.id = c.person_id
      WHERE c.movie_id = $1
      ORDER BY c.department NULLS LAST, c.job NULLS LAST, p.name
    `, [movieId]);

    const providerResult = await this.pool.query(
      'SELECT * FROM movie_providers WHERE movie_id = $1 ORDER BY provider_type, provider_name',
      [movieId]
    );

    return {
      movie: movieResult.rows[0] || null,
      genres: genresResult.rows,
      cast: castResult.rows,
      crew: crewResult.rows,
      providers: providerResult.rows
    };
  }

  async getTranscriptDetails(movieId: string) {
    const transcriptResult = await this.pool.query(
      'SELECT * FROM movie_transcripts WHERE movie_id = $1',
      [movieId]
    );
    const segmentsResult = await this.pool.query(
      'SELECT * FROM movie_transcript_segments WHERE movie_id = $1 ORDER BY start_ms',
      [movieId]
    );
    const variantsResult = await this.pool.query(
      'SELECT * FROM movie_subtitle_variants WHERE movie_id = $1 ORDER BY created_at',
      [movieId]
    );

    const variantIds = variantsResult.rows.map((row: any) => row.id);
    const variantSegmentsResult = variantIds.length
      ? await this.pool.query(
          'SELECT * FROM movie_subtitle_segments WHERE variant_id = ANY($1) ORDER BY start_ms',
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
    const genreResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'movie_transcript_chunk'
        AND dm.meta_key = 'movie_genre'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const collectionResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'movie_transcript_chunk'
        AND dm.meta_key = 'movie_collection'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const providerResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'movie_transcript_chunk'
        AND dm.meta_key = 'movie_provider'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const releaseYearResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'movie_transcript_chunk'
        AND dm.meta_key = 'movie_release_year'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const tagResult = await this.pool.query(`
      SELECT dt.tag as value, COUNT(*) as count
      FROM document_tags dt
      JOIN documents d ON dt.document_id = d.id
      WHERE d.document_type = 'movie_transcript_chunk'
      GROUP BY dt.tag
      ORDER BY count DESC
      LIMIT 40
    `);

    const entityResult = await this.pool.query(`
      SELECT de.entity_type, COALESCE(de.normalized_value, de.entity_value) as value, COUNT(DISTINCT de.document_id) as count
      FROM document_entities de
      JOIN documents d ON de.document_id = d.id
      WHERE d.document_type = 'movie_transcript_chunk'
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
      genres: genreResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      collections: collectionResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      providers: providerResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      releaseYears: releaseYearResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      tags: tagResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      entities: entityTypes
    };
  }

  async search(request: MovieSearchRequest) {
    const limit = request.limit ?? 10;
    const mode = request.mode || 'hybrid';
    const query = request.query;

    const embedding = await this.generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    const filters: Array<{ clause: string; value: any }> = [];

    if (request.filters?.movieId) {
      filters.push({ clause: "attributes->'movie'->>'movie_id' = $IDX", value: request.filters.movieId });
    }
    if (request.filters?.title) {
      filters.push({ clause: "attributes->'movie'->>'title' = $IDX", value: request.filters.title });
    }
    if (request.filters?.genre) {
      filters.push({ clause: "attributes->'movie'->'genres' ? $IDX", value: request.filters.genre });
    }
    if (request.filters?.collection) {
      filters.push({ clause: "attributes->'movie'->>'collection' = $IDX", value: request.filters.collection });
    }
    if (request.filters?.releaseYear) {
      filters.push({ clause: "attributes->'movie'->>'release_year' = $IDX", value: String(request.filters.releaseYear) });
    }
    if (request.filters?.provider) {
      filters.push({ clause: "attributes->'movie'->'providers' ? $IDX", value: request.filters.provider });
    }
    if (request.filters?.cast) {
      filters.push({ clause: "attributes->'movie'->'cast' ? $IDX", value: request.filters.cast });
    }

    const buildWhere = (offset: number, alias?: string) => {
      const clauses = [`${alias ? alias + '.' : ''}document_type = 'movie_transcript_chunk'`];
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

  async recommend(request: MovieRecommendationRequest) {
    const limit = request.limit ?? 10;
    const profile = request.profile;

    const keywords = [...(profile.keywords || []), ...(profile.topics || [])];
    const entities = [...(profile.entities || []), ...(profile.cast || [])];

    const profileText = [...keywords, ...entities, ...(profile.movies || [])].join(' ');
    if (!profileText) {
      throw new Error('Profile must include keywords, topics, entities, cast, or movies');
    }

    const embedding = await this.generateEmbedding(profileText);
    const vectorStr = `[${embedding.join(',')}]`;

    const maxDocs = Math.max(50, limit * 5);

    const docsResult = await this.pool.query(`
      WITH vector_docs AS (
        SELECT id, title, content, url, attributes,
               1 - (embedding <=> $1::vector) as vscore
        FROM documents
        WHERE document_type = 'movie_transcript_chunk'
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

    const movieScores: Record<string, { score: number; movieId: string; payload: any }> = {};

    for (const row of docRows) {
      const attributes = row.attributes || {};
      const movieId = attributes?.movie?.movie_id;
      if (!movieId) continue;

      const score = parseFloat(row.vscore) + row.tag_matches * 0.05 + row.entity_matches * 0.05;
      if (!movieScores[movieId] || score > movieScores[movieId].score) {
        movieScores[movieId] = { score, movieId, payload: attributes?.movie };
      }
    }

    const movieIds = Object.keys(movieScores).slice(0, limit * 3);
    if (!movieIds.length) return [];

    const movieResult = await this.pool.query(
      'SELECT m.*, c.name as collection_name FROM movies m LEFT JOIN movie_collections c ON m.collection_id = c.id WHERE m.id = ANY($1)',
      [movieIds]
    );

    const movies = movieResult.rows.map((row: any) => ({
      movieId: row.id,
      title: row.title,
      releaseDate: row.release_date,
      runtimeMinutes: row.runtime_minutes,
      rating: row.rating,
      collection: row.collection_name,
      overview: row.overview,
      score: movieScores[row.id]?.score || 0
    }));

    movies.sort((a: any, b: any) => b.score - a.score);
    return movies.slice(0, limit);
  }

  private resolveProviders(request: MovieIngestRequest): MovieMetadataProvider[] {
    const providers: MovieMetadataProvider[] = [];
    const preference = request.options?.providerPreference || [];
    const hasTMDB = Boolean(process.env.MOVIE_TMDB_API_KEY || process.env.TMDB_API_KEY);
    const hasOMDB = Boolean(process.env.MOVIE_OMDB_API_KEY || process.env.OMDB_API_KEY);

    const tmdb = new TMDBProvider();
    const omdb = new OMDBProvider();

    const pushIf = (provider: MovieMetadataProvider, condition: boolean) => {
      if (condition && !providers.find(p => p.name === provider.name)) providers.push(provider);
    };

    if (preference.length) {
      for (const pref of preference) {
        if (pref === 'tmdb') pushIf(tmdb, hasTMDB);
        if (pref === 'omdb') pushIf(omdb, hasOMDB);
      }
    }

    if (hasTMDB) pushIf(tmdb, true);
    if (hasOMDB) pushIf(omdb, true);

    return providers;
  }

  private async fetchMovieMetadata(providers: MovieMetadataProvider[], identifier: any, region: string): Promise<MovieMetadata | null> {
    for (const provider of providers) {
      const movie = await provider.fetchMovie(identifier, region);
      if (movie) {
        movie.externalIds = { ...identifier.externalIds, ...movie.externalIds };
        return movie;
      }
    }
    return null;
  }

  private async upsertCollection(collection: any) {
    const result = await this.pool.query(`
      INSERT INTO movie_collections (name, overview, image_url, external_ids)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (name) DO UPDATE SET
        overview = COALESCE(EXCLUDED.overview, movie_collections.overview),
        image_url = COALESCE(EXCLUDED.image_url, movie_collections.image_url),
        external_ids = COALESCE(movie_collections.external_ids, '{}'::jsonb) || EXCLUDED.external_ids,
        updated_at = NOW()
      RETURNING *
    `, [collection.name, collection.overview || null, collection.imageUrl || null, JSON.stringify(collection.externalIds || {})]);

    return result.rows[0].id;
  }

  private async upsertMovie(movie: MovieMetadata, collectionId: string | null) {
    const result = await this.pool.query(`
      INSERT INTO movies (
        title, overview, status, release_date, runtime_minutes, rating, language, image_url, collection_id, external_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (title, release_date) DO UPDATE SET
        overview = COALESCE(EXCLUDED.overview, movies.overview),
        status = COALESCE(EXCLUDED.status, movies.status),
        runtime_minutes = COALESCE(EXCLUDED.runtime_minutes, movies.runtime_minutes),
        rating = COALESCE(EXCLUDED.rating, movies.rating),
        language = COALESCE(EXCLUDED.language, movies.language),
        image_url = COALESCE(EXCLUDED.image_url, movies.image_url),
        collection_id = COALESCE(EXCLUDED.collection_id, movies.collection_id),
        external_ids = COALESCE(movies.external_ids, '{}'::jsonb) || EXCLUDED.external_ids,
        updated_at = NOW()
      RETURNING *
    `, [
      movie.title,
      movie.overview || null,
      movie.status || null,
      movie.releaseDate || null,
      movie.runtimeMinutes || null,
      movie.rating || null,
      movie.language || null,
      movie.imageUrl || null,
      collectionId,
      JSON.stringify(movie.externalIds || {})
    ]);

    return result.rows[0];
  }

  private async upsertGenres(movieId: string, genres: any[]) {
    await this.pool.query('DELETE FROM movie_genre_links WHERE movie_id = $1', [movieId]);

    for (const genre of genres) {
      const result = await this.pool.query(`
        INSERT INTO movie_genres (name, external_ids)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET
          external_ids = COALESCE(movie_genres.external_ids, '{}'::jsonb) || EXCLUDED.external_ids,
          updated_at = NOW()
        RETURNING *
      `, [genre.name, JSON.stringify(genre.externalIds || {})]);

      await this.pool.query(
        'INSERT INTO movie_genre_links (movie_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [movieId, result.rows[0].id]
      );
    }
  }

  private async upsertCast(movieId: string, cast: any[]) {
    await this.pool.query('DELETE FROM movie_cast WHERE movie_id = $1', [movieId]);

    for (const member of cast) {
      const person = await this.upsertPerson(member.name, member.externalIds || {});
      await this.pool.query(`
        INSERT INTO movie_cast (movie_id, person_id, character_name, billing_order)
        VALUES ($1,$2,$3,$4)
      `, [movieId, person.id, member.character || null, member.order ?? null]);
    }
  }

  private async upsertCrew(movieId: string, crew: any[]) {
    await this.pool.query('DELETE FROM movie_crew WHERE movie_id = $1', [movieId]);

    for (const member of crew) {
      const person = await this.upsertPerson(member.name, member.externalIds || {});
      await this.pool.query(`
        INSERT INTO movie_crew (movie_id, person_id, job, department)
        VALUES ($1,$2,$3,$4)
      `, [movieId, person.id, member.job || null, member.department || null]);
    }
  }

  private async upsertProviders(movieId: string, providers: any[]) {
    await this.pool.query('DELETE FROM movie_providers WHERE movie_id = $1', [movieId]);

    for (const provider of providers) {
      await this.pool.query(`
        INSERT INTO movie_providers (
          movie_id, provider_name, provider_type, region, provider_id, link, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        movieId,
        provider.name,
        provider.type,
        provider.region || null,
        provider.providerId || null,
        provider.link || null,
        JSON.stringify(provider.metadata || {})
      ]);
    }
  }

  private async upsertPerson(name: string, externalIds: Record<string, string>) {
    const result = await this.pool.query(`
      INSERT INTO movie_people (name, external_ids)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET
        external_ids = COALESCE(movie_people.external_ids, '{}'::jsonb) || EXCLUDED.external_ids,
        updated_at = NOW()
      RETURNING *
    `, [name, JSON.stringify(externalIds || {})]);

    return result.rows[0];
  }

  private matchSubtitleVariants(request: MovieIngestRequest, movieId: string, title: string) {
    const variants: Array<any> = [];
    const inputs = request.subtitleVariants || [];

    for (const input of inputs) {
      const matchesMovie = (input.movieId && input.movieId === movieId) ||
        (input.movieTitle && input.movieTitle.toLowerCase() === title.toLowerCase());
      if (!matchesMovie) continue;

      for (const variant of input.variants) {
        variants.push({
          url: variant.url,
          sourceName: variant.sourceName,
          provider: variant.provider || 'direct',
          reliabilityWeight: variant.reliabilityWeight ?? 0.6,
          format: variant.format || 'auto',
          language: input.language || request.language || 'en',
          notes: variant.notes,
          provenance: variant.provenance
        });
      }
    }

    return variants;
  }

  private async insertVariant(movieId: string, variant: any): Promise<MovieSubtitleVariant> {
    const result = await this.pool.query(`
      INSERT INTO movie_subtitle_variants (
        movie_id, source_name, provider, url, language, format, reliability_weight, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      movieId,
      variant.sourceName,
      variant.provider,
      variant.url || null,
      variant.language || 'en',
      variant.format || null,
      variant.reliabilityWeight ?? 0.6,
      JSON.stringify({ notes: variant.notes || null, provenance: variant.provenance || null })
    ]);

    return {
      id: result.rows[0].id,
      movieId,
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
        INSERT INTO movie_subtitle_segments (
          variant_id, start_ms, end_ms, text
        ) VALUES ($1,$2,$3,$4)
      `, [variantId, segment.startMs, segment.endMs, segment.text]);
    }
  }

  private async storeCanonicalTranscript(movieId: string, consensus: ConsensusResult, language: string) {
    await this.pool.query(`
      INSERT INTO movie_transcripts (
        movie_id, transcript_text, language, consensus_score, conflicts, updated_at
      ) VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (movie_id) DO UPDATE SET
        transcript_text = EXCLUDED.transcript_text,
        language = EXCLUDED.language,
        consensus_score = EXCLUDED.consensus_score,
        conflicts = EXCLUDED.conflicts,
        updated_at = NOW()
    `, [movieId, consensus.transcriptText, language, consensus.overallConfidence, consensus.conflicts]);

    await this.pool.query('DELETE FROM movie_transcript_segments WHERE movie_id = $1', [movieId]);

    for (const segment of consensus.segments) {
      await this.pool.query(`
        INSERT INTO movie_transcript_segments (
          movie_id, start_ms, end_ms, text, confidence, conflict, sources
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [movieId, segment.startMs, segment.endMs, segment.text, segment.confidence, segment.conflict, JSON.stringify(segment.sources)]);
    }
  }

  private async indexCanonicalTranscript(movieRecord: any, metadata: MovieMetadata, consensus: ConsensusResult, chunkSize: number, chunkOverlap: number) {
    await this.ensureNlpReady();

    await this.pool.query(`
      DELETE FROM documents
      WHERE document_type = 'movie_transcript_chunk'
        AND attributes->'movie'->>'movie_id' = $1
    `, [movieRecord.id]);

    const chunks = chunkTranscript(consensus.transcriptText, chunkSize, chunkOverlap);
    const totalChunks = chunks.length;

    const genres = (metadata.genres || []).map(g => g.name);
    const cast = (metadata.cast || []).map(c => c.name).slice(0, 15);
    const providers = (metadata.providers || []).map(p => p.name);
    const releaseYear = movieRecord.release_date ? new Date(movieRecord.release_date).getFullYear() : null;

    for (const chunk of chunks) {
      const title = `${movieRecord.title} (Part ${chunk.index + 1}/${totalChunks})`;
      const embedding = await this.generateEmbedding(`${title} ${chunk.text}`);
      const vectorStr = `[${embedding.join(',')}]`;

      const attributes = {
        movie_id: movieRecord.id,
        movie: {
          movie_id: movieRecord.id,
          title: movieRecord.title,
          release_date: movieRecord.release_date,
          release_year: releaseYear ? String(releaseYear) : null,
          runtime_minutes: movieRecord.runtime_minutes,
          rating: movieRecord.rating,
          language: movieRecord.language,
          collection: metadata.collection?.name || null,
          genres,
          cast,
          providers,
          consensus_score: consensus.overallConfidence
        }
      };

      const result = await this.pool.query(`
        INSERT INTO documents (
          title, content, url, document_type, attributes, embedding, created_at, updated_at
        ) VALUES ($1, $2, $3, 'movie_transcript_chunk', $4::jsonb, $5::vector, NOW(), NOW())
        RETURNING id
      `, [title, chunk.text, null, JSON.stringify(attributes), vectorStr]);

      const documentId = result.rows[0].id;
      await this.storeMetadata(documentId, movieRecord, metadata, releaseYear, consensus.overallConfidence);

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

  private async storeMetadata(documentId: string, movie: any, metadata: MovieMetadata, releaseYear: number | null, consensusScore: number) {
    const entries = [
      { key: 'movie_id', value: movie.id, type: 'string' },
      { key: 'movie_title', value: movie.title, type: 'string' },
      { key: 'movie_consensus_score', value: String(consensusScore), type: 'number' }
    ];

    if (releaseYear) {
      entries.push({ key: 'movie_release_year', value: String(releaseYear), type: 'number' });
    }

    if (metadata.collection?.name) {
      entries.push({ key: 'movie_collection', value: metadata.collection.name, type: 'string' });
    }

    if (metadata.language) {
      entries.push({ key: 'movie_language', value: metadata.language, type: 'string' });
    }

    (metadata.genres || []).forEach(genre => {
      entries.push({ key: 'movie_genre', value: genre.name, type: 'string' });
    });

    (metadata.cast || []).slice(0, 20).forEach(member => {
      entries.push({ key: 'movie_cast', value: member.name, type: 'string' });
    });

    (metadata.providers || []).forEach(provider => {
      entries.push({ key: 'movie_provider', value: provider.name, type: 'string' });
    });

    for (const entry of entries) {
      await this.pool.query(`
        INSERT INTO document_metadata (document_id, meta_key, meta_value, meta_type, confidence, extracted_by)
        VALUES ($1, $2, $3, $4, 1.0, 'movie_ingest')
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

    const tempPath = path.join(os.tmpdir(), `movie-audio-${Date.now()}`);
    const buffer = await response.buffer();
    await fs.writeFile(tempPath, buffer);

    try {
      const scriptPath = process.env.MOVIE_TRANSCRIBE_SCRIPT || process.env.TV_TRANSCRIBE_SCRIPT || `${process.env.HOME}/.openclaw/bin/transcribe-audio.py`;
      const { stdout } = await execFileAsync('python3', [scriptPath, tempPath], {
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 20
      });
      return stdout.trim();
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  private movieKey(title: string, releaseDate: string | null) {
    return `${title}::${releaseDate || 'unknown'}`;
  }

  private async completeRun(movieId: string, status: string) {
    if (!movieId) return;
    await this.pool.query(
      'INSERT INTO movie_ingest_runs (movie_id, status) VALUES ($1, $2)',
      [movieId, status]
    );
  }
}
