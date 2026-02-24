/**
 * Source Portal Launcher for Beacon Search
 * Provides URL templates and launch actions for source systems
 */

import { Pool } from 'pg';
import { Router, Request, Response } from 'express';

// ============================================
// Source System Detection
// ============================================

export interface SourceSystem {
  type: string;
  name: string;
  icon: string;
  color: string;
}

const SOURCE_SYSTEMS: Record<string, SourceSystem> = {
  confluence: {
    type: 'confluence',
    name: 'Confluence',
    icon: '📘',
    color: '#0052CC'
  },
  notion: {
    type: 'notion',
    name: 'Notion',
    icon: '📝',
    color: '#000000'
  },
  sharepoint: {
    type: 'sharepoint',
    name: 'SharePoint',
    icon: '📂',
    color: '#0078D4'
  },
  github: {
    type: 'github',
    name: 'GitHub',
    icon: '🐙',
    color: '#24292E'
  },
  google_drive: {
    type: 'google_drive',
    name: 'Google Drive',
    icon: '📁',
    color: '#4285F4'
  },
  dropbox: {
    type: 'dropbox',
    name: 'Dropbox',
    icon: '💧',
    color: '#0061FF'
  },
  jira: {
    type: 'jira',
    name: 'Jira',
    icon: '🎫',
    color: '#0052CC'
  },
  slack: {
    type: 'slack',
    name: 'Slack',
    icon: '💬',
    color: '#4A154B'
  },
  web: {
    type: 'web',
    name: 'Web Page',
    icon: '🌐',
    color: '#6B7280'
  },
  folder: {
    type: 'folder',
    name: 'Local Folder',
    icon: '📁',
    color: '#6B7280'
  },
  unknown: {
    type: 'unknown',
    name: 'Unknown',
    icon: '📄',
    color: '#9CA3AF'
  }
};

/**
 * Detect source system from URL or connector config
 */
export function detectSourceSystem(url?: string, connectorType?: string): SourceSystem {
  if (!url && connectorType) {
    return SOURCE_SYSTEMS[connectorType] || SOURCE_SYSTEMS.unknown;
  }

  if (!url) {
    return SOURCE_SYSTEMS.unknown;
  }

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('confluence') || lowerUrl.includes('atlassian.net/wiki')) {
    return SOURCE_SYSTEMS.confluence;
  }
  if (lowerUrl.includes('notion.so') || lowerUrl.includes('notion.site')) {
    return SOURCE_SYSTEMS.notion;
  }
  if (lowerUrl.includes('sharepoint') || lowerUrl.includes('.sharepoint.com')) {
    return SOURCE_SYSTEMS.sharepoint;
  }
  if (lowerUrl.includes('github.com') || lowerUrl.includes('github.io')) {
    return SOURCE_SYSTEMS.github;
  }
  if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) {
    return SOURCE_SYSTEMS.google_drive;
  }
  if (lowerUrl.includes('dropbox.com')) {
    return SOURCE_SYSTEMS.dropbox;
  }
  if (lowerUrl.includes('jira') || lowerUrl.includes('atlassian.net/browse')) {
    return SOURCE_SYSTEMS.jira;
  }
  if (lowerUrl.includes('slack.com')) {
    return SOURCE_SYSTEMS.slack;
  }

  return SOURCE_SYSTEMS.web;
}

// ============================================
// URL Template Resolution
// ============================================

export interface UrlTemplates {
  portal_url?: string;
  item_url_template?: string;
  search_url_template?: string;
  edit_url_template?: string;
}

export interface LaunchAction {
  type: 'open' | 'search' | 'edit';
  label: string;
  url: string;
  icon: string;
  primary?: boolean;
}

/**
 * Resolve a URL template with variables
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
    }
  }
  
  return result;
}

/**
 * Get default URL templates for a source system
 */
