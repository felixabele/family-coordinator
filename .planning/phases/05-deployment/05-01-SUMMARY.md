---
phase: 05-deployment
plan: 01
subsystem: deployment
tags: [deployment, pm2, health-check, backup, infrastructure]
dependency_graph:
  requires: [database, signal-client, app-startup]
  provides: [health-endpoint, pm2-config, deploy-automation, backup-automation]
  affects: [monitoring, operations, production]
tech_stack:
  added: [pm2, native-http-server]
  patterns:
    [health-check, graceful-shutdown, automated-deployment, database-backup]
key_files:
  created:
    - src/health.ts
    - ecosystem.config.cjs
    - .env.production.example
    - scripts/deploy.sh
    - scripts/backup.sh
    - logs/.gitkeep
  modified:
    - src/index.ts
    - .gitignore
decisions:
  - "Use Node.js built-in http module for health check to avoid dependencies"
  - "Health server stops first during shutdown for monitoring visibility"
  - "PM2 single fork instance with 500M memory limit for VPS deployment"
  - "PostgreSQL backups with 7-day retention using pg_dump + gzip"
  - "Deploy script uses npm ci --omit=dev for production builds"
metrics:
  duration: 157
  completed: 2026-02-16T12:51:22Z
---

# Phase 01 Plan 01: Production Deployment Artifacts Summary

**One-liner:** Created bare-metal VPS deployment infrastructure with native HTTP health check, PM2 process management, automated deploy script, and PostgreSQL backup automation.

## Plan Objective

Create all production deployment artifacts: health check endpoint integrated into the app, PM2 ecosystem config, production env template, deploy script, and backup script for bare-metal VPS deployment with PM2 process management, automated backups, and health monitoring.

## Tasks Completed

| Task | Name                                                          | Status | Commit  |
| ---- | ------------------------------------------------------------- | ------ | ------- |
| 1    | Add lightweight HTTP health check endpoint                    | ✓      | 8c171e4 |
| 2    | Create PM2 config, deploy script, backup script, env template | ✓      | 49a02b9 |

## What Was Built

### Health Check Endpoint (Task 1)

Created `src/health.ts` with a lightweight HTTP health check server using Node.js built-in `http` module (zero dependencies):

- Listens on port 3000 (configurable via `HEALTH_PORT` env var)
- Responds to `GET /health` with JSON status including database connectivity check
- Returns HTTP 200 for healthy, HTTP 503 for unhealthy
- Exports `startHealthServer()` and `stopHealthServer()` for lifecycle management

Integrated into `src/index.ts`:

- Starts health server after Signal client connects (step 7)
- Logs health check port on startup
- Stops health server first during graceful shutdown (before Signal client) so monitoring systems see it go down

### PM2 Configuration (Task 2)

Created `ecosystem.config.cjs` with PM2 process configuration:

- Single fork instance (no clustering)
- Node.js native TypeScript execution with `--experimental-strip-types`
- Uses `--env-file=.env.production` for environment variables
- 500M memory limit with auto-restart
- Log rotation to `./logs/error.log` and `./logs/output.log`
- Crash protection with 10 max restarts and 5s delay

### Production Environment Template (Task 2)

Created `.env.production.example` with:

- All required environment variables documented
- PostgreSQL setup instructions (apt install, createdb, createuser, grant)
- Production-specific values (NODE_ENV=production, LOG_LEVEL=info)
- HEALTH_PORT configuration
- Absolute paths for service account key file

### Deploy Script (Task 2)

Created `scripts/deploy.sh` for automated deployment:

1. Git pull (fast-forward only for safety)
2. npm ci --omit=dev (production dependencies)
3. Run database migrations
4. PM2 restart or start
5. PM2 save process list
6. Show PM2 status

### Backup Script (Task 2)

Created `scripts/backup.sh` for PostgreSQL backups:

- Creates timestamped `pg_dump` backups compressed with gzip
- Stores in `$HOME/backups/family-coordinator/`
- Automatic cleanup of backups older than 7 days
- Includes crontab instructions for daily 2 AM backups

### Infrastructure Updates (Task 2)

