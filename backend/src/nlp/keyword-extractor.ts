/**
 * Keyword Extraction using TF-IDF and RAKE algorithms
 * All processing is local - no external API calls
 */

import { ExtractedTag } from './types';

// Common English stopwords
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'done', 'for', 'from', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'just', 'me', 'might', 'more', 'most', 'my', 'no', 'nor', 'not', 'of',
  'on', 'or', 'our', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with',
  'would', 'you', 'your', 'yours', 'also', 'but', 'however', 'only', 'still', 'yet',
  'about', 'after', 'before', 'between', 'both', 'each', 'few', 'many', 'other',
  'since', 'until', 'upon', 'without', 'within', 'during', 'because', 'although'
]);

// Tokenize text into words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

// Calculate term frequency in a document
function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  // Normalize by document length
  for (const [term, count] of freq) {
    freq.set(term, count / tokens.length);
  }
  return freq;
}

// TF-IDF with corpus statistics
export class TFIDFExtractor {
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;
  
  // Train on a corpus of documents
  train(documents: string[]): void {
    this.totalDocuments = documents.length;
    this.documentFrequency.clear();
    
    for (const doc of documents) {
      const tokens = new Set(tokenize(doc));
      for (const token of tokens) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      }
    }
  }
  
  // Extract keywords using TF-IDF
  extract(text: string, maxKeywords: number = 10): ExtractedTag[] {
    const tokens = tokenize(text);
    const tf = termFrequency(tokens);
    const scores: { term: string; score: number }[] = [];
    
    for (const [term, tfScore] of tf) {
      // IDF: log(N / df), with smoothing
      const df = this.documentFrequency.get(term) || 1;
      const idf = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
      const tfidf = tfScore * idf;
      
      scores.push({ term, score: tfidf });
    }
    
    // Sort by score and return top keywords
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxKeywords)
      .map(({ term, score }) => ({
        tag: term,
        confidence: Math.min(score / 0.5, 1.0), // Normalize to 0-1
        algorithm: 'tfidf'
      }));
  }
  
  // Extract without pre-training (uses local IDF approximation)
  extractStandalone(text: string, maxKeywords: number = 10): ExtractedTag[] {
    const tokens = tokenize(text);
    const tf = termFrequency(tokens);
    const scores: { term: string; score: number }[] = [];
    
    // Use local frequency as a proxy - rare words in doc get higher weight
    const localFreq = new Map<string, number>();
    for (const token of tokens) {
      localFreq.set(token, (localFreq.get(token) || 0) + 1);
    }
    
    for (const [term, tfScore] of tf) {
      const count = localFreq.get(term) || 1;
      // Boost mid-frequency terms (not too common, not too rare)
      const midFreqBoost = Math.min(count, 5) / 5;
      const lengthBoost = Math.min(term.length / 8, 1.5); // Longer words often more meaningful
      const score = tfScore * midFreqBoost * lengthBoost;
      
      scores.push({ term, score });
    }
    
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxKeywords)
      .map(({ term, score }, index) => ({
        tag: term,
        confidence: Math.max(0.3, 1.0 - (index * 0.07)), // Decay confidence by rank
        algorithm: 'tfidf-standalone'
      }));
  }
}

