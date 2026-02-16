# Phase 1: Deployment - Research

**Researched:** 2026-02-16
**Domain:** Production deployment of Signal bot with Node.js, PostgreSQL, and Google Calendar
**Confidence:** MEDIUM-HIGH

## Summary

Deploying the Family Coordinator Signal bot requires orchestrating four critical components: (1) a long-running Node.js daemon with signal-cli, (2) PostgreSQL database with backup strategy, (3) secure credential management for Signal registration, Google service account, and Anthropic API keys, and (4) production-grade monitoring and logging infrastructure.

The architecture differs fundamentally from typical web applications: this is a stateful, event-driven daemon that must maintain persistent connections to Signal's messaging infrastructure and respond to real-time messages. The deployment cannot use serverless platforms or auto-scaling container orchestration—it requires a single persistent instance with guaranteed uptime.

Critical deployment considerations unique to Signal bots: (a) signal-cli registration requires a dedicated phone number that cannot be shared with other devices, (b) the bot must regularly receive messages or Signal will flag the account as inactive and potentially delete it, (c) signal-cli data including cryptographic keys must persist across restarts, and (d) the daemon architecture means zero-downtime deployments are not possible without implementing a message queue.

**Primary recommendation:** Deploy as a containerized application using Docker Compose on a single VPS with PM2 for process management, automated PostgreSQL backups, proper secrets management via Docker secrets or environment variables with the `_FILE` pattern, comprehensive health checks, and structured logging to a centralized log aggregation service.

## Standard Stack

### Core

| Library                | Version       | Purpose                       | Why Standard                                                                                                                                                                                 |
| ---------------------- | ------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker**             | 24.x+         | Containerization platform     | Industry standard for consistent deployment environments; enables reproducible builds and simplified dependency management                                                                   |
| **Docker Compose**     | 2.x+          | Multi-container orchestration | De facto standard for defining and running multi-container applications; simplifies signal-cli + PostgreSQL + app coordination                                                               |
| **PM2**                | Latest (5.x+) | Node.js process manager       | Leading production process manager for Node.js; offers zero-downtime reloads, cluster mode, automatic restarts, and built-in monitoring—specifically designed for Node.js vs generic systemd |
| **PostgreSQL**         | 16.x          | Relational database           | Current stable version already used in development; proven reliability for conversation state and idempotency tracking                                                                       |
| **Caddy** or **Nginx** | Latest        | Reverse proxy with HTTPS      | Caddy offers automatic HTTPS with Let's Encrypt (zero config); Nginx provides maximum performance and control. Both terminate SSL and forward to Node.js app                                 |

### Supporting

| Library                           | Version            | Purpose                | When to Use                                                                                                                   |
| --------------------------------- | ------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **pg_dump / pgbackup**            | Matches PostgreSQL | Database backups       | Essential for production—automate daily backups with retention policy; use docker-pg-backup sidecar or cron-scheduled pg_dump |
| **winston** or **pino**           | Latest             | Structured logging     | App already uses Pino; ensure JSON-formatted logs for log aggregation tools (Better Stack, DataDog, ELK)                      |
| **signal-cli**                    | Latest stable      | Signal protocol client | Must be kept up-to-date (releases older than 3 months may fail); provides JSON-RPC daemon interface for Node.js communication |
| **Doppler** or **Docker Secrets** | N/A                | Secrets management     | Use Docker secrets for swarm/compose deployments or Doppler for centralized secret management across environments             |

### Alternatives Considered

| Instead of                   | Could Use                      | Tradeoff                                                                                                                                                                                     |
| ---------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VPS (RunCloud, DigitalOcean) | PaaS (Render, Railway, Heroku) | PaaS simplifies deployment but may not support signal-cli daemon requirements; VPS offers full control for custom daemon setup                                                               |
| PM2                          | systemd                        | systemd has zero overhead but PM2 offers Node.js-specific features (cluster mode, zero-downtime reload, built-in monitoring); PM2 can integrate with systemd for OS-level service management |
| Caddy                        | Nginx                          | Caddy: automatic HTTPS, simpler config (~15-25% smaller); Nginx: maximum performance, more mature, better for complex routing                                                                |
| Docker secrets               | Environment variables          | Docker secrets mount as files in /run/secrets/, never stored in env or logs; environment variables are simpler but easier to leak in logs and crash dumps                                    |
| Managed PostgreSQL           | Self-hosted in Docker          | Managed (AWS RDS, Digital Ocean managed DB): automated backups, scaling, patches; Self-hosted: lower cost, full control, requires manual backup strategy                                     |

