#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Deploying Family Coordinator ==="

echo "1. Pulling latest code..."
git pull --ff-only

echo "2. Installing dependencies..."
npm ci --omit=dev

echo "3. Running database migrations..."
tsx --env-file=.env.production src/db/migrate.ts

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
  echo "✗ Health check failed - showing PM2 logs:"
  pm2 logs family-coordinator --lines 50 --nostream
  exit 1
fi

echo "=== Deployment complete ==="
pm2 status
