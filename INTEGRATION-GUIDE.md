# Beacon Search - Integration Guide

**Beacon Search as Infrastructure for Strange Signal Products**

---

## Overview

Beacon Search provides **unified search capabilities** across all Strange Signal products. Instead of building separate search for each application, integrate with Beacon Search's API for:

- Consistent search experience
- Shared infrastructure (one database, one embedding model)
- Cross-product search (search across NostrCast + NostrMaxi + Fragstr simultaneously)
- Advanced features (RAG, semantic search, NLP) out of the box

---

## Integration Options

### 1. Direct API Integration

**Use Case:** Add search to existing application

**Pros:**
- Simple HTTP requests
- No dependencies
- Works with any stack (Node.js, Python, Go, Rust, etc.)

**Example:**
```javascript
// Add search to your app
const results = await fetch('http://search-api/search?q=bitcoin&limit=10')
  .then(r => r.json());
```

---

### 2. JavaScript SDK (Planned)

**Use Case:** Type-safe integration for Node.js/TypeScript apps

```javascript
import { BeaconSearchClient } from '@strangesignal/beacon-search';

const search = new BeaconSearchClient('http://localhost:3001');

const results = await search.query('bitcoin', {
  limit: 10,
  mode: 'hybrid'
});
```

---

### 3. Embedded Search Widget (Future)

**Use Case:** Drop-in search UI component

```html
<beacon-search-widget 
  api-url="http://localhost:3001"
  placeholder="Search podcasts..."
  limit="5"
></beacon-search-widget>
```

---

## Product-Specific Integration

### NostrCast Integration

**Goal:** Search podcast episodes, shows, transcripts

#### 1. Index Podcast Data

```javascript
// After publishing new episode
async function indexEpisode(episode) {
  await fetch('http://localhost:3001/api/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: episode.title,
      content: episode.description + ' ' + episode.transcript,
      url: `https://nostrcast.app/episodes/${episode.id}`,
      metadata: {
        show: episode.showName,
        author: episode.author,
        published: episode.publishedAt,
        duration: episode.duration,
        tags: episode.tags
      }
    })
  });
}
```

#### 2. Add Search to Frontend

```javascript
// React component
function PodcastSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const search = async () => {
    const response = await fetch(
      `http://localhost:3001/api/search?q=${encodeURIComponent(query)}&limit=10`
    );
    const data = await response.json();
    setResults(data.results);
  };

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={search}>Search</button>
      {results.map(r => (
        <PodcastResult key={r.id} {...r} />
      ))}
    </div>
  );
}
```

#### 3. Use RAG for "Ask About Episode"

```javascript
// AI-powered Q&A
async function askAboutEpisode(question, episodeId) {
  const response = await fetch('http://localhost:3001/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      context: { episode_id: episodeId }
    })
  });
  
  const data = await response.json();
  return data.answer;
}

// Example usage
const answer = await askAboutEpisode(
  "What did they say about Bitcoin?",
  "episode-123"
);
```

---

### NostrMaxi Integration

**Goal:** Search NIP-05 identities, WoT data, Nostr events

#### 1. Index Nostr Events

```javascript
// Index user profiles (kind 0)
async function indexNostrProfile(event) {
  const profile = JSON.parse(event.content);
  
  await fetch('http://localhost:3001/api/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: profile.name || profile.display_name,
      content: `${profile.about} ${profile.nip05}`,
      url: `https://nostrmaxi.com/profile/${event.pubkey}`,
      metadata: {
        pubkey: event.pubkey,
        nip05: profile.nip05,
        lud16: profile.lud16,
        kind: event.kind
      }
    })
  });
}
```

#### 2. WoT-Aware Search

```javascript
// Search with Web of Trust ranking
async function searchIdentities(query, userPubkey) {
  const response = await fetch(
    `http://localhost:3001/api/search?q=${query}&user_pubkey=${userPubkey}`
  );
  
  const data = await response.json();
  
  // Results are automatically boosted based on WoT
  return data.results;
}
```

#### 3. NIP-05 Lookup with Search

```javascript
// Find NIP-05 identities
async function searchNIP05(name) {
  const response = await fetch(
    `http://localhost:3001/api/search?q=${name}&mode=hybrid&limit=10`
  );
  
  const data = await response.json();
  
  // Filter for NIP-05 results
  return data.results.filter(r => r.metadata?.nip05);
}
```

---

### Fragstr Integration

**Goal:** Search games, servers, content

#### 1. Index Game Catalog

```javascript
// Index game metadata
async function indexGame(game) {
  await fetch('http://localhost:3001/api/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: game.name,
      content: `${game.description} ${game.genre} ${game.platform}`,
      url: `https://fragstr.network/games/${game.slug}`,
      metadata: {
        genre: game.genre,
        platform: game.platform,
        year: game.releaseYear,
        players: game.maxPlayers,
        tags: game.tags
      }
    })
  });
}
```

#### 2. Search Games by Genre/Platform

```javascript
// Faceted game search
async function searchGames(query, filters = {}) {
  const url = new URL('http://localhost:3001/api/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', 20);
  
  const response = await fetch(url);
  const data = await response.json();
  
  // Client-side filtering (server-side facets coming soon)
  let results = data.results;
  
  if (filters.genre) {
    results = results.filter(r => r.metadata?.genre === filters.genre);
  }
  
  if (filters.platform) {
    results = results.filter(r => r.metadata?.platform === filters.platform);
  }
  
  return results;
}

