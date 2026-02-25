import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { pipeline, env } from '@xenova/transformers';
import { ConnectorManager, createConnectorRoutes } from './connectors';
import { WebhookManager, createWebhookRoutes } from './webhooks';
import { SourcePortalManager, createSourcePortalRoutes } from './source-portal';
import { processRoutes, createUxRoutes } from './routes';
import { createAnalyticsRoutes } from './routes/analytics';
import { getConfig } from './processors';
import { createWizardRoutes } from './wizard';
import { rewriteQuery } from './search/query-rewrite';
import { exportOntology, importOntology } from './search/ontology-service';
import { QueryRewriteExplanation } from './search/types';
import { createPodcastRoutes } from './podcasts/routes';
import { createTvRoutes } from './tv/routes';
import { createMovieRoutes } from './movies/routes';
import { createMediaRoutes } from './media/routes';
import { createFrpeiRoutes } from './frpei/routes';
import { PluginManager, WoTPlugin, PluginContext, CacheClient } from './plugins';

// Disable local model caching issues in Docker
env.cacheDir = '/tmp/transformers-cache';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://beacon:beacon_secret@localhost:5432/beacon_search'
});

// OpenAI API for RAG
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Embedding model (loaded once)
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded!');
  }
  return embedder;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Initialize connector manager
const connectorManager = new ConnectorManager(pool, generateEmbedding);

// Initialize webhook manager
const webhookManager = new WebhookManager(pool);

// Connect webhook manager to connector manager for event emissions
connectorManager.setWebhookEmitter(webhookManager);

// Initialize source portal manager
const sourcePortalManager = new SourcePortalManager(pool);

// Export webhook manager for use in other modules
export { webhookManager };

// ============================================
// PLUGIN MANAGER
// ============================================

// Simple in-memory cache implementing CacheClient
const _pluginCache = new Map<string, { value: any; expires: number }>();
const pluginCacheClient: CacheClient = {
  async get(key: string) {
    const entry = _pluginCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { _pluginCache.delete(key); return null; }
    return entry.value;
  },
  async set(key: string, value: any, ttl = 3600) {
    _pluginCache.set(key, { value, expires: Date.now() + ttl * 1000 });
  },
  async del(key: string) {
    _pluginCache.delete(key);
  },
};

const pluginContext: PluginContext = {
  db: pool,
  config: {},
  logger: {
    info: (msg: string, ...args: any[]) => console.log('[plugin]', msg, ...args),
    warn: (msg: string, ...args: any[]) => console.warn('[plugin]', msg, ...args),
    error: (msg: string, ...args: any[]) => console.error('[plugin]', msg, ...args),
    debug: (msg: string, ...args: any[]) => console.debug('[plugin]', msg, ...args),
  },
  cache: pluginCacheClient,
};

const wotConfig = {
  enabled: process.env.WOT_ENABLED === 'true',
  provider: (process.env.WOT_PROVIDER || 'local') as 'nostrmaxi' | 'local',
  nostrmaxi_url: process.env.NOSTRMAXI_URL || 'http://localhost:3000',
  weight: parseFloat(process.env.WOT_WEIGHT || '1.0'),
  cache_ttl: parseInt(process.env.WOT_CACHE_TTL || '3600'),
};

const pluginManager = new PluginManager(pluginContext);
pluginManager.register(new WoTPlugin(wotConfig));
// Initialize plugins asynchronously (non-blocking startup)
pluginManager.initAll().catch((err) => console.error('Plugin init failed:', err));

// ============================================
// TYPES
// ============================================

interface Trigger {
  id: string;
  name: string;
  pattern: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  enabled: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Evaluate triggers against query
async function evaluateTriggers(query: string): Promise<Trigger[]> {
  const result = await pool.query(`
    SELECT * FROM triggers
    WHERE enabled = true
    ORDER BY priority DESC
  `);
  
  const matchedTriggers: Trigger[] = [];
  
  for (const trigger of result.rows) {
    try {
      const regex = new RegExp(trigger.pattern, 'i');
      if (regex.test(query)) {
        // Check additional conditions if present
        const conditions = trigger.conditions || {};
        let conditionsMet = true;
        
        if (conditions.min_terms) {
          const termCount = query.split(/\s+/).length;
          if (termCount < conditions.min_terms) {
            conditionsMet = false;
          }
        }
        
        if (conditionsMet) {
          matchedTriggers.push(trigger);
        }
      }
    } catch (e) {
      console.error(`Invalid trigger pattern: ${trigger.pattern}`, e);
    }
  }
  
  return matchedTriggers;
}

function sanitizeTsqueryToken(term: string): string | null {
  const cleaned = term.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return cleaned.length ? cleaned : null;
}

function buildFallbackTsQuery(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map(token => sanitizeTsqueryToken(token))
    .filter(Boolean) as string[];
  return tokens.length ? tokens.join(' | ') : query;
}

// Apply expansion-aware boosts to results
function applyExpansionBoost(results: any[], rewrite: { originalTerms: string[]; weightedTerms: { term: string; weight: number; source: string }[] }) {
  const config = {
    exactMatchBoost: 0.08,
    conceptMatchBoost: 0.06,
    expansionMatchBoost: 0.03,
    minBoostWeight: 0.6,
    maxBoost: 0.35
  };

  return results.map(doc => {
    const haystack = `${doc.title || ''} ${doc.content || ''}`.toLowerCase();
    let boost = 0;

    for (const term of rewrite.originalTerms) {
      if (term && haystack.includes(term.toLowerCase())) {
        boost += config.exactMatchBoost;
      }
    }

    for (const term of rewrite.weightedTerms) {
      if (term.weight < config.minBoostWeight) continue;
      if (term.source === 'fuzzy') continue;
      if (term.term && haystack.includes(term.term.toLowerCase())) {
        boost += term.source === 'concept' ? config.conceptMatchBoost : config.expansionMatchBoost * term.weight;
      }
    }

    boost = Math.min(boost, config.maxBoost);
    return { ...doc, score: doc.score + boost };
  });
}

// Call OpenAI API
async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
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
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || '';
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  
  // Check database
  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    checks.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'error', error: (err as Error).message };
  }
  
  // Check embedding model
  try {
    const embedStart = Date.now();
    if (embedder) {
      checks.embedding = { status: 'ok', latency: Date.now() - embedStart };
    } else {
      checks.embedding = { status: 'not_loaded' };
    }
  } catch (err) {
    checks.embedding = { status: 'error', error: (err as Error).message };
  }
  
  // Overall status
  const allOk = Object.values(checks).every(c => c.status === 'ok' || c.status === 'not_loaded');
  
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks
  });
});

