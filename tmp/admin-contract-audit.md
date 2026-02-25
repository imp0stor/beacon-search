# Admin UI ↔ Admin API Contract Audit (2026-02-25)

## Scope audited
- Frontend admin currently mounted in `frontend/src/App.js`:
  - Dashboard (`frontend/src/admin/pages/Dashboard.tsx`)
  - Servers (`frontend/src/admin/pages/ServersPage.tsx`)
  - Document Types (`frontend/src/admin/pages/DocumentTypesPage.tsx`)
  - Crawlers (`frontend/src/admin/pages/CrawlersPage.tsx`)
  - Settings (`frontend/src/admin/pages/SettingsPage.tsx`)
- Backend admin API:
  - `backend/src/routes/admin/{dashboard,servers,documentTypes,crawlers}.ts`

## Drift found
1. Dashboard service (`frontend/src/services/adminApi.ts`) previously called non-admin endpoints:
   - `/api/stats`, `/api/connectors`, `/api/connectors/:id/history`, `/api/admin/alerts/:id/ack`
   - These did not match backend admin routes (`/api/admin/dashboard/*`).
2. Admin pages for Servers/Document Types/Crawlers were placeholders (`Coming soon`) and did not consume available backend admin endpoints.
3. Dashboard index status response lacked per-type document breakdown expected by index widget.
4. Legacy/parallel admin implementation still exists in `frontend/src/admin/AdminApp.js` + `frontend/src/admin/utils/api.js` (not current route entrypoint), which expects many non-admin endpoints.

## Alignment actions taken
- Reworked `frontend/src/services/adminApi.ts` to use backend admin contracts:
  - `GET /api/admin/dashboard/index-status`
  - `GET /api/admin/dashboard/alerts`
  - `POST /api/admin/dashboard/alerts/:id/ack`
  - `GET /api/admin/dashboard/sync-history`
  - `GET/POST/PUT/DELETE /api/admin/servers`
  - `POST /api/admin/servers/:id/test`
  - `GET/POST/PUT/DELETE /api/admin/document-types`
  - `GET/POST/PUT/DELETE /api/admin/crawlers`
  - `POST /api/admin/crawlers/:id/sync`
  - `GET /api/admin/crawlers/:id/history`
- Implemented functional CRUD/admin operations in pages:
  - `ServersPage.tsx`
  - `DocumentTypesPage.tsx`
  - `CrawlersPage.tsx`
  - `SettingsPage.tsx` (health display)
- Extended backend dashboard contract in `DashboardController.indexStatus()` to include:
  - `documents_by_type` array for index widget display.
- Added admin page styles for forms/tables/history blocks in `frontend/src/admin/admin.css`.

## Remaining known drift (non-blocking for active admin path)
- `frontend/src/admin/AdminApp.js` and `frontend/src/admin/utils/api.js` still represent older parallel admin implementation and target legacy endpoints not guaranteed by current backend.
- Active app path uses `frontend/src/App.js` + TS admin pages; this flow is now aligned.
