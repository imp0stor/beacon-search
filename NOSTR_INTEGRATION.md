# Nostr Integration for Beacon Search

## Overview

Beacon Search now includes **native Nostr support**, enabling you to index, search, and discover Nostr content across multiple event types with WoT-weighted ranking and faceted search.

## Supported Nostr Primitives

### Q&A Platform (nostr-qa)
- **Question** (30400): Questions with optional bounties
- **Answer** (6400): Answers to questions
- **Vote** (7400): Upvotes/downvotes with WoT weighting
- **Answer Acceptance** (6401): Accepted answers
- **Bounty Award** (6402): Bounty payments
- **Topic** (34400): Topic definitions
- **Comment** (1111): Comments on Q&A content

### Knowledge Base (nostr-kb)
- **KB Article** (30023): Documentation, guides, tutorials
  - Unbounded `doc_type` support
  - Custom attributes via `attr` tags
  - Markdown processing
  - Version management

### Studios (nostr-studio)
- **Studio Metadata** (31990): Studio profiles
- **Contributors** (30382): Contributor lists with roles

### Podcasting (nostr-podcast)
- **Show** (30383): Podcast/video show metadata
- **Episode** (30384): Episodes with chapters and timestamps
  - V4V (Value4Value) integration
  - Chapter markers

### Bounties (nostr-bounty)
- **Bounty** (37100): Lightning-native bounties
- **Bounty Claim** (37101): Bounty claims
- **Bounty Release** (37102): Payment releases

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Nostr Relays    │────▶│ Nostr Connector  │────▶│ Beacon Search   │
│ (Relay Pool)    │     │ - Event Parser   │     │ (PostgreSQL +   │
│                 │     │ - Normalizer     │     │  pgvector)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                        ┌──────┴──────┐
                        │  Templates  │
                        │  - Question │
                        │  - KB       │
                        │  - Episode  │
                        │  - Bounty   │
                        └─────────────┘
```

## Features

### 1. **Event Indexing**
- Automatic event parsing and normalization
- Extracts metadata, tags, and structured data
- Stores searchable text with full-text and vector indexes
- Handles replaceable/addressable events (NIP-33)

### 2. **Smart Templates**
Each event type has a custom renderer:

**Question Template:**
```
┌──────────────────────────────────────┐
│ ❓ Question                          │
│ ┌─────┐ 💰 500 sats ✓ Answered      │
│ │ +15 │                              │
│ └─────┘                              │
│ How does Nostr relay selection work? │
│ #nostr #relay #beginner              │
└──────────────────────────────────────┘
```

**KB Article Template:**
```
┌──────────────────────────────────────┐
│ 📖 KB Article                        │
│ [tutorial] v1.2.0                    │
│ Getting Started with Nostr           │
│ A comprehensive guide to...          │
│ #nostr #tutorial                     │
└──────────────────────────────────────┘
```

**Episode Template:**
```
┌──────────────────────────────────────┐
│ 🎧 Episode                           │
│ [IMAGE] Episode 42: Bitcoin Privacy  │
│         45:32 | 2 days ago           │
│ Chapters:                            │
│ • 0:00 - Intro                       │
│ • 5:30 - CoinJoin basics             │
│ • 23:15 - Lightning privacy          │
└──────────────────────────────────────┘
```

### 3. **Faceted Search**
Filter by:
- **Event Kind**: Questions, Articles, Episodes, etc.
- **Category**: qa, kb, podcast, studio, bounty
- **Author**: Filter by pubkey
- **Tags**: Topic tags (#bitcoin, #nostr, etc.)
- **WoT Score**: Filter by Web of Trust proximity

### 4. **WoT-Weighted Ranking**
Search results can be weighted by Web of Trust:
- Direct follows: 1.0 score
- Follow-of-follow: 0.5 score
- 3 degrees: 0.25 score
- Unknown: 0.1 score (default)

### 5. **Search Modes**
- **Vector**: Semantic similarity using embeddings
- **Text**: Full-text search with PostgreSQL
- **Hybrid**: Combines both (70% vector + 30% text)

## Usage

### Creating a Nostr Connector

**Via API:**
```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nostr Q&A Index",
    "description": "Index Q&A events from public relays",
    "config": {
      "type": "nostr",
      "relays": [
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.nostr.band"
      ],
      "kinds": [30400, 6400, 7400],
      "limit": 1000,
      "subscribeMode": false
    }
  }'
