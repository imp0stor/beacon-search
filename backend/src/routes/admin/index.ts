import { Router } from 'express';
import { Pool } from 'pg';
import { ServersController } from '../../controllers/ServersController';
import { DocumentTypesController } from '../../controllers/DocumentTypesController';
import { createAdminServersRoutes } from './servers';
import { createAdminDocumentTypesRoutes } from './documentTypes';

export function createAdminRoutes(pool: Pool) {
  const router = Router();

  const serversController = new ServersController(pool);
  const documentTypesController = new DocumentTypesController(pool);

  router.use(createAdminServersRoutes(serversController));
  router.use(createAdminDocumentTypesRoutes(documentTypesController));

  return router;
}
