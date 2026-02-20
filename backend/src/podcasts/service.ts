import Parser from 'rss-parser';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { NLPProcessor } from '../nlp';
import {
  chunkTranscript,
  extractTranscriptFromUrl,
  extractTranscriptFromHtml,
  downloadAudio,
  transcribeAudio,
  cleanupFile,
  normalizeText,
  fetchHtml
} from './utils';
import {
  PodcastIngestRequest,
  PodcastIngestResult,
  PodcastIngestSource,
  PodcastTranscriptResult,
  PodcastRecommendationRequest
} from './types';
import cheerio from 'cheerio';

interface EpisodePageData {
  title: string;
  audioUrl?: string;
  transcriptText?: string | null;
}

export class PodcastService {
  private pool: Pool;
  private generateEmbedding: (text: string) => Promise<number[]>;
  private parser: Parser;
  private nlp: NLPProcessor;
  private nlpReady: Promise<void> | null = null;

  constructor(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.generateEmbedding = generateEmbedding;
    this.parser = new Parser({
      customFields: {
        feed: ['itunes:category', 'itunes:image', 'image', 'language'],
        item: ['itunes:duration', 'itunes:episode', 'itunes:season', 'podcast:transcript', 'content:encoded', 'enclosure']
      }
    });
    this.nlp = new NLPProcessor(pool);
  }

  private async ensureNlpReady(): Promise<void> {
    if (!this.nlpReady) {
      this.nlpReady = this.nlp.trainOnCorpus().catch(err => {
        console.warn('[Podcast] NLP training skipped:', err);
      });
    }
    await this.nlpReady;
  }