export function getDefaultTemplates(sourceSystem: SourceSystem, portalUrl?: string): UrlTemplates {
  const base = portalUrl || '';
  
  switch (sourceSystem.type) {
    case 'confluence':
      return {
        portal_url: base,
        item_url_template: `${base}/pages/viewpage.action?pageId={external_id}`,
        search_url_template: `${base}/dosearchsite.action?queryString={query}`,
        edit_url_template: `${base}/pages/editpage.action?pageId={external_id}`
      };
    
    case 'notion':
      return {
        portal_url: base,
        item_url_template: `${base}/{external_id}`,
        search_url_template: `${base}/search?q={query}`,
        edit_url_template: `${base}/{external_id}`
      };
    
    case 'sharepoint':
      return {
        portal_url: base,
        item_url_template: `${base}/_layouts/15/Doc.aspx?sourcedoc={external_id}`,
        search_url_template: `${base}/_layouts/15/osssearchresults.aspx?k={query}`,
        edit_url_template: `${base}/_layouts/15/Doc.aspx?sourcedoc={external_id}&action=edit`
      };
    
    case 'github':
      return {
        portal_url: base,
        item_url_template: `${base}/blob/main/{external_id}`,
        search_url_template: `${base}/search?q={query}`,
        edit_url_template: `${base}/edit/main/{external_id}`
      };
    
    case 'google_drive':
      return {
        portal_url: 'https://drive.google.com',
        item_url_template: `https://drive.google.com/file/d/{external_id}/view`,
        search_url_template: `https://drive.google.com/drive/search?q={query}`,
        edit_url_template: `https://drive.google.com/file/d/{external_id}/edit`
      };
    
    case 'jira':
      return {
        portal_url: base,
        item_url_template: `${base}/browse/{external_id}`,
        search_url_template: `${base}/issues/?jql=text~"{query}"`,
        edit_url_template: `${base}/browse/{external_id}`
      };
    
    default:
      return {
        portal_url: base,
        item_url_template: base ? `${base}/{external_id}` : undefined,
        search_url_template: base ? `${base}/search?q={query}` : undefined
      };
  }
}

// ============================================
// Source Portal Manager
// ============================================

export class SourcePortalManager {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get source URL for a document
   */
  async getSourceUrl(documentId: string): Promise<string | null> {
    const result = await this.pool.query(`
      SELECT d.url, d.external_id, d.source_id,
             c.config, c.connector_type,
             c.portal_url, c.item_url_template
      FROM documents d
      LEFT JOIN connectors c ON d.source_id = c.id
      WHERE d.id = $1
    `, [documentId]);

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0];

    // If document has direct URL, use it
    if (doc.url) {
      return doc.url;
    }

    // If connector has item URL template, resolve it
    if (doc.item_url_template && doc.external_id) {
      return resolveTemplate(doc.item_url_template, {
        portal_url: doc.portal_url,
        external_id: doc.external_id
      });
    }

    // Try to construct URL from connector config
    if (doc.config && doc.external_id) {
      const config = typeof doc.config === 'string' ? JSON.parse(doc.config) : doc.config;
      const sourceSystem = detectSourceSystem(config.seedUrl || config.portalUrl, doc.connector_type);
      const templates = getDefaultTemplates(sourceSystem, config.seedUrl || config.portalUrl || doc.portal_url);
      
      if (templates.item_url_template) {
        return resolveTemplate(templates.item_url_template, {
          portal_url: templates.portal_url,
          external_id: doc.external_id
        });
      }
    }

