/**
 * contentParser.js
 * Tokenize Nostr/web content: detect media URLs, hashtags, mentions, links.
 */

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i;
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;
const AUDIO_EXTS = /\.(mp3|wav|ogg|flac|aac|m4a)(\?.*)?$/i;
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;
const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;
const MENTION_REGEX = /(?:@|nostr:)(npub1[a-z0-9]{58}|[a-zA-Z0-9_]+)/g;
const NOSTR_NOTE_REGEX = /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/g;
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * Token types emitted by the tokenizer.
 */
export const TokenType = {
  TEXT: 'text',
  URL: 'url',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  YOUTUBE: 'youtube',
  HASHTAG: 'hashtag',
  MENTION: 'mention',
  NOSTR_NOTE: 'nostr_note',
  LINK_PREVIEW: 'link_preview',
};

/**
 * Classify a URL into a media token type.
 */
export function classifyUrl(url) {
  if (IMAGE_EXTS.test(url)) return TokenType.IMAGE;
  if (VIDEO_EXTS.test(url)) return TokenType.VIDEO;
  if (AUDIO_EXTS.test(url)) return TokenType.AUDIO;
  if (YOUTUBE_REGEX.test(url)) return TokenType.YOUTUBE;
  return TokenType.LINK_PREVIEW;
}

/**
 * Extract YouTube video ID from a URL.
 */
export function getYouTubeId(url) {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

/**
 * Tokenize content string into an array of typed tokens.
 * Order preserved; consecutive image tokens can be grouped as galleries.
 *
 * @param {string} content - Raw text content
 * @returns {Array<{type: string, value: string, [extra]: any}>}
 */
export function tokenizeContent(content) {
  if (!content || typeof content !== 'string') return [];

  const tokens = [];
  let remaining = content;
  let cursor = 0;

  // Build a combined regex that matches any special token
  // We'll scan character-by-character approach: find first match, emit text before, emit token, repeat.
  const allPatterns = [
    { regex: /https?:\/\/[^\s<>"')\]]+/gi, handler: (m) => {
      const type = classifyUrl(m[0]);
      if (type === TokenType.YOUTUBE) {
        return { type, value: m[0], youtubeId: getYouTubeId(m[0]) };
      }
      return { type, value: m[0] };
    }},
    { regex: /nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/gi, handler: (m) => ({
      type: TokenType.NOSTR_NOTE,
      value: m[0],
      noteId: m[1],
    })},
    { regex: /#([a-zA-Z0-9_]+)/g, handler: (m) => ({
      type: TokenType.HASHTAG,
      value: m[0],
      tag: m[1],
    })},
    { regex: /@(npub1[a-z0-9]{58}|[a-zA-Z0-9_]{1,50})/g, handler: (m) => ({
      type: TokenType.MENTION,
      value: m[0],
      handle: m[1],
    })},
  ];

  // Simple linear scan: find earliest match at each position
  let text = content;
  while (text.length > 0) {
    let earliest = null;
    let earliestIndex = Infinity;
    let earliestHandler = null;
    let earliestMatch = null;

    for (const { regex, handler } of allPatterns) {
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (match && match.index < earliestIndex) {
        earliest = match;
        earliestIndex = match.index;
        earliestHandler = handler;
        earliestMatch = match;
      }
    }

    if (!earliest) {
      // No more patterns; emit remaining as text
      if (text.length > 0) {
        tokens.push({ type: TokenType.TEXT, value: text });
      }
      break;
    }

    // Emit text before the match
    if (earliestIndex > 0) {
      tokens.push({ type: TokenType.TEXT, value: text.slice(0, earliestIndex) });
    }

    // Emit the matched token
    tokens.push(earliestHandler(earliestMatch));

    // Advance past the match
    text = text.slice(earliestIndex + earliestMatch[0].length);
  }

  return tokens;
}

/**
 * Extract all media URLs from content.
 * @param {string} content
 * @returns {{ images: string[], videos: string[], audio: string[], youtubeIds: string[] }}
 */
export function extractMedia(content) {
  const tokens = tokenizeContent(content);
  const images = [];
  const videos = [];
  const audio = [];
  const youtubeIds = [];

  for (const token of tokens) {
    if (token.type === TokenType.IMAGE) images.push(token.value);
    else if (token.type === TokenType.VIDEO) videos.push(token.value);
    else if (token.type === TokenType.AUDIO) audio.push(token.value);
    else if (token.type === TokenType.YOUTUBE) youtubeIds.push(token.youtubeId);
  }

  return { images, videos, audio, youtubeIds };
}

/**
 * Extract hashtags from content string.
 * @param {string} content
 * @returns {string[]}
 */
export function extractHashtags(content) {
  if (!content) return [];
  const tags = [];
  let m;
  const re = /#([a-zA-Z0-9_]+)/g;
  while ((m = re.exec(content)) !== null) {
    tags.push(m[1]);
  }
  return [...new Set(tags)];
}

/**
 * Extract @mentions from content string.
 * @param {string} content
 * @returns {string[]}
 */
export function extractMentions(content) {
  if (!content) return [];
  const mentions = [];
  let m;
  const re = /@(npub1[a-z0-9]{58}|[a-zA-Z0-9_]{1,50})/g;
  while ((m = re.exec(content)) !== null) {
    mentions.push(m[1]);
  }
  return [...new Set(mentions)];
}

/**
 * Extract all plain URLs from content string.
 * @param {string} content
 * @returns {string[]}
 */
export function extractUrls(content) {
  if (!content) return [];
  return [...(content.match(URL_REGEX) || [])];
}

/**
 * Strip media URLs and nostr tokens from content to get clean text for markdown rendering.
 * @param {string} content
 * @returns {string}
 */
export function stripMediaUrls(content) {
  if (!content) return '';
  return content
    .replace(/https?:\/\/[^\s<>"')\]]+\.(jpe?g|png|gif|webp|svg|avif|mp4|webm|ogg|mov)(\?[^\s]*)?/gi, '')
    .replace(/nostr:(note1[a-z0-9]{58}|nevent1[a-z0-9]+)/gi, '')
    .trim();
}

/**
 * Truncate text to approximately N lines (by character count heuristic).
 * @param {string} text
 * @param {number} lines
 * @param {number} charsPerLine
 */
export function truncateLines(text, lines = 3, charsPerLine = 80) {
  if (!text) return '';
  const maxChars = lines * charsPerLine;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…';
}

export default {
  tokenizeContent,
  extractMedia,
  extractHashtags,
  extractMentions,
  extractUrls,
  stripMediaUrls,
  truncateLines,
  classifyUrl,
  getYouTubeId,
  TokenType,
};
