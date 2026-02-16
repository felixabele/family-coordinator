#!/bin/bash
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

echo "=== Deployment complete ==="
pm2 status
