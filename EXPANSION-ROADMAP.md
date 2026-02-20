# Beacon Search - Expansion Roadmap

## Vision: Multi-Source Knowledge Index

Transform Beacon from Nostr-only search into a comprehensive knowledge search engine indexing multiple high-value data sources.

## Current State
- ✅ Nostr events (4,405 indexed)
- ✅ Adaptive relay discovery
- ✅ Content classification (notes, articles, drafts, etc.)

## Expansion Targets

### 1. Content Type Filtering (Priority: HIGH)
**Problem:** Can't filter search results by content type
**Solution:** Add filterable content type taxonomy

**Categories:**
- `nostr` - All Nostr events
  - `nostr:note` - Short-form posts (kind 1)
  - `nostr:article` - Long-form (kind 30023)
  - `nostr:draft` - Drafts (kind 30024)
  - `nostr:file` - File metadata
  - `nostr:video` - Video metadata
- `github` - GitHub repositories
  - `github:repo` - Repository info
  - `github:issue` - Issues
  - `github:pr` - Pull requests
  - `github:readme` - README files
  - `github:code` - Source code
- `docs` - Technical documentation
  - `docs:api` - API docs
  - `docs:tutorial` - Tutorials
  - `docs:reference` - Reference docs
- `stackoverflow` - Stack Overflow Q&A
- `libraries` - Free knowledge libraries
  - `library:book` - Books
  - `library:paper` - Academic papers
  - `library:course` - Course materials

**Implementation:**
- Add `content_type` column to documents table
- Add category hierarchy (parent_type, sub_type)
- Add filter UI in Beacon frontend
- Support multi-select filtering

### 2. GitHub Integration (Priority: HIGH)
**Why:** Rich technical content, Nostr protocol repos, code search

**What to index:**
- Nostr protocol repositories (nostr-protocol, NIPs, implementations)
- README files (high signal-to-noise)
- Issues (technical discussions)
- Pull requests (changes, rationale)
- Wiki pages
- Code snippets (selective, high-value functions)

**API:**
- GitHub REST API (5,000 req/hour authenticated)
- GitHub GraphQL API (more efficient)

**Targets:**
1. **Nostr ecosystem** (~100 repos):
   - nostr-protocol/nostr
   - nostr-protocol/nips
   - nostr-dev-kit/nostr-sdk
   - fiatjaf/nostr-tools
   - damus-io/damus
   - (all major Nostr projects)

2. **High-value tech repos** (selective):
   - Bitcoin Core
   - Lightning Network implementations
   - Privacy tools (Tor, etc.)
   - Decentralization projects

**Spider strategy:**
- Start with Nostr repos
- Expand to related projects (Bitcoin, Lightning)
- Rate limit: 100 repos/day (stay under API limits)

### 3. Technical Documentation (Priority: MEDIUM)
**Why:** High-quality structured knowledge

**Targets:**
- Nostr NIP documentation (already in GitHub)
- Bitcoin documentation
- Lightning Network specs
- Protocol documentation (HTTP, WebSocket, etc.)
- Major framework docs (React, Vue, etc.)

**Sources:**
- ReadTheDocs.org
- docs.rs (Rust docs)
- MDN Web Docs
- Developer portals

**Spider strategy:**
- Sitemap-based crawling
- Respect robots.txt
- Extract structured content (headers, code blocks)

### 4. Stack Exchange (Priority: MEDIUM)
**Why:** High-quality Q&A, expert knowledge

**Targets:**
- Stack Overflow (programming)
- Bitcoin Stack Exchange
- Information Security Stack Exchange
- Cryptography Stack Exchange

**API:**
- Stack Exchange API (10,000 req/day)
- Archive dumps (quarterly)

**Data:**
- Questions (title, body, tags)
- Accepted answers
- High-voted answers (>10 votes)

**Spider strategy:**
- Use API for recent content
- Download quarterly dumps for bulk indexing
- Index only high-quality Q&A (score > threshold)

### 5. Free Knowledge Libraries (Priority: LOW)
**Why:** Academic/educational content

