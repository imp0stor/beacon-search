import { Router } from 'express';
import { ServersController } from '../../controllers/ServersController';

export function createAdminServersRoutes(controller: ServersController) {
  const router = Router();

  router.get('/servers', async (_req, res) => {
    try {
      const rows = await controller.list();
      res.json(rows);
    } catch (error) {
      console.error('List servers error:', error);
      res.status(500).json({ error: 'Failed to list servers' });
    }
  });

  router.post('/servers', async (req, res) => {
    try {
      const validationError = controller.validateCreate(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const created = await controller.create(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Create server error:', error);
      if (error?.code === '23505') return res.status(409).json({ error: 'Server already exists' });
      res.status(500).json({ error: 'Failed to create server' });
    }
  });

  router.get('/servers/:id', async (req, res) => {
    try {
      const row = await controller.getById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Server not found' });
      res.json(row);
    } catch (error) {
      console.error('Get server error:', error);
      res.status(500).json({ error: 'Failed to fetch server' });
    }
  });

  router.put('/servers/:id', async (req, res) => {
    try {
      const validationError = controller.validateUpdate(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const updated = await controller.update(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'Server not found' });
      res.json(updated);
    } catch (error) {
      console.error('Update server error:', error);
      res.status(500).json({ error: 'Failed to update server' });
    }
  });

  router.delete('/servers/:id', async (req, res) => {
    try {
      const deleted = await controller.remove(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Server not found' });
      res.status(204).send();
    } catch (error) {
      console.error('Delete server error:', error);
      res.status(500).json({ error: 'Failed to delete server' });
    }
  });

  router.post('/servers/:id/test', async (req, res) => {
    try {
      const outcome = await controller.testConnection(req.params.id);
      if (!outcome) return res.status(404).json({ error: 'Server not found' });
      res.status(outcome.success ? 200 : 502).json(outcome);
    } catch (error) {
      console.error('Test server connection error:', error);
      res.status(500).json({ error: 'Failed to test server connection' });
    }
  });

  return router;
}
