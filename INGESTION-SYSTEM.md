# Nostr Ingestion System - Robust Large-Scale Spider

## Overview
Scalable, respectful Nostr content ingestion system that respects relay policies, handles document types, and implements anti-spam measures.

## Architecture

### 1. Relay Manager
**Purpose**: Manage connections to multiple relays with health monitoring and rate limiting

```typescript
interface RelayConfig {
  url: string;
  maxConnections: number;  // Typically 1-2 per relay
  rateLimit: {
    maxEventsPerSecond: number;  // Usually 10-20 for REQ, 5-10 for EVENT
    burstSize: number;           // Allow short bursts (50-100)
    cooldownMs: number;          // Back off period after rate limit hit
  };
  policies: {
    maxFilterSize: number;       // Max IDs/authors per filter
    maxSubscriptionsPerClient: number;  // Usually 10-20
    requireAuth: boolean;        // NIP-42 auth required?
  };
  health: {
    lastSuccess: number;
    failureCount: number;
    averageLatencyMs: number;
  };
}
```

**Features**:
- Auto-discovery of relay policies via NIP-11 (relay information document)
- Dynamic rate limiting based on relay responses
- Connection pooling with health checks
- Automatic fallback to slower relays when throttled
- Exponential backoff on errors

### 2. Document Type Classifier
**Purpose**: Identify and categorize different Nostr event types

```typescript
interface DocumentType {
  kind: number;
  category: 'text' | 'media' | 'metadata' | 'structured' | 'ephemeral';
  priority: number;  // 1-10, higher = more important to index
  extractors: string[];  // Which content extractors to use
}

const DOCUMENT_TYPES: DocumentType[] = [
  // High priority content
  { kind: 1, category: 'text', priority: 10, extractors: ['text', 'mentions', 'hashtags', 'links'] },
  { kind: 30023, category: 'text', priority: 9, extractors: ['longform', 'markdown', 'metadata'] },
  { kind: 30024, category: 'text', priority: 8, extractors: ['draft', 'markdown'] },
  
  // Medium priority
  { kind: 30402, category: 'structured', priority: 7, extractors: ['classifieds', 'structured'] },
  { kind: 30040, category: 'structured', priority: 6, extractors: ['listings', 'metadata'] },
  { kind: 30311, category: 'media', priority: 6, extractors: ['video', 'metadata'] },
  
  // Lower priority (still useful)
  { kind: 0, category: 'metadata', priority: 5, extractors: ['profile', 'nip05'] },
  { kind: 3, category: 'metadata', priority: 4, extractors: ['contacts'] },
  { kind: 1063, category: 'media', priority: 5, extractors: ['file-metadata'] },
  
  // Ephemeral - may skip or lower priority
  { kind: 20000-29999, category: 'ephemeral', priority: 1, extractors: [] },
];
```

### 3. Content Extractors
**Purpose**: Extract searchable content from different event types

```typescript
interface ContentExtractor {
  extract(event: NostrEvent): ExtractedContent;
}

interface ExtractedContent {
  title?: string;
  body: string;
  summary?: string;
  tags: string[];
  metadata: Record<string, any>;
  urls: string[];
  mentions: string[];  // npub/nprofile references
  quality_score: number;  // 0-1, for spam filtering
}

class TextExtractor implements ContentExtractor {
  extract(event: NostrEvent): ExtractedContent {
    // Extract from kind:1 (short notes)
    return {
      body: event.content,
      tags: event.tags.filter(t => t[0] === 't').map(t => t[1]),
      mentions: event.tags.filter(t => t[0] === 'p').map(t => t[1]),
      urls: this.extractUrls(event.content),
      quality_score: this.calculateQuality(event),
    };
  }
}

class LongformExtractor implements ContentExtractor {
  extract(event: NostrEvent): ExtractedContent {
    // Extract from kind:30023 (long-form articles)
    const titleTag = event.tags.find(t => t[0] === 'title');
    const summaryTag = event.tags.find(t => t[0] === 'summary');
    const imageTag = event.tags.find(t => t[0] === 'image');
    
    return {
      title: titleTag?.[1],
      summary: summaryTag?.[1],
      body: event.content,
      tags: event.tags.filter(t => t[0] === 't').map(t => t[1]),
      metadata: {
        image: imageTag?.[1],
        published_at: event.created_at,
      },
      quality_score: this.calculateQuality(event),
    };
  }
}
```

### 4. Anti-Spam Filter
**Purpose**: Filter low-quality and spam content before indexing