// ============================================
// RAG QUERY ENDPOINT
// ============================================

app.post('/api/ask', async (req: Request, res: Response) => {
  try {
    const { question, limit = 5, sourceId } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API not configured. Set OPENAI_API_KEY environment variable.' });
    }
    
    // Generate embedding for the question
    const embedding = await generateEmbedding(question);
    const vectorStr = `[${embedding.join(',')}]`;
    
    // Retrieve relevant documents via vector similarity
    const query = sourceId
      ? `SELECT id, title, content, url, source_id,
                1 - (embedding <=> $1::vector) as score
         FROM documents
         WHERE embedding IS NOT NULL AND source_id = $3
         ORDER BY embedding <=> $1::vector
         LIMIT $2`
      : `SELECT id, title, content, url, source_id,
                1 - (embedding <=> $1::vector) as score
         FROM documents
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`;
    
    const results = await pool.query(query, 
      sourceId ? [vectorStr, limit, sourceId] : [vectorStr, limit]
    );
    
    if (results.rows.length === 0) {
      return res.json({
        question,
        answer: "I couldn't find any relevant documents to answer your question.",
        sources: []
      });
    }
    
    // Format context from retrieved documents
    const context = results.rows.map((doc, i) => 
      `[Source ${i + 1}: ${doc.title}]\n${doc.content.substring(0, 1500)}`
    ).join('\n\n---\n\n');
    
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context. 
Always cite your sources by mentioning [Source N] when using information from a document.
If the context doesn't contain enough information to fully answer the question, acknowledge what you can answer and what you cannot.
Be concise but thorough.`;
    
    const userPrompt = `Context:\n${context}\n\n---\n\nQuestion: ${question}\n\nPlease answer the question based on the provided context, citing sources where appropriate.`;
    
    // Call OpenAI
    const answer = await callOpenAI(userPrompt, systemPrompt);
    
    // Format sources for response
    const sources = results.rows.map((doc, i) => ({
      index: i + 1,
      id: doc.id,
      title: doc.title,
      url: doc.url,
      score: doc.score,
      excerpt: doc.content.substring(0, 300) + '...'
    }));
    
    const response = {
      question,
      answer,
      sources,
      model: OPENAI_MODEL
    };

    // Emit webhook event (non-blocking)
    webhookManager.emit('answer.generated', {
      question,
      answer_length: answer.length,
      sources_count: sources.length,
      model: OPENAI_MODEL
    }).catch(console.error);

    res.json(response);
    
  } catch (error) {
    console.error('RAG query error:', error);
    res.status(500).json({ error: 'Failed to process question', details: (error as Error).message });
  }
});

// ============================================
// ENHANCED SEARCH ENDPOINT
// ============================================

app.get('/api/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const fetchLimit = Math.max(limit + offset, limit);
    const mode = req.query.mode as string || 'hybrid';
    const sourceId = req.query.sourceId as string;
    const explain = req.query.explain === 'true';
    const expand = req.query.expand !== 'false'; // Enable expansion by default
    const user_pubkey = req.query.user_pubkey as string | undefined;
    const wot_enabled = req.query.wot_enabled !== 'false';
    const content_type = req.query.content_type as string | undefined;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const enableFuzzy = req.query.fuzzy !== 'false';
    const enableAbbrev = req.query.abbrev !== 'false';

    const rewrite = await rewriteQuery(pool, query, {
      expand,
      enableFuzzy,
      enableAbbrev
    });

    const explanation: QueryRewriteExplanation = rewrite.explanation;
    let triggers: Trigger[] = [];

    if (expand) {
      triggers = await evaluateTriggers(query);
      explanation.triggersApplied = triggers.map(t => ({
        name: t.name,
        pattern: t.pattern,
        actions: t.actions
      }));
    }

    let vectorQueryText = rewrite.vectorQuery;
    let textQueryText = rewrite.textQuery;

    if (triggers.length) {
      const injected = triggers.flatMap(trigger => trigger.actions.inject_terms || []);
      const injectedNormalized = injected.map((term: string) => term.toLowerCase());
      if (injectedNormalized.length) {
        vectorQueryText = [...vectorQueryText.split(' '), ...injectedNormalized].join(' ').trim();

        const injectedTs = injectedNormalized
          .map(term => sanitizeTsqueryToken(term))
          .filter(Boolean) as string[];
        textQueryText = [textQueryText, ...injectedTs].filter(Boolean).join(' | ');

        explanation.expandedTerms = Array.from(new Set([...(explanation.expandedTerms || []), ...injectedNormalized]));
        explanation.finalQuery = vectorQueryText;
        explanation.vectorQuery = vectorQueryText;
        explanation.textQuery = textQueryText;
      }
    }

    let results;

    if (mode === 'vector') {
      // Pure vector search - use expanded query for embedding
      const embedding = await generateEmbedding(vectorQueryText || query);
      const vectorStr = `[${embedding.join(',')}]`;
      
      const queryText = sourceId 
        ? `SELECT id, title, content, url, source_id, document_type, external_id, attributes, created_at, last_modified,
                  1 - (embedding <=> $1::vector) as score
           FROM documents
           WHERE embedding IS NOT NULL AND source_id = $3
           ORDER BY embedding <=> $1::vector
           LIMIT $2`
        : `SELECT id, title, content, url, source_id, document_type, external_id, attributes, created_at, last_modified,
                  1 - (embedding <=> $1::vector) as score
           FROM documents
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector
           LIMIT $2`;
      
      results = await pool.query(queryText, 
        sourceId ? [vectorStr, fetchLimit, sourceId] : [vectorStr, fetchLimit]
      );

    } else if (mode === 'text') {
      // Pure text search with expanded query
      const queryText = sourceId
        ? `SELECT id, title, content, url, source_id, document_type, external_id, attributes, created_at, last_modified,
                  ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $1)) as score
           FROM documents
           WHERE to_tsvector('english', content || ' ' || title) @@ to_tsquery('english', $1)
             AND source_id = $3
           ORDER BY score DESC
           LIMIT $2`
        : `SELECT id, title, content, url, source_id, document_type, external_id, attributes, created_at, last_modified,
                  ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $1)) as score
           FROM documents
           WHERE to_tsvector('english', content || ' ' || title) @@ to_tsquery('english', $1)
           ORDER BY score DESC
           LIMIT $2`;
      
      const safeTextQuery = textQueryText || buildFallbackTsQuery(query);
      results = await pool.query(queryText,
        sourceId ? [safeTextQuery, fetchLimit, sourceId] : [safeTextQuery, fetchLimit]
      );

    } else {
      // Hybrid search (default) - combine vector and text scores
      const embedding = await generateEmbedding(vectorQueryText || query);
      const vectorStr = `[${embedding.join(',')}]`;
      
      const queryText = sourceId
        ? `WITH vector_scores AS (
             SELECT id, 1 - (embedding <=> $1::vector) as vscore
             FROM documents
             WHERE embedding IS NOT NULL AND source_id = $4
           ),
           text_scores AS (
             SELECT id, ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $2)) as tscore
             FROM documents
             WHERE source_id = $4
           )
           SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type, d.external_id, d.attributes, d.created_at, d.last_modified,
                  COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
           FROM documents d
           LEFT JOIN vector_scores v ON d.id = v.id
           LEFT JOIN text_scores t ON d.id = t.id
           WHERE d.source_id = $4
           ORDER BY score DESC
           LIMIT $3`
        : `WITH vector_scores AS (
             SELECT id, 1 - (embedding <=> $1::vector) as vscore
             FROM documents
             WHERE embedding IS NOT NULL
           ),
           text_scores AS (
             SELECT id, ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $2)) as tscore
             FROM documents
           )
           SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type, d.external_id, d.attributes, d.created_at, d.last_modified,
                  COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
           FROM documents d
           LEFT JOIN vector_scores v ON d.id = v.id
           LEFT JOIN text_scores t ON d.id = t.id
           ORDER BY score DESC
           LIMIT $3`;
      
      const safeTextQuery = textQueryText || buildFallbackTsQuery(query);
      results = await pool.query(queryText,
        sourceId ? [vectorStr, safeTextQuery, fetchLimit, sourceId] : [vectorStr, safeTextQuery, fetchLimit]
      );
    }

    // Apply trigger actions to rerank/filter results
    let processedResults = results.rows;
    
    for (const trigger of triggers) {
      // Boost specific document types
      if (trigger.actions.boost_doc_type) {
        processedResults = processedResults.map(doc => ({
          ...doc,
          score: doc.document_type === trigger.actions.boost_doc_type 
            ? doc.score * 1.5 
            : doc.score
        }));
      }
      
      // Filter by category if specified
      if (trigger.actions.filter_category) {
        processedResults = processedResults.filter(doc => 
          doc.attributes?.category === trigger.actions.filter_category
        );
      }
      
      // Rerank by field if specified
      if (trigger.actions.rerank_by_field) {
        const field = trigger.actions.rerank_by_field;
        processedResults = processedResults.sort((a, b) => {
          const aVal = a.attributes?.[field] || a[field] || '';
          const bVal = b.attributes?.[field] || b[field] || '';
          return bVal.localeCompare(aVal);
        });
      }
    }
    
    // Apply concept-aware boosts
    processedResults = applyExpansionBoost(processedResults, {
      originalTerms: rewrite.originalTerms,
      weightedTerms: rewrite.weightedTerms
    });

    // Apply plugin score modifications (e.g. WoT ranking)
    if (user_pubkey && wot_enabled) {
      const searchQuery = { text: query, user_pubkey };
      processedResults = await Promise.all(
        processedResults.map(async (doc) => {
          const searchDoc = {
            id: String(doc.id),
            content: doc.content || '',
            title: doc.title,
            url: doc.url,
            source: doc.source_id,
            metadata: {},
            author_pubkey: doc.author_pubkey,
          };
          const newScore = await pluginManager.modifySearchScore(searchDoc, searchQuery, doc.score);
          return { ...doc, score: newScore };
        })
      );
    }

    // Re-sort by score after trigger modifications
    processedResults = processedResults.sort((a, b) => b.score - a.score);

    const enrichedResults = processedResults.map((doc) => {
      const content = doc.content || '';
      const title = (doc.title || '').toLowerCase();
      const qLower = query.toLowerCase();
      let match_reason = 'semantic similarity';
      if (title.includes(qLower)) match_reason = 'title keyword match';
      else if (content.toLowerCase().includes(qLower)) match_reason = 'content keyword match';

      return {
        ...doc,
        snippet: content.slice(0, 200),
        author: doc.author || doc.attributes?.author || null,
        source_name: doc.source_name || doc.attributes?.source_name || doc.source_id || null,
        match_reason
      };
    });

    const response: any = {
      query,
      mode,
      count: enrichedResults.length,
      results: enrichedResults.slice(offset, offset + limit)
    };
    
    if (explain) {
      response.explanation = explanation;
    }

    // Emit webhook event (non-blocking)
    webhookManager.emit('search.performed', {
      query,
      mode,
      results_count: processedResults.length,
      source_id: sourceId || null,
      expanded: expand
    }).catch(console.error);

    res.json(response);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: (error as Error).message });
  }
});

// ============================================
// SEARCH REWRITE PREVIEW
// ============================================

app.post('/api/search/rewrite', async (req: Request, res: Response) => {
  try {
    const { query, expand = true, fuzzy = true, abbrev = true } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const rewrite = await rewriteQuery(pool, query, {
      expand,
      enableFuzzy: fuzzy,
      enableAbbrev: abbrev
    });

    res.json({
      query,
      rewrite: rewrite.explanation,
      terms: rewrite.weightedTerms
    });
  } catch (error) {
    console.error('Rewrite preview error:', error);
    res.status(500).json({ error: 'Failed to rewrite query', details: (error as Error).message });
  }
});

// ============================================
// ONTOLOGY CRUD ENDPOINTS
// ============================================

// Get all ontology terms (with optional tree structure)
app.get('/api/ontology', async (req: Request, res: Response) => {
  try {
    const tree = req.query.tree === 'true';
    
    const result = await pool.query(`
      SELECT id, parent_id, term, description, synonyms, created_at, updated_at
      FROM ontology
      ORDER BY term
    `);
    
    if (tree) {
      // Build tree structure
      const termsMap = new Map<string, any>();
      const roots: any[] = [];
      
      for (const row of result.rows) {
        termsMap.set(row.id, { ...row, children: [] });
      }
      
      for (const row of result.rows) {
        const node = termsMap.get(row.id);
        if (row.parent_id && termsMap.has(row.parent_id)) {
          termsMap.get(row.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      }
      
      res.json(roots);
    } else {
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Ontology fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch ontology' });
  }
});

// Export ontology
app.get('/api/ontology/export', async (_req: Request, res: Response) => {
  try {
    const payload = await exportOntology(pool);
    res.json(payload);
  } catch (error) {
    console.error('Ontology export error:', error);
    res.status(500).json({ error: 'Failed to export ontology' });
  }
});

// Bulk import ontology
app.post('/api/ontology/import', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.concepts)) {
      return res.status(400).json({ error: 'Payload must include concepts[]' });
    }

    const stats = await importOntology(pool, payload);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Ontology import error:', error);
    res.status(500).json({ error: 'Failed to import ontology', details: (error as Error).message });
  }
});

// Get single ontology term
app.get('/api/ontology/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM ontology WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ontology term not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ontology fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch ontology term' });
  }
});

// Create ontology term
app.post('/api/ontology', async (req: Request, res: Response) => {
  try {
    const { term, parent_id, description, synonyms = [] } = req.body;
    
    if (!term) {
      return res.status(400).json({ error: 'Term is required' });
    }
    
    const result = await pool.query(`
      INSERT INTO ontology (term, parent_id, description, synonyms)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [term, parent_id || null, description || null, synonyms]);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Ontology create error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Term already exists' });
    }
    res.status(500).json({ error: 'Failed to create ontology term' });
  }
});