**Installation:**

```bash
# On VPS with Ubuntu/Debian
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install signal-cli (required on host or in dedicated container)
# Option 1: Native installation
wget https://github.com/AsamK/signal-cli/releases/download/v0.x.x/signal-cli-0.x.x.tar.gz
tar xf signal-cli-0.x.x.tar.gz -C /opt
ln -sf /opt/signal-cli-0.x.x/bin/signal-cli /usr/local/bin/

# Option 2: Use bbernhard/signal-cli-rest-api Docker image
# (provides REST API wrapper around signal-cli)

# Install PM2 globally for process management
npm install -g pm2

# Setup PM2 to start on system boot
pm2 startup systemd
```

## Architecture Patterns

### Recommended Deployment Structure

```
/opt/family-coordinator/           # Application root on VPS
├── docker-compose.yml             # Services: app, postgres, pg-backup
├── .env.production                # Non-sensitive config (NODE_ENV, ports)
├── secrets/                       # Mounted as Docker secrets or volumes
│   ├── anthropic-api-key
│   ├── google-service-account.json
│   └── signal-phone-number
├── data/                          # Persistent volumes
│   ├── postgres/                  # Database data
│   ├── backups/                   # Automated backups
│   └── signal-cli/                # Signal account data & keys
├── logs/                          # Application logs (JSON format)
└── family-members.json            # Family whitelist config
```

### Pattern 1: Docker Compose Multi-Service Setup

**What:** Define all services (Node.js app, PostgreSQL, backup service) in a single docker-compose.yml with health checks, restart policies, and volume mounts.

**When to use:** Production deployment on single VPS; enables atomic updates and coordinated service management.

**Example:**

```yaml
# docker-compose.production.yml
version: "3.9"

services:
  app:
    build: .
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL_FILE: /run/secrets/db_url # Read from secret file
    secrets:
      - db_url
      - anthropic_key
      - google_service_account
    volumes:
      - ./data/signal-cli:/home/.local/share/signal-cli
      - ./family-members.json:/app/family-members.json:ro
      - ./logs:/app/logs
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:3000/health')",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: family_coordinator
    secrets:
      - db_password
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  pg-backup:
    image: kartoza/docker-pg-backup
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PASS_FILE: /run/secrets/db_password
      POSTGRES_DBNAME: family_coordinator
      BACKUP_DIR: /backups
      CRON_SCHEDULE: "0 2 * * *" # Daily at 2 AM
      REMOVE_BEFORE: 7 # Keep 7 days of backups
    secrets:
      - db_password
    volumes:
      - ./data/backups:/backups
    depends_on:
      - postgres

secrets:
  db_url:
    file: ./secrets/database-url.txt
  db_password:
    file: ./secrets/db-password.txt
  anthropic_key:
    file: ./secrets/anthropic-api-key.txt
  google_service_account:
    file: ./secrets/google-service-account.json

networks:
  default:
    driver: bridge
```

### Pattern 2: PM2 Ecosystem File for Process Management

**What:** Define application processes, environment, and monitoring in a PM2 ecosystem.config.js file for production process management.

**When to use:** When running Node.js directly on VPS (not containerized) or as additional layer inside container for cluster mode and auto-restart.