- Updated `.gitignore` to exclude `logs/` and `.env.production`
- Created `logs/.gitkeep` for PM2 log output directory
- Made both scripts executable (`chmod +x`)

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Native HTTP module for health check**: Avoided Express/Fastify to keep health endpoint dependency-free and lightweight
2. **Health server shutdown order**: Stop health server first during graceful shutdown so monitoring systems can detect the application going down before internal services disconnect
3. **PM2 single fork mode**: Use fork mode (not cluster) for this Signal bot use case where single-instance is appropriate
4. **7-day backup retention**: Balanced disk space usage with recovery needs for a family calendar application

## Verification Results

All verification checks passed:

- ✓ TypeScript compiles without errors (`npx tsc --noEmit`)
- ✓ All files pass Prettier formatting (`npm run format:check`)
- ✓ Shell scripts have valid syntax (`bash -n`)
- ✓ Health module exports startHealthServer and stopHealthServer
- ✓ src/index.ts integrates health server in startup and shutdown
- ✓ ecosystem.config.cjs uses `--env-file=.env.production --experimental-strip-types`
- ✓ Scripts are executable (`chmod +x`)
- ✓ .gitignore contains `logs/` and `.env.production`

## Success Criteria Met

All success criteria achieved:

- ✓ All production deployment artifacts exist and are syntactically valid
- ✓ Health check endpoint is integrated into the application lifecycle
- ✓ PM2 can manage the app using ecosystem.config.cjs
- ✓ Deploy and backup scripts are ready for use on VPS

## Files Created

| File                    | Purpose                                 | Lines |
| ----------------------- | --------------------------------------- | ----- |
| src/health.ts           | Lightweight HTTP health check server    | 100   |
| ecosystem.config.cjs    | PM2 process management config           | 18    |
| .env.production.example | Production environment template         | 34    |
| scripts/deploy.sh       | Deployment automation script            | 25    |
| scripts/backup.sh       | PostgreSQL backup script with retention | 27    |
| logs/.gitkeep           | PM2 log output directory marker         | 0     |

## Files Modified

| File         | Changes                                              |
| ------------ | ---------------------------------------------------- |
| src/index.ts | Added health server import and lifecycle integration |
| .gitignore   | Added logs/ and .env.production exclusions           |

## Integration Points

- **src/index.ts → src/health.ts**: Imports and manages health server lifecycle
- **ecosystem.config.cjs → src/index.ts**: PM2 entry point
- **scripts/deploy.sh → src/db/migrate.ts**: Runs migrations during deployment
- **scripts/backup.sh → PostgreSQL**: Database backup via pg_dump

## Next Steps

Ready for VPS deployment:

1. Copy `.env.production.example` to `.env.production` and fill in secrets
2. Install PostgreSQL and create database/user
3. Install PM2 globally: `npm install -g pm2`
4. Run initial deployment: `./scripts/deploy.sh`
5. Configure PM2 startup: `pm2 startup` and follow instructions
6. Add backup to crontab: `crontab -e` and add backup.sh schedule
7. Verify health endpoint: `curl http://localhost:3000/health`

## Self-Check: PASSED

Verified all claimed files exist:

```bash
$ ls -la src/health.ts ecosystem.config.cjs .env.production.example scripts/deploy.sh scripts/backup.sh logs/.gitkeep
-rw-r--r--  1 fabele  staff  1436 16 Feb 13:48 .env.production.example
-rw-r--r--  1 fabele  staff   457 16 Feb 13:47 ecosystem.config.cjs
-rw-r--r--  1 fabele  staff     0 16 Feb 13:50 logs/.gitkeep
-rwxr-xr-x  1 fabele  staff   787 16 Feb 13:50 scripts/backup.sh
-rwxr-xr-x  1 fabele  staff   543 16 Feb 13:50 scripts/deploy.sh
-rw-r--r--  1 fabele  staff  2654 16 Feb 13:46 src/health.ts
```

Verified commits exist:

```bash
$ git log --oneline -2
49a02b9 feat(01-deployment-01): add PM2 config, deploy script, backup script, and production env template
8c171e4 feat(01-deployment-01): add lightweight HTTP health check endpoint
```

All files created and commits recorded successfully.
