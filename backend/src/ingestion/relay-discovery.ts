import { Event as NostrEvent } from 'nostr-tools';

export interface DiscoveredRelay {
  url: string;
  source: 'event_content' | 'relay_tag' | 'nip65_list';
  discoveredFrom: string; // Event ID that mentioned this relay
  firstSeen: number;
}

export class RelayDiscovery {
  private discovered: Map<string, DiscoveredRelay> = new Map();
  private processed: Set<string> = new Set(); // Event IDs we've already processed
  
  /**
   * Extract relay URLs from an event
   */
  extractRelays(event: NostrEvent): DiscoveredRelay[] {
    if (this.processed.has(event.id)) {
      return []; // Already processed this event
    }
    
    this.processed.add(event.id);
    const relays: DiscoveredRelay[] = [];
    const now = Date.now();
    
    // 1. Check for NIP-65 relay list (kind:10002)
    if (event.kind === 10002) {
      for (const tag of event.tags) {
        if (tag[0] === 'r' && tag[1]) {
          const url = this.normalizeRelayUrl(tag[1]);
          if (url && !this.discovered.has(url)) {
            const relay: DiscoveredRelay = {
              url,
              source: 'nip65_list',
              discoveredFrom: event.id,
              firstSeen: now,
            };
            relays.push(relay);
            this.discovered.set(url, relay);
          }
        }
      }
    }
    
    // 2. Check for relay tags in any event (NIP-01 "r" tag)
    for (const tag of event.tags) {
      if (tag[0] === 'r' && tag[1]) {
        const url = this.normalizeRelayUrl(tag[1]);
        if (url && !this.discovered.has(url)) {
          const relay: DiscoveredRelay = {
            url,
            source: 'relay_tag',
            discoveredFrom: event.id,
            firstSeen: now,
          };
          relays.push(relay);
          this.discovered.set(url, relay);
        }
      }
    }
    
    // 3. Extract relay URLs from content (wss:// or ws:// links)
    const relayRegex = /wss?:\/\/[^\s<>"]+/g;
    const matches = event.content.match(relayRegex);
    
    if (matches) {
      for (const match of matches) {
        const url = this.normalizeRelayUrl(match);
        if (url && !this.discovered.has(url)) {
          const relay: DiscoveredRelay = {
            url,
            source: 'event_content',
            discoveredFrom: event.id,
            firstSeen: now,
          };
          relays.push(relay);
          this.discovered.set(url, relay);
        }
      }
    }
    
    return relays;
  }
  
  /**
   * Normalize relay URL (remove trailing slash, lowercase)
   */
  private normalizeRelayUrl(url: string): string | null {
    try {
      // Clean up the URL
      url = url.trim().toLowerCase();
      
      // Must start with ws:// or wss://
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        return null;
      }
      
      // Remove trailing slash
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      
      // Basic validation - should have a domain
      const parsed = new URL(url);
      if (!parsed.hostname) {
        return null;
      }
      
      // Skip localhost/private IPs for public crawling
      if (parsed.hostname === 'localhost' || 
          parsed.hostname.startsWith('127.') ||
          parsed.hostname.startsWith('192.168.') ||
          parsed.hostname.startsWith('10.')) {
        return null;
      }
      
      return url;
      
    } catch {
      return null; // Invalid URL
    }
  }
  
  /**
   * Get all discovered relays (sorted by discovery time)
   */
  getDiscoveredRelays(): DiscoveredRelay[] {
    return Array.from(this.discovered.values())
      .sort((a, b) => a.firstSeen - b.firstSeen);
  }
  
  /**
   * Get new relays discovered since last check
   */
  getNewRelays(minTime: number): DiscoveredRelay[] {
    return Array.from(this.discovered.values())
      .filter(r => r.firstSeen >= minTime);
  }
  
  /**
   * Check if a relay has already been discovered
   */
  hasRelay(url: string): boolean {
    const normalized = this.normalizeRelayUrl(url);
    return normalized ? this.discovered.has(normalized) : false;
  }
  
  /**
   * Get discovery statistics
   */
  getStats() {
    const total = this.discovered.size;
    const bySource = {
      nip65_list: 0,
      relay_tag: 0,
      event_content: 0,
    };
    
    for (const relay of this.discovered.values()) {
      bySource[relay.source]++;
    }
    
    return {
      total,
      bySource,
      processed_events: this.processed.size,
    };
  }
}

/**
 * Crawling strategy that discovers and adds relays as it goes
 */
export class AdaptiveRelayCrawler {
  private initialRelays: string[];
  private discoveredRelays: Set<string> = new Set();
  private discovery: RelayDiscovery;
  
  constructor(initialRelays: string[]) {
    this.initialRelays = initialRelays;
    this.discovery = new RelayDiscovery();
    
    // Add initial relays to discovered set
    for (const relay of initialRelays) {
      this.discoveredRelays.add(relay);
    }
  }
  
  /**
   * Process an event and extract any relay URLs
   */
  processEvent(event: NostrEvent): string[] {
    const newRelays = this.discovery.extractRelays(event);
    const added: string[] = [];
    
    for (const relay of newRelays) {
      if (!this.discoveredRelays.has(relay.url)) {
        this.discoveredRelays.add(relay.url);
        added.push(relay.url);
        console.log(`🔍 Discovered new relay: ${relay.url} (via ${relay.source})`);
      }
    }
    
    return added;
  }
  
  /**
   * Get all relays to crawl (initial + discovered)
   */
  getAllRelays(): string[] {
    return Array.from(this.discoveredRelays);
  }
  
  /**
   * Get only newly discovered relays
   */
  getNewRelays(): string[] {
    return Array.from(this.discoveredRelays)
      .filter(url => !this.initialRelays.includes(url));
  }
  
  /**
   * Get discovery statistics
   */
  getStats() {
    return {
      initial: this.initialRelays.length,
      discovered: this.discoveredRelays.size - this.initialRelays.length,
      total: this.discoveredRelays.size,
      discovery: this.discovery.getStats(),
    };
  }
}
