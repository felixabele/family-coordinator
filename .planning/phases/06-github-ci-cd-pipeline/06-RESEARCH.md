# Phase 6: GitHub CI/CD Pipeline - Research

**Researched:** 2026-02-17
**Domain:** GitHub Actions CI/CD automation for Node.js/TypeScript deployment
**Confidence:** HIGH

## Summary

Implementing a GitHub Actions CI/CD pipeline for the Family Coordinator Signal bot requires orchestrating three core workflows: (1) continuous integration (CI) that validates code quality through linting, formatting, type checking, and testing on every push and pull request, (2) continuous deployment (CD) that automates deployment to the VPS when changes are merged to main, and (3) supporting workflows for dependency management and security scanning.

The architecture leverages GitHub's native features including repository secrets for sensitive credentials (SSH keys, VPS host), environment-based deployment protection for production safeguards, and concurrency controls to prevent parallel deployments that could corrupt the Signal bot's stateful connection. Unlike typical web applications that can use blue-green deployments, this Signal bot requires sequential deployments with brief downtime during PM2 restart.

Critical considerations unique to this project: (a) deployment must execute the existing `scripts/deploy.sh` which handles git pull, npm ci, migrations, and PM2 restart in the correct order, (b) no tests currently exist so the test job will be minimal/placeholder, (c) Prettier formatting is already enforced via husky pre-commit hooks but should be validated in CI to catch any bypassed commits, and (d) SSH-based deployment to a bare-metal VPS requires careful secret management for the private key.

**Primary recommendation:** Implement three GitHub Actions workflows: (1) `ci.yml` triggered on all pushes/PRs running lint, format check, type check, and placeholder tests in parallel jobs, (2) `deploy.yml` triggered only on main branch merges using appleboy/ssh-action to execute the existing deploy.sh script with concurrency controls to prevent parallel runs, and (3) `dependency-review.yml` for PR-based dependency scanning. Use environment secrets for production deployment credentials and repository secrets for shared CI configuration.

## Standard Stack

### Core

| Library                 | Version | Purpose               | Why Standard                                                                                             |
| ----------------------- | ------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| **actions/checkout**    | v6      | Repository checkout   | Official GitHub action; v6 is current stable (2026) with improved performance                            |
| **actions/setup-node**  | v6.2.0  | Node.js environment   | Official GitHub action; v6 adds automatic npm caching, removed deprecated always-auth                    |
| **appleboy/ssh-action** | v1      | SSH command execution | Industry standard for SSH-based deployment; 8.5k+ stars, actively maintained, supports key/password auth |
| **GitHub Secrets**      | Native  | Secrets management    | Built-in encrypted secret storage; supports repository, environment, and organization scopes             |
| **GitHub Environments** | Native  | Deployment protection | Native deployment tracking with approval workflows, branch restrictions, and audit logs                  |

### Supporting

| Library                              | Version     | Purpose                           | When to Use                                                                          |
| ------------------------------------ | ----------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| **actions/dependency-review-action** | Latest      | Dependency vulnerability scanning | On pull requests to catch supply chain risks before merge                            |
| **concurrency groups**               | Native YAML | Prevent parallel deployments      | Essential for stateful apps like Signal bot to avoid corrupting PM2/signal-cli state |
| **matrix strategy**                  | Native YAML | Multi-version testing             | When adding tests, validate against Node.js 20, 22, 24 (current LTS + stable)        |
| **status checks**                    | Native      | Branch protection                 | Require CI pass before merging to main; prevents broken code deployment              |

### Alternatives Considered

| Instead of             | Could Use               | Tradeoff                                                                                                                                       |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| appleboy/ssh-action    | easingthemes/ssh-deploy | appleboy executes commands (perfect for running deploy.sh); easingthemes uses rsync for file sync (would require rewriting deployment logic)   |
| GitHub Secrets         | Doppler/Vault           | GitHub Secrets simpler for single-repo project; external secrets managers offer rotation, audit trails, cross-repo sharing at added complexity |
| SSH key authentication | Password authentication | SSH keys more secure (no password in plaintext), standard practice for automated deployments                                                   |
| Environment secrets    | Repository secrets      | Environment secrets add deployment protection (approvals, branch restrictions); repository secrets simpler but no deployment safeguards        |
| GitHub Actions         | GitLab CI, Jenkins      | GitHub Actions native integration with repo, no server setup; self-hosted CI offers more control at infrastructure cost                        |

