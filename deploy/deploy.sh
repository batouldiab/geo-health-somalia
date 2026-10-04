#!/usr/bin/env bash
# Deploy the latest images on the droplet. Invoked by .github/workflows/deploy.yml
# over SSH, or run manually from /opt/geo-health-somalia.
set -euo pipefail

cd /opt/geo-health-somalia

git fetch --all
git reset --hard origin/main

docker compose pull || true       # pull prebuilt images if GHCR is configured
docker compose up -d --build      # otherwise (re)build locally
docker image prune -f

echo "Deployed $(git rev-parse --short HEAD) at $(date -u +%FT%TZ)"
