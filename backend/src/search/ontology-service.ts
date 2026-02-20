import { Pool } from 'pg';
import { OntologyExportPayload, OntologyImportPayload } from './types';

export async function importOntology(pool: Pool, payload: OntologyImportPayload): Promise<{ concepts: number; taxonomies: number; aliases: number; relations: number; assignments: number }> {
  const client = await pool.connect();
  let conceptCount = 0;
  let taxonomyCount = 0;
  let aliasCount = 0;
  let relationCount = 0;
  let assignmentCount = 0;

  try {
    await client.query('BEGIN');

    const taxonomyMap = new Map<string, string>();
    if (payload.taxonomies) {
      for (const taxonomy of payload.taxonomies) {
        const result = await client.query(`
          INSERT INTO ontology_taxonomies (name, description)
          VALUES ($1, $2)
          ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
          RETURNING id
        `, [taxonomy.name, taxonomy.description || null]);
        taxonomyMap.set(taxonomy.name, result.rows[0].id);
        taxonomyCount++;
      }
    }

    const conceptMap = new Map<string, string>();
    for (const concept of payload.concepts) {
      const result = await client.query(`
        INSERT INTO ontology (term, description, synonyms)
        VALUES ($1, $2, $3)
        ON CONFLICT (term) DO UPDATE SET
          description = COALESCE(EXCLUDED.description, ontology.description),
          synonyms = CASE
            WHEN array_length(EXCLUDED.synonyms, 1) IS NULL THEN ontology.synonyms
            ELSE (SELECT ARRAY(SELECT DISTINCT unnest(ontology.synonyms || EXCLUDED.synonyms)))
          END,
          updated_at = NOW()
        RETURNING id
      `, [concept.term, concept.description || null, concept.synonyms || []]);
      conceptMap.set(concept.term.toLowerCase(), result.rows[0].id);
      conceptCount++;
    }

    for (const concept of payload.concepts) {
      if (concept.parentTerm) {
        const parentId = conceptMap.get(concept.parentTerm.toLowerCase());
        const conceptId = conceptMap.get(concept.term.toLowerCase());
        if (parentId && conceptId) {
          await client.query('UPDATE ontology SET parent_id = $1 WHERE id = $2', [parentId, conceptId]);
        }
      }

      const conceptId = conceptMap.get(concept.term.toLowerCase());
      if (!conceptId) continue;

      if (concept.aliases) {
        for (const alias of concept.aliases) {
          await client.query(`
            INSERT INTO ontology_aliases (concept_id, alias, alias_type, weight)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (concept_id, alias) DO UPDATE SET
              alias_type = EXCLUDED.alias_type,
              weight = EXCLUDED.weight,
              updated_at = NOW()
          `, [conceptId, alias.alias, alias.type || 'synonym', alias.weight || 1.0]);
          aliasCount++;
        }
      }

      if (concept.relations) {
        for (const relation of concept.relations) {
          const targetId = conceptMap.get(relation.target.toLowerCase());
          if (!targetId) continue;
          await client.query(`
            INSERT INTO ontology_relations (source_id, target_id, relation_type, weight)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (source_id, target_id, relation_type) DO UPDATE SET
              weight = EXCLUDED.weight
          `, [conceptId, targetId, relation.type, relation.weight || 1.0]);
          relationCount++;
        }
      }

      if (concept.taxonomies) {
        for (const name of concept.taxonomies) {
          let taxonomyId = taxonomyMap.get(name);
          if (!taxonomyId) {
            const result = await client.query(`
              INSERT INTO ontology_taxonomies (name)
              VALUES ($1)
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [name]);
            taxonomyId = result.rows[0].id;
          }

          if (!taxonomyId) continue;
          taxonomyMap.set(name, taxonomyId);

          await client.query(`
            INSERT INTO ontology_concept_taxonomies (concept_id, taxonomy_id)
            VALUES ($1, $2)
            ON CONFLICT (concept_id, taxonomy_id) DO NOTHING
          `, [conceptId, taxonomyId]);
          assignmentCount++;
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { concepts: conceptCount, taxonomies: taxonomyCount, aliases: aliasCount, relations: relationCount, assignments: assignmentCount };
}

export async function exportOntology(pool: Pool): Promise<OntologyExportPayload> {
  const conceptsResult = await pool.query('SELECT id, term, description, synonyms, parent_id FROM ontology ORDER BY term');
  const aliasesResult = await pool.query('SELECT concept_id, alias, alias_type, weight FROM ontology_aliases');
  const relationsResult = await pool.query('SELECT source_id, target_id, relation_type, weight FROM ontology_relations');
  const taxonomiesResult = await pool.query('SELECT id, name, description FROM ontology_taxonomies ORDER BY name');
  const assignmentsResult = await pool.query('SELECT concept_id, taxonomy_id FROM ontology_concept_taxonomies');

  const taxonomies = taxonomiesResult.rows.map(row => ({ name: row.name, description: row.description || undefined }));

  const aliasMap = new Map<string, { alias: string; type: any; weight: number }[]>();
  for (const row of aliasesResult.rows) {
    const list = aliasMap.get(row.concept_id) || [];
    list.push({ alias: row.alias, type: row.alias_type, weight: row.weight || 1.0 });
    aliasMap.set(row.concept_id, list);
  }

  const relationMap = new Map<string, { type: any; target: string; weight: number }[]>();
  for (const row of relationsResult.rows) {
    const list = relationMap.get(row.source_id) || [];
    list.push({ type: row.relation_type, target: row.target_id, weight: row.weight || 1.0 });
    relationMap.set(row.source_id, list);
  }

  const taxonomyLookup = new Map<string, string>();
  for (const row of taxonomiesResult.rows) {
    taxonomyLookup.set(row.id, row.name);
  }

  const taxonomyMap = new Map<string, string[]>();
  for (const row of assignmentsResult.rows) {
    const list = taxonomyMap.get(row.concept_id) || [];
    const name = taxonomyLookup.get(row.taxonomy_id);
    if (name) list.push(name);
    taxonomyMap.set(row.concept_id, list);
  }

  const conceptLookup = new Map<string, string>();
  conceptsResult.rows.forEach(row => conceptLookup.set(row.id, row.term));

  const concepts = conceptsResult.rows.map(row => {
    const parentTerm = row.parent_id ? conceptLookup.get(row.parent_id) : null;
    const relations = (relationMap.get(row.id) || []).map(rel => ({
      type: rel.type,
      target: conceptLookup.get(rel.target) || rel.target,
      weight: rel.weight
    }));

    return {
      term: row.term,
      description: row.description || undefined,
      synonyms: row.synonyms || [],
      parentTerm: parentTerm || undefined,
      aliases: aliasMap.get(row.id) || [],
      relations,
      taxonomies: taxonomyMap.get(row.id) || []
    };
  });

  return { taxonomies, concepts };
}