**Example:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "family-coordinator",
      script: "src/index.ts",
      interpreter: "node",
      interpreter_args: "--experimental-strip-types --env-file=.env.production",
      instances: 1, // Signal bot must be single instance (stateful)
      exec_mode: "fork", // Not cluster - single persistent connection
      autorestart: true,
      watch: false, // Disable in production
      max_memory_restart: "500M",
      env_production: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      },
      error_file: "./logs/error.log",
      out_file: "./logs/output.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Health check configuration
      min_uptime: "15m", // Require 15 min uptime before considering healthy
      max_restarts: 5, // Max restart attempts
      restart_delay: 4000, // Wait 4s between restarts
    },
  ],
};
```

### Pattern 3: Secrets via Environment Variables with \_FILE Suffix

**What:** Read secrets from files mounted in container, with fallback to direct environment variables for local development.

**When to use:** When using Docker secrets or mounted secret files; prevents secrets from appearing in logs or process listings.

**Example:**

```typescript
// src/config/secrets.ts
import { readFileSync } from "fs";

/**
 * Read secret from file path or direct environment variable
 * Follows Docker secrets convention: ENV_VAR_FILE takes precedence
 */
function getSecret(secretName: string): string {
  const fileEnvVar = `${secretName}_FILE`;
  const filePath = process.env[fileEnvVar];

  if (filePath) {
    try {
      return readFileSync(filePath, "utf-8").trim();
    } catch (error) {
      throw new Error(
        `Failed to read secret from ${filePath}: ${error.message}`,
      );
    }
  }

  const directValue = process.env[secretName];
  if (directValue) {
    return directValue;
  }

  throw new Error(`Secret ${secretName} not found in env or file`);
}

// Usage in env.ts
const envSchema = z.object({
  // ... other fields
  ANTHROPIC_API_KEY: z
    .string()
    .transform((val) => getSecret("ANTHROPIC_API_KEY")),
  DATABASE_URL: z.string().transform((val) => getSecret("DATABASE_URL")),
});
```

### Pattern 4: Health Check Endpoint

**What:** Expose /health endpoint that verifies database connection and critical dependencies without expensive operations.

**When to use:** Required for production monitoring, Docker healthchecks, and load balancer health probes.

**Example:**

```typescript
// src/health.ts
import { pool } from "./db/pool.js";
import type { SignalClient } from "./signal/client.js";

