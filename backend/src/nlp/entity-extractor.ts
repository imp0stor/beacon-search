/**
 * Named Entity Recognition using local pattern matching
 * Extracts: People, Organizations, Locations, Dates, Money, Products, etc.
 * Uses rule-based patterns for offline operation
 */

import { ExtractedEntity, EntityType } from './types';

// Common name patterns
const NAME_TITLES = ['mr', 'mrs', 'ms', 'dr', 'prof', 'professor', 'sir', 'madam', 'rev', 'hon'];
const PERSON_SUFFIXES = ['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq'];

// Organization indicators
const ORG_SUFFIXES = ['inc', 'corp', 'corporation', 'llc', 'ltd', 'limited', 'co', 'company', 'group', 'holdings', 'partners', 'associates', 'foundation', 'institute', 'university', 'college', 'bank', 'trust'];
const ORG_PREFIXES = ['the', 'national', 'international', 'american', 'united', 'federal', 'state'];

// Location indicators
const LOCATION_INDICATORS = ['city', 'town', 'village', 'county', 'state', 'country', 'island', 'mountain', 'river', 'lake', 'ocean', 'sea', 'bay', 'gulf', 'strait', 'street', 'avenue', 'road', 'boulevard', 'highway', 'drive', 'lane', 'way'];
const COUNTRIES = ['usa', 'united states', 'uk', 'united kingdom', 'canada', 'australia', 'germany', 'france', 'japan', 'china', 'india', 'brazil', 'mexico', 'spain', 'italy', 'russia', 'south korea', 'netherlands', 'switzerland', 'sweden'];
const US_STATES = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'];

// Regex patterns
const PATTERNS = {
  // Money: $1,234.56 or 1,234.56 USD or £500
  MONEY: /(?:[$£€¥]|USD|EUR|GBP|JPY)\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:dollars?|USD|EUR|GBP|pounds?|euros?)/gi,
  
  // Dates: various formats
  DATE_ISO: /\b\d{4}-\d{2}-\d{2}\b/g,
  DATE_US: /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:\d{2}|\d{4})\b/g,
  DATE_WRITTEN: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}\b/gi,
  DATE_WRITTEN_SHORT: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}\b/gi,
  DATE_RELATIVE: /\b(?:yesterday|today|tomorrow|last\s+(?:week|month|year)|next\s+(?:week|month|year)|this\s+(?:week|month|year))\b/gi,
  
  // Time
  TIME: /\b(?:0?[1-9]|1[0-2]):[0-5]\d\s*(?:am|pm|AM|PM)|\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g,
  
  // Email
  EMAIL: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  
  // URL
  URL: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
  
  // Phone numbers
  PHONE: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  
  // Percentages
  PERCENTAGE: /\b\d+(?:\.\d+)?%/g,
};

interface Match {
  value: string;
  start: number;
  end: number;
}

function findMatches(text: string, pattern: RegExp): Match[] {
  const matches: Match[] = [];
  let match: RegExpExecArray | null;
  
  // Reset lastIndex for global patterns
  pattern.lastIndex = 0;
  
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return matches;
}

function isCapitalized(word: string): boolean {
  return /^[A-Z]/.test(word);
}

function extractContext(text: string, start: number, end: number, contextLength: number = 50): string {
  const contextStart = Math.max(0, start - contextLength);
  const contextEnd = Math.min(text.length, end + contextLength);
  let context = text.slice(contextStart, contextEnd);
  
  if (contextStart > 0) context = '...' + context;
  if (contextEnd < text.length) context = context + '...';
  
  return context.replace(/\s+/g, ' ').trim();
}

