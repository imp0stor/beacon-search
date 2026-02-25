# Foundation Checklist (Mandatory)

Reference: ~/strangesignal/standards/FOUNDATION-RUNBOOK.md

## 1) Admin Console
- [ ] `/admin` route exists
- [ ] Dashboard (status + alerts + recent activity)
- [ ] CRUD pages for configurable entities
- [ ] Loading/error/empty states implemented

## 2) Configuration Storage
- [ ] Config in DB tables (not hardcoded constants)
- [ ] Migrations include up + down scripts
- [ ] `system_settings` pattern available

## 3) Connector/Plugin Layer
- [ ] Base abstraction/interface exists
- [ ] Factory/registry used for connector creation
- [ ] At least one real connector implemented

## 4) Execution Engine
- [ ] Manual trigger endpoint/action
- [ ] Scheduled execution supported
- [ ] Execution history persisted
- [ ] Alerts emitted on failures

## 5) Quality Gates
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Integration smoke test run
- [ ] Docs updated