**Installation:**

No package installation required—GitHub Actions is built into GitHub repositories. Enable workflows by creating `.github/workflows/*.yml` files.

## Architecture Patterns

### Recommended Workflow Structure

```
.github/
├── workflows/
│   ├── ci.yml                 # Continuous Integration (lint, format, typecheck, test)
│   ├── deploy.yml             # Continuous Deployment (SSH to VPS, run deploy.sh)
│   └── dependency-review.yml  # PR dependency scanning
└── CODEOWNERS                 # Optional: require reviews from specific people
```

### Pattern 1: Multi-Job CI Workflow with Parallel Execution

**What:** Separate lint, format, type check, and test into independent jobs that run in parallel for fast feedback.

**When to use:** All pushes and pull requests to validate code quality before merge.

**Example:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint # Assumes package.json has "lint" script

  format-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run format:check # Validates Prettier formatting

  typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build # TypeScript compilation check

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test # Currently minimal, placeholder for future tests
```

### Pattern 2: SSH-Based VPS Deployment with Concurrency Control

**What:** Use appleboy/ssh-action to connect to VPS and execute the existing `scripts/deploy.sh`, with concurrency controls to prevent parallel deployments.

**When to use:** After merging to main branch, to deploy validated code to production VPS.

**Example:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: production-deployment
  cancel-in-progress: false # Never interrupt in-progress deployment

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production
      url: https://your-vps-ip # Optional: link to health check
    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            cd /opt/family-coordinator
            bash scripts/deploy.sh
```

### Pattern 3: Environment Secrets for Production Protection

**What:** Use GitHub environment secrets with branch protection to require CI validation before deploying to production.

**When to use:** Production deployments requiring approval workflows or branch restrictions.

**Example:**

GitHub Repository Settings:

1. **Settings → Secrets and variables → Actions → New repository secret:**
   - `VPS_HOST`: VPS IP address or hostname
   - `VPS_USERNAME`: SSH username (e.g., `deploy`)
   - `VPS_PORT`: SSH port (default 22)

2. **Settings → Environments → New environment: `production`:**
   - **Deployment branches:** Only `main` branch
   - **Environment secrets:**
     - `VPS_SSH_PRIVATE_KEY`: Private SSH key for deployment user
   - **Optional: Required reviewers** (for manual approval before deploy)

3. **Settings → Branches → Add branch protection rule for `main`:**
   - ✓ Require a pull request before merging
   - ✓ Require status checks to pass before merging
     - Select: `lint`, `format-check`, `typecheck`, `test`
   - ✓ Require conversation resolution before merging

### Pattern 4: Dependency Review on Pull Requests

**What:** Automatically scan dependency changes in PRs for known vulnerabilities and license compliance issues.

**When to use:** All pull requests that modify package.json or package-lock.json.

**Example:**

```yaml
# .github/workflows/dependency-review.yml
name: Dependency Review

on:
  pull_request:
    paths:
      - "package.json"
      - "package-lock.json"

permissions:
  contents: read
  pull-requests: write # Allow comments on PRs

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v6
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: moderate # Fail on moderate+ vulnerabilities
```

### Pattern 5: Matrix Testing for Future Proofing

**What:** Test against multiple Node.js versions (20 LTS, 22 LTS, 24 stable) to ensure compatibility.

**When to use:** When adding comprehensive test suite; useful for library/shared code.

**Example:**

```yaml
# Addition to ci.yml test job (future enhancement)
test:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  strategy:
    fail-fast: false # Continue testing other versions if one fails
    matrix:
      node-version: [20, 22, 24]
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: ${{ matrix.node-version }}
        cache: npm
    - run: npm ci
    - run: npm test
```

### Anti-Patterns to Avoid

- **Storing SSH private keys in repository code:** Private keys must ONLY be stored in GitHub Secrets (environment or repository level), never committed to git or hardcoded in workflows.
- **Using password authentication for SSH:** SSH key authentication is more secure and recommended for automated deployments; passwords are vulnerable to brute force and leak in logs.
- **No concurrency controls on deployment:** Multiple parallel deployments can corrupt PM2 state, signal-cli session, or database migrations. Always use `concurrency: cancel-in-progress: false` for deployment jobs.
- **Skipping CI on main branch:** Requiring CI validation only on PRs allows direct commits to main to bypass checks. Run CI on both `pull_request` and `push` to main.
- **Hardcoding secrets in workflow files:** Use `${{ secrets.SECRET_NAME }}` syntax; never put actual credentials in YAML files which are committed to git.
- **No timeout limits:** Workflows can hang indefinitely without `timeout-minutes`; set reasonable limits (5min for CI, 15min for deploy).

