#!/usr/bin/env bash
set -euo pipefail

SOLR_URL="${SOLR_URL:-http://localhost:8983/solr}"
COLLECTION="${COLLECTION:-news}"
SHARDS="${SHARDS:-1}"
REPLICAS="${REPLICAS:-1}"

curl -sS "${SOLR_URL}/admin/collections?action=CREATE&name=${COLLECTION}&numShards=${SHARDS}&replicationFactor=${REPLICAS}&wt=json"
echo "Collection ${COLLECTION} create request sent."
