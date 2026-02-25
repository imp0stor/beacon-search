/**
 * UX Bundle Routes
 * Tags, advanced search, quality scoring endpoints
 * Added: 2026-02-20 (beacon-ux-bundle merge)
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  calculateQualityScore,
  extractMediaUrls,
  extractTitle,
  isSpam
} from '../services/quality';

export function createUxRoutes(
  pool: Pool,
  generateEmbedding?: (text: string) => Promise<number[]>
): Router {
  const router = Router();

  const parseCsv = (value?: string): string[] => (
    (value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  const resolveWotThreshold = (mode: string, explicitThreshold?: number): number => {
    const defaults: Record<string, number> = {
      off: 0,
      open: 0,
      moderate: 0.35,
      strict: 0.65,
    };

    const base = defaults[mode] ?? defaults.off;
    if (Number.isFinite(explicitThreshold as number)) {
      const value = Math.max(0, Math.min(1, explicitThreshold as number));
      return Math.max(base, value);
    }

    return base;
  };

  // ============================================
  // TAG ENDPOINTS
  // ============================================

  /**
   * GET /api/tags
   * Get all tags with document counts
   */
  router.get('/tags', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const category = req.query.category as string;
      const search = req.query.search as string;
      const minCount = parseInt(req.query.minCount as string) || 1;

      let query = `
        SELECT name, category, count, created_at, updated_at
        FROM tags
        WHERE count >= $1
      `;
      const params: any[] = [minCount];
      let paramIndex = 2;

      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (search) {
        query += ` AND name ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY count DESC, name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM tags WHERE count >= $1';
      const countParams: any[] = [minCount];
      let countParamIndex = 2;

      if (category) {
        countQuery += ` AND category = $${countParamIndex}`;
        countParams.push(category);
        countParamIndex++;
      }

      if (search) {
        countQuery += ` AND name ILIKE $${countParamIndex}`;
        countParams.push(`%${search}%`);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        tags: result.rows,
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
      });
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  /**
   * GET /api/tags/categories
   * Get tag counts grouped by category
   */
  router.get('/tags/categories', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT 
          category,
          COUNT(*) as tag_count,
          SUM(count) as document_count
        FROM tags
        WHERE count > 0
        GROUP BY category
        ORDER BY document_count DESC
      `);

      res.json({ categories: result.rows });
    } catch (error) {
      console.error('Error fetching tag categories:', error);
      res.status(500).json({ error: 'Failed to fetch tag categories' });
    }
  });

  // ============================================
  // ENHANCED SEARCH WITH INFINITE SCROLL
  // ============================================

  /**
   * GET /api/search/advanced
   * Enhanced search with tag filtering, quality filtering, and pagination
   */
  router.get('/search/advanced', async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const mode = (req.query.mode as string) || 'hybrid';

      // Filters
      const tags = req.query.tags ? (req.query.tags as string).split(',') : [];
      const minQuality = parseFloat(req.query.minQuality as string) || 0.3;
      const hasMedia = req.query.hasMedia === 'true';
      const maxResults = parseInt(req.query.maxResults as string) || 1000;

      // Build filter conditions
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Quality filter
      conditions.push(`quality_score >= $${paramIndex}`);
      params.push(minQuality);
      paramIndex++;

      // Media filter
      if (hasMedia) {
        conditions.push(`has_media = true`);
      }

      // Tag filter (AND logic)
      if (tags.length > 0) {
        conditions.push(`
          id IN (
            SELECT document_id 
            FROM document_tags 
            WHERE tag = ANY($${paramIndex})
            GROUP BY document_id
            HAVING COUNT(DISTINCT tag) = $${paramIndex + 1}
          )
        `);
        params.push(tags, tags.length);
        paramIndex += 2;
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      let results;

      if (mode === 'vector' && query && generateEmbedding) {
        // Vector search with filters
        const embedding = await generateEmbedding(query);
        const vectorStr = `[${embedding.join(',')}]`;

        const searchQuery = `
          WITH filtered_docs AS (
            SELECT id, title, content, url, source_id, document_type, 
                   quality_score, has_media, media_urls, created_at,
                   1 - (embedding <=> $${paramIndex}::vector) as score
            FROM documents
            ${whereClause}
            AND embedding IS NOT NULL
          )
          SELECT * FROM filtered_docs
          ORDER BY score DESC
          LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
        `;

        params.push(vectorStr, limit, offset);
        results = await pool.query(searchQuery, params);

      } else if (mode === 'text' && query) {
        // Text search with filters
        const tsQuery = query.split(/\s+/).join(' | ');

        const searchQuery = `
          WITH filtered_docs AS (
            SELECT id, title, content, url, source_id, document_type,
                   quality_score, has_media, media_urls, created_at,
                   ts_rank(to_tsvector('english', title || ' ' || content), 
                          to_tsquery('english', $${paramIndex})) as score
            FROM documents
            ${whereClause}
            AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', $${paramIndex})
          )
          SELECT * FROM filtered_docs
          ORDER BY score DESC
          LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
        `;

        params.push(tsQuery, limit, offset);
        results = await pool.query(searchQuery, params);

      } else {
        // Default: recent documents with filters
        const searchQuery = `
          SELECT id, title, content, url, source_id, document_type,
                 quality_score, has_media, media_urls, created_at,
                 1.0 as score
          FROM documents
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(limit, offset);
        results = await pool.query(searchQuery, params);
      }

      // Get total count (capped for performance)
      const countParams = params.slice(0, conditions.length > 0 ? paramIndex - 1 : 0);
      const countQuery = `
        SELECT COUNT(*) FROM (
          SELECT id FROM documents ${whereClause} LIMIT ${maxResults}
        ) as limited
      `;
      const countResult = await pool.query(countQuery, countParams);
      const total = Math.min(parseInt(countResult.rows[0].count), maxResults);

      // Enhance results with tags
      const resultIds = results.rows.map((r: any) => r.id);
      if (resultIds.length > 0) {
        const tagsQuery = `
          SELECT document_id, array_agg(tag) as tags
          FROM document_tags
          WHERE document_id = ANY($1)
          GROUP BY document_id
        `;
        const tagsResult = await pool.query(tagsQuery, [resultIds]);
        const tagsMap = new Map(tagsResult.rows.map((r: any) => [r.document_id, r.tags]));

        results.rows.forEach((row: any) => {
          row.tags = tagsMap.get(row.id) || [];
        });
      }

      res.json({
        query,
        mode,
        filters: { tags, minQuality, hasMedia },
        results: results.rows,
        total,
        limit,
        offset,
        hasMore: offset + results.rows.length < total
      });

    } catch (error) {
      console.error('Error in advanced search:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * GET /api/search/filtered
   * Filter-aware search endpoint (ranking-compatible with vector/text/hybrid modes)
   */
  router.get('/search/filtered', async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const mode = ((req.query.mode as string) || 'hybrid').toLowerCase();
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const tags = parseCsv(req.query.tags as string | undefined);
      const tagLogic = ((req.query.tagLogic as string) || 'and').toLowerCase();
      const entityType = (req.query.entityType as string) || undefined;
      const entityValue = (req.query.entityValue as string) || undefined;
      const sentiment = (req.query.sentiment as string) || undefined;
      const source = (req.query.source as string) || undefined;
      const type = (req.query.type as string) || undefined;
      const author = (req.query.author as string) || undefined;

      const wotMode = ((req.query.wotMode as string) || 'off').toLowerCase();
      const wotThreshold = req.query.wotThreshold !== undefined
        ? parseFloat(req.query.wotThreshold as string)
        : undefined;
      const minWotScore = resolveWotThreshold(wotMode, wotThreshold);

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (source) {
        conditions.push(`d.source_id = $${paramIndex}`);
        params.push(source);
        paramIndex += 1;
      }

      if (type) {
        conditions.push(`COALESCE(d.document_type, d.type, d.category) = $${paramIndex}`);
        params.push(type);
        paramIndex += 1;
      }

      if (author) {
        conditions.push(`COALESCE(d.author, d.attributes->>'author') = $${paramIndex}`);
        params.push(author);
        paramIndex += 1;
      }

      if (sentiment) {
        conditions.push(`EXISTS (
          SELECT 1 FROM document_metadata dm
          WHERE dm.document_id = d.id
            AND dm.meta_key = 'sentiment'
            AND LOWER(dm.meta_value) = LOWER($${paramIndex})
        )`);
        params.push(sentiment);
        paramIndex += 1;
      }

      if (entityType && entityValue) {
        conditions.push(`EXISTS (
          SELECT 1 FROM document_entities de
          WHERE de.document_id = d.id
            AND de.entity_type = $${paramIndex}
            AND COALESCE(de.normalized_value, de.entity_value) = $${paramIndex + 1}
        )`);
        params.push(entityType, entityValue);
        paramIndex += 2;
      }

      if (tags.length > 0) {
        if (tagLogic === 'or') {
          conditions.push(`EXISTS (
            SELECT 1 FROM document_tags dt
            WHERE dt.document_id = d.id
              AND dt.tag = ANY($${paramIndex})
          )`);
          params.push(tags);
          paramIndex += 1;
        } else {
          conditions.push(`d.id IN (
            SELECT document_id
            FROM document_tags
            WHERE tag = ANY($${paramIndex})
            GROUP BY document_id
            HAVING COUNT(DISTINCT tag) = $${paramIndex + 1}
          )`);
          params.push(tags, tags.length);
          paramIndex += 2;
        }
      }

      if (wotMode !== 'off') {
        conditions.push(`COALESCE(
          NULLIF(d.attributes->>'wot_score', '')::float,
          (
            SELECT NULLIF(dm.meta_value, '')::float
            FROM document_metadata dm
            WHERE dm.document_id = d.id
              AND dm.meta_key IN ('wot_score', 'author_wot_score')
            ORDER BY dm.created_at DESC NULLS LAST
            LIMIT 1
          ),
          0
        ) >= $${paramIndex}`);
        params.push(minWotScore);
        paramIndex += 1;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let results;
      if (mode === 'vector' && query && generateEmbedding) {
        const embedding = await generateEmbedding(query);
        const vectorStr = `[${embedding.join(',')}]`;
        const sql = `
          SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type,
                 d.external_id, d.attributes, d.created_at, d.last_modified,
                 1 - (d.embedding <=> $${paramIndex}::vector) as score
          FROM documents d
          ${whereClause ? `${whereClause} AND d.embedding IS NOT NULL` : 'WHERE d.embedding IS NOT NULL'}
          ORDER BY score DESC
          LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
        `;
        params.push(vectorStr, limit, offset);
        results = await pool.query(sql, params);
      } else if (mode === 'text' && query) {
        const tsQuery = query.split(/\s+/).join(' | ');
        const sql = `
          SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type,
                 d.external_id, d.attributes, d.created_at, d.last_modified,
                 ts_rank(to_tsvector('english', COALESCE(d.content,'') || ' ' || COALESCE(d.title,'')),
                        to_tsquery('english', $${paramIndex})) as score
          FROM documents d
          ${whereClause ? `${whereClause} AND to_tsvector('english', COALESCE(d.content,'') || ' ' || COALESCE(d.title,'')) @@ to_tsquery('english', $${paramIndex})` : `WHERE to_tsvector('english', COALESCE(d.content,'') || ' ' || COALESCE(d.title,'')) @@ to_tsquery('english', $${paramIndex})`}
          ORDER BY score DESC
          LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
        `;
        params.push(tsQuery, limit, offset);
        results = await pool.query(sql, params);
      } else if (query && generateEmbedding) {
        const embedding = await generateEmbedding(query);
        const vectorStr = `[${embedding.join(',')}]`;
        const safeTextQuery = query.split(/\s+/).join(' | ');
        const sql = `
          WITH vector_scores AS (
            SELECT d.id, 1 - (d.embedding <=> $${paramIndex}::vector) as vscore
            FROM documents d
            ${whereClause ? `${whereClause} AND d.embedding IS NOT NULL` : 'WHERE d.embedding IS NOT NULL'}
          ),
          text_scores AS (
            SELECT d.id,
                   ts_rank(to_tsvector('english', COALESCE(d.content,'') || ' ' || COALESCE(d.title,'')),
                           to_tsquery('english', $${paramIndex + 1})) as tscore
            FROM documents d
            ${whereClause}
          )
          SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type,
                 d.external_id, d.attributes, d.created_at, d.last_modified,
                 COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
          FROM documents d
          LEFT JOIN vector_scores v ON d.id = v.id
          LEFT JOIN text_scores t ON d.id = t.id
          ${whereClause}
          ORDER BY score DESC
          LIMIT $${paramIndex + 2} OFFSET $${paramIndex + 3}
        `;
        params.push(vectorStr, safeTextQuery, limit, offset);
        results = await pool.query(sql, params);
      } else {
        const sql = `
          SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type,
                 d.external_id, d.attributes, d.created_at, d.last_modified,
                 1.0 as score
          FROM documents d
          ${whereClause}
          ORDER BY d.created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(limit, offset);
        results = await pool.query(sql, params);
      }

      const countQuery = `SELECT COUNT(*)::int AS total FROM documents d ${whereClause}`;
      const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
      const total = countResult.rows[0]?.total || 0;

      res.json({
        query,
        mode,
        filters: {
          tags,
          tagLogic,
          entity: entityType && entityValue ? { type: entityType, value: entityValue } : null,
          sentiment,
          source,
          type,
          author,
          wotMode,
          wotThreshold: minWotScore,
        },
        results: results.rows,
        total,
        limit,
        offset,
        hasMore: offset + results.rows.length < total,
      });
    } catch (error) {
      console.error('Error in filtered search:', error);
      res.status(500).json({ error: 'Filtered search failed' });
    }
  });

  // ============================================
  // TAG CO-OCCURRENCE / DRILL-DOWN ENDPOINTS
  // ============================================

  /**
   * GET /api/tags/cooccurrence
   * Get related tags for the given tags (for drill-down)
   * 
   * Parameters:
   *   - selectedTags: comma-separated list of currently selected tags
   *   - limit: max number of related tags to return (default: 20)
   * 
   * Returns: Array of {tag, count, relatedness_score}
   * relatedness_score = how often this tag appears with selected tags
   */
  router.get('/tags/cooccurrence', async (req: Request, res: Response) => {
    try {
      const selectedTagsParam = req.query.selectedTags as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!selectedTagsParam) {
        // No tags selected, return all tags
        const result = await pool.query(`
          SELECT name, count FROM tags
          ORDER BY count DESC
          LIMIT $1
        `, [limit]);

        return res.json({
          selectedTags: [],
          relatedTags: result.rows.map((r: any) => ({
            tag: r.name,
            count: r.count,
            relatednessScore: 1.0
          })),
          totalDocuments: null
        });
      }

      const selectedTags = selectedTagsParam.split(',').map((t: string) => t.trim());

      // Find documents that contain ALL selected tags
      const docsQuery = `
        SELECT ARRAY_AGG(document_id) as doc_ids, COUNT(*) as doc_count
        FROM (
          SELECT document_id
          FROM document_tags
          WHERE tag = ANY($1)
          GROUP BY document_id
          HAVING COUNT(DISTINCT tag) = $2
        ) all_selected_docs
      `;

      const docsResult = await pool.query(docsQuery, [selectedTags, selectedTags.length]);

      if (docsResult.rows.length === 0 || !docsResult.rows[0].doc_ids) {
        return res.json({
          selectedTags,
          relatedTags: [],
          totalDocuments: 0
        });
      }

      const docIds = docsResult.rows[0].doc_ids;
      const totalDocuments = docsResult.rows[0].doc_count;

      // Get all tags that appear in these documents
      const relatedTagsQuery = `
        SELECT 
          tag,
          COUNT(*) as count,
          COUNT(*) * 1.0 / $2::float as relatedness_score
        FROM document_tags
        WHERE document_id = ANY($1)
        AND tag != ALL($3)
        GROUP BY tag
        ORDER BY count DESC
        LIMIT $4
      `;

      const relatedResult = await pool.query(relatedTagsQuery, [
        docIds,
        totalDocuments,
        selectedTags,
        limit
      ]);

      res.json({
        selectedTags,
        relatedTags: relatedResult.rows.map((r: any) => ({
          tag: r.tag,
          count: r.count,
          relatednessScore: r.relatedness_score
        })),
        totalDocuments
      });

    } catch (error) {
      console.error('Error fetching tag cooccurrence:', error);
      res.status(500).json({ error: 'Failed to fetch tag cooccurrence' });
    }
  });

  /**
   * GET /api/tags/cloud
   * Get tag cloud data for visualization (all tags with their frequencies)
   * 
   * Parameters:
   *   - selectedTags: comma-separated list of currently selected tags (for reshaping)
   *   - minCount: minimum document count to include (default: 1)
   * 
   * Returns: {tags: [{tag, count, relatednessScore, color}], stats}
   */
  router.get('/tags/cloud', async (req: Request, res: Response) => {
    try {
      const selectedTagsParam = req.query.selectedTags as string;
      const minCount = parseInt(req.query.minCount as string) || 1;
      const maxTags = parseInt(req.query.maxTags as string) || 50;

      let query = 'SELECT name, count FROM tags WHERE count >= $1 ORDER BY count DESC LIMIT $2';
      let params: any[] = [minCount, maxTags];

      // If tags are selected, get cooccurrence-weighted tags
      if (selectedTagsParam) {
        const selectedTags = selectedTagsParam.split(',').map((t: string) => t.trim());

        const docsQuery = `
          SELECT ARRAY_AGG(DISTINCT document_id) as doc_ids, COUNT(DISTINCT document_id) as doc_count
          FROM document_tags
          WHERE tag = ANY($1)
        `;

        const docsResult = await pool.query(docsQuery, [selectedTags]);

        if (docsResult.rows.length > 0 && docsResult.rows[0].doc_ids) {
          const docIds = docsResult.rows[0].doc_ids;

          query = `
            SELECT 
              tag as name,
              COUNT(*) as count
            FROM document_tags
            WHERE document_id = ANY($1)
            AND tag != ALL($2)
            GROUP BY tag
            HAVING COUNT(*) >= $3
            ORDER BY count DESC
            LIMIT $4
          `;
          params = [docIds, selectedTags, minCount, maxTags];
        }
      }

      const result = await pool.query(query, params);

      // Calculate size scaling (log scale for better visualization)
      const counts = result.rows.map((r: any) => r.count);
      const minSize = Math.log(Math.max(...counts) || 1);
      const maxSize = Math.log(Math.max(...counts, 1) + 1);

      const tags = result.rows.map((r: any, idx: number) => {
        const logCount = Math.log(r.count || 1);
        const normalizedSize = (logCount - minSize) / (maxSize - minSize || 1);
        return {
          tag: r.name,
          count: r.count,
          size: Math.round(normalizedSize * 100) + 10, // 10-110
          color: `hsl(${(idx * 360) / Math.max(result.rows.length, 1)}, 70%, 60%)`
        };
      });

      res.json({
        tags,
        selectedTags: selectedTagsParam ? selectedTagsParam.split(',').map((t: string) => t.trim()) : [],
        stats: {
          totalTags: result.rows.length,
          maxCount: counts.length > 0 ? Math.max(...counts) : 0,
          minCount: counts.length > 0 ? Math.min(...counts) : 0
        }
      });

    } catch (error) {
      console.error('Error fetching tag cloud:', error);
      res.status(500).json({ error: 'Failed to fetch tag cloud' });
    }
  });

  // ============================================
  // DOCUMENT QUALITY ENDPOINTS
  // ============================================

  /**
   * POST /api/documents/:id/recalculate-quality
   */
  router.post('/documents/:id/recalculate-quality', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const doc = await pool.query(
        'SELECT title, content, created_at FROM documents WHERE id = $1',
        [id]
      );

      if (doc.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const qualityScore = calculateQualityScore(
        doc.rows[0].title,
        doc.rows[0].content,
        doc.rows[0].created_at
      );

      await pool.query(
        'UPDATE documents SET quality_score = $1 WHERE id = $2',
        [qualityScore, id]
      );

      res.json({ id, qualityScore });

    } catch (error) {
      console.error('Error recalculating quality:', error);
      res.status(500).json({ error: 'Failed to recalculate quality' });
    }
  });

  /**
   * POST /api/documents/recalculate-all-quality
   */
  router.post('/documents/recalculate-all-quality', async (req: Request, res: Response) => {
    try {
      const batchSize = parseInt(req.query.limit as string) || 100;
      let processed = 0;
      let offset = 0;

      while (true) {
        const docs = await pool.query(`
          SELECT id, title, content, created_at
          FROM documents
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (docs.rows.length === 0) break;

        for (const doc of docs.rows) {
          const qualityScore = calculateQualityScore(
            doc.title,
            doc.content,
            doc.created_at
          );

          const mediaInfo = extractMediaUrls(doc.content);

          await pool.query(`
            UPDATE documents 
            SET quality_score = $1, has_media = $2, media_urls = $3
            WHERE id = $4
          `, [qualityScore, mediaInfo.hasMedia, JSON.stringify(mediaInfo.urls), doc.id]);

          processed++;
        }

        offset += batchSize;
      }

      res.json({ message: `Recalculated quality for ${processed} documents` });

    } catch (error) {
      console.error('Error recalculating all quality:', error);
      res.status(500).json({ error: 'Failed to recalculate quality' });
    }
  });

  return router;
}

export default createUxRoutes;
