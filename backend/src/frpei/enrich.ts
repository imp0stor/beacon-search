import { Pool } from 'pg';
import { FrpeiCandidate } from './types';

export async function enrichCandidates(pool: Pool, candidates: FrpeiCandidate[]): Promise<FrpeiCandidate[]> {
  const conceptIds = Array.from(new Set(candidates.map(c => c.canonical?.conceptId).filter(Boolean))) as string[];

  if (!conceptIds.length) {
    return candidates.map(candidate => ({
      ...candidate,
      enrichment: candidate.enrichment || {
        synonyms: [],
        related: [],
        metadata: candidate.metadata || {},
        provenance: { sources: [], enrichedAt: new Date().toISOString() },
        confidence: { overall: 0, entityResolution: candidate.canonical?.confidence || 0 }
      }
    }));
  }

  const conceptRows = await pool.query(`
    SELECT o.id, o.term, o.synonyms,
      array_remove(array_agg(DISTINCT a.alias), NULL) as aliases,
      array_remove(array_agg(DISTINCT t.name), NULL) as taxonomies
    FROM ontology o
    LEFT JOIN ontology_aliases a ON a.concept_id = o.id
    LEFT JOIN ontology_concept_taxonomies ct ON ct.concept_id = o.id
    LEFT JOIN ontology_taxonomies t ON t.id = ct.taxonomy_id
    WHERE o.id = ANY($1)
    GROUP BY o.id, o.term, o.synonyms
  `, [conceptIds]);

  const relationsRows = await pool.query(`
    SELECT r.source_id, r.relation_type, r.weight, o.term as target_term
    FROM ontology_relations r
    JOIN ontology o ON o.id = r.target_id
    WHERE r.source_id = ANY($1)
  `, [conceptIds]);

  const conceptMap = new Map<string, { term: string; synonyms: string[]; aliases: string[]; taxonomies: string[] }>();
  for (const row of conceptRows.rows) {
    conceptMap.set(row.id, {
      term: row.term,
      synonyms: row.synonyms || [],
      aliases: row.aliases || [],
      taxonomies: row.taxonomies || []
    });
  }

  const relationMap = new Map<string, { term: string; type: string; weight: number }[]>();
  for (const row of relationsRows.rows) {
    const list = relationMap.get(row.source_id) || [];
    list.push({ term: row.target_term, type: row.relation_type, weight: row.weight || 1 });
    relationMap.set(row.source_id, list);
  }

  const dictionaryTerms = Array.from(new Set(conceptRows.rows.map(row => (row.term || '').toLowerCase()).filter(Boolean)));
  const dictionaryMap = new Map<string, string[]>();
  if (dictionaryTerms.length) {
    const dictionaryRows = await pool.query(`
      SELECT term, synonyms
      FROM dictionary
      WHERE LOWER(term) = ANY($1)
    `, [dictionaryTerms]);
    for (const row of dictionaryRows.rows) {
      dictionaryMap.set((row.term || '').toLowerCase(), row.synonyms || []);
    }
  }

  return candidates.map(candidate => {
    if (!candidate.canonical) return candidate;
    const concept = conceptMap.get(candidate.canonical.conceptId);
    const synonyms = new Set<string>();
    const sources: string[] = [];

    if (concept) {
      concept.synonyms.forEach(s => synonyms.add(s));
      concept.aliases.forEach(s => synonyms.add(s));
      sources.push('ontology');
    }

    const dictionarySynonyms = concept?.term ? dictionaryMap.get(concept.term.toLowerCase()) || [] : [];
    dictionarySynonyms.forEach(s => synonyms.add(s));
    if (dictionarySynonyms.length) sources.push('dictionary');

    const related = relationMap.get(candidate.canonical.conceptId) || [];

    const entityResolution = candidate.canonical.confidence || 0;
    const overall = Math.min(1, entityResolution * 0.7 + (related.length ? 0.2 : 0) + (synonyms.size ? 0.1 : 0));

    return {
      ...candidate,
      enrichment: {
        synonyms: Array.from(synonyms),
        related,
        metadata: {
          ...(candidate.metadata || {}),
          taxonomies: concept?.taxonomies || []
        },
        provenance: {
          sources,
          enrichedAt: new Date().toISOString()
        },
        confidence: {
          overall,
          entityResolution
        }
      }
    };
  });
}
