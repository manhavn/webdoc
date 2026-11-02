#!/usr/bin/env bash
set -euo pipefail

# Check docker prerequisite
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: 'docker' is not installed or not in PATH." >&2
  exit 1
fi

# 1. Environment configuration
MONGO_CONTAINER="${MONGO_CONTAINER:-mongodb_webdoc}"
MONGO_DB="${MONGO_DB:-webdoc}"
MONGO_USER="${MONGO_USER:-webdoc}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_VOLUME="${MONGO_VOLUME:-volume_mongodb_webdoc}"
MONGO_IMAGE="${MONGO_IMAGE:-docker.io/library/mongo:8}"

# Fetch public IPv4 address if available
IP_V4_VPS=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || true)
if [[ -z "$IP_V4_VPS" ]]; then
  IP_V4_VPS="127.0.0.1"
fi

# Read previously saved password if available and not explicitly provided
if [[ -z "${MONGO_PASSWORD:-}" && -f ~/mongodb_webdoc.password.txt ]]; then
  MONGO_PASSWORD=$(cat ~/mongodb_webdoc.password.txt)
fi

# Generate a random 16-character password (uppercase, lowercase, digits)
if [[ -z "${MONGO_PASSWORD:-}" ]]; then
  while true; do
    pass=$(head -c 128 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | head -c 16 || true)
    if [[ "$pass" =~ [A-Z] ]] && [[ "$pass" =~ [a-z] ]] && [[ "$pass" =~ [0-9] ]] && [ "${#pass}" -eq 16 ]; then
      MONGO_PASSWORD="$pass"
      break
    fi
  done
fi
export MONGO_PASSWORD

# 2. Save password and connection strings to user home directory
echo "$MONGO_PASSWORD" > ~/mongodb_webdoc.password.txt
echo "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${IP_V4_VPS}:${MONGO_PORT}/${MONGO_DB}?authSource=admin" > ~/mongodb_webdoc.connection.url.txt
echo "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@127.0.0.1:${MONGO_PORT}/${MONGO_DB}?authSource=admin" >> ~/mongodb_webdoc.connection.url.txt

# 3. Launch MongoDB 8 container with Docker volume
if docker container inspect "$MONGO_CONTAINER" >/dev/null 2>&1; then
  echo "Container '${MONGO_CONTAINER}' already exists, restarting..."
  docker start "$MONGO_CONTAINER"
else
  docker run -d --restart always \
    --name "$MONGO_CONTAINER" \
    --log-opt max-size=3m \
    --log-opt max-file=1 \
    -p "${MONGO_PORT}:27017" \
    -e GLIBC_TUNABLES="glibc.pthread.rseq=1" \
    -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" \
    -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASSWORD" \
    -e MONGO_INITDB_DATABASE="$MONGO_DB" \
    -v "${MONGO_VOLUME}:/data/db:Z" \
    "$MONGO_IMAGE"
fi

echo "====================================================================="
echo "MongoDB initialized and running successfully!"
echo "Database         : $MONGO_DB"
echo "Username         : $MONGO_USER"
echo "Password         : $MONGO_PASSWORD (saved at ~/mongodb_webdoc.password.txt)"
echo "Connection URL   : mongodb://${MONGO_USER}:${MONGO_PASSWORD}@127.0.0.1:${MONGO_PORT}/${MONGO_DB}?authSource=admin"
if [[ "$IP_V4_VPS" != "127.0.0.1" ]]; then
  echo "Public Connection: mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${IP_V4_VPS}:${MONGO_PORT}/${MONGO_DB}?authSource=admin"
fi
echo "====================================================================="
