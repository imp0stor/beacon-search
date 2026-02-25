# Epic Breakdown: Beacon V2 - Advanced UX & Social Integration

**Product:** Beacon Search V2  
**Created:** 2026-02-25  
**Status:** READY TO START  

---

## Epic Overview

Transform Beacon from basic search UI → production-grade Nostr-native search platform with:
- Advanced filtering/sorting
- Quality-based ranking
- Social features (zapping, liking)
- Nostr authentication
- Personalized WoT-based results

---

## Epic 1: Advanced UX (Sorting & Filtering) 🎯

**Goal:** Give users power-user controls for drilling down into search results

### User Stories
- US-101: Sort results by relevance, date, quality, engagement
- US-102: Filter by content type (text, image, video, link)
- US-103: Filter by source/connector
- US-104: Filter by author (pubkey/NIP-05)
- US-105: Filter by date range
- US-106: Display active filters as removable chips
- US-107: Persist filter preferences across sessions

### Acceptance Criteria
- [ ] Sort dropdown with 5+ options (relevance, date-new, date-old, quality, engagement)
- [ ] Filter modal/drawer with checkboxes for content types
- [ ] Date range picker (presets + custom)
- [ ] Active filters shown as chips with X to remove
- [ ] URL params update on filter/sort changes (shareable links)
- [ ] Mobile-responsive filter UI

### Technical Tasks
- [ ] Frontend: `SearchFilters.js` component
- [ ] Frontend: `SortDropdown.js` component
- [ ] Frontend: Filter state management (useState or context)
- [ ] Backend: Add query params: `?sort=date&type=image&source=primal`
- [ ] Backend: Optimize SQL for filtered queries
- [ ] Backend: Add indexes for common filters

### Dependencies
- None (can start immediately)

### Estimate
**3-4 agent days**

---

## Epic 2: Intelligent Ranking Algorithm 📊

**Goal:** Surface high-quality content through multi-factor ranking

### User Stories
- US-201: Posts from trusted authors rank higher
- US-202: Highly-zapped content ranks higher
- US-203: Spam/low-quality content ranks lower
- US-204: View quality indicators (stars, zap count, like count)
- US-205: Sort by "most zapped" or "most liked"

### Acceptance Criteria
- [ ] Ranking formula includes: semantic + keyword + quality + WoT + engagement
- [ ] Quality score computed from length, readability, media presence
- [ ] Engagement score from zaps (sats) + likes + replies
- [ ] WoT score basic implementation (authenticated users only)
- [ ] Results show quality indicators (⭐⭐⭐⭐⭐, 2.1k zaps, 342 likes)
- [ ] Cron job syncs engagement data from relays hourly

### Technical Tasks
- [ ] Database: Add columns (zaps_total, zaps_count, likes_count, engagement_score)
- [ ] Backend: `rankingService.ts` with scoring functions
- [ ] Backend: Quality score calculation
- [ ] Backend: Engagement score from relay data
- [ ] Backend: Basic WoT integration (direct follows only)
- [ ] Cron: `syncEngagement.ts` job (fetch zaps/likes from relays)
- [ ] Frontend: Display quality metrics in result cards

### Dependencies
- Partial dependency on Epic 1 (sort by engagement requires this)
- No blocker - can work in parallel

### Estimate
**4-5 agent days**

---

## Epic 3: Nostr Authentication (NIP-07) 🔑

**Goal:** Enable users to log in with Nostr extensions for personalized features

### User Stories
- US-301: Login with browser extension (Alby, nos2x, Flamingo)
- US-302: View my profile (npub, NIP-05, stats)
- US-303: Persist login across sessions
- US-304: Sign out
- US-305: Show "Login required" for auth-gated features

### Acceptance Criteria
- [ ] Detect `window.nostr` API on page load
- [ ] "Login with Nostr" button in header
- [ ] Auth modal with extension detection
- [ ] Profile dropdown shows: avatar, name, npub, stats
- [ ] Store pubkey in localStorage + backend session
- [ ] Sign out clears session

### Technical Tasks
- [ ] Frontend: `useNostrAuth.js` hook (getPublicKey, signEvent)
- [ ] Frontend: `AuthModal.js` component
- [ ] Frontend: Profile dropdown in header
- [ ] Backend: `/api/auth/verify` endpoint (verify NIP-98 signature)
- [ ] Backend: User session storage (JWT or Redis)
- [ ] Backend: `user_preferences` table

### Dependencies
- None (can work in parallel)

### Estimate
**3-4 agent days**

---

## Epic 4: Social Features (Zapping & Liking) ⚡❤️

**Goal:** Enable users to zap and react to content from search results

### User Stories
- US-401: Zap content directly from search results
- US-402: Choose zap amount (100, 500, 1000, custom sats)
- US-403: Like/react to posts (❤️ 🔥 👍 💯)
- US-404: View my zap history
- US-405: View my like history
- US-406: See zap/like counts on results

