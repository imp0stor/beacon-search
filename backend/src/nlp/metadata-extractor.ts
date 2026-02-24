/**
 * Metadata Extraction Module
 * Extracts: reading time, sentiment, author, dates, document type classification
 */

import { ExtractedMetadata, ExtractedEntity } from './types';

// Average reading speed (words per minute)
const AVERAGE_WPM = 200;

// Sentiment word lists
const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
  'love', 'loved', 'happy', 'pleased', 'delighted', 'satisfied', 'positive',
  'best', 'better', 'perfect', 'brilliant', 'outstanding', 'exceptional',
  'success', 'successful', 'win', 'won', 'achievement', 'improved', 'improvement',
  'beautiful', 'elegant', 'impressive', 'remarkable', 'exciting', 'thrilled',
  'grateful', 'thankful', 'appreciate', 'enjoyed', 'enjoy', 'recommend',
  'efficient', 'effective', 'innovative', 'creative', 'helpful', 'useful',
  'friendly', 'professional', 'reliable', 'trustworthy', 'confident'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'worse',
  'hate', 'hated', 'sad', 'unhappy', 'disappointed', 'dissatisfied', 'negative',
  'fail', 'failed', 'failure', 'loss', 'lost', 'problem', 'problems', 'issue',
  'ugly', 'broken', 'damaged', 'error', 'errors', 'mistake', 'mistakes',
  'frustrated', 'angry', 'annoyed', 'upset', 'worried', 'concerned', 'afraid',
  'difficult', 'hard', 'complicated', 'confusing', 'unclear', 'useless',
  'slow', 'expensive', 'overpriced', 'unreliable', 'unfriendly', 'rude',
  'spam', 'scam', 'fake', 'fraud', 'disappointing', 'mediocre', 'lacking'
]);

// Document type patterns
const DOC_TYPE_PATTERNS: Record<string, RegExp[]> = {
  'article': [
    /\b(?:article|story|news|report|coverage)\b/i,
    /^(?:by|written by)\s+/im,
    /\b(?:published|posted)\s+(?:on|at)\b/i
  ],
  'documentation': [
    /\b(?:api|documentation|docs|guide|tutorial|reference|manual)\b/i,
    /\b(?:function|method|class|parameter|returns?|example)\b/i,
    /```[\s\S]*?```/,  // Code blocks
    /\b(?:install|setup|configure|usage)\b/i
  ],
  'email': [
    /^(?:from|to|subject|date|sent):/im,
    /\b(?:dear|regards|sincerely|best wishes)\b/i,
    /\b(?:reply|forward|cc|bcc)\b/i
  ],
  'legal': [
    /\b(?:agreement|contract|terms|conditions|liability|warranty)\b/i,
    /\b(?:hereby|whereas|notwithstanding|pursuant)\b/i,
    /\b(?:section|clause|article)\s+\d+/i
  ],
  'financial': [
    /\b(?:revenue|profit|loss|income|expense|budget|forecast)\b/i,
    /\b(?:quarterly|annual|fiscal|financial)\b/i,
    /\$[\d,]+(?:\.\d{2})?/
  ],
  'academic': [
    /\b(?:abstract|introduction|methodology|conclusion|references|bibliography)\b/i,
    /\b(?:study|research|hypothesis|experiment|analysis|findings)\b/i,
    /\[\d+\]|\(\d{4}\)/  // Citation patterns
  ],
  'marketing': [
    /\b(?:sale|discount|offer|deal|promotion|limited time)\b/i,
    /\b(?:buy now|order now|shop now|subscribe|sign up)\b/i,
    /\b(?:free|exclusive|premium|special)\b/i
  ],
  'support': [
    /\b(?:help|support|issue|problem|solution|troubleshoot)\b/i,
    /\b(?:ticket|case|request|inquiry|question|answer)\b/i,
    /\b(?:steps?|instructions?|how to|guide)\b/i
  ]
};

