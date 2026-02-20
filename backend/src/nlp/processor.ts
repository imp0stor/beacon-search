/**
 * NLP Processor - Coordinates all NLP extraction modules
 * Provides unified interface for processing documents
 */

import { Pool } from 'pg';
import { 
  NLPResult, 
  DocumentForNLP, 
  ExtractedTag, 
  ExtractedEntity, 
  ExtractedMetadata,
  RelatedDocument,
  TagSuggestion,
  SearchFacets,
  FacetCount,
  EntityType
} from './types';
import { extractKeywords, classifyTopic, TFIDFExtractor } from './keyword-extractor';
import { extractEntities, groupEntitiesByType } from './entity-extractor';
import { extractMetadata } from './metadata-extractor';

export class NLPProcessor {
  private pool: Pool;
  private tfidfExtractor: TFIDFExtractor;
  private isTrainedOnCorpus: boolean = false;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.tfidfExtractor = new TFIDFExtractor();
  }
  
  // Train TF-IDF on existing corpus
  async trainOnCorpus(): Promise<void> {
    const result = await this.pool.query('SELECT content FROM documents LIMIT 1000');
    const documents = result.rows.map(r => r.content);
    
    if (documents.length > 0) {
      this.tfidfExtractor.train(documents);
      this.isTrainedOnCorpus = true;
      console.log(`[NLP] Trained TF-IDF on ${documents.length} documents`);
    }
  }
  
  // Process a single document
  async processDocument(doc: DocumentForNLP): Promise<NLPResult> {
    const fullText = `${doc.title} ${doc.content}`;
    
    // Extract keywords/tags
    const tags = this.isTrainedOnCorpus
      ? this.tfidfExtractor.extract(fullText, 15)
      : extractKeywords(fullText, 15);
    
    // Add topic classification as a tag
    const topic = classifyTopic(tags);
    if (topic !== 'General') {
      tags.push({
        tag: topic.toLowerCase(),
        confidence: 0.8,
        algorithm: 'topic-classification'
      });
    }
    
    // Extract entities
    const entities = extractEntities(fullText);
    
    // Extract metadata
    const metadata = extractMetadata(doc.content, doc.title, entities);
    
    return { tags, entities, metadata };
  }
  
  // Store NLP results in database
  async storeResults(documentId: string, results: NLPResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Store tags
      for (const tag of results.tags) {
        await client.query(`
          INSERT INTO document_tags (document_id, tag, confidence, source, algorithm)
          VALUES ($1, $2, $3, 'auto', $4)
          ON CONFLICT (document_id, tag) DO UPDATE SET
            confidence = GREATEST(document_tags.confidence, EXCLUDED.confidence),
            algorithm = EXCLUDED.algorithm
        `, [documentId, tag.tag, tag.confidence, tag.algorithm]);
      }
      
      // Store entities
      for (const entity of results.entities) {
        await client.query(`
          INSERT INTO document_entities (
            document_id, entity_type, entity_value, normalized_value,
            position_start, position_end, confidence, context
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (document_id, entity_type, entity_value, position_start) DO NOTHING
        `, [
          documentId,
          entity.type,
          entity.value,
          entity.normalizedValue,
          entity.positionStart,
          entity.positionEnd,
          entity.confidence,
          entity.context
        ]);
      }
      
      // Store metadata
      for (const meta of results.metadata) {
        await client.query(`
          INSERT INTO document_metadata (document_id, meta_key, meta_value, meta_type, confidence, extracted_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (document_id, meta_key) DO UPDATE SET
            meta_value = EXCLUDED.meta_value,
            meta_type = EXCLUDED.meta_type,
            confidence = EXCLUDED.confidence,
            extracted_by = EXCLUDED.extracted_by,
            updated_at = NOW()
        `, [documentId, meta.key, meta.value, meta.type, meta.confidence, meta.extractedBy]);
      }
      
      // Update processing status
      await client.query(`
        INSERT INTO nlp_processing_status (
          document_id, tags_extracted, tags_extracted_at,
          entities_extracted, entities_extracted_at,
          metadata_extracted, metadata_extracted_at
        ) VALUES ($1, true, NOW(), true, NOW(), true, NOW())
        ON CONFLICT (document_id) DO UPDATE SET
          tags_extracted = true,
          tags_extracted_at = NOW(),
          entities_extracted = true,
          entities_extracted_at = NOW(),
          metadata_extracted = true,
          metadata_extracted_at = NOW(),
          last_error = NULL
      `, [documentId]);
      
      // Update entity relationships
      await client.query('SELECT update_entity_relationships($1)', [documentId]);
      
      await client.query(`
        UPDATE nlp_processing_status 
        SET relationships_updated = true, relationships_updated_at = NOW()
        WHERE document_id = $1
      `, [documentId]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Log error in processing status
      await this.pool.query(`
        INSERT INTO nlp_processing_status (document_id, last_error)
        VALUES ($1, $2)
        ON CONFLICT (document_id) DO UPDATE SET
          last_error = EXCLUDED.last_error
      `, [documentId, String(error)]);
      
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Process and store a document
  async processAndStore(doc: DocumentForNLP): Promise<NLPResult> {
    const results = await this.processDocument(doc);
    await this.storeResults(doc.id, results);
    return results;
  }
  
  // Process all unprocessed documents
  async processUnprocessedDocuments(batchSize: number = 50): Promise<number> {
    // Get unprocessed documents
    const result = await this.pool.query(`
      SELECT d.id, d.title, d.content, d.url, d.created_at, d.attributes
      FROM documents d
      LEFT JOIN nlp_processing_status ps ON d.id = ps.document_id
      WHERE ps.document_id IS NULL 
         OR ps.tags_extracted = false 
         OR ps.entities_extracted = false
         OR ps.metadata_extracted = false
      LIMIT $1
    `, [batchSize]);
    
    let processed = 0;
    
    for (const row of result.rows) {
      try {
        await this.processAndStore({
          id: row.id,
          title: row.title,
          content: row.content,
          url: row.url,
          createdAt: row.created_at,
          attributes: row.attributes
        });
        processed++;
        console.log(`[NLP] Processed document ${row.id}: ${row.title.substring(0, 50)}...`);
      } catch (error) {
        console.error(`[NLP] Error processing document ${row.id}:`, error);
      }
    }
    
    return processed;
  }
  
  // Get tags for a document
  async getDocumentTags(documentId: string): Promise<ExtractedTag[]> {
    const result = await this.pool.query(`
      SELECT tag, confidence, source, algorithm
      FROM document_tags
      WHERE document_id = $1
      ORDER BY confidence DESC
    `, [documentId]);
    
    return result.rows.map(row => ({
      tag: row.tag,
      confidence: parseFloat(row.confidence),
      algorithm: row.algorithm || row.source
    }));
  }
  
  // Get entities for a document
  async getDocumentEntities(documentId: string): Promise<ExtractedEntity[]> {
    const result = await this.pool.query(`
      SELECT entity_type, entity_value, normalized_value, 
             position_start, position_end, confidence, context
      FROM document_entities
      WHERE document_id = $1
      ORDER BY position_start
    `, [documentId]);
    
    return result.rows.map(row => ({
      type: row.entity_type as EntityType,
      value: row.entity_value,
      normalizedValue: row.normalized_value,
      positionStart: row.position_start,
      positionEnd: row.position_end,
      confidence: parseFloat(row.confidence),
      context: row.context
    }));
  }
  
  // Get metadata for a document
  async getDocumentMetadata(documentId: string): Promise<ExtractedMetadata[]> {
    const result = await this.pool.query(`
      SELECT meta_key, meta_value, meta_type, confidence, extracted_by
      FROM document_metadata
      WHERE document_id = $1
    `, [documentId]);
    
    return result.rows.map(row => ({
      key: row.meta_key,
      value: row.meta_value,
      type: row.meta_type,
      confidence: parseFloat(row.confidence),
      extractedBy: row.extracted_by
    }));
  }
  
  // Add manual tag
  async addManualTag(documentId: string, tag: string): Promise<void> {
    await this.pool.query(`
      INSERT INTO document_tags (document_id, tag, confidence, source)
      VALUES ($1, $2, 1.0, 'manual')
      ON CONFLICT (document_id, tag) DO UPDATE SET
        confidence = 1.0,
        source = 'manual'
    `, [documentId, tag.toLowerCase().trim()]);
  }
  
  // Remove tag
  async removeTag(documentId: string, tag: string): Promise<void> {
    await this.pool.query(`
      DELETE FROM document_tags
      WHERE document_id = $1 AND tag = $2
    `, [documentId, tag.toLowerCase().trim()]);
  }
  
  // Get all entities of a type
  async getEntitiesByType(entityType: string, limit: number = 100): Promise<{ value: string; count: number }[]> {
    const result = await this.pool.query(`
      SELECT normalized_value as value, COUNT(DISTINCT document_id) as count
      FROM document_entities
      WHERE entity_type = $1
      GROUP BY normalized_value
      ORDER BY count DESC
      LIMIT $2
    `, [entityType.toUpperCase(), limit]);
    
    return result.rows.map(row => ({
      value: row.value,
      count: parseInt(row.count)
    }));
  }
  
  // Get related documents based on shared entities and tags
  async getRelatedDocuments(documentId: string, limit: number = 5): Promise<RelatedDocument[]> {
    // Get document's entities and tags
    const [entities, tags] = await Promise.all([
      this.getDocumentEntities(documentId),
      this.getDocumentTags(documentId)
    ]);
    
    const entityValues = entities
      .filter(e => ['PERSON', 'ORGANIZATION', 'LOCATION'].includes(e.type))
      .map(e => e.normalizedValue || e.value);
    
    const tagValues = tags.map(t => t.tag);
    
    if (entityValues.length === 0 && tagValues.length === 0) {
      return [];
    }
    
    // Find documents sharing entities or tags
    const result = await this.pool.query(`
      WITH entity_matches AS (
        SELECT de.document_id, 
               COUNT(*) as entity_match_count,
               array_agg(DISTINCT de.normalized_value) as shared_entities
        FROM document_entities de
        WHERE de.normalized_value = ANY($1)
          AND de.document_id != $2
        GROUP BY de.document_id
      ),
      tag_matches AS (
        SELECT dt.document_id,
               COUNT(*) as tag_match_count,
               array_agg(DISTINCT dt.tag) as shared_tags
        FROM document_tags dt
        WHERE dt.tag = ANY($3)
          AND dt.document_id != $2
        GROUP BY dt.document_id
      )
      SELECT d.id, d.title,
             COALESCE(em.entity_match_count, 0) as entity_matches,
             COALESCE(tm.tag_match_count, 0) as tag_matches,
             COALESCE(em.shared_entities, '{}') as shared_entities,
             COALESCE(tm.shared_tags, '{}') as shared_tags,
             (COALESCE(em.entity_match_count, 0) * 2 + COALESCE(tm.tag_match_count, 0)) as score
      FROM documents d
      LEFT JOIN entity_matches em ON d.id = em.document_id
      LEFT JOIN tag_matches tm ON d.id = tm.document_id
      WHERE em.document_id IS NOT NULL OR tm.document_id IS NOT NULL
      ORDER BY score DESC
      LIMIT $4
    `, [entityValues, documentId, tagValues, limit]);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      score: parseInt(row.score),
      sharedEntities: row.shared_entities || [],
      sharedTags: row.shared_tags || []
    }));
  }
  
  // Get tag suggestions based on similar documents
  async getTagSuggestions(documentId: string, limit: number = 10): Promise<TagSuggestion[]> {
    const related = await this.getRelatedDocuments(documentId, 10);
    
    if (related.length === 0) {
      return [];
    }
    
    const relatedIds = related.map(r => r.id);
    
    // Get tags from related documents that this document doesn't have
    const result = await this.pool.query(`
      SELECT dt.tag, AVG(dt.confidence) as avg_confidence, COUNT(*) as usage_count
      FROM document_tags dt
      WHERE dt.document_id = ANY($1)
        AND dt.tag NOT IN (
          SELECT tag FROM document_tags WHERE document_id = $2
        )
      GROUP BY dt.tag
      ORDER BY usage_count DESC, avg_confidence DESC
      LIMIT $3
    `, [relatedIds, documentId, limit]);
    
    return result.rows.map(row => ({
      tag: row.tag,
      confidence: parseFloat(row.avg_confidence),
      reason: `Used in ${row.usage_count} related document(s)`
    }));
  }
  
  // Get search facets
  async getSearchFacets(): Promise<SearchFacets> {
    const [tagResult, entityTypes, authorResult, sentimentResult, docTypeResult] = await Promise.all([
      // Top tags
      this.pool.query(`
        SELECT tag as value, COUNT(*) as count
        FROM document_tags
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 30
      `),
      
      // Entity types with top values
      Promise.all(['PERSON', 'ORGANIZATION', 'LOCATION'].map(async (type) => {
        const result = await this.pool.query(`
          SELECT normalized_value as value, COUNT(DISTINCT document_id) as count
          FROM document_entities
          WHERE entity_type = $1
          GROUP BY normalized_value
          ORDER BY count DESC
          LIMIT 20
        `, [type]);
        return { type, values: result.rows };
      })),
      
      // Authors
      this.pool.query(`
        SELECT meta_value as value, COUNT(*) as count
        FROM document_metadata
        WHERE meta_key = 'detected_author'
        GROUP BY meta_value
        ORDER BY count DESC
        LIMIT 20
      `),
      
      // Sentiment
      this.pool.query(`
        SELECT meta_value as value, COUNT(*) as count
        FROM document_metadata
        WHERE meta_key = 'sentiment'
        GROUP BY meta_value
        ORDER BY count DESC
      `),
      
      // Document types
      this.pool.query(`
        SELECT document_type as value, COUNT(*) as count
        FROM documents
        GROUP BY document_type
        ORDER BY count DESC
      `)
    ]);
    
    const entityTypesFacets: Record<string, FacetCount[]> = {};
    for (const { type, values } of entityTypes) {
      entityTypesFacets[type] = values.map(v => ({
        value: v.value,
        count: parseInt(v.count)
      }));
    }
    
    return {
      tags: tagResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) })),
      entityTypes: entityTypesFacets,
      authors: authorResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) })),
      dateRanges: [], // TODO: implement date range facets
      documentTypes: docTypeResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) })),
      sentiment: sentimentResult.rows.map(r => ({ value: r.value, count: parseInt(r.count) }))
    };
  }
  
  // Get tag cloud data
  async getTagCloud(limit: number = 50): Promise<{ tag: string; count: number; avgConfidence: number }[]> {
    const result = await this.pool.query(`
      SELECT tag, COUNT(*) as count, AVG(confidence) as avg_confidence
      FROM document_tags
      GROUP BY tag
      ORDER BY count DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => ({
      tag: row.tag,
      count: parseInt(row.count),
      avgConfidence: parseFloat(row.avg_confidence)
    }));
  }
}
