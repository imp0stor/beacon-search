# Shared UI Rollback Guide

## Quick Rollback (< 1 minute)

### Method 1: Environment Variable
```bash
# Set in your deployment environment
export NEXT_PUBLIC_SHARED_UI_ENABLED=false

# Rebuild and deploy
npm run build && npm run deploy
```

### Method 2: LocalStorage (Client-Side)
```javascript
// Open browser console on any page
window.sharedUIDebug.disable()
// Reload page
location.reload()
```

### Method 3: Feature Flag Config
```javascript
// Edit your app config
const FEATURE_FLAGS = {
  SHARED_UI_ENABLED: false, // ← Set to false
};
```

## Full Rollback (Git Revert)

If feature flags aren't working or you need a complete rollback:

```bash
# Find the pre-migration commit
git log --oneline --grep="shared-ui" | tail -1

# Revert all changes since migration started
git revert --no-commit <commit-hash>^..HEAD

# Commit the revert
git commit -m "Rollback: shared-ui migration wave 1"

# Deploy
git push origin main
npm run deploy
```

## Trigger Conditions

Rollback immediately if:

- ❌ Critical payment flow breaks (NostrMaxi)
- ❌ User-reported visual regressions >5 in 1 hour
- ❌ Performance regression >20% (LCP, FID)
- ❌ Accessibility score drops below 85
- ❌ Build failure or deployment blocking

## Post-Rollback Steps

1. **Document the issue**
   - What broke?
   - When did it break?
   - Which users were affected?

2. **Create regression test**
   - Add test case for the failure
   - Ensure CI catches it next time

3. **Fix root cause**
   - Fix in shared-ui package
   - Test locally
   - Test in staging

4. **Re-attempt migration**
   - Smaller incremental deploy
   - Monitor closely
   - Have rollback ready

## Validation After Rollback

- [ ] All critical user flows working
- [ ] No console errors
- [ ] Performance metrics restored
- [ ] User complaints stopped
- [ ] Monitoring dashboards green

## Prevention for Next Attempt

- Run visual regression tests (Percy/Chromatic)
- A/B test with small user percentage first
- Deploy during low-traffic hours
- Have team standing by for 1 hour post-deploy
- Monitor error tracking (Sentry/Rollbar) in real-time

## Contact

If you need help with rollback:
- **Primary:** @imp0stor
- **Emergency:** See #incidents Slack channel
