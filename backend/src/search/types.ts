export type RelationType = 'broader' | 'narrower' | 'related';
export type AliasType = 'synonym' | 'abbrev' | 'phrase' | 'alt';

export interface WeightedTerm {
  term: string;
  weight: number;
  source: string;
  conceptId?: string;
}

export interface ConceptMatch {
  conceptId: string;
  term: string;
  matchedBy: 'term' | 'synonym' | 'alias' | 'phrase' | 'fuzzy';
  preferredTerm: string;
  aliases: string[];
  taxonomies: string[];
}

export interface ExpansionDetail {
  term: string;
  expanded: string[];
  type: string;
  weight: number;
  source?: string;
  conceptId?: string;
}

export interface FuzzyMatch {
  term: string;
  match: string;
  distance: number;
  source: 'ontology' | 'dictionary' | 'alias';
}

export interface AbbreviationExpansion {
  term: string;
  expansion: string;
  source: 'dictionary' | 'ontology';
}

export interface QueryRewriteExplanation {
  originalQuery: string;
  normalizedQuery: string;
  tokens: string[];
  phrases: string[];
  expandedTerms: string[];
  ontologyExpansions: ExpansionDetail[];
  dictionaryExpansions: ExpansionDetail[];
  abbreviationExpansions: AbbreviationExpansion[];
  fuzzyMatches: FuzzyMatch[];
  conceptMatches: ConceptMatch[];
  triggersApplied?: { name: string; pattern: string; actions: Record<string, any> }[];
  finalQuery: string;
  vectorQuery: string;
  textQuery: string;
}

export interface QueryRewriteResult {
  originalTerms: string[];
  weightedTerms: WeightedTerm[];
  finalTerms: string[];
  vectorQuery: string;
  textQuery: string;
  explanation: QueryRewriteExplanation;
}

export interface OntologyImportPayload {
  taxonomies?: { name: string; description?: string }[];
  concepts: {
    term: string;
    description?: string;
    synonyms?: string[];
    parentTerm?: string;
    aliases?: { alias: string; type?: AliasType; weight?: number }[];
    relations?: { type: RelationType; target: string; weight?: number }[];
    taxonomies?: string[];
  }[];
}

export interface OntologyExportPayload {
  taxonomies: { name: string; description?: string }[];
  concepts: {
    term: string;
    description?: string;
    synonyms: string[];
    parentTerm?: string | null;
    aliases: { alias: string; type: AliasType; weight: number }[];
    relations: { type: RelationType; target: string; weight: number }[];
    taxonomies: string[];
  }[];
}
