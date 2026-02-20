import { Pool } from 'pg';
import {
  AbbreviationExpansion,
  ConceptMatch,
  ExpansionDetail,
  FuzzyMatch,
  QueryRewriteExplanation,
  QueryRewriteResult,
  WeightedTerm
} from './types';

const STOPWORDS = new Set([
  'the', 'and', 'or', 'of', 'in', 'to', 'for', 'a', 'an', 'on', 'with', 'by', 'about', 'from', 'is', 'are', 'be'
]);

export interface QueryRewriteOptions {
  expand?: boolean;
  enableFuzzy?: boolean;
  enableAbbrev?: boolean;
  maxExpansionsPerTerm?: number;
  maxTotalExpansions?: number;
  maxFuzzyMatches?: number;
  fuzzyMaxDistance?: number;
  vectorTermLimit?: number;
}

const DEFAULT_OPTIONS: Required<QueryRewriteOptions> = {
  expand: true,
  enableFuzzy: true,
  enableAbbrev: true,
  maxExpansionsPerTerm: 6,
  maxTotalExpansions: 30,
  maxFuzzyMatches: 2,
  fuzzyMaxDistance: 2,
  vectorTermLimit: 12
};

const WEIGHTS = {
  original: 1.0,
  concept: 0.9,
  synonym: 0.7,
  related: 0.45,
  broader: 0.4,
  narrower: 0.4,
  abbreviation: 0.6,
  fuzzy: 0.35
};

function normalizeQuery(query: string): string {
  return query
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractPhrases(query: string): { phrases: string[]; remaining: string } {
  const phrases: string[] = [];
  let remaining = query;
  const regex = /"([^"]+)"|'([^']+)'/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(query)) !== null) {
    const phrase = (match[1] || match[2] || '').trim();
    if (phrase) {
      phrases.push(phrase);
      remaining = remaining.replace(match[0], ' ');
    }
  }

  return { phrases, remaining: remaining.replace(/\s+/g, ' ').trim() };
}

