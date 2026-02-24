/**
 * Webhook System for Beacon Search
 * Supports callback notifications for document and connector events
 */

import { Pool } from 'pg';
import crypto from 'crypto';

// ============================================
// Event Types
// ============================================

export type WebhookEventType = 
  | 'document.indexed'
  | 'document.updated'
  | 'document.deleted'
  | 'search.performed'
  | 'answer.generated'
  | 'connector.started'
  | 'connector.completed'
  | 'connector.error';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, any>;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  headers: Record<string, string>;
  enabled: boolean;
  secret: string;
  created_at: Date;
  updated_at: Date;
  last_triggered_at?: Date;
  last_status?: number;
  failure_count: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: WebhookEventType;
  payload: WebhookPayload;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  last_attempt_at?: Date;
  response_status?: number;
  response_body?: string;
  error_message?: string;
  created_at: Date;
}

// ============================================
// Webhook Manager
// ============================================

export class WebhookManager {
  private pool: Pool;
  private deliveryQueue: Map<string, NodeJS.Timeout> = new Map();
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 30000]; // 1s, 5s, 30s

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Emit an event to all subscribed webhooks
   * This is non-blocking - events are queued and delivered asynchronously
   */
  async emit(event: WebhookEventType, data: Record<string, any>): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    // Find all enabled webhooks subscribed to this event
    const result = await this.pool.query(`
      SELECT * FROM webhooks 
      WHERE enabled = true 
      AND $1 = ANY(events)
    `, [event]);

    // Queue delivery for each webhook asynchronously
    for (const webhook of result.rows) {
      this.queueDelivery(webhook, payload).catch(err => {
        console.error(`Failed to queue webhook delivery for ${webhook.name}:`, err);
      });
    }
  }

  /**
   * Queue a webhook delivery with retry support
   */
  private async queueDelivery(webhook: any, payload: WebhookPayload): Promise<void> {
    // Create delivery record
    const deliveryResult = await this.pool.query(`
      INSERT INTO webhook_deliveries (webhook_id, event, payload, status, attempts)
      VALUES ($1, $2, $3, 'pending', 0)
      RETURNING id
    `, [webhook.id, payload.event, JSON.stringify(payload)]);

    const deliveryId = deliveryResult.rows[0].id;

    // Attempt delivery
    this.attemptDelivery(deliveryId, webhook, payload, 0);
  }

  /**
   * Attempt to deliver a webhook with exponential backoff retry
   */
  private async attemptDelivery(
    deliveryId: string,
    webhook: any,
    payload: WebhookPayload,
    attempt: number
  ): Promise<void> {
    try {
      // Generate HMAC signature
      const signature = this.generateSignature(payload, webhook.secret);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Beacon-Event': payload.event,
        'X-Beacon-Signature': signature,
        'X-Beacon-Delivery': deliveryId,
        'X-Beacon-Timestamp': payload.timestamp,
        ...(webhook.headers || {})
      };

      // Make the request
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseBody = await response.text().catch(() => '');

      // Update delivery record
      await this.pool.query(`
        UPDATE webhook_deliveries
        SET status = $1,
            attempts = $2,
            last_attempt_at = NOW(),
            response_status = $3,
            response_body = $4
        WHERE id = $5
      `, [
        response.ok ? 'success' : 'failed',
        attempt + 1,
        response.status,
        responseBody.substring(0, 1000),
        deliveryId
      ]);

      // Update webhook last triggered info
      await this.pool.query(`
        UPDATE webhooks
        SET last_triggered_at = NOW(),
            last_status = $1,
            failure_count = CASE WHEN $2 THEN 0 ELSE failure_count + 1 END,
            updated_at = NOW()
        WHERE id = $3
      `, [response.status, response.ok, webhook.id]);

      // If failed and more retries available, schedule retry
      if (!response.ok && attempt < this.maxRetries - 1) {
        const delay = this.retryDelays[attempt] || 30000;
        setTimeout(() => {
          this.attemptDelivery(deliveryId, webhook, payload, attempt + 1);
        }, delay);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update delivery record with error
      await this.pool.query(`
        UPDATE webhook_deliveries
        SET status = 'failed',
            attempts = $1,
            last_attempt_at = NOW(),
            error_message = $2
        WHERE id = $3
      `, [attempt + 1, errorMessage, deliveryId]);

      // Update webhook failure count
      await this.pool.query(`
        UPDATE webhooks
        SET failure_count = failure_count + 1,
            updated_at = NOW()
        WHERE id = $1
      `, [webhook.id]);

      // Retry if attempts remaining
      if (attempt < this.maxRetries - 1) {
        const delay = this.retryDelays[attempt] || 30000;
        setTimeout(() => {
          this.attemptDelivery(deliveryId, webhook, payload, attempt + 1);
        }, delay);
      }

      console.error(`Webhook delivery failed for ${webhook.name}:`, errorMessage);
    }
  }

  /**
   * Generate HMAC SHA-256 signature for payload verification
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify a webhook signature (for testing/debugging)
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expected = `sha256=${hmac.digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async listWebhooks(): Promise<Webhook[]> {
    const result = await this.pool.query(`
      SELECT * FROM webhooks ORDER BY created_at DESC
    `);
    return result.rows;
  }

  async getWebhook(id: string): Promise<Webhook | null> {
    const result = await this.pool.query(`
      SELECT * FROM webhooks WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  async createWebhook(webhook: {
    name: string;
    url: string;
    events: WebhookEventType[];
    headers?: Record<string, string>;
    enabled?: boolean;
  }): Promise<Webhook> {
    // Generate a random secret
    const secret = crypto.randomBytes(32).toString('hex');

    const result = await this.pool.query(`
      INSERT INTO webhooks (name, url, events, headers, enabled, secret)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      webhook.name,
      webhook.url,
      webhook.events,
      JSON.stringify(webhook.headers || {}),
      webhook.enabled ?? true,
      secret
    ]);

    return result.rows[0];
  }

  async updateWebhook(id: string, updates: {
    name?: string;
    url?: string;
    events?: WebhookEventType[];
    headers?: Record<string, string>;
    enabled?: boolean;
  }): Promise<Webhook | null> {
    const result = await this.pool.query(`
      UPDATE webhooks
      SET name = COALESCE($2, name),
          url = COALESCE($3, url),
          events = COALESCE($4, events),
          headers = COALESCE($5, headers),
          enabled = COALESCE($6, enabled),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      updates.name,
      updates.url,
      updates.events,
      updates.headers ? JSON.stringify(updates.headers) : null,
      updates.enabled
    ]);

    return result.rows[0] || null;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const result = await this.pool.query(`
      DELETE FROM webhooks WHERE id = $1 RETURNING id
    `, [id]);
    return result.rows.length > 0;
  }

  async regenerateSecret(id: string): Promise<string | null> {
    const secret = crypto.randomBytes(32).toString('hex');
    const result = await this.pool.query(`
      UPDATE webhooks
      SET secret = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING secret
    `, [id, secret]);
    return result.rows[0]?.secret || null;
  }

  /**
   * Test a webhook by sending a test event
   */
  async testWebhook(id: string): Promise<{ success: boolean; status?: number; body?: string; error?: string }> {
    const webhook = await this.getWebhook(id);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const payload: WebhookPayload = {
      event: 'document.indexed',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery from Beacon Search',
        webhook_id: id,
        webhook_name: webhook.name
      }
    };

    try {
      const signature = this.generateSignature(payload, webhook.secret);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Beacon-Event': payload.event,
        'X-Beacon-Signature': signature,
        'X-Beacon-Delivery': 'test',
        'X-Beacon-Timestamp': payload.timestamp,
        ...(webhook.headers || {})
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      const body = await response.text().catch(() => '');

      return {
        success: response.ok,
        status: response.status,
        body: body.substring(0, 500)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveries(webhookId: string, limit: number = 20): Promise<WebhookDelivery[]> {
    const result = await this.pool.query(`
      SELECT * FROM webhook_deliveries
      WHERE webhook_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [webhookId, limit]);
    return result.rows;
  }
}

// ============================================
// Express Route Factory
// ============================================

import { Router, Request, Response } from 'express';

export function createWebhookRoutes(webhookManager: WebhookManager): Router {
  const router = Router();

  // List all webhooks
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const webhooks = await webhookManager.listWebhooks();
      // Hide secrets in list view
      const safeWebhooks = webhooks.map(w => ({
        ...w,
        secret: w.secret ? '***' + w.secret.slice(-4) : null
      }));
      res.json(safeWebhooks);
    } catch (error) {
      console.error('Error listing webhooks:', error);
      res.status(500).json({ error: 'Failed to list webhooks' });
    }
  });

  // Get single webhook
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const webhook = await webhookManager.getWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      // Hide full secret
      res.json({
        ...webhook,
        secret: webhook.secret ? '***' + webhook.secret.slice(-4) : null
      });
    } catch (error) {
      console.error('Error getting webhook:', error);
      res.status(500).json({ error: 'Failed to get webhook' });
    }
  });

  // Create webhook
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, url, events, headers, enabled } = req.body;

      if (!name || !url || !events || !Array.isArray(events)) {
        return res.status(400).json({ 
          error: 'Name, URL, and events array are required' 
        });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }

      // Validate event types
      const validEvents: WebhookEventType[] = [
        'document.indexed', 'document.updated', 'document.deleted',
        'search.performed', 'answer.generated',
        'connector.started', 'connector.completed', 'connector.error'
      ];
      
      for (const event of events) {
        if (!validEvents.includes(event)) {
          return res.status(400).json({ error: `Invalid event type: ${event}` });
        }
      }

      const webhook = await webhookManager.createWebhook({
        name,
        url,
        events,
        headers,
        enabled
      });

      res.status(201).json(webhook);
    } catch (error) {
      console.error('Error creating webhook:', error);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  // Update webhook
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { name, url, events, headers, enabled } = req.body;

      // Validate URL if provided
      if (url) {
        try {
          new URL(url);
        } catch {
          return res.status(400).json({ error: 'Invalid URL' });
        }
      }

      const webhook = await webhookManager.updateWebhook(req.params.id, {
        name,
        url,
        events,
        headers,
        enabled
      });

      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      res.json({
        ...webhook,
        secret: webhook.secret ? '***' + webhook.secret.slice(-4) : null
      });
    } catch (error) {
      console.error('Error updating webhook:', error);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  });

  // Delete webhook
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await webhookManager.deleteWebhook(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  });

  // Regenerate webhook secret
  router.post('/:id/regenerate-secret', async (req: Request, res: Response) => {
    try {
      const secret = await webhookManager.regenerateSecret(req.params.id);
      if (!secret) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.json({ secret });
    } catch (error) {
      console.error('Error regenerating secret:', error);
      res.status(500).json({ error: 'Failed to regenerate secret' });
    }
  });

  // Test webhook
  router.post('/:id/test', async (req: Request, res: Response) => {
    try {
      const result = await webhookManager.testWebhook(req.params.id);
      res.json(result);
    } catch (error) {
      console.error('Error testing webhook:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  });

  // Get webhook deliveries
  router.get('/:id/deliveries', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const deliveries = await webhookManager.getDeliveries(req.params.id, limit);
      res.json(deliveries);
    } catch (error) {
      console.error('Error getting deliveries:', error);
      res.status(500).json({ error: 'Failed to get deliveries' });
    }
  });

  return router;
}
