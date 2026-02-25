# Deployment Checklist

**Project:** Beacon Search  
**Environment:** [production/staging/development]

---

## Pre-Deploy

### Code Quality
- [ ] Tests passing: `npm test` (or equivalent)
- [ ] Build succeeds: `npm run build` (or equivalent)
- [ ] Lint passing: `npm run lint` (if applicable)
- [ ] No console errors/warnings

### Schema & Database
- [ ] Schema validated: `scripts/validate-schema.sh` (if applicable)
- [ ] Migrations reviewed
- [ ] Backup created: `scripts/backup.sh` (or manual)
- [ ] Rollback plan documented

### Git Status
- [ ] All changes committed
- [ ] Pushed to GitHub: `git push origin <branch>`
- [ ] Branch: [branch-name]
- [ ] Commit: [short-sha]

### Configuration
- [ ] Environment variables updated (if needed)
- [ ] Secrets rotated (if needed)
- [ ] Feature flags configured (if applicable)

### Dependencies
- [ ] npm packages up to date
- [ ] Security vulnerabilities checked: `npm audit`
- [ ] Docker images built (if applicable)

---

## Deploy

### Deployment Steps

**Option A: Docker Compose**
```bash
cd [PROJECT_PATH]
git pull origin [BRANCH]
docker compose build [SERVICE]
docker compose up -d [SERVICE]
```

**Option B: Direct**
```bash
cd [PROJECT_PATH]
git pull origin [BRANCH]
npm install (if package.json changed)
npm run build
pm2 restart [APP] (or equivalent)
```

**Option C: Manual**
```bash
# Document your custom deployment steps here
```

### Verification During Deploy
- [ ] Containers started: `docker compose ps` (if applicable)
- [ ] No error logs during startup
- [ ] Health endpoint responds: `curl http://localhost:[PORT]/health`

---

## Post-Deploy

### Smoke Tests
- [ ] Homepage loads
- [ ] API endpoints respond
- [ ] Database connectivity working
- [ ] External integrations working (if applicable)

### Critical User Flows
- [ ] [Critical flow 1] - [e.g., User can log in]
- [ ] [Critical flow 2] - [e.g., User can create content]
- [ ] [Critical flow 3] - [e.g., Payment processing works]

### Monitoring
- [ ] Logs checked: `docker compose logs -f [SERVICE]` (or equivalent)
- [ ] Error rate normal (if monitoring exists)
- [ ] Response times normal (if monitoring exists)
- [ ] No unexpected errors in logs (last 5 minutes)

### Documentation
- [ ] CHANGELOG.md updated
- [ ] Deployment logged: [date, time, version, deployer]
- [ ] Team notified (if applicable)

---

## Rollback Plan (If Deploy Fails)

### Rollback Steps
```bash
# Option A: Revert to previous commit
git revert [COMMIT_SHA]
git push origin [BRANCH]
[REDEPLOY_COMMAND]

# Option B: Checkout previous commit
git checkout [PREVIOUS_COMMIT]
[REDEPLOY_COMMAND]

# Option C: Restore from backup
[RESTORE_COMMANDS]
```

### Database Rollback
```bash
# If migrations applied, rollback:
[MIGRATION_ROLLBACK_COMMAND]

# If data changed, restore backup:
[RESTORE_BACKUP_COMMAND]
```

### Verification After Rollback
- [ ] Service running
- [ ] Health check passing
- [ ] Critical flows working

---

## Deployment Log

**Date:** [YYYY-MM-DD HH:MM TZ]  
**Deployer:** [Name/Agent]  
**Version/Commit:** [sha/tag]  
**Environment:** [production/staging/dev]  
**Status:** [✅ success / ❌ rolled back / ⚠️ partial]

**Changes Deployed:**
- [Feature 1]
- [Bug fix 2]
- [Dependency update 3]

**Issues Encountered:**
- [Issue 1] - [Resolution]
- [None]

**Performance Impact:**
- Downtime: [X seconds/minutes]
- Errors: [count]
- Rollback required: [yes/no]

**Notes:**
[Any additional context about this deployment]

---

## Contacts

**On-Call:** [Contact info]  
**Escalation:** [Contact info]  
**Documentation:** [Link to docs]  
**Monitoring:** [Link to dashboard]