    return null;
  }

  /**
   * Get available launch actions for a document
   */
  async getActions(documentId: string, query?: string): Promise<LaunchAction[]> {
    const result = await this.pool.query(`
      SELECT d.id, d.url, d.external_id, d.source_id, d.title,
             c.config, c.connector_type, c.name as connector_name,
             c.portal_url, c.item_url_template, c.search_url_template, c.edit_url_template
      FROM documents d
      LEFT JOIN connectors c ON d.source_id = c.id
      WHERE d.id = $1
    `, [documentId]);

    if (result.rows.length === 0) {
      return [];
    }

    const doc = result.rows[0];
    const actions: LaunchAction[] = [];

    // Determine source system
    const config = doc.config ? (typeof doc.config === 'string' ? JSON.parse(doc.config) : doc.config) : {};
    const sourceUrl = doc.url || config.seedUrl || config.portalUrl || doc.portal_url;
    const sourceSystem = detectSourceSystem(sourceUrl, doc.connector_type);
    
    // Get templates (use connector overrides if available, otherwise defaults)
    const defaultTemplates = getDefaultTemplates(sourceSystem, config.seedUrl || doc.portal_url);
    const templates: UrlTemplates = {
      portal_url: doc.portal_url || defaultTemplates.portal_url,
      item_url_template: doc.item_url_template || defaultTemplates.item_url_template,
      search_url_template: doc.search_url_template || defaultTemplates.search_url_template,
      edit_url_template: doc.edit_url_template || defaultTemplates.edit_url_template
    };

    const variables = {
      portal_url: templates.portal_url,
      external_id: doc.external_id,
      query: query || doc.title
    };

    // Open in Source action
    let openUrl = doc.url;
    if (!openUrl && templates.item_url_template && doc.external_id) {
      openUrl = resolveTemplate(templates.item_url_template, variables);
    }
    
    if (openUrl) {
      actions.push({
        type: 'open',
        label: `Open in ${sourceSystem.name}`,
        url: openUrl,
        icon: sourceSystem.icon,
        primary: true
      });
    }

    // Search in Source action
    if (templates.search_url_template) {
      actions.push({
        type: 'search',
        label: `Search in ${sourceSystem.name}`,
        url: resolveTemplate(templates.search_url_template, variables),
        icon: '🔍'
      });
    }

    // Edit Original action
    if (templates.edit_url_template && doc.external_id) {
      actions.push({
        type: 'edit',
        label: `Edit in ${sourceSystem.name}`,
        url: resolveTemplate(templates.edit_url_template, variables),
        icon: '✏️'
      });
    }

    return actions;
  }

  /**
   * Get source system info for a document
   */
  async getSourceInfo(documentId: string): Promise<{
    sourceSystem: SourceSystem;
    connectorName?: string;
    portalUrl?: string;
  } | null> {
    const result = await this.pool.query(`
      SELECT d.url, d.source_id,
             c.config, c.connector_type, c.name as connector_name, c.portal_url
      FROM documents d
      LEFT JOIN connectors c ON d.source_id = c.id
      WHERE d.id = $1
    `, [documentId]);

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0];
    const config = doc.config ? (typeof doc.config === 'string' ? JSON.parse(doc.config) : doc.config) : {};
    const sourceUrl = doc.url || config.seedUrl || config.portalUrl || doc.portal_url;
    
    return {
      sourceSystem: detectSourceSystem(sourceUrl, doc.connector_type),
      connectorName: doc.connector_name,
      portalUrl: doc.portal_url || config.seedUrl
    };
  }

  /**
   * Update URL templates for a connector
   */
  async updateConnectorTemplates(
    connectorId: string,
    templates: UrlTemplates
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
      connectorId,
      templates.portal_url,
      templates.item_url_template,
      templates.search_url_template,
      templates.edit_url_template
    ]);

    return result.rows.length > 0;
  }
}

// ============================================
// Express Route Factory
// ============================================

export function createSourcePortalRoutes(portalManager: SourcePortalManager): Router {
  const router = Router();

  // Get source URL for a document
  router.get('/:id/source-url', async (req: Request, res: Response) => {
    try {
      const url = await portalManager.getSourceUrl(req.params.id);
      
      if (!url) {
        return res.status(404).json({ error: 'Source URL not available' });
      }

      res.json({ url });
    } catch (error) {
      console.error('Error getting source URL:', error);
      res.status(500).json({ error: 'Failed to get source URL' });
    }
  });

  // Get launch actions for a document
  router.get('/:id/actions', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const actions = await portalManager.getActions(req.params.id, query);
      res.json(actions);
    } catch (error) {
      console.error('Error getting actions:', error);
      res.status(500).json({ error: 'Failed to get actions' });
    }
  });

  // Get source system info for a document
  router.get('/:id/source-info', async (req: Request, res: Response) => {
    try {
      const info = await portalManager.getSourceInfo(req.params.id);
      
      if (!info) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json(info);
    } catch (error) {
      console.error('Error getting source info:', error);
      res.status(500).json({ error: 'Failed to get source info' });
    }
  });

  return router;
}
