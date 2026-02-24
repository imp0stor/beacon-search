import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { TVService } from './service';

export function createTvRoutes(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
  const router = Router();
  const service = new TVService(pool, generateEmbedding);

  router.post('/ingest', async (req: Request, res: Response) => {
    try {
      const result = await service.ingest(req.body);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: 'TV ingest failed', details: (error as Error).message });
    }
  });

  router.get('/browse', async (req: Request, res: Response) => {
    try {
      const seriesId = req.query.seriesId as string | undefined;
      const result = await service.getBrowse(seriesId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Browse failed', details: (error as Error).message });
    }
  });

  router.get('/facets', async (_req: Request, res: Response) => {
    try {
      const result = await service.getFacets();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Facets failed', details: (error as Error).message });
    }
  });

  router.get('/episodes/:episodeId/transcripts', async (req: Request, res: Response) => {
    try {
      const result = await service.getTranscriptDetails(req.params.episodeId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Transcript fetch failed', details: (error as Error).message });
    }
  });

  router.post('/search', async (req: Request, res: Response) => {
    try {
      const result = await service.search(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Search failed', details: (error as Error).message });
    }
  });

  router.post('/recommendations/preview', async (req: Request, res: Response) => {
    try {
      const result = await service.recommend(req.body);
      res.json({ recommendations: result });
    } catch (error) {
      res.status(500).json({ error: 'Recommendations failed', details: (error as Error).message });
    }
  });

  return router;
}
