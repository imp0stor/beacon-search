import { Pool } from 'pg';
import { MediaRecommendationRequest, MediaSearchRequest, MediaType } from './types';

const DOC_TYPE_MAP: Record<MediaType, string> = {
  podcast: 'podcast_transcript_chunk',
  tv: 'tv_transcript_chunk',
  movie: 'movie_transcript_chunk'
};

export class MediaService {
  private pool: Pool;
  private generateEmbedding: (text: string) => Promise<number[]>;

  constructor(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.generateEmbedding = generateEmbedding;
  }

  async getBrowse() {
    const movieCount = await this.pool.query('SELECT COUNT(*) FROM movies');
    const tvCount = await this.pool.query('SELECT COUNT(*) FROM tv_series');
    const podcastCount = await this.pool.query('SELECT COUNT(*) FROM podcast_sources');

    const sampleMovies = await this.pool.query('SELECT id, title, release_date FROM movies ORDER BY release_date DESC NULLS LAST LIMIT 5');
    const sampleSeries = await this.pool.query('SELECT id, title, first_air_date FROM tv_series ORDER BY first_air_date DESC NULLS LAST LIMIT 5');
    const samplePodcasts = await this.pool.query('SELECT id, title, rss_url FROM podcast_sources ORDER BY created_at DESC LIMIT 5');

    return {
      counts: {
        movies: parseInt(movieCount.rows[0].count, 10),
        tvSeries: parseInt(tvCount.rows[0].count, 10),
        podcastSources: parseInt(podcastCount.rows[0].count, 10)
      },
      samples: {
        movies: sampleMovies.rows,
        tvSeries: sampleSeries.rows,
        podcastSources: samplePodcasts.rows
      }
    };
  }

  async getFacets(types: MediaType[] = ['podcast', 'tv', 'movie']) {
    const docTypes = types.map(type => DOC_TYPE_MAP[type]);

    const typeResult = await this.pool.query(`
      SELECT document_type as value, COUNT(*) as count
      FROM documents
      WHERE document_type = ANY($1)
      GROUP BY document_type
      ORDER BY count DESC
    `, [docTypes]);

    const tagResult = await this.pool.query(`
      SELECT dt.tag as value, COUNT(*) as count
      FROM document_tags dt
      JOIN documents d ON dt.document_id = d.id
      WHERE d.document_type = ANY($1)
      GROUP BY dt.tag
      ORDER BY count DESC
      LIMIT 40
    `, [docTypes]);

    const entityResult = await this.pool.query(`
      SELECT de.entity_type, COALESCE(de.normalized_value, de.entity_value) as value, COUNT(DISTINCT de.document_id) as count
      FROM document_entities de
      JOIN documents d ON de.document_id = d.id
      WHERE d.document_type = ANY($1)
        AND de.entity_type IN ('PERSON', 'ORGANIZATION', 'LOCATION')
      GROUP BY de.entity_type, COALESCE(de.normalized_value, de.entity_value)
      ORDER BY count DESC
      LIMIT 60
    `, [docTypes]);

    const entityTypes: Record<string, { value: string; count: number }[]> = {};
    for (const row of entityResult.rows) {
      if (!entityTypes[row.entity_type]) entityTypes[row.entity_type] = [];
      entityTypes[row.entity_type].push({ value: row.value, count: parseInt(row.count, 10) });
    }

    return {
      types: typeResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      tags: tagResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      entities: entityTypes
    };
  }

