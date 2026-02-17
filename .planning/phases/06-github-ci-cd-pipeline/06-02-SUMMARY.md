---
phase: 06-github-ci-cd-pipeline
plan: 2
subsystem: CI/CD
tags: [deployment, github-actions, ssh, health-check, pm2]

dependency_graph:
  requires:
    - 06-01-PLAN.md (CI validation pipeline)
    - 05-01-PLAN.md (deploy.sh and PM2 configuration)
    - 02-04-PLAN.md (health check endpoint)
  provides:
    - Automated production deployment on main merge
    - Health check verification in deployment process
    - Concurrency controls for stateful Signal bot
  affects:
    - scripts/deploy.sh (enhanced with health verification)
    - VPS deployment reliability

tech_stack:
  added:
    - appleboy/ssh-action@v1
  patterns:
    - GitHub Actions concurrency controls
    - SSH-based deployment
    - Post-restart health verification

key_files:
  created:
    - .github/workflows/deploy.yml
  modified:
    - scripts/deploy.sh

decisions:
  - summary: "Use appleboy/ssh-action for VPS deployment"
    reasoning: "Official GitHub-recommended SSH action with timeout controls and multi-step support"
  - summary: "Set cancel-in-progress: false for deployment concurrency"
    reasoning: "Critical for Signal bot state - never interrupt an in-progress deployment to protect message handling and registration state"
  - summary: "Add health check to deploy.sh script"
    reasoning: "Benefits both automated and manual deployments - centralizes verification logic"
  - summary: "Use GitHub environment 'production' for secret isolation"
    reasoning: "Provides deployment branch protection and environment-level secret management"

metrics:
  duration_minutes: 1.0
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_at: 2026-02-17T06:45:14Z
---

# Phase 06 Plan 02: Production Deployment Workflow Summary

**One-liner:** Automated SSH deployment to VPS with health verification and concurrency controls protecting Signal bot state

## Objective Completion

Created production deployment workflow that triggers on main branch pushes, executes deploy.sh via SSH, and verifies application health. Enhanced deploy.sh with health check verification that benefits both automated and manual deployments.

## Tasks Completed

| Task | Name                                                | Type | Commit  | Status   |
| ---- | --------------------------------------------------- | ---- | ------- | -------- |
| 1    | Enhance deploy.sh with health check verification    | auto | c541b57 | Complete |
| 2    | Create deployment workflow with concurrency control | auto | 88adde5 | Complete |

## Verification Results

All verification criteria passed:

- [x] `scripts/deploy.sh` has health check verification after PM2 restart
- [x] `.github/workflows/deploy.yml` exists with SSH-based deployment
- [x] Deploy workflow has `concurrency: cancel-in-progress: false`
- [x] Deploy workflow uses `environment: production`
- [x] Deploy workflow uses `appleboy/ssh-action@v1` with secrets for host, username, key, port
- [x] Deploy workflow has `workflow_dispatch` for manual triggers
- [x] Deploy workflow has `timeout-minutes: 15`

## Deviations from Plan

None - plan executed exactly as written.

## Key Artifacts Created

### .github/workflows/deploy.yml

Production deployment workflow with:

- Triggers: push to main + workflow_dispatch for manual deployments
- Concurrency group `production-deployment` with cancel-in-progress: false
- GitHub environment `production` for secret isolation and branch protection
- Two-step SSH deployment: execute deploy.sh, then verify health check
- 15-minute timeout with 10m command timeouts
- Uses appleboy/ssh-action@v1 with VPS credentials from secrets

### scripts/deploy.sh enhancements

Added post-restart health verification:

- Wait 5 seconds for application startup
- Verify health endpoint with `curl -f http://localhost:3000/health`
- Show PM2 logs and exit 1 on health check failure
- Benefits both GitHub Actions deployments and manual SSH deployments

## Technical Notes

**Concurrency strategy:** `cancel-in-progress: false` is critical for the Signal bot's stateful nature. Interrupting a deployment mid-process could corrupt the bot's registration state or cause message handling issues. Failed deployments will be detected by health checks rather than cancellation.

**Health verification flow:**

1. deploy.sh verifies health after PM2 restart
2. GitHub Actions workflow verifies health again as final step
3. Double verification ensures both script-level and workflow-level confidence

**Secrets required:** User must configure in GitHub:

- `VPS_HOST` - VPS IP or hostname
- `VPS_USERNAME` - SSH username
- `VPS_PORT` - SSH port (e.g., 22)
- `VPS_SSH_PRIVATE_KEY` - Full private key (stored in production environment)

**Production environment:** Must be created in GitHub repo settings with deployment branch restriction to `main` only.

## Integration Points

- **Links to:** 06-01 CI validation (runs before deployment), 05-01 deploy.sh and PM2 config, 02-04 health endpoint
- **Enables:** Continuous deployment on main branch merges
- **Protects:** Signal bot state via concurrency controls

## Success Criteria Met

Deployment pipeline fully configured: deploy.sh enhanced with health check verification (benefits both manual and automated deployments), and deploy.yml workflow automates VPS deployment on main merge with concurrency controls protecting Signal bot state.

## Self-Check

Verifying claims before state updates:

```
FOUND: .github/workflows/deploy.yml
FOUND: c541b57
FOUND: 88adde5
```

**Status: PASSED**

All created files exist and all commits are in git history.
