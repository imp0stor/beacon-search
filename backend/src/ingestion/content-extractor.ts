import { Event as NostrEvent } from 'nostr-tools';
import { DocumentType } from './document-classifier';

export interface ExtractedContent {
  title?: string;
  body: string;
  summary?: string;
  tags: string[];
  metadata: Record<string, any>;
  urls: string[];
  mentions: string[]; // npub/nprofile references
  quality_score: number; // 0-1
}

export abstract class ContentExtractor {
  abstract extract(event: NostrEvent): ExtractedContent;
  
  protected extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }
  
  protected calculateQuality(event: NostrEvent, content: string): number {
    let score = 0.5; // Base score
    
    // Longer content = higher quality (up to a point)
    const length = content.length;
    if (length > 100) score += 0.1;
    if (length > 500) score += 0.1;
    if (length > 2000) score += 0.1;
    
    // Has mentions = more engagement
    const mentions = event.tags.filter(t => t[0] === 'p');
    if (mentions.length > 0) score += 0.05;
    if (mentions.length > 3) score += 0.05;
    
    // Has hashtags = organized content
    const hashtags = event.tags.filter(t => t[0] === 't');
    if (hashtags.length > 0) score += 0.05;
    
    // Not too many links (spam indicator)
    const urls = this.extractUrls(content);
    const linkRatio = urls.length / Math.max(length, 1);
    if (linkRatio > 0.1) score -= 0.2; // Penalty for excessive links
    
    return Math.max(0, Math.min(1, score));
  }
}

export class TextExtractor extends ContentExtractor {
  extract(event: NostrEvent): ExtractedContent {
    const body = event.content;
    const tags = event.tags.filter(t => t[0] === 't').map(t => t[1]);
    const mentions = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
    const urls = this.extractUrls(body);
    
    return {
      body,
      tags,
      mentions,
      urls,
      metadata: {
        created_at: event.created_at,
      },
      quality_score: this.calculateQuality(event, body),
    };
  }
}

export class LongformExtractor extends ContentExtractor {
  extract(event: NostrEvent): ExtractedContent {
    const titleTag = event.tags.find(t => t[0] === 'title');
    const summaryTag = event.tags.find(t => t[0] === 'summary');
    const imageTag = event.tags.find(t => t[0] === 'image');
    const publishedTag = event.tags.find(t => t[0] === 'published_at');
    const dTag = event.tags.find(t => t[0] === 'd');
    
    const body = event.content;
    const tags = event.tags.filter(t => t[0] === 't').map(t => t[1]);
    const mentions = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
    const urls = this.extractUrls(body);
    
    return {
      title: titleTag?.[1],
      summary: summaryTag?.[1],
      body,
      tags,
      mentions,
      urls,
      metadata: {
        image: imageTag?.[1],
        published_at: publishedTag?.[1] ? parseInt(publishedTag[1]) : event.created_at,
        identifier: dTag?.[1],
        created_at: event.created_at,
      },
      quality_score: this.calculateQuality(event, body) + 0.1, // Bonus for long-form
    };
  }
}

export class StructuredExtractor extends ContentExtractor {
  extract(event: NostrEvent): ExtractedContent {
    const titleTag = event.tags.find(t => t[0] === 'title');
    const summaryTag = event.tags.find(t => t[0] === 'summary' || t[0] === 'description');
    const priceTag = event.tags.find(t => t[0] === 'price');
    const locationTag = event.tags.find(t => t[0] === 'location');
    const dTag = event.tags.find(t => t[0] === 'd');
    
    const body = event.content;
    const tags = event.tags.filter(t => t[0] === 't').map(t => t[1]);
    const mentions = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
    const urls = this.extractUrls(body);
    
    return {
      title: titleTag?.[1],
      summary: summaryTag?.[1],
      body,
      tags,
      mentions,
      urls,
      metadata: {
        price: priceTag?.[1],
        location: locationTag?.[1],
        identifier: dTag?.[1],
        created_at: event.created_at,
      },
      quality_score: this.calculateQuality(event, body),
    };
  }
}

export class ContentExtractorFactory {
  static create(docType: DocumentType): ContentExtractor {
    // Choose extractor based on document type
    if (docType.extractors.includes('longform')) {
      return new LongformExtractor();
    }
    
    if (docType.extractors.includes('structured') || docType.extractors.includes('classifieds')) {
      return new StructuredExtractor();
    }
    
    // Default to text extractor
    return new TextExtractor();
  }
}
