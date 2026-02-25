import { Router } from 'express';
import { Pool } from 'pg';
import { ServersController } from '../../controllers/ServersController';
import { DocumentTypesController } from '../../controllers/DocumentTypesController';
import { createAdminServersRoutes } from './servers';
import { createAdminDocumentTypesRoutes } from './documentTypes';
import { createAdminCrawlersRoutes } from './crawlers';
import { createAdminDashboardRoutes } from './dashboard';
import { CrawlersController } from '../../controllers/CrawlersController';
import { DashboardController } from '../../controllers/DashboardController';
import { SyncExecutor } from '../../sync/SyncExecutor';

export function createAdminRoutes(pool: Pool, syncExecutor: SyncExecutor) {
  const router = Router();

  const serversController = new ServersController(pool);
  const documentTypesController = new DocumentTypesController(pool);
  const crawlersController = new CrawlersController(pool);
  const dashboardController = new DashboardController(pool);

  router.use(createAdminServersRoutes(serversController));
  router.use(createAdminDocumentTypesRoutes(documentTypesController));
  router.use(createAdminCrawlersRoutes(crawlersController, syncExecutor));
  router.use(createAdminDashboardRoutes(dashboardController));

  return router;
}