export async function checkHealth(signalClient: SignalClient) {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      signal: false,
    },
  };

  try {
    // Quick database check (don't run expensive queries)
    await pool.query("SELECT 1");
    health.checks.database = true;
  } catch (error) {
    health.status = "unhealthy";
    logger.error({ error }, "Database health check failed");
  }

  try {
    // Verify signal-cli daemon is reachable
    const isConnected = signalClient.isConnected();
    health.checks.signal = isConnected;
    if (!isConnected) {
      health.status = "degraded";
    }
  } catch (error) {
    health.status = "degraded";
    logger.error({ error }, "Signal health check failed");
  }

  return health;
}
```

### Anti-Patterns to Avoid

- **Storing secrets in git or Docker images:** Service account keys, API keys, and phone numbers must never be committed to version control or baked into images. Use Docker secrets, mounted volumes, or secrets managers.
- **Running signal-cli daemon in cluster mode:** Signal bot requires single persistent instance—clustering breaks stateful Signal protocol session.
- **Hardcoding phone numbers in code:** Family whitelist must be externalized to family-members.json for easy updates without code changes.
- **No backup strategy:** Database contains conversation history and state; backup failures mean data loss. Automate backups with retention policy.
- **Missing log aggregation:** Relying on local log files makes debugging production issues difficult. Use structured JSON logging with centralized collection.

## Don't Hand-Roll

| Problem                          | Don't Build                     | Use Instead                                     | Why                                                                                                                                                |
| -------------------------------- | ------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database backups**             | Custom backup scripts with cron | docker-pg-backup, pg_dump automation            | Handles compression, rotation, cleanup, error handling, and supports multiple backup strategies (daily, weekly, monthly retention)                 |
| **HTTPS certificate management** | Manual Let's Encrypt scripts    | Caddy (automatic) or Certbot                    | Caddy automatically obtains, renews, and manages certificates; Certbot automates Let's Encrypt with battle-tested renewal logic                    |
| **Process supervision**          | Custom restart scripts          | PM2 or systemd                                  | PM2 handles crash recovery, log rotation, cluster management, and monitoring; systemd provides OS-level service management with proven reliability |
| **Log rotation**                 | Custom logrotate configs        | PM2 log management or Docker logging drivers    | PM2 and Docker handle rotation, compression, and cleanup automatically with configurable size/time limits                                          |
| **Health monitoring**            | Custom ping scripts             | Docker healthchecks + external monitoring       | Docker's built-in healthcheck system integrates with restart policies; external monitoring (UptimeRobot, Better Stack) provides alerting           |
| **Secrets rotation**             | Manual key updates              | Secrets managers (Doppler, AWS Secrets Manager) | Automated rotation, audit logs, access control, and environment synchronization—critical for Google service account keys                           |

**Key insight:** Signal bot deployment combines multiple complex operational domains (containerization, database management, secrets handling, process supervision, SSL termination). Using proven tools for each domain reduces risk of subtle bugs in custom scripts that only surface during production incidents.

## Common Pitfalls

### Pitfall 1: Signal Account Deletion Due to Inactivity

**What goes wrong:** Signal's servers flag accounts as inactive if messages aren't regularly received, leading to account deletion and losing the bot's phone number registration.

**Why it happens:** signal-cli documentation states: "You have to use signal-cli receive regularly, otherwise your account will be flagged inactive and potentially deleted." The daemon mode addresses this, but if the daemon is down for extended periods, the account risks deletion.

**How to avoid:**

- Run signal-cli in daemon mode continuously (not just receive-and-exit)
- Implement monitoring to alert if the daemon process stops
- Use PM2 or systemd to auto-restart the process immediately on crash
- Consider sending a daily self-test message to verify the bot is alive

**Warning signs:**

- Bot stops receiving messages but shows no errors
- Signal messages to bot show as "not delivered"
- Signal registration suddenly fails with "number already registered elsewhere"

### Pitfall 2: Losing signal-cli Cryptographic Keys

**What goes wrong:** signal-cli stores account identity, session keys, and encryption state in `~/.local/share/signal-cli/`. If this directory is lost (container restart without volume mount, incorrect permissions, etc.), the phone number becomes permanently unrecoverable—Signal won't let you re-register it without a registration lock PIN.

**Why it happens:** Developers treat signal-cli as stateless, rebuild containers without persistent volumes, or don't backup the .local/share/signal-cli directory.

**How to avoid:**

- **Always mount signal-cli data directory as a persistent volume**
- Set registration lock PIN during initial setup: `signal-cli -u +NUMBER setPin PIN_CODE`
- Backup the entire signal-cli data directory daily (contains private keys)
- Document the registration lock PIN in a secure password manager
- Test recovery process: destroy container, recreate with backed-up volume, verify bot still works

**Warning signs:**

- Container restart causes "account not registered" errors
- Cannot send/receive messages after redeployment
- signal-cli asks for captcha verification on every start

### Pitfall 3: Google Service Account Key Leaked in Logs or Images

**What goes wrong:** Service account JSON key files accidentally end up in:

- Docker images (via COPY in Dockerfile)
- Git repositories (committed .json file)
- Application logs (accidentally logged during debugging)
- Environment variable listings (ps aux, Docker inspect)

A leaked key grants full access to the Google Calendar and potentially other Google Cloud resources.

**Why it happens:** Developers copy key file into Docker image for "convenience," commit it to version control, or log full environment for debugging.

**How to avoid:**

- **Never COPY service account keys into Docker images**
- Use Docker secrets or mount as read-only volume at runtime
- Add `*service-account*.json` to .gitignore and .dockerignore
- Use Google Cloud Workload Identity or short-lived access tokens when possible
- Redact sensitive fields in logs (Pino redact plugin already configured)
- Rotate service account keys quarterly and after any suspected leak
- Monitor Google Cloud audit logs for unexpected Calendar API access

**Warning signs:**

- Service account key visible in `docker history` output
- Git repository shows .json file in history (even if deleted later)
- Logs show full JSON content or private_key field

### Pitfall 4: Database Connection Exhaustion

**What goes wrong:** Application crashes or hangs with "too many clients" PostgreSQL errors, especially during restart loops or in Docker environments.

**Why it happens:**

- Application crashes without closing database pool connections
- Docker restart creates new connections before old ones time out
- Connection pool settings too high relative to PostgreSQL max_connections
- Leaking connections by not releasing them after queries

**How to avoid:**

- Use connection pooling (pg.Pool) with reasonable limits (10-20 for single instance)
- Implement graceful shutdown that closes pool: `process.on('SIGTERM', closePool)`
- Set pool timeouts: `idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000`
- Monitor active connections: `SELECT count(*) FROM pg_stat_activity WHERE datname='family_coordinator'`
- Configure PostgreSQL max_connections appropriately (default 100 is usually fine)

**Warning signs:**

- "sorry, too many clients already" error in logs
- Application hangs on database queries
- `pg_stat_activity` shows many idle connections from old processes

### Pitfall 5: No Monitoring or Alerting for Production

**What goes wrong:** Bot silently fails and no one notices until a family member manually reports issues. Problems could include: Signal daemon crashed, database is full, API quota exceeded, or calendar integration broken.

**Why it happens:** Developers focus on getting bot working but don't set up production observability before launch.

**How to avoid:**

- **Set up external uptime monitoring** (UptimeRobot, Better Stack, Pingdom) to ping health endpoint every 5 minutes
- **Configure log aggregation** with alerting rules for error patterns
- **Monitor disk space** on VPS (PostgreSQL data, backup directory)
- **Track API usage** for Anthropic (token costs) and Google Calendar (quota limits)
- **Set up PagerDuty/email alerts** for critical failures
- **Daily backup verification**: script to restore latest backup to test database

**Warning signs:**

- Discovering outages days later through user reports
- No visibility into why bot stopped responding
- Backups exist but have never been tested for restoration

### Pitfall 6: Missing Idempotency for Deployments

**What goes wrong:** Redeploying the application causes duplicate messages to be sent, events to be created twice, or conversation state to become corrupted.

**Why it happens:** Signal may redeliver messages during daemon restart, and application doesn't properly track which messages have been processed.

**How to avoid:**

- Application already has idempotency table tracking processed message IDs—ensure it's working correctly
- Test deployment process: send message, redeploy app mid-processing, verify no duplicate response
- Implement transaction-safe message processing: mark as processed in same transaction as business logic
- Run idempotency cleanup on startup (app already does this)

**Warning signs:**

- Family members report receiving duplicate responses
- Calendar shows duplicate events after bot restart
- Conversation state gets reset unexpectedly

## Code Examples

Verified patterns from official sources and production deployments:

### Dockerfile for Production Build

```dockerfile
# Multi-stage build for minimal production image
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy application source
COPY . .

