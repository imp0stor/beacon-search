# Web of Trust (WoT) Plugin

**Version:** 2.0.0  
**Status:** ✅ Multi-Provider Support

---

## Overview

The WoT Plugin integrates Nostr Web of Trust scores into Beacon Search ranking. It's **provider-agnostic**, supporting multiple WoT calculation backends:

- **NostrMaxi Provider** - External API (production)
- **Local Provider** - Built-in calculation (standalone/fallback)
- **Custom Providers** - Implement `WoTProvider` interface

---

## Features

✅ **Multi-Provider Architecture** - Switch between NostrMaxi API and local calculation  
✅ **Optional** - Enable/disable via config  
✅ **Automatic Fallback** - Falls back to local if external provider fails  
✅ **Caching** - In-memory cache with configurable TTL  
✅ **Batch Operations** - Efficient bulk lookups  
✅ **Configurable Weight** - Adjust WoT boost multiplier

---

## Configuration

### NostrMaxi Provider (Production)

```json
{
  "wot": {
    "enabled": true,
    "provider": "nostrmaxi",
    "nostrmaxi_url": "http://localhost:3000",
    "weight": 1.0,
    "cache_ttl": 3600
  }
}
```

### Local Provider (Standalone)

```json
{
  "wot": {
    "enabled": true,
    "provider": "local",
    "weight": 1.0,
    "cache_ttl": 3600
  }
}
```

### Disabled

```json
{
  "wot": {
    "enabled": false
  }
}
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable WoT ranking |
| `provider` | string | `"nostrmaxi"` | WoT provider (`nostrmaxi` or `local`) |
| `nostrmaxi_url` | string | `"http://localhost:3000"` | NostrMaxi API base URL |
| `weight` | number | `1.0` | Max boost multiplier (0.0-2.0 recommended) |
| `cache_ttl` | number | `3600` | Cache TTL in seconds |

---

## How It Works

### 1. Search Score Modification

When a search is performed:

```
Base score: 0.75 (relevance)
WoT score: 0.85 (trusted author)
Weight: 1.0

Multiplier = 1.0 + (0.85 * 1.0) = 1.85
Final score = 0.75 * 1.85 = 1.3875
```

**Effect:** Content from trusted sources ranks higher.

### 2. Provider Selection

```typescript
// Initialize plugin with config
const wotPlugin = new WoTPlugin({
  enabled: true,
  provider: 'nostrmaxi',
  nostrmaxi_url: 'http://localhost:3000',
  weight: 1.0,
  cache_ttl: 3600,
});

await wotPlugin.init(context);
```

**Health Check:** If NostrMaxi is unreachable, automatically falls back to local provider.

### 3. Caching

- **Key:** `fromPubkey:toPubkey`
- **TTL:** Configurable (default: 1 hour)
- **Size:** Auto-cleanup at 10,000 entries
- **Benefit:** Reduces API calls, improves search latency

### 4. Batch Prefetch

```typescript
// Before returning search results, prefetch WoT scores
const authorPubkeys = results.map(r => r.author_pubkey);
await wotPlugin.prefetchWoTScores(userPubkey, authorPubkeys);
```

**Benefit:** Single batch API call instead of N individual calls.

---

## Providers

### NostrMaxi Provider

**Use Case:** Production deployments with NostrMaxi backend.

**API Endpoints:**
- `GET /api/v1/wot/score/:pubkey?from=<fromPubkey>`
- `POST /api/v1/wot/batch` (body: `{ from_pubkey, to_pubkeys[] }`)
- `GET /health`

**Advantages:**
- Centralized WoT calculation
- Shared cache across Beacon instances
- NostrMaxi maintains follow graph
- Production-grade performance

**Disadvantages:**
- External dependency
- Network latency
- Requires NostrMaxi deployment

---

### Local Provider

**Use Case:** Standalone Beacon Search, development, fallback.

**How It Works:**
1. Loads kind:3 contact list events from Beacon's database
2. Builds follow graph using `buildFollowGraph()`
3. Calculates WoT scores using BFS algorithm (max 3 hops)
4. Caches results in memory

**Advantages:**
- No external dependencies
- Works standalone
- Automatic fallback

**Disadvantages:**
- Requires indexing kind:3 events
- Higher memory usage (graph in memory)
- Slower than dedicated WoT service

**Requirements:**
- Nostr connector must index kind:3 events
- Database must have follow graph data

---

## Creating Custom Providers

Implement the `WoTProvider` interface:

```typescript
import { WoTProvider } from './providers';

