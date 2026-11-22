#!/bin/sh
set -eu

# Synology SSH sessions can start with a very small PATH, which makes Docker
# look missing even when Container Manager is installed.
PATH="/usr/local/bin:/usr/bin:/bin:/usr/syno/bin:/usr/syno/sbin:$PATH"
export PATH

cd "$(dirname "$0")"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERROR: Docker Compose was not found. Run this from Synology Container Manager/Terminal with Docker installed." >&2
  exit 1
fi

echo "Artwork Manager NAS Worker update"
echo "Project folder: $(pwd)"
echo "This pulls the latest GitHub image and recreates the container."

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo
  echo "Created local .env from .env.example."
  echo "Edit .env to set AMW_TOKEN and AMW_MUSIC_PATH before using the worker for real."
fi

if [ -f .env ] && grep -q '^AMW_TOKEN=change-me$' .env; then
  echo
  echo "WARNING: .env still uses AMW_TOKEN=change-me. Use a private token and paste the same value into the Mac app Settings."
fi

mkdir -p backups

$COMPOSE pull
$COMPOSE up -d --force-recreate --remove-orphans

echo
echo "Container status:"
$COMPOSE ps

echo
echo "Waiting for the worker to answer..."
PORT="${AMW_HOST_PORT:-8765}"
if [ -f .env ]; then
  ENV_PORT=$(sed -n 's/^AMW_HOST_PORT=//p' .env | tail -n 1)
  [ -n "$ENV_PORT" ] && PORT="$ENV_PORT"
fi
BUILD=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  BUILD=$(curl -s "http://127.0.0.1:${PORT}/" 2>/dev/null | sed -n 's/.*"worker_build": *"\([^"]*\)".*/\1/p')
  [ -n "$BUILD" ] && break
  sleep 2
done
if [ -n "$BUILD" ]; then
  echo "Artwork Manager is running build ${BUILD}."
  echo "Open it at http://YOUR-NAS-IP:${PORT}/app/"
else
  echo "The worker did not answer yet. Check the container log in Container Manager."
fi
