# Beacon Search Staging Deployment Checklist (Operator)

Date: 2026-02-24
Target host: `neo@10.1.10.143`
Project path: `/home/neo/beacon-search`

## 1) Pre-flight
- [ ] `cd /home/neo/beacon-search`
- [ ] `docker ps` is healthy enough for restart window
- [ ] `.env` and `backend/.env` exist and are current

## 2) Test Gate (must pass)
- [ ] `cd backend && npm test`
- [ ] `cd ../frontend && npm test`
- [ ] `cd ../frontend && npm run build`

## 3) Apply any DB migrations
- [ ] `cd /home/neo/beacon-search`
- [ ] `node apply-migration.js` (root)
- [ ] `cd backend && node apply-migration.js`

## 4) Rebuild + Restart containers
- [ ] `cd /home/neo/beacon-search`
- [ ] `docker compose build --no-cache`
- [ ] `docker compose up -d`
- [ ] `docker compose ps`

## 5) Health checks
- [ ] `curl -sf http://localhost:3001/health | jq .`
- [ ] `curl -I http://localhost:3002`
- [ ] `docker logs --tail 100 beacon-search-backend-1`

## 6) End-to-end smoke
- [ ] `./test-nostr-e2e.sh`
- [ ] Confirm connector run does not crash backend process
- [ ] Confirm search endpoint responds: `curl -sf "http://localhost:3001/api/search?q=nostr&mode=hybrid&limit=3"`

## 7) Rollback plan
- [ ] `docker compose down`
- [ ] restore previous tagged images / prior compose file
- [ ] `docker compose up -d`
- [ ] re-run health checks

## 8) Release evidence
- [ ] attach frontend test output
- [ ] attach backend test output
- [ ] attach build output
- [ ] attach docker ps + health responses
