import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PodcastService } from './service';
import { PodcastIngestRequest, PodcastRecommendationRequest } from './types';

export function createPodcastRoutes(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
  const router = Router();
  const service = new PodcastService(pool, generateEmbedding);

  router.post('/ingest', async (req: Request, res: Response) => {
    try {
      const body = req.body as PodcastIngestRequest;
      if (!body?.sources || body.sources.length === 0) {
        return res.status(400).json({ error: 'sources array is required' });
      }

      const results = await service.ingest(body);
      res.json({ results });
    } catch (error) {
      console.error('Podcast ingest error:', error);
      res.status(500).json({ error: 'Podcast ingest failed' });
    }
  });

  router.get('/ingest/:runId', async (req: Request, res: Response) => {
    try {
      const run = await service.getIngestRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }
      res.json(run);
    } catch (error) {
      console.error('Podcast ingest status error:', error);
      res.status(500).json({ error: 'Failed to fetch ingest status' });
    }
  });

  router.get('/episodes/:episodeId/transcript', async (req: Request, res: Response) => {
    try {
      const transcript = await service.getTranscript(req.params.episodeId);
      if (!transcript) {
        return res.status(404).json({ error: 'Transcript not found' });
      }
      res.json(transcript);
    } catch (error) {
      console.error('Transcript retrieval error:', error);
      res.status(500).json({ error: 'Failed to fetch transcript' });
    }
  });

  router.get('/facets', async (_req: Request, res: Response) => {
    try {
      const facets = await service.getFacets();
      res.json(facets);
    } catch (error) {
      console.error('Podcast facets error:', error);
      res.status(500).json({ error: 'Failed to fetch facets' });
    }
  });

  router.post('/recommendations/preview', async (req: Request, res: Response) => {
    try {
      const body = req.body as PodcastRecommendationRequest;
      if (!body?.profile) {
        return res.status(400).json({ error: 'profile is required' });
      }

      const recommendations = await service.recommend(body);
      res.json({ recommendations });
    } catch (error) {
      console.error('Podcast recommendations error:', error);
      res.status(500).json({ error: 'Failed to compute recommendations' });
    }
  });

  return router;
}
