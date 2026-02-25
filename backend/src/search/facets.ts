import { Pool } from 'pg';

export interface SearchFacetValue {
  value: string;
  count: number;
}

export interface SearchFacetsResponse {
  tags: SearchFacetValue[];
  authors: SearchFacetValue[];
  contentTypes: SearchFacetValue[];
  documentTypes: SearchFacetValue[];
  sentiment: Array<{ sentiment: string; value: string; count: number }>;
  entityTypes: Record<string, SearchFacetValue[]>;
  dateRanges: Array<{ range: string; label: string; count: number }>;
  totals: {
    documents: number;
    taggedDocuments: number;
    nostrDocuments: number;
  };
}

export async function getSearchFacets(pool: Pool): Promise<SearchFacetsResponse> {
  const [
    tagsResult,
    authorsResult,
    contentTypesResult,
    documentTypesResult,
    sentimentResult,
    entitiesResult,
    dateRangesResult,
    totalsResult,
  ] = await Promise.all([
    pool.query(`
      SELECT tag AS value, COUNT(*)::int AS count
      FROM document_tags
      GROUP BY tag
      ORDER BY count DESC, value ASC
      LIMIT 50
    `),

    pool.query(`
      SELECT author AS value, COUNT(*)::int AS count
      FROM (
        SELECT COALESCE(NULLIF(d.attributes->>'author', ''), NULLIF(d.attributes->>'pubkey', '')) AS author
        FROM documents d
        UNION ALL
        SELECT NULLIF(dm.meta_value, '') AS author
        FROM document_metadata dm
        WHERE dm.meta_key IN ('author', 'detected_author')
      ) authors
      WHERE author IS NOT NULL
      GROUP BY author
      ORDER BY count DESC, value ASC
      LIMIT 30
    `),

    pool.query(`
      SELECT content_type::text AS value, COUNT(*)::int AS count
      FROM documents
      GROUP BY content_type
      ORDER BY count DESC, value ASC
    `),

    pool.query(`
      SELECT COALESCE(NULLIF(document_type, ''), 'unknown') AS value, COUNT(*)::int AS count
      FROM documents
      GROUP BY value
      ORDER BY count DESC, value ASC
    `),

    pool.query(`
      SELECT LOWER(meta_value) AS sentiment, COUNT(*)::int AS count
      FROM document_metadata
      WHERE meta_key = 'sentiment'
      GROUP BY LOWER(meta_value)
      ORDER BY count DESC, sentiment ASC
    `),

    pool.query(`
      SELECT entity_type, normalized_value AS value, COUNT(DISTINCT document_id)::int AS count
      FROM document_entities
      WHERE normalized_value IS NOT NULL
      GROUP BY entity_type, normalized_value
      ORDER BY entity_type ASC, count DESC, value ASC
    `),

    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days')::int AS last_90d,
        COUNT(*)::int AS all_time
      FROM documents
    `),

    pool.query(`
      SELECT
        COUNT(*)::int AS documents,
        COUNT(*) FILTER (WHERE attributes->>'nostr' = 'true')::int AS nostr_documents,
        (SELECT COUNT(DISTINCT document_id)::int FROM document_tags) AS tagged_documents
      FROM documents
    `),
  ]);

  const entityTypes: Record<string, SearchFacetValue[]> = {};
  for (const row of entitiesResult.rows) {
    if (!entityTypes[row.entity_type]) {
      entityTypes[row.entity_type] = [];
    }
    if (entityTypes[row.entity_type].length < 20) {
      entityTypes[row.entity_type].push({ value: row.value, count: Number(row.count) || 0 });
    }
  }

  const dateRow = dateRangesResult.rows[0] || {};
  const totalsRow = totalsResult.rows[0] || {};

  return {
    tags: tagsResult.rows.map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
    authors: authorsResult.rows.map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
    contentTypes: contentTypesResult.rows.map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
    documentTypes: documentTypesResult.rows.map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
    sentiment: sentimentResult.rows.map((row) => ({
      sentiment: row.sentiment,
      value: row.sentiment,
      count: Number(row.count) || 0,
    })),
    entityTypes,
    dateRanges: [
      { range: '24h', label: 'Last 24 hours', count: Number(dateRow.last_24h) || 0 },
      { range: '7d', label: 'Last 7 days', count: Number(dateRow.last_7d) || 0 },
      { range: '30d', label: 'Last 30 days', count: Number(dateRow.last_30d) || 0 },
      { range: '90d', label: 'Last 90 days', count: Number(dateRow.last_90d) || 0 },
      { range: 'all', label: 'All time', count: Number(dateRow.all_time) || 0 },
    ],
    totals: {
      documents: Number(totalsRow.documents) || 0,
      taggedDocuments: Number(totalsRow.tagged_documents) || 0,
      nostrDocuments: Number(totalsRow.nostr_documents) || 0,
    },
  };
}