// Usage
const fpsgames = await searchGames('multiplayer', { genre: 'FPS' });
```

---

## Cross-Product Search

**Search across ALL Strange Signal products at once:**

```javascript
async function unifiedSearch(query) {
  const response = await fetch(
    `http://localhost:3001/api/search?q=${query}&limit=30`
  );
  
  const data = await response.json();
  
  // Group results by source
  const grouped = {
    podcasts: [],
    identities: [],
    games: [],
    other: []
  };
  
  data.results.forEach(result => {
    const url = result.url || '';
    if (url.includes('nostrcast')) {
      grouped.podcasts.push(result);
    } else if (url.includes('nostrmaxi')) {
      grouped.identities.push(result);
    } else if (url.includes('fragstr')) {
      grouped.games.push(result);
    } else {
      grouped.other.push(result);
    }
  });
  
  return grouped;
}

// Example
const results = await unifiedSearch('bitcoin');
console.log('Podcasts:', results.podcasts.length);
console.log('Identities:', results.identities.length);
console.log('Games:', results.games.length);
```

---

## Deployment Architectures

### Option 1: Shared Search Instance

```
┌─────────────┐
│ NostrCast   │────┐
└─────────────┘    │
                   │    ┌─────────────────┐
┌─────────────┐    ├───→│ Beacon Search   │
│ NostrMaxi   │────┤    │  (Shared API)   │
└─────────────┘    │    └─────────────────┘
                   │
┌─────────────┐    │
│ Fragstr     │────┘
└─────────────┘
```

**Pros:**
- Single database
- Shared infrastructure
- Cross-product search
- Unified admin/monitoring

**Cons:**
- Single point of failure
- Shared resource limits

---

### Option 2: Per-Product Instances

```
┌─────────────┐    ┌─────────────────┐
│ NostrCast   │───→│ Beacon Search   │
└─────────────┘    │  (NostrCast)    │
                   └─────────────────┘

┌─────────────┐    ┌─────────────────┐
│ NostrMaxi   │───→│ Beacon Search   │
└─────────────┘    │  (NostrMaxi)    │
                   └─────────────────┘
```

**Pros:**
- Isolated failures
- Per-product scaling
- Custom configurations

**Cons:**
- Duplicate infrastructure
- No cross-product search

---

### Option 3: Hybrid (Recommended)

```
┌─────────────┐    ┌─────────────────┐
│ NostrCast   │───→│ Beacon Search   │
└─────────────┘    │  (Primary)      │←─── Public API
                   └─────────────────┘
┌─────────────┐    ┌─────────────────┐
│ NostrMaxi   │───→│ Beacon Search   │
└─────────────┘    │  (Primary)      │←─── Public API
                   └─────────────────┘
┌─────────────┐    ┌─────────────────┐
│ Fragstr     │───→│ Beacon Search   │
└─────────────┘    │  (Dedicated)    │←─── Gaming-specific
                   └─────────────────┘
```

**Pros:**
- Most products share primary instance
- High-load products get dedicated instances
- Cross-product search available
- Scaling flexibility

---

## Best Practices

### 1. Index Incrementally

```javascript
// ✅ Good: Index as content is created
app.post('/api/podcasts', async (req, res) => {
  const podcast = await savePodcast(req.body);
  await indexInBeaconSearch(podcast);  // Index immediately
  res.json(podcast);
});

// ❌ Bad: Batch index later (causes lag)
```

### 2. Update Indexes on Content Changes

```javascript
// ✅ Good: Update search index when content changes
app.patch('/api/podcasts/:id', async (req, res) => {
  const podcast = await updatePodcast(id, req.body);
  await updateBeaconSearchIndex(podcast);  // Keep in sync
  res.json(podcast);
});
```

### 3. Delete from Index on Content Removal

```javascript
// ✅ Good: Remove from search when deleted
app.delete('/api/podcasts/:id', async (req, res) => {
  await deletePodcast(id);
  await deleteFromBeaconSearch(id);  // Clean up index
  res.status(204).send();
});
```

### 4. Use Metadata for Facets

```javascript
// ✅ Good: Rich metadata enables filtering
const metadata = {
  author: podcast.author,
  category: podcast.category,
  tags: podcast.tags,
  duration: podcast.duration,
  published: podcast.publishedAt
};
```

### 5. Provide Deep Links

```javascript
// ✅ Good: URL points to specific content
{
  url: `https://nostrcast.app/shows/${show.id}/episodes/${episode.id}`
}

