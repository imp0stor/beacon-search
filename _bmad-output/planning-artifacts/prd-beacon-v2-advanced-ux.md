# Product Requirements Document: Beacon V2 - Advanced UX & Social Integration

**Product:** Beacon Search  
**Version:** 2.0  
**Status:** DRAFT  
**Created:** 2026-02-25  
**Owner:** Adam (OpenClaw Agent)  

---

## Executive Summary

Beacon Search V1 delivers functional semantic search with basic UI. V2 transforms it into a **production-grade search platform** with advanced filtering, intelligent ranking, social features (zapping/liking), and personalized results via Nostr authentication.

**Key Goals:**
1. **Advanced UX:** Sorting, filtering, content type drill-down
2. **Better Ranking:** Quality-based ranking with WoT integration
3. **Social Features:** Zapping, liking, reactions (Nostr-native)
4. **Authentication:** Nostr login for personalized search & WoT

**Target Users:** Nostr power users, content curators, researchers seeking high-signal content

---

## Problem Statement

### Current Limitations (V1)
- ❌ No sorting/filtering - users stuck with single relevance view
- ❌ Ranking is naive - score-based only, no quality signals
- ❌ No social features - can't zap/like valuable content
- ❌ No authentication - can't personalize or use WoT
- ❌ No content type filtering - all results mixed together

### User Pain Points
> "I want to sort by date to see recent posts first"  
> "I want to filter by author or source"  
> "Ranking is not very good - low-quality posts rank high"  
> "I want to zap authors whose content I find valuable"  
> "I want search tailored to my web of trust"

---

## Product Vision

**Beacon V2 = Semantic Search + Social Graph + Quality Signals**

A Nostr-native search engine that:
- Surfaces high-signal content through WoT + engagement metrics
- Enables direct value transfer (zaps) from search results
- Personalizes results based on authenticated user's social graph
- Provides power-user controls (sort/filter/drill-down)

---

## Key Features

### 1. Advanced Sorting & Filtering

#### Sorting Options
- **Relevance** (default) - semantic + keyword match score
- **Date** - newest first or oldest first
- **Quality Score** - computed from WoT + engagement + content analysis
- **Engagement** - most zapped/liked content first
- **Author WoT** - prioritize authors in user's trust network

#### Filtering Options
- **Content Type:** Text / Image / Video / Link / Poll
- **Source:** By connector/feed (e.g., "Primal relay", "Manual ingestion")
- **Author:** Filter by pubkey/NIP-05
- **Date Range:** Last hour / day / week / month / custom
- **WoT Tier:** Only trusted / extended network / all
- **Has Media:** Posts with images/video only

#### UX Design
```
┌─────────────────────────────────────────────────┐
│ 🔦 Beacon Search                                │
├─────────────────────────────────────────────────┤
│ [Search input..............................]  🔍 │
│                                                 │
│ Sort: [Relevance ▼] Filter: [+ Add Filter]     │
│ Active: [Content: Text] [Date: Last Week] [x]  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ Result 1                          Score 95% │ │
│ │ Quality: ⭐⭐⭐⭐⭐  Zaps: 2.1k  Likes: 342   │ │
│ │ ...                                         │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

### 2. Intelligent Ranking Algorithm

#### Current Ranking (V1)
```javascript
score = semantic_similarity * 0.7 + keyword_match * 0.3
```

#### Proposed Ranking (V2)
```javascript
final_score = 
  semantic_similarity * 0.4 +
  keyword_match * 0.2 +
  quality_score * 0.2 +
  wot_score * 0.15 +
  engagement_score * 0.05
