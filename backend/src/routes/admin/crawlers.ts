import { Router } from 'express';
import { CrawlersController } from '../../controllers/CrawlersController';
import { SyncExecutor } from '../../sync/SyncExecutor';

export function createAdminCrawlersRoutes(controller: CrawlersController, syncExecutor: SyncExecutor) {
  const router = Router();

  router.get('/crawlers', async (_req, res) => {
    try {
      res.json(await controller.list());
    } catch (error) {
      console.error('List crawlers error:', error);
      res.status(500).json({ error: 'Failed to list crawlers' });
    }
  });

  router.post('/crawlers', async (req, res) => {
    try {
      const validationError = controller.validateCreate(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });
      const created = await controller.create(req.body || {});
      res.status(201).json(created);
    } catch (error) {
      console.error('Create crawler error:', error);
      res.status(500).json({ error: 'Failed to create crawler' });
    }
  });

  router.get('/crawlers/:id', async (req, res) => {
    try {
      const row = await controller.getById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Crawler not found' });
      res.json(row);
    } catch (error) {
      console.error('Get crawler error:', error);
      res.status(500).json({ error: 'Failed to fetch crawler' });
    }
  });

  router.put('/crawlers/:id', async (req, res) => {
    try {
      const validationError = controller.validateUpdate(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });
      const updated = await controller.update(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'Crawler not found' });
      res.json(updated);
    } catch (error) {
      console.error('Update crawler error:', error);
      res.status(500).json({ error: 'Failed to update crawler' });
    }
  });

  router.delete('/crawlers/:id', async (req, res) => {
    try {
      const deleted = await controller.remove(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Crawler not found' });
      res.status(204).send();
    } catch (error) {
      console.error('Delete crawler error:', error);
      res.status(500).json({ error: 'Failed to delete crawler' });
    }
  });

  router.post('/crawlers/:id/sync', async (req, res) => {
    try {
      const mode = req.body?.mode === 'schedule' ? 'schedule' : 'manual';
      const result = await syncExecutor.executeCrawler(req.params.id, mode);
      res.status(202).json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to run sync';
      if (message.includes('not found')) return res.status(404).json({ error: message });
      console.error('Manual crawler sync error:', error);
      res.status(500).json({ error: message });
    }
  });

  router.delete('/crawlers/:id/documents', async (req, res) => {
    try {
      const output = await controller.deleteDocuments(req.params.id);
      if (!output) return res.status(404).json({ error: 'Crawler not found' });
      res.json(output);
    } catch (error) {
      console.error('Delete crawler documents error:', error);
      res.status(500).json({ error: 'Failed to delete crawler documents' });
    }
  });

  router.get('/crawlers/:id/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const rows = await controller.history(req.params.id, limit);
      if (!rows) return res.status(404).json({ error: 'Crawler not found' });
      res.json(rows);
    } catch (error) {
      console.error('Crawler history error:', error);
      res.status(500).json({ error: 'Failed to fetch crawler history' });
    }
  });

  return router;
}
