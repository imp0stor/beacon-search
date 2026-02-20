import { Pool } from 'pg';

export async function resolveCanonicalEntity(pool: Pool, title: string): Promise<{ entity_id?: string; term?: string; confidence?: number }> {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return {};

  const exact = await pool.query(
    `SELECT id, term, 0.95 as confidence
     FROM ontology
     WHERE LOWER(term) = $1
     LIMIT 1`,
    [normalized]
  );
  if (exact.rows.length) {
    return {
      entity_id: exact.rows[0].id,
      term: exact.rows[0].term,
      confidence: 0.95
    };
  }

  const alias = await pool.query(
    `SELECT o.id, o.term, a.weight
     FROM ontology_aliases a
     JOIN ontology o ON o.id = a.concept_id
     WHERE LOWER(a.alias) = $1
     ORDER BY a.weight DESC
     LIMIT 1`,
    [normalized]
  );
  if (alias.rows.length) {
    const weight = alias.rows[0].weight || 1.0;
    return {
      entity_id: alias.rows[0].id,
      term: alias.rows[0].term,
      confidence: Math.min(0.9, 0.8 + 0.1 * weight)
    };
  }

  const synonym = await pool.query(
    `SELECT id, term
     FROM ontology
     WHERE EXISTS (SELECT 1 FROM unnest(synonyms) s WHERE LOWER(s) = $1)
     LIMIT 1`,
    [normalized]
  );
  if (synonym.rows.length) {
    return {
      entity_id: synonym.rows[0].id,
      term: synonym.rows[0].term,
      confidence: 0.8
    };
  }

  const partial = await pool.query(
    `SELECT id, term
     FROM ontology
     WHERE term ILIKE $1
     ORDER BY LENGTH(term) ASC
     LIMIT 1`,
    [`%${normalized}%`]
  );
  if (partial.rows.length) {
    return {
      entity_id: partial.rows[0].id,
      term: partial.rows[0].term,
      confidence: 0.6
    };
  }

  return {};
}