// Update ontology term
app.put('/api/ontology/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { term, parent_id, description, synonyms } = req.body;
    
    const result = await pool.query(`
      UPDATE ontology
      SET term = COALESCE($1, term),
          parent_id = $2,
          description = COALESCE($3, description),
          synonyms = COALESCE($4, synonyms),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [term, parent_id, description, synonyms, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ontology term not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Ontology update error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Term already exists' });
    }
    res.status(500).json({ error: 'Failed to update ontology term' });
  }
});

// Delete ontology term
app.delete('/api/ontology/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Note: Children will have parent_id set to NULL due to ON DELETE SET NULL
    await pool.query('DELETE FROM ontology WHERE id = $1', [id]);
    
    res.status(204).send();
  } catch (error) {
    console.error('Ontology delete error:', error);
    res.status(500).json({ error: 'Failed to delete ontology term' });
  }
});

// List aliases for a concept
app.get('/api/ontology/:id/aliases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, alias, alias_type, weight, created_at, updated_at FROM ontology_aliases WHERE concept_id = $1 ORDER BY alias',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ontology alias fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch aliases' });
  }
});

// Add alias to a concept
app.post('/api/ontology/:id/aliases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { alias, alias_type = 'synonym', weight = 1.0 } = req.body;

    if (!alias) {
      return res.status(400).json({ error: 'Alias is required' });
    }

    const result = await pool.query(`
      INSERT INTO ontology_aliases (concept_id, alias, alias_type, weight)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (concept_id, alias) DO UPDATE SET
        alias_type = EXCLUDED.alias_type,
        weight = EXCLUDED.weight,
        updated_at = NOW()
      RETURNING *
    `, [id, alias, alias_type, weight]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ontology alias create error:', error);
    res.status(500).json({ error: 'Failed to add alias' });
  }
});

// Delete alias
app.delete('/api/ontology/aliases/:aliasId', async (req: Request, res: Response) => {
  try {
    const { aliasId } = req.params;
    await pool.query('DELETE FROM ontology_aliases WHERE id = $1', [aliasId]);
    res.status(204).send();
  } catch (error) {
    console.error('Ontology alias delete error:', error);
    res.status(500).json({ error: 'Failed to delete alias' });
  }
});

// List relations for a concept
app.get('/api/ontology/:id/relations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.id, r.relation_type, r.weight, r.target_id, o.term as target_term
      FROM ontology_relations r
      JOIN ontology o ON o.id = r.target_id
      WHERE r.source_id = $1
      ORDER BY r.relation_type, o.term
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ontology relations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch relations' });
  }
});

// Add relation to a concept
app.post('/api/ontology/:id/relations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { target_id, target_term, relation_type = 'related', weight = 1.0 } = req.body;

    let targetId = target_id;
    if (!targetId && target_term) {
      const lookup = await pool.query('SELECT id FROM ontology WHERE LOWER(term) = LOWER($1)', [target_term]);
      targetId = lookup.rows[0]?.id;
    }

    if (!targetId) {
      return res.status(400).json({ error: 'Target concept id or term is required' });
    }

    const result = await pool.query(`
      INSERT INTO ontology_relations (source_id, target_id, relation_type, weight)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source_id, target_id, relation_type) DO UPDATE SET
        weight = EXCLUDED.weight,
        updated_at = NOW()
      RETURNING *
    `, [id, targetId, relation_type, weight]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ontology relation create error:', error);
    res.status(500).json({ error: 'Failed to add relation' });
  }
});

// Delete relation
app.delete('/api/ontology/relations/:relationId', async (req: Request, res: Response) => {
  try {
    const { relationId } = req.params;
    await pool.query('DELETE FROM ontology_relations WHERE id = $1', [relationId]);
    res.status(204).send();
  } catch (error) {
    console.error('Ontology relation delete error:', error);
    res.status(500).json({ error: 'Failed to delete relation' });
  }
});

// List taxonomies
app.get('/api/ontology/taxonomies', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, description, created_at, updated_at FROM ontology_taxonomies ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Ontology taxonomy fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch taxonomies' });
  }
});

// Create taxonomy
app.post('/api/ontology/taxonomies', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Taxonomy name is required' });
    }
    const result = await pool.query(`
      INSERT INTO ontology_taxonomies (name, description)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING *
    `, [name, description || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ontology taxonomy create error:', error);
    res.status(500).json({ error: 'Failed to create taxonomy' });
  }
});

// Update taxonomy
app.put('/api/ontology/taxonomies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const result = await pool.query(`
      UPDATE ontology_taxonomies
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [name, description, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Taxonomy not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ontology taxonomy update error:', error);
    res.status(500).json({ error: 'Failed to update taxonomy' });
  }
});

