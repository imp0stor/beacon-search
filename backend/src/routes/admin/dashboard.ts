import { Router } from 'express';
import { DashboardController } from '../../controllers/DashboardController';

export function createAdminDashboardRoutes(controller: DashboardController) {
  const router = Router();

  router.get('/dashboard/alerts', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      const acknowledgedParam = req.query.acknowledged as string | undefined;
      const acknowledged = acknowledgedParam === undefined
        ? undefined
        : acknowledgedParam === 'true';

      const rows = await controller.alerts(acknowledged, limit);
      res.json(rows);
    } catch (error) {
      console.error('Dashboard alerts error:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  router.post('/dashboard/alerts/:id/ack', async (req, res) => {
    try {
      const acknowledged_by = (req.body?.acknowledged_by || '').trim();
      const acknowledged = req.body?.acknowledged !== false;

      if (!acknowledged_by) {
        return res.status(400).json({ error: 'acknowledged_by is required' });
      }

      const updated = await controller.acknowledgeAlert(req.params.id, acknowledged_by, acknowledged);
      if (!updated) return res.status(404).json({ error: 'Alert not found' });
      res.json(updated);
    } catch (error) {
      console.error('Acknowledge alert error:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  });

  router.get('/dashboard/index-status', async (_req, res) => {
    try {
      const status = await controller.indexStatus();
      res.json(status);
    } catch (error) {
      console.error('Index status error:', error);
      res.status(500).json({ error: 'Failed to fetch index status' });
    }
  });

  router.get('/dashboard/sync-history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      const status = (req.query.status as string) || undefined;
      const rows = await controller.syncHistory(limit, status);
      res.json(rows);
    } catch (error) {
      console.error('Dashboard sync history error:', error);
      res.status(500).json({ error: 'Failed to fetch sync history' });
    }
  });

  return router;
}
