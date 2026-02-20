# Beacon Search - Product Documentation

**Version:** 2.0  
**Last Updated:** 2026-02-13  
**Audience:** End Users, Product Managers, Integration Partners

---

## 📖 Table of Contents

1. [What is Beacon Search?](#what-is-beacon-search)
2. [Getting Started](#getting-started)
3. [Search Interface Guide](#search-interface-guide)
4. [Content Type Filtering](#content-type-filtering)
5. [Nostr Integration](#nostr-integration)
6. [GitHub Search](#github-search-coming-soon)
7. [Advanced Search Tips](#advanced-search-tips)
8. [Product Integrations](#product-integrations)
9. [FAQ](#faq)

---

## What is Beacon Search?

**Beacon Search** is a multi-source semantic search platform that helps you find information across Nostr events, GitHub repositories, technical documentation, Q&A sites, and knowledge libraries.

### Key Features

🔍 **Semantic Search** - Understands meaning, not just keywords  
📚 **Multi-Source** - Search across Nostr, GitHub, docs, and more  
🏷️ **Smart Filtering** - Filter by content type, source, tags  
🌐 **Web of Trust** - Nostr results ranked by your trust network  
⚡ **Lightning Fast** - Sub-200ms search responses  
🎨 **Clean UI** - Cyberpunk/brutalist design, distraction-free

### Who is it for?

- **Nostr Users** - Search Nostr content with WoT filtering
- **Developers** - Find code, issues, and documentation
- **Researchers** - Search papers, specs, and expert Q&A
- **Knowledge Workers** - Unified search across multiple sources

---

## Getting Started

### Access Beacon Search

**Live Instance:** http://10.1.10.143:3002 (or your deployed URL)

### Quick Start

1. **Open Beacon Search** in your browser
2. **Type your query** in the search bar
3. **Choose search mode:**
   - 🔄 **Hybrid** - Best of semantic + keyword (recommended)
   - 📝 **Keyword** - Traditional full-text search
   - ⚖️ **Semantic** - Meaning-based vector search
4. **Filter results** using the sidebar
5. **Click a result** to expand and read full content

### First Search Example

**Query:** `nostr relay setup`

**Results:**
- Long-form articles about running relays
- Short notes with tips and tricks
- Protocol documentation (NIPs)
- Code examples from GitHub

**Filters:**
- Content Type: Nostr articles, notes
- Tags: nostr, relay, guide
- Source: Specific relays

---

## Search Interface Guide

### Search Bar

```
┌──────────────────────────────────────────────────────────┐
│  🔍  Search across 315 documents...                      │
└──────────────────────────────────────────────────────────┘
```

- **Auto-focus:** Search bar is ready when page loads
- **Instant results:** Results appear as you type
- **Query suggestions:** Common queries suggested

### Search Modes

**1. Hybrid Search** (Default, Recommended)
- Combines semantic understanding + keyword matching
- Best for general queries
- Example: "bitcoin privacy" → finds articles about confidential transactions, even if they don't use the exact words

**2. Semantic Search**
- Uses AI embeddings to understand meaning
- Great for concept-based queries
- Example: "how to accept payments" → finds articles about Lightning invoices, BTCPay Server, even if they don't mention "payments"

**3. Keyword Search**
- Traditional full-text search
- Exact keyword matching
- Great for finding specific terms
- Example: "NIP-07" → finds all documents mentioning NIP-07

**Switching Modes:**
```
[🔄 Hybrid] [📝 Keyword] [⚖️ Semantic]
```
Click any button to switch. Results update instantly.

### Search Results

Each result shows:

```
┌────────────────────────────────────────────────────────┐
│ 📄 How to Run Your Own Nostr Relay                     │
│ [kind:30023] [⭐ 0.87]                                  │
│                                                          │
│ A comprehensive guide to setting up and maintaining     │
│ your own Nostr relay using strfry. Covers installation, │
│ config, monitoring, and anti-spam measures...           │
│                                                          │
│ 👤 npub1abc...def  📅 2 days ago  🏷️ nostr, relay      │
│                                                          │
│ [▼ Expand]  [🟣 Open in Nostr client]                  │
└────────────────────────────────────────────────────────┘
```

**Elements:**
- **Title** - Article/note title
- **Content Type Badge** - `[kind:30023]`, `[github:repo]`, etc.
- **Quality Score** - ⭐ 0-1 (higher = better quality)
- **Preview Text** - First ~200 characters (truncated)
- **Metadata** - Author, date, tags
- **Actions** - Expand, open in client, like, zap (Nostr only)

### Expandable Content

**Short Content** (<200 chars):
- Shows full content immediately
- No expand button

**Long Content** (>200 chars):
- Truncated to 3 lines
- **"▼ Expand"** button appears
- Click to show full content
- **"▲ Collapse"** button to hide again

**Example:**
```
Before:
  "A comprehensive guide to setting up and maintaining your
   own Nostr relay using strfry. Covers installation, config,
   monitoring, and anti-spam measures..."
  [▼ Expand]

After clicking "Expand":
  "A comprehensive guide to setting up and maintaining your own 
   Nostr relay using strfry. Covers installation, configuration,
   monitoring, and anti-spam measures.
   
   ## Introduction
   Running your own relay gives you full control over your data...
   
   ## Installation
   The most popular relay implementation is strfry..."
  [▲ Collapse]
```

### Pagination

```
[1] [2] [3] ... [8] →
```

- 10 results per page (default)
- Click page numbers to navigate
- `→` for next page, `←` for previous

---

## Content Type Filtering

### Filter Sidebar

```
┌─────────────────────────┐
│ Filters                 │
├─────────────────────────┤
│ Content Type            │
│ ☑ Nostr (155)           │
│ ☐ GitHub (0)            │
│ ☐ Documentation (0)     │
│ ☐ Stack Overflow (0)    │
│ ☐ All Types             │
└─────────────────────────┘
```

**How it works:**
- **Check a box** to include that content type
- **Uncheck a box** to exclude it
- **Multiple selections** show results from all checked types
- **Count in parentheses** shows how many documents of that type exist

### Content Type Taxonomy

**Nostr Events:**
- `nostr:note` - Short-form posts (kind 1)
- `nostr:article` - Long-form articles (kind 30023)
- `nostr:draft` - Draft articles (kind 30024)
- `nostr:file` - File metadata
- `nostr:video` - Video metadata

**GitHub** (Coming Soon):
- `github:repo` - Repository info
- `github:issue` - Issues
- `github:pr` - Pull requests
- `github:readme` - README files
- `github:code` - Source code snippets

**Documentation** (Coming Soon):
- `docs:api` - API documentation
- `docs:tutorial` - Tutorials
- `docs:reference` - Reference docs

**Stack Overflow** (Coming Soon):
- Questions and answers

**Knowledge Libraries** (Coming Soon):
- `library:book` - Books
- `library:paper` - Academic papers
- `library:course` - Course materials

### Filter Examples

**Example 1: Nostr articles only**
- Check: `nostr:article`
- Uncheck: All others
- Result: Only long-form Nostr articles (kind 30023)

**Example 2: All Nostr content**
- Check: `nostr:note`, `nostr:article`, `nostr:draft`
- Result: All Nostr event types

**Example 3: Code + documentation**
- Check: `github:code`, `docs:api`
- Result: Source code and API docs

---

## Nostr Integration

### NIP-07 Login

**What is NIP-07?**
- Browser extension authentication for Nostr
- Supported extensions: Alby, nos2x, nostr-signer

**How to login:**

1. **Install a Nostr extension** (if you haven't already)
   - Chrome: [Alby](https://getalby.com/)
   - Firefox: [nos2x](https://github.com/fiatjaf/nos2x)

2. **Click "🟣 Login with Nostr"** in the sidebar

3. **Grant permission** in the extension popup

4. **You're logged in!**
   - Shows: "🟣 Connected: npub1abc...def"
   - Logout button appears
   - Connection persists on page reload

**Benefits of logging in:**
- ✅ Like, zap, and repost Nostr content directly
- ✅ See results ranked by your Web of Trust
- ✅ Filter spam based on your trust network

### Direct Nostr Interactions

Once logged in, each Nostr event shows action buttons:

```
┌────────────────────────────────────────────────────────┐
│ 📄 How to Run Your Own Nostr Relay                     │
│ ...                                                      │
│                                                          │
│ [👍 Like] [🔄 Repost] [⚡ Zap] [🟣 Open in...]         │
└────────────────────────────────────────────────────────┘
```

**Actions:**

**👍 Like**
- Creates a kind 7 reaction event
- Your extension signs the event
- Published to relays
- Confirmation: "Liked! 👍"

**🔄 Repost**
- Creates a kind 6 repost event
- Your extension signs the event
- Published to relays
- Confirmation: "Reposted! 🔄"

**⚡ Zap** (Coming Soon)
- Send Lightning payment to the author
- NIP-57 implementation
- Requires Lightning wallet integration

**🟣 Open in Nostr client**
- Opens the event in your preferred Nostr client
- Supported clients:
  - Damus (iOS)
  - Primal (Web/iOS/Android)
  - Amethyst (Android)
  - Snort (Web)
  - Iris (Web)

**Deep Link Format:**
```
nostr:nevent1... (event bech32 encoding)
```

### Web of Trust Filtering

**What is Web of Trust (WoT)?**
- Your trust network on Nostr
- People you follow (direct trust)
- People your follows follow (extended trust)
- Trust scores: 0.0 (unknown) to 1.0 (direct follow)

**How it works:**

**Trust Badges:**
- ✓ **Trusted** (score > 0.7) - Green badge, direct follows
- ~ **Neutral** (score 0.3-0.7) - Yellow badge, friend-of-friend
- ⚠️ **Unknown** (score < 0.3) - Red badge, outside your network

**Trust-Based Ranking:**
- Content from trusted sources ranks higher
- Up to 2x boost for direct follows
- Spam from low-trust sources pushed down

**WoT Filter Modes:**

```
┌─────────────────────────┐
│ Trust Level             │
│ ☑ Trusted only          │
│ ☑ Show neutral          │
│ ☐ Include unknown       │
│                         │
│ WoT Threshold: [■■■□□]  │
│ (0.3)                   │
└─────────────────────────┘
```

**Modes:**
- **Strict:** Only show trusted (score > 0.7)
- **Moderate:** Show trusted + neutral (score > 0.3)
- **Open:** Show all, use WoT for ranking only

**WoT Threshold Slider:**
- Adjust minimum trust score
- Range: 0.0 (show all) to 1.0 (direct follows only)
- Default: 0.3 (moderate filtering)

**Example:**

**Query:** "bitcoin privacy"

**Without WoT:**
- Shows all results equally
- Spam and quality mixed together

**With WoT (Moderate):**
- Top results: Articles from people you follow
- Middle: Content from extended network
- Filtered out: Spam from unknown sources

### Nostr Search Tips

**Tip 1: Use semantic search for Nostr content**
- Nostr notes often use casual language
- Semantic search understands context
- Example: "how to zap" → finds articles about Lightning tips, even without the word "zap"

**Tip 2: Filter by content type**
- `nostr:article` for long-form deep dives
- `nostr:note` for quick tips and discussions

**Tip 3: Enable WoT filtering**
- Dramatically improves signal-to-noise
- Focuses on trusted voices in your network

**Tip 4: Sort by recency**
- Nostr moves fast
- Recent results often more relevant

---

## GitHub Search (Coming Soon)

### What's Indexed

**Repositories:**
- Nostr ecosystem (~100 repos)
- Bitcoin Core, Lightning implementations
- Privacy tools, decentralization projects

**Content Types:**
- `github:repo` - Repository info (name, description, stars, topics)
- `github:readme` - README files
- `github:issue` - Issues and discussions
- `github:pr` - Pull requests and code reviews
- `github:code` - Source code snippets (selective)

### Search Examples

**Example 1: Find Nostr implementations**
```
Query: "nostr client implementation"
Filters: [github:repo] [github:readme]
Results: Nostr client repos with implementation details
```

**Example 2: Find solutions to issues**
```
Query: "websocket connection error"
Filters: [github:issue]
Results: GitHub issues discussing websocket problems
```

**Example 3: Find code examples**
```
Query: "NIP-07 signer implementation"
Filters: [github:code]
Results: Code snippets implementing NIP-07
```

### GitHub Search Tips

**Tip 1: Use repository filters**
- Search within a specific repo
- Example: "repo:nostr-protocol/nips authentication"

**Tip 2: Combine with documentation**
- Check both `github:readme` and `docs:api`
- Get implementation + official docs

**Tip 3: Look at issue discussions**
- `github:issue` often has more context than code
- Real-world problems and solutions

---

## Advanced Search Tips

### Query Syntax

**Basic Query:**
```
nostr relay
```
Finds documents containing "nostr" AND "relay"

**Phrase Search:**
```
"web of trust"
```
Finds exact phrase "web of trust"

**OR Operator:**
```
bitcoin OR lightning
```
Finds documents with either "bitcoin" OR "lightning"

**Exclude Terms:**
```
nostr -spam
```
Finds "nostr" but excludes documents containing "spam"

**Wildcard:**
```
relay*
```
Finds "relay", "relays", "relaying", etc.

### Search Strategies

**Strategy 1: Start Broad, Then Filter**
1. Search with general terms: `bitcoin privacy`
2. Review top results
3. Add filters: Content type, tags, date range
4. Refine query based on what you find

**Strategy 2: Use Content Types**
1. Decide what kind of content you need:
   - Tutorial? → `docs:tutorial`
   - Code example? → `github:code`
   - Discussion? → `nostr:note` or `stackoverflow`
2. Filter by content type first
3. Then search

**Strategy 3: Leverage WoT (Nostr)**
1. Enable WoT filtering
2. Set threshold based on urgency:
   - High urgency: Strict (only direct follows)
   - Normal: Moderate (extended network)
   - Exploratory: Open (ranked by trust)
3. Trust badges show quality at a glance

**Strategy 4: Multi-Source Discovery**
1. Search across all sources: `nostr client architecture`
2. Compare results:
   - Nostr: Community discussions
   - GitHub: Actual implementations
   - Docs: Official specifications
   - Stack Overflow: Common problems
3. Get a complete picture

### Power User Tips

**Tip 1: Bookmark complex searches**
- Search URLs include all filters
- Example: `?q=bitcoin+privacy&type=nostr:article&wot=0.5`
- Bookmark for instant access

**Tip 2: Use semantic search for concepts**
- Don't overthink keywords
- Describe what you want to know
- Example: "how to receive anonymous payments" → finds relevant articles even if they use different terminology

**Tip 3: Combine search modes**
- Start with semantic (broad concepts)
- Switch to keyword (specific terms)
- Switch to hybrid (best of both)

**Tip 4: Check multiple content types**
- Same query, different content types = different insights
- Example: "Lightning channels"
  - `nostr:article` → Beginner guides
  - `github:issue` → Technical problems
  - `docs:api` → API reference
  - `stackoverflow` → Common questions

**Tip 5: Use quality scores**
- ⭐ 0.8-1.0: High-quality, comprehensive content
- ⭐ 0.5-0.8: Good content, may be shorter
- ⭐ 0.0-0.5: Short or low-engagement content

**Tip 6: Sort and filter strategically**
- Relevance (default): Best match to query
- Recency: Latest information (Nostr, GitHub issues)
- Quality: Most comprehensive content

---

## Product Integrations

Beacon Search is designed to integrate into other products as a unified search backend.

### NostrCast Integration

**Use Case:** Search podcast episodes

**Features:**
- Search transcripts semantically
- Find episodes by topic, guest, or keyword
- Filter by podcast show
- Deep link to timestamp in episode

**API Endpoint:**
```
GET /api/search?q=bitcoin+privacy&type=nostrcast:episode
```

### NostrMaxi Integration

**Use Case:** Search NIP-05 identities and profiles

**Features:**
- Find users by bio, interests, or location
- WoT-based user discovery
- Search verified identities

**API Endpoint:**
```
GET /api/search?q=lightning+developer&type=nostr:profile
```

### Fragstr Integration

**Use Case:** Search game content and player profiles

**Features:**
- Find games by genre, description
- Search player bios and achievements
- Discover content creators

**API Endpoint:**
```
GET /api/search?q=retro+shooter&type=fragstr:game
```

### Custom Integrations

**API-First Design:**
- RESTful API
- JSON responses
- CORS enabled
- No authentication required (public endpoints)

**Integration Steps:**
1. Deploy Beacon Search instance
2. Index your content via connectors or API
3. Call search API from your app
4. Display results in your UI

**See:** [API Reference](./API-REFERENCE.md) and [Integration Guide](./INTEGRATION-GUIDE.md)

---

## FAQ

### General

**Q: Is Beacon Search free?**  
A: Currently yes. Open-source project. Hosted instances may have usage limits.

**Q: How often is content updated?**  
A: Nostr: Real-time to daily (depending on config). GitHub/Docs: Daily to weekly.

**Q: Can I deploy my own instance?**  
A: Yes! See [DEPLOY.md](./DEPLOY.md) for instructions.

**Q: What's the difference between semantic and keyword search?**  
A: Semantic understands meaning (AI embeddings). Keyword matches exact words. Hybrid combines both.

### Nostr

**Q: Do I need to login to search Nostr content?**  
A: No. Login is optional. Enables WoT filtering and interactions (like/zap/repost).

**Q: What Nostr clients does "Open in..." support?**  
A: Damus, Primal, Amethyst, Snort, Iris. Uses standard `nostr:` deep links.

**Q: How is WoT calculated?**  
A: Based on your follow graph. Direct follows = 1.0. Friend-of-friend = 0.5-0.7. Outside network = 0.0-0.3.

**Q: Can I disable WoT filtering?**  
A: Yes. Uncheck "Enable WoT" or set threshold to 0.0.

**Q: What if I'm not logged in? Do I still see WoT scores?**  
A: No. WoT is personalized. Without login, all content ranked equally by relevance.

### GitHub

**Q: When is GitHub search available?**  
A: Phase 8 (weeks 3-4). Currently in development.

**Q: Which GitHub repos are indexed?**  
A: Starting with Nostr ecosystem (~100 repos). Expanding to Bitcoin, Lightning, privacy tools.

**Q: Can I request a repo to be indexed?**  
A: Yes! File an issue or contact maintainers.

### Privacy & Security

**Q: Is my data stored?**  
A: Search queries are not logged. Nostr login uses browser extension (your keys never touch our servers).

**Q: What permissions does NIP-07 login require?**  
A: Only public key and event signing. No access to private keys.

**Q: Is search traffic encrypted?**  
A: Yes. HTTPS enforced on production instances.

### Performance

**Q: Why are some searches slow?**  
A: First-time embedding generation can take 1-2s. Subsequent searches are cached (<200ms).

**Q: How many results can I get?**  
A: Up to 100 per query (10 per page, 10 pages). Increase via API parameter.

**Q: Can I export search results?**  
A: Not yet. Planned feature.

### Technical

**Q: What's the embedding model?**  
A: all-MiniLM-L6-v2 (Transformers.js, local inference).

**Q: What database does Beacon use?**  
A: PostgreSQL 16 with pgvector extension.

**Q: Can I contribute?**  
A: Yes! See [DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md) for technical docs.

---

## Support

**Documentation:** See [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md)  
**API Reference:** See [API-REFERENCE.md](./API-REFERENCE.md)  
**Integration Guide:** See [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)  
**Deployment Guide:** See [DEPLOY.md](./DEPLOY.md)

**Issues:** File on GitHub (or contact maintainers)  
**Feature Requests:** Open an issue with `[FEATURE]` tag

---

**Last Updated:** 2026-02-13 23:21 EST  
**Version:** 2.0  
**Maintained By:** Beacon Search Team