// Delete taxonomy
app.delete('/api/ontology/taxonomies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM ontology_taxonomies WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Ontology taxonomy delete error:', error);
    res.status(500).json({ error: 'Failed to delete taxonomy' });
  }
});

// Get taxonomies for a concept
app.get('/api/ontology/:id/taxonomies', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.id, t.name, t.description
      FROM ontology_concept_taxonomies ct
      JOIN ontology_taxonomies t ON t.id = ct.taxonomy_id
      WHERE ct.concept_id = $1
      ORDER BY t.name
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ontology concept taxonomy fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch concept taxonomies' });
  }
});

// Assign taxonomies to a concept
app.post('/api/ontology/:id/taxonomies', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { taxonomies = [], replace = false } = req.body;

    if (!Array.isArray(taxonomies)) {
      return res.status(400).json({ error: 'Taxonomies must be an array of names' });
    }

    if (replace) {
      await pool.query('DELETE FROM ontology_concept_taxonomies WHERE concept_id = $1', [id]);
    }

    for (const name of taxonomies) {
      const taxonomy = await pool.query(`
        INSERT INTO ontology_taxonomies (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [name]);
      const taxonomyId = taxonomy.rows[0].id;
      await pool.query(`
        INSERT INTO ontology_concept_taxonomies (concept_id, taxonomy_id)
        VALUES ($1, $2)
        ON CONFLICT (concept_id, taxonomy_id) DO NOTHING
      `, [id, taxonomyId]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ontology concept taxonomy assign error:', error);
    res.status(500).json({ error: 'Failed to assign taxonomies' });
  }
});

// Expand a term through the ontology engine
app.get('/api/ontology/expand/:term', async (req: Request, res: Response) => {
  try {
    const { term } = req.params;
    const rewrite = await rewriteQuery(pool, term, { expand: true, enableFuzzy: false, enableAbbrev: true });
    const expanded = Array.from(new Set([term.toLowerCase(), ...rewrite.finalTerms]));
    res.json({ term, expanded });
  } catch (error) {
    console.error('Ontology expansion error:', error);
    res.status(500).json({ error: 'Failed to expand term' });
  }
});

// ============================================
// DICTIONARY CRUD ENDPOINTS
// ============================================

// Get all dictionary entries
app.get('/api/dictionary', async (req: Request, res: Response) => {
  try {
    const domain = req.query.domain as string;
    
    let query = 'SELECT * FROM dictionary';
    const params: any[] = [];
    
    if (domain) {
      query += ' WHERE domain = $1';
      params.push(domain);
    }
    
    query += ' ORDER BY term';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Dictionary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch dictionary' });
  }
});

// Get single dictionary entry
app.get('/api/dictionary/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM dictionary WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dictionary entry not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Dictionary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch dictionary entry' });
  }
});

// Create dictionary entry
app.post('/api/dictionary', async (req: Request, res: Response) => {
  try {
    const { term, synonyms = [], acronym_for, domain, boost_weight = 1.0 } = req.body;
    
    if (!term) {
      return res.status(400).json({ error: 'Term is required' });
    }
    
    const result = await pool.query(`
      INSERT INTO dictionary (term, synonyms, acronym_for, domain, boost_weight)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [term, synonyms, acronym_for || null, domain || null, boost_weight]);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Dictionary create error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Term already exists' });
    }
    res.status(500).json({ error: 'Failed to create dictionary entry' });
  }
});

