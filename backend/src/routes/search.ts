/**
 * Search Route
 * General search endpoint with optional content_type filtering
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createSearchRoutes(
  pool: Pool,
  generateEmbedding: (text: string) => Promise<number[]>
): Router {
  const router = Router();

  /**
   * General document search with optional content_type filter
   * 
   * Query params:
   *   q          - search query (required)
   *   limit      - max results (default: 20)
   *   content_type - comma-separated list of content_type values to filter by
   *   mode       - 'text' | 'vector' | 'hybrid' (default: 'hybrid')
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const mode = (req.query.mode as string) || 'hybrid';
      const contentTypes = req.query.content_type
        ? (req.query.content_type as string).split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const conditions: string[] = [];
      const params: any[] = [];

      if (contentTypes.length > 0) {
        params.push(contentTypes);
        conditions.push(`content_type = ANY($${params.length}::content_type[])`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      if (mode === 'text') {
        const expandedQuery = query.split(/\s+/).join(' | ');
        params.push(expandedQuery);
        const qIdx = params.length;
        params.push(limit);
        const limitIdx = params.length;

        const result = await pool.query(
          `SELECT id, title, content, url, source_id, document_type, content_type, attributes,
                  ts_rank(to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(title, '')),
                          to_tsquery('english', $${qIdx})) as score
           FROM documents
           ${whereClause}
             ${whereClause ? 'AND' : 'WHERE'} to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(title, ''))
               @@ to_tsquery('english', $${qIdx})
           ORDER BY score DESC
           LIMIT $${limitIdx}`,
          params
        );

        return res.json({ query, mode, content_type: contentTypes, count: result.rows.length, results: result.rows });

      } else if (mode === 'vector') {
        const embedding = await generateEmbedding(query);
        const vectorStr = `[${embedding.join(',')}]`;
        params.push(vectorStr);
        const vIdx = params.length;
        params.push(limit);
        const limitIdx = params.length;

        const result = await pool.query(
          `SELECT id, title, content, url, source_id, document_type, content_type, attributes,
                  1 - (embedding <=> $${vIdx}::vector) as score
           FROM documents
           ${whereClause}
             ${whereClause ? 'AND' : 'WHERE'} embedding IS NOT NULL
           ORDER BY embedding <=> $${vIdx}::vector
           LIMIT $${limitIdx}`,
          params
        );

        return res.json({ query, mode, content_type: contentTypes, count: result.rows.length, results: result.rows });

      } else {
        // hybrid
        const embedding = await generateEmbedding(query);
        const vectorStr = `[${embedding.join(',')}]`;
        const expandedQuery = query.split(/\s+/).join(' | ');
        params.push(vectorStr);
        const vIdx = params.length;
        params.push(expandedQuery);
        const tIdx = params.length;
        params.push(limit);
        const limitIdx = params.length;

        const filterAndPrefix = whereClause ? `${whereClause} AND` : 'WHERE';

        const result = await pool.query(
          `WITH vector_scores AS (
             SELECT id, 1 - (embedding <=> $${vIdx}::vector) as vscore
             FROM documents
             ${filterAndPrefix} embedding IS NOT NULL
           ),
           text_scores AS (
             SELECT id, ts_rank(to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(title, '')),
                                to_tsquery('english', $${tIdx})) as tscore
             FROM documents
             ${whereClause}
           )
           SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type, d.content_type, d.attributes,
                  COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
           FROM documents d
           LEFT JOIN vector_scores v ON d.id = v.id
           LEFT JOIN text_scores t ON d.id = t.id
           ${whereClause}
           ORDER BY score DESC
           LIMIT $${limitIdx}`,
          params
        );

        return res.json({ query, mode, content_type: contentTypes, count: result.rows.length, results: result.rows });
      }

    } catch (error) {
      const message = (error as Error).message || 'Search failed';
      if (message.toLowerCase().includes('tsquery')) {
        return res.status(400).json({
          error: 'Invalid search syntax',
          details: 'Please simplify your query or use plain keywords.'
        });
      }
      console.error('Search error:', error);
      return res.status(500).json({ error: 'Search failed', details: message });
    }
  });

  return router;
}
