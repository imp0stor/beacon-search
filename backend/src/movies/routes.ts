import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { MovieService } from './service';

export function createMovieRoutes(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
  const router = Router();
  const service = new MovieService(pool, generateEmbedding);

  router.post('/ingest', async (req: Request, res: Response) => {
    try {
      const result = await service.ingest(req.body);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: 'Movie ingest failed', details: (error as Error).message });
    }
  });

  router.get('/browse', async (req: Request, res: Response) => {
    try {
      const movieId = req.query.movieId as string | undefined;
      const result = await service.getBrowse(movieId);
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

  router.get('/:movieId/transcripts', async (req: Request, res: Response) => {
    try {
      const result = await service.getTranscriptDetails(req.params.movieId);
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
