import { Router } from 'express';
import { SystemSettingModel } from '../../models/SystemSetting';

function isValidSettingKey(key: string): boolean {
  return /^[A-Z0-9_\-.]+$/.test(key);
}

export function createAdminSettingsRoutes(model: SystemSettingModel, onUpdated?: (key: string, value: unknown) => void) {
  const router = Router();

  router.get('/settings', async (_req, res) => {
    try {
      res.json(await model.list());
    } catch (error) {
      console.error('List system settings error:', error);
      res.status(500).json({ error: 'Failed to list system settings' });
    }
  });

  router.put('/settings/:key', async (req, res) => {
    try {
      const key = String(req.params.key || '').trim().toUpperCase();
      if (!key || !isValidSettingKey(key)) {
        return res.status(400).json({ error: 'Invalid setting key' });
      }

      if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'value')) {
        return res.status(400).json({ error: 'value is required' });
      }

      const payload = {
        value: req.body.value,
        category: req.body.category,
        description: req.body.description
      };

      const updated = await model.upsert(key, payload);
      onUpdated?.(key, updated.value);
      res.json(updated);
    } catch (error) {
      console.error('Update system setting error:', error);
      res.status(500).json({ error: 'Failed to update system setting' });
    }
  });

  return router;
}