// RAKE (Rapid Automatic Keyword Extraction) implementation
export class RAKEExtractor {
  private phraseDelimiters = /[.!?,;:\t\n\r()\[\]{}'"]/;
  
  extract(text: string, maxPhrases: number = 10): ExtractedTag[] {
    // Split into phrases
    const phrases = text
      .toLowerCase()
      .split(this.phraseDelimiters)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Extract candidate keywords from phrases
    const candidates = new Map<string, { freq: number; degree: number }>();
    
    for (const phrase of phrases) {
      const words = phrase.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
      
      if (words.length === 0) continue;
      
      // For single words
      if (words.length === 1) {
        const word = words[0];
        const existing = candidates.get(word) || { freq: 0, degree: 0 };
        candidates.set(word, {
          freq: existing.freq + 1,
          degree: existing.degree + 1
        });
      } else {
        // For phrases, calculate co-occurrence degree
        for (const word of words) {
          const existing = candidates.get(word) || { freq: 0, degree: 0 };
          candidates.set(word, {
            freq: existing.freq + 1,
            degree: existing.degree + words.length
          });
        }
        
        // Also consider the full phrase if it's meaningful
        if (words.length <= 3) {
          const phraseKey = words.join(' ');
          const existing = candidates.get(phraseKey) || { freq: 0, degree: 0 };
          candidates.set(phraseKey, {
            freq: existing.freq + 1,
            degree: existing.degree + words.length * 2
          });
        }
      }
    }
    
    // Calculate RAKE score: degree / frequency
    const scores: { keyword: string; score: number }[] = [];
    
    for (const [keyword, stats] of candidates) {
      if (stats.freq > 0) {
        const score = stats.degree / stats.freq;
        scores.push({ keyword, score });
      }
    }
    
    // Sort and return top phrases
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPhrases)
      .map(({ keyword, score }, index) => ({
        tag: keyword,
        confidence: Math.max(0.25, 1.0 - (index * 0.08)),
        algorithm: 'rake'
      }));
  }
}

// Combined keyword extraction using both methods
export function extractKeywords(text: string, maxKeywords: number = 15): ExtractedTag[] {
  const tfidf = new TFIDFExtractor();
  const rake = new RAKEExtractor();
  
  const tfidfTags = tfidf.extractStandalone(text, maxKeywords);
  const rakeTags = rake.extract(text, maxKeywords);
  
  // Merge and deduplicate, preferring higher confidence
  const merged = new Map<string, ExtractedTag>();
  
  for (const tag of [...tfidfTags, ...rakeTags]) {
    const normalizedTag = tag.tag.toLowerCase().trim();
    const existing = merged.get(normalizedTag);
    
    if (!existing || existing.confidence < tag.confidence) {
      merged.set(normalizedTag, {
        ...tag,
        tag: normalizedTag,
        // Boost confidence if found by multiple algorithms
        confidence: existing 
          ? Math.min(1.0, tag.confidence * 1.2)
          : tag.confidence
      });
    }
  }
  
  return Array.from(merged.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxKeywords);
}

// Topic classification based on keyword clustering
export function classifyTopic(tags: ExtractedTag[]): string {
  const topicKeywords: Record<string, string[]> = {
    'Technology': ['software', 'programming', 'code', 'api', 'database', 'computer', 'system', 'digital', 'algorithm', 'data', 'machine', 'learning', 'ai', 'web', 'application', 'server', 'cloud', 'network'],
    'Business': ['business', 'company', 'market', 'revenue', 'customer', 'sales', 'management', 'strategy', 'growth', 'investment', 'profit', 'startup', 'enterprise', 'commerce'],
    'Science': ['research', 'study', 'experiment', 'theory', 'hypothesis', 'scientific', 'discovery', 'analysis', 'laboratory', 'physics', 'chemistry', 'biology', 'mathematics'],
    'Health': ['health', 'medical', 'doctor', 'patient', 'treatment', 'disease', 'medicine', 'hospital', 'clinical', 'therapy', 'symptoms', 'diagnosis', 'wellness'],
    'Finance': ['finance', 'money', 'bank', 'investment', 'stock', 'trading', 'financial', 'loan', 'credit', 'budget', 'accounting', 'tax', 'payment', 'currency'],
    'Education': ['education', 'learning', 'school', 'university', 'student', 'teacher', 'course', 'training', 'academic', 'curriculum', 'knowledge', 'study'],
    'Legal': ['law', 'legal', 'court', 'attorney', 'judge', 'contract', 'regulation', 'compliance', 'rights', 'litigation', 'policy', 'legislation'],
    'Entertainment': ['entertainment', 'movie', 'music', 'game', 'show', 'media', 'film', 'video', 'streaming', 'concert', 'performance', 'artist'],
  };
  
  const tagSet = new Set(tags.map(t => t.tag.toLowerCase()));
  const topicScores: Record<string, number> = {};
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    topicScores[topic] = keywords.filter(k => tagSet.has(k)).length;
  }
  
  const sorted = Object.entries(topicScores)
    .sort(([, a], [, b]) => b - a);
  
  return sorted[0][1] > 0 ? sorted[0][0] : 'General';
}