## Don't Hand-Roll

| Problem                               | Don't Build                          | Use Instead                                       | Why                                                                                                                                                        |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSH deployment**                    | Custom scp/rsync scripts             | appleboy/ssh-action                               | Handles SSH key auth, host verification, error handling, proxy support, multiple hosts, and command output capture—battle-tested across thousands of repos |
| **Node.js setup**                     | Manual Node.js installation commands | actions/setup-node@v6                             | Automatic npm/yarn/pnpm caching, matrix testing support, version pinning, and cross-platform compatibility (Linux/Windows/macOS)                           |
| **Dependency vulnerability scanning** | Manual npm audit scripts             | actions/dependency-review-action                  | GitHub's native integration with Security Advisories database; provides PR comments, severity filtering, and license compliance checks                     |
| **Secrets rotation**                  | Manual key rotation procedures       | GitHub Environment secrets with rotation policies | Built-in audit logs, branch restrictions, approval workflows, and integration with deployment tracking                                                     |
| **Branch protection**                 | Custom PR merge scripts              | GitHub branch protection rules                    | Native UI for configuring required status checks, review requirements, and merge strategies; integrates with Actions status checks                         |
| **Deployment approvals**              | Custom Slack approval bots           | GitHub Environment required reviewers             | Built-in deployment approval workflow with audit logs, notification emails, and integration with deployment history                                        |

**Key insight:** GitHub Actions ecosystem has mature, well-tested solutions for every CI/CD need. Custom scripts introduce maintenance burden, edge case bugs, and security risks that official actions have already solved. Use official GitHub actions (`actions/*`) and popular community actions (8k+ stars, actively maintained) for reliability.

## Common Pitfalls

### Pitfall 1: SSH Key Format Issues in GitHub Secrets

**What goes wrong:** GitHub Actions SSH deployment fails with "invalid format" or "permission denied" errors despite the SSH key working locally.

**Why it happens:** SSH private keys stored in GitHub Secrets must include the full key with headers/footers (`-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`), and some key formats (especially RSA keys generated with older tools) may have line wrapping that gets corrupted when pasted into GitHub's secret input field.

**How to avoid:**

- Copy entire private key including BEGIN/END lines: `cat ~/.ssh/id_ed25519 | pbcopy`
- Use ED25519 keys (recommended): `ssh-keygen -t ed25519 -a 200 -C "github-actions@family-coordinator"`
- Verify key format in GitHub Secrets (view raw secret to check line breaks preserved)
- Test SSH connection locally before adding to GitHub: `ssh -i ~/.ssh/id_ed25519 user@vps-host`
- For Ubuntu 20.04+, enable ssh-rsa in `/etc/ssh/sshd_config` if using RSA keys

**Warning signs:**

- "Load key: invalid format" in GitHub Actions logs
- "Permission denied (publickey)" despite correct username/host
- Deployment works locally but fails in GitHub Actions

### Pitfall 2: No Concurrency Controls Causing Deployment Corruption

**What goes wrong:** Multiple deployments run simultaneously (from rapid commits or parallel workflow runs), causing PM2 to enter an inconsistent state, database migrations to conflict, or signal-cli session to become corrupted.

**Why it happens:** By default, GitHub Actions runs workflows concurrently for each push. If two developers push to main within seconds, both deployment workflows start in parallel. The VPS receives conflicting commands: two `pm2 restart` calls, two migration runners, two git pulls potentially at different commits.

**How to avoid:**

- Always add concurrency control to deployment workflows:
  ```yaml
  concurrency:
    group: production-deployment
    cancel-in-progress: false # Never cancel in-progress deployment
  ```
- Use environment-level concurrency for multiple environments:
  ```yaml
  concurrency:
    group: deploy-${{ github.event.inputs.environment }}
    cancel-in-progress: false
  ```
- Monitor deployment queue in Actions tab to verify sequential execution
- Add deployment status checks in deploy.sh (verify PM2 status before/after)

