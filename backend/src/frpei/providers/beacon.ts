import { Pool } from 'pg';
import { rewriteQuery } from '../../search/query-rewrite';
import { FrpeiRetrieveRequest } from '../types';
import { createCandidate, mapDocumentTypeToContentType, truncateSnippet } from '../utils';
import { FrpeiProvider, ProviderContext, ProviderSearchResult } from './provider';

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

export class BeaconProvider implements FrpeiProvider {
  name = 'beacon' as const;
  trustTier: 'high' = 'high';
  weight = 0.95;
  timeoutMs: number;

  constructor(options?: { timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? Number(process.env.BEACON_TIMEOUT_MS || 1800);
  }

  async search(request: FrpeiRetrieveRequest, context: ProviderContext): Promise<ProviderSearchResult> {
    const pool: Pool = context.pool;
    const limit = request.limit ?? 10;
    const mode = request.mode || 'hybrid';
    const expand = request.expand !== false;

    const rewrite = await rewriteQuery(pool, request.query, { expand });
    const vectorQueryText = rewrite.vectorQuery || request.query;
    const textQueryText = rewrite.textQuery || buildFallbackTsQuery(request.query);

    let queryText = '';
    let params: any[] = [];

    if (mode === 'vector') {
      const embedding = await context.generateEmbedding(vectorQueryText);
      const vectorStr = `[${embedding.join(',')}]`;
      params = [vectorStr, limit];
      queryText = `
        SELECT id, title, content, url, source_id, document_type, attributes, last_modified, created_at,
          1 - (embedding <=> $1::vector) as score
        FROM documents
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;
    } else if (mode === 'text') {
      params = [textQueryText, limit];
      queryText = `
        SELECT id, title, content, url, source_id, document_type, attributes, last_modified, created_at,
          ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $1)) as score
        FROM documents
        WHERE to_tsvector('english', content || ' ' || title) @@ to_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2
      `;
    } else {
      const embedding = await context.generateEmbedding(vectorQueryText);
      const vectorStr = `[${embedding.join(',')}]`;
      params = [vectorStr, textQueryText, limit];
      queryText = `
        WITH vector_scores AS (
          SELECT id, 1 - (embedding <=> $1::vector) as vscore
          FROM documents
          WHERE embedding IS NOT NULL
        ),
        text_scores AS (
          SELECT id, ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $2)) as tscore
          FROM documents
        )
        SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type, d.attributes, d.last_modified, d.created_at,
          COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
        FROM documents d
        LEFT JOIN vector_scores v ON d.id = v.id
        LEFT JOIN text_scores t ON d.id = t.id
        ORDER BY score DESC
        LIMIT $3
      `;
    }

    const result = await pool.query(queryText, params);

    const items = result.rows.map((row: any, index: number) =>
      createCandidate({
        title: row.title,
        url: row.url,
        snippet: truncateSnippet(row.content),
        contentType: mapDocumentTypeToContentType(row.document_type),
        publishedAt: row.last_modified ? new Date(row.last_modified).toISOString() : row.created_at ? new Date(row.created_at).toISOString() : undefined,
        score: Number(row.score || 0),
        rank: index + 1,
        source: {
          provider: this.name,
          providerRef: row.id,
          trustTier: this.trustTier
        },
        metadata: {
          documentId: row.id,
          documentType: row.document_type,
          sourceId: row.source_id,
          attributes: row.attributes || {}
        }
      })
    );

    return {
      provider: this.name,
      items,
      raw: { count: result.rows.length }
    };
  }
}
