import { Pool } from 'pg';
import { Canonicalization, FrpeiCandidate } from './types';

const MATCH_WEIGHTS: Record<Canonicalization['matchedBy'], number> = {
  term: 0.9,
  synonym: 0.75,
  alias: 0.65
};

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 2);
}

function buildCandidateTerms(candidate: FrpeiCandidate): string[] {
  const terms = new Set<string>();
  const title = candidate.title || '';
  extractTokens(title).forEach(t => terms.add(t));
  if (title.length > 2) terms.add(title.toLowerCase());
  if (candidate.snippet) extractTokens(candidate.snippet).forEach(t => terms.add(t));
  return Array.from(terms);
}

export async function canonicalizeCandidates(pool: Pool, candidates: FrpeiCandidate[]): Promise<FrpeiCandidate[]> {
  const enriched: FrpeiCandidate[] = [];

  for (const candidate of candidates) {
    const terms = buildCandidateTerms(candidate);
    if (!terms.length) {
      enriched.push(candidate);
      continue;
    }

    const result = await pool.query(`
      SELECT o.id, o.term, o.synonyms, a.alias, a.alias_type, a.weight,
        array_remove(array_agg(DISTINCT t.name), NULL) as taxonomies
      FROM ontology o
      LEFT JOIN ontology_aliases a ON a.concept_id = o.id
      LEFT JOIN ontology_concept_taxonomies ct ON ct.concept_id = o.id
      LEFT JOIN ontology_taxonomies t ON t.id = ct.taxonomy_id
      WHERE LOWER(o.term) = ANY($1)
         OR EXISTS (SELECT 1 FROM unnest(o.synonyms) s WHERE LOWER(s) = ANY($1))
         OR LOWER(a.alias) = ANY($1)
      GROUP BY o.id, o.term, o.synonyms, a.alias, a.alias_type, a.weight
    `, [terms]);

    let bestMatch: Canonicalization | null = null;

    for (const row of result.rows) {
      const preferred = (row.term as string) || '';
      const synonyms = Array.isArray(row.synonyms) ? row.synonyms.map((s: string) => s.toLowerCase()) : [];
      const alias = row.alias ? String(row.alias).toLowerCase() : null;
      const matchTerm = preferred.toLowerCase();

      for (const term of terms) {
        const lower = term.toLowerCase();
        let matchedBy: Canonicalization['matchedBy'] | null = null;
        let matchedValue = '';

        if (lower === matchTerm) {
          matchedBy = 'term';
          matchedValue = term;
        } else if (synonyms.includes(lower)) {
          matchedBy = 'synonym';
          matchedValue = term;
        } else if (alias && alias === lower) {
          matchedBy = 'alias';
          matchedValue = term;
        }

        if (!matchedBy) continue;

        const aliasWeight = row.weight ? Number(row.weight) : 1;
        const titleBonus = candidate.title.toLowerCase().includes(lower) ? 0.05 : 0;
        const confidence = Math.min(1, MATCH_WEIGHTS[matchedBy] * aliasWeight + titleBonus);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            conceptId: row.id,
            preferredTerm: preferred,
            matchedBy,
            matchedValue,
            confidence,
            taxonomies: row.taxonomies || [],
            provenance: {
              source: 'ontology',
              matchedOn: matchedValue,
              timestamp: new Date().toISOString()
            }
          };
        }
      }
    }

    enriched.push({
      ...candidate,
      canonical: bestMatch || undefined
    });
  }

  return enriched;
}