**Warning signs:**

- PM2 shows process in "errored" state after deployment
- Database migration errors about already-existing tables
- Deployment logs show overlapping git pull operations
- Signal bot stops responding after rapid deployments

### Pitfall 3: CI Passes Locally but Fails in GitHub Actions

**What goes wrong:** Code works perfectly on developer's machine and passes local npm scripts (lint, format, typecheck), but fails in GitHub Actions CI with cryptic errors about missing dependencies, wrong Node.js version, or type errors.

**Why it happens:** Local development environment differs from GitHub Actions runners—different Node.js versions, globally installed packages, environment variables, or operating system differences (macOS vs. Linux).

**How to avoid:**

- Pin Node.js version in `package.json` and `.nvmrc`:
  ```json
  {
    "engines": {
      "node": ">=22.0.0"
    }
  }
  ```
- Use `npm ci` instead of `npm install` in workflows (clean install from lockfile)
- Test locally using same Node.js version as CI: `nvm use 22` or `fnm use 22`
- Avoid relying on globally installed packages (add to package.json devDependencies)
- Use `--env-file=.env` consistently in both local and CI npm scripts
- Run `npm ci && npm run build` locally to replicate CI environment

**Warning signs:**

- "Module not found" errors in GitHub Actions but not locally
- TypeScript errors in CI but code compiles locally
- Different test results between local and CI
- CI uses different Node.js version than local (check Actions logs)

### Pitfall 4: Secrets Exposed in Workflow Logs

**What goes wrong:** Sensitive values like API keys, database passwords, or SSH keys appear in plaintext in GitHub Actions logs, visible to anyone with repository access.

**Why it happens:** GitHub automatically masks secrets referenced via `${{ secrets.NAME }}` syntax, but derived values (base64 decoded secrets, secrets split across multiple commands, secrets in error messages) are NOT automatically masked. Developers accidentally echo secrets in debug commands or error handlers expose them.

**How to avoid:**

- Never echo secrets directly: avoid `echo ${{ secrets.API_KEY }}`
- GitHub auto-masks `${{ secrets.* }}` but not derived values
- Use `::add-mask::` for dynamically generated secrets:
  ```yaml
  - run: echo "::add-mask::$DERIVED_VALUE"
  ```
- Disable debug mode in production workflows (avoid `ACTIONS_STEP_DEBUG=true`)
- Review workflow logs before making repository public
- Use environment secrets for production (additional access controls)
- Rotate secrets immediately if accidentally exposed in logs

**Warning signs:**

- API keys visible in "Run" step outputs
- Error messages containing database connection strings
- Secrets visible in PR comments from workflow bots
- GitHub Advanced Security alerts about exposed secrets

### Pitfall 5: Deployment Succeeds but Application Doesn't Start

**What goes wrong:** GitHub Actions deployment workflow completes successfully (green checkmark), but the Signal bot is not actually running on the VPS. PM2 shows the process as "stopped" or "errored" after deployment.

**Why it happens:** The deployment script (`deploy.sh`) executes `pm2 restart` which returns exit code 0 even if the application fails to start. GitHub Actions sees the script exit successfully and marks the deployment as complete, but PM2's restart failed due to missing environment variables, database connection errors, or TypeScript compilation failures.

**How to avoid:**

- Add health check verification at end of deploy.sh:
  ```bash
  # scripts/deploy.sh (add at end)
  echo "Verifying deployment..."
  sleep 5 # Wait for app to start
  curl -f http://localhost:3000/health || {
    echo "Health check failed! Rolling back..."
    pm2 logs --lines 50
    exit 1
  }
  ```
- Use PM2's wait-ready feature with health check:
  ```javascript
  // ecosystem.config.cjs
  wait_ready: true,
  listen_timeout: 10000, // 10s to start
  ```
- Monitor PM2 status after restart:
  ```bash
  pm2 status
  pm2 logs family-coordinator --lines 20 --nostream
  ```
- Add GitHub Actions notification on deployment failure (Slack/email)

**Warning signs:**

- Deployment workflow shows green but app is unreachable
- PM2 status shows "errored" or "stopped" after deployment
- Health endpoint returns 503 or connection refused
- No new entries in application logs after deployment

### Pitfall 6: Forgetting to Update GitHub Actions on Node.js Version Changes

