#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_LICENSE_FILE="/Users/dgigon/Documents/Jahia/Software/Licenses/license-Unlimited-8.2.0-SUPPORT-TEST-DGIGON.xml"
LICENSE_FILE="${JAHIA_LICENSE_FILE:-$DEFAULT_LICENSE_FILE}"

cd "$SCRIPT_DIR"
mkdir -p "$SCRIPT_DIR/results"

if [[ ! -f "$LICENSE_FILE" ]]; then
  echo "License file not found: $LICENSE_FILE" >&2
  echo "Set JAHIA_LICENSE_FILE to override the default path." >&2
  exit 1
fi

export JAHIA_LICENSE="$(base64 < "$LICENSE_FILE" | tr -d '\n')"

echo "Using license file: $LICENSE_FILE"
echo "Mode: docker"

./ci.build.sh
./ci.startup.sh
