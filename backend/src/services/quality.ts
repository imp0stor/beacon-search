/**
 * Quality Scoring Module for Beacon Search
 * Evaluates document quality based on multiple factors
 */

interface QualityFactors {
  titleQuality: number;
  contentLength: number;
  hasMedia: boolean;
  freshness: number;
  engagement?: number;
}

interface MediaInfo {
  urls: string[];
  hasMedia: boolean;
}

/**
 * Calculate quality score for a document (0-1 scale)
 */
export function calculateQualityScore(
  title: string,
  content: string,
  createdAt?: Date,
  engagement?: { likes?: number; reposts?: number }
): number {
  const factors: QualityFactors = {
    titleQuality: evaluateTitleQuality(title),
    contentLength: evaluateContentLength(content),
    hasMedia: extractMediaUrls(content).hasMedia,
    freshness: evaluateFreshness(createdAt),
    engagement: evaluateEngagement(engagement)
  };

  // Weighted scoring
  const weights = {
    titleQuality: 0.25,
    contentLength: 0.30,
    hasMedia: 0.10,
    freshness: 0.15,
    engagement: 0.20
  };

  const score = 
    factors.titleQuality * weights.titleQuality +
    factors.contentLength * weights.contentLength +
    (factors.hasMedia ? 1 : 0) * weights.hasMedia +
    factors.freshness * weights.freshness +
    (factors.engagement || 0.5) * weights.engagement;

  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate title quality (0-1)
 */
function evaluateTitleQuality(title: string): number {
  if (!title || title.trim().length === 0) return 0;

  let score = 0.5; // Base score

  // Penalty for URL-like titles
  if (title.match(/^https?:\/\//i)) {
    score -= 0.3;
  }

  // Penalty for too short titles
  if (title.length < 10) {
    score -= 0.2;
  } else if (title.length > 20) {
    score += 0.2;
  }

  // Penalty for titles that are just numbers or single words
  if (title.split(/\s+/).length < 2) {
    score -= 0.2;
  }

  // Bonus for properly formatted titles (Title Case, etc.)
  if (title.match(/^[A-Z][a-z]/)) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate content length (0-1)
 */
function evaluateContentLength(content: string): number {
  if (!content) return 0;

  const words = content.trim().split(/\s+/).length;

  // Scoring based on word count
  if (words < 10) return 0.1;
  if (words < 50) return 0.3;
  if (words < 100) return 0.5;
  if (words < 300) return 0.7;
  if (words < 1000) return 0.9;
  return 1.0;
}

/**
 * Evaluate freshness based on creation date (0-1)
 */
function evaluateFreshness(createdAt?: Date): number {
  if (!createdAt) return 0.5; // Neutral score if no date

  const now = new Date();
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Scoring based on age
  if (ageDays < 1) return 1.0;      // Last 24h
  if (ageDays < 7) return 0.9;      // Last week
  if (ageDays < 30) return 0.7;     // Last month
  if (ageDays < 90) return 0.5;     // Last quarter
  if (ageDays < 365) return 0.3;    // Last year
  return 0.1;                        // Older
}

/**
 * Evaluate engagement (0-1)
 */
function evaluateEngagement(engagement?: { likes?: number; reposts?: number }): number {
  if (!engagement) return 0.5; // Neutral if no data

  const likes = engagement.likes || 0;
  const reposts = engagement.reposts || 0;
  const totalEngagement = likes + (reposts * 2); // Reposts weighted more

  // Logarithmic scale for engagement
  if (totalEngagement === 0) return 0.3;
  if (totalEngagement < 5) return 0.5;
  if (totalEngagement < 20) return 0.7;
  if (totalEngagement < 100) return 0.85;
  return 1.0;
}

/**
 * Extract media URLs from content
 * Supports: Images (jpg, png, gif, webp), Videos (mp4, webm)
 * Also handles Nostr event image tags and Blossom server URLs
 */
export function extractMediaUrls(content: string, nostrEventTags?: any[]): MediaInfo {
  const urls: string[] = [];

  // Extract from Nostr event tags (imeta, image, etc.)
  if (nostrEventTags) {
    nostrEventTags.forEach(tag => {
      if (tag[0] === 'image' || tag[0] === 'imeta') {
        urls.push(tag[1]);
      }
      // Handle imeta array format: ["imeta", "url https://...", "m image/jpeg", ...]
      if (tag[0] === 'imeta' && tag.length > 1) {
        tag.slice(1).forEach((item: string) => {
          if (item.startsWith('url ')) {
            urls.push(item.substring(4));
          }
        });
      }
    });
  }

  // Extract URLs from content using regex
  const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|mp4|webm|mov))/gi;
  const matches = content.match(urlRegex);
  if (matches) {
    urls.push(...matches);
  }

  // Extract markdown image syntax: ![alt](url)
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownImageRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }

  // Extract HTML img tags
  const htmlImageRegex = /<img[^>]+src="([^">]+)"/g;
  while ((match = htmlImageRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  // Extract Blossom server URLs (sha256 format)
  const blossomRegex = /https?:\/\/[^\s]+\/([a-f0-9]{64})/gi;
  while ((match = blossomRegex.exec(content)) !== null) {
    urls.push(match[0]);
  }

  // Deduplicate URLs
  const uniqueUrls = Array.from(new Set(urls));

  return {
    urls: uniqueUrls,
    hasMedia: uniqueUrls.length > 0
  };
}

/**
 * Improved title extraction
 */
export function extractTitle(
  eventTitle?: string,
  content?: string,
  url?: string,
  metadata?: { title?: string }
): string {
  // 1. Use event title if available (Nostr article events)
  if (eventTitle && eventTitle.trim().length > 0 && !eventTitle.match(/^https?:\/\//i)) {
    return cleanTitle(eventTitle);
  }

  // 2. Use og:title from metadata
  if (metadata?.title && metadata.title.trim().length > 0) {
    return cleanTitle(metadata.title);
  }

  // 3. Extract from first line of content
  if (content) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Check if first line looks like a title (not a URL, reasonable length)
      if (!firstLine.match(/^https?:\/\//i) && firstLine.length > 5 && firstLine.length < 200) {
        return cleanTitle(firstLine);
      }
    }
  }

  // 4. Use URL domain as fallback
  if (url) {
    try {
      const urlObj = new URL(url);
      return cleanTitle(urlObj.hostname.replace(/^www\./, ''));
    } catch (e) {
      // Invalid URL, continue to final fallback
    }
  }

  // 5. Use first 50 chars of content
  if (content) {
    return cleanTitle(content.substring(0, 50)) + (content.length > 50 ? '...' : '');
  }

  return 'Untitled Document';
}

/**
 * Clean up title formatting
 */
function cleanTitle(title: string): string {
  return title
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[*_#`]/g, '')  // Strip markdown formatting
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

/**
 * Detect spam patterns in content
 */
export function isSpam(title: string, content: string): boolean {
  const spamPatterns = [
    /click here/i,
    /buy now/i,
    /limited time/i,
    /act fast/i,
    /congratulations/i,
    /you've won/i,
    /free money/i,
    /\$\$\$/,
    /!!!{3,}/, // Multiple exclamation marks
  ];

  const text = (title + ' ' + content).toLowerCase();
  
  return spamPatterns.some(pattern => pattern.test(text));
}

/**
 * Filter documents by minimum quality threshold
 */
export function meetsQualityThreshold(
  qualityScore: number,
  minThreshold: number = 0.3
): boolean {
  return qualityScore >= minThreshold;
}
