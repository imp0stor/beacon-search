# Sprint 001: Beacon V2 - Foundation

**Sprint Goal:** Deploy advanced UX (sorting/filtering) + Nostr authentication + ranking foundation  
**Duration:** 5-7 agent days  
**Start Date:** 2026-02-25  
**Target Completion:** 2026-03-01  

---

## Sprint Objectives

1. ✅ **Advanced UX deployed** - Users can sort/filter search results
2. ✅ **Nostr auth working** - Users can log in with browser extensions
3. ✅ **Ranking foundation** - Quality scores computed and displayed
4. ✅ **All changes in git** - Committed with proper documentation

---

## User Stories (Priority Order)

### P0 - Critical Path

#### US-101: Sort Results
**As a user, I want to sort results by relevance, date, or quality**

**Tasks:**
- [ ] Frontend: Create `SortDropdown.js` component
- [ ] Frontend: Add sort state to UserApp
- [ ] Backend: Add `?sort=` query param support
- [ ] Backend: Implement SQL ORDER BY for each sort type
- [ ] Frontend: Update URL params on sort change
- [ ] Test: Verify all sort options work

**Acceptance:**
- [ ] Dropdown shows: Relevance (default), Newest, Oldest, Quality, Engagement
- [ ] Results re-order when sort changes
- [ ] URL updates: `?q=bitcoin&sort=date-new`

---

#### US-102: Filter by Content Type
**As a user, I want to filter results by content type (text, image, link)**

**Tasks:**
- [ ] Frontend: Create `SearchFilters.js` component
- [ ] Frontend: Checkboxes for: Text, Image, Video, Link, All
- [ ] Backend: Add `?type=` query param
- [ ] Backend: Filter SQL by document_type field
- [ ] Frontend: Display active filters as chips
- [ ] Test: Verify type filtering works

**Acceptance:**
- [ ] Filter UI opens in modal or sidebar
- [ ] Selected types show as chips below search bar
- [ ] Results update immediately on filter change
- [ ] Clear all filters button works

---

#### US-103: Filter by Source
**As a user, I want to filter by source (Primal, Manual, etc.)**

**Tasks:**
- [ ] Frontend: Add source filter to SearchFilters
- [ ] Backend: Query distinct sources for dropdown
- [ ] Backend: Add `?source=` query param
- [ ] Frontend: Multi-select for sources
- [ ] Test: Verify source filtering

**Acceptance:**
- [ ] Source dropdown populated from DB
- [ ] Can select multiple sources
- [ ] Results filtered correctly

---

#### US-301: Login with Nostr Extension
**As a user, I want to log in with my Nostr browser extension**

**Tasks:**
- [ ] Frontend: Create `useNostrAuth.js` hook
- [ ] Frontend: Detect `window.nostr` on mount
- [ ] Frontend: Create `AuthModal.js` component
- [ ] Frontend: "Login with Nostr" button in header
- [ ] Frontend: Request `getPublicKey()` from extension
- [ ] Backend: Create `/api/auth/verify` endpoint
- [ ] Backend: Verify NIP-98 signature
- [ ] Backend: Return JWT or session token
- [ ] Frontend: Store auth state (localStorage + context)
- [ ] Frontend: Profile dropdown with npub, sign out
- [ ] Test: Login with Alby, nos2x, Flamingo

**Acceptance:**
- [ ] Login button visible when extension detected
- [ ] Modal prompts for permission
- [ ] Successful login shows profile dropdown
- [ ] Logout clears session

---

#### US-201: Display Quality Metrics
**As a user, I want to see quality indicators on search results**

**Tasks:**
- [ ] Database: Add quality score columns
```sql
ALTER TABLE documents ADD COLUMN quality_score FLOAT DEFAULT 0.5;
ALTER TABLE documents ADD COLUMN zaps_total BIGINT DEFAULT 0;
ALTER TABLE documents ADD COLUMN zaps_count INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN likes_count INT DEFAULT 0;
```
- [ ] Backend: Create `rankingService.ts`
- [ ] Backend: Implement quality score calculation:
  - Length score (200-2000 chars optimal)
  - Has media: +0.1
  - Has links: +0.05
  - Readability (if feasible)
