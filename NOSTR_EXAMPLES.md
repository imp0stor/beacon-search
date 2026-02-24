# Nostr Integration Examples

## Quick Start Examples

### 1. Index Q&A Events from Public Relays

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr Q&A Index",
    "description": "Index questions and answers from Nostr",
    "config": {
      "type": "nostr",
      "relays": [
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.nostr.band",
        "wss://nostr.wine"
      ],
      "kinds": [30400, 6400, 6401, 6402, 7400],
      "limit": 1000,
      "subscribeMode": false
    }
  }'

# Response:
# {"id": "connector-uuid", "name": "Nostr Q&A Index", ...}

# Run the connector
curl -X POST http://localhost:3001/api/connectors/<connector-uuid>/run

# Check status
curl http://localhost:3001/api/connectors/<connector-uuid>/status
```

### 2. Index Knowledge Base Articles

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr KB Articles",
    "description": "Index Nostr knowledge base articles",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io", "wss://nos.lol"],
      "kinds": [30023],
      "tags": {
        "t": ["nostr", "bitcoin", "tutorial"]
      },
      "limit": 500
    }
  }'
```

### 3. Index Podcast Content

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr Podcasts",
    "description": "Index podcast shows and episodes",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io"],
      "kinds": [30383, 30384],
      "limit": 200
    }
  }'
```

### 4. Live Subscription Mode

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Live Q&A Feed",
    "description": "Real-time Q&A event indexing",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io", "wss://nos.lol"],
      "kinds": [30400, 6400],
      "subscribeMode": true
    }
  }'
```

## Search Examples

### Basic Search

```bash
# Search all Nostr content
curl "http://localhost:3001/api/nostr/search?q=bitcoin+lightning&limit=20"

# Vector search (semantic)
curl "http://localhost:3001/api/nostr/search?q=how+to+setup+lightning+node&mode=vector&limit=10"

# Text search (keyword)
curl "http://localhost:3001/api/nostr/search?q=bitcoin+privacy&mode=text&limit=10"

# Hybrid search (default, best results)
curl "http://localhost:3001/api/nostr/search?q=nostr+relay+architecture&mode=hybrid&limit=20"
```

### Filtered Search

```bash
# Search only questions
curl "http://localhost:3001/api/nostr/search?q=lightning&kinds=30400&limit=20"

# Search KB articles about Bitcoin
curl "http://localhost:3001/api/nostr/search?q=bitcoin&kinds=30023&tags=bitcoin,tutorial&limit=20"

# Search podcast episodes
curl "http://localhost:3001/api/nostr/search?q=privacy&kinds=30384&limit=20"

# Search by category
curl "http://localhost:3001/api/nostr/search?q=&categories=qa,kb&limit=20"

# Multiple filters
curl "http://localhost:3001/api/nostr/search?q=bitcoin&kinds=30400,6400&categories=qa&tags=lightning,privacy&limit=20"
```

### Author & Tag Queries

```bash
# Get all events by a specific author
curl "http://localhost:3001/api/nostr/authors/<hex-pubkey>/events?limit=50"

# Get all events with a specific tag
curl "http://localhost:3001/api/nostr/tags/bitcoin/events?limit=50"

# Get event by ID
curl "http://localhost:3001/api/nostr/events/<event-id>"

# Get event by addressable reference
curl "http://localhost:3001/api/nostr/events/30400:<pubkey>:<d-tag>"
```

## JavaScript/TypeScript Examples

### Frontend Search with React

```javascript
import React, { useState } from 'react';
import NostrEventCard from './components/NostrEventCard';
import NostrFacets from './components/NostrFacets';

function NostrSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({});

  const search = async () => {
    const params = new URLSearchParams({
      q: query,
      limit: 20,
      ...filters
    });

    const response = await fetch(`/api/nostr/search?${params}`);
    const data = await response.json();
    setResults(data.results);
  };

  return (
    <div className="nostr-search">
      <NostrFacets onFilterChange={setFilters} />
      
      <input 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && search()}
        placeholder="Search Nostr content..."
      />
      
      <button onClick={search}>Search</button>
      
      <div className="results">
        {results.map(doc => (
          <NostrEventCard key={doc.id} document={doc} />
        ))}
      </div>
    </div>
  );
}
```

### Backend Integration