# Build TypeScript (if using tsc build step)
RUN npm run build

# Production stage
FROM node:22-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

# Switch to non-root user
USER nodejs

# Expose health check port (if implementing HTTP endpoint)
EXPOSE 3000

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "--env-file=.env", "dist/index.js"]
```

### Production Environment Variables Pattern

```bash
# .env.production (non-sensitive config)
NODE_ENV=production
LOG_LEVEL=info
FAMILY_TIMEZONE=Europe/Berlin

# Reference secrets via _FILE suffix (read from Docker secrets)
SIGNAL_PHONE_NUMBER_FILE=/run/secrets/signal_phone
ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic_key
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/run/secrets/google_service_account
DATABASE_URL_FILE=/run/secrets/database_url
```

### PM2 Startup and Monitoring

```bash
# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list for automatic recovery
pm2 save

# Configure PM2 to start on system boot
pm2 startup systemd

# Monitor application in real-time
pm2 monit

# View logs (last 100 lines)
pm2 logs family-coordinator --lines 100

# Restart with zero-downtime (not applicable for stateful Signal bot, but useful for config updates)
pm2 reload ecosystem.config.js
```

### Nginx Reverse Proxy with SSL Termination

```nginx
# /etc/nginx/sites-available/family-coordinator
server {
    listen 80;
    server_name bot.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bot.example.com;

    # SSL certificate paths (Let's Encrypt via Certbot)
    ssl_certificate /etc/letsencrypt/live/bot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.example.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Health check endpoint (no auth required for monitoring)
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;  # Don't log health checks
    }

    # Admin/metrics endpoints (add auth if implementing)
    location / {
        # Restrict access to admin endpoints
        allow 10.0.0.0/8;  # Internal network
        deny all;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy Reverse Proxy (Simpler Alternative)

```caddyfile
# Caddyfile - automatic HTTPS with Let's Encrypt
bot.example.com {
    reverse_proxy localhost:3000

    # Health check endpoint available without restrictions
    handle /health {
        reverse_proxy localhost:3000
    }
}
```

### PostgreSQL Backup Verification Script

```bash
#!/bin/bash
# backup-verify.sh - Test that backups can be restored
set -e

BACKUP_DIR="/opt/family-coordinator/data/backups"
TEST_DB="family_coordinator_test"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.sql.gz | head -1)

echo "Testing restore of: $LATEST_BACKUP"

# Create temporary test database
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE $TEST_DB;"

# Restore backup to test database
gunzip -c $LATEST_BACKUP | docker compose exec -T postgres psql -U postgres -d $TEST_DB

# Verify critical tables exist
TABLES=$(docker compose exec postgres psql -U postgres -d $TEST_DB -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$TABLES" -gt 0 ]; then
    echo "✅ Backup verification successful: $TABLES tables restored"
else
    echo "❌ Backup verification failed: No tables found"
    exit 1
fi

# Cleanup
docker compose exec postgres psql -U postgres -c "DROP DATABASE $TEST_DB;"
```

## State of the Art

| Old Approach                          | Current Approach                   | When Changed | Impact                                                                                                                       |
| ------------------------------------- | ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Manual SSL certificates**           | Automatic HTTPS (Caddy, Certbot)   | ~2015-2016   | Let's Encrypt made manual certificate management obsolete; Caddy automates entirely                                          |
| **Environment variables for secrets** | Docker secrets or secrets managers | ~2018-2020   | Secrets in env vars leak in logs/dumps; Docker secrets mount as files in /run/secrets, Doppler/Vault centralize management   |
| **Forever/nodemon in production**     | PM2 with ecosystem config          | ~2014-2016   | PM2 became standard for production Node.js process management with superior monitoring and cluster support                   |
| **Git-based deployment (git pull)**   | Container-based deployment         | ~2016-2018   | Docker ensures consistent environments; git pull requires manual dependency management and doesn't guarantee reproducibility |
| **signal-cli receive polling**        | signal-cli daemon mode             | ~2019-2020   | Daemon mode provides event-driven message handling via JSON-RPC; polling was inefficient and risked account inactivity       |
| **Local log files only**              | Centralized log aggregation        | ~2015-2017   | Structured JSON logs to centralized services (Better Stack, DataDog) enable search, alerts, and retention policies           |

**Deprecated/outdated:**

- **signal-cli-nodejs with D-Bus interface:** Older integration pattern used D-Bus system services; modern approach uses JSON-RPC interface via TCP socket (more portable, no D-Bus dependencies)
- **Forever process manager:** Largely replaced by PM2 which offers superset of features with better monitoring
- **Ubuntu 18.04 and older:** signal-cli and modern Node.js require recent Linux kernels; use Ubuntu 22.04 LTS or newer

## Open Questions

1. **Should health check endpoint be HTTP or Signal-based?**
   - What we know: Docker healthchecks and monitoring tools expect HTTP endpoints; Signal bot doesn't inherently need HTTP server
   - What's unclear: Whether to add HTTP server solely for /health endpoint or implement health check via Signal message
   - Recommendation: Add lightweight HTTP server (Express or Fastify) with single /health endpoint for monitoring; minimal overhead and standard practice

2. **VPS provider recommendation for European deployment?**
   - What we know: Family is in Europe (timezone: Europe/Berlin), so European data center reduces latency
   - What's unclear: Specific VPS provider that balances cost, reliability, and ease of use
   - Recommendation: DigitalOcean (Droplet in Frankfurt), Hetzner (German company, excellent price/performance), or Scaleway (French, GDPR-compliant). Start with 1GB RAM / 1 vCPU (~$6-12/month)

3. **Should signal-cli run in separate container or same container as Node.js app?**
   - What we know: signal-sdk expects signal-cli daemon on localhost or TCP socket; current dev setup uses host-installed signal-cli
   - What's unclear: Best containerization strategy—sidecar pattern vs all-in-one
   - Recommendation: Two approaches both valid:
     - **Approach A (simpler):** Single container with both signal-cli daemon and Node.js app (use supervisor or PM2 to manage both processes)
     - **Approach B (cleaner separation):** Two containers connected via Docker network—signal-cli container exposes JSON-RPC on port 7583, Node.js app connects to signal-cli:7583

4. **How to handle family-members.json updates without redeploying?**
   - What we know: family-members.json is mounted as read-only volume; changes require container restart
   - What's unclear: Best practice for hot-reloading configuration changes
   - Recommendation: Implement file watching (chokidar) to reload family-members.json on change without full restart, or use environment variable to enable "admin" phone numbers that can update whitelist via Signal messages

## Sources

### Primary (HIGH confidence)

- [signal-cli official documentation](https://github.com/AsamK/signal-cli) - Signal protocol client for Java, daemon mode, JSON-RPC interface
- [Docker documentation - Manage sensitive data with Docker secrets](https://docs.docker.com/engine/swarm/secrets/) - Official Docker secrets management guide
- [Docker documentation - Persist the DB](https://docs.docker.com/get-started/workshop/05_persisting_data/) - Volume persistence patterns
- [Google Cloud - Best practices for managing service account keys](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys) - Official Google security recommendations
- [PM2 official documentation](https://pm2.keymetrics.io/) - Node.js production process manager
- [Caddy documentation - Reverse proxy quick-start](https://caddyserver.com/docs/quick-starts/reverse-proxy) - Automatic HTTPS reverse proxy

### Secondary (MEDIUM confidence)

- [Docker Production Best Practices: Security, Optimization & Monitoring](http://www.mykolaaleksandrov.dev/posts/2026/02/docker-production-best-practices/) - Recent 2026 best practices guide
- [Automated PostgreSQL Backups in Docker: Complete Guide with pg_dump](https://serversinc.io/blog/automated-postgresql-backups-in-docker-complete-guide-with-pg-dump/) - Docker backup strategies
- [Are environment variables still safe for secrets in 2026?](https://www.doppler.com/blog/environment-variable-secrets-2026) - Modern secrets management approaches
- [13 Proven Node.js Monitoring Best Practices You Need in 2026](https://www.atatus.com/blog/nodejs-monitoring-best-practices/) - Production monitoring guide
- [Optimize Node.js for Production - Guide 2026](https://forwardemail.net/en/blog/docs/optimize-nodejs-performance-production-monitoring-pm2-health-checks) - PM2 health checks and production optimization
- [Is Your Node.js Application Production-Ready? A Complete Checklist](https://medium.com/@mehdibafdil/is-your-node-js-application-production-ready-a-complete-checklist-601c9d494f4f) - Deployment readiness checklist
- [Running Node.js Apps with PM2 (Complete Guide)](https://betterstack.com/community/guides/scaling-nodejs/pm2-guide/) - PM2 configuration patterns
- [Nginx Reverse Proxy: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/nginx-reverse-proxy-complete-guide) - Nginx SSL termination and proxying

### Tertiary (LOW confidence)

- WebSearch results for signal-cli registration considerations - Community discussions, marked for validation
- WebSearch results for VPS hosting comparisons - Multiple sources with varying publication dates, pricing subject to change

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH - Docker, PM2, PostgreSQL are industry standard and well-documented; Caddy/Nginx are proven reverse proxies
- **Architecture patterns:** MEDIUM-HIGH - Docker Compose patterns are standard, but signal-cli containerization has less community documentation than typical web apps
- **Pitfalls:** MEDIUM - Based on signal-cli documentation and general production experience; some pitfalls are specific to Signal bot architecture and less commonly documented
- **Security practices:** HIGH - Google Cloud and Docker official documentation provide authoritative guidance on secrets management

**Research date:** 2026-02-16
**Valid until:** ~2026-04-16 (60 days for stable infrastructure practices; signal-cli version compatibility may change faster—monitor releases)
