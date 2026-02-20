/**
 * Nostr Routes
 * API endpoints for Nostr-specific functionality
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getNostrSearchFacets, searchNostrEvents, NostrSearchFilters } from '../templates/nostr/search';
import { NOSTR_KIND_REGISTRY, getKindsByCategory } from '../templates/nostr/kinds';

export function createNostrRoutes(
  pool: Pool,
  generateEmbedding: (text: string) => Promise<number[]>
): Router {
  const router = Router();

  /**
   * Get Nostr event kinds registry
   */
  router.get('/kinds', (_req: Request, res: Response) => {
    res.json(NOSTR_KIND_REGISTRY);
  });

  /**
   * Get event kinds by category
   */
  router.get('/kinds/category/:category', (req: Request, res: Response) => {
    const { category } = req.params;
    const kinds = getKindsByCategory(category);
    res.json({ category, kinds });
  });

  /**
   * Get Nostr search facets
   */
  router.get('/facets', async (_req: Request, res: Response) => {
    try {
      const facets = await getNostrSearchFacets(pool);
      res.json(facets);
    } catch (error) {
      console.error('Nostr facets error:', error);
      res.status(500).json({ error: 'Failed to fetch Nostr facets' });
    }
  });

  /**
   * Search Nostr events with filters
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const mode = (req.query.mode as string) || 'hybrid';

      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      // Parse filters
      const filters: NostrSearchFilters = {};

      if (req.query.kinds) {
        filters.kinds = (req.query.kinds as string).split(',').map(k => parseInt(k));
      }

      if (req.query.categories) {
        filters.categories = (req.query.categories as string).split(',');
      }

      if (req.query.authors) {
        filters.authors = (req.query.authors as string).split(',');
      }

      if (req.query.tags) {
        filters.tags = (req.query.tags as string).split(',');
      }

      // Execute search
      const results = await searchNostrEvents(
        pool,
        query,
        filters,
        limit,
        mode as any,
        generateEmbedding
      );

      res.json({
        query,
        filters,
        mode,
        count: results.length,
        results,
      });
    } catch (error) {
      console.error('Nostr search error:', error);
      res.status(500).json({ error: 'Nostr search failed', details: (error as Error).message });
    }
  });

  /**
   * Get event by ID or addressable reference
   */
  router.get('/events/:ref', async (req: Request, res: Response) => {
    try {
      const { ref } = req.params;
      
      // Try as event ID first
      let result = await pool.query(
        `SELECT * FROM documents WHERE attributes->>'nostr' = 'true' AND id = $1`,
        [ref]
      );

      // Try as external ID (addressable reference)
      if (result.rows.length === 0) {
        result = await pool.query(
          `SELECT * FROM documents WHERE attributes->>'nostr' = 'true' AND external_id = $1`,
          [ref]
        );
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Nostr event fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  /**
   * Get events by author
   */
  router.get('/authors/:pubkey/events', async (req: Request, res: Response) => {
    try {
      const { pubkey } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await pool.query(
        `SELECT * FROM documents 
         WHERE attributes->>'nostr' = 'true' 
           AND attributes->>'pubkey' = $1
         ORDER BY (attributes->'created_at')::int DESC
         LIMIT $2`,
        [pubkey, limit]
      );

      res.json({
        pubkey,
        count: result.rows.length,
        events: result.rows,
      });
    } catch (error) {
      console.error('Author events fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch author events' });
    }
  });

  /**
   * Get events by tag
   */
  router.get('/tags/:tag/events', async (req: Request, res: Response) => {
    try {
      const { tag } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await pool.query(
        `SELECT * FROM documents 
         WHERE attributes->>'nostr' = 'true' 
           AND attributes->'tags'->'topic' ? $1
         ORDER BY (attributes->'created_at')::int DESC
         LIMIT $2`,
        [tag, limit]
      );

      res.json({
        tag,
        count: result.rows.length,
        events: result.rows,
      });
    } catch (error) {
      console.error('Tag events fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch tag events' });
    }
  });

  /**
   * Get statistics
   */
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const totalResult = await pool.query(
        `SELECT COUNT(*) FROM documents WHERE attributes->>'nostr' = 'true'`
      );

      const byKindResult = await pool.query(`
        SELECT 
          (attributes->'kind')::int as kind,
          attributes->>'kindName' as kind_name,
          COUNT(*) as count
        FROM documents
        WHERE attributes->>'nostr' = 'true'
        GROUP BY kind, kind_name
        ORDER BY count DESC
      `);

      const byCategoryResult = await pool.query(`
        SELECT 
          attributes->>'kindCategory' as category,
          COUNT(*) as count
        FROM documents
        WHERE attributes->>'nostr' = 'true'
        GROUP BY category
        ORDER BY count DESC
      `);

      res.json({
        total: parseInt(totalResult.rows[0].count),
        byKind: byKindResult.rows,
        byCategory: byCategoryResult.rows,
      });
    } catch (error) {
      console.error('Nostr stats error:', error);
      res.status(500).json({ error: 'Failed to fetch Nostr stats' });
    }
  });

  return router;
}
