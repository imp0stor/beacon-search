import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { FrpeiRouter } from './router';
import {
  FrpeiEnrichRequest,
  FrpeiExplainRequest,
  FrpeiFeedbackRequest,
  FrpeiRankRequest,
  FrpeiRetrieveRequest
} from './types';

export function createFrpeiRoutes(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
  const router = Router();
  const frpei = new FrpeiRouter(pool, generateEmbedding);

  router.post('/retrieve', async (req: Request, res: Response) => {
    try {
      const payload = req.body as FrpeiRetrieveRequest;
      if (!payload?.query) return res.status(400).json({ error: 'query is required' });
      const response = await frpei.retrieve(payload);
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: 'FRPEI retrieve failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post('/ingest', async (req: Request, res: Response) => {
    try {
      const payload = req.body as FrpeiRetrieveRequest;
      if (!payload?.query) return res.status(400).json({ error: 'query is required' });
      const response = await frpei.retrieve(payload);
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: 'FRPEI ingest failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post('/enrich', async (req: Request, res: Response) => {
    try {
      const payload = req.body as FrpeiEnrichRequest;
      if (!payload?.candidates) return res.status(400).json({ error: 'candidates are required' });
      const response = await frpei.enrich(payload);
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: 'FRPEI enrich failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post('/rank', async (req: Request, res: Response) => {
    try {
      const payload = req.body as FrpeiRankRequest;
      if (!payload?.candidates) return res.status(400).json({ error: 'candidates are required' });
      const response = await frpei.rank(payload);
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: 'FRPEI rank failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post('/explain', async (req: Request, res: Response) => {
    try {
      const payload = req.body as FrpeiExplainRequest;
      if (!payload?.candidate) return res.status(400).json({ error: 'candidate is required' });
      const response = await frpei.explain(payload);
      return res.json(response);
    } catch (error) {
      return res.status(500).json({ error: 'FRPEI explain failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post('/feedback', async (req: Request, res: Response) => {
    try {
      const payload = req.body as FrpeiFeedbackRequest & { action?: string };
      if (!payload?.candidateId) {
        return res.status(400).json({ error: 'candidateId is required' });
      }

      const action = (payload as any).action as string | undefined;
      let feedback = payload.feedback as string | undefined;

      if (!feedback && action) {
        const lowered = action.toLowerCase();
        if (['click', 'save', 'like', 'upvote'].includes(lowered)) feedback = 'positive';
        else if (['hide', 'downvote', 'dismiss'].includes(lowered)) feedback = 'negative';
        else feedback = 'neutral';
      }

      if (!feedback) {
        return res.status(400).json({ error: 'feedback or action is required' });
      }

      const id = uuidv4();
      const result = await pool.query(`
        INSERT INTO frpei_feedback (id, request_id, candidate_id, provider, feedback, rating, notes, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at
      `, [
        id,
        payload.requestId || null,
        payload.candidateId,
        payload.provider || null,
        feedback,
        payload.rating || null,
        payload.notes || null,
        payload.metadata || {}
      ]);

      return res.status(201).json({
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at
      });
    } catch (error) {
      return res.status(500).json({ error: 'FRPEI feedback failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  router.get('/metrics', (_req: Request, res: Response) => {
    return res.json(frpei.metricsSnapshot());
  });

  router.get('/status', (_req: Request, res: Response) => {
    return res.json({ providers: frpei.providerHealth() });
  });

  return router;
}
