import { Event as NostrEvent } from 'nostr-tools';
import { createHash } from 'crypto';
import { ExtractedContent } from './content-extractor';

interface SpamCheckResult {
  isSpam: boolean;
  confidence: number; // 0-1
  reasons: string[];
}

interface CheckResult {
  passed: boolean;
  reason: string;
}

export class AntiSpamFilter {
  private contentHashes: Map<string, { pubkey: string; count: number; firstSeen: number }> = new Map();
  private wotScores: Map<string, number> = new Map(); // Cached WoT scores
  
  check(event: NostrEvent, extracted: ExtractedContent): SpamCheckResult {
    const checks: CheckResult[] = [
      this.checkDuplicateContent(event),
      this.checkExcessiveLinks(extracted),
      this.checkSuspiciousPatterns(extracted),
      this.checkContentQuality(extracted),
      this.checkExcessiveMentions(extracted),
    ];
    
    const failedChecks = checks.filter(c => !c.passed);
    
    // 2+ failed checks = spam
    const isSpam = failedChecks.length >= 2;
    const confidence = failedChecks.length / checks.length;
    
    return {
      isSpam,
      confidence,
      reasons: failedChecks.map(c => c.reason),
    };
  }
  
  private checkDuplicateContent(event: NostrEvent): CheckResult {
    const hash = this.hashContent(event.content);
    const existing = this.contentHashes.get(hash);
    
    const now = Date.now();
    
    if (!existing) {
      // First time seeing this content
      this.contentHashes.set(hash, {
        pubkey: event.pubkey,
        count: 1,
        firstSeen: now,
      });
      return { passed: true, reason: '' };
    }
    
    // Check if it's from the same author
    if (existing.pubkey === event.pubkey) {
      existing.count++;
      
      // Same content posted multiple times by same author in 24h = spam
      const hoursSinceFirst = (now - existing.firstSeen) / (1000 * 60 * 60);
      if (hoursSinceFirst < 24 && existing.count >= 3) {
        return {
          passed: false,
          reason: `Duplicate content posted ${existing.count} times in ${hoursSinceFirst.toFixed(1)}h`,
        };
      }
    }
    
    return { passed: true, reason: '' };
  }
  
  private checkExcessiveLinks(extracted: ExtractedContent): CheckResult {
    const linkRatio = extracted.urls.length / Math.max(extracted.body.length, 1);
    
    if (linkRatio > 0.15) { // More than 15% of content is links
      return {
        passed: false,
        reason: `Excessive links (${extracted.urls.length} urls, ${(linkRatio * 100).toFixed(1)}% of content)`,
      };
    }
    
    return { passed: true, reason: '' };
  }
  
  private checkSuspiciousPatterns(extracted: ExtractedContent): CheckResult {
    const patterns = [
      { regex: /\b(buy now|click here|limited time|act fast|don't miss|hurry)\b/gi, name: 'urgency spam' },
      { regex: /(.)\1{15,}/, name: 'character spam' }, // Repeated characters
      { regex: /\b(crypto|nft|token|airdrop|giveaway)\b.*\b(free|win|claim)\b/gi, name: 'crypto spam' },
      { regex: /🚀|💰|💸|🤑/g, name: 'money emoji spam' },
    ];
    
    const matches: string[] = [];
    
    for (const pattern of patterns) {
      const found = extracted.body.match(pattern.regex);
      if (found && found.length > 2) { // Allow 1-2 matches, but 3+ is suspicious
        matches.push(pattern.name);
      }
    }
    
    if (matches.length >= 2) {
      return {
        passed: false,
        reason: `Suspicious patterns detected: ${matches.join(', ')}`,
      };
    }
    
    return { passed: true, reason: '' };
  }
  
  private checkContentQuality(extracted: ExtractedContent): CheckResult {
    // Very short content with links = likely spam
    if (extracted.body.length < 50 && extracted.urls.length > 0) {
      return {
        passed: false,
        reason: 'Short content with links (likely spam)',
      };
    }
    
    // All caps content
    const uppercaseRatio = (extracted.body.match(/[A-Z]/g) || []).length / extracted.body.length;
    if (uppercaseRatio > 0.5 && extracted.body.length > 20) {
      return {
        passed: false,
        reason: 'Excessive uppercase (shouting)',
      };
    }
    
    return { passed: true, reason: '' };
  }
  
  private checkExcessiveMentions(extracted: ExtractedContent): CheckResult {
    // More than 10 mentions in a single post is suspicious
    if (extracted.mentions.length > 10) {
      return {
        passed: false,
        reason: `Excessive mentions (${extracted.mentions.length})`,
      };
    }
    
    return { passed: true, reason: '' };
  }
  
  private hashContent(content: string): string {
    // Normalize content before hashing (remove extra whitespace, lowercase)
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
  }
  
  /**
   * Set WoT score for a pubkey (optional integration with WoT plugin)
   */
  setWoTScore(pubkey: string, score: number): void {
    this.wotScores.set(pubkey, score);
  }
  
  /**
   * Check if author has low WoT reputation
   */
  private checkAuthorReputation(pubkey: string): CheckResult {
    const wotScore = this.wotScores.get(pubkey);
    
    if (wotScore !== undefined && wotScore < -0.5) {
      return {
        passed: false,
        reason: `Low WoT reputation (${wotScore.toFixed(2)})`,
      };
    }
    
    return { passed: true, reason: '' };
  }
  
  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [hash, data] of this.contentHashes.entries()) {
      if (now - data.firstSeen > maxAge) {
        this.contentHashes.delete(hash);
      }
    }
    
    console.log(`Cleaned up spam filter cache (${this.contentHashes.size} entries remaining)`);
  }
}
