/**
 * AI Config Wizard
 * Natural language interface for building integration configs
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  WizardSession, 
  WizardMessage, 
  WizardState,
  IntegrationTemplate,
  SourceConfig,
  ValidationResult,
  TestResult,
  PlatformDetectionResult
} from './types';
import { getTemplateLoader, TemplateLoader } from './template-loader';

// In-memory session storage (replace with Redis/DB in production)
const sessions = new Map<string, WizardSession>();

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function createWizardRoutes(): Router {
  const router = Router();
  
  // Start new wizard session
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { platform, url } = req.body;
      const loader = await getTemplateLoader();
      
      const session: WizardSession = {
        id: uuidv4(),
        platform: platform,
        config: {},
        messages: [],
        state: 'init',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // If URL provided, try to detect platform
      if (url) {
        const detected = loader.detectPlatform(url);
        if (detected) {
          session.platform = detected.template;
          session.template = loader.getTemplate(detected.template);
        }
      }
      
      // If platform specified, load template
      if (platform && !session.template) {
        session.template = loader.getTemplate(platform);
      }
      
      // Generate initial assistant message
      const initialMessage = await generateInitialMessage(session, loader);
      session.messages.push({
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date()
      });
      
      session.state = session.template ? 'auth_config' : 'platform_selection';
      sessions.set(session.id, session);
      
      res.json({
        sessionId: session.id,
        state: session.state,
        platform: session.platform,
        template: session.template ? {
          name: session.template.name,
          description: session.template.description,
          icon: session.template.icon,
          auth: session.template.auth
        } : null,
        message: initialMessage
      });
    } catch (error) {
      console.error('Wizard start error:', error);
      res.status(500).json({ error: 'Failed to start wizard session' });
    }
  });
  
  // Chat with wizard
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: 'sessionId and message are required' });
      }
      
      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Add user message
      session.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });
      
      // Process message and generate response
      const loader = await getTemplateLoader();
      const response = await processUserMessage(session, message, loader);
      
      session.messages.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: response.metadata
      });
      
      session.updatedAt = new Date();
      
      res.json({
        sessionId: session.id,
        state: session.state,
        message: response.message,
        config: session.config,
        suggestions: response.suggestions,
        validationErrors: response.validationErrors
      });
    } catch (error) {
      console.error('Wizard chat error:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });
  
  // List available templates
  router.get('/templates', async (_req: Request, res: Response) => {
    try {
      const loader = await getTemplateLoader();
      const templates = loader.getAllTemplates();
      
      const grouped = templates.reduce((acc, t) => {
        const cat = t.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({
          id: t.name.toLowerCase().replace(/\s+/g, '-'),
          name: t.name,
          description: t.description,
          icon: t.icon,
          type: t.type,
          authType: t.auth?.type,
          features: t.features || []
        });
        return acc;
      }, {} as Record<string, any[]>);
      
      res.json({
        categories: loader.getCategories(),
        templates: grouped,
        total: templates.length
      });
    } catch (error) {
      console.error('Templates list error:', error);
      res.status(500).json({ error: 'Failed to list templates' });
    }
  });
  
  // Get specific template
  router.get('/templates/:id', async (req: Request, res: Response) => {
    try {
      const loader = await getTemplateLoader();
      const template = loader.getTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error) {
      console.error('Template fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });
  
  // Detect platform from URL
  router.post('/detect', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      const loader = await getTemplateLoader();
      const detected = loader.detectPlatform(url);
      
      if (detected) {
        res.json({
          detected: true,
          platform: detected.template,
          confidence: detected.confidence,
          template: detected.template
        } as PlatformDetectionResult);
      } else {
        // Try to suggest based on URL patterns
        const suggestions = suggestFromUrl(url, loader);
        res.json({
          detected: false,
          suggestions,
          confidence: 0
        } as PlatformDetectionResult);
      }
    } catch (error) {
      console.error('Platform detection error:', error);
      res.status(500).json({ error: 'Failed to detect platform' });
    }
  });
  
  // Validate config
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { config, templateId } = req.body;
      
      const loader = await getTemplateLoader();
      const template = templateId ? loader.getTemplate(templateId) ?? null : null;
      
      const result = validateConfig(config, template);
      res.json(result);
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ error: 'Failed to validate config' });
    }
  });
  
  // Test connection
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const { config, templateId } = req.body;
      
      const loader = await getTemplateLoader();
      const template = templateId ? loader.getTemplate(templateId) ?? null : null;
      
      const result = await testConnection(config, template);
      res.json(result);
    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({ error: 'Failed to test connection' });
    }
  });
  
  // Generate final config
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      const session = sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const config = generateFinalConfig(session);
      
      res.json({
        config,
        yaml: configToYaml(config)
      });
    } catch (error) {
      console.error('Config generation error:', error);
      res.status(500).json({ error: 'Failed to generate config' });
    }
  });
  
  // Get session state
  router.get('/session/:id', (req: Request, res: Response) => {
    const session = sessions.get(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      id: session.id,
      state: session.state,
      platform: session.platform,
      config: session.config,
      messages: session.messages.slice(-10),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
  });
  
  return router;
}

// Helper functions

async function generateInitialMessage(session: WizardSession, loader: TemplateLoader): Promise<string> {
  if (session.template) {
    const template = session.template;
    const authFields = template.auth?.fields || [];
    const requiredFields = authFields.filter(f => f.required).map(f => f.label);
    
    return `I'll help you set up a connection to **${template.name}**. ${template.description || ''}\n\n` +
      `To get started, I'll need the following information:\n` +
      requiredFields.map(f => `• ${f}`).join('\n') +
      `\n\nYou can provide these details in natural language, like: "My ${template.name} is at https://example.com and my API key is abc123"`;
  }
  
  const categories = loader.getCategories();
  const topCategories = categories.slice(0, 5).map(c => c.category);
  
  return `Welcome to the Beacon Search integration wizard! 🔍\n\n` +
    `I can help you connect to various platforms. What would you like to integrate?\n\n` +
    `**Popular platforms:**\n` +
    `• Documentation: Confluence, Notion, Outline, GitLab Wiki\n` +
    `• Cloud Storage: SharePoint, Google Drive, Dropbox, Box\n` +
    `• Helpdesk: Zendesk, Freshdesk, ServiceNow\n` +
    `• Messaging: Slack, Teams, Mattermost\n` +
    `• Project Management: Jira, Asana, Monday.com\n\n` +
    `You can tell me the platform name, paste a URL, or describe what you want to integrate.`;
}

async function processUserMessage(
  session: WizardSession, 
  message: string, 
  loader: TemplateLoader
): Promise<{ message: string; suggestions?: string[]; validationErrors?: string[]; metadata?: any }> {
  const lowerMessage = message.toLowerCase();
  
  // Platform selection state
  if (session.state === 'platform_selection' || session.state === 'init') {
    // Check if message contains a URL
    const urlMatch = message.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const detected = loader.detectPlatform(urlMatch[0]);
      if (detected) {
        session.template = loader.getTemplate(detected.template);
        session.platform = detected.template;
        session.state = 'auth_config';
        session.config.auth = session.config.auth || {};
        
        // Extract base URL
        try {
          const url = new URL(urlMatch[0]);
          session.config.auth.base_url = `${url.protocol}//${url.host}`;
        } catch {}
        
        return {
          message: `Great! I detected this is a **${session.template?.name}** instance.\n\n` +
            `I've set the base URL to ${session.config.auth.base_url}.\n\n` +
            getAuthInstructions(session.template!),
          metadata: { detected: detected.template, confidence: detected.confidence }
        };
      }
    }
    
    // Search for platform by name
    const templates = loader.searchTemplates(message);
    if (templates.length === 1) {
      session.template = templates[0];
      session.platform = templates[0].name.toLowerCase().replace(/\s+/g, '-');
      session.state = 'auth_config';
      
      return {
        message: `Perfect! Let's set up **${session.template.name}**.\n\n` +
          getAuthInstructions(session.template),
        metadata: { platform: session.platform }
      };
    } else if (templates.length > 1) {
      return {
        message: `I found multiple matching platforms. Which one do you mean?\n\n` +
          templates.slice(0, 5).map(t => `• **${t.name}** - ${t.description}`).join('\n'),
        suggestions: templates.slice(0, 5).map(t => t.name)
      };
    }
    
    return {
      message: `I'm not sure which platform you mean. Could you provide more details or paste a URL?`,
      suggestions: ['Confluence', 'SharePoint', 'Notion', 'Zendesk', 'Slack']
    };
  }
  
  // Auth configuration state
  if (session.state === 'auth_config') {
    const template = session.template;
    if (!template) {
      session.state = 'platform_selection';
      return { message: 'Let\'s start over. Which platform do you want to integrate?' };
    }
    
    // Extract auth fields from message
    const extractedFields = extractAuthFields(message, template);
    session.config.auth = { ...session.config.auth, ...extractedFields };
    
    // Check what's still missing
    const requiredFields = template.auth?.fields?.filter(f => f.required) || [];
    const missingFields = requiredFields.filter(f => !session.config.auth?.[f.name]);
    
    if (missingFields.length === 0) {
      session.state = 'testing';
      return {
        message: `Great! I have all the required information. Let me test the connection...\n\n` +
          `Configuration so far:\n` +
          Object.entries(session.config.auth || {})
            .filter(([k]) => !k.includes('secret') && !k.includes('password') && !k.includes('token'))
            .map(([k, v]) => `• ${k}: ${v}`)
            .join('\n') +
          `\n\nWould you like me to test this configuration?`,
        suggestions: ['Yes, test it', 'Add more settings', 'Show full config']
      };
    }
    
    const nextField = missingFields[0];
    return {
      message: `Got it! I still need the **${nextField.label}**.\n\n` +
        (nextField.help ? `💡 ${nextField.help}\n\n` : '') +
        `What is your ${nextField.label.toLowerCase()}?`,
      validationErrors: missingFields.map(f => `Missing: ${f.label}`)
    };
  }
  
  // Testing state
  if (session.state === 'testing') {
    if (lowerMessage.includes('yes') || lowerMessage.includes('test')) {
      const result = await testConnection(session.config, session.template!);
      
      if (result.success) {
        session.state = 'complete';
        return {
          message: `✅ Connection successful!\n\n` +
            (result.details?.sample_documents ? `Found ${result.details.sample_documents} sample documents.\n\n` : '') +
            `Your integration is ready. Would you like me to:\n` +
            `• Generate the final YAML config\n` +
            `• Add additional filters or settings\n` +
            `• Set up a sync schedule`,
          suggestions: ['Generate config', 'Add filters', 'Set schedule']
        };
      } else {
        return {
          message: `❌ Connection failed: ${result.message}\n\n` +
            `Please check your credentials and try again. Common issues:\n` +
            `• API token may have expired\n` +
            `• URL might be incorrect\n` +
            `• Permissions may be insufficient\n\n` +
            `What would you like to update?`,
          validationErrors: result.details?.errors
        };
      }
    }
  }
  
  // Complete state - generate config or adjust
  if (session.state === 'complete') {
    if (lowerMessage.includes('generate') || lowerMessage.includes('config') || lowerMessage.includes('yaml')) {
      const config = generateFinalConfig(session);
      return {
        message: `Here's your configuration:\n\n\`\`\`yaml\n${configToYaml(config)}\n\`\`\`\n\n` +
          `Save this to your config-repo/sources/ directory and the integration will be active.`,
        metadata: { config }
      };
    }
  }
  
  // Use AI for complex queries
  if (OPENAI_API_KEY) {
    return await generateAIResponse(session, message);
  }
  
  return {
    message: `I'm not sure how to help with that. Could you rephrase your request?`,
    suggestions: ['Start over', 'Show config', 'Test connection']
  };
}

function getAuthInstructions(template: IntegrationTemplate): string {
  const auth = template.auth;
  if (!auth) return 'Please provide your authentication details.';
  
  const requiredFields = auth.fields?.filter(f => f.required) || [];
  
  let instructions = '';
  
  switch (auth.type) {
    case 'oauth2':
      instructions = `This integration uses OAuth 2.0. You'll need:\n`;
      break;
    case 'api_key':
      instructions = `This integration uses API key authentication. You'll need:\n`;
      break;
    case 'basic':
      instructions = `This integration uses basic authentication. You'll need:\n`;
      break;
    case 'token':
      instructions = `This integration uses token authentication. You'll need:\n`;
      break;
    default:
      instructions = `Please provide:\n`;
  }
  
  instructions += requiredFields.map(f => 
    `• **${f.label}**${f.help ? ` - ${f.help}` : ''}`
  ).join('\n');
  
  return instructions;
}

function extractAuthFields(message: string, template: IntegrationTemplate): Record<string, string> {
  const fields: Record<string, string> = {};
  const authFields = template.auth?.fields || [];
  
  // Extract URLs
  const urlMatch = message.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const urlField = authFields.find(f => f.type === 'url' || f.name.includes('url'));
    if (urlField) {
      fields[urlField.name] = urlMatch[0].replace(/\/$/, '');
    }
  }
  
  // Extract emails
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
  if (emailMatch) {
    const emailField = authFields.find(f => f.type === 'email' || f.name.includes('email') || f.name.includes('username'));
    if (emailField) {
      fields[emailField.name] = emailMatch[0];
    }
  }
  
  // Extract API keys/tokens (common patterns)
  const patterns = [
    { pattern: /api[_\s-]?key[:\s]+([^\s]+)/i, fields: ['api_key', 'apikey', 'key'] },
    { pattern: /token[:\s]+([^\s]+)/i, fields: ['token', 'access_token', 'api_token'] },
    { pattern: /secret[:\s]+([^\s]+)/i, fields: ['secret', 'client_secret', 'api_secret'] },
    { pattern: /password[:\s]+([^\s]+)/i, fields: ['password'] },
  ];
  
  for (const { pattern, fields: fieldNames } of patterns) {
    const match = message.match(pattern);
    if (match) {
      const targetField = authFields.find(f => fieldNames.includes(f.name.toLowerCase()));
      if (targetField) {
        fields[targetField.name] = match[1];
      }
    }
  }
  
  // Extract tenant/subdomain
  const tenantPatterns = [
    /tenant[:\s]+([^\s]+)/i,
    /subdomain[:\s]+([^\s]+)/i,
    /instance[:\s]+([^\s]+)/i,
  ];
  
  for (const pattern of tenantPatterns) {
    const match = message.match(pattern);
    if (match) {
      const targetField = authFields.find(f => 
        f.name.includes('tenant') || f.name.includes('subdomain') || f.name.includes('domain')
      );
      if (targetField) {
        fields[targetField.name] = match[1];
      }
    }
  }
  
  return fields;
}

function validateConfig(config: Partial<SourceConfig>, template: IntegrationTemplate | null): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];
  const warnings: { field: string; message: string; suggestion?: string }[] = [];
  
  if (!config.name) {
    errors.push({ field: 'name', message: 'Source name is required', code: 'REQUIRED' });
  }
  
  if (template?.auth) {
    const requiredFields = template.auth.fields?.filter(f => f.required) || [];
    for (const field of requiredFields) {
      if (!config.auth?.[field.name]) {
        errors.push({ 
          field: `auth.${field.name}`, 
          message: `${field.label} is required`, 
          code: 'REQUIRED' 
        });
      }
    }
  }
  
  // URL validation
  if (config.auth?.base_url) {
    try {
      new URL(config.auth.base_url);
    } catch {
      errors.push({ field: 'auth.base_url', message: 'Invalid URL format', code: 'INVALID_URL' });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function testConnection(config: Partial<SourceConfig>, template: IntegrationTemplate | null): Promise<TestResult> {
  // Mock implementation - in production, actually test the connection
  if (!template) {
    return { success: false, message: 'No template specified' };
  }
  
  if (!config.auth) {
    return { success: false, message: 'No authentication configured' };
  }
  
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // For demo, check if required fields are present
  const requiredFields = template.auth?.fields?.filter(f => f.required) || [];
  const missingFields = requiredFields.filter(f => !config.auth?.[f.name]);
  
  if (missingFields.length > 0) {
    return {
      success: false,
      message: `Missing required fields: ${missingFields.map(f => f.label).join(', ')}`,
      details: {
        auth_status: 'failed',
        errors: missingFields.map(f => `Missing: ${f.label}`)
      }
    };
  }
  
  return {
    success: true,
    message: 'Connection successful',
    details: {
      auth_status: 'ok',
      sample_documents: Math.floor(Math.random() * 100) + 10
    }
  };
}

function generateFinalConfig(session: WizardSession): SourceConfig {
  return {
    name: session.config.name || `${session.template?.name} Integration`,
    description: session.config.description || `Auto-generated ${session.template?.name} integration`,
    template: session.platform || '',
    auth: session.config.auth || {},
    filters: session.config.filters,
    schedule: session.config.schedule || {
      type: 'interval',
      interval_minutes: 60
    },
    enabled: true
  };
}

function configToYaml(config: SourceConfig): string {
  const lines: string[] = [];
  
  lines.push(`name: "${config.name}"`);
  if (config.description) lines.push(`description: "${config.description}"`);
  lines.push(`template: "${config.template}"`);
  lines.push(`enabled: ${config.enabled}`);
  lines.push('');
  lines.push('auth:');
  for (const [key, value] of Object.entries(config.auth || {})) {
    if (key.includes('secret') || key.includes('password') || key.includes('token')) {
      lines.push(`  ${key}: "\${${key.toUpperCase()}}"`);
    } else {
      lines.push(`  ${key}: "${value}"`);
    }
  }
  
  if (config.filters) {
    lines.push('');
    lines.push('filters:');
    for (const [key, value] of Object.entries(config.filters)) {
      if (Array.isArray(value)) {
        lines.push(`  ${key}:`);
        for (const item of value) {
          lines.push(`    - "${item}"`);
        }
      } else {
        lines.push(`  ${key}: "${value}"`);
      }
    }
  }
  
  if (config.schedule) {
    lines.push('');
    lines.push('schedule:');
    lines.push(`  type: "${config.schedule.type}"`);
    if (config.schedule.interval_minutes) {
      lines.push(`  interval_minutes: ${config.schedule.interval_minutes}`);
    }
    if (config.schedule.cron_expression) {
      lines.push(`  cron: "${config.schedule.cron_expression}"`);
    }
  }
  
  return lines.join('\n');
}

function suggestFromUrl(url: string, loader: TemplateLoader): string[] {
  const suggestions: string[] = [];
  
  // Check for API indicators
  if (url.includes('/api/') || url.includes('/rest/')) {
    suggestions.push('This looks like an API endpoint. It might be a custom REST API.');
  }
  
  // Check for wiki patterns
  if (url.includes('/wiki') || url.includes('/docs') || url.includes('/kb')) {
    const wikiTemplates = loader.getTemplatesByType('rest')
      .filter(t => t.category === 'wiki' || t.category === 'documentation')
      .slice(0, 3);
    suggestions.push(...wikiTemplates.map(t => t.name));
  }
  
  return suggestions;
}

async function generateAIResponse(
  session: WizardSession, 
  message: string
): Promise<{ message: string; suggestions?: string[]; metadata?: any }> {
  const systemPrompt = `You are a helpful assistant for the Beacon Search integration wizard.
You help users configure data source integrations. Be concise and helpful.
Current state: ${session.state}
Platform: ${session.template?.name || 'Not selected'}
Current config: ${JSON.stringify(session.config, null, 2)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...session.messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error('OpenAI API error');
    }
    
    const data = await response.json() as { choices: { message: { content: string } }[] };
    return { message: data.choices[0]?.message?.content || 'I apologize, I couldn\'t generate a response.' };
  } catch (error) {
    return { message: 'I\'m having trouble processing that. Could you try rephrasing?' };
  }
}
