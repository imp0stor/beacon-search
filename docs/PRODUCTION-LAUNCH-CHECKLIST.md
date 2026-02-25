# Beacon Search Production Launch Checklist

- [ ] DNS setup complete (e.g., `beacon.strangesignal.ai`)
- [ ] TLS certificate issued and auto-renewal enabled (Let's Encrypt)
- [ ] Environment variables reviewed (no test/dev values)
- [ ] Rate limiting configured on API/reverse proxy
- [ ] CORS origins explicitly whitelisted
- [ ] Monitoring and alerts configured (API latency, error rate, DB health, disk)
- [ ] Backup schedule confirmed and restore test completed
- [ ] Capacity planning documented (storage growth, CPU/RAM headroom, concurrency)
- [ ] Support channels documented (owner, escalation path, incident comms)

## Pre-launch smoke tests
- [ ] `GET /api/health` (or equivalent) returns healthy
- [ ] Search endpoint returns results for known term
- [ ] Connector sync run completes
- [ ] Admin login + route protection verified
- [ ] Browser checks at 320/375/768/1024 widths
- [ ] Keyboard-only navigation works for critical flows

## Launch day controls
- [ ] Rollback procedure rehearsed
- [ ] Read-only maintenance mode plan available
- [ ] On-call owner assigned for first 24h
- [ ] Post-launch metrics review scheduled
