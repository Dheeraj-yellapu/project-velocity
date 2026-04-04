#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:4000/api/search?q=technology}"
CONCURRENCY="${CONCURRENCY:-25}"
TIME="${TIME:-30S}"

siege -c "${CONCURRENCY}" -t "${TIME}" "${URL}"
