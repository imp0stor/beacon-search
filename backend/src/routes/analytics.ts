/**
 * Analytics Routes
 * Author dashboards, zap heatmaps, engagement metrics
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AnalyticsService } from '../services/analytics';

export function createAnalyticsRoutes(pool: Pool): Router {
  const router = Router();
  const analyticsService = new AnalyticsService(pool);

  /**
   * GET /api/authors/:pubkey/analytics
   * Get comprehensive author analytics
   * 
   * Parameters:
   *   - timeframe: 'all', 'month', 'week', 'day' (default: 'all')
   */
  router.get('/authors/:pubkey/analytics', async (req: Request, res: Response) => {
    try {
      const { pubkey } = req.params;
      const timeframe = (req.query.timeframe as 'all' | 'month' | 'week' | 'day') || 'all';

      if (!pubkey || pubkey.length === 0) {
        return res.status(400).json({ error: 'Author pubkey required' });
      }

      const analytics = await analyticsService.getAuthorAnalytics(pubkey, timeframe);

      res.json({
        author: analytics.stats,
        stats: {
          totalZapsEarned: analytics.stats.totalZapsEarned,
          totalDocuments: analytics.stats.totalDocuments,
          totalEngagement: analytics.stats.totalEngagement,
          averageZapPerDocument: analytics.stats.averageZapPerDocument
        },
        contentBreakdown: analytics.contentBreakdown,
        recentActivity: analytics.recentActivity.slice(0, 10),
        trends: analytics.trends,
        timeframe
      });
    } catch (error: any) {
      console.error('Error fetching author analytics:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch author analytics' });
    }
  });

  /**
   * GET /api/documents/:id/zap-heatmap
   * Get paragraph-level zap visualization for a document
   * 
   * Returns: Heatmap data with paragraph indices, zap counts, and hotspots
   */
  router.get('/documents/:id/zap-heatmap', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || id.length === 0) {
        return res.status(400).json({ error: 'Document ID required' });
      }

      const heatmap = await analyticsService.getDocumentHeatmap(id);

      res.json(heatmap);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error fetching zap heatmap:', error);
      res.status(500).json({ error: 'Failed to fetch zap heatmap' });
    }
  });

  /**
   * POST /api/zaps/record-engagement
   * Record a zap engagement event (called by zap receipt handler)
   * 
   * Body:
   *   - documentId: string
   *   - authorPubkey: string
   *   - zapperPubkey: string (optional)
   *   - amountSats: number
   *   - paragraphIndex: number (optional)
   *   - nostrEventId: string (optional)
   */
  router.post('/zaps/record-engagement', async (req: Request, res: Response) => {
    try {
      const {
        documentId,
        authorPubkey,
        zapperPubkey,
        amountSats,
        paragraphIndex,
        nostrEventId
      } = req.body;

      if (!documentId || !authorPubkey || !amountSats) {
        return res.status(400).json({
          error: 'Missing required fields: documentId, authorPubkey, amountSats'
        });
      }

      await analyticsService.recordZapEngagement(
        documentId,
        authorPubkey,
        zapperPubkey || null,
        amountSats,
        paragraphIndex,
        nostrEventId
      );

      res.json({ success: true, message: 'Engagement recorded' });
    } catch (error: any) {
      console.error('Error recording zap engagement:', error);
      res.status(500).json({ error: 'Failed to record engagement' });
    }
  });

  /**
   * GET /api/trending/documents
   * Get trending documents by zaps in a timeframe
   * 
   * Parameters:
   *   - timeframe: 'day', 'week', 'month' (default: 'week')
   *   - limit: max number of documents (default: 10, max: 100)
   */
  router.get('/trending/documents', async (req: Request, res: Response) => {
    try {
      const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

      const trending = await analyticsService.getTrendingDocuments(timeframe, limit);

      res.json({
        timeframe,
        documents: trending
      });
    } catch (error: any) {
      console.error('Error fetching trending documents:', error);
      res.status(500).json({ error: 'Failed to fetch trending documents' });
    }
  });

  /**
   * GET /api/trending/authors
   * Get top authors by total zaps earned
   * 
   * Parameters:
   *   - limit: max number of authors (default: 10, max: 100)
   */
  router.get('/trending/authors', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

      const topAuthors = await analyticsService.getTopAuthors(limit);

      res.json({
        authors: topAuthors
      });
    } catch (error: any) {
      console.error('Error fetching top authors:', error);
      res.status(500).json({ error: 'Failed to fetch top authors' });
    }
  });

  return router;
}