// Author patterns
const AUTHOR_PATTERNS = [
  /(?:by|written by|author[:]?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
  /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*(?:\||—|-)\s*(?:\w+\s+\d+,?\s+\d{4}|\d{4})/,
  /@([a-zA-Z][a-zA-Z0-9_]{2,})/  // Twitter/social handles
];

// Calculate reading time in minutes
export function calculateReadingTime(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.ceil(words / AVERAGE_WPM);
}

// Calculate word count
export function calculateWordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// Calculate character count
export function calculateCharCount(text: string): number {
  return text.length;
}

// Analyze sentiment
export function analyzeSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number; confidence: number } {
  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of words) {
    // Clean word of punctuation
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (POSITIVE_WORDS.has(cleanWord)) positiveCount++;
    if (NEGATIVE_WORDS.has(cleanWord)) negativeCount++;
  }
  
  const totalSentimentWords = positiveCount + negativeCount;
  const totalWords = words.length;
  
  if (totalSentimentWords === 0) {
    return { sentiment: 'neutral', score: 0, confidence: 0.3 };
  }
  
  const score = (positiveCount - negativeCount) / Math.max(totalSentimentWords, 1);
  const coverage = totalSentimentWords / totalWords;
  const confidence = Math.min(0.3 + coverage * 2, 0.95);
  
  let sentiment: 'positive' | 'negative' | 'neutral';
  if (score > 0.1) {
    sentiment = 'positive';
  } else if (score < -0.1) {
    sentiment = 'negative';
  } else {
    sentiment = 'neutral';
  }
  
  return { sentiment, score, confidence };
}

// Classify document type
export function classifyDocumentType(text: string, title?: string): { type: string; confidence: number } {
  const fullText = `${title || ''} ${text}`.toLowerCase();
  const scores: Record<string, number> = {};
  
  for (const [docType, patterns] of Object.entries(DOC_TYPE_PATTERNS)) {
    scores[docType] = 0;
    for (const pattern of patterns) {
      const matches = fullText.match(pattern);
      if (matches) {
        scores[docType] += matches.length;
      }
    }
  }
  
  const sorted = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);
  
  if (sorted.length === 0) {
    return { type: 'general', confidence: 0.5 };
  }
  
  const topType = sorted[0][0];
  const topScore = sorted[0][1];
  const totalScore = sorted.reduce((sum, [_, s]) => sum + s, 0);
  const confidence = Math.min(0.4 + (topScore / totalScore) * 0.5, 0.95);
  
  return { type: topType, confidence };
}

// Extract author from text
export function extractAuthor(text: string): { author: string; confidence: number } | null {
  for (const pattern of AUTHOR_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return {
        author: match[1].trim(),
        confidence: 0.75
      };
    }
  }
  return null;
}

// Extract dates mentioned in text
export function extractMentionedDates(entities: ExtractedEntity[]): string[] {
  return entities
    .filter(e => e.type === 'DATE')
    .map(e => e.normalizedValue || e.value)
    .filter((v, i, arr) => arr.indexOf(v) === i); // Unique
}

