/**
 * Connector API Routes
 * RESTful endpoints for connector management
 */

import { Router, Request, Response } from 'express';
import { ConnectorManager } from './manager';
import { ConnectorConfig, WebConnectorConfig, FolderConnectorConfig } from './types';
import { WebhookManager } from '../webhooks';

export function createConnectorRoutes(manager: ConnectorManager, webhookManager?: WebhookManager): Router {
  const router = Router();

  /**
   * GET /api/connectors
   * List all connectors
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const connectors = await manager.listConnectors();
      
      // Add current run status if running
      const connectorsWithStatus = connectors.map(c => ({
        ...c,
        currentRun: manager.getRunStatus(c.id)
      }));
      
      res.json(connectorsWithStatus);
    } catch (error) {
      console.error('Error listing connectors:', error);
      res.status(500).json({ error: 'Failed to list connectors' });
    }
  });

  /**
   * GET /api/connectors/:id
   * Get a single connector
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const connector = await manager.getConnector(req.params.id);
      
      if (!connector) {
        return res.status(404).json({ error: 'Connector not found' });
      }
      
      res.json({
        ...connector,
        currentRun: manager.getRunStatus(connector.id)
      });
    } catch (error) {
      console.error('Error getting connector:', error);
      res.status(500).json({ error: 'Failed to get connector' });
    }
  });

  /**
   * POST /api/connectors
   * Create a new connector
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, config } = req.body;

      // Validate required fields
      if (!name || !config || !config.type) {
        return res.status(400).json({ 
          error: 'Name and config with type are required' 
        });
      }

      // Validate config based on type
      const validationError = validateConfig(config);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const connector = await manager.createConnector(name, description || null, config);
      res.status(201).json(connector);
    } catch (error) {
      console.error('Error creating connector:', error);
      res.status(500).json({ error: 'Failed to create connector' });
    }
  });

  /**
   * PUT/PATCH /api/connectors/:id
   * Update a connector
   */
  const updateConnectorHandler = async (req: Request, res: Response) => {
    try {
      const { name, description, config, isActive } = req.body;

      // Validate config if provided
      if (config) {
        const validationError = validateConfig(config);
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }
      }

      const connector = await manager.updateConnector(req.params.id, {
        name,
        description,
        config,
        isActive
      });

      if (!connector) {
        return res.status(404).json({ error: 'Connector not found' });
      }

      res.json(connector);
    } catch (error) {
      console.error('Error updating connector:', error);
      res.status(500).json({ error: 'Failed to update connector' });
    }
  };

  router.put('/:id', updateConnectorHandler);
  router.patch('/:id', updateConnectorHandler);

  /**
   * DELETE /api/connectors/:id
   * Delete a connector
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await manager.deleteConnector(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Connector not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting connector:', error);
      res.status(500).json({ error: 'Failed to delete connector' });
    }
  });

  /**
   * POST /api/connectors/:id/run
   * Start a connector run
   */
  router.post('/:id/run', async (req: Request, res: Response) => {
    try {
      const connector = await manager.getConnector(req.params.id);
      const run = await manager.runConnector(req.params.id);

      // Emit webhook event (non-blocking)
      if (webhookManager && connector) {
        webhookManager.emit('connector.started', {
          connector_id: req.params.id,
          connector_name: connector.name,
          connector_type: connector.config.type,
          run_id: run.id
        }).catch(console.error);
      }

      res.json(run);
    } catch (error) {
      console.error('Error running connector:', error);
      const message = error instanceof Error ? error.message : 'Failed to run connector';

      // Emit error webhook event
      if (webhookManager) {
        webhookManager.emit('connector.error', {
          connector_id: req.params.id,
          error: message
        }).catch(console.error);
      }

      res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/connectors/:id/stop
   * Stop a running connector
   */
  router.post('/:id/stop', async (req: Request, res: Response) => {
    try {
      const stopped = manager.stopConnector(req.params.id);
      
      if (!stopped) {
        return res.status(400).json({ error: 'Connector is not running' });
      }
      
      res.json({ message: 'Stop requested' });
    } catch (error) {
      console.error('Error stopping connector:', error);
      res.status(500).json({ error: 'Failed to stop connector' });
    }
  });

  /**
   * GET /api/connectors/:id/status
   * Get current run status
   */
  router.get('/:id/status', async (req: Request, res: Response) => {
    try {
      const status = manager.getRunStatus(req.params.id);
      
      if (!status) {
        // Check if connector exists
        const connector = await manager.getConnector(req.params.id);
        if (!connector) {
          return res.status(404).json({ error: 'Connector not found' });
        }
        return res.json({ status: 'idle' });
      }
      
      res.json(status);
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  /**
   * GET /api/connectors/:id/logs
   * Get connector logs (live or last run)
   */
  router.get('/:id/logs', async (req: Request, res: Response) => {
    try {
      const connector = await manager.getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: 'Connector not found' });
      }

      const limit = parseInt(req.query.limit as string) || 200;
      const level = (req.query.level as string | undefined)?.toLowerCase();
      const logs = await manager.getConnectorLogs(req.params.id, limit);

      const mapped = logs.map((line, idx) => {
        const lower = line.toLowerCase();
        const guessedLevel = lower.includes('error') ? 'error' : lower.includes('warn') ? 'warn' : 'info';
        const tsMatch = line.match(/^\[(.*?)\]/);
        return {
          id: `${req.params.id}-${idx}`,
          timestamp: tsMatch?.[1] || null,
          level: guessedLevel,
          message: line
        };
      });

      const filtered = level ? mapped.filter((entry) => entry.level === level) : mapped;
      res.json(filtered);
    } catch (error) {
      console.error('Error getting connector logs:', error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  /**
   * GET /api/connectors/:id/history
   * Get run history
   */
  router.get('/:id/history', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await manager.getRunHistory(req.params.id, limit);
      res.json(history);
    } catch (error) {
      console.error('Error getting history:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  });

  /**
   * PUT /api/connectors/:id/templates
   * Update URL templates for source portal launching
   */
  router.put('/:id/templates', async (req: Request, res: Response) => {
    try {
      const { portal_url, item_url_template, search_url_template, edit_url_template } = req.body;

      const result = await manager.updateConnectorTemplates(req.params.id, {
        portal_url,
        item_url_template,
        search_url_template,
        edit_url_template
      });

      if (!result) {
        return res.status(404).json({ error: 'Connector not found' });
      }

      res.json({ message: 'Templates updated successfully' });
    } catch (error) {
      console.error('Error updating templates:', error);
      res.status(500).json({ error: 'Failed to update templates' });
    }
  });

  return router;
}

/**
 * Validate connector configuration
 */
function validateConfig(config: any): string | null {
  if (!config.type) {
    return 'Config type is required';
  }

  switch (config.type) {
    case 'web':
      return validateWebConfig(config);
    case 'folder':
      return validateFolderConfig(config);
    case 'sql':
      return validateSqlConfig(config);
    default:
      return `Unknown connector type: ${config.type}`;
  }
}

function validateWebConfig(config: any): string | null {
  if (!config.seedUrl) {
    return 'Seed URL is required for web connector';
  }

  try {
    new URL(config.seedUrl);
  } catch {
    return 'Invalid seed URL';
  }

  if (config.maxDepth !== undefined && (config.maxDepth < 0 || config.maxDepth > 10)) {
    return 'Max depth must be between 0 and 10';
  }

  if (config.maxPages !== undefined && (config.maxPages < 1 || config.maxPages > 10000)) {
    return 'Max pages must be between 1 and 10000';
  }

  if (config.rateLimit !== undefined && (config.rateLimit < 100 || config.rateLimit > 60000)) {
    return 'Rate limit must be between 100ms and 60000ms';
  }

  return null;
}

function validateFolderConfig(config: any): string | null {
  if (!config.folderPath) {
    return 'Folder path is required for folder connector';
  }

  if (!config.fileTypes || !Array.isArray(config.fileTypes) || config.fileTypes.length === 0) {
    return 'File types array is required for folder connector';
  }

  const validExtensions = ['.txt', '.md', '.pdf', '.docx', '.html', '.htm'];
  for (const ext of config.fileTypes) {
    if (!validExtensions.includes(ext.toLowerCase())) {
      return `Invalid file type: ${ext}. Supported: ${validExtensions.join(', ')}`;
    }
  }

  return null;
}

function validateSqlConfig(config: any): string | null {
  if (!config.connectionString) {
    return 'Connection string is required for SQL connector';
  }

  if (!config.metadataQuery) {
    return 'Metadata query is required for SQL connector';
  }

  if (!config.dataQuery) {
    return 'Data query is required for SQL connector';
  }

  return null;
}
