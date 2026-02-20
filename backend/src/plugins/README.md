# Beacon Search Plugin System

**Status:** ✅ Implemented  
**Version:** 1.0.0

---

## Overview

The Plugin System allows extending Beacon Search functionality without modifying core code. Plugins can hook into search ranking, document indexing, connector execution, and add custom routes.

---

## Architecture

```
plugins/
├── types.ts          # Plugin interfaces
├── manager.ts        # Plugin lifecycle management
├── index.ts          # Public exports
├── wot/              # Web of Trust plugin
│   ├── index.ts      # WoT plugin implementation
│   ├── nostrmaxi-client.ts  # NostrMaxi API client
│   └── README.md     # WoT plugin docs
└── README.md         # This file
```

---

## Plugin Interface

```typescript
export interface Plugin {
  name: string;
  version: string;
  description: string;
  
  // Lifecycle hooks
  init?(context: PluginContext): Promise<void>;
  destroy?(): Promise<void>;
  
  // Search hooks
  modifySearchScore?(doc: SearchDocument, query: SearchQuery, baseScore: number): Promise<number>;
  
  // Indexing hooks
  beforeIndex?(doc: any): Promise<any>;
  afterIndex?(doc: any): Promise<void>;
  
  // Connector hooks
  beforeConnect?(connector: any): Promise<void>;
  afterConnect?(connector: any, results: any): Promise<void>;
  
  // Custom routes
  routes?: PluginRoute[];
}
```

---

## Creating a Plugin

### 1. Basic Plugin Structure

```typescript
import { Plugin, PluginContext } from '../types';

export class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My custom plugin';

  async init(context: PluginContext): Promise<void> {
    context.logger.info('MyPlugin initialized');
  }

  async modifySearchScore(doc: any, query: any, baseScore: number): Promise<number> {
    // Custom scoring logic
    return baseScore * 1.2; // Example: 20% boost
  }
}
```

### 2. Register Plugin

```typescript
import { PluginManager } from './plugins';
import { MyPlugin } from './plugins/my-plugin';

const pluginManager = new PluginManager(context);
pluginManager.register(new MyPlugin());
await pluginManager.initAll();
```

---

## Built-in Plugins

### WoT Plugin (Web of Trust)

**Purpose:** Integrate Nostr Web of Trust scores into search ranking.

**Features:**
- Fetches WoT scores from NostrMaxi API
- Boosts search results from trusted sources (up to 2x)
- In-memory caching (1-hour TTL)
- Batch API calls for performance

**Usage:**
```typescript
import { WoTPlugin } from './plugins/wot';

pluginManager.register(new WoTPlugin());
```

**Environment:**
```bash
NOSTRMAXI_URL=http://localhost:3000  # NostrMaxi API endpoint
```

**Effect:**
```
Base search score: 0.75
WoT score: 0.85 (trusted user)
Multiplier: 1.85x
Final score: 0.75 * 1.85 = 1.3875
```

---

## Plugin Hooks

### `init(context)`
Called once on server startup.

**Use cases:**
- Connect to external services
- Load configuration
- Initialize caches

### `modifySearchScore(doc, query, baseScore)`
Modify search relevance score.

**Use cases:**
- Boost/demote based on metadata
- Integrate external ranking signals (WoT, pagerank, etc.)
- User-specific personalization

**Example:**
```typescript
async modifySearchScore(doc, query, baseScore) {
  if (doc.source === 'nostr' && query.user_pubkey) {
    const wotScore = await getWoTScore(query.user_pubkey, doc.author_pubkey);
    return baseScore * (1 + wotScore);
  }
  return baseScore;
}
```

### `beforeIndex(doc)` / `afterIndex(doc)`
Intercept document indexing.

**Use cases:**
- Enrich documents with external data
- Trigger webhooks
- Update external systems

### `routes`
Add custom HTTP routes.

**Example:**
```typescript
routes = [
  {
    method: 'GET',
    path: '/api/plugin/my-route',
    handler: async (req, res) => {
      res.json({ message: 'Hello from plugin!' });
    },
  },
];
```

---

## Plugin Context

Plugins receive a `PluginContext` object with access to:

```typescript
interface PluginContext {
  db: any;            // Database connection
  config: any;        // Server configuration
  logger: Logger;     // Logging interface
  cache: CacheClient; // Redis/memory cache
}
```

---

## Best Practices

### 1. Error Handling
Always wrap plugin logic in try/catch to prevent breaking core functionality.

```typescript
async modifySearchScore(doc, query, baseScore) {
  try {
    return await myCustomLogic(doc, query, baseScore);
  } catch (error) {
    context.logger.error(`Plugin error: ${error.message}`);
    return baseScore; // Fallback to original score
  }
}
```

### 2. Performance
- Cache aggressively (avoid repeated API calls)
- Use batch operations when possible
- Clean up resources in `destroy()`

### 3. Isolation
- Don't modify core objects directly
- Return new objects from hooks
- Use namespaced cache keys (`plugin:name:key`)

---

## Testing

### Unit Tests
```typescript
describe('MyPlugin', () => {
  it('should boost scores correctly', async () => {
    const plugin = new MyPlugin();
    const doc = { source: 'nostr', author_pubkey: 'abc' };
    const query = { text: 'test', user_pubkey: 'def' };
    const score = await plugin.modifySearchScore(doc, query, 0.5);
    expect(score).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests
Test plugin with full PluginManager lifecycle.

---

## Future Plugins (Ideas)

- **PageRank Plugin:** Boost based on backlink count
- **Freshness Plugin:** Boost recent content
- **Language Plugin:** Detect/filter by language
- **Spam Filter Plugin:** ML-based spam detection
- **Personalization Plugin:** User preference learning
- **Analytics Plugin:** Track search metrics
- **A/B Testing Plugin:** Experiment with ranking algorithms

---

## Examples

See `wot/` directory for a complete plugin example.
