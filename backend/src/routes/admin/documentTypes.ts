import { Router } from 'express';
import { DocumentTypesController } from '../../controllers/DocumentTypesController';

export function createAdminDocumentTypesRoutes(controller: DocumentTypesController) {
  const router = Router();

  router.get('/document-types', async (_req, res) => {
    try {
      const rows = await controller.list();
      res.json(rows);
    } catch (error) {
      console.error('List document types error:', error);
      res.status(500).json({ error: 'Failed to list document types' });
    }
  });

  router.post('/document-types', async (req, res) => {
    try {
      const validationError = controller.validateCreate(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const created = await controller.create(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Create document type error:', error);
      if (error?.code === '23505') return res.status(409).json({ error: 'Document type already exists' });
      res.status(500).json({ error: 'Failed to create document type' });
    }
  });

  router.get('/document-types/:id', async (req, res) => {
    try {
      const row = await controller.getById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Document type not found' });
      res.json(row);
    } catch (error) {
      console.error('Get document type error:', error);
      res.status(500).json({ error: 'Failed to fetch document type' });
    }
  });

  router.put('/document-types/:id', async (req, res) => {
    try {
      const validationError = controller.validateUpdate(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const updated = await controller.update(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'Document type not found' });
      res.json(updated);
    } catch (error) {
      console.error('Update document type error:', error);
      res.status(500).json({ error: 'Failed to update document type' });
    }
  });

  router.delete('/document-types/:id', async (req, res) => {
    try {
      const deleted = await controller.remove(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Document type not found' });
      res.status(204).send();
    } catch (error) {
      console.error('Delete document type error:', error);
      res.status(500).json({ error: 'Failed to delete document type' });
    }
  });

  return router;
}