  async search(request: MediaSearchRequest) {
    const limit = request.limit ?? 10;
    const mode = request.mode || 'hybrid';
    const query = request.query;
    const types = request.types || ['podcast', 'tv', 'movie'];
    const docTypes = types.map(type => DOC_TYPE_MAP[type]);

    const embedding = await this.generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;

    let queryText = '';
    let params: any[] = [];

    if (mode === 'vector') {
      params = [vectorStr, docTypes, limit];
      queryText = `
        SELECT id, title, content, url, attributes, document_type, 1 - (embedding <=> $1::vector) as score
        FROM documents
        WHERE document_type = ANY($2)
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
    } else if (mode === 'text') {
      params = [query, docTypes, limit];
      queryText = `
        SELECT id, title, content, url, attributes, document_type,
          ts_rank(to_tsvector('english', content || ' ' || title), plainto_tsquery('english', $1)) as score
        FROM documents
        WHERE document_type = ANY($2)
          AND to_tsvector('english', content || ' ' || title) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $3
      `;
    } else {
      params = [vectorStr, query, docTypes, limit];
      queryText = `
        WITH vector_scores AS (
          SELECT id, 1 - (embedding <=> $1::vector) as vscore
          FROM documents
          WHERE document_type = ANY($3)
        ),
        text_scores AS (
          SELECT id, ts_rank(to_tsvector('english', content || ' ' || title), plainto_tsquery('english', $2)) as tscore
          FROM documents
          WHERE document_type = ANY($3)
        )
        SELECT d.id, d.title, d.content, d.url, d.attributes, d.document_type,
          COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
        FROM documents d
        LEFT JOIN vector_scores v ON d.id = v.id
        LEFT JOIN text_scores t ON d.id = t.id
        WHERE d.id IN (SELECT id FROM vector_scores UNION SELECT id FROM text_scores)
        ORDER BY score DESC
        LIMIT $4
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

  async recommend(request: MediaRecommendationRequest) {
    const limit = request.limit ?? 10;
    const types = request.types || ['podcast', 'tv', 'movie'];
    const docTypes = types.map(type => DOC_TYPE_MAP[type]);
    const profile = request.profile;

    const keywords = [...(profile.keywords || []), ...(profile.topics || [])];
    const entities = [...(profile.entities || []), ...(profile.cast || [])];

    const profileText = [...keywords, ...entities, ...(profile.series || []), ...(profile.movies || [])].join(' ');
    if (!profileText) {
      throw new Error('Profile must include keywords, topics, entities, cast, series, or movies');
    }

    const embedding = await this.generateEmbedding(profileText);
    const vectorStr = `[${embedding.join(',')}]`;
    const maxDocs = Math.max(60, limit * 6);

    const docsResult = await this.pool.query(`
      WITH vector_docs AS (
        SELECT id, title, content, url, attributes, document_type,
               1 - (embedding <=> $1::vector) as vscore
        FROM documents
        WHERE document_type = ANY($4)
        ORDER BY embedding <=> $1::vector
        LIMIT $5
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
      LIMIT $5
    `, [vectorStr, keywords, entities, docTypes, maxDocs]);

    const docRows = docsResult.rows;
    if (!docRows.length) return [];

    const itemScores: Record<string, { score: number; type: MediaType; payload: any }> = {};

    for (const row of docRows) {
      const attributes = row.attributes || {};
      if (row.document_type === DOC_TYPE_MAP.movie) {
        const movieId = attributes?.movie?.movie_id;
        if (!movieId) continue;
        const score = parseFloat(row.vscore) + row.tag_matches * 0.05 + row.entity_matches * 0.05;
        const key = `movie:${movieId}`;
        if (!itemScores[key] || score > itemScores[key].score) {
          itemScores[key] = { score, type: 'movie', payload: { movieId } };
        }
      }
      if (row.document_type === DOC_TYPE_MAP.tv) {
        const episodeId = attributes?.tv?.episode_id;
        if (!episodeId) continue;
        const score = parseFloat(row.vscore) + row.tag_matches * 0.05 + row.entity_matches * 0.05;
        const key = `tv:${episodeId}`;
        if (!itemScores[key] || score > itemScores[key].score) {
          itemScores[key] = { score, type: 'tv', payload: { episodeId } };
        }
      }
      if (row.document_type === DOC_TYPE_MAP.podcast) {
        const episodeId = attributes?.podcast?.episode_id || attributes?.episode_id;
        if (!episodeId) continue;
        const score = parseFloat(row.vscore) + row.tag_matches * 0.05 + row.entity_matches * 0.05;
        const key = `podcast:${episodeId}`;
        if (!itemScores[key] || score > itemScores[key].score) {
          itemScores[key] = { score, type: 'podcast', payload: { episodeId } };
        }
      }
    }

    const movieIds = Object.values(itemScores).filter(i => i.type === 'movie').map(i => i.payload.movieId);
    const tvIds = Object.values(itemScores).filter(i => i.type === 'tv').map(i => i.payload.episodeId);
    const podcastIds = Object.values(itemScores).filter(i => i.type === 'podcast').map(i => i.payload.episodeId);

    const [movieResult, tvResult, podcastResult] = await Promise.all([
      movieIds.length
        ? this.pool.query('SELECT m.*, c.name as collection_name FROM movies m LEFT JOIN movie_collections c ON m.collection_id = c.id WHERE m.id = ANY($1)', [movieIds])
        : Promise.resolve({ rows: [] }),
      tvIds.length
        ? this.pool.query('SELECT e.*, s.title as series_title FROM tv_episodes e JOIN tv_series s ON e.series_id = s.id WHERE e.id = ANY($1)', [tvIds])
        : Promise.resolve({ rows: [] }),
      podcastIds.length
        ? this.pool.query('SELECT e.*, s.title as source_title FROM podcast_episodes e JOIN podcast_sources s ON e.source_id = s.id WHERE e.id = ANY($1)', [podcastIds])
        : Promise.resolve({ rows: [] })
    ]);

    const recommendations: any[] = [];

    for (const row of movieResult.rows) {
      const key = `movie:${row.id}`;
      recommendations.push({
        type: 'movie',
        movieId: row.id,
        title: row.title,
        releaseDate: row.release_date,
        runtimeMinutes: row.runtime_minutes,
        rating: row.rating,
        collection: row.collection_name,
        overview: row.overview,
        score: itemScores[key]?.score || 0
      });
    }

    for (const row of tvResult.rows) {
      const key = `tv:${row.id}`;
      recommendations.push({
        type: 'tv',
        episodeId: row.id,
        title: row.title,
        seriesTitle: row.series_title,
        seasonNumber: row.season_number,
        episodeNumber: row.episode_number,
        airDate: row.air_date,
        overview: row.overview,
        score: itemScores[key]?.score || 0
      });
    }

    for (const row of podcastResult.rows) {
      const key = `podcast:${row.id}`;
      recommendations.push({
        type: 'podcast',
        episodeId: row.id,
        title: row.title,
        sourceTitle: row.source_title,
        episodeUrl: row.episode_url,
        audioUrl: row.audio_url,
        publishedAt: row.published_at,
        summary: row.summary,
        score: itemScores[key]?.score || 0
      });
    }

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, limit);
  }
}
