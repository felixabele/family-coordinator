# Roadmap: Family Coordinator

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-16)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-16</summary>

- [x] Phase 1: Foundation & Signal Infrastructure (3/3 plans) — completed 2026-02-14
- [x] Phase 2: Calendar Integration & CRUD (2/2 plans) — completed 2026-02-14
- [x] Phase 3: Multi-User & Polish (2/2 plans) — completed 2026-02-15
- [x] Phase 4: Advanced Features (2/2 plans) — completed 2026-02-16

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

## Progress

| Phase                                 | Milestone | Plans Complete | Status   | Completed  |
| ------------------------------------- | --------- | -------------- | -------- | ---------- |
| 1. Foundation & Signal Infrastructure | v1.0      | 3/3            | Complete | 2026-02-14 |
| 2. Calendar Integration & CRUD        | v1.0      | 2/2            | Complete | 2026-02-14 |
| 3. Multi-User & Polish                | v1.0      | 2/2            | Complete | 2026-02-15 |
| 4. Advanced Features                  | v1.0      | 2/2            | Complete | 2026-02-16 |

### Phase 5: Deployment

**Goal:** Deploy the Family Coordinator Signal bot to a production VPS with PM2 process management, PostgreSQL via apt, automated pg_dump backups, and health monitoring -- bare metal, no Docker, no reverse proxy.
**Depends on:** v1.0 MVP
**Plans:** 2 plans

Plans:

- [x] 05-01-PLAN.md — Health check endpoint, PM2 config, deploy script, backup script
- [ ] 05-02-PLAN.md — VPS deployment and verification checkpoint

### Phase 6: GitHub CI/CD Pipeline

**Goal:** Automate code validation and production deployment with GitHub Actions -- CI validates formatting, type safety, and tests on every push/PR; CD deploys to VPS via SSH on main merge with concurrency controls protecting Signal bot state.
**Depends on:** Phase 5
**Plans:** 2 plans — completed 2026-02-17

Plans:

- [x] 06-01-PLAN.md -- CI validation pipeline (format check, typecheck, tests) + dependency review
- [x] 06-02-PLAN.md -- Production deployment workflow with health check verification

---

_Roadmap created: 2026-02-13_
_Last updated: 2026-02-17 — Phase 6 GitHub CI/CD Pipeline complete_
