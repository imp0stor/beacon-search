/**
 * Nostr Search Adapter
 * Provides faceted search and filtering for Nostr events
 */

import { Pool } from 'pg';
import { getKindMetadata, NOSTR_KIND_REGISTRY } from './kinds';

export interface NostrSearchFacets {
  kinds: Array<{ kind: number; name: string; count: number }>;
  categories: Array<{ category: string; count: number }>;
  authors: Array<{ pubkey: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}

export interface NostrSearchFilters {
  kinds?: number[];
  categories?: string[];
  authors?: string[];
  tags?: string[];
  minScore?: number;
}

/**
 * Get available facets for Nostr events
 */
export async function getNostrSearchFacets(pool: Pool): Promise<NostrSearchFacets> {
  // Get kind distribution
  const kindsResult = await pool.query(`
    SELECT 
      (attributes->'kind')::int as kind,
      COUNT(*) as count
    FROM documents
    WHERE attributes->>'nostr' = 'true'
    GROUP BY kind
    ORDER BY count DESC
  `);

  const kinds = kindsResult.rows.map(row => {
    const kindMeta = getKindMetadata(row.kind);
    return {
      kind: row.kind,
      name: kindMeta?.name || `Kind ${row.kind}`,
      count: parseInt(row.count),
    };
  });

  // Get category distribution
  const categoriesResult = await pool.query(`
    SELECT 
      attributes->'kindCategory' as category,
      COUNT(*) as count
    FROM documents
    WHERE attributes->>'nostr' = 'true'
    GROUP BY category
    ORDER BY count DESC
  `);

  const categories = categoriesResult.rows.map(row => ({
    category: row.category,
    count: parseInt(row.count),
  }));

  // Get top authors
  const authorsResult = await pool.query(`
    SELECT 
      attributes->'pubkey' as pubkey,
      COUNT(*) as count
    FROM documents
    WHERE attributes->>'nostr' = 'true'
    GROUP BY pubkey
    ORDER BY count DESC
    LIMIT 20
  `);

  const authors = authorsResult.rows.map(row => ({
    pubkey: row.pubkey,
    count: parseInt(row.count),
  }));

  // Get top tags
  const tagsResult = await pool.query(`
    SELECT 
      jsonb_array_elements_text(attributes->'tags'->'topic') as tag,
      COUNT(*) as count
    FROM documents
    WHERE attributes->>'nostr' = 'true'
      AND attributes->'tags'->'topic' IS NOT NULL
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 50
  `);

  const tags = tagsResult.rows.map(row => ({
    tag: row.tag,
    count: parseInt(row.count),
  }));

  return { kinds, categories, authors, tags };
}

/**
 * Build SQL WHERE clause for Nostr search filters
 */
export function buildNostrFilterClause(filters: NostrSearchFilters): { where: string; params: any[] } {
  const conditions: string[] = ["attributes->>'nostr' = 'true'"];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.kinds && filters.kinds.length > 0) {
    conditions.push(`(attributes->'kind')::int = ANY($${paramIndex})`);
    params.push(filters.kinds);
    paramIndex++;
  }

  if (filters.categories && filters.categories.length > 0) {
    conditions.push(`attributes->>'kindCategory' = ANY($${paramIndex})`);
    params.push(filters.categories);
    paramIndex++;
  }

  if (filters.authors && filters.authors.length > 0) {
    conditions.push(`attributes->>'pubkey' = ANY($${paramIndex})`);
    params.push(filters.authors);
    paramIndex++;
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`attributes->'tags'->'topic' ?| $${paramIndex}`);
    params.push(filters.tags);
    paramIndex++;
  }

  return {
    where: conditions.join(' AND '),
    params,
  };
}

/**
 * Search Nostr events with filters
 */
export async function searchNostrEvents(
  pool: Pool,
  query: string,
  filters: NostrSearchFilters,
  limit: number = 20,
  mode: 'vector' | 'text' | 'hybrid' = 'hybrid',
  generateEmbedding?: (text: string) => Promise<number[]>
): Promise<any[]> {
  const { where, params } = buildNostrFilterClause(filters);
  
  if (mode === 'vector' && generateEmbedding) {
    // Vector search
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;
    
    const result = await pool.query(
      `SELECT id, title, content, url, source_id, document_type, attributes,
              1 - (embedding <=> $1::vector) as score
       FROM documents
       WHERE ${where}
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $${params.length + 2}`,
      [vectorStr, ...params, limit]
    );
    
    return result.rows;
  } else if (mode === 'text') {
    // Text search
    const expandedQuery = query.split(/\s+/).join(' | ');
    
    const result = await pool.query(
      `SELECT id, title, content, url, source_id, document_type, attributes,
              ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $1)) as score
       FROM documents
       WHERE ${where}
         AND to_tsvector('english', content || ' ' || title) @@ to_tsquery('english', $1)
       ORDER BY score DESC
       LIMIT $${params.length + 2}`,
      [expandedQuery, ...params, limit]
    );
    
    return result.rows;
  } else {
    // Hybrid search
    if (!generateEmbedding) {
      throw new Error('generateEmbedding function required for hybrid search');
    }
    
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;
    const expandedQuery = query.split(/\s+/).join(' | ');
    
    const result = await pool.query(
      `WITH vector_scores AS (
         SELECT id, 1 - (embedding <=> $1::vector) as vscore
         FROM documents
         WHERE ${where} AND embedding IS NOT NULL
       ),
       text_scores AS (
         SELECT id, ts_rank(to_tsvector('english', content || ' ' || title), to_tsquery('english', $2)) as tscore
         FROM documents
         WHERE ${where}
       )
       SELECT d.id, d.title, d.content, d.url, d.source_id, d.document_type, d.attributes,
              COALESCE(v.vscore, 0) * 0.7 + COALESCE(t.tscore, 0) * 0.3 as score
       FROM documents d
       LEFT JOIN vector_scores v ON d.id = v.id
       LEFT JOIN text_scores t ON d.id = t.id
       WHERE ${where}
       ORDER BY score DESC
       LIMIT $${params.length + 3}`,
      [vectorStr, expandedQuery, ...params, limit]
    );
    
    return result.rows;
  }
}
