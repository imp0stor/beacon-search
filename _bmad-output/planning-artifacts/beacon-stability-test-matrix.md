# Beacon Stability Test Matrix

| ID | Requirement | Test Type | Command / Method | Expected | Evidence |
|---|---|---|---|---|---|
| TM-1 | NFR1 backend compiles | Build | `cd backend && npm run build` | Exit 0 | PASS |
| TM-2 | FR2 WoT-capable search compile path | Build + existing tests | `cd backend && npm run test` | Exit 0 | PASS |
| TM-3 | FR5 media parser robustness | Unit | `backend/tests/quality.test.js` | All assertions pass | PASS |
| TM-4 | NFR2 frontend compiles with UX components | Build | `cd frontend && npm run build` | Exit 0 | PASS |
| TM-5 | Repo-level integration script execution | Integration script | `bash ./test-p1-features.sh` | API reachable + JSON responses | BLOCKED (API not running in test host) |

## Notes
- Integration script depends on a running backend at `http://localhost:3001` and accessible DB-backed data.
- Docker-based end-to-end validation is blocked on this host (`docker` command unavailable).
