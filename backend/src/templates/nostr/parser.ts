/**
 * Nostr Event Parser & Normalizer
 * Extracts structured data from Nostr events for indexing
 */

import { Event } from 'nostr-tools';
import { NostrKind, getKindMetadata } from './kinds';

export interface ParsedNostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  title: string;
  content: string;
  tags: Record<string, string[]>;
  metadata: Record<string, any>;
  searchText: string;
  url?: string;
}

/**
 * Get tag value (first occurrence)
 */
function getTag(event: Event, tagName: string): string | undefined {
  const tag = event.tags.find(t => t[0] === tagName);
  return tag ? tag[1] : undefined;
}

/**
 * Get all tag values
 */
function getTags(event: Event, tagName: string): string[] {
  return event.tags.filter(t => t[0] === tagName).map(t => t[1]);
}

/**
 * Build addressable reference (NIP-33)
 */
function buildAddressable(event: Event): string | undefined {
  const dTag = getTag(event, 'd');
  if (!dTag) return undefined;
  return `${event.kind}:${event.pubkey}:${dTag}`;
}

/**
 * Parse Question (kind 30400)
 */
function parseQuestion(event: Event): ParsedNostrEvent {
  const title = getTag(event, 'title') || 'Untitled Question';
  const tags = getTags(event, 't');
  const bounty = getTag(event, 'bounty');
  const bountyExpiry = getTag(event, 'bounty_expiry');
  const dTag = getTag(event, 'd') || '';

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title,
    content: event.content,
    tags: {
      topic: tags,
      d: [dTag],
    },
    metadata: {
      bounty: bounty ? parseInt(bounty) : null,
      bountyExpiry: bountyExpiry ? parseInt(bountyExpiry) : null,
      addressable: buildAddressable(event),
      answered: false, // Will be enriched by connector
      voteScore: 0, // Will be enriched by connector
    },
    searchText: `${title} ${event.content} ${tags.join(' ')}`,
    url: `nostr:${buildAddressable(event)}`,
  };
}

/**
 * Parse Answer (kind 6400)
 */
function parseAnswer(event: Event): ParsedNostrEvent {
  const questionId = getTag(event, 'e');
  const questionRef = getTag(event, 'a');
  const questionAuthor = getTag(event, 'p');
  
  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title: `Answer to ${questionRef || questionId || 'Question'}`,
    content: event.content,
    tags: {
      e: questionId ? [questionId] : [],
      a: questionRef ? [questionRef] : [],
      p: questionAuthor ? [questionAuthor] : [],
    },
    metadata: {
      questionId,
      questionRef,
      questionAuthor,
      accepted: false, // Will be enriched
      voteScore: 0, // Will be enriched
    },
    searchText: event.content,
    url: `nostr:${event.id}`,
  };
}

/**
 * Parse KB Article (kind 30023)
 */
function parseKBArticle(event: Event): ParsedNostrEvent {
  const title = getTag(event, 'title') || getTag(event, 'd') || 'Untitled Article';
  const docType = getTag(event, 'doc_type') || 'article';
  const summary = getTag(event, 'summary') || '';
  const tags = getTags(event, 't');
  const publishedAt = getTag(event, 'published_at');
  const version = getTag(event, 'version');

  // Extract custom attributes
  const attributes: Record<string, string> = {};
  event.tags
    .filter(t => t[0] === 'attr' && t.length >= 3)
    .forEach(t => {
      attributes[t[1]] = t[2];
    });

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title,
    content: event.content,
    tags: {
      topic: tags,
      d: [getTag(event, 'd') || ''],
    },
    metadata: {
      docType,
      summary,
      attributes,
      publishedAt: publishedAt ? parseInt(publishedAt) : null,
      version,
      addressable: buildAddressable(event),
    },
    searchText: `${title} ${summary} ${event.content} ${tags.join(' ')}`,
    url: `nostr:${buildAddressable(event)}`,
  };
}

/**
 * Parse Studio (kind 31990)
 */
function parseStudio(event: Event): ParsedNostrEvent {
  const name = getTag(event, 'name') || 'Unnamed Studio';
  const description = getTag(event, 'about') || '';
  const image = getTag(event, 'image');
  const website = getTag(event, 'website');
  const tags = getTags(event, 't');

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title: name,
    content: description,
    tags: {
      topic: tags,
      d: [getTag(event, 'd') || ''],
    },
    metadata: {
      name,
      description,
      image,
      website,
      addressable: buildAddressable(event),
    },
    searchText: `${name} ${description} ${tags.join(' ')}`,
    url: website || `nostr:${buildAddressable(event)}`,
  };
}

/**
 * Parse Show (kind 30383)
 */