// Update dictionary entry
app.put('/api/dictionary/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { term, synonyms, acronym_for, domain, boost_weight } = req.body;
    
    const result = await pool.query(`
      UPDATE dictionary
      SET term = COALESCE($1, term),
          synonyms = COALESCE($2, synonyms),
          acronym_for = $3,
          domain = $4,
          boost_weight = COALESCE($5, boost_weight),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [term, synonyms, acronym_for, domain, boost_weight, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dictionary entry not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Dictionary update error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Term already exists' });
    }
    res.status(500).json({ error: 'Failed to update dictionary entry' });
  }
});

// Delete dictionary entry
app.delete('/api/dictionary/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM dictionary WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Dictionary delete error:', error);
    res.status(500).json({ error: 'Failed to delete dictionary entry' });
  }
});

// Lookup a term in dictionary
app.get('/api/dictionary/lookup/:term', async (req: Request, res: Response) => {
  try {
    const { term } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM dictionary
      WHERE LOWER(term) = LOWER($1) 
         OR LOWER($1) = ANY(SELECT LOWER(s) FROM unnest(synonyms) s)
    `, [term]);
    
    if (result.rows.length === 0) {
      return res.json({ term, found: false, entries: [] });
    }
    
    res.json({ term, found: true, entries: result.rows });
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup term' });
  }
});

