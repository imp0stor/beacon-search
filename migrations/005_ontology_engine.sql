-- Ontology engine enhancements: aliases, relations, taxonomies

CREATE TABLE IF NOT EXISTS ontology_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
  alias VARCHAR(255) NOT NULL,
  alias_type VARCHAR(50) NOT NULL DEFAULT 'synonym',
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (concept_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_ontology_aliases_alias ON ontology_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_ontology_aliases_type ON ontology_aliases(alias_type);

CREATE TABLE IF NOT EXISTS ontology_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
  relation_type VARCHAR(30) NOT NULL,
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_id, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_ontology_relations_source ON ontology_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_target ON ontology_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_ontology_relations_type ON ontology_relations(relation_type);

CREATE TABLE IF NOT EXISTS ontology_taxonomies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ontology_concept_taxonomies (
  concept_id UUID NOT NULL REFERENCES ontology(id) ON DELETE CASCADE,
  taxonomy_id UUID NOT NULL REFERENCES ontology_taxonomies(id) ON DELETE CASCADE,
  rank INTEGER DEFAULT 0,
  PRIMARY KEY (concept_id, taxonomy_id)
);

CREATE INDEX IF NOT EXISTS idx_ontology_concept_taxonomies_taxonomy ON ontology_concept_taxonomies(taxonomy_id);