function parseShow(event: Event): ParsedNostrEvent {
  const title = getTag(event, 'title') || 'Untitled Show';
  const summary = getTag(event, 'summary') || '';
  const image = getTag(event, 'image');
  const tags = getTags(event, 't');
  const value = getTags(event, 'value');

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title,
    content: summary,
    tags: {
      topic: tags,
      d: [getTag(event, 'd') || ''],
    },
    metadata: {
      image,
      value4value: value.length > 0,
      addressable: buildAddressable(event),
    },
    searchText: `${title} ${summary} ${tags.join(' ')}`,
    url: `nostr:${buildAddressable(event)}`,
  };
}

/**
 * Parse Episode (kind 30384)
 */
function parseEpisode(event: Event): ParsedNostrEvent {
  const title = getTag(event, 'title') || 'Untitled Episode';
  const summary = getTag(event, 'summary') || '';
  const image = getTag(event, 'image');
  const publishedAt = getTag(event, 'published_at');
  const duration = getTag(event, 'duration');
  const showRef = getTag(event, 'a');
  const tags = getTags(event, 't');

  // Extract chapters
  const chapters = event.tags
    .filter(t => t[0] === 'chapter' && t.length >= 3)
    .map(t => ({
      timestamp: parseInt(t[1]),
      title: t[2],
    }));

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title,
    content: summary,
    tags: {
      topic: tags,
      d: [getTag(event, 'd') || ''],
      a: showRef ? [showRef] : [],
    },
    metadata: {
      image,
      publishedAt: publishedAt ? parseInt(publishedAt) : null,
      duration: duration ? parseInt(duration) : null,
      chapters,
      showRef,
      addressable: buildAddressable(event),
    },
    searchText: `${title} ${summary} ${tags.join(' ')} ${chapters.map(c => c.title).join(' ')}`,
    url: `nostr:${buildAddressable(event)}`,
  };
}

/**
 * Parse Bounty (kind 37100)
 */
function parseBounty(event: Event): ParsedNostrEvent {
  const title = getTag(event, 'title') || 'Untitled Bounty';
  const amount = getTag(event, 'amount');
  const expiry = getTag(event, 'expiry');
  const tags = getTags(event, 't');
  const status = getTag(event, 'status') || 'open';

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title,
    content: event.content,
    tags: {
      topic: tags,
      d: [getTag(event, 'd') || ''],
    },
    metadata: {
      amount: amount ? parseInt(amount) : null,
      expiry: expiry ? parseInt(expiry) : null,
      status,
      addressable: buildAddressable(event),
    },
    searchText: `${title} ${event.content} ${tags.join(' ')}`,
    url: `nostr:${buildAddressable(event)}`,
  };
}

/**
 * Main parser - routes to specific parser based on kind
 */
export function parseNostrEvent(event: Event): ParsedNostrEvent | null {
  const kindMeta = getKindMetadata(event.kind);
  
  if (!kindMeta || !kindMeta.searchable) {
    return null; // Not a searchable event type
  }

  try {
    switch (event.kind) {
      case NostrKind.QUESTION:
        return parseQuestion(event);
      case NostrKind.ANSWER:
        return parseAnswer(event);
      case NostrKind.KB_ARTICLE:
        return parseKBArticle(event);
      case NostrKind.STUDIO_METADATA:
        return parseStudio(event);
      case NostrKind.SHOW:
        return parseShow(event);
      case NostrKind.EPISODE:
        return parseEpisode(event);
      case NostrKind.BOUNTY:
        return parseBounty(event);
      case NostrKind.COMMENT:
      case NostrKind.TOPIC_DEFINITION:
        // Generic fallback
        return {
          id: event.id,
          kind: event.kind,
          pubkey: event.pubkey,
          created_at: event.created_at,
          title: getTag(event, 'title') || getTag(event, 'd') || `Event ${event.id.slice(0, 8)}`,
          content: event.content,
          tags: {
            d: [getTag(event, 'd') || ''],
          },
          metadata: {},
          searchText: event.content,
          url: `nostr:${event.id}`,
        };
      default:
        return null;
    }
  } catch (error) {
    console.error(`Failed to parse event ${event.id}:`, error);
    return null;
  }
}

/**
 * Normalize Nostr event for Beacon Search document format
 */
export function normalizeNostrEvent(parsed: ParsedNostrEvent): {
  externalId: string;
  title: string;
  content: string;
  url?: string;
  attributes: Record<string, any>;
  documentType: string;
} {
  const kindMeta = getKindMetadata(parsed.kind);

  return {
    externalId: parsed.metadata.addressable || parsed.id,
    title: parsed.title,
    content: parsed.searchText,
    url: parsed.url,
    attributes: {
      nostr: true,
      kind: parsed.kind,
      kindName: kindMeta?.name,
      kindCategory: kindMeta?.category,
      pubkey: parsed.pubkey,
      created_at: parsed.created_at,
      tags: parsed.tags,
      metadata: parsed.metadata,
    },
    documentType: `nostr-${kindMeta?.category || 'event'}`,
  };
}
