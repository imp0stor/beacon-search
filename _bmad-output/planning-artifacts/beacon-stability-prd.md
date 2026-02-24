# Beacon Stability PRD

## Objective
Stabilize Beacon Search for build + runtime readiness based on newly defined integration docs (plugin/WoT wiring, UX bundle routes/components, verification findings).

## In-Scope
1. Preserve green backend/frontend builds.
2. Ensure WoT/plugin integration is wired and compile-safe.
3. Ensure UX bundle routes/components are wired for runtime use.
4. Add/refresh automated tests for changed stability-critical logic.
5. Run verification commands and record evidence.

## Out-of-Scope (for this wave)
- Full SQL connector implementation (Phase 1 parity).
- Full permission filtering framework (Phase 2 parity).
- Full binary extraction parity.

## Functional Requirements
- FR1: Backend exposes health endpoint and boots without hard crash if embedding preload fails.
- FR2: Search API accepts WoT params (`user_pubkey`, `wot_enabled`) and applies score modifier when provided.
- FR3: UX search/tag endpoints remain available and frontend can consume them.
- FR4: Search UI supports tag/quality/media filtering with infinite-scroll component.
- FR5: Media rendering logic tolerates JSON string, JSON array, or absent media payloads.

## Non-Functional Requirements
- NFR1: `backend npm run build` succeeds.
- NFR2: `frontend npm run build` succeeds.
- NFR3: Unit tests pass for touched feature set.

## Acceptance Criteria
1. Backend build/tests pass.
2. Frontend build passes.
3. New/updated tests cover quality/media parsing behavior.
4. Integration script execution evidence included; blockers explicitly documented.
5. Deliverables include file-level change log + command outcomes.
