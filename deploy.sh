#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/gotcherapp

git pull origin main

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo "Deploy complete"
