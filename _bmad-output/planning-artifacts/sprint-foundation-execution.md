# Sprint: Foundation Rebuild - Execution Plan

**Sprint Goal:** Build proper foundation (admin console + connector framework + config system) to replace hardcoded architecture  
**Duration:** 10-14 agent days (parallel execution)  
**Start Date:** 2026-02-25  
**Target Completion:** 2026-03-10  
**Status:** EXECUTING NOW  

---

## Parallel Workstreams

### 🔧 Stream A: Backend Foundation
**Agent:** Backend specialist  
**Duration:** 8-10 days  
**Priority:** P0 - CRITICAL PATH  

#### Day 1-2: Database Schema + Models
**Tasks:**
- [ ] Create migration: servers, document_types, crawlers tables
- [ ] Create migration: sync_history, system_alerts tables
- [ ] TypeScript models (Server, DocumentType, Crawler, SyncHistory, Alert)
- [ ] Database seeding (sample data for testing)
- [ ] Test migrations (up/down)

**Deliverable:** Database schema + models complete

---

#### Day 3-4: Configuration API Layer
**Tasks:**
- [ ] `/api/admin/servers` - Full CRUD
- [ ] `/api/admin/document-types` - Full CRUD
- [ ] `/api/admin/crawlers` - Full CRUD
- [ ] `/api/admin/dashboard/*` - Alerts, index status, sync history
- [ ] `/api/admin/settings` - System preferences
- [ ] Authentication middleware (admin role check)
- [ ] Input validation + error handling
- [ ] API tests (Jest + supertest)

**Deliverable:** Admin API layer functional + tested

---

#### Day 5-6: Connector Framework
**Tasks:**
- [ ] `BaseConnector` abstract class
  - connect(), disconnect(), testConnection()
  - fetchDocuments(), syncIncremental(), syncFull()
  - transformDocument(), indexDocument()

- [ ] `ConnectorFactory` - Instantiate correct connector by type

- [ ] `ProductCrawler` implementation
  - PostgreSQL connector (pg library)
  - MySQL connector (mysql2 library)
  - SQL query execution from config
  - Row → Document transformation
  - Incremental sync (WHERE modified_at > last_sync)

- [ ] Connector tests (unit + integration)

**Deliverable:** Working connector framework with SQL support

---

#### Day 7-8: Sync Engine
**Tasks:**
- [ ] `SyncScheduler` class
  - Load active crawlers from DB
  - Schedule cron jobs (node-cron)
  - Schedule interval jobs
  - Job lifecycle management

- [ ] `SyncExecutor` class
  - Execute single crawler sync
  - Track progress (documents added/updated/deleted)
  - Error handling + retry logic
  - Log to sync_history table
  - Generate alerts on failure

- [ ] Manual sync trigger API endpoint
- [ ] Stop/pause/resume crawler API

- [ ] Sync engine tests

**Deliverable:** Scheduler + executor working end-to-end

---

#### Day 9-10: Nostr Connector Refactor + Polish
**Tasks:**
- [ ] `NostrConnector` extends BaseConnector
- [ ] Refactor existing Nostr ingestion code
- [ ] Support kind 0 (profiles) + kind 1 (notes)
- [ ] Store profile metadata in documents.attributes
- [ ] Incremental sync by event timestamp
- [ ] Migration script: existing Nostr data → new schema
- [ ] Performance optimization (batch inserts, indexes)
- [ ] API documentation (Swagger/OpenAPI)

**Deliverable:** Nostr connector integrated + docs complete

---

### 🎨 Stream B: Admin Console Frontend
**Agent:** Frontend specialist  
**Duration:** 8-10 days  
**Priority:** P0 - CRITICAL PATH  

#### Day 1-2: Admin Layout + Navigation
**Tasks:**
- [ ] `AdminLayout.tsx` - Sidebar + header + content area
- [ ] Sidebar nav (Dashboard, Servers, Document Types, Crawlers, Settings)
- [ ] Header (user info, sign out)
- [ ] Route setup (`/admin/*`)
- [ ] Authentication guard (admin role check)
- [ ] Responsive layout (desktop + tablet)

