# Quick Deploy Guide - Three New Features

## TL;DR - One Command Deploy

```bash
cd ~/strangesignal/projects/beacon-search
./deploy-features.sh
```

Then open http://localhost:3000 and test!

---

## What's New?

### 1. 🔄 No More Duplicate Search Results
Database now enforces unique Nostr event IDs. Same event won't appear twice.

### 2. 📖 Expandable Content
Long posts are truncated to 3 lines with an "Expand" button. Click to see full content.

### 3. 🟣 Nostr Interactions
Login with your Nostr extension (Alby/nos2x) and like/repost events directly from search results!

---

## Quick Test

### Test Expandable Content
1. Open Beacon Search
2. Search for any long Nostr post
3. See "▼ Expand" button
4. Click it → full content appears
5. Click "▲ Collapse" → back to 3 lines

### Test Nostr Login
1. Install [Alby](https://getalby.com) or [nos2x](https://github.com/fiatjaf/nos2x) extension
2. Click "🟣 Login Nostr" in sidebar
3. Approve in extension
4. See "🟣 Connected" + your pubkey
5. Reload page → still logged in

### Test Nostr Actions
1. After logging in, find a Nostr post in results
2. See action buttons: 👍 🔄 ⚡
3. Click 👍 (Like) → extension asks to sign → confirms
4. Click 🔄 (Repost) → extension asks to sign → confirms
5. Check browser console to see signed events

---

## Manual Deploy Steps

If the script doesn't work:

```bash
# 1. Apply migration
cd ~/strangesignal/projects/beacon-search/backend
node apply-migration.js ../migrations/003_unique_event_id.sql

# 2. Build frontend
cd ~/strangesignal/projects/beacon-search/frontend
npm run build

# 3. Restart backend
cd ~/strangesignal/projects/beacon-search/backend
npm run dev
# or
npm run build && npm start

# 4. Open browser
xdg-open http://localhost:3000
```

---

## Files Changed

**New Files:**
- `migrations/003_unique_event_id.sql` - Dedupe migration
- `backend/apply-migration.js` - Migration runner
- `deploy-features.sh` - One-click deploy
- `TEST_FEATURES.md` - Comprehensive testing guide
- `IMPLEMENTATION_SUMMARY.md` - Full documentation

**Modified Files:**
- `frontend/src/App.js` - All three features (~150 lines)
- `frontend/src/App.css` - Styling (~180 lines)

---

## Troubleshooting

### Migration Fails
```bash
# Check database is running
psql beacon_search -c "SELECT 1"

# Apply manually
psql beacon_search < migrations/003_unique_event_id.sql
```

### Frontend Build Fails
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Nostr Login Doesn't Work
- Make sure you have Alby or nos2x extension installed
- Check browser console for errors
- Try different extension (Alby vs nos2x)
- Refresh page after installing extension

### Action Buttons Don't Appear
- Only Nostr events show buttons (must have `event_id` in attributes)
- Search for Nostr content specifically
- Check that you ran a Nostr ingestion: `npm run spider:adaptive`

---

## Need Help?

1. Check `TEST_FEATURES.md` for detailed testing steps
2. Check `IMPLEMENTATION_SUMMARY.md` for architecture details
3. Check browser console for errors
4. Check backend logs: `docker compose logs -f backend`

---

**Built:** 2026-02-13  
**Status:** ✅ Ready to deploy and test