function tokenize(query: string): string[] {
  return query
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

function sanitizeTsqueryTerm(term: string): string | null {
  const cleaned = term.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return cleaned.length ? cleaned : null;
}

function phraseToTsquery(phrase: string): string | null {
  const parts = phrase
    .split(/\s+/)
    .map(part => sanitizeTsqueryTerm(part))
    .filter(Boolean) as string[];
  if (!parts.length) return null;
  return parts.join(' <-> ');
}

function editDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

async function fetchConceptMatches(pool: Pool, terms: string[]): Promise<ConceptMatch[]> {
  if (!terms.length) return [];
  const lowered = terms.map(t => t.toLowerCase());

  const result = await pool.query(`
    SELECT o.id, o.term, o.synonyms, a.alias, a.alias_type,
           array_remove(array_agg(DISTINCT t.name), NULL) as taxonomies
    FROM ontology o
    LEFT JOIN ontology_aliases a ON a.concept_id = o.id
    LEFT JOIN ontology_concept_taxonomies ct ON ct.concept_id = o.id
    LEFT JOIN ontology_taxonomies t ON t.id = ct.taxonomy_id
    WHERE LOWER(o.term) = ANY($1)
       OR EXISTS (SELECT 1 FROM unnest(o.synonyms) s WHERE LOWER(s) = ANY($1))
       OR LOWER(a.alias) = ANY($1)
    GROUP BY o.id, o.term, o.synonyms, a.alias, a.alias_type
  `, [lowered]);

  const matches: ConceptMatch[] = [];
  const seen = new Set<string>();

  for (const row of result.rows) {
    const preferred = row.term as string;
    const aliases = Array.isArray(row.synonyms) ? row.synonyms : [];
    if (row.alias) aliases.push(row.alias);

    for (const term of terms) {
      const termLower = term.toLowerCase();
      const matchKey = `${row.id}-${termLower}`;
      if (seen.has(matchKey)) continue;

      let matchedBy: ConceptMatch['matchedBy'] | null = null;
      if (preferred.toLowerCase() === termLower) matchedBy = 'term';
      else if (aliases.some((s: string) => s.toLowerCase() === termLower)) matchedBy = 'synonym';
      if (row.alias && row.alias.toLowerCase() === termLower) matchedBy = 'alias';

      if (matchedBy) {
        matches.push({
          conceptId: row.id,
          term,
          matchedBy,
          preferredTerm: preferred,
          aliases: Array.from(new Set(aliases.map((s: string) => s.toLowerCase()))),
          taxonomies: row.taxonomies || []
        });
        seen.add(matchKey);
      }
    }
  }

  return matches;
}

async function fetchConceptRelations(pool: Pool, conceptIds: string[]): Promise<{ id: string; term: string; type: string; weight: number }[]> {
  if (!conceptIds.length) return [];

  const relationResult = await pool.query(`
    SELECT r.source_id, r.target_id, r.relation_type, r.weight, o.term
    FROM ontology_relations r
    JOIN ontology o ON o.id = r.target_id
    WHERE r.source_id = ANY($1)
  `, [conceptIds]);

  const parentResult = await pool.query(`
    SELECT child.id as child_id, parent.id as parent_id, parent.term as parent_term
    FROM ontology child
    JOIN ontology parent ON parent.id = child.parent_id
    WHERE child.id = ANY($1)
  `, [conceptIds]);

  const childResult = await pool.query(`
    SELECT id, parent_id, term
    FROM ontology
    WHERE parent_id = ANY($1)
  `, [conceptIds]);

  const relations: { id: string; term: string; type: string; weight: number }[] = [];

  for (const row of relationResult.rows) {
    relations.push({ id: row.target_id, term: row.term, type: row.relation_type, weight: row.weight || 1 });
  }

  for (const row of parentResult.rows) {
    relations.push({ id: row.parent_id, term: row.parent_term, type: 'broader', weight: 1 });
  }

  for (const row of childResult.rows) {
    relations.push({ id: row.id, term: row.term, type: 'narrower', weight: 1 });
  }

  return relations;
}

async function fetchDictionaryExpansions(pool: Pool, terms: string[]): Promise<ExpansionDetail[]> {
  if (!terms.length) return [];
  const lowered = terms.map(t => t.toLowerCase());
  const result = await pool.query(`
    SELECT term, synonyms, acronym_for, boost_weight
    FROM dictionary
    WHERE LOWER(term) = ANY($1)
       OR EXISTS (SELECT 1 FROM unnest(synonyms) s WHERE LOWER(s) = ANY($1))
  `, [lowered]);

  return result.rows.map(row => ({
    term: row.term,
    expanded: [...(row.synonyms || []), ...(row.acronym_for ? [row.acronym_for] : [])],
    type: 'dictionary',
    weight: row.boost_weight || WEIGHTS.synonym,
    source: 'dictionary'
  }));
}

async function fetchAbbreviationExpansions(pool: Pool, terms: string[]): Promise<AbbreviationExpansion[]> {
  if (!terms.length) return [];
  const lowered = terms.map(t => t.toLowerCase());

  const dict = await pool.query(`
    SELECT term, acronym_for
    FROM dictionary
    WHERE acronym_for IS NOT NULL AND LOWER(term) = ANY($1)
  `, [lowered]);

  const aliases = await pool.query(`
    SELECT a.alias, o.term
    FROM ontology_aliases a
    JOIN ontology o ON o.id = a.concept_id
    WHERE a.alias_type = 'abbrev' AND LOWER(a.alias) = ANY($1)
  `, [lowered]);

  const expansions: AbbreviationExpansion[] = [];
  for (const row of dict.rows) {
    if (row.acronym_for) {
      expansions.push({ term: row.term, expansion: row.acronym_for, source: 'dictionary' });
    }
  }
  for (const row of aliases.rows) {
    expansions.push({ term: row.alias, expansion: row.term, source: 'ontology' });
  }

  return expansions;
}

async function fetchLexicon(pool: Pool): Promise<{ terms: string[]; source: 'ontology' | 'dictionary' | 'alias' }[]> {
  const [ontologyRows, dictionaryRows, aliasRows] = await Promise.all([
    pool.query('SELECT term, synonyms FROM ontology'),
    pool.query('SELECT term, synonyms FROM dictionary'),
    pool.query('SELECT alias FROM ontology_aliases')
  ]);

  const lexicon: { terms: string[]; source: 'ontology' | 'dictionary' | 'alias' }[] = [];

  for (const row of ontologyRows.rows) {
    const terms = [row.term, ...(row.synonyms || [])].filter(Boolean);
    lexicon.push({ terms, source: 'ontology' });
  }
  for (const row of dictionaryRows.rows) {
    const terms = [row.term, ...(row.synonyms || [])].filter(Boolean);
    lexicon.push({ terms, source: 'dictionary' });
  }
  for (const row of aliasRows.rows) {
    if (row.alias) {
      lexicon.push({ terms: [row.alias], source: 'alias' });
    }
  }

  return lexicon;
}

async function applyFuzzyMatching(pool: Pool, terms: string[], maxMatches: number, maxDistance: number): Promise<FuzzyMatch[]> {
  if (!terms.length) return [];
  const lexicon = await fetchLexicon(pool);
  const flatTerms = lexicon.flatMap(entry => entry.terms.map(term => ({ term: term.toLowerCase(), source: entry.source })));

  const matches: FuzzyMatch[] = [];

  for (const term of terms) {
    if (term.length < 4) continue;
    const termLower = term.toLowerCase();
    const candidates = flatTerms.filter(candidate => candidate.term[0] === termLower[0] && Math.abs(candidate.term.length - termLower.length) <= 2);

    let best: FuzzyMatch | null = null;
    for (const candidate of candidates) {
      if (candidate.term === termLower) continue;
      const distance = editDistance(termLower, candidate.term);
      if (distance <= maxDistance) {
        if (!best || distance < best.distance) {
          best = { term, match: candidate.term, distance, source: candidate.source };
        }
      }
    }

    if (best) {
      matches.push(best);
    }

    if (matches.length >= maxMatches) break;
  }

  return matches;
}

function addWeightedTerm(
  terms: Map<string, WeightedTerm>,
  term: string,
  weight: number,
  source: string,
  conceptId?: string
) {
  const cleaned = term.trim().toLowerCase();
  if (!cleaned || STOPWORDS.has(cleaned)) return;
  const existing = terms.get(cleaned);
  if (!existing || weight > existing.weight) {
    terms.set(cleaned, { term: cleaned, weight, source, conceptId });
  }
}

function buildTextQuery(terms: string[], phrases: string[]): string {
  const sanitized = terms
    .map(sanitizeTsqueryTerm)
    .filter(Boolean) as string[];

  const phraseQueries = phrases
    .map(phraseToTsquery)
    .filter(Boolean) as string[];

  const combined = [...new Set([...sanitized, ...phraseQueries])];
  return combined.length ? combined.join(' | ') : '';
}

export async function rewriteQuery(
  pool: Pool,
  query: string,
  options: QueryRewriteOptions = {}
): Promise<QueryRewriteResult> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const normalized = normalizeQuery(query);
  const { phrases, remaining } = extractPhrases(normalized);
  const tokens = tokenize(remaining);
  const originalTerms = Array.from(new Set([...tokens, ...phrases]));

  const explanation: QueryRewriteExplanation = {
    originalQuery: query,
    normalizedQuery: normalized,
    tokens,
    phrases,
    expandedTerms: [],
    ontologyExpansions: [],
    dictionaryExpansions: [],
    abbreviationExpansions: [],
    fuzzyMatches: [],
    conceptMatches: [],
    finalQuery: query,
    vectorQuery: query,
    textQuery: ''
  };

  const weightedTerms = new Map<string, WeightedTerm>();
  originalTerms.forEach(term => addWeightedTerm(weightedTerms, term, WEIGHTS.original, 'original'));

  if (!config.expand) {
    const finalTerms = Array.from(weightedTerms.values()).map(t => t.term);
    const vectorQuery = finalTerms.join(' ');
    const textQuery = buildTextQuery(finalTerms, phrases);
    explanation.finalQuery = vectorQuery;
    explanation.vectorQuery = vectorQuery;
    explanation.textQuery = textQuery;
    return {
      originalTerms,
      weightedTerms: Array.from(weightedTerms.values()),
      finalTerms,
      vectorQuery,
      textQuery,
      explanation
    };
  }

  const conceptMatches = await fetchConceptMatches(pool, originalTerms);
  explanation.conceptMatches = conceptMatches;

  const conceptIds = Array.from(new Set(conceptMatches.map(match => match.conceptId)));
  const relations = await fetchConceptRelations(pool, conceptIds);

  for (const match of conceptMatches) {
    addWeightedTerm(weightedTerms, match.preferredTerm, WEIGHTS.concept, 'concept', match.conceptId);
    match.aliases.slice(0, config.maxExpansionsPerTerm).forEach(alias => {
      addWeightedTerm(weightedTerms, alias, WEIGHTS.synonym, 'alias', match.conceptId);
    });
  }

  for (const relation of relations) {
    const relationWeight = relation.type === 'related' ? WEIGHTS.related : relation.type === 'broader' ? WEIGHTS.broader : WEIGHTS.narrower;
    addWeightedTerm(weightedTerms, relation.term, relationWeight, relation.type);
    explanation.ontologyExpansions.push({
      term: relation.term,
      expanded: [relation.term],
      type: relation.type,
      weight: relationWeight,
      source: 'ontology',
      conceptId: relation.id
    });
  }

  const dictionaryExpansions = await fetchDictionaryExpansions(pool, originalTerms);
  for (const exp of dictionaryExpansions) {
    explanation.dictionaryExpansions.push(exp);
    exp.expanded.slice(0, config.maxExpansionsPerTerm).forEach(term => {
      const weight = Math.min(1, (exp.weight || WEIGHTS.synonym) * WEIGHTS.synonym);
      addWeightedTerm(weightedTerms, term, weight, 'dictionary');
    });
  }

  if (config.enableAbbrev) {
    const abbrevExpansions = await fetchAbbreviationExpansions(pool, originalTerms);
    explanation.abbreviationExpansions = abbrevExpansions;
    abbrevExpansions.forEach(exp => {
      addWeightedTerm(weightedTerms, exp.expansion, WEIGHTS.abbreviation, 'abbreviation');
    });
  }

  if (config.enableFuzzy) {
    const unmatched = originalTerms.filter(term => {
      const lower = term.toLowerCase();
      return !conceptMatches.some(match => match.term.toLowerCase() === lower);
    });
    const fuzzyMatches = await applyFuzzyMatching(pool, unmatched, config.maxFuzzyMatches, config.fuzzyMaxDistance);
    explanation.fuzzyMatches = fuzzyMatches;
    fuzzyMatches.forEach(match => {
      addWeightedTerm(weightedTerms, match.match, WEIGHTS.fuzzy, 'fuzzy');
    });
  }

  const sortedTerms = Array.from(weightedTerms.values()).sort((a, b) => b.weight - a.weight);
  const cappedTerms = sortedTerms.slice(0, config.maxTotalExpansions);
  const finalTerms = Array.from(new Set(cappedTerms.map(term => term.term)));

  explanation.expandedTerms = finalTerms.filter(term => !originalTerms.includes(term));

  const vectorTerms = cappedTerms.slice(0, config.vectorTermLimit).map(term => term.term);
  const vectorQuery = vectorTerms.join(' ');
  const textQuery = buildTextQuery(finalTerms, phrases);

  explanation.finalQuery = vectorQuery;
  explanation.vectorQuery = vectorQuery;
  explanation.textQuery = textQuery;

  return {
    originalTerms,
    weightedTerms: cappedTerms,
    finalTerms,
    vectorQuery,
    textQuery,
    explanation
  };
}