**Deliverable:** Admin shell + navigation working

---

#### Day 3-4: Dashboard Page
**Tasks:**
- [ ] `Dashboard.tsx` main page
- [ ] System status widget
  - Total documents
  - Active crawlers
  - Last sync time
  - Sync failures (24h)
- [ ] Alerts widget
  - List unacknowledged alerts
  - Acknowledge button
  - Filter by severity
- [ ] Index status widget
  - Document count by type
  - Index size on disk
  - Last index update
- [ ] Recent syncs widget
  - Last 10 syncs across all crawlers
  - Status indicators (✅ success, ⚠️ warning, ❌ error)
  - Click to view details
- [ ] Real-time updates (WebSocket or polling)

**Deliverable:** Dashboard page complete with live data

---

#### Day 5-6: Servers & Document Types Management
**Tasks:**
- [ ] `ServersPage.tsx`
  - List all servers (table with sort/filter)
  - Create server button → modal form
  - Edit server (inline or modal)
  - Delete server (confirm dialog)
  - Test connection button (shows status)

- [ ] `ServerForm.tsx` component
  - Server type dropdown (PostgreSQL, MySQL, Web, Nostr, API)
  - Dynamic form fields based on type
  - Host, port, database, auth config
  - Validation
  - Save/cancel

- [ ] `DocumentTypesPage.tsx`
  - List all document types
  - Create/edit/delete
  - Field editor (name, type, searchable, required)
  - Display template editor (Handlebars preview)

**Deliverable:** Servers + Document Types pages working

---

#### Day 7-8: Crawlers Management
**Tasks:**
- [ ] `CrawlersPage.tsx`
  - List all crawlers (table)
  - Status indicators (active, inactive, error)
  - Last sync timestamp
  - Actions: Edit, Delete, Sync Now, View History

- [ ] `CrawlerForm.tsx` (complex!)
  - Basic info: name, type, server, document type
  - Schedule config: manual, cron, interval
  - Extraction config:
    - SQL query editor (for product crawlers)
    - URL patterns (for web crawlers)
    - Filter rules
  - Property mapping editor
    - Source field → Index field mapping
    - Transformations (regex, trim, etc.)
  - Access control
  - Test extraction button (preview results)

- [ ] `CrawlerHistory.tsx` modal
  - List sync history for crawler
  - Stats: docs added/updated/deleted
  - Error details
  - Timeline view

- [ ] Sync status real-time updates

**Deliverable:** Full crawler management UI

---

#### Day 9-10: Settings + Polish
**Tasks:**
- [ ] `SettingsPage.tsx`
  - System preferences (relevancy weights, synonyms)
  - UI customization (logo upload, colors)
  - User management (admin, curator, user roles)
  - API key management

- [ ] UI polish
  - Loading states
  - Error handling (toasts, inline errors)
  - Empty states
  - Help tooltips
  - Mobile responsiveness

- [ ] Integration testing
  - End-to-end workflows
  - Error scenarios
  - Edge cases

**Deliverable:** Complete admin console polished and tested

---

### 🧪 Stream C: Testing & Integration
**Agent:** Integration specialist  
**Duration:** Days 9-14 (overlaps with A & B)  
**Priority:** P0  

#### Day 9-10: Integration Testing
**Tasks:**
- [ ] End-to-end test: Create server → Create crawler → Sync → Verify docs indexed
- [ ] Test all server types (PostgreSQL, MySQL, Nostr)
- [ ] Test sync types (manual, cron, interval, incremental, full)
- [ ] Test error scenarios (bad credentials, network failure, malformed data)
- [ ] Test sync history logging
- [ ] Test alert generation
- [ ] Test dashboard widgets update correctly
- [ ] Load testing (1000+ docs sync)

**Deliverable:** All integration tests passing

---

#### Day 11-12: Migration & Documentation
**Tasks:**
- [ ] Data migration script
  - Existing Nostr data → new schema
  - Preserve all documents
  - Create default server + crawler entries
  - Verify search still works