```

#### Quality Signals
1. **WoT Score** (0-1)
   - Computed from user's follow graph
   - Direct follow = 1.0, 2-hop = 0.6, 3-hop = 0.3
   - Unknown = 0.1 (still searchable, just lower)

2. **Engagement Score** (0-1)
   - Total zaps (sats) + likes + replies
   - Normalized by post age (decay function)
   - Formula: `log(zaps_sats + likes*100 + replies*50) / log(max_engagement)`

3. **Content Quality** (0-1)
   - Length (too short or too long penalized)
   - Readability metrics
   - Has media = +0.1
   - Has links = +0.05
   - Spam indicators = -0.5

#### Implementation
- Store quality metrics in `documents.attributes` JSONB field
- Pre-compute WoT scores for top 10k authors (cron job)
- Real-time engagement fetching from Nostr relays
- Cache ranking factors for 1 hour

---

### 3. Social Features: Zapping & Liking

#### Zapping (Lightning Payments)
**User Story:** _"As a user, I want to zap valuable content directly from search results"_

**Flow:**
1. User authenticates with Nostr (browser extension or NIP-07)
2. Clicks ⚡ Zap button on result
3. Modal shows: [1000 sats ▼] [⚡ Send Zap]
4. Uses author's Lightning Address (from profile metadata)
5. Sends zap via WebLN or QR code
6. Confirmation toast: "⚡ Zapped 1000 sats to @author"

**Technical:**
- Fetch author's Lightning Address from kind 0 metadata
- Use WebLN API (`window.webln.sendPayment()`)
- Fallback: Generate invoice + show QR code
- Store local zap history (IndexedDB) for "My Zaps" view

#### Liking/Reactions
**User Story:** _"As a user, I want to react to posts without leaving search"_

**Flow:**
1. User authenticated
2. Clicks ❤️ or 🔥 or 👍 on result
3. Publishes kind 7 reaction event to user's relays
4. Updates UI immediately (optimistic)
5. Counter increments: "342 → 343"

**Technical:**
- Publish kind 7 events via NIP-07 signer
- Track user's reactions locally (don't double-react)
- Fetch reaction counts from relays (background job)

---

### 4. Nostr Authentication & Personalization

#### Authentication Methods
1. **NIP-07 Browser Extension** (Alby, nos2x, Flamingo)
   - Detect `window.nostr` API
   - Request `getPublicKey()` + `signEvent()`
   
2. **NIP-46 Remote Signer** (future)
   - Connect to remote signing service
   - For mobile/desktop apps

#### Personalized Features

**When Logged Out:**
- Basic search works
- Generic ranking (no WoT)
- Can view content, but can't zap/like

**When Logged In:**
- WoT-boosted ranking
- Filter by "Trusted Network"
- Zap/like/react to content
- "My Zaps" and "My Likes" history tabs
- Personalized recommendations

#### User Profile Display
```
┌─────────────────────────────────────┐
│ 👤 @adam.nostr.com                  │
│ npub1abc...def                      │
│ ⚡ 12,450 sats zapped this week     │
│ ❤️ 48 posts liked                   │
│ [Sign Out]                          │
└─────────────────────────────────────┘
```

---

## Technical Architecture

### Frontend Changes
```
frontend/
├── src/
│   ├── user/
│   │   ├── UserApp.js         # Main search UI
│   │   ├── ContentRenderer.js  # Rich content display
│   │   ├── SearchFilters.js    # NEW: Filter controls
│   │   ├── SortDropdown.js     # NEW: Sort selector
│   │   ├── ZapButton.js        # NEW: Zap UI
│   │   ├── ReactionButtons.js  # NEW: Like/react
│   │   └── AuthModal.js        # NEW: Login modal
│   ├── hooks/
│   │   ├── useNostrAuth.js     # NEW: NIP-07 hook
│   │   ├── useWoT.js           # NEW: WoT data hook
│   │   └── useZaps.js          # NEW: Zap handler
│   └── utils/
│       ├── nostr.js            # NEW: Nostr helpers
│       ├── ranking.js          # NEW: Client-side ranking
│       └── webln.js            # NEW: WebLN integration
```

### Backend Changes
```
backend/src/
├── routes/
│   ├── search.ts               # Enhanced with ranking
│   ├── wot.ts                  # NEW: WoT endpoints
│   ├── zaps.ts                 # NEW: Zap data aggregation
│   └── profile.ts              # NEW: User profiles
├── services/
│   ├── rankingService.ts       # NEW: Quality scoring
│   ├── wotService.ts           # NEW: WoT computation
│   ├── engagementService.ts    # NEW: Fetch zaps/likes
│   └── nostrRelay.ts           # NEW: Relay pool
└── jobs/
    ├── syncEngagement.ts       # NEW: Cron job for zaps/likes
    └── computeWoT.ts           # NEW: Pre-compute WoT scores
```

### Database Schema Changes
```sql
-- Add engagement metrics to documents
ALTER TABLE documents ADD COLUMN zaps_total BIGINT DEFAULT 0;
ALTER TABLE documents ADD COLUMN zaps_count INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN likes_count INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN replies_count INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN engagement_score FLOAT DEFAULT 0;

