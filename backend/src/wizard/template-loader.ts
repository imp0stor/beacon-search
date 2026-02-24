/**
 * Integration Template Loader
 * Loads and manages YAML integration templates
 */

import * as fs from 'fs';
import * as path from 'path';
import { IntegrationTemplate } from './types';

// Simple YAML parser for our use case
function parseYaml(content: string): any {
  const lines = content.split('\n');
  const result: any = {};
  const stack: { indent: number; obj: any; key: string }[] = [{ indent: -1, obj: result, key: '' }];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const indent = line.length - trimmed.length;
    
    // Pop stack until we find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].obj;
    
    // Handle array items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim();
      const key = stack[stack.length - 1].key;
      if (!parent[key]) parent[key] = [];
      
      if (value.includes(':')) {
        const obj = {};
        parent[key].push(obj);
        parseInlineObject(value, obj);
        stack.push({ indent, obj, key: '' });
      } else if (value.startsWith('"') || value.startsWith("'")) {
        parent[key].push(value.slice(1, -1));
      } else {
        parent[key].push(parseValue(value));
      }
      continue;
    }
    
    // Handle key: value pairs
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    
    const key = trimmed.substring(0, colonIdx).trim();
    const valueStr = trimmed.substring(colonIdx + 1).trim();
    
    if (valueStr === '' || valueStr === '|' || valueStr === '>') {
      // Nested object or multiline string
      parent[key] = valueStr === '|' || valueStr === '>' ? '' : {};
      stack.push({ indent, obj: parent[key], key });
    } else {
      parent[key] = parseValue(valueStr);
      stack[stack.length - 1].key = key;
    }
  }
  
  return result;
}

function parseValue(str: string): any {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
  if ((str.startsWith('"') && str.endsWith('"')) || 
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  if (str.startsWith('[') && str.endsWith(']')) {
    return str.slice(1, -1).split(',').map(s => parseValue(s.trim()));
  }
  return str;
}

function parseInlineObject(str: string, obj: any): void {
  const pairs = str.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      obj[key] = parseValue(value);
    }
  }
}

export class TemplateLoader {
  private templates: Map<string, IntegrationTemplate> = new Map();
  private templatesDir: string;
  
  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(__dirname, '../../../integrations');
  }
  
  async loadAll(): Promise<void> {
    const categories = ['opensource', 'enterprise'];
    
    for (const category of categories) {
      const categoryDir = path.join(this.templatesDir, category);
      
      if (!fs.existsSync(categoryDir)) continue;
      
      const files = fs.readdirSync(categoryDir);
      
      for (const file of files) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
        
        try {
          const filePath = path.join(categoryDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const template = parseYaml(content) as IntegrationTemplate;
          
          const templateId = file.replace(/\.ya?ml$/, '');
          template.category = category;
          
          this.templates.set(templateId, template);
        } catch (error) {
          console.error(`Failed to load template ${file}:`, error);
        }
      }
    }
    
    console.log(`Loaded ${this.templates.size} integration templates`);
  }
  
  getTemplate(id: string): IntegrationTemplate | undefined {
    return this.templates.get(id);
  }
  
  getAllTemplates(): IntegrationTemplate[] {
    return Array.from(this.templates.values());
  }
  
  getTemplatesByCategory(category: string): IntegrationTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }
  
  searchTemplates(query: string): IntegrationTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTemplates().filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery) ||
      t.category?.toLowerCase().includes(lowerQuery)
    );
  }
  
  getTemplatesByType(type: string): IntegrationTemplate[] {
    return this.getAllTemplates().filter(t => t.type === type);
  }
  
  getCategories(): { category: string; count: number }[] {
    const categories: Record<string, number> = {};
    for (const template of this.templates.values()) {
      const cat = template.category || 'other';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    return Object.entries(categories).map(([category, count]) => ({ category, count }));
  }
  
  // Detect platform from URL
  detectPlatform(url: string): { template: string; confidence: number } | null {
    const urlLower = url.toLowerCase();
    
    const patterns: [RegExp, string, number][] = [
      [/atlassian\.net\/wiki/i, 'confluence', 0.95],
      [/atlassian\.net\/jira/i, 'jira', 0.95],
      [/atlassian\.net/i, 'confluence', 0.7],
      [/sharepoint\.com/i, 'sharepoint', 0.95],
      [/gitlab\.(com|io)/i, 'gitlab', 0.95],
      [/github\.com/i, 'github', 0.95],
      [/notion\.so/i, 'notion', 0.95],
      [/slack\.com/i, 'slack', 0.95],
      [/zendesk\.com/i, 'zendesk', 0.95],
      [/freshdesk\.com/i, 'freshdesk', 0.95],
      [/servicenow\.com/i, 'servicenow', 0.95],
      [/salesforce\.com/i, 'salesforce', 0.95],
      [/box\.com/i, 'box', 0.95],
      [/dropbox\.com/i, 'dropbox', 0.95],
      [/drive\.google\.com/i, 'google-drive', 0.95],
      [/docs\.google\.com/i, 'google-drive', 0.9],
      [/onedrive\.live\.com/i, 'onedrive', 0.95],
      [/getoutline\.com/i, 'outline', 0.95],
      [/app\.asana\.com/i, 'asana', 0.95],
      [/monday\.com/i, 'monday', 0.95],
      [/airtable\.com/i, 'airtable', 0.95],
      [/coda\.io/i, 'coda', 0.95],
      [/intercom\.com/i, 'intercom', 0.95],
      [/hubspot\.com/i, 'hubspot', 0.95],
      [/teams\.microsoft\.com/i, 'teams', 0.95],
      [/mattermost\./i, 'mattermost', 0.8],
      [/rocket\.chat/i, 'rocketchat', 0.9],
      [/discourse\./i, 'discourse', 0.8],
      [/mediawiki\./i, 'mediawiki', 0.8],
      [/wikipedia\.org/i, 'mediawiki', 0.95],
      [/wordpress\./i, 'wordpress', 0.7],
      [/\/wp-json\//i, 'wordpress', 0.9],
      [/ghost\./i, 'ghost', 0.7],
      [/strapi\./i, 'strapi', 0.8],
      [/directus\./i, 'directus', 0.8],
      [/nextcloud\./i, 'nextcloud', 0.8],
      [/bookstackapp\./i, 'bookstack', 0.9],
    ];
    
    for (const [pattern, template, confidence] of patterns) {
      if (pattern.test(urlLower)) {
        if (this.templates.has(template)) {
          return { template, confidence };
        }
      }
    }
    
    return null;
  }
}

// Singleton instance
let loaderInstance: TemplateLoader | null = null;

export async function getTemplateLoader(): Promise<TemplateLoader> {
  if (!loaderInstance) {
    loaderInstance = new TemplateLoader();
    await loaderInstance.loadAll();
  }
  return loaderInstance;
}