- [ ] Admin Guide (Markdown)
  - Getting started
  - How to add a server
  - How to create a crawler
  - How to trigger sync
  - Troubleshooting common issues

- [ ] API Documentation (Swagger)
  - All admin endpoints
  - Request/response examples
  - Authentication requirements

- [ ] Developer Guide
  - How to add a new connector type
  - Connector interface reference
  - Testing connectors

**Deliverable:** Migration complete + docs published

---

#### Day 13-14: Deployment & Verification
**Tasks:**
- [ ] Staging deployment
  - Deploy to test environment
  - Run full migration
  - Smoke tests
  - Performance profiling

- [ ] Production deployment
  - Database migrations (zero downtime)
  - Deploy backend
  - Deploy frontend
  - Monitor for errors

- [ ] Verification checklist
  - [ ] User search still works (no regressions)
  - [ ] Admin console accessible
  - [ ] Can create server via UI
  - [ ] Can create crawler via UI
  - [ ] Manual sync works
  - [ ] Dashboard shows correct data
  - [ ] Alerts generated on failure
  - [ ] No breaking changes to search API

- [ ] Rollback plan (if needed)

**Deliverable:** Production-ready foundation deployed

---

## Daily Standup (Async Updates)

Each agent posts daily:
- ✅ Completed yesterday
- 🚧 Working on today
- ⚠️ Blockers/issues
- 📊 % complete

---

## Definition of Done (Sprint Complete)

Foundation Rebuild is DONE when:
1. ✅ All database tables created + migrated
2. ✅ Admin API fully functional (all endpoints)
3. ✅ Connector framework working (SQL + Nostr)
4. ✅ Sync engine scheduling + executing
5. ✅ Admin console UI complete (all pages)
6. ✅ Dashboard shows live system status
7. ✅ Can create server + crawler via UI (no code)
8. ✅ Manual sync works end-to-end
9. ✅ Existing Nostr data migrated successfully
10. ✅ User search UI unchanged + functional
11. ✅ All tests passing (unit + integration + e2e)
12. ✅ Documentation complete (admin + API + dev guides)
13. ✅ Production deployment successful
14. ✅ Zero regressions in user-facing features

---

## Success Metrics

### Technical
- **API Coverage:** 100% of admin endpoints implemented
- **Test Coverage:** >80% backend, >70% frontend
- **Performance:** Sync 1000 docs in <30 seconds
- **Uptime:** Zero downtime during deployment

### Functional
- **Create server via UI:** <2 minutes from form to connection test
- **Create crawler via UI:** <5 minutes from form to first sync
- **Dashboard load time:** <1 second
- **Sync trigger latency:** <500ms from button click to job start

### User Experience
- **Admin onboarding:** New admin can add data source in <10 minutes (no docs)
- **Error clarity:** All errors have actionable messages
- **Real-time updates:** Sync status updates within 2 seconds

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Connector abstraction too complex | Medium | High | Start with simplest case (SQL), iterate |
| Breaking existing search | Low | Critical | Extensive testing, gradual migration |
| Timeline slip | Medium | Medium | Parallel execution, daily check-ins |
| UI too complex for admins | Low | Medium | User testing, simplify forms |
| Performance degradation | Medium | High | Profile early, optimize queries, add indexes |

---

## Communication Plan

- **Daily:** Async standup updates (each agent reports progress)
- **Blockers:** Immediate escalation in main session
- **Weekly:** Sprint review (days 7, 14)
- **Final:** Demo + handoff documentation

---

## Next Steps (Immediate)

1. **Commit this plan to git** ✅
2. **Spawn 3 sub-agents:**
   - Backend agent (Stream A)
   - Frontend agent (Stream B)
   - Integration agent (Stream C, starts day 9)
3. **Begin parallel execution** 🚀
4. **Daily progress tracking**

---

**Sprint Status:** READY TO START

**User approval received:** "Do the right thing, option A, quick fixes are not quick and are not fixes."

**Execution begins NOW.** 🏗️

---

**End of Sprint Plan**
