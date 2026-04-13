#!/bin/bash
# Re-index Data for Solr
# This applies the new schema (body stored=false) to all documents

set -euo pipefail

SOLR_URL="${SOLR_URL:-http://10.145.245.107:8983/solr}"
COLLECTION="${COLLECTION:-global_news}"
DATA_FILE="${DATA_FILE:-/home/siddu/project-velocity/archive\ \(1\)/relevant_articles_selected_fields.json}"

echo "════════════════════════════════════════════════════════"
echo "  SOLR DATA RE-INDEXING"
echo "════════════════════════════════════════════════════════"
echo ""

# Step 1: Clear existing index
echo "STEP 1: Clearing existing index..."
echo "Command:"
echo "  curl -X POST '$SOLR_URL/$COLLECTION/update?commit=true' -H 'Content-Type: application/json' -d '{\"delete\":{\"query\":\"*:*\"}}'"
echo ""

curl -X POST "$SOLR_URL/$COLLECTION/update?commit=true" \
  -H 'Content-Type: application/json' \
  -d '{"delete":{"query":"*:*"}}'

echo ""
echo "✓ Index cleared"
echo ""

# Step 2: Load new data with new schema
echo "════════════════════════════════════════════════════════"
echo "STEP 2: Re-indexing data with new schema..."
echo ""

if [ ! -f "$DATA_FILE" ]; then
    echo "✗ Data file not found: $DATA_FILE"
    echo ""
    echo "Alternative: If you have data in a different format:"
    echo "  - CSV: Use Solr's CSV importer"
    echo "  - Database: Use your data pipeline script"
    echo "  - JSON files: Place in ./solr/data/ and reference here"
    exit 1
fi

echo "Using data file: $DATA_FILE"
echo ""
echo "Command:"
echo "  curl -X POST '$SOLR_URL/$COLLECTION/update?commit=true' -H 'Content-Type: application/json' -d @'$DATA_FILE'"
echo ""

curl -X POST "$SOLR_URL/$COLLECTION/update?commit=true" \
  -H 'Content-Type: application/json' \
  -d @"$DATA_FILE"

echo ""
echo "✓ Data re-indexed"
echo ""

# Step 3: Verify new schema is applied
echo "════════════════════════════════════════════════════════"
echo "STEP 3: Verifying new schema..."
echo ""
echo "Checking if 'body' field is NOT stored (stored=false)..."
echo ""

SCHEMA_CHECK=$(curl -s "$SOLR_URL/$COLLECTION/schema/fields?wt=json" | grep -A 3 '"name":"body"')

echo "$SCHEMA_CHECK"
echo ""

if echo "$SCHEMA_CHECK" | grep -q '"stored":false'; then
    echo "✓ Schema verification PASSED: body field is NOT stored"
    echo "✓ New schema successfully applied!"
else
    echo "✗ Schema verification FAILED: body field might still be stored"
    echo "  Please check if Solr was restarted with new solrconfig.xml"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "Re-indexing complete!"
echo "════════════════════════════════════════════════════════"