**Targets:**
- arXiv.org (academic papers)
- Project Gutenberg (public domain books)
- Khan Academy (educational content)
- MIT OpenCourseWare
- Wikipedia (selective, high-quality articles)

**Considerations:**
- Massive volume (arXiv alone has 2M+ papers)
- Requires selective indexing strategy
- Focus on relevant topics (crypto, networks, CS)

### 6. Social Platforms (Priority: LOW)
**Why:** Real-time discussions, trends

**Potential targets:**
- Bluesky (open protocol)
- Farcaster (decentralized social)
- Mastodon (federated)

**Considerations:**
- Noisy data (high spam risk)
- Privacy concerns
- Rate limits
- Unclear value vs Nostr

## Data Volume Estimates

**Current:** 4,405 Nostr events (~10 MB)

**Projected:**
- Nostr (1 year growth): 500k events (~1 GB)
- GitHub (100 repos): 50k documents (~500 MB)
- Technical docs: 100k pages (~2 GB)
- Stack Exchange: 500k Q&A pairs (~5 GB)
- Libraries (selective): 100k items (~10 GB)

**Total potential:** ~20 GB indexed content, 1M+ documents

**Database requirements:**
- PostgreSQL + pgvector: Can handle 10M+ documents
- Current setup: Sufficient for 1M documents
- May need partitioning at 5M+ documents

## Implementation Priority

### Phase 1: Foundation (Weeks 1-2)
1. ✅ Content type taxonomy
2. ✅ Filter UI
3. ✅ Content type classification

### Phase 2: GitHub (Weeks 3-4)
1. GitHub API integration
2. Repository spider
3. README + Issue indexing
4. Nostr ecosystem repos first

### Phase 3: Documentation (Weeks 5-6)
1. Documentation spider
2. Structured content extraction
3. NIP docs integration

### Phase 4: Stack Exchange (Weeks 7-8)
1. Stack Exchange API integration
2. Q&A indexing
3. Quality filtering

### Phase 5: Expansion (Ongoing)
1. Academic papers (arXiv)
2. Free books (Gutenberg)
3. Social platforms (evaluate value)

## Spider Infrastructure

### Respect & Rate Limiting
- Robots.txt compliance
- API rate limiting
- Polite crawling (delays, user agent)
- No aggressive spidering

### Quality Control
- Spam filtering (expanded beyond Nostr)
- Quality scoring (upvotes, stars, citations)
- Duplicate detection (cross-source)
- Content relevance scoring

### Scalability
- Distributed crawling (multiple workers)
- Job queue (BullMQ already in place)
- Incremental updates (delta crawling)
- Pause/resume capability

## Search Experience

### Multi-Source Results
Show source badges on results:
- 🟣 Nostr
- 🐙 GitHub
- 📚 Docs
- 💬 Stack Overflow
- 📖 Library

### Source Filtering
- "Search in: [All] [Nostr] [GitHub] [Docs] [Q&A]"
- Multi-select checkboxes
- URL parameters for deep linking

### Result Ranking
Weight by source quality:
1. Technical docs (highest signal)
2. GitHub repos (code + issues)
3. Stack Overflow (verified answers)
4. Nostr (community content)
5. Libraries (reference material)

## Next Actions

1. **Content type filtering** (sub-agent already spawned)
2. **Create GitHub spider** (next priority)
3. **Evaluate arXiv integration** (massive potential)
4. **Test scalability** (how far can we push pgvector?)

## Open Questions

1. **Storage costs**: How much disk space are we willing to dedicate?
2. **Update frequency**: How often to re-crawl each source?
3. **Compute costs**: Can we handle 1M+ documents on current infrastructure?
4. **Legal**: Any licensing issues with indexing (fair use vs ToS)?

## Success Metrics

- **Indexed documents**: 1M+ (target)
- **Search quality**: <1s response time
- **Coverage**: All major Nostr repos + Bitcoin/Lightning docs
- **User engagement**: Clicks to external sources, repeat searches

---

**Vision:** Make Beacon the go-to search engine for decentralized tech, Bitcoin, Lightning, and Nostr ecosystem knowledge. A Wikipedia-meets-Google for the sovereign internet. 🔦
