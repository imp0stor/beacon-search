# Testing the Three New Features

## Setup

1. **Apply Migration (Feature 1: Dedupe)**
   ```bash
   cd ~/strangesignal/projects/beacon-search/backend
   node apply-migration.js ../migrations/003_unique_event_id.sql
   ```

2. **Rebuild Frontend**
   ```bash
   cd ~/strangesignal/projects/beacon-search/frontend
   npm run build
   ```

3. **Restart Services**
   ```bash
   cd ~/strangesignal/projects/beacon-search
   docker compose -f docker-compose.prod.yml restart
   # or if running in dev mode:
   cd backend && npm run dev
   cd frontend && npm start
   ```

## Feature 1: Event ID Deduplication

### Test 1: Verify Unique Constraint Exists
```sql
-- Connect to database
psql beacon_search

-- Check constraint
\d nostr_events

-- Should see: "unique_event_id" UNIQUE CONSTRAINT
```

### Test 2: Try Inserting Duplicate Event
```sql
-- Insert a test event
INSERT INTO nostr_events (event_id, pubkey, kind, event_created_at)
VALUES ('test_event_123', 'test_pubkey', 1, NOW());

-- Try to insert duplicate (should be ignored)
INSERT INTO nostr_events (event_id, pubkey, kind, event_created_at)
VALUES ('test_event_123', 'test_pubkey', 1, NOW())
ON CONFLICT (event_id) DO NOTHING;

-- Verify only one row exists
SELECT COUNT(*) FROM nostr_events WHERE event_id = 'test_event_123';
-- Should return: 1

-- Clean up
DELETE FROM nostr_events WHERE event_id = 'test_event_123';
```

### Test 3: Run Nostr Ingestion
```bash
cd backend
npm run spider:adaptive
# or
npm run spider:authors
```

Check that duplicate events don't appear in search results.

## Feature 2: Expandable Content

### Test 1: Visual Check
1. Open Beacon Search in browser: http://localhost:3000
2. Search for any Nostr content with >200 characters
3. Verify:
   - ✅ Content is truncated to 3 lines
   - ✅ "▼ Expand" button appears
   - ✅ Clicking expand shows full content
   - ✅ "▲ Collapse" button appears when expanded
   - ✅ Clicking collapse returns to truncated view

### Test 2: Short Content
1. Search for content with <200 characters
2. Verify:
   - ✅ No expand button appears
   - ✅ Full content is shown

### Test 3: Multiple Items
1. Have multiple search results
2. Expand one item
3. Verify:
   - ✅ Only that item expands
   - ✅ Others remain collapsed
   - ✅ Can expand multiple items independently

## Feature 3: Nostr Interactions

### Test 1: Login Flow
1. Install a Nostr browser extension (Alby or nos2x)
2. Open Beacon Search
3. Click "🟣 Login Nostr" in sidebar
4. Verify:
   - ✅ Extension prompts for permission
   - ✅ After approval, shows "🟣 Connected" + pubkey
   - ✅ Connection persists on page reload (localStorage)
   - ✅ Logout button appears

### Test 2: Like Button
1. Login with Nostr
2. Find a Nostr event in search results (has event_id in attributes)
3. Click 👍 button
4. Verify:
   - ✅ Extension prompts to sign event (kind 7)
   - ✅ Alert confirms "Liked! 👍"
   - ✅ Console shows signed event

### Test 3: Repost Button
1. Login with Nostr
2. Find a Nostr event
3. Click 🔄 button
4. Verify:
   - ✅ Extension prompts to sign event (kind 6)
   - ✅ Alert confirms "Reposted! 🔄"
   - ✅ Console shows signed event

### Test 4: Zap Button
1. Login with Nostr
2. Find a Nostr event
3. Click ⚡ button
4. Verify:
   - ✅ Alert shows "Zap functionality coming soon!"
   (Full NIP-57 implementation pending)

### Test 5: Not Logged In
1. Logout or use private browsing
2. Find a Nostr event in results
3. Verify:
   - ✅ Shows "🟣 Login with Nostr" button instead of action buttons
   - ✅ Clicking prompts extension login

### Test 6: Non-Nostr Content
1. Search for regular web content (not from Nostr)
2. Verify:
   - ✅ No Nostr action buttons appear
   - ✅ Only content from Nostr events shows the buttons

## Integration Testing

### Test 1: All Features Together
1. Run a Nostr ingestion with duplicates
2. Verify deduplication works
3. View results with expandable content
4. Login with Nostr
5. Like/repost an event
6. Expand/collapse content
7. Verify all features work together without conflicts

## Visual Regression

Check that the cyberpunk/brutalist theme is maintained:
- ✅ Dark purple/blue gradient background
- ✅ Clean, monospace fonts for buttons
- ✅ No fancy animations (instant transitions only)
- ✅ Consistent color scheme with existing UI
- ✅ Nostr buttons use purple accent (#8b5cf6)
- ✅ Expand button uses blue accent (#6366f1)

## Browser Compatibility

Test in:
- [ ] Chrome (with Alby extension)
- [ ] Firefox (with nos2x extension)
- [ ] Safari (with nostr extension if available)

## Performance

- [ ] Expanding 50+ results should be instant
- [ ] localStorage operations don't block UI
- [ ] NIP-07 signing completes in <2s
