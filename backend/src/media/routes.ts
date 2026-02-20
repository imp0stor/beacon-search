import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { MediaService } from './service';

export function createMediaRoutes(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
  const router = Router();
  const service = new MediaService(pool, generateEmbedding);

  router.get('/browse', async (_req: Request, res: Response) => {
    try {
      const result = await service.getBrowse();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Browse failed', details: (error as Error).message });
    }
  });

  router.get('/facets', async (req: Request, res: Response) => {
    try {
      const types = (req.query.types as string | undefined)
        ?.split(',')
        .map(value => value.trim())
        .filter(Boolean) as any[] | undefined;
      const result = await service.getFacets(types as any);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Facets failed', details: (error as Error).message });
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
