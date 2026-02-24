import { Event as NostrEvent } from 'nostr-tools';

export interface DocumentType {
  kind: number;
  category: 'text' | 'media' | 'metadata' | 'structured' | 'ephemeral';
  priority: number; // 1-10, higher = more important to index
  extractors: string[];
}

export const DOCUMENT_TYPES: DocumentType[] = [
  // High priority content
  { kind: 1, category: 'text', priority: 10, extractors: ['text', 'mentions', 'hashtags', 'links'] },
  { kind: 30023, category: 'text', priority: 9, extractors: ['longform', 'markdown', 'metadata'] },
  { kind: 30024, category: 'text', priority: 8, extractors: ['draft', 'markdown'] },
  
  // Medium priority
  { kind: 30402, category: 'structured', priority: 7, extractors: ['classifieds', 'structured'] },
  { kind: 30040, category: 'structured', priority: 6, extractors: ['listings', 'metadata'] },
  { kind: 30311, category: 'media', priority: 6, extractors: ['video', 'metadata'] },
  
  // Lower priority (still useful)
  { kind: 0, category: 'metadata', priority: 5, extractors: ['profile', 'nip05'] },
  { kind: 3, category: 'metadata', priority: 4, extractors: ['contacts'] },
  { kind: 1063, category: 'media', priority: 5, extractors: ['file-metadata'] },
];

export class DocumentTypeClassifier {
  private typeMap: Map<number, DocumentType>;
  
  constructor() {
    this.typeMap = new Map();
    
    for (const docType of DOCUMENT_TYPES) {
      this.typeMap.set(docType.kind, docType);
    }
  }
  
  classify(event: NostrEvent): DocumentType {
    const docType = this.typeMap.get(event.kind);
    
    if (docType) {
      return docType;
    }
    
    // Handle ephemeral events (20000-29999)
    if (event.kind >= 20000 && event.kind < 30000) {
      return {
        kind: event.kind,
        category: 'ephemeral',
        priority: 1,
        extractors: [],
      };
    }
    
    // Unknown event type - low priority
    return {
      kind: event.kind,
      category: 'text',
      priority: 3,
      extractors: ['text'],
    };
  }
  
  getPriority(kind: number): number {
    const docType = this.typeMap.get(kind);
    return docType?.priority || 3;
  }
}