- [ ] Backend: Populate quality_score for existing docs
- [ ] Frontend: Display quality stars (⭐⭐⭐⭐⭐)
- [ ] Frontend: Display zap count, like count
- [ ] Test: Verify quality scores make sense

**Acceptance:**
- [ ] Quality stars (1-5) shown on results
- [ ] Zap count shown: "⚡ 2.1k sats"
- [ ] Like count shown: "❤️ 342"
- [ ] Hover shows breakdown

---

### P1 - Important (Nice to Have)

#### US-104: Filter by Date Range
**As a user, I want to filter by date range (last day, week, month, custom)**

**Tasks:**
- [ ] Frontend: Date range picker (presets + custom)
- [ ] Backend: Add `?date_from=&date_to=` params
- [ ] Backend: Filter SQL by created_at or last_modified
- [ ] Test: Date filtering

**Acceptance:**
- [ ] Presets: Last hour, day, week, month, year
- [ ] Custom date picker works
- [ ] Results filtered correctly

---

#### US-302: View My Profile
**As an authenticated user, I want to see my profile stats**

**Tasks:**
- [ ] Frontend: Profile dropdown expanded view
- [ ] Backend: `/api/user/profile` endpoint
- [ ] Backend: Aggregate user stats (zaps sent, likes given)
- [ ] Frontend: Display: avatar, name, npub, NIP-05, stats
- [ ] Test: Profile loads correctly

**Acceptance:**
- [ ] Profile shows avatar from kind 0 metadata
- [ ] Stats accurate: zaps sent, likes given (placeholder 0s OK for sprint 001)

---

## Technical Architecture Changes

### Frontend Structure
```
frontend/src/
├── components/
│   ├── SearchFilters.js      # NEW: Filter UI
│   ├── SortDropdown.js        # NEW: Sort selector
│   └── AuthModal.js           # NEW: Login modal
├── hooks/
│   ├── useNostrAuth.js        # NEW: Auth hook
│   └── useFilters.js          # NEW: Filter state management
├── user/
│   ├── UserApp.js             # MODIFIED: Add sort/filter/auth
│   └── ContentRenderer.js     # EXISTS: Rich content
└── utils/
    └── nostr.js               # NEW: Nostr helpers (getPublicKey, etc.)
```

### Backend Structure
```
backend/src/
├── routes/
│   ├── search.ts              # MODIFIED: Add sort/filter params
│   ├── auth.ts                # NEW: /api/auth/verify
│   └── user.ts                # NEW: /api/user/profile
├── services/
│   ├── rankingService.ts      # NEW: Quality scoring
│   └── authService.ts         # NEW: JWT/session management
└── middleware/
    └── authMiddleware.ts      # NEW: Verify JWT on protected routes
```

### Database Changes
```sql
-- Quality metrics
ALTER TABLE documents ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0.5;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS zaps_total BIGINT DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS zaps_count INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_docs_quality ON documents(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_docs_zaps ON documents(zaps_total DESC);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  pubkey TEXT PRIMARY KEY,
  filters JSONB DEFAULT '{}',
  sort_preference TEXT DEFAULT 'relevance',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auth sessions (if using DB sessions instead of JWT)
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_sessions_pubkey ON auth_sessions(pubkey);
CREATE INDEX idx_sessions_expires ON auth_sessions(expires_at);
```

---

## Implementation Plan (Day-by-Day)

### Day 1-2: Advanced UX (Sort & Filter)
**Agent:** Main or sub-agent for frontend work

**Tasks:**
1. Create `SortDropdown.js` component
2. Create `SearchFilters.js` component
3. Update `UserApp.js` to integrate sort/filter
4. Backend: Add query param support
5. Backend: Optimize SQL queries
6. Test all combinations

**Deliverable:** Working sort/filter UI

---

### Day 2-3: Nostr Authentication
**Agent:** Parallel track (can overlap with Day 1-2)

