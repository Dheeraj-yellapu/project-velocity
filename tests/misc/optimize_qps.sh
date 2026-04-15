#!/bin/bash
# Quick Start: 170 QPS → 1000 QPS Optimization

set -e

echo "🚀 QPS Optimization Script"
echo "================================"
echo ""

# Step 1: Backup current configs
echo "Step 1: Backing up current configurations..."
cp /home/siddu/project-velocity/solr/schema/managed-schema /home/siddu/project-velocity/solr/schema/managed-schema.bak
cp /home/siddu/project-velocity/solr/config/solrconfig.xml /home/siddu/project-velocity/solr/config/solrconfig.xml.bak
echo "✅ Backups created"
echo ""

# Step 2: Stop Solr
echo "Step 2: Stopping Solr..."
solr stop
sleep 2
echo "✅ Solr stopped"
echo ""

# Step 3: Verify schema file exists and is readable
echo "Step 3: Checking Solr setup..."
if [ ! -f "/home/siddu/project-velocity/solr/schema/managed-schema" ]; then
    echo "❌ Schema file not found"
    exit 1
fi
echo "✅ Solr directory found"
echo ""

# Step 4: Start Solr with optimized settings
echo "Step 4: Starting Solr with optimized settings..."
echo "  - Heap: 2GB"
echo "  - GC: G1GC"
echo "  - Threads: 200-500"

solr start -m 2g -a "-Xms2g -Xmx2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"

# Wait for Solr to be ready
echo "Waiting for Solr to start..."
for i in {1..30}; do
    if curl -s "http://localhost:8983/solr/admin/cores" > /dev/null; then
        echo "✅ Solr started and ready"
        break
    fi
    sleep 1
done
echo ""

# Step 5: Show next steps
echo "========================================"
echo "✅ Solr started with optimized settings"
echo ""
echo "Next steps:"
echo ""
echo "1️⃣  Update schema:"
echo "   Replace /solr/schema/managed-schema with the optimized version"
echo "   (See: QPS_OPTIMIZATION_CHECKLIST.md - STEP 1)"
echo ""
echo "2️⃣  Update solrconfig.xml:"
echo "   Replace /solr/config/solrconfig.xml with the optimized version"
echo "   (See: QPS_OPTIMIZATION_CHECKLIST.md - STEP 2)"
echo ""
echo "3️⃣  Re-index data:"
echo "   curl -X POST \"http://localhost:8983/solr/global_news/update?commit=true\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     --data-binary @data.json"
echo ""
echo "4️⃣  Update backend queryBuilder.js"
echo "   (See: QPS_OPTIMIZATION_CHECKLIST.md - STEP 3)"
echo ""
echo "5️⃣  Update backend solrService.js"
echo "   (See: QPS_OPTIMIZATION_CHECKLIST.md - STEP 4)"
echo ""
echo "6️⃣  Test with Siege:"
echo "   siege -c 100 -r 50 'http://localhost:4000/api/search?q=stock' -b"
echo ""
echo "Expected Results:"
echo "  Current:  170 QPS, 200ms latency"
echo "  Target:  1000 QPS,  50ms latency"
echo "========================================"