```

**One-time Sync:**
```javascript
{
  "subscribeMode": false,
  "limit": 1000  // Fetch 1000 events and stop
}
```

**Live Subscription:**
```javascript
{
  "subscribeMode": true  // Keep listening for new events
}
```

### Filtering by Author

```bash
curl -X POST http://localhost:3001/api/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice's Content",
    "config": {
      "type": "nostr",
      "relays": ["wss://relay.damus.io"],
      "authors": ["<alice-hex-pubkey>"],
      "kinds": [30023, 30400]
    }
  }'
```

### Filtering by Tags

```bash
{
  "config": {
    "type": "nostr",
    "relays": ["wss://relay.damus.io"],
    "kinds": [30400],
    "tags": {
      "t": ["bitcoin", "lightning"]
    }
  }
}
```

### Searching Nostr Content

**Basic Search:**
```bash
GET /api/nostr/search?q=how+to+setup+lightning&limit=20
```

**Filtered Search:**
```bash
GET /api/nostr/search?q=bitcoin&kinds=30400,6400&categories=qa&tags=lightning,privacy&limit=20
```

**By Author:**
```bash
GET /api/nostr/authors/<pubkey>/events?limit=50
```

**By Tag:**
```bash
GET /api/nostr/tags/bitcoin/events?limit=50
```

### API Endpoints

#### Nostr-Specific Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/nostr/kinds` | GET | List all supported event kinds |
| `/api/nostr/kinds/category/:cat` | GET | Get kinds by category |
| `/api/nostr/facets` | GET | Get available search facets |
| `/api/nostr/search` | GET | Search with filters |
| `/api/nostr/events/:ref` | GET | Get event by ID or addressable ref |
| `/api/nostr/authors/:pubkey/events` | GET | Get events by author |
| `/api/nostr/tags/:tag/events` | GET | Get events by tag |
| `/api/nostr/stats` | GET | Get Nostr indexing statistics |

#### General Search (includes Nostr)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | GET | Unified search (all sources) |
| `/api/documents` | GET | List all documents |
| `/api/connectors` | GET/POST | Manage connectors |

### Frontend Integration

**1. Import Nostr Components:**
```javascript
import NostrEventCard from './components/NostrEventCard';
import NostrFacets from './components/NostrFacets';
```

**2. Render Event Cards:**
```javascript
{results.map(doc => {
  if (doc.attributes?.nostr) {
    return <NostrEventCard key={doc.id} document={doc} />;
  }
  return <DocumentCard key={doc.id} document={doc} />;
})}
```

**3. Add Faceted Search:**
```javascript
<NostrFacets 
  onFilterChange={(filters) => setNostrFilters(filters)}
  apiUrl="http://localhost:3001"
/>
```

## Example Queries

### 1. Find Bitcoin Lightning Questions
```
Query: "How to set up Lightning node"
Filters: kinds=[30400], tags=[bitcoin, lightning]
```

### 2. Search KB Articles about Nostr
```
Query: "Nostr relay architecture"
Filters: kinds=[30023], categories=[kb]
```

### 3. Find Podcast Episodes about Privacy
```
Query: "Bitcoin privacy CoinJoin"
Filters: kinds=[30384], tags=[privacy, bitcoin]
```

### 4. Browse Open Bounties
```
Query: ""
Filters: kinds=[37100], metadata.status=open
```

## Event Kind Reference

| Kind | Category | Name | Searchable | Example Use Case |
|------|----------|------|------------|------------------|
| 30400 | qa | Question | ✅ | "How does Nostr work?" |
| 6400 | qa | Answer | ✅ | Detailed answer with code |
| 7400 | qa | Vote | ❌ | Upvote on answer |
| 30023 | kb | KB Article | ✅ | "Nostr Protocol Guide" |
| 31990 | studio | Studio | ✅ | "Bitcoin Podcast Network" |
| 30383 | podcast | Show | ✅ | "The Bitcoin Show" |
| 30384 | podcast | Episode | ✅ | "Episode 42: Privacy Tech" |
| 37100 | bounty | Bounty | ✅ | "Build Nostr client - 500k sats" |

## Configuration

### Environment Variables

```bash
# Add to .env
NOSTR_ENABLED=true
NOSTR_DEFAULT_RELAYS=wss://relay.damus.io,wss://nos.lol
NOSTR_WOT_ENABLED=true
NOSTR_WOT_MAX_HOPS=3
```