// Main metadata extraction function
export function extractMetadata(
  text: string, 
  title?: string, 
  entities?: ExtractedEntity[]
): ExtractedMetadata[] {
  const metadata: ExtractedMetadata[] = [];
  
  // Reading time
  const readingTime = calculateReadingTime(text);
  metadata.push({
    key: 'reading_time_minutes',
    value: String(readingTime),
    type: 'number',
    confidence: 0.99,
    extractedBy: 'word-count'
  });
  
  // Word count
  metadata.push({
    key: 'word_count',
    value: String(calculateWordCount(text)),
    type: 'number',
    confidence: 0.99,
    extractedBy: 'word-count'
  });
  
  // Character count
  metadata.push({
    key: 'char_count',
    value: String(calculateCharCount(text)),
    type: 'number',
    confidence: 0.99,
    extractedBy: 'char-count'
  });
  
  // Sentiment analysis
  const sentiment = analyzeSentiment(text);
  metadata.push({
    key: 'sentiment',
    value: sentiment.sentiment,
    type: 'string',
    confidence: sentiment.confidence,
    extractedBy: 'lexicon-sentiment'
  });
  metadata.push({
    key: 'sentiment_score',
    value: sentiment.score.toFixed(3),
    type: 'number',
    confidence: sentiment.confidence,
    extractedBy: 'lexicon-sentiment'
  });
  
  // Document type classification
  const docType = classifyDocumentType(text, title);
  metadata.push({
    key: 'document_classification',
    value: docType.type,
    type: 'string',
    confidence: docType.confidence,
    extractedBy: 'pattern-classifier'
  });
  
  // Author extraction
  const author = extractAuthor(text);
  if (author) {
    metadata.push({
      key: 'detected_author',
      value: author.author,
      type: 'string',
      confidence: author.confidence,
      extractedBy: 'pattern-extraction'
    });
  }
  
  // Extract mentioned dates from entities
  if (entities) {
    const mentionedDates = extractMentionedDates(entities);
    if (mentionedDates.length > 0) {
      metadata.push({
        key: 'mentioned_dates',
        value: JSON.stringify(mentionedDates),
        type: 'json',
        confidence: 0.85,
        extractedBy: 'entity-extraction'
      });
    }
    
    // Count entities by type
    const entityCounts: Record<string, number> = {};
    for (const entity of entities) {
      entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
    }
    metadata.push({
      key: 'entity_counts',
      value: JSON.stringify(entityCounts),
      type: 'json',
      confidence: 0.9,
      extractedBy: 'entity-extraction'
    });
  }
  
  // Check for code content
  const codeBlockCount = (text.match(/```[\s\S]*?```/g) || []).length;
  const inlineCodeCount = (text.match(/`[^`]+`/g) || []).length;
  if (codeBlockCount > 0 || inlineCodeCount > 5) {
    metadata.push({
      key: 'has_code',
      value: 'true',
      type: 'boolean',
      confidence: 0.95,
      extractedBy: 'pattern-detection'
    });
    metadata.push({
      key: 'code_block_count',
      value: String(codeBlockCount),
      type: 'number',
      confidence: 0.99,
      extractedBy: 'pattern-detection'
    });
  }
  
  // Check for lists
  const bulletListCount = (text.match(/^[\s]*[-*•]\s+/gm) || []).length;
  const numberedListCount = (text.match(/^[\s]*\d+[\.)]\s+/gm) || []).length;
  if (bulletListCount > 2 || numberedListCount > 2) {
    metadata.push({
      key: 'has_lists',
      value: 'true',
      type: 'boolean',
      confidence: 0.95,
      extractedBy: 'pattern-detection'
    });
    metadata.push({
      key: 'list_item_count',
      value: String(bulletListCount + numberedListCount),
      type: 'number',
      confidence: 0.99,
      extractedBy: 'pattern-detection'
    });
  }
  
  // Check for tables (markdown)
  const hasTable = /\|[\s\S]+?\|[\s\S]+?\|/m.test(text);
  if (hasTable) {
    metadata.push({
      key: 'has_table',
      value: 'true',
      type: 'boolean',
      confidence: 0.85,
      extractedBy: 'pattern-detection'
    });
  }
  
  // Check for images (markdown)
  const imageCount = (text.match(/!\[.*?\]\(.*?\)/g) || []).length;
  if (imageCount > 0) {
    metadata.push({
      key: 'image_count',
      value: String(imageCount),
      type: 'number',
      confidence: 0.99,
      extractedBy: 'pattern-detection'
    });
  }
  
  // Language detection (basic - checks for common non-English patterns)
  const isEnglish = /\b(?:the|is|are|was|were|have|has|had|been|being|will|would|could|should)\b/i.test(text);
  metadata.push({
    key: 'language',
    value: isEnglish ? 'en' : 'unknown',
    type: 'string',
    confidence: isEnglish ? 0.8 : 0.4,
    extractedBy: 'pattern-detection'
  });
  
  return metadata;
}