```typescript
import { SimplePool } from 'nostr-tools';
import { parseNostrEvent, normalizeNostrEvent } from './templates/nostr/parser';
import { getSearchableKinds } from './templates/nostr/kinds';

async function indexNostrEvents() {
  const pool = new SimplePool();
  const relays = ['wss://relay.damus.io', 'wss://nos.lol'];
  
  const events = await pool.querySync(relays, {
    kinds: getSearchableKinds(),
    limit: 100,
  });
  
  for (const event of events) {
    const parsed = parseNostrEvent(event);
    if (!parsed) continue;
    
    const normalized = normalizeNostrEvent(parsed);
    
    // Index in your search engine
    await indexDocument(normalized);
  }
  
  pool.close(relays);
}
```

### WoT-Weighted Search

```typescript
import { buildFollowGraph, calculateWoTScores } from './templates/nostr/wot';

async function searchWithWoT(query: string, myPubkey: string) {
  // 1. Fetch kind:3 contact lists
  const contactLists = await pool.querySync(relays, {
    kinds: [3],
    limit: 10000,
  });
  
  // 2. Build follow graph
  const graph = buildFollowGraph(contactLists);
  
  // 3. Search Nostr content
  const results = await searchNostrEvents(pool, query, {}, 50);
  
  // 4. Get unique authors
  const authors = [...new Set(results.map(r => r.attributes.pubkey))];
  
  // 5. Calculate WoT scores
  const wotScores = calculateWoTScores(authors, myPubkey, graph);
  
  // 6. Weight results
  const weighted = results.map(result => ({
    ...result,
    wotScore: wotScores.get(result.attributes.pubkey)?.score || 0.1,
    finalScore: result.score * 0.7 + (wotScores.get(result.attributes.pubkey)?.score || 0.1) * 0.3,
  }));
  
  // 7. Re-sort by final score
  weighted.sort((a, b) => b.finalScore - a.finalScore);
  
  return weighted;
}
```

## Use Cases

### 1. Bitcoin Developer Q&A Search

```bash
# Find unanswered Bitcoin development questions
curl "http://localhost:3001/api/nostr/search?q=&kinds=30400&tags=bitcoin,development&limit=50" \
  | jq '.results[] | select(.attributes.metadata.answered == false)'

# Find questions with bounties
curl "http://localhost:3001/api/nostr/search?q=&kinds=30400&limit=100" \
  | jq '.results[] | select(.attributes.metadata.bounty > 0)'
```

### 2. Nostr Tutorial Discovery

```bash
# Find KB articles tagged as tutorials
curl "http://localhost:3001/api/nostr/search?q=&kinds=30023&tags=tutorial&limit=30"

# Search for beginner content
curl "http://localhost:3001/api/nostr/search?q=getting+started&kinds=30023&tags=beginner,nostr&limit=20"
```

### 3. Podcast Episode Search

```bash
# Find episodes about a specific topic
curl "http://localhost:3001/api/nostr/search?q=bitcoin+privacy&kinds=30384&limit=20"

# Get latest episodes
curl "http://localhost:3001/api/nostr/search?q=&kinds=30384&limit=20"
```

### 4. Bounty Board

```bash
# Find open bounties
curl "http://localhost:3001/api/nostr/search?q=&kinds=37100&limit=50"

# Search bounties by keyword
curl "http://localhost:3001/api/nostr/search?q=nostr+client&kinds=37100&limit=20"
```

### 5. Content Creator Discovery

```bash
# Find top contributors in Q&A
curl "http://localhost:3001/api/nostr/stats" \
  | jq '.byKind[] | select(.kind == 30400) | .count'

# Get all content by an author
curl "http://localhost:3001/api/nostr/authors/<pubkey>/events?limit=100"
```

## Advanced Examples

### Custom Event Type Indexing

```typescript
// Add custom event kind to kinds.ts
export enum CustomKind {
  MY_EVENT = 12345,
}

// Add to registry
NOSTR_KIND_REGISTRY[12345] = {
  kind: 12345,
  name: 'My Custom Event',
  category: 'custom',
  description: 'My custom event type',
  replaceable: true,
  parameterized: true,
  template: 'my-event',
  searchable: true,
  icon: '🔥',
};

// Add parser
function parseMyEvent(event: Event): ParsedNostrEvent {
  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    title: getTag(event, 'title') || 'Untitled',
    content: event.content,
    tags: {
      d: [getTag(event, 'd') || ''],
    },
    metadata: {
      customField: getTag(event, 'custom'),
    },
    searchText: event.content,
    url: `nostr:${buildAddressable(event)}`,
  };
}

// Index custom events
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Events",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.example.com"],
      "kinds": [12345],
      "limit": 100
    }
  }'
```