### Database Schema

Nostr events are stored as regular documents with enriched attributes:

```sql
{
  "id": "doc-uuid",
  "title": "How does Nostr relay selection work?",
  "content": "Full searchable text...",
  "attributes": {
    "nostr": true,
    "kind": 30400,
    "kindName": "Question",
    "kindCategory": "qa",
    "pubkey": "hex-pubkey",
    "created_at": 1707870000,
    "tags": {
      "topic": ["nostr", "relay"],
      "d": ["q-1707870000"]
    },
    "metadata": {
      "bounty": 10000,
      "voteScore": 15,
      "addressable": "30400:pubkey:d-tag"
    }
  }
}
```

## Advanced Features

### WoT Integration

To enable WoT-weighted search:

1. Index kind:3 contact lists:
```bash
{
  "config": {
    "type": "nostr",
    "relays": ["wss://relay.damus.io"],
    "kinds": [3],
    "limit": 10000
  }
}
```

2. Calculate WoT scores in search:
```javascript
import { buildFollowGraph, calculateWoTScores } from './templates/nostr/wot';

const graph = buildFollowGraph(contactLists);
const wotScores = calculateWoTScores(authorPubkeys, myPubkey, graph);
```

### Custom Event Kinds

To add support for custom event kinds:

1. Add to `kinds.ts`:
```typescript
[CustomKind.MY_EVENT]: {
  kind: 12345,
  name: 'My Event',
  category: 'custom',
  template: 'my-event',
  searchable: true,
  icon: '🔥',
}
```

2. Add parser in `parser.ts`:
```typescript
case CustomKind.MY_EVENT:
  return parseMyEvent(event);
```

3. Add template in frontend:
```javascript
const renderMyEvent = () => {
  return <div className="my-event">...</div>;
};
```

## Performance

### Indexing Performance
- **Events/second**: ~100-200 (with embeddings)
- **Relay connection**: Multiplexed via SimplePool
- **Embedding generation**: Batched for efficiency

### Search Performance
- **Vector search**: <100ms for 10k documents
- **Hybrid search**: <150ms for 10k documents
- **Faceted search**: <50ms overhead

### Optimization Tips

1. **Limit indexed kinds**: Only index event types you need
2. **Use time filters**: Set `since` to avoid reindexing old events
3. **Batch indexing**: Run connectors off-peak hours
4. **Enable caching**: Use Redis for facet caching (future)

## Troubleshooting

### "No events found"
- Check relay connectivity
- Verify event kinds exist on relay
- Try different relays (relay.nostr.band, nos.lol)

### "Slow indexing"
- Reduce `limit` or add `since` timestamp
- Use fewer relays
- Disable `subscribeMode` for one-time sync

### "Missing metadata"
- Some events may not have all tags
- Parser handles missing fields gracefully
- Check event structure in relay

## Example Searches

### Find Unanswered Questions with Bounties
```bash
GET /api/nostr/search?q=&kinds=30400&limit=50
# Filter client-side: metadata.bounty > 0 && !metadata.answered
```

### Top Bitcoin Content Creators
```bash
GET /api/nostr/authors
# Sort by document count
```

### Latest Podcast Episodes
```bash
GET /api/nostr/search?kinds=30384&limit=20
# Sorted by created_at DESC
```

## Roadmap

- [ ] WoT-weighted search UI toggle
- [ ] Relay health monitoring
- [ ] Event thread reconstruction (replies)
- [ ] Zap integration (display zap counts)
- [ ] NIP-50 relay search (offload to relay)
- [ ] Real-time updates via subscriptions
- [ ] Event mentions/replies rendering
- [ ] Profile metadata enrichment

## Credits

Built with:
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) - Nostr protocol library
- [@strangesignal/nostr-qa](../nostr-qa) - Q&A primitive
- [@strangesignal/nostr-kb](../nostr-kb) - KB primitive
- [@strangesignal/nostr-studio](../nostr-studio) - Studio primitive
- [@strangesignal/nostr-podcast](../nostr-podcast) - Podcast primitive
- [@strangesignal/nostr-bounty](../nostr-bounty) - Bounty primitive

## Support

- Issues: [GitHub Issues](https://github.com/strangesignal/beacon-search/issues)
- Nostr: npub[TBD]
- Docs: [README.md](./README.md)

---

**Make Beacon Search Nostr-native. 🚀⚡**