**What goes wrong:** Project upgrades to Node.js 24, updates `package.json` engines and local `.nvmrc`, but GitHub Actions workflows still use Node.js 22, causing deployment to run on outdated runtime.

**Why it happens:** Node.js version is specified in three places—local environment (`.nvmrc`), package.json engines field, and `.github/workflows/*.yml` files. Developers update local tools but forget to sync workflow YAML files.

**How to avoid:**

- Use single source of truth for Node.js version—`.nvmrc` file
- Reference `.nvmrc` in workflows using `node-version-file`:
  ```yaml
  - uses: actions/setup-node@v6
    with:
      node-version-file: ".nvmrc"
      cache: npm
  ```
- Alternatively, use matrix to test current + future versions:
  ```yaml
  matrix:
    node-version: [22, 24]
  ```
- Add CI check that compares package.json engines with workflow version
- Document Node.js upgrade checklist (package.json, .nvmrc, workflows, VPS)

**Warning signs:**

- CI runs on different Node.js version than production
- Features work in CI but fail on VPS (or vice versa)
- npm warns about incompatible Node.js version in deployment logs
- Workflow logs show different Node.js version than expected

## Code Examples

Verified patterns from official sources and production deployments:

### Complete CI Workflow with All Jobs

```yaml
# .github/workflows/ci.yml
# Source: Official GitHub Actions best practices 2026
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  format-check:
    name: Format Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Check Prettier formatting
        run: npm run format:check

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript compiler
        run: npm run build

  test:
    name: Test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

### Production Deployment Workflow with Environment Protection

```yaml
# .github/workflows/deploy.yml
# Source: appleboy/ssh-action documentation + GitHub deployment best practices
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch: # Allow manual trigger

permissions:
  contents: read

concurrency:
  group: production-deployment
  cancel-in-progress: false # Never interrupt deployment

jobs:
  deploy:
    name: Deploy to VPS
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production
      url: http://${{ secrets.VPS_HOST }}:3000/health

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          timeout: 10m
          command_timeout: 10m
          script: |
            set -e
            cd /opt/family-coordinator
            echo "Starting deployment..."
            bash scripts/deploy.sh
            echo "Deployment complete!"

      - name: Verify deployment
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            # Check PM2 status
            pm2 status family-coordinator

            # Verify health endpoint
            curl -f http://localhost:3000/health || {
              echo "Health check failed!"
              pm2 logs family-coordinator --lines 50 --nostream
              exit 1
            }
```

### Dependency Review on Pull Requests

```yaml
# .github/workflows/dependency-review.yml
# Source: GitHub official dependency-review-action
name: Dependency Review

on:
  pull_request:
    paths:
      - "package.json"
      - "package-lock.json"

permissions:
  contents: read
  pull-requests: write

jobs:
  dependency-review:
    name: Review Dependencies
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Dependency Review
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: moderate
          comment-summary-in-pr: true
```

### Setup SSH Keys on VPS for GitHub Actions

```bash
# On VPS: Create deployment user and SSH key
# Run as root or with sudo

# 1. Create deployment user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy

# 2. Switch to deployment user
sudo su - deploy

# 3. Generate SSH key pair (run locally, not on VPS)
ssh-keygen -t ed25519 -a 200 -C "github-actions-deploy" -f ~/.ssh/github-actions-deploy

# 4. Copy PUBLIC key to VPS authorized_keys
# On local machine:
cat ~/.ssh/github-actions-deploy.pub | ssh deploy@your-vps-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# 5. Set proper permissions on VPS
ssh deploy@your-vps-ip "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"

# 6. Copy PRIVATE key to GitHub Secrets
# On local machine:
cat ~/.ssh/github-actions-deploy
# Copy entire output (including BEGIN/END lines) to GitHub Secrets as VPS_SSH_PRIVATE_KEY

# 7. Test SSH connection
ssh -i ~/.ssh/github-actions-deploy deploy@your-vps-ip "whoami"
# Should output: deploy
```

### GitHub Repository Secrets Configuration

```bash
# GitHub Repository → Settings → Secrets and variables → Actions

# Repository Secrets (available to all workflows):
VPS_HOST=your-vps-ip-or-hostname
VPS_USERNAME=deploy
VPS_PORT=22

