/**
 * Content Type Mapper
 * Maps Nostr event kinds to content_type enum values
 */

export function kindToContentType(kind: number): string | null {
  const map: Record<number, string> = {
    1: 'note',
    30023: 'article',
    30040: 'book',
    30041: 'chapter',
    31900: 'podcast_feed',
    31901: 'podcast_episode',
    30818: 'kb_article',
    30050: 'bounty',
    34235: 'qa_thread',
    30402: 'product',
    30017: 'stall',
    // web/github don't have Nostr kinds — set by connector
  };
  return map[kind] || null;
}
