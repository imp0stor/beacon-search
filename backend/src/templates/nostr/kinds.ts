/**
 * Nostr Event Kind Registry
 * Maps Nostr event kinds to their semantic meaning and templates
 */

export enum NostrKind {
  // Q&A Platform (nostr-qa)
  QUESTION = 30400,
  ANSWER = 6400,
  ANSWER_ACCEPTANCE = 6401,
  BOUNTY_AWARD = 6402,
  VOTE = 7400,
  TOPIC_DEFINITION = 34400,
  COMMENT = 1111,

  // Knowledge Base (nostr-kb)
  KB_ARTICLE = 30023,

  // Studios (nostr-studio)
  STUDIO_METADATA = 31990,
  STUDIO_CONTRIBUTORS = 30382,

  // Podcasting (nostr-podcast)
  SHOW = 30383,
  EPISODE = 30384,

  // Bounties (nostr-bounty)
  BOUNTY = 37100,
  BOUNTY_CLAIM = 37101,
  BOUNTY_RELEASE = 37102,
}

export interface NostrKindMetadata {
  kind: number;
  name: string;
  category: 'qa' | 'kb' | 'studio' | 'podcast' | 'bounty';
  description: string;
  replaceable: boolean;
  parameterized?: boolean;
  template: string;
  searchable: boolean;
  icon: string;
}

export const NOSTR_KIND_REGISTRY: Record<number, NostrKindMetadata> = {
  // Q&A Platform
  [NostrKind.QUESTION]: {
    kind: 30400,
    name: 'Question',
    category: 'qa',
    description: 'Q&A question with optional bounty',
    replaceable: true,
    parameterized: true,
    template: 'question',
    searchable: true,
    icon: '❓',
  },
  [NostrKind.ANSWER]: {
    kind: 6400,
    name: 'Answer',
    category: 'qa',
    description: 'Answer to a question',
    replaceable: false,
    template: 'answer',
    searchable: true,
    icon: '💡',
  },
  [NostrKind.ANSWER_ACCEPTANCE]: {
    kind: 6401,
    name: 'Answer Acceptance',
    category: 'qa',
    description: 'Question author accepts an answer',
    replaceable: false,
    template: 'acceptance',
    searchable: false,
    icon: '✅',
  },
  [NostrKind.BOUNTY_AWARD]: {
    kind: 6402,
    name: 'Bounty Award',
    category: 'qa',
    description: 'Award bounty to answer',
    replaceable: false,
    template: 'bounty-award',
    searchable: false,
    icon: '💰',
  },
  [NostrKind.VOTE]: {
    kind: 7400,
    name: 'Vote',
    category: 'qa',
    description: 'Upvote/downvote on Q&A content',
    replaceable: false,
    template: 'vote',
    searchable: false,
    icon: '⬆️',
  },
  [NostrKind.TOPIC_DEFINITION]: {
    kind: 34400,
    name: 'Topic',
    category: 'qa',
    description: 'Topic/tag definition with moderators',
    replaceable: true,
    parameterized: true,
    template: 'topic',
    searchable: true,
    icon: '🏷️',
  },
  [NostrKind.COMMENT]: {
    kind: 1111,
    name: 'Comment',
    category: 'qa',
    description: 'Comment on Q&A content',
    replaceable: false,
    template: 'comment',
    searchable: true,
    icon: '💬',
  },

  // Knowledge Base
  [NostrKind.KB_ARTICLE]: {
    kind: 30023,
    name: 'KB Article',
    category: 'kb',
    description: 'Knowledge base article/documentation',
    replaceable: true,
    parameterized: true,
    template: 'kb-article',
    searchable: true,
    icon: '📖',
  },

  // Studios
  [NostrKind.STUDIO_METADATA]: {
    kind: 31990,
    name: 'Studio',
    category: 'studio',
    description: 'Studio metadata and profile',
    replaceable: true,
    parameterized: true,
    template: 'studio',
    searchable: true,
    icon: '🎬',
  },
  [NostrKind.STUDIO_CONTRIBUTORS]: {
    kind: 30382,
    name: 'Contributors',
    category: 'studio',
    description: 'Studio contributor list',
    replaceable: true,
    parameterized: true,
    template: 'contributors',
    searchable: false,
    icon: '👥',
  },

  // Podcasting
  [NostrKind.SHOW]: {
    kind: 30383,
    name: 'Show',
    category: 'podcast',
    description: 'Podcast/video show metadata',
    replaceable: true,
    parameterized: true,
    template: 'show',
    searchable: true,
    icon: '🎙️',
  },
  [NostrKind.EPISODE]: {
    kind: 30384,
    name: 'Episode',
    category: 'podcast',
    description: 'Podcast/video episode',
    replaceable: true,
    parameterized: true,
    template: 'episode',
    searchable: true,
    icon: '🎧',
  },

  // Bounties
  [NostrKind.BOUNTY]: {
    kind: 37100,
    name: 'Bounty',
    category: 'bounty',
    description: 'Lightning-native bounty',
    replaceable: true,
    parameterized: true,
    template: 'bounty',
    searchable: true,
    icon: '🎯',
  },
  [NostrKind.BOUNTY_CLAIM]: {
    kind: 37101,
    name: 'Bounty Claim',
    category: 'bounty',
    description: 'Claim on a bounty',
    replaceable: false,
    template: 'bounty-claim',
    searchable: false,
    icon: '🙋',
  },
  [NostrKind.BOUNTY_RELEASE]: {
    kind: 37102,
    name: 'Bounty Release',
    category: 'bounty',
    description: 'Release bounty payment',
    replaceable: false,
    template: 'bounty-release',
    searchable: false,
    icon: '💸',
  },
};

export function getKindMetadata(kind: number): NostrKindMetadata | undefined {
  return NOSTR_KIND_REGISTRY[kind];
}

export function getSearchableKinds(): number[] {
  return Object.values(NOSTR_KIND_REGISTRY)
    .filter(meta => meta.searchable)
    .map(meta => meta.kind);
}

export function getKindsByCategory(category: string): number[] {
  return Object.values(NOSTR_KIND_REGISTRY)
    .filter(meta => meta.category === category)
    .map(meta => meta.kind);
}