// ❌ Bad: Generic URLs
{
  url: `https://nostrcast.app`
}
```

---

## Monitoring & Debugging

### Health Checks

```javascript
// Periodic health check
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    
    if (data.status !== 'ok') {
      console.error('Beacon Search degraded:', data);
      // Alert monitoring system
    }
  } catch (error) {
    console.error('Beacon Search unreachable:', error);
    // Failover or alert
  }
}, 60000);  // Every minute
```

### Search Analytics

```javascript
// Track search usage
async function trackSearch(query, userId) {
  // Your analytics
  analytics.track('search', {
    query,
    userId,
    timestamp: Date.now()
  });
  
  // Perform search
  return await fetch(`/api/search?q=${query}`);
}
```

---

## Security Considerations

### 1. Validate User Input

```javascript
// ✅ Good: Sanitize and validate
function sanitizeQuery(query) {
  return query.trim().slice(0, 200);  // Max length
}

const cleanQuery = sanitizeQuery(userInput);
const results = await search(cleanQuery);
```

### 2. Rate Limiting (Client-Side)

```javascript
// ✅ Good: Debounce to reduce server load
import { debounce } from 'lodash';

const debouncedSearch = debounce(async (query) => {
  const results = await fetch(`/api/search?q=${query}`);
  // Update UI
}, 300);  // Wait 300ms after user stops typing
```

### 3. HTTPS in Production

```javascript
// ✅ Good: HTTPS for production
const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://search.strangesignal.com'
  : 'http://localhost:3001';
```

---

## Troubleshooting

### Search Returns No Results

**Causes:**
1. Content not indexed
2. Query too specific
3. Embeddings not generated

**Solution:**
```bash
# Verify content indexed
curl "http://localhost:3001/api/search?q=*&limit=1"

# Check database
psql -U beacon -d beacon_search -c "SELECT COUNT(*) FROM documents;"
```

### Slow Search Performance

**Causes:**
1. Large result set
2. Complex queries
3. Database not indexed

**Solution:**
```javascript
// Use smaller limits
const results = await fetch('/api/search?q=test&limit=5');  // Instead of 100

// Use text mode for simple searches
const results = await fetch('/api/search?q=test&mode=text');  // Faster
```

### Integration Returns Errors

**Causes:**
1. Incorrect API URL
2. Malformed requests
3. Network issues

**Solution:**
```javascript
// Add error handling
try {
  const response = await fetch('http://localhost:3001/api/search?q=test');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  console.error('Search failed:', error);
  // Show error to user or use cached results
}
```

---

## Example: Complete NostrCast Integration

```javascript
// services/search.js
import axios from 'axios';

const BEACON_SEARCH_URL = process.env.BEACON_SEARCH_URL || 'http://localhost:3001';

class SearchService {
  async indexEpisode(episode) {
    await axios.post(`${BEACON_SEARCH_URL}/api/index`, {
      title: episode.title,
      content: `${episode.description} ${episode.transcript || ''}`,
      url: `https://nostrcast.app/episodes/${episode.id}`,
      metadata: {
        type: 'episode',
        show: episode.showId,
        author: episode.authorPubkey,
        published: episode.publishedAt,
        duration: episode.duration,
        tags: episode.tags
      }
    });
  }

  async searchEpisodes(query, options = {}) {
    const { limit = 10, mode = 'hybrid' } = options;
    
    const response = await axios.get(`${BEACON_SEARCH_URL}/api/search`, {
      params: { q: query, limit, mode }
    });
    
    return response.data.results.filter(r => r.metadata?.type === 'episode');
  }

  async askAboutEpisode(question, episodeId) {
    const response = await axios.post(`${BEACON_SEARCH_URL}/api/ask`, {
      question,
      context: { episode_id: episodeId }
    });
    
    return response.data.answer;
  }

  async deleteEpisode(episodeId) {
    await axios.delete(`${BEACON_SEARCH_URL}/api/documents/${episodeId}`);
  }
}

export default new SearchService();
```

```javascript
// routes/episodes.js
import searchService from '../services/search.js';

// Create episode
router.post('/episodes', async (req, res) => {
  const episode = await db.createEpisode(req.body);
  
  // Index in Beacon Search
  await searchService.indexEpisode(episode);
  
  res.json(episode);
});

// Search episodes
router.get('/search', async (req, res) => {
  const { q } = req.query;
  const results = await searchService.searchEpisodes(q);
  res.json(results);
});

// Ask about episode
router.post('/episodes/:id/ask', async (req, res) => {
  const { question } = req.body;
  const answer = await searchService.askAboutEpisode(question, req.params.id);
  res.json({ answer });
});
```

---

## Next Steps

1. **Deploy Beacon Search** - See `DEPLOYMENT.md`
2. **Index Your Content** - Use `/api/index` endpoint
3. **Add Search UI** - Integrate search bar in your frontend
4. **Test Integration** - Verify search returns expected results
5. **Monitor Performance** - Track usage and optimize as needed

---

**Questions?** See `API-REFERENCE.md` or contact the Strange Signal team.
