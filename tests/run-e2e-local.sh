#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-headless}"
DEFAULT_LICENSE_FILE="/Users/dgigon/Documents/Jahia/Software/Licenses/license-Unlimited-8.2.0-SUPPORT-TEST-DGIGON.xml"
LICENSE_FILE="${JAHIA_LICENSE_FILE:-$DEFAULT_LICENSE_FILE}"

cd "$SCRIPT_DIR"
mkdir -p "$SCRIPT_DIR/results"

if [[ ! -f "$LICENSE_FILE" ]]; then
  echo "License file not found: $LICENSE_FILE" >&2
  echo "Set JAHIA_LICENSE_FILE to override the default path." >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "corepack is required but was not found in PATH." >&2
  exit 1
fi

export JAHIA_LICENSE="$(base64 < "$LICENSE_FILE" | tr -d '\n')"
export JAHIA_URL="${JAHIA_URL:-http://localhost:8080}"
export JAHIA_PROCESSING_URL="${JAHIA_PROCESSING_URL:-$JAHIA_URL}"

echo "Using license file: $LICENSE_FILE"
echo "Mode: local ($MODE)"
echo "Jahia URL: $JAHIA_URL"

corepack enable
corepack yarn

./ci.startup.sh notests

case "$MODE" in
  headless)
    ./env.run.sh
    ;;
  debug)
    source ./set-env.sh
    corepack yarn run e2e:debug
    ;;
  ci)
    source ./set-env.sh
    corepack yarn run e2e:ci
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    echo "Usage: ./run-e2e-local.sh [headless|debug|ci]" >&2
    exit 1
    ;;
esac