// ============================================
// TRIGGERS CRUD ENDPOINTS
// ============================================

// Get all triggers
app.get('/api/triggers', async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled;
    
    let query = 'SELECT * FROM triggers';
    const params: any[] = [];
    
    if (enabled !== undefined) {
      query += ' WHERE enabled = $1';
      params.push(enabled === 'true');
    }
    
    query += ' ORDER BY priority DESC, name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Triggers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch triggers' });
  }
});

// Get single trigger
app.get('/api/triggers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM triggers WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trigger not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Trigger fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch trigger' });
  }
});

// Create trigger
app.post('/api/triggers', async (req: Request, res: Response) => {
  try {
    const { name, pattern, conditions = {}, actions, priority = 0, enabled = true, description } = req.body;
    
    if (!name || !pattern || !actions) {
      return res.status(400).json({ error: 'Name, pattern, and actions are required' });
    }
    
    // Validate regex pattern
    try {
      new RegExp(pattern);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid regex pattern' });
    }
    
    const result = await pool.query(`
      INSERT INTO triggers (name, pattern, conditions, actions, priority, enabled, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, pattern, conditions, actions, priority, enabled, description || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Trigger create error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Trigger name already exists' });
    }
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

// Update trigger
app.put('/api/triggers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, pattern, conditions, actions, priority, enabled, description } = req.body;
    
    // Validate regex pattern if provided
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid regex pattern' });
      }
    }
    
    const result = await pool.query(`
      UPDATE triggers
      SET name = COALESCE($1, name),
          pattern = COALESCE($2, pattern),
          conditions = COALESCE($3, conditions),
          actions = COALESCE($4, actions),
          priority = COALESCE($5, priority),
          enabled = COALESCE($6, enabled),
          description = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [name, pattern, conditions, actions, priority, enabled, description, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trigger not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Trigger update error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Trigger name already exists' });
    }
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

// Delete trigger
app.delete('/api/triggers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM triggers WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Trigger delete error:', error);
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

// Test a trigger pattern against a query
app.post('/api/triggers/test', async (req: Request, res: Response) => {
  try {
    const { query, pattern } = req.body;
    
    if (!query || !pattern) {
      return res.status(400).json({ error: 'Query and pattern are required' });
    }
    
    try {
      const regex = new RegExp(pattern, 'i');
      const matches = regex.test(query);
      const matchGroups = query.match(regex);
      
      res.json({
        query,
        pattern,
        matches,
        matchGroups: matchGroups || []
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid regex pattern' });
    }
  } catch (error) {
    console.error('Trigger test error:', error);
    res.status(500).json({ error: 'Failed to test trigger' });
  }
});

// ============================================
// DOCUMENT ENDPOINTS (existing)
// ============================================

// Index a new document
app.post('/api/documents', async (req: Request, res: Response) => {
  try {
    const { title, content, url, sourceId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Generate embedding
    const embedding = await generateEmbedding(`${title} ${content}`);
    const vectorStr = `[${embedding.join(',')}]`;

    const result = await pool.query(`
      INSERT INTO documents (title, content, url, embedding, source_id)
      VALUES ($1, $2, $3, $4::vector, $5)
      RETURNING id, title, content, url, source_id, created_at
    `, [title, content, url || null, vectorStr, sourceId || null]);

    const newDoc = result.rows[0];

    // Emit webhook event (non-blocking)
    webhookManager.emit('document.indexed', {
      document_id: newDoc.id,
      title: newDoc.title,
      url: newDoc.url,
      source_id: newDoc.source_id
    }).catch(console.error);

    res.status(201).json(newDoc);

  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({ error: 'Failed to index document' });
  }
});

// Get all documents
app.get('/api/documents', async (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const query = sourceId
      ? `SELECT id, title, content, url, source_id, created_at
         FROM documents
         WHERE source_id = $1
         ORDER BY created_at DESC
         LIMIT $2`
      : `SELECT id, title, content, url, source_id, created_at
         FROM documents
         ORDER BY created_at DESC
         LIMIT $1`;
    
    const result = await pool.query(query, 
      sourceId ? [sourceId, limit] : [limit]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete a document
app.delete('/api/documents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get doc info before delete for webhook
    const docInfo = await pool.query('SELECT title, source_id FROM documents WHERE id = $1', [id]);
    
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    // Emit webhook event (non-blocking)
    if (docInfo.rows.length > 0) {
      webhookManager.emit('document.deleted', {
        document_id: id,
        title: docInfo.rows[0].title,
        source_id: docInfo.rows[0].source_id
      }).catch(console.error);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Generate embeddings for existing documents (one-time migration)
app.post('/api/generate-embeddings', async (_req: Request, res: Response) => {
  try {
    const docs = await pool.query('SELECT id, title, content FROM documents WHERE embedding IS NULL');
    
    let updated = 0;
    for (const doc of docs.rows) {
      const embedding = await generateEmbedding(`${doc.title} ${doc.content}`);
      const vectorStr = `[${embedding.join(',')}]`;
      await pool.query('UPDATE documents SET embedding = $1::vector WHERE id = $2', [vectorStr, doc.id]);
      updated++;
    }

    res.json({ message: `Generated embeddings for ${updated} documents` });
  } catch (error) {
    console.error('Embedding generation error:', error);
    res.status(500).json({ error: 'Failed to generate embeddings' });
  }
});

// Stats endpoint
app.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const docCount = await pool.query('SELECT COUNT(*) FROM documents');
    const connectorCount = await pool.query('SELECT COUNT(*) FROM connectors');
    const ontologyCount = await pool.query('SELECT COUNT(*) FROM ontology');
    const dictionaryCount = await pool.query('SELECT COUNT(*) FROM dictionary');
    const triggerCount = await pool.query('SELECT COUNT(*) FROM triggers WHERE enabled = true');
    
    const sourceStats = await pool.query(`
      SELECT c.id, c.name, c.connector_type, COUNT(d.id) as document_count
      FROM connectors c
      LEFT JOIN documents d ON d.source_id = c.id
      GROUP BY c.id, c.name, c.connector_type
      ORDER BY c.name
    `);
    
    res.json({
      totalDocuments: parseInt(docCount.rows[0].count),
      totalConnectors: parseInt(connectorCount.rows[0].count),
      ontologyTerms: parseInt(ontologyCount.rows[0].count),
      dictionaryEntries: parseInt(dictionaryCount.rows[0].count),
      activeTriggers: parseInt(triggerCount.rows[0].count),
      sourceStats: sourceStats.rows
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

import { createConfigGitRoutes } from './config-git';

// Mount git routes
app.use('/api/config', createConfigGitRoutes());

// Mount connector routes
app.use('/api/connectors', createConnectorRoutes(connectorManager, webhookManager));

// Mount webhook routes
app.use('/api/webhooks', createWebhookRoutes(webhookManager));

// Mount source portal routes (document actions)
app.use('/api/documents', createSourcePortalRoutes(sourcePortalManager));

// Mount processing routes (OCR, translation, AI description)
app.use('/api/process', processRoutes);

// Mount wizard routes
app.use('/api/wizard', createWizardRoutes());

// Mount podcast routes
app.use('/api/podcasts', createPodcastRoutes(pool, generateEmbedding));

// Mount TV routes
app.use('/api/tv', createTvRoutes(pool, generateEmbedding));

// Mount Movie routes
app.use('/api/movies', createMovieRoutes(pool, generateEmbedding));

// Mount Mixed media routes
app.use('/api/media', createMediaRoutes(pool, generateEmbedding));

// Mount FRPEI routes
app.use('/api/frpei', createFrpeiRoutes(pool, generateEmbedding));

// Mount UX bundle routes (tags, advanced search, quality scoring)
const uxRouter = createUxRoutes(pool, generateEmbedding);
app.use('/api', uxRouter);

// Mount Analytics routes (author dashboards, zap heatmaps)
const analyticsRouter = createAnalyticsRoutes(pool);
app.use('/api', analyticsRouter);

// Mount Nostr routes
import { createNostrRoutes } from './routes/nostr';
app.use('/api/nostr', createNostrRoutes(pool, generateEmbedding));

// Log AI processing configuration
const processingConfig = getConfig();
console.log(`🤖 AI Processing: OCR=${processingConfig.ocr.enabled}, Translation=${processingConfig.translation.enabled}, AI Description=${processingConfig.aiDescription.enabled}`);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🔍 Beacon Search API running on port ${PORT}`);
  console.log(`📚 Endpoints available:`);
  console.log(`   POST /api/ask - RAG query with LLM`);
  console.log(`   GET  /api/search - Enhanced search with expansions`);
  console.log(`   POST /api/search/rewrite - Query rewrite preview`);
  console.log(`   CRUD /api/ontology - Ontology management`);
  console.log(`   POST /api/ontology/import - Bulk ontology import`);
  console.log(`   GET  /api/ontology/export - Bulk ontology export`);
  console.log(`   CRUD /api/dictionary - Dictionary management`);
  console.log(`   CRUD /api/triggers - Trigger management`);
  console.log(`   POST /api/process/ocr - OCR an image/PDF`);
  console.log(`   POST /api/process/translate - Translate text`);
  console.log(`   POST /api/process/describe - AI describe image/audio`);
  console.log(`   POST /api/wizard/sessions - BMAD Config Wizard`);
  console.log(`   POST /api/wizard/chat - Wizard conversation`);
  console.log(`   POST /api/podcasts/ingest - Podcast ingestion`);
  console.log(`   GET  /api/podcasts/facets - Podcast facets`);
  console.log(`   POST /api/podcasts/recommendations/preview - Podcast recommendations`);
  console.log(`   POST /api/tv/ingest - TV ingestion`);
  console.log(`   GET  /api/tv/browse - TV browse`);
  console.log(`   GET  /api/tv/facets - TV facets`);
  console.log(`   POST /api/tv/search - TV search`);
  console.log(`   GET  /api/tv/episodes/:episodeId/transcripts - TV transcripts`);
  console.log(`   POST /api/tv/recommendations/preview - TV recommendations`);
  console.log(`   POST /api/movies/ingest - Movie ingestion`);
  console.log(`   GET  /api/movies/browse - Movie browse`);
  console.log(`   GET  /api/movies/facets - Movie facets`);
  console.log(`   POST /api/movies/search - Movie search`);
  console.log(`   GET  /api/movies/:movieId/transcripts - Movie transcripts`);
  console.log(`   POST /api/movies/recommendations/preview - Movie recommendations`);
  console.log(`   GET  /api/media/browse - Mixed media browse`);
  console.log(`   GET  /api/media/facets - Mixed media facets`);
  console.log(`   POST /api/media/search - Mixed media search`);
  console.log(`   POST /api/media/recommendations/preview - Mixed media recommendations`);
  console.log(`   POST /api/frpei/retrieve - FRPEI federated retrieval`);
  console.log(`   POST /api/frpei/ingest - FRPEI retrieve alias`);
  console.log(`   POST /api/frpei/enrich - FRPEI enrichment`);
  console.log(`   POST /api/frpei/rank - FRPEI ranking`);
  console.log(`   POST /api/frpei/explain - FRPEI explainability`);
  console.log(`   POST /api/frpei/feedback - FRPEI feedback`);
  console.log(`   GET  /api/frpei/metrics - FRPEI metrics snapshot`);
  console.log(`   GET  /api/frpei/status - FRPEI provider health`);
  // Pre-load the embedding model
  getEmbedder().catch(console.error);
});


// User search endpoint
app.get('/api/search/users', async (req: Request, res: Response) => {
  const { q, limit = 20 } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    const searchLimit = Math.min(parseInt(String(limit), 10) || 20, 100);
    
    // For now, just search by pubkey since we don't have profile metadata ingested yet
    // Future: ingest kind 0 events to populate nip05, name, display_name, about
    
    const results = await pool.query(`
      SELECT 
        ne.pubkey,
        d.attributes->>'author' as author,
        d.attributes->>'nip05' as nip05,
        d.attributes->>'name' as name,
        d.attributes->>'display_name' as display_name,
        d.attributes->>'about' as about,
        COUNT(DISTINCT ne.event_id) as event_count
      FROM nostr_events ne
      LEFT JOIN documents d ON d.id = ne.document_id
      WHERE ne.pubkey LIKE $1
      GROUP BY ne.pubkey, d.attributes
      ORDER BY event_count DESC
      LIMIT $2`,
      [`%${q}%`, searchLimit]
    );
    
    const users = results.rows.map(row => ({
      pubkey: row.pubkey,
      npub: row.pubkey ? `npub...${row.pubkey.slice(0, 8)}` : null,
      nip05: row.nip05,
      name: row.name,
      display_name: row.display_name || row.name,
      about: row.about,
      event_count: parseInt(row.event_count, 10) || 0,
      profile_url: row.pubkey ? `https://primal.net/p/${row.pubkey}` : null
    }));
    
    res.json({ results: users, count: users.length });
  } catch (error: any) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'User search failed', details: error.message });
  }
});
