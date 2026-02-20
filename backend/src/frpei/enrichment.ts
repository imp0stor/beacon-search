import { Pool } from 'pg';
import { Candidate } from './types';

export async function fetchOntologyTaxonomy(pool: Pool, entityId: string) {
  const taxonomy = await pool.query(
    `SELECT t.name
     FROM ontology_concept_taxonomies ct
     JOIN ontology_taxonomies t ON t.id = ct.taxonomy_id
     WHERE ct.concept_id = $1
     ORDER BY t.name`,
    [entityId]
  );
  return taxonomy.rows.map(row => row.name);
}

export async function fetchOntologySynonyms(pool: Pool, entityId: string) {
  const synonyms = await pool.query(
    `SELECT synonyms
     FROM ontology
     WHERE id = $1`,
    [entityId]
  );
  return synonyms.rows[0]?.synonyms || [];
}

async function getPodcastEnrichment(pool: Pool, candidate: Candidate) {
  if (!candidate.url && !candidate.title) return null;

  const direct = candidate.url
    ? await pool.query(
        `SELECT e.id as episode_id, e.title as episode_title, e.episode_url, e.audio_url, e.published_at,
                s.id as show_id, s.title as show_title, s.rss_url, s.site_url
         FROM podcast_episodes e
         JOIN podcast_sources s ON s.id = e.source_id
         WHERE e.episode_url = $1 OR e.audio_url = $1 OR e.transcript_url = $1
         LIMIT 1`,
        [candidate.url]
      )
    : { rows: [] };

  if (direct.rows.length) {
    return {
      show_id: direct.rows[0].show_id,
      show_title: direct.rows[0].show_title,
      episode_id: direct.rows[0].episode_id,
      episode_title: direct.rows[0].episode_title,
      episode_url: direct.rows[0].episode_url,
      audio_url: direct.rows[0].audio_url,
      published_at: direct.rows[0].published_at,
      rss_url: direct.rows[0].rss_url,
      site_url: direct.rows[0].site_url
    };
  }

  if (candidate.title) {
    const fuzzy = await pool.query(
      `SELECT e.id as episode_id, e.title as episode_title, e.episode_url, e.audio_url, e.published_at,
              s.id as show_id, s.title as show_title, s.rss_url
       FROM podcast_episodes e
       JOIN podcast_sources s ON s.id = e.source_id
       WHERE e.title ILIKE $1
       LIMIT 1`,
      [`%${candidate.title}%`]
    );
    if (fuzzy.rows.length) {
      return {
        show_id: fuzzy.rows[0].show_id,
        show_title: fuzzy.rows[0].show_title,
        episode_id: fuzzy.rows[0].episode_id,
        episode_title: fuzzy.rows[0].episode_title,
        episode_url: fuzzy.rows[0].episode_url,
        audio_url: fuzzy.rows[0].audio_url,
        published_at: fuzzy.rows[0].published_at,
        rss_url: fuzzy.rows[0].rss_url
      };
    }
  }

  return null;
}

async function getTvEnrichment(pool: Pool, candidate: Candidate) {
  if (!candidate.title) return null;
  const episode = await pool.query(
    `SELECT e.id as episode_id, e.title as episode_title, e.season_number, e.episode_number, e.air_date,
            e.cast, s.id as series_id, s.title as series_title, s.network
     FROM tv_episodes e
     JOIN tv_series s ON s.id = e.series_id
     WHERE e.title ILIKE $1
     LIMIT 1`,
    [`%${candidate.title}%`]
  );
  if (episode.rows.length) {
    return {
      series_id: episode.rows[0].series_id,
      series_title: episode.rows[0].series_title,
      episode_id: episode.rows[0].episode_id,
      episode_title: episode.rows[0].episode_title,
      season_number: episode.rows[0].season_number,
      episode_number: episode.rows[0].episode_number,
      air_date: episode.rows[0].air_date,
      network: episode.rows[0].network,
      cast: episode.rows[0].cast
    };
  }

  const series = await pool.query(
    `SELECT id as series_id, title as series_title, network, first_air_date, last_air_date
     FROM tv_series
     WHERE title ILIKE $1
     LIMIT 1`,
    [`%${candidate.title}%`]
  );
  if (series.rows.length) {
    return {
      series_id: series.rows[0].series_id,
      series_title: series.rows[0].series_title,
      network: series.rows[0].network,
      first_air_date: series.rows[0].first_air_date,
      last_air_date: series.rows[0].last_air_date
    };
  }

  return null;
}

async function getMovieEnrichment(pool: Pool, candidate: Candidate) {
  if (!candidate.title) return null;
  const movie = await pool.query(
    `SELECT m.id as movie_id, m.title as movie_title, m.release_date, m.rating, m.runtime_minutes,
            c.name as collection_name
     FROM movies m
     LEFT JOIN movie_collections c ON c.id = m.collection_id
     WHERE m.title ILIKE $1
     LIMIT 1`,
    [`%${candidate.title}%`]
  );
  if (!movie.rows.length) return null;

  const cast = await pool.query(
    `SELECT p.name, mc.character_name
     FROM movie_cast mc
     JOIN movie_people p ON p.id = mc.person_id
     WHERE mc.movie_id = $1
     ORDER BY mc.billing_order ASC
     LIMIT 8`,
    [movie.rows[0].movie_id]
  );

  return {
    movie_id: movie.rows[0].movie_id,
    movie_title: movie.rows[0].movie_title,
    release_date: movie.rows[0].release_date,
    rating: movie.rows[0].rating,
    runtime_minutes: movie.rows[0].runtime_minutes,
    collection: movie.rows[0].collection_name,
    cast: cast.rows
  };
}

export async function enrichCandidate(pool: Pool, candidate: Candidate) {
  const enrichment: Record<string, any> = {};

  if (candidate.entity?.entity_id) {
    const [taxonomy, synonyms] = await Promise.all([
      fetchOntologyTaxonomy(pool, candidate.entity.entity_id),
      fetchOntologySynonyms(pool, candidate.entity.entity_id)
    ]);
    enrichment.topics = Array.from(new Set([...(taxonomy || []), ...(synonyms || [])]));
    enrichment.taxonomy = { beacon: taxonomy };
  }

  const [podcast, tv, movie] = await Promise.all([
    getPodcastEnrichment(pool, candidate),
    getTvEnrichment(pool, candidate),
    getMovieEnrichment(pool, candidate)
  ]);

  enrichment.domain_enrichment = {
    podcast: podcast || undefined,
    tv: tv || undefined,
    movie: movie || undefined
  };

  enrichment.provenance = {
    sources: [candidate.source.provider, candidate.entity?.entity_id ? 'ontology' : undefined].filter(Boolean),
    timestamps: {
      enriched_at: new Date().toISOString()
    }
  };

  const confidence = candidate.entity?.confidence || 0;
  enrichment.confidence = {
    overall: Math.min(1, 0.45 + confidence * 0.55),
    entity_resolution: confidence,
    source_trust: candidate.source.trust_tier
  };

  return enrichment;
}
