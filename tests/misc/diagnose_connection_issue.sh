#!/bin/bash
# Diagnostic script to identify connection pooling issues

echo "════════════════════════════════════════════════════════════════════"
echo "  CONNECTION POOLING DIAGNOSTICS"
echo "════════════════════════════════════════════════════════════════════"
echo ""

BACKEND_URL="http://localhost:4000/api/search"
SOLR_URL="http://10.145.245.107:8983/solr"

# Check if backend is running
echo "1. CHECKING BACKEND STATUS..."
if ! curl -s "$BACKEND_URL?q=test" > /dev/null 2>&1; then
    echo "❌ Backend not responding at $BACKEND_URL"
    echo "   Start backend with: npm start (in backend folder)"
    exit 1
else
    echo "✓ Backend is running"
fi

echo ""

# Check if Solr is reachable
echo "2. CHECKING SOLR CONNECTION..."
if ! curl -s "$SOLR_URL" > /dev/null 2>&1; then
    echo "❌ Solr not reachable at $SOLR_URL"
    echo "   Make sure Solr is running on Windows machine"
else
    echo "✓ Solr is reachable from backend"
fi

echo ""

# Test fresh connection (simulates cold start)
echo "3. COLD START TEST (no connection reuse)..."
echo "   First request will create a new TCP connection..."
START=$(date +%s%N)
curl -s "$BACKEND_URL?q=test&rows=5" > /dev/null 2>&1
END=$(date +%s%N)
COLD_START=$(( (END - START) / 1000000 ))
echo "   Cold start time: ${COLD_START}ms"
echo ""

# Test warm connection (reuses connection)
echo "4. WARM START TEST (with connection reuse)..."
echo "   Subsequent requests should reuse the connection..."
TIMES=""
for i in {1..5}; do
    START=$(date +%s%N)
    curl -s "$BACKEND_URL?q=test&rows=5" > /dev/null 2>&1
    END=$(date +%s%N)
    ELAPSED=$(( (END - START) / 1000000 ))
    TIMES="$TIMES $ELAPSED"
    printf "   Request %d: %dms\n" "$i" "$ELAPSED"
done
echo ""

# Analyze
echo "5. ANALYSIS..."
if [ $COLD_START -gt 1000 ]; then
    echo "⚠️  COLD START TIME IS VERY HIGH: ${COLD_START}ms"
    echo "   This suggests:"
    echo "   a) First request to Solr is slow (Solr GC pause?)"
    echo "   b) Network latency to Solr is high"
    echo "   c) Solr query is slow (cold index)"
    echo ""
    echo "   SOLUTION:"
    echo "   - Run a warmup query on Solr before benchmarking"
    echo "   - Check Solr logs for GC or slow queries"
    echo "   - Verify network latency: ping 10.145.245.107"
else
    echo "✓ Cold start time acceptable: ${COLD_START}ms"
fi
echo ""

# Check connection pooling effectiveness
WARM_TIMES=($TIMES)
WARM_AVG=0
for t in "${WARM_TIMES[@]}"; do
    WARM_AVG=$((WARM_AVG + t))
done
WARM_AVG=$((WARM_AVG / ${#WARM_TIMES[@]}))

echo "   Warm request average: ${WARM_AVG}ms"
echo "   Speedup factor: $(echo "scale=2; $COLD_START / $WARM_AVG" | bc)x"
echo ""

if [ $WARM_AVG -lt 20 ]; then
    echo "✓ Connection pooling IS WORKING GREAT!"
    echo "   Warm requests are ${WARM_AVG}ms (near network latency)"
else
    echo "⚠ Connection pooling could be better"
    echo "   Warm requests are ${WARM_AVG}ms (higher than expected)"
fi

echo ""
echo "6. NETWORK LATENCY CHECK..."
echo "   Testing round-trip latency to Solr..."
PING_TIME=$(ping -c 1 10.145.245.107 2>/dev/null | grep time= | awk -F'=' '{print $2}' | awk '{print $1}')
if [ -z "$PING_TIME" ]; then
    echo "   Could not ping Solr (may require sudo or firewall rules)"
else
    echo "   Network RTT to Solr: ${PING_TIME}ms"
    if [ "${PING_TIME%.*}" -gt 50 ]; then
        echo "   ⚠ Network latency is high - limits max QPS"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""