-- WoT scores table
CREATE TABLE wot_scores (
  pubkey TEXT PRIMARY KEY,
  score FLOAT NOT NULL,
  tier INT NOT NULL, -- 1=direct, 2=2-hop, 3=3-hop
  computed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_wot_score ON wot_scores(score DESC);

-- User preferences table
CREATE TABLE user_preferences (
  pubkey TEXT PRIMARY KEY,
  filters JSONB DEFAULT '{}',
  sort_preference TEXT DEFAULT 'relevance',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Implementation Plan

### Sprint 001: Advanced UX (Sorting & Filtering)
**Duration:** 3-4 agent days  
**Goal:** Deploy sort/filter UI + backend support

**Tasks:**
- [ ] Design filter component UI
- [ ] Implement sort dropdown (relevance, date, quality)
- [ ] Build filter modal (content type, source, author, date range)
- [ ] Backend: Add query params for sort/filter
- [ ] Backend: Optimize SQL queries for filtered searches
- [ ] Frontend: Display active filters as chips
- [ ] Testing: Verify all combinations work

**Deliverable:** Users can sort by date/relevance and filter by type/source

---

### Sprint 002: Intelligent Ranking
**Duration:** 4-5 agent days  
**Goal:** Deploy quality-based ranking algorithm

**Tasks:**
- [ ] Database: Add engagement metric columns
- [ ] Backend: Create `rankingService.ts`
- [ ] Backend: Implement quality score calculation
- [ ] Backend: Add engagement score (zaps + likes)
- [ ] Backend: Integrate WoT score (basic version)
- [ ] Cron job: Sync engagement data from relays
- [ ] Frontend: Display quality indicators (stars, zap count)
- [ ] Testing: Compare V1 vs V2 ranking on test queries

**Deliverable:** High-quality posts rank higher than low-quality

---

### Sprint 003: Nostr Authentication
**Duration:** 3-4 agent days  
**Goal:** Deploy NIP-07 login + user profiles

**Tasks:**
- [ ] Frontend: Detect `window.nostr` API
- [ ] Frontend: Build auth modal (Login with Nostr)
- [ ] Frontend: `useNostrAuth` hook (getPublicKey, signEvent)
- [ ] Frontend: User profile dropdown in header
- [ ] Backend: `/api/auth/verify` endpoint (verify signature)
- [ ] Backend: Store user preferences in DB
- [ ] Frontend: Show "Logged in as @user" state
- [ ] Testing: Test with Alby, nos2x, Flamingo extensions

**Deliverable:** Users can log in with Nostr extensions

---

### Sprint 004: Social Features (Zapping & Liking)
**Duration:** 5-6 agent days  
**Goal:** Deploy zap/like/react functionality

**Tasks:**
- [ ] Backend: Fetch Lightning Addresses from kind 0 profiles
- [ ] Frontend: `ZapButton.js` component
- [ ] Frontend: Integrate WebLN API
- [ ] Frontend: Fallback invoice + QR code display
- [ ] Frontend: `ReactionButtons.js` (like, fire, etc.)
- [ ] Backend: Publish kind 7 reactions to relays
- [ ] Frontend: Optimistic UI updates
- [ ] Backend: Store zap/reaction history
- [ ] Testing: End-to-end zap flow

**Deliverable:** Users can zap and like content from search results

---

### Sprint 005: WoT Integration & Personalization
**Duration:** 4-5 agent days  
**Goal:** Deploy personalized search based on WoT

**Tasks:**
- [ ] Backend: Compute WoT graph from follow lists
- [ ] Backend: Store WoT scores in `wot_scores` table
- [ ] Backend: Cron job to refresh WoT daily
- [ ] Backend: Boost ranking for WoT-trusted authors
- [ ] Frontend: "Trusted Network" filter toggle
- [ ] Frontend: Display WoT tier badges (1-hop, 2-hop, etc.)
- [ ] Frontend: "My Network" tab showing followed authors
- [ ] Testing: Compare results logged-in vs logged-out

**Deliverable:** Logged-in users see personalized, WoT-boosted results

---

## Success Metrics

### UX Metrics
- **Filter Usage:** >30% of searches use at least one filter
- **Sort Usage:** >40% of users change sort order
- **Session Duration:** +50% increase (better discoverability)

### Ranking Metrics
- **Click-Through Rate:** +25% on top 3 results
- **User Feedback:** Thumbs up/down on results >60% positive

### Social Metrics
- **Zaps Sent:** >100 zaps/week from search UI
- **Likes Given:** >500 likes/week
- **Auth Rate:** >20% of users authenticate

### Technical Metrics
- **Search Latency:** <500ms p95 (including ranking)
- **Relay Sync:** Engagement data fresh within 1 hour
- **WoT Computation:** <5min for 10k authors

---

## Risks & Mitigation

### Risk 1: Ranking Algorithm Complexity
**Impact:** Slow queries, bad UX  
**Mitigation:**
- Cache quality scores (refresh hourly)
- Use materialized views for expensive joins
- A/B test V1 vs V2 ranking with sample users

### Risk 2: Nostr Extension Compatibility
**Impact:** Auth doesn't work for some users  
**Mitigation:**
- Test with all major extensions (Alby, nos2x, Flamingo, horse)
- Provide clear error messages
- Support NIP-46 remote signing as fallback

### Risk 3: Engagement Data Staleness
**Impact:** Ranking based on outdated zap/like counts  
**Mitigation:**
- Run sync job every 30 minutes
- Show "Last updated: 20 min ago" timestamp
- Allow manual refresh button

### Risk 4: WoT Computation Scale
**Impact:** Can't compute WoT for millions of users  
**Mitigation:**
- Only compute for active authors (posted in last 30 days)
- Use approximate WoT (top 10k authors)
- Lazy-load WoT for new authors on-demand

---

## Dependencies

### External
- **Nostr Relays:** Fetch follow lists, profiles, reactions
- **Lightning Network:** For zap payment routing
- **NIP-07 Extensions:** User authentication
- **WebLN:** In-browser Lightning payments

### Internal
- **Beacon V1:** Must be stable before starting V2
- **Database:** PostgreSQL with JSONB support
- **Cron System:** For background jobs

---

## Open Questions

1. **Should we support multiple Lightning wallets?**  
   _Answer: Yes - WebLN (primary) + fallback invoice QR_

2. **How often to refresh WoT scores?**  
   _Answer: Daily full recompute + incremental updates on user request_

3. **Should filters persist across sessions?**  
   _Answer: Yes - store in `user_preferences` table_

4. **What's the default sort for authenticated users?**  
   _Answer: "Relevance + WoT" (hybrid)_

5. **Should we display nsec/npub in UI?**  
   _Answer: Only npub (never show nsec)_

---

## Timeline Estimate

**Total: 19-24 agent days (~2-3 weeks with parallel execution)**

| Sprint | Duration | Depends On |
|--------|----------|------------|
| 001 - UX | 3-4 days | None (start immediately) |
| 002 - Ranking | 4-5 days | Sprint 001 (partial) |
| 003 - Auth | 3-4 days | None (parallel to 001/002) |
| 004 - Social | 5-6 days | Sprint 003 |
| 005 - WoT | 4-5 days | Sprint 003 + 004 |

**With parallel execution:** Could deliver in **12-15 agent days** (1.5-2 weeks)

---

## Rollout Plan

### Phase 1: Alpha (Internal Testing)
- Deploy to staging: `beacon-staging.strangesignal.ai`
- Test with 5-10 power users
- Gather feedback on ranking quality

### Phase 2: Beta (Limited Release)
- Deploy to production with feature flag
- Invite 50-100 users (Nostr announcement)
- Monitor metrics, fix bugs

### Phase 3: General Availability
- Remove feature flags
- Full public announcement
- Marketing push on Nostr/Twitter/Reddit

---

## Appendix: User Stories

### Story 1: Power User Filtering
> "As a researcher, I want to filter search results by date range and content type so I can find recent academic papers quickly."

### Story 2: Quality Ranking
> "As a content curator, I want high-quality posts to rank higher so I don't waste time on spam."

### Story 3: Zapping from Search
> "As a Nostr user, I want to zap valuable content directly from search results without opening multiple tabs."

### Story 4: Personalized Results
> "As an authenticated user, I want search results prioritized from my web of trust so I see signal, not noise."

### Story 5: Content Discovery
> "As a casual user, I want to sort by 'most zapped' to discover high-value content trending in the community."

---

**End of PRD**
