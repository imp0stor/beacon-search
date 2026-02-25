# Foundation Checklist (Mandatory)

Reference: ~/strangesignal/standards/FOUNDATION-RUNBOOK.md

## 1) Admin Console
- [x] `/admin` route exists
- [x] Dashboard (status + alerts + recent activity)
- [x] CRUD pages for configurable entities
- [x] Loading/error/empty states implemented

## 2) Configuration Storage
- [x] Config in DB tables (not hardcoded constants)
- [x] Migrations include up + down scripts
- [x] `system_settings` pattern available

## 3) Connector/Plugin Layer
- [x] Base abstraction/interface exists
- [x] Factory/registry used for connector creation
- [x] At least one real connector implemented

## 4) Execution Engine
- [x] Manual trigger endpoint/action
- [x] Scheduled execution supported
- [x] Execution history persisted
- [x] Alerts emitted on failures

## 5) Quality Gates
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Integration smoke test run
- [x] Docs updated