```typescript
interface SpamFilter {
  check(event: NostrEvent, extracted: ExtractedContent): SpamCheckResult;
}

interface SpamCheckResult {
  isSpam: boolean;
  confidence: number;  // 0-1
  reasons: string[];
}

class AntiSpamFilter implements SpamFilter {
  check(event: NostrEvent, extracted: ExtractedContent): SpamCheckResult {
    const checks = [
      this.checkDuplicateContent(event),
      this.checkExcessiveLinks(extracted),
      this.checkSuspiciousPatterns(extracted),
      this.checkAuthorReputation(event.pubkey),
      this.checkContentQuality(extracted),
    ];
    
    const failedChecks = checks.filter(c => !c.passed);
    
    return {
      isSpam: failedChecks.length >= 2,  // 2+ failed checks = spam
      confidence: failedChecks.length / checks.length,
      reasons: failedChecks.map(c => c.reason),
    };
  }
  
  private checkDuplicateContent(event: NostrEvent): CheckResult {
    // Check if this exact content has been posted multiple times
    const hash = this.hashContent(event.content);
    const recentCount = this.countRecentDuplicates(hash, event.pubkey);
    
    return {
      passed: recentCount < 3,  // Same content posted <3 times in 24h
      reason: 'Duplicate content spam',
    };
  }
  
  private checkExcessiveLinks(extracted: ExtractedContent): CheckResult {
    const linkRatio = extracted.urls.length / extracted.body.length;
    
    return {
      passed: linkRatio < 0.1,  // Less than 10% of content is links
      reason: 'Excessive link spam',
    };
  }
  
  private checkSuspiciousPatterns(extracted: ExtractedContent): CheckResult {
    const patterns = [
      /\b(buy now|click here|limited time|act fast)\b/gi,
      /\b\d+\s*(btc|bitcoin|crypto|nft)\b/gi,  // Excessive crypto mentions
      /(.)\1{10,}/,  // Repeated characters (aaaaaaa...)
    ];
    
    const matches = patterns.filter(p => p.test(extracted.body));
    
    return {
      passed: matches.length < 2,
      reason: 'Suspicious spam patterns detected',
    };
  }
  
  private checkAuthorReputation(pubkey: string): CheckResult {
    // Check WoT score if available
    const wotScore = this.getWoTScore(pubkey);
    
    return {
      passed: wotScore === null || wotScore > -0.5,  // Not strongly distrusted
      reason: 'Author has low WoT reputation',
    };
  }
}
```

### 5. Ingestion Strategy
**Purpose**: Coordinate large-scale content ingestion

```typescript
interface IngestionStrategy {
  name: string;
  filters: NostrFilter[];
  batchSize: number;
  estimatedEvents: number;
  timeframe?: { since: number; until: number };
}

// Strategy 1: Recent high-quality content (warm-up)
const RECENT_QUALITY: IngestionStrategy = {
  name: 'Recent Quality Content',
  filters: [
    { kinds: [30023], limit: 1000 },  // Long-form articles
    { kinds: [1], '#t': ['nostr', 'bitcoin', 'tech'], limit: 5000 },  // Tagged notes
  ],
  batchSize: 100,
  estimatedEvents: 6000,
  timeframe: {
    since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,  // Last 7 days
    until: Math.floor(Date.now() / 1000),
  },
};

// Strategy 2: Popular authors (curated)
const POPULAR_AUTHORS: IngestionStrategy = {
  name: 'Popular Authors',
  filters: [
    { authors: [...POPULAR_PUBKEYS.slice(0, 100)], kinds: [1, 30023], limit: 10000 },
  ],
  batchSize: 200,
  estimatedEvents: 10000,
};

// Strategy 3: Comprehensive crawl (large-scale)
const COMPREHENSIVE_CRAWL: IngestionStrategy = {
  name: 'Comprehensive Crawl',
  filters: [
    // All text content from last 30 days
    { kinds: [1], limit: 50000 },
    { kinds: [30023], limit: 10000 },
    { kinds: [30024], limit: 5000 },
    
    // Structured content
    { kinds: [30402, 30040], limit: 5000 },
    
    // Media metadata
    { kinds: [1063, 30311], limit: 3000 },
  ],
  batchSize: 500,
  estimatedEvents: 73000,
  timeframe: {
    since: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
    until: Math.floor(Date.now() / 1000),
  },
};
```

### 6. Ingestion Pipeline
**Purpose**: Orchestrate the entire ingestion process