  async ingest(request: PodcastIngestRequest): Promise<PodcastIngestResult[]> {
    const results: PodcastIngestResult[] = [];
    const maxEpisodes = request.maxEpisodes ?? 25;
    const transcribeMissing = request.transcribeMissing ?? true;
    const chunkSize = request.chunkSize ?? 1200;
    const chunkOverlap = request.chunkOverlap ?? 200;
    const forceReindex = request.forceReindex ?? false;
    const maxTranscriptions = request.maxTranscriptions ?? Number.POSITIVE_INFINITY;
    const maxTranscriptionsPerSource = request.maxTranscriptionsPerSource ?? Number.POSITIVE_INFINITY;

    let totalTranscribed = 0;

    for (const source of request.sources) {
      const { sourceRecord, runId } = await this.initializeRun(source);

      let sourceTranscribed = 0;

      const result: PodcastIngestResult = {
        runId,
        sourceId: sourceRecord.id,
        rssUrl: sourceRecord.rss_url,
        title: sourceRecord.title,
        episodesDiscovered: 0,
        episodesUpdated: 0,
        transcriptsCreated: 0,
        transcriptsTranscribed: 0,
        errors: []
      };

      try {
        const feed = await this.parser.parseURL(source.rssUrl);
        const episodes = feed.items.slice(0, maxEpisodes);

        for (const item of episodes) {
          const guid = (item.guid || item.id || item.link || item.title || uuidv4()).toString();
          const title = item.title || 'Untitled Episode';
          const episodeUrl = item.link || undefined;
          const enclosure = (item as any).enclosure;
          const audioUrl = enclosure?.url || (item as any).enclosure?.url || (item as any)['enclosure']?.url || undefined;

          const transcriptUrl = this.resolveTranscriptUrl(item as any, source);
          const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;
          const durationSeconds = this.parseDurationSeconds((item as any)['itunes:duration']);
          const seasonNumber = parseInt((item as any)['itunes:season'] || '', 10) || null;
          const episodeNumber = parseInt((item as any)['itunes:episode'] || '', 10) || null;
          const summary = item.contentSnippet || item.content || (item as any)['content:encoded'] || null;

          const episodeRecord = await this.upsertEpisode({
            sourceId: sourceRecord.id,
            guid,
            title,
            episodeUrl,
            audioUrl,
            publishedAt,
            durationSeconds,
            seasonNumber,
            episodeNumber,
            summary: summary ? normalizeText(summary) : null,
            transcriptUrl
          });

          result.episodesDiscovered += 1;
          result.episodesUpdated += 1;

          const existingTranscript = await this.getTranscriptByEpisode(episodeRecord.id);
          if (existingTranscript && !forceReindex) {
            continue;
          }

          let transcriptText: string | null = null;
          let transcriptSource: 'provided' | 'whisper' = 'provided';

          if (transcriptUrl) {
            transcriptText = await extractTranscriptFromUrl(transcriptUrl);
          }

          if (!transcriptText && (item as any)['content:encoded']) {
            transcriptText = extractTranscriptFromHtml((item as any)['content:encoded']);
          }

          if (!transcriptText && transcribeMissing && audioUrl) {
            if (totalTranscribed < maxTranscriptions && sourceTranscribed < maxTranscriptionsPerSource) {
              transcriptSource = 'whisper';
              const audioPath = await downloadAudio(audioUrl);
              try {
                transcriptText = await transcribeAudio(audioPath);
                result.transcriptsTranscribed += 1;
                totalTranscribed += 1;
                sourceTranscribed += 1;
              } finally {
                await cleanupFile(audioPath);
              }
            }
          }

          if (transcriptText) {
            await this.storeTranscriptAndIndex({
              episodeId: episodeRecord.id,
              transcriptText,
              transcriptSource,
              chunkSize,
              chunkOverlap,
              forceReindex
            });
            result.transcriptsCreated += 1;
          }
        }

        if (source.episodePages && source.episodePages.length > 0) {
          for (const pageUrl of source.episodePages) {
            const pageData = await this.extractEpisodePage(pageUrl);
            const episodeRecord = await this.upsertEpisode({
              sourceId: sourceRecord.id,
              guid: pageUrl,
              title: pageData.title,
              episodeUrl: pageUrl,
              audioUrl: pageData.audioUrl,
              summary: null
            });

            result.episodesDiscovered += 1;
            result.episodesUpdated += 1;

            if (pageData.transcriptText) {
              await this.storeTranscriptAndIndex({
                episodeId: episodeRecord.id,
                transcriptText: pageData.transcriptText,
                transcriptSource: 'provided',
                chunkSize,
                chunkOverlap,
                forceReindex
              });
              result.transcriptsCreated += 1;
            } else if (transcribeMissing && pageData.audioUrl) {
              if (totalTranscribed < maxTranscriptions && sourceTranscribed < maxTranscriptionsPerSource) {
                const audioPath = await downloadAudio(pageData.audioUrl);
                try {
                  const transcript = await transcribeAudio(audioPath);
                  await this.storeTranscriptAndIndex({
                    episodeId: episodeRecord.id,
                    transcriptText: transcript,
                    transcriptSource: 'whisper',
                    chunkSize,
                    chunkOverlap,
                    forceReindex
                  });
                  result.transcriptsCreated += 1;
                  result.transcriptsTranscribed += 1;
                  totalTranscribed += 1;
                  sourceTranscribed += 1;
                } finally {
                  await cleanupFile(audioPath);
                }
              }
            }
          }
        }

        if (source.transcriptPages && source.transcriptPages.length > 0) {
          for (const transcriptUrl of source.transcriptPages) {
            const pageData = await this.extractTranscriptPage(transcriptUrl);
            if (!pageData.transcriptText) continue;

            const episodeRecord = await this.upsertEpisode({
              sourceId: sourceRecord.id,
              guid: transcriptUrl,
              title: pageData.title,
              episodeUrl: transcriptUrl,
              summary: null,
              transcriptUrl
            });

            result.episodesDiscovered += 1;
            result.episodesUpdated += 1;

            await this.storeTranscriptAndIndex({
              episodeId: episodeRecord.id,
              transcriptText: pageData.transcriptText,
              transcriptSource: 'provided',
              chunkSize,
              chunkOverlap,
              forceReindex
            });
            result.transcriptsCreated += 1;
          }
        }

        await this.completeRun(runId, result, 'completed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(message);
        await this.completeRun(runId, result, 'failed');
      }

      results.push(result);
    }

    return results;
  }

  async getIngestRun(runId: string) {
    const result = await this.pool.query('SELECT * FROM podcast_ingest_runs WHERE id = $1', [runId]);
    return result.rows[0] || null;
  }

  async getTranscript(episodeId: string): Promise<PodcastTranscriptResult | null> {
    const result = await this.pool.query(
      'SELECT episode_id, transcript_text, source, updated_at, word_count FROM podcast_transcripts WHERE episode_id = $1',
      [episodeId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      episodeId: row.episode_id,
      transcriptText: row.transcript_text,
      source: row.source,
      updatedAt: row.updated_at,
      wordCount: row.word_count
    };
  }

  async getFacets() {
    const tagResult = await this.pool.query(`
      SELECT dt.tag as value, COUNT(*) as count
      FROM document_tags dt
      JOIN documents d ON dt.document_id = d.id
      WHERE d.document_type = 'podcast_transcript_chunk'
      GROUP BY dt.tag
      ORDER BY count DESC
      LIMIT 30
    `);

    const entityResult = await this.pool.query(`
      SELECT de.entity_type, COALESCE(de.normalized_value, de.entity_value) as value, COUNT(DISTINCT de.document_id) as count
      FROM document_entities de
      JOIN documents d ON de.document_id = d.id
      WHERE d.document_type = 'podcast_transcript_chunk'
        AND de.entity_type IN ('PERSON', 'ORGANIZATION', 'LOCATION')
      GROUP BY de.entity_type, COALESCE(de.normalized_value, de.entity_value)
      ORDER BY count DESC
      LIMIT 60
    `);

    const sourceResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'podcast_transcript_chunk'
        AND dm.meta_key = 'podcast_source'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const seriesResult = await this.pool.query(`
      SELECT meta_value as value, COUNT(*) as count
      FROM document_metadata dm
      JOIN documents d ON dm.document_id = d.id
      WHERE d.document_type = 'podcast_transcript_chunk'
        AND dm.meta_key = 'podcast_series'
      GROUP BY meta_value
      ORDER BY count DESC
    `);

    const entityTypes: Record<string, { value: string; count: number }[]> = {};
    for (const row of entityResult.rows) {
      const type = row.entity_type;
      if (!entityTypes[type]) entityTypes[type] = [];
      entityTypes[type].push({ value: row.value, count: parseInt(row.count, 10) });
    }

    return {
      tags: tagResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      entityTypes,
      sources: sourceResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) })),
      series: seriesResult.rows.map((r: any) => ({ value: r.value, count: parseInt(r.count, 10) }))
    };
  }

  async recommend(request: PodcastRecommendationRequest) {
    const limit = request.limit ?? 10;
    const profile = request.profile;

    const keywords = [...(profile.keywords || []), ...(profile.topics || [])];
    const entities = [...(profile.entities || []), ...(profile.speakers || [])];

    const profileText = [...keywords, ...entities, ...(profile.series || [])].join(' ');
    if (!profileText) {
      throw new Error('Profile must include keywords, topics, entities, or series');
    }

    const embedding = await this.generateEmbedding(profileText);
    const vectorStr = `[${embedding.join(',')}]`;

    const maxDocs = Math.max(50, limit * 5);

    const docsResult = await this.pool.query(`
      WITH vector_docs AS (
        SELECT id, title, content, url, attributes,
               1 - (embedding <=> $1::vector) as vscore
        FROM documents
        WHERE document_type = 'podcast_transcript_chunk'
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
    if (docRows.length === 0) return [];

    const docIds = docRows.map((row: any) => row.id);
    const tagRows = await this.pool.query(`
      SELECT document_id, tag FROM document_tags WHERE document_id = ANY($1)
    `, [docIds]);
    const entityRows = await this.pool.query(`
      SELECT document_id, COALESCE(normalized_value, entity_value) as value FROM document_entities WHERE document_id = ANY($1)
    `, [docIds]);

    const excludedTags = new Set(profile.excludeTopics || []);
    const excludedEntities = new Set(profile.excludeEntities || []);

    const docExcluded = new Set<string>();
    for (const row of tagRows.rows) {
      if (excludedTags.has(row.tag)) {
        docExcluded.add(row.document_id);
      }
    }
    for (const row of entityRows.rows) {
      if (excludedEntities.has(row.value)) {
        docExcluded.add(row.document_id);
      }
    }

    const episodeScores: Record<string, { score: number; sources: any; episodeId: string }> = {};

    for (const row of docRows) {
      if (docExcluded.has(row.id)) continue;

      const attributes = row.attributes || {};
      const episodeId = attributes?.podcast?.episode_id || attributes?.episode_id;
      if (!episodeId) continue;

      const score = parseFloat(row.vscore) + row.tag_matches * 0.05 + row.entity_matches * 0.05;
      if (!episodeScores[episodeId] || score > episodeScores[episodeId].score) {
        episodeScores[episodeId] = { score, sources: attributes?.podcast || attributes, episodeId };
      }
    }

    const episodeIds = Object.keys(episodeScores).slice(0, limit * 3);
    if (episodeIds.length === 0) return [];

    const episodeResult = await this.pool.query(`
      SELECT e.*, s.title as source_title, s.rss_url
      FROM podcast_episodes e
      JOIN podcast_sources s ON e.source_id = s.id
      WHERE e.id = ANY($1)
    `, [episodeIds]);

    const episodes = episodeResult.rows.map((row: any) => ({
      episodeId: row.id,
      title: row.title,
      episodeUrl: row.episode_url,
      audioUrl: row.audio_url,
      publishedAt: row.published_at,
      sourceId: row.source_id,
      sourceTitle: row.source_title,
      rssUrl: row.rss_url,
      summary: row.summary,
      score: episodeScores[row.id]?.score || 0
    }));

    episodes.sort((a, b) => b.score - a.score);
    return episodes.slice(0, limit);
  }

  private resolveTranscriptUrl(item: any, source: PodcastIngestSource): string | undefined {
    const transcript = item['podcast:transcript'];
    const transcriptUrl = transcript?.url || transcript?.href || transcript || item.transcript;

    if (transcriptUrl) return transcriptUrl;

    if (source.transcriptUrlByEpisode) {
      const key = item.guid || item.id || item.link;
      if (key && source.transcriptUrlByEpisode[key]) {
        return source.transcriptUrlByEpisode[key];
      }
    }

    return undefined;
  }

  private parseDurationSeconds(raw?: string): number | null {
    if (!raw) return null;
    const text = raw.toString().trim();
    if (!text) return null;

    if (text.includes(':')) {
      const parts = text.split(':').map(part => parseInt(part, 10));
      if (parts.some(isNaN)) return null;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }

    const asNumber = parseInt(text, 10);
    return isNaN(asNumber) ? null : asNumber;
  }

  private async initializeRun(source: PodcastIngestSource) {
    const feed = await this.parser.parseURL(source.rssUrl);

    const title = source.title || feed.title || source.rssUrl;
    const rssUrl = source.rssUrl;
    const siteUrl = source.siteUrl || feed.link || null;
    const description = feed.description || null;
    const language = (feed as any).language || (feed as any)['language'] || null;
    const imageUrl = (feed as any)['itunes:image']?.href || (feed as any).itunes?.image || (feed as any).image?.url || null;
    const categories = ((feed as any).itunes?.categories || []).map((c: any) => c.name || c) || [];

    const sourceResult = await this.pool.query(`
      INSERT INTO podcast_sources (title, rss_url, site_url, description, language, categories, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (rss_url) DO UPDATE SET
        title = EXCLUDED.title,
        site_url = COALESCE(EXCLUDED.site_url, podcast_sources.site_url),
        description = COALESCE(EXCLUDED.description, podcast_sources.description),
        language = COALESCE(EXCLUDED.language, podcast_sources.language),
        categories = COALESCE(EXCLUDED.categories, podcast_sources.categories),
        image_url = COALESCE(EXCLUDED.image_url, podcast_sources.image_url),
        updated_at = NOW()
      RETURNING *
    `, [title, rssUrl, siteUrl, description, language, categories, imageUrl]);

    const sourceRecord = sourceResult.rows[0];
    const runResult = await this.pool.query(
      'INSERT INTO podcast_ingest_runs (source_id, status) VALUES ($1, $2) RETURNING id',
      [sourceRecord.id, 'running']
    );

    return { sourceRecord, runId: runResult.rows[0].id };
  }

  private async upsertEpisode(data: {
    sourceId: string;
    guid: string;
    title: string;
    episodeUrl?: string;
    audioUrl?: string;
    publishedAt?: Date | null;
    durationSeconds?: number | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    summary?: string | null;
    transcriptUrl?: string;
  }) {
    const result = await this.pool.query(`
      INSERT INTO podcast_episodes (
        source_id, guid, title, episode_url, audio_url, published_at,
        duration_seconds, season_number, episode_number, summary, transcript_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (source_id, guid) DO UPDATE SET
        title = EXCLUDED.title,
        episode_url = COALESCE(EXCLUDED.episode_url, podcast_episodes.episode_url),
        audio_url = COALESCE(EXCLUDED.audio_url, podcast_episodes.audio_url),
        published_at = COALESCE(EXCLUDED.published_at, podcast_episodes.published_at),
        duration_seconds = COALESCE(EXCLUDED.duration_seconds, podcast_episodes.duration_seconds),
        season_number = COALESCE(EXCLUDED.season_number, podcast_episodes.season_number),
        episode_number = COALESCE(EXCLUDED.episode_number, podcast_episodes.episode_number),
        summary = COALESCE(EXCLUDED.summary, podcast_episodes.summary),
        transcript_url = COALESCE(EXCLUDED.transcript_url, podcast_episodes.transcript_url),
        updated_at = NOW()
      RETURNING *
    `, [
      data.sourceId,
      data.guid,
      data.title,
      data.episodeUrl || null,
      data.audioUrl || null,
      data.publishedAt || null,
      data.durationSeconds || null,
      data.seasonNumber || null,
      data.episodeNumber || null,
      data.summary || null,
      data.transcriptUrl || null
    ]);

    return result.rows[0];
  }

  private async getTranscriptByEpisode(episodeId: string) {
    const result = await this.pool.query(
      'SELECT id, transcript_text FROM podcast_transcripts WHERE episode_id = $1',
      [episodeId]
    );
    return result.rows[0] || null;
  }

  private async storeTranscriptAndIndex(params: {
    episodeId: string;
    transcriptText: string;
    transcriptSource: 'provided' | 'whisper';
    chunkSize: number;
    chunkOverlap: number;
    forceReindex: boolean;
  }) {
    const transcript = params.transcriptText.trim();
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;

    await this.pool.query(`
      INSERT INTO podcast_transcripts (episode_id, transcript_text, word_count, source, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (episode_id) DO UPDATE SET
        transcript_text = EXCLUDED.transcript_text,
        word_count = EXCLUDED.word_count,
        source = EXCLUDED.source,
        updated_at = NOW()
    `, [params.episodeId, transcript, wordCount, params.transcriptSource]);

    const status = params.transcriptSource === 'whisper' ? 'transcribed' : 'available';

    await this.pool.query(`
      UPDATE podcast_episodes
      SET transcript_status = $2,
          transcript_source = $3,
          transcript_updated_at = NOW()
      WHERE id = $1
    `, [params.episodeId, status, params.transcriptSource]);

    await this.indexTranscriptChunks({
      episodeId: params.episodeId,
      transcript,
      chunkSize: params.chunkSize,
      chunkOverlap: params.chunkOverlap,
      forceReindex: params.forceReindex
    });
  }

  private async indexTranscriptChunks(params: {
    episodeId: string;
    transcript: string;
    chunkSize: number;
    chunkOverlap: number;
    forceReindex: boolean;
  }) {
    await this.ensureNlpReady();

    if (params.forceReindex) {
      await this.pool.query(`
        DELETE FROM documents
        WHERE document_type = 'podcast_transcript_chunk'
          AND attributes->>'episode_id' = $1
      `, [params.episodeId]);
    }

    const episodeResult = await this.pool.query(`
      SELECT e.*,
             s.title as source_title,
             s.rss_url as source_rss_url,
             s.site_url as source_site_url,
             s.language as source_language,
             s.categories as source_categories,
             s.description as source_description
      FROM podcast_episodes e
      JOIN podcast_sources s ON e.source_id = s.id
      WHERE e.id = $1
    `, [params.episodeId]);

    const episode = episodeResult.rows[0];
    if (!episode) return;

    const chunks = chunkTranscript(params.transcript, params.chunkSize, params.chunkOverlap);
    const totalChunks = chunks.length;

    for (const chunk of chunks) {
      const title = `${episode.title} (Part ${chunk.index + 1}/${totalChunks})`;
      const embedding = await this.generateEmbedding(`${title} ${chunk.text}`);
      const vectorStr = `[${embedding.join(',')}]`;

      const attributes = {
        episode_id: episode.id,
        source_id: episode.source_id,
        chunk_index: chunk.index,
        chunk_count: totalChunks,
        chunk_start: chunk.startOffset,
        chunk_end: chunk.endOffset,
        podcast: {
          source_id: episode.source_id,
          source_title: episode.source_title,
          source_rss_url: episode.source_rss_url,
          source_site_url: episode.source_site_url,
          source_language: episode.source_language,
          source_categories: episode.source_categories,
          source_description: episode.source_description,
          episode_id: episode.id,
          episode_title: episode.title,
          episode_url: episode.episode_url,
          audio_url: episode.audio_url,
          published_at: episode.published_at,
          season_number: episode.season_number,
          episode_number: episode.episode_number,
          duration_seconds: episode.duration_seconds,
          transcript_source: episode.transcript_source
        }
      };

      const result = await this.pool.query(`
        INSERT INTO documents (
          title, content, url, document_type, attributes, embedding, created_at, updated_at
        ) VALUES ($1, $2, $3, 'podcast_transcript_chunk', $4::jsonb, $5::vector, NOW(), NOW())
        RETURNING id
      `, [title, chunk.text, episode.episode_url, JSON.stringify(attributes), vectorStr]);

      const documentId = result.rows[0].id;

      await this.storePodcastMetadata(documentId, episode);

      await this.nlp.processAndStore({
        id: documentId,
        title,
        content: chunk.text,
        url: episode.episode_url,
        createdAt: new Date(),
        attributes
      });
    }
  }

  private async storePodcastMetadata(documentId: string, episode: any) {
    const entries = [
      { key: 'podcast_episode_id', value: episode.id, type: 'string' },
      { key: 'podcast_episode_title', value: episode.title, type: 'string' },
      { key: 'podcast_source', value: episode.source_title, type: 'string' },
      { key: 'podcast_source_id', value: episode.source_id, type: 'string' },
      { key: 'podcast_series', value: episode.source_title, type: 'string' }
    ];

    if (episode.source_rss_url) {
      entries.push({ key: 'podcast_rss_url', value: episode.source_rss_url, type: 'string' });
    }

    if (episode.source_site_url) {
      entries.push({ key: 'podcast_site_url', value: episode.source_site_url, type: 'string' });
    }

    if (episode.source_language) {
      entries.push({ key: 'podcast_language', value: episode.source_language, type: 'string' });
    }

    if (episode.source_categories && episode.source_categories.length > 0) {
      entries.push({
        key: 'podcast_categories',
        value: Array.isArray(episode.source_categories)
          ? episode.source_categories.join(', ')
          : String(episode.source_categories),
        type: 'string'
      });
    }

    if (episode.source_description) {
      entries.push({ key: 'podcast_source_description', value: episode.source_description, type: 'string' });
    }

    if (episode.published_at) {
      entries.push({
        key: 'podcast_published_at',
        value: new Date(episode.published_at).toISOString(),
        type: 'date'
      });
    }

    if (episode.season_number) {
      entries.push({ key: 'podcast_season', value: String(episode.season_number), type: 'number' });
    }

    if (episode.episode_number) {
      entries.push({ key: 'podcast_episode_number', value: String(episode.episode_number), type: 'number' });
    }

    for (const entry of entries) {
      await this.pool.query(`
        INSERT INTO document_metadata (document_id, meta_key, meta_value, meta_type, confidence, extracted_by)
        VALUES ($1, $2, $3, $4, 1.0, 'podcast_ingest')
        ON CONFLICT (document_id, meta_key) DO UPDATE SET
          meta_value = EXCLUDED.meta_value,
          meta_type = EXCLUDED.meta_type,
          confidence = EXCLUDED.confidence,
          extracted_by = EXCLUDED.extracted_by,
          updated_at = NOW()
      `, [documentId, entry.key, entry.value, entry.type]);
    }
  }

  private async completeRun(runId: string, result: PodcastIngestResult, status: 'completed' | 'failed') {
    await this.pool.query(`
      UPDATE podcast_ingest_runs
      SET status = $2,
          completed_at = NOW(),
          episodes_discovered = $3,
          episodes_updated = $4,
          transcripts_created = $5,
          transcripts_transcribed = $6,
          errors = $7
      WHERE id = $1
    `, [
      runId,
      status,
      result.episodesDiscovered,
      result.episodesUpdated,
      result.transcriptsCreated,
      result.transcriptsTranscribed,
      JSON.stringify(result.errors)
    ]);
  }

  private async extractEpisodePage(pageUrl: string): Promise<EpisodePageData> {
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      pageUrl;

    const audioUrl =
      $('audio source').attr('src') ||
      $('audio').attr('src') ||
      $('a[href$=".mp3"]').attr('href') ||
      $('a[href$=".m4a"]').attr('href');

    const transcriptText = extractTranscriptFromHtml(html);

    return { title: normalizeText(title), audioUrl, transcriptText };
  }

  private async extractTranscriptPage(pageUrl: string): Promise<EpisodePageData> {
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      pageUrl;

    const transcriptText = extractTranscriptFromHtml(html);

    return { title: normalizeText(title), transcriptText };
  }
}