**Tasks:**
1. Create `useNostrAuth.js` hook
2. Create `AuthModal.js` component
3. Add "Login with Nostr" button
4. Backend: `/api/auth/verify` endpoint
5. Backend: Session management (JWT or Redis)
6. Frontend: Profile dropdown
7. Test with multiple extensions

**Deliverable:** Working Nostr login

---

### Day 3-4: Ranking Foundation
**Agent:** Backend-focused agent (can overlap)

**Tasks:**
1. Database: Add quality score columns
2. Create `rankingService.ts`
3. Implement quality score calculation
4. Populate scores for existing docs
5. Frontend: Display quality metrics
6. Test quality scoring

**Deliverable:** Quality scores visible in UI

---

### Day 5: Integration & Testing
**Agent:** Main agent

**Tasks:**
1. Integration testing: Sort + filter + auth working together
2. Performance testing: Check query speeds with filters
3. Bug fixes from testing
4. Documentation updates
5. Git commits with proper messages

**Deliverable:** Sprint 001 complete, ready for user testing

---

### Day 6-7: Buffer & Polish (Optional)
**Agent:** As needed

**Tasks:**
- P1 features if time permits (date range filter, profile stats)
- UX polish (animations, loading states)
- Mobile responsiveness fixes
- Performance optimizations

---

## Testing Checklist

### Sort Testing
- [ ] Sort by Relevance (default) works
- [ ] Sort by Newest First works
- [ ] Sort by Oldest First works
- [ ] Sort by Quality (highest scores first) works
- [ ] Sort persists in URL params
- [ ] Sort works with filters applied

### Filter Testing
- [ ] Filter by Text content works
- [ ] Filter by Images works
- [ ] Filter by Links works
- [ ] Filter by source works
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Clear filters button works
- [ ] Active filters display as chips
- [ ] Removing chip updates results

### Auth Testing
- [ ] Extension detection works (Alby, nos2x, Flamingo)
- [ ] Login modal appears when clicking "Login"
- [ ] getPublicKey() call succeeds
- [ ] Backend verifies signature correctly
- [ ] Profile dropdown shows correct npub
- [ ] Logout clears session
- [ ] Refresh page maintains login (localStorage)

### Ranking Testing
- [ ] Quality scores calculated for all docs
- [ ] High-quality posts (>800 chars, has media) score > 0.7
- [ ] Low-quality posts (<100 chars, no media) score < 0.4
- [ ] Quality stars render correctly (1-5 stars)
- [ ] Zap/like counts display (even if 0 for now)

---

## Performance Targets

- **Search latency:** <500ms p95 (with sort/filter)
- **Filter application:** <200ms client-side
- **Auth flow:** <2s from button click to logged in
- **Quality score computation:** <100ms per doc

---

## Definition of Done

### Sprint 001 Complete When:
1. ✅ All P0 user stories completed and tested
2. ✅ Code committed to git with proper messages
3. ✅ Frontend and backend deployed to staging
4. ✅ Manual testing passed (checklist above)
5. ✅ No critical bugs
6. ✅ Documentation updated (README, DEPLOY.md)
7. ✅ Demo video recorded (optional but recommended)

---

## Risks & Mitigation

### Risk 1: Nostr Extension Compatibility
**Mitigation:** Test with all major extensions early, provide clear error messages

### Risk 2: SQL Query Performance
**Mitigation:** Add indexes, use EXPLAIN ANALYZE, optimize early

### Risk 3: Scope Creep
**Mitigation:** Stick to P0 features only, move P1 to Sprint 002

---

## Success Metrics

### Sprint 001 Success If:
- **Filter usage:** >20% of searches use filters (track in analytics)
- **Sort usage:** >30% of users change sort order
- **Auth rate:** >10% of users log in
- **No regressions:** V1 features still work

---

## Next Sprint Preview

**Sprint 002** will focus on:
- Epic 4: Social features (zapping, liking)
- Epic 2: Complete ranking (engagement scores)
- Epic 5: WoT integration (basic 1-hop)

---

**Sprint 001 starts NOW** 🚀

Ready to spawn sub-agents and begin parallel execution.

---

**End of Sprint Plan**