function normalizeEntity(value: string, type: EntityType): string {
  let normalized = value.trim();
  
  switch (type) {
    case 'PERSON':
      // Capitalize each word
      return normalized.split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    
    case 'ORGANIZATION':
      // Capitalize first letter of each word, preserve known acronyms
      return normalized.split(/\s+/)
        .map(w => {
          if (w.toUpperCase() === w && w.length <= 5) return w; // Keep acronyms
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
    
    case 'LOCATION':
      // Capitalize properly
      return normalized.split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    
    case 'DATE':
      // Try to normalize to ISO format
      const dateMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) return normalized;
      return normalized;
    
    case 'MONEY':
      // Standardize currency format
      return normalized.replace(/\s+/g, '');
    
    default:
      return normalized;
  }
}

// Extract proper nouns (potential names and organizations)
function extractProperNouns(text: string): { persons: Match[]; organizations: Match[]; locations: Match[] } {
  const persons: Match[] = [];
  const organizations: Match[] = [];
  const locations: Match[] = [];
  
  // Split into sentences for context
  const sentences = text.split(/[.!?]+/);
  let offset = 0;
  
  for (const sentence of sentences) {
    // Find capitalized word sequences
    const words = sentence.split(/\s+/);
    let i = 0;
    
    while (i < words.length) {
      const word = words[i];
      if (!isCapitalized(word) || word.length < 2) {
        i++;
        continue;
      }
      
      // Collect consecutive capitalized words
      const sequence: string[] = [word];
      let j = i + 1;
      
      while (j < words.length && isCapitalized(words[j]) && words[j].length >= 2) {
        sequence.push(words[j]);
        j++;
      }
      
      const value = sequence.join(' ');
      const start = offset + sentence.indexOf(value);
      const match: Match = { value, start, end: start + value.length };
      
      // Classify based on context and patterns
      const lowerValue = value.toLowerCase();
      const lowerWords = sequence.map(s => s.toLowerCase());
      
      // Check for organization patterns
      const isOrg = lowerWords.some(w => ORG_SUFFIXES.includes(w)) ||
                    lowerWords.some(w => ORG_PREFIXES.includes(w)) ||
                    /^[A-Z]{2,}$/.test(sequence[0]); // Acronym
      
      // Check for location patterns
      const isLocation = lowerWords.some(w => LOCATION_INDICATORS.includes(w)) ||
                         COUNTRIES.includes(lowerValue) ||
                         US_STATES.includes(lowerValue);
      
      // Check for person patterns
      const isPerson = lowerWords.some(w => NAME_TITLES.includes(w)) ||
                       lowerWords.some(w => PERSON_SUFFIXES.includes(w)) ||
                       (sequence.length === 2 && !isOrg && !isLocation);
      
      if (isOrg) {
        organizations.push(match);
      } else if (isLocation) {
        locations.push(match);
      } else if (isPerson || sequence.length >= 2) {
        // Default multi-word capitalized sequences to persons
        persons.push(match);
      }
      
      i = j;
    }
    
    offset += sentence.length + 1; // +1 for delimiter
  }
  
  return { persons, organizations, locations };
}

// Main entity extraction function
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  
  // Extract pattern-based entities
  const moneyMatches = findMatches(text, PATTERNS.MONEY);
  for (const match of moneyMatches) {
    entities.push({
      type: 'MONEY',
      value: match.value,
      normalizedValue: normalizeEntity(match.value, 'MONEY'),
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.95,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  // Dates
  for (const pattern of [PATTERNS.DATE_ISO, PATTERNS.DATE_US, PATTERNS.DATE_WRITTEN, PATTERNS.DATE_WRITTEN_SHORT, PATTERNS.DATE_RELATIVE]) {
    const dateMatches = findMatches(text, pattern);
    for (const match of dateMatches) {
      entities.push({
        type: 'DATE',
        value: match.value,
        normalizedValue: normalizeEntity(match.value, 'DATE'),
        positionStart: match.start,
        positionEnd: match.end,
        confidence: 0.9,
        context: extractContext(text, match.start, match.end)
      });
    }
  }
  
  // Emails
  const emailMatches = findMatches(text, PATTERNS.EMAIL);
  for (const match of emailMatches) {
    entities.push({
      type: 'EMAIL',
      value: match.value,
      normalizedValue: match.value.toLowerCase(),
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.99,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  // URLs
  const urlMatches = findMatches(text, PATTERNS.URL);
  for (const match of urlMatches) {
    entities.push({
      type: 'URL',
      value: match.value,
      normalizedValue: match.value,
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.99,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  // Phone numbers
  const phoneMatches = findMatches(text, PATTERNS.PHONE);
  for (const match of phoneMatches) {
    entities.push({
      type: 'PHONE',
      value: match.value,
      normalizedValue: match.value.replace(/[^0-9+]/g, ''),
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.85,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  // Extract proper nouns (persons, organizations, locations)
  const { persons, organizations, locations } = extractProperNouns(text);
  
  for (const match of persons) {
    // Skip if it overlaps with already extracted entities
    const overlaps = entities.some(e => 
      (match.start >= (e.positionStart ?? 0) && match.start < (e.positionEnd ?? 0)) ||
      (match.end > (e.positionStart ?? 0) && match.end <= (e.positionEnd ?? 0))
    );
    if (overlaps) continue;
    
    entities.push({
      type: 'PERSON',
      value: match.value,
      normalizedValue: normalizeEntity(match.value, 'PERSON'),
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.7,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  for (const match of organizations) {
    const overlaps = entities.some(e => 
      (match.start >= (e.positionStart ?? 0) && match.start < (e.positionEnd ?? 0)) ||
      (match.end > (e.positionStart ?? 0) && match.end <= (e.positionEnd ?? 0))
    );
    if (overlaps) continue;
    
    entities.push({
      type: 'ORGANIZATION',
      value: match.value,
      normalizedValue: normalizeEntity(match.value, 'ORGANIZATION'),
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.75,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  for (const match of locations) {
    const overlaps = entities.some(e => 
      (match.start >= (e.positionStart ?? 0) && match.start < (e.positionEnd ?? 0)) ||
      (match.end > (e.positionStart ?? 0) && match.end <= (e.positionEnd ?? 0))
    );
    if (overlaps) continue;
    
    entities.push({
      type: 'LOCATION',
      value: match.value,
      normalizedValue: normalizeEntity(match.value, 'LOCATION'),
      positionStart: match.start,
      positionEnd: match.end,
      confidence: 0.75,
      context: extractContext(text, match.start, match.end)
    });
  }
  
  // Sort by position
  return entities.sort((a, b) => (a.positionStart ?? 0) - (b.positionStart ?? 0));
}

// Get unique entities grouped by type
export function groupEntitiesByType(entities: ExtractedEntity[]): Record<EntityType, ExtractedEntity[]> {
  const grouped: Record<string, ExtractedEntity[]> = {};
  
  for (const entity of entities) {
    if (!grouped[entity.type]) {
      grouped[entity.type] = [];
    }
    
    // Deduplicate by normalized value
    const exists = grouped[entity.type].some(
      e => e.normalizedValue === entity.normalizedValue
    );
    
    if (!exists) {
      grouped[entity.type].push(entity);
    }
  }
  
  return grouped as Record<EntityType, ExtractedEntity[]>;
}