### Acceptance Criteria
- [ ] ⚡ Zap button on each result (auth required)
- [ ] Zap modal: amount selector + send button
- [ ] WebLN integration for instant zaps
- [ ] Fallback: Invoice + QR code display
- [ ] Reaction buttons (like, fire, etc.) publish kind 7 events
- [ ] Optimistic UI updates (instant feedback)
- [ ] "My Zaps" tab shows history with timestamps

### Technical Tasks
- [ ] Frontend: `ZapButton.js` component
- [ ] Frontend: `ZapModal.js` with amount picker
- [ ] Frontend: WebLN integration (`window.webln.sendPayment`)
- [ ] Frontend: Invoice + QR code fallback
- [ ] Frontend: `ReactionButtons.js` component
- [ ] Backend: Fetch Lightning Address from kind 0 profiles
- [ ] Backend: Publish kind 7 reactions to relays
- [ ] Backend: Store zap/reaction history in DB
- [ ] Frontend: "My Zaps" and "My Likes" tabs

### Dependencies
- **Epic 3 (Authentication)** - must be complete first

### Estimate
**5-6 agent days**

---

## Epic 5: Web of Trust (WoT) Integration 🤝

**Goal:** Personalize search results based on user's social graph

### User Stories
- US-501: Results prioritize authors I follow
- US-502: Results prioritize 2nd-degree network (follows-of-follows)
- US-503: Filter results to "Trusted Network" only
- US-504: View WoT tier badges (1-hop, 2-hop, unknown)
- US-505: See why author is trusted ("Followed by @alice, @bob")

### Acceptance Criteria
- [ ] WoT scores computed from follow lists (kind 3)
- [ ] Direct follows = 1.0, 2-hop = 0.6, 3-hop = 0.3, unknown = 0.1
- [ ] "Trusted Network" filter toggle
- [ ] WoT tier badges on result cards (🟢 Direct, 🟡 Extended, ⚪ Unknown)
- [ ] Tooltip shows trust path ("You → @alice → author")
- [ ] Logged-in users see WoT-boosted ranking

### Technical Tasks
- [ ] Backend: `wotService.ts` - compute WoT graph
- [ ] Backend: `wot_scores` table (pubkey, score, tier)
- [ ] Backend: Cron job `computeWoT.ts` (refresh daily)
- [ ] Backend: Fetch follow lists (kind 3) from relays
- [ ] Backend: BFS/DFS algorithm for N-hop traversal
- [ ] Backend: Integrate WoT score into ranking formula
- [ ] Frontend: Display WoT badges and trust paths
- [ ] Frontend: "Trusted Network" filter toggle

### Dependencies
- **Epic 3 (Authentication)** - required for personalized WoT
- **Epic 2 (Ranking)** - WoT score integrates into ranking

### Estimate
**4-5 agent days**

---

## Execution Strategy

### Parallel Tracks
To minimize total time, run 2-3 epics in parallel:

**Track A (UX):** Epic 1 → Epic 4 (social features)  
**Track B (Ranking):** Epic 2 → Epic 5 (WoT)  
**Track C (Auth):** Epic 3 (enables Track A completion)

### Sprint Plan

#### Sprint 001: Foundation (Week 1)
- Epic 1: Advanced UX (3-4 days)
- Epic 2: Ranking (partial - 2-3 days)
- Epic 3: Auth (3-4 days)

**Parallel execution:** All 3 start together, minimal dependencies

#### Sprint 002: Social & WoT (Week 2)
- Epic 2: Ranking (complete - 2 days)
- Epic 4: Social features (5-6 days)
- Epic 5: WoT (4-5 days)

**Dependencies handled:** Epic 3 done → unblocks Epic 4 & 5

### Total Timeline
**2-3 weeks** with parallel execution  
**4-5 weeks** if sequential

---

## Success Criteria (All Epics)

### Must Have (V2 MVP)
- ✅ Sort by relevance, date, quality
- ✅ Filter by type, source, author
- ✅ Quality-based ranking deployed
- ✅ Nostr login working (NIP-07)
- ✅ Zap & like functionality
- ✅ Basic WoT integration (1-hop)

### Should Have (V2.1)
- ⏺ Advanced WoT (3-hop+ traversal)
- ⏺ Engagement sync <30min latency
- ⏺ Personalized recommendations
- ⏺ "My Network" tab
- ⏺ Mobile app support (NIP-46)

### Nice to Have (V2.2+)
- ⏺ Topic/hashtag filters
- ⏺ Advanced search syntax (AND/OR/NOT)
- ⏺ Saved searches
- ⏺ Email alerts for new content
- ⏺ API for third-party integrations

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Ranking too slow | Medium | High | Cache scores, optimize queries |
| NIP-07 incompatibility | Low | Medium | Test all extensions, provide fallback |
| Engagement data stale | High | Medium | Run sync job every 30min |
| WoT computation expensive | Medium | High | Pre-compute for top 10k authors only |
| WebLN not supported | Medium | Low | Always provide invoice fallback |

---

## Next Steps

1. **Review PRD** (prd-beacon-v2-advanced-ux.md) ✅
2. **Create Sprint 001 plan** (next)
3. **Spawn sub-agents for parallel tracks**
4. **Start implementation: Epic 1 + Epic 3**

---

**End of Epic Breakdown**