### Time-Based Filtering

```bash
# Index only recent events (last 7 days)
SEVEN_DAYS_AGO=$(date -d '7 days ago' +%s)

curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Recent Q&A\",
    \"config\": {
      \"type\": \"nostr\",
      \"relays\": [\"wss://relay.damus.io\"],
      \"kinds\": [30400, 6400],
      \"since\": $SEVEN_DAYS_AGO,
      \"limit\": 500
    }
  }"
```

### Multi-Relay Strategy

```bash
# Index from specialized relays
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Multi-Relay Q&A",
    "config": {
      "type": "nostr",
      "relays": [
        "wss://relay.damus.io",      // General
        "wss://nos.lol",              // General
        "wss://relay.nostr.band",     // Aggregator
        "wss://purplepag.es",         // Long-form
        "wss://relay.snort.social"    // Community
      ],
      "kinds": [30400, 6400, 30023],
      "limit": 2000
    }
  }'
```

## API Response Examples

### Search Response

```json
{
  "query": "bitcoin lightning",
  "filters": {
    "kinds": [30400],
    "tags": ["bitcoin", "lightning"]
  },
  "mode": "hybrid",
  "count": 15,
  "results": [
    {
      "id": "doc-uuid",
      "title": "How to set up a Lightning node?",
      "content": "Full searchable content...",
      "url": "nostr:30400:pubkey:dtag",
      "score": 0.89,
      "attributes": {
        "nostr": true,
        "kind": 30400,
        "kindName": "Question",
        "kindCategory": "qa",
        "pubkey": "hex-pubkey",
        "created_at": 1707870000,
        "tags": {
          "topic": ["bitcoin", "lightning", "node"]
        },
        "metadata": {
          "bounty": 50000,
          "answered": true,
          "voteScore": 23,
          "addressable": "30400:pubkey:q-lightning-node"
        }
      }
    }
  ]
}
```

### Facets Response

```json
{
  "kinds": [
    { "kind": 30400, "name": "Question", "count": 1234 },
    { "kind": 6400, "name": "Answer", "count": 3456 },
    { "kind": 30023, "name": "KB Article", "count": 567 }
  ],
  "categories": [
    { "category": "qa", "count": 4690 },
    { "category": "kb", "count": 567 },
    { "category": "podcast", "count": 234 }
  ],
  "authors": [
    { "pubkey": "abc123...", "count": 45 },
    { "pubkey": "def456...", "count": 32 }
  ],
  "tags": [
    { "tag": "bitcoin", "count": 789 },
    { "tag": "nostr", "count": 654 },
    { "tag": "lightning", "count": 432 }
  ]
}
```

### Stats Response

```json
{
  "total": 5491,
  "byKind": [
    { "kind": 30400, "kind_name": "Question", "count": 1234 },
    { "kind": 6400, "kind_name": "Answer", "count": 3456 },
    { "kind": 30023, "kind_name": "KB Article", "count": 567 },
    { "kind": 30384, "kind_name": "Episode", "count": 234 }
  ],
  "byCategory": [
    { "category": "qa", "count": 4690 },
    { "category": "kb", "count": 567 },
    { "category": "podcast", "count": 234 }
  ]
}
```

## Testing

```bash
# 1. Create test connector
CONNECTOR_ID=$(curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Nostr",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io"],
      "kinds": [30400],
      "limit": 10
    }
  }' | jq -r '.id')

# 2. Run connector
curl -X POST "http://localhost:3001/api/connectors/$CONNECTOR_ID/run"

# 3. Wait and check status
sleep 5
curl "http://localhost:3001/api/connectors/$CONNECTOR_ID/status"

# 4. Verify indexed documents
curl "http://localhost:3001/api/documents?sourceId=$CONNECTOR_ID"

# 5. Test search
curl "http://localhost:3001/api/nostr/search?q=test&limit=5"

# 6. Check stats
curl "http://localhost:3001/api/nostr/stats"
```

## Error Handling

```javascript
async function safeNostrSearch(query, filters) {
  try {
    const response = await fetch(`/api/nostr/search?${buildParams(query, filters)}`);
    
    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid search query');
      } else if (response.status === 500) {
        throw new Error('Search service error');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
    
  } catch (error) {
    console.error('Nostr search failed:', error);
    return [];
  }
}
```

---

**More examples and use cases coming soon!**