# Environment Secrets (Settings → Environments → production):
VPS_SSH_PRIVATE_KEY=<contents of private key including BEGIN/END lines>

# Branch Protection (Settings → Branches → Add rule for 'main'):
# ✓ Require a pull request before merging
# ✓ Require status checks to pass before merging
#   - lint
#   - format-check
#   - typecheck
#   - test
# ✓ Require conversation resolution before merging
# ✓ Do not allow bypassing the above settings
```

### Enhanced deploy.sh with Health Check Verification

```bash
#!/bin/bash
# scripts/deploy.sh
# Enhanced with health check verification for GitHub Actions
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Deploying Family Coordinator ==="

echo "1. Pulling latest code..."
git pull --ff-only

echo "2. Installing dependencies..."
npm ci --omit=dev

echo "3. Running database migrations..."
node --env-file=.env.production --experimental-strip-types src/db/migrate.ts

echo "4. Restarting application..."
pm2 restart ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs

echo "5. Saving PM2 process list..."
pm2 save

echo "6. Waiting for application to start..."
sleep 5

echo "7. Verifying health check..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
  echo "✓ Health check passed"
else
  echo "✗ Health check failed! Showing recent logs:"
  pm2 logs family-coordinator --lines 50 --nostream
  exit 1
fi

echo "=== Deployment complete ==="
pm2 status
```

## State of the Art

| Old Approach                   | Current Approach                    | When Changed | Impact                                                                                                |
| ------------------------------ | ----------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| **actions/checkout@v3**        | actions/checkout@v6                 | 2025-2026    | v6 improves checkout speed and security; v3 still works but v6 recommended for new workflows          |
| **actions/setup-node@v3**      | actions/setup-node@v6               | January 2026 | v6 removes deprecated always-auth, adds automatic npm caching when packageManager set in package.json |
| **Password SSH auth**          | SSH key authentication              | ~2018-2020   | SSH keys are standard; password auth deprecated in OpenSSH 8.0+ for security                          |
| **Repository secrets only**    | Environment secrets with protection | ~2020-2021   | Environment secrets enable deployment approvals, branch restrictions, and audit logs for production   |
| **Manual concurrency control** | Native concurrency groups           | ~2021        | GitHub Actions added native concurrency keyword replacing custom locking mechanisms                   |
| **Manual dependency scanning** | actions/dependency-review-action    | ~2022        | GitHub Security Advisories integration provides automatic vulnerability detection on PRs              |
| **Node.js 18**                 | Node.js 20/22/24                    | 2024-2026    | Node.js 18 EOL April 2025; use 20 LTS (EOL 2026), 22 LTS (EOL 2027), or 24 stable                     |

**Deprecated/outdated:**

- **actions/setup-node `always-auth` input:** Removed in v6; use `NPM_TOKEN` environment variable instead
- **Node.js 16 and earlier:** All EOL; minimum supported version in 2026 is Node.js 20
- **Using `npm install` in CI:** Use `npm ci` for faster, cleaner dependency installation from lockfile
- **Self-hosted runners without security hardening:** GitHub recommends using hosted runners for public repos; self-hosted runners require network isolation and regular patching

## Open Questions

1. **Should we add integration tests with PostgreSQL service container?**
   - What we know: GitHub Actions supports PostgreSQL service containers for integration testing; project currently has no tests
   - What's unclear: Whether integration tests provide enough value to justify maintenance overhead for this small family bot
   - Recommendation: Add basic integration tests for critical flows (message processing, calendar integration) using PostgreSQL service container; start with 2-3 tests covering happy path, expand incrementally

2. **Should we use matrix testing across Node.js versions?**
   - What we know: Matrix testing validates against Node.js 20, 22, 24; project targets single Node.js version on VPS
   - What's unclear: Whether testing multiple versions adds value when deployment environment is fixed
   - Recommendation: Skip matrix testing initially (test only Node.js 22 matching VPS); add matrix later if considering Node.js upgrades or supporting multiple deployment targets

3. **Should deployment require manual approval via environment protection?**
   - What we know: Environment protection enables required reviewers for production deployments; adds safety at cost of manual intervention
   - What's unclear: Whether manual approval overhead is justified for family bot vs. automated deployment on main merge
   - Recommendation: Start without required approvers (auto-deploy on main merge); add if deployment issues occur or if multiple developers join project

4. **Should we implement rollback capability in deployment workflow?**
   - What we know: PM2 doesn't have built-in rollback; would need to track git tags/releases and database migration rollback scripts
   - What's unclear: Frequency of rollback-requiring incidents and complexity of implementing safe rollback for database migrations
   - Recommendation: Implement git tag-based releases (`v1.0.0`, `v1.1.0`) with deploy.sh accepting optional tag parameter; defer migration rollback until needed

5. **Should we add deployment notifications (Slack, email, Discord)?**
   - What we know: GitHub Actions supports notification integrations; useful for monitoring deployments and failures
   - What's unclear: Whether family bot warrants notification overhead or if GitHub's built-in email notifications suffice
   - Recommendation: Use GitHub's native email notifications (Settings → Notifications → Actions); add Slack/Discord webhook only if deployment frequency increases or multiple stakeholders need visibility

## Sources

### Primary (HIGH confidence)

- [GitHub Actions CI/CD: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/github-actions-cicd-complete-guide) - Current best practices
- [GitHub Actions: Complete CI/CD Guide for Developers](https://dasroot.net/posts/2026/01/github-actions-complete-ci-cd-guide/) - 2026 comprehensive guide
- [GitHub official: Building and testing Node.js](https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs) - Official documentation
- [actions/setup-node repository](https://github.com/actions/setup-node) - Official action, v6.2.0 confirmed
- [appleboy/ssh-action repository](https://github.com/appleboy/ssh-action) - Official SSH action documentation
- [GitHub Actions official: Using secrets](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions) - Official secrets management guide
- [GitHub Actions official: Creating PostgreSQL service containers](https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers) - Official service containers guide
- [GitHub Actions official: Using concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency) - Official concurrency documentation
- [GitHub Actions official: Managing environments for deployment](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment) - Official environment protection guide

### Secondary (MEDIUM confidence)

- [How to Manage Secrets in GitHub Actions](https://oneuptime.com/blog/post/2026-01-25-github-actions-manage-secrets/view) - January 2026 secrets guide
- [8 GitHub Actions Secrets Management Best Practices](https://www.stepsecurity.io/blog/github-actions-secrets-management-best-practices) - Security best practices
- [Mastering Node.js Deployment: GitHub Actions and PM2 on VPS](https://mbebars.medium.com/mastering-node-js-deployment-github-actions-and-pm2-unleashed-on-your-vps-fbf25248578a) - PM2 deployment patterns
- [Automating App Deployment on a VPS with GitHub Actions](https://blog.ando.ai/posts/github-actions-vps-deployment/) - VPS deployment guide
- [How to Implement Matrix Builds in GitHub Actions](https://oneuptime.com/blog/post/2026-01-25-github-actions-matrix-builds/view) - January 2026 matrix guide
- [How to Configure Environment Protection Rules](https://oneuptime.com/blog/post/2026-01-25-github-actions-environment-protection-rules/view) - January 2026 environment guide
- [How to Control Concurrency in GitHub Actions](https://oneuptime.com/blog/post/2026-01-25-github-actions-concurrency-control/view) - January 2026 concurrency guide
- [Prettier Action - GitHub Marketplace](https://github.com/marketplace/actions/prettier-action) - Prettier integration patterns
- [Using a real Postgres database in GitHub CI pipeline](https://josef.codes/using-a-real-postgres-database-in-your-github-ci-pipeline/) - PostgreSQL integration testing

### Tertiary (LOW confidence)

- WebSearch results for Node.js versions and matrix strategy - Community consensus on Node.js 20/22/24
- WebSearch results for VPS deployment comparisons - Multiple hosting provider options

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH - GitHub Actions official actions (checkout@v6, setup-node@v6) and appleboy/ssh-action (8.5k+ stars) are industry standard with official documentation
- **Architecture patterns:** HIGH - Patterns verified from official GitHub documentation, appleboy/ssh-action examples, and multiple 2026 tutorials
- **Pitfalls:** MEDIUM-HIGH - SSH key format issues and concurrency problems well-documented; deployment verification patterns based on PM2 best practices
- **Security practices:** HIGH - GitHub official documentation on secrets management and environment protection provides authoritative guidance

**Research date:** 2026-02-17
**Valid until:** ~2026-05-17 (90 days for GitHub Actions features; workflows are stable but actions versions update frequently—monitor for v7 releases)