```typescript
class IngestionPipeline {
  private relayManager: RelayManager;
  private classifier: DocumentTypeClassifier;
  private extractors: Map<string, ContentExtractor>;
  private spamFilter: AntiSpamFilter;
  private indexer: Indexer;
  
  async execute(strategy: IngestionStrategy): Promise<IngestionResult> {
    const startTime = Date.now();
    const stats = {
      fetched: 0,
      indexed: 0,
      filtered: 0,
      errors: 0,
    };
    
    console.log(`Starting ingestion: ${strategy.name}`);
    console.log(`Estimated events: ${strategy.estimatedEvents}`);
    
    for (const filter of strategy.filters) {
      // Add timeframe if specified
      if (strategy.timeframe) {
        filter.since = strategy.timeframe.since;
        filter.until = strategy.timeframe.until;
      }
      
      // Process in batches
      const events = await this.fetchEvents(filter, strategy.batchSize);
      
      for (const event of events) {
        stats.fetched++;
        
        try {
          // 1. Classify document type
          const docType = this.classifier.classify(event);
          
          if (docType.priority < 3) {
            console.log(`Skipping low-priority event kind:${event.kind}`);
            continue;
          }
          
          // 2. Extract content
          const extracted = await this.extractContent(event, docType);
          
          // 3. Check for spam
          const spamCheck = this.spamFilter.check(event, extracted);
          
          if (spamCheck.isSpam) {
            stats.filtered++;
            console.log(`Filtered spam: ${spamCheck.reasons.join(', ')}`);
            continue;
          }
          
          // 4. Index the content
          await this.indexer.index({
            event_id: event.id,
            pubkey: event.pubkey,
            kind: event.kind,
            created_at: event.created_at,
            ...extracted,
          });
          
          stats.indexed++;
          
          if (stats.indexed % 100 === 0) {
            console.log(`Progress: ${stats.indexed}/${strategy.estimatedEvents} indexed`);
          }
          
        } catch (error) {
          stats.errors++;
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    return {
      strategy: strategy.name,
      duration,
      stats,
      eventsPerSecond: stats.indexed / (duration / 1000),
    };
  }
  
  private async fetchEvents(
    filter: NostrFilter,
    batchSize: number
  ): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];
    
    // Get best relays for this query
    const relays = await this.relayManager.selectRelays(filter);
    
    for (const relay of relays) {
      try {
        const batch = await relay.fetchWithRateLimit(filter, batchSize);
        events.push(...batch);
        
        // Don't fetch more than needed
        if (events.length >= (filter.limit || 1000)) {
          break;
        }
        
      } catch (error) {
        console.error(`Error fetching from ${relay.url}:`, error);
      }
    }
    
    // Deduplicate by event ID
    return [...new Map(events.map(e => [e.id, e])).values()];
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (30 min)
- [ ] Build RelayManager with NIP-11 support
- [ ] Implement rate limiting with exponential backoff
- [ ] Add health monitoring and auto-fallback

### Phase 2: Content Processing (30 min)
- [ ] Build DocumentTypeClassifier
- [ ] Implement content extractors for common kinds
- [ ] Add anti-spam filter with basic checks

### Phase 3: Initial Spider Run (15 min)
- [ ] Run RECENT_QUALITY strategy (6K events)
- [ ] Verify indexing works correctly
- [ ] Check spam filter effectiveness

### Phase 4: Large-Scale Spider (1 hour)
- [ ] Run COMPREHENSIVE_CRAWL strategy (73K+ events)
- [ ] Monitor performance and relay health
- [ ] Adjust rate limits as needed

### Phase 5: Analysis & Optimization (30 min)
- [ ] Analyze document type distribution
- [ ] Review spam filter accuracy
- [ ] Optimize slow queries
- [ ] Document findings

## Relay Selection

**Primary Relays** (high-quality, well-maintained):
- wss://relay.damus.io - General content, good uptime
- wss://nos.lol - Quality content, good moderation
- wss://relay.nostr.band - Large archive, good search support
- wss://nostr.mom - Reliable, good uptime

**Specialized Relays**:
- wss://relay.nostr.bg - Long-form content (kind:30023)
- wss://relay.snort.social - Active community
- wss://nostr.wine - Paid relay, high quality

**Backup Relays**:
- wss://relay.current.fyi
- wss://nostr-pub.wellorder.net
- wss://relay.orangepill.dev

## Rate Limiting Guidelines

**Conservative (default)**:
- 10 REQ/second per relay
- 50 events max per batch
- 2 second cooldown between batches

**Aggressive (for large crawls)**:
- 20 REQ/second per relay
- 100 events max per batch
- 1 second cooldown between batches

**Burst Protection**:
- Allow bursts up to 100 requests
- Then apply exponential backoff (2x, 4x, 8x delays)
- Reset after 5 minutes of normal operation

## Expected Results

### Small Run (6K events, 5 min)
- Indexed: ~5,000 events
- Filtered: ~1,000 spam events (16%)
- Document types:
  - kind:1 (notes): 4,000
  - kind:30023 (articles): 1,000
  - Other: 1,000

### Large Run (73K events, 1 hour)
- Indexed: ~60,000 events
- Filtered: ~13,000 spam events (18%)
- Document types:
  - kind:1 (notes): 45,000
  - kind:30023 (articles): 10,000
  - kind:30024 (drafts): 3,000
  - kind:30402/30040 (classifieds): 5,000
  - Media metadata: 3,000
  - Other: 7,000

## Monitoring

```typescript
interface IngestionMetrics {
  relays: {
    [url: string]: {
      requests: number;
      successes: number;
      failures: number;
      averageLatency: number;
      rateLimitHits: number;
    };
  };
  
  documentTypes: {
    [kind: number]: {
      fetched: number;
      indexed: number;
      filtered: number;
    };
  };
  
  spamReasons: {
    [reason: string]: number;
  };
  
  performance: {
    eventsPerSecond: number;
    averageProcessingTime: number;
    memoryUsage: number;
  };
}
```

## Next Steps

1. Build the ingestion pipeline
2. Run small test (RECENT_QUALITY)
3. Verify results in database
4. Run large spider (COMPREHENSIVE_CRAWL)
5. Analyze results and document findings