export class MyCustomProvider implements WoTProvider {
  name = 'my-custom-provider';

  async getScore(fromPubkey: string, toPubkey: string): Promise<number> {
    // Your custom logic
    return 0.5;
  }

  async batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Map<string, number>> {
    // Batch implementation
    const scores = new Map<string, number>();
    for (const pk of toPubkeys) {
      scores.set(pk, await this.getScore(fromPubkey, pk));
    }
    return scores;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

**Register:**
```typescript
import { createWoTProvider } from './providers';

// Option 1: Extend createWoTProvider factory
// Option 2: Pass custom provider instance directly to WoTPlugin
```

---

## UI Integration (Future)

### Toggle WoT Ranking

```javascript
// Search with WoT enabled
POST /api/search
{
  "query": "bitcoin",
  "user_pubkey": "abc123...",
  "wot_enabled": true
}

// Search without WoT
POST /api/search
{
  "query": "bitcoin",
  "wot_enabled": false
}
```

### Trust Level Filter

```javascript
POST /api/search
{
  "query": "bitcoin",
  "user_pubkey": "abc123...",
  "wot_filter": {
    "mode": "moderate",     // strict | moderate | open
    "min_score": 0.3
  }
}
```

**UI Component:**
```html
<div class="wot-controls">
  <label>
    <input type="checkbox" checked /> Enable WoT Ranking
  </label>
  <select>
    <option value="strict">Trusted Only (>0.7)</option>
    <option value="moderate" selected>Extended Network (>0.3)</option>
    <option value="open">All Content</option>
  </select>
</div>
```

---

## Performance

### Metrics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Cache hit | <1ms | In-memory lookup |
| NostrMaxi API call | 10-50ms | Network + calculation |
| Local calculation | 5-20ms | BFS traversal |
| Batch lookup (100 pubkeys) | 50-200ms | Single API call |

### Optimization Tips

1. **Increase cache TTL** for static WoT scores (e.g., 24 hours)
2. **Prefetch in background** for frequent users
3. **Use batch operations** when loading search results
4. **Monitor cache hit rate** (target: >85%)

---

## Troubleshooting

### WoT scores always 0.1

**Cause:** Provider not returning scores.

**Fix:**
1. Check NostrMaxi API health: `curl http://localhost:3000/health`
2. Verify Nostr connector indexed kind:3 events (local provider)
3. Check logs: `grep "WoT Plugin" logs/beacon.log`

### High search latency

**Cause:** Cache misses, slow provider.

**Fix:**
1. Increase `cache_ttl` to reduce API calls
2. Use batch prefetch before returning results
3. Monitor cache size (clean if >10K entries)

### Fallback to local provider

**Cause:** NostrMaxi unreachable.

**Fix:**
1. Check `NOSTRMAXI_URL` environment variable
2. Verify NostrMaxi service is running
3. Check network connectivity
4. Review NostrMaxi logs

---

## Future Enhancements

- [ ] **Redis Cache** - Shared cache across instances
- [ ] **WebSocket Updates** - Real-time WoT score updates
- [ ] **Multi-Hop Configuration** - Configurable max hops (3, 5, 7)
- [ ] **Trust Decay** - Time-based trust score decay
- [ ] **Negative Trust** - Downrank blocked/muted users
- [ ] **Trust Network Visualization** - D3.js graph in UI
- [ ] **A/B Testing** - Experiment with different weights

---

## Examples

See `wot-config.example.json` and `wot-config-local.example.json` for configuration examples.
