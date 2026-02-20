/**
 * Connector Manager
 * Manages connector lifecycle and document indexing
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  Connector,
  ConnectorConfig,
  ConnectorRun,
  ConnectorStatus,
  ExtractedDocument
} from './types';
import { BaseConnector } from './base';
import { WebSpiderConnector } from './web-spider';
import { FolderConnector } from './folder';
import { NostrConnector } from './nostr';

// Type for webhook manager to avoid circular imports
interface WebhookEmitter {
  emit(event: string, data: Record<string, any>): Promise<void>;
}

export class ConnectorManager {
  private pool: Pool;
  private generateEmbedding: (text: string) => Promise<number[]>;
  private runningConnectors: Map<string, BaseConnector> = new Map();
  private runStatuses: Map<string, ConnectorRun> = new Map();
  private webhookEmitter?: WebhookEmitter;

  constructor(pool: Pool, generateEmbedding: (text: string) => Promise<number[]>) {
    this.pool = pool;
    this.generateEmbedding = generateEmbedding;
  }

  /**
   * Set webhook emitter for event notifications
   */
  setWebhookEmitter(emitter: WebhookEmitter): void {
    this.webhookEmitter = emitter;
  }

  /**
   * List all connectors
   */
  async listConnectors(): Promise<Connector[]> {
    const result = await this.pool.query(`
      SELECT c.id, c.name, c.description, c.connector_type, c.config,
             c.portal_url, c.item_url_template, c.search_url_template, c.edit_url_template,
             c.is_active, c.created_at, c.updated_at,
             (SELECT COUNT(*) FROM documents WHERE source_id = c.id) as document_count,
             (SELECT MAX(completed_at) FROM connector_runs WHERE connector_id = c.id) as last_run_at,
             (SELECT status FROM connector_runs WHERE connector_id = c.id ORDER BY started_at DESC LIMIT 1) as last_run_status
      FROM connectors c
      ORDER BY c.created_at DESC
    `);

    return result.rows.map(this.rowToConnector);
  }

  /**
   * Get a single connector
   */
  async getConnector(id: string): Promise<Connector | null> {
    const result = await this.pool.query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM documents WHERE source_id = c.id) as document_count
      FROM connectors c
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToConnector(result.rows[0]);
  }

  /**
   * Create a new connector
   */
  async createConnector(
    name: string,
    description: string | null,
    config: ConnectorConfig
  ): Promise<Connector> {
    const id = uuidv4();
    
    const result = await this.pool.query(`
      INSERT INTO connectors (id, name, description, connector_type, config, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      RETURNING *
    `, [id, name, description, config.type, JSON.stringify(config)]);

    return this.rowToConnector(result.rows[0]);
  }

  /**
   * Update a connector
   */
  async updateConnector(
    id: string,
    updates: {
      name?: string;
      description?: string | null;
      config?: ConnectorConfig;
      isActive?: boolean;
    }
  ): Promise<Connector | null> {
    const current = await this.getConnector(id);
    if (!current) {
      return null;
    }

    const result = await this.pool.query(`
      UPDATE connectors
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          config = COALESCE($4, config),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      updates.name,
      updates.description,
      updates.config ? JSON.stringify(updates.config) : null,
      updates.isActive
    ]);

    return result.rows.length > 0 ? this.rowToConnector(result.rows[0]) : null;
  }

  /**
   * Delete a connector
   */
  async deleteConnector(id: string): Promise<boolean> {
    // Stop if running
    this.stopConnector(id);

    // Delete connector (documents are kept but unlinked)
    const result = await this.pool.query(
      'DELETE FROM connectors WHERE id = $1 RETURNING id',
      [id]
    );

    return result.rows.length > 0;
  }

  /**
   * Run a connector
   */
  async runConnector(id: string): Promise<ConnectorRun> {
    const connector = await this.getConnector(id);
    if (!connector) {
      throw new Error('Connector not found');
    }

    if (this.runningConnectors.has(id)) {
      throw new Error('Connector is already running');
    }

    // Create connector instance based on type
    let connectorInstance: BaseConnector;
    
    switch (connector.config.type) {
      case 'web':
        connectorInstance = new WebSpiderConnector(connector);
        break;
      case 'folder':
        connectorInstance = new FolderConnector(connector);
        break;
      case 'nostr':
        connectorInstance = new NostrConnector(connector);
        break;
      default:
        throw new Error(`Unsupported connector type: ${connector.config.type}`);
    }

    // Set up event handlers
    connectorInstance.on('document', async (doc: ExtractedDocument) => {
      await this.indexDocument(connector.id, doc);
    });

    connectorInstance.on('progress', (run: ConnectorRun) => {
      this.runStatuses.set(id, run);
    });

    connectorInstance.on('complete', async (run: ConnectorRun) => {
      await this.saveRunHistory(id, run);
      this.runningConnectors.delete(id);

      // Emit webhook event for connector completion
      if (this.webhookEmitter) {
        const eventType = run.status === 'failed' ? 'connector.error' : 'connector.completed';
        this.webhookEmitter.emit(eventType, {
          connector_id: id,
          connector_name: connector.name,
          connector_type: connector.config.type,
          run_id: run.id,
          status: run.status,
          documents_added: run.documentsAdded,
          documents_updated: run.documentsUpdated,
          documents_removed: run.documentsRemoved,
          error_message: run.errorMessage
        }).catch(console.error);
      }
    });

    // Start the run
    this.runningConnectors.set(id, connectorInstance);
    const run = connectorInstance.run();

    return this.runStatuses.get(id) || {
      id: uuidv4(),
      connectorId: id,
      status: 'running',
      startedAt: new Date(),
      documentsAdded: 0,
      documentsUpdated: 0,
      documentsRemoved: 0,
      progress: 0,
      log: []
    };
  }

  /**
   * Stop a running connector
   */
  stopConnector(id: string): boolean {
    const connector = this.runningConnectors.get(id);
    if (connector) {
      connector.stop();
      return true;
    }
    return false;
  }

  /**
   * Get current run status
   */
  getRunStatus(id: string): ConnectorRun | null {
    return this.runStatuses.get(id) || null;
  }

  /**
   * Get run history
   */
  async getRunHistory(id: string, limit: number = 10): Promise<ConnectorRun[]> {
    const result = await this.pool.query(`
      SELECT * FROM connector_runs
      WHERE connector_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [id, limit]);

    return result.rows.map(row => ({
      id: row.id,
      connectorId: row.connector_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      documentsAdded: row.documents_added,
      documentsUpdated: row.documents_updated,
      documentsRemoved: row.documents_removed,
      progress: row.progress,
      totalItems: row.total_items,
      processedItems: row.processed_items,
      errorMessage: row.error_message,
      log: row.log || []
    }));
  }

  /**
   * Index a document
   */
  private async indexDocument(sourceId: string, doc: ExtractedDocument): Promise<void> {
    const embedding = await this.generateEmbedding(`${doc.title} ${doc.content}`);
    const vectorStr = `[${embedding.join(',')}]`;

    await this.pool.query(`
      INSERT INTO documents (
        id, source_id, external_id, title, content, url, 
        attributes, embedding, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, NOW(), NOW())
      ON CONFLICT (source_id, external_id) 
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        url = EXCLUDED.url,
        attributes = EXCLUDED.attributes,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `, [
      uuidv4(),
      sourceId,
      doc.externalId,
      doc.title,
      doc.content,
      doc.url || null,
      doc.attributes ? JSON.stringify(doc.attributes) : null,
      vectorStr
    ]);
  }

  /**
   * Save run history
   */
  private async saveRunHistory(connectorId: string, run: ConnectorRun): Promise<void> {
    await this.pool.query(`
      INSERT INTO connector_runs (
        id, connector_id, status, started_at, completed_at,
        documents_added, documents_updated, documents_removed,
        progress, total_items, processed_items, error_message, log
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      run.id,
      connectorId,
      run.status,
      run.startedAt,
      run.completedAt,
      run.documentsAdded,
      run.documentsUpdated,
      run.documentsRemoved,
      run.progress,
      run.totalItems,
      run.processedItems,
      run.errorMessage,
      JSON.stringify(run.log)
    ]);
  }

  /**
   * Update URL templates for a connector
   */
  async updateConnectorTemplates(
    id: string,
    templates: {
      portal_url?: string;
      item_url_template?: string;
      search_url_template?: string;
      edit_url_template?: string;
    }
  ): Promise<boolean> {
    const result = await this.pool.query(`
      UPDATE connectors
      SET portal_url = COALESCE($2, portal_url),
          item_url_template = COALESCE($3, item_url_template),
          search_url_template = COALESCE($4, search_url_template),
          edit_url_template = COALESCE($5, edit_url_template),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [
      id,
      templates.portal_url,
      templates.item_url_template,
      templates.search_url_template,
      templates.edit_url_template
    ]);

    return result.rows.length > 0;
  }

  /**
   * Convert database row to Connector object
   */
  private rowToConnector(row: any): Connector {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastRunAt: row.last_run_at,
      lastRunStatus: row.last_run_status,
      documentCount: row.document_count ? parseInt(row.document_count) : 0,
      // Source Portal URL Templates
      portalUrl: row.portal_url,
      itemUrlTemplate: row.item_url_template,
      searchUrlTemplate: row.search_url_template,
      editUrlTemplate: row.edit_url_template
    };
  }
}
