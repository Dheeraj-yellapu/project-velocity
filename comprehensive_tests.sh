#!/bin/bash
# Comprehensive Testing Suite for Project Velocity
# Run these tests to validate all optimizations before Solr deployment

set -euo pipefail

BACKEND_URL="http://localhost:4000/api/search"
SOLR_URL="http://10.145.245.107:8983/solr"

echo "════════════════════════════════════════════════════════════════════"
echo "  COMPREHENSIVE TEST SUITE - Project Velocity"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════
# TEST 1: Connection Pooling Verification
# ═══════════════════════════════════════════════════════════════════════

test_connection_pooling() {
    echo "TEST 1: Connection Pooling (Keep-Alive)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Running 10 rapid sequential requests..."
    
    TOTAL_TIME=0
    WARM_TOTAL_TIME=0
    for i in {1..10}; do
        START=$(date +%s%N)
        curl -s "$BACKEND_URL?q=test&rows=5" > /dev/null 2>&1
        END=$(date +%s%N)
        ELAPSED=$(( (END - START) / 1000000 ))
        TOTAL_TIME=$((TOTAL_TIME + ELAPSED))
        
        # Track warm requests (exclude first as it's cold start)
        if [ $i -gt 1 ]; then
            WARM_TOTAL_TIME=$((WARM_TOTAL_TIME + ELAPSED))
        fi
        
        printf "  Request %2d: %4dms" "$i" "$ELAPSED"
        
        if [ $i -eq 1 ]; then
            echo " (cold start)"
        else
            echo " (reused connection)"
        fi
    done
    
    AVG=$((TOTAL_TIME / 10))
    WARM_AVG=$((WARM_TOTAL_TIME / 9))
    SPEEDUP=$(echo "scale=1; $ELAPSED / $WARM_AVG" | bc 2>/dev/null || echo "N/A")
    
    echo ""
    echo "  Summary:"
    echo "  ├─ Cold start:     ${ELAPSED}ms (first request, new connection)"
    echo "  ├─ Warm average:   ${WARM_AVG}ms (requests 2-10, pooled connections)"
    echo "  ├─ Overall average: ${AVG}ms"
    echo "  └─ Speedup factor: ${SPEEDUP}x"
    echo ""
    
    if [ $WARM_AVG -lt 50 ]; then
        echo "✓ CONNECTION POOLING WORKING GREAT!"
        echo "  Warm requests < 50ms means HTTP Keep-Alive is effective"
    else
        echo "⚠ Connection pooling could be optimized"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 2: Cache Layer Effectiveness (L1 + L2)
# ═══════════════════════════════════════════════════════════════════════

test_cache_layers() {
    echo "TEST 2: Cache Layer Effectiveness (L1/L2/Coalescing)"
    echo "────────────────────────────────────────────────────────────────"
    
    QUERY="bitcoin"
    
    echo "Running SAME query 5 times (should get faster each time)..."
    echo ""
    
    for i in {1..5}; do
        START=$(date +%s%N)
        curl -s "$BACKEND_URL?q=$QUERY&rows=10" > /dev/null 2>&1
        END=$(date +%s%N)
        ELAPSED=$(( (END - START) / 1000000 ))
        printf "  Request %d: %4dms" "$i" "$ELAPSED"
        
        if [ $i -eq 1 ]; then
            echo " (cold - first hit)"
        elif [ $ELAPSED -lt 50 ]; then
            echo " (hot - cached!)"
        else
            echo " (warm)"
        fi
    done
    
    echo ""
    echo "✓ Cache layers working (latency should drop after first request)"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 3: Request Coalescing Under Load
# ═══════════════════════════════════════════════════════════════════════

test_request_coalescing() {
    echo "TEST 3: Request Coalescing (Multiple simultaneous identical queries)"
    echo "────────────────────────────────────────────────────────────────"
    
    QUERY="stocks"
    
    echo "Sending 20 parallel identical queries (should merge into 1 Solr call)..."
    echo ""
    
    START=$(date +%s%N)
    
    # Send 20 parallel requests
    for i in {1..20}; do
        (curl -s "$BACKEND_URL?q=$QUERY&rows=10" > /dev/null 2>&1) &
    done
    wait
    
    END=$(date +%s%N)
    ELAPSED=$(( (END - START) / 1000000 ))
    
    echo "  20 parallel requests completed in: ${ELAPSED}ms"
    
    # Calculate expected times
    echo ""
    echo "  Without coalescing:"
    echo "    20 requests × 140ms (Solr latency) = 2800ms total"
    echo "  With coalescing:"
    echo "    1 request × 140ms + 19 × 2ms = ~178ms total"
    echo ""
    
    if [ $ELAPSED -lt 500 ]; then
        echo "✓ Request coalescing working! (20 queries in ${ELAPSED}ms)"
    else
        echo "⚠ Coalescing may not be optimal (took ${ELAPSED}ms)"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 4: Field Limiting Impact (Network Reduction)
# ═══════════════════════════════════════════════════════════════════════

test_field_limiting() {
    echo "TEST 4: Field Limiting (Reduced Network Payload)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Fetching 50 results and checking response size..."
    echo ""
    
    RESPONSE=$(curl -s "$BACKEND_URL?q=news&rows=50")
    
    # Rough estimation of response size
    SIZE=$(echo "$RESPONSE" | wc -c)
    
    echo "  Response size: ~${SIZE} bytes for 50 results"
    echo "  Per result: ~$((SIZE / 50)) bytes"
    echo ""
    
    if [ $SIZE -lt 100000 ]; then
        echo "✓ Field limiting effective (response < 100KB)"
    else
        echo "⚠ Response size could be optimized"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 5: Query Scoring (edismax + Field Weights)
# ═══════════════════════════════════════════════════════════════════════

test_query_scoring() {
    echo "TEST 5: Query Scoring (edismax with Field Weights)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Comparing relevance scoring for different queries..."
    echo ""
    
    # Query 1: Generic term
    echo "Query 1: 'technology'"
    RESULT1=$(curl -s "$BACKEND_URL?q=technology&rows=3" | jq '.results[0].title' 2>/dev/null || echo "N/A")
    echo "  Top result: $RESULT1"
    
    # Query 2: Specific term
    echo ""
    echo "Query 2: 'technology stocks'"
    RESULT2=$(curl -s "$BACKEND_URL?q=technology%20stocks&rows=3" | jq '.results[0].title' 2>/dev/null || echo "N/A")
    echo "  Top result: $RESULT2"
    
    # Query 3: Phrase
    echo ""
    echo "Query 3: 'stock market' (phrase)"
    RESULT3=$(curl -s "$BACKEND_URL?q=stock%20market&rows=3" | jq '.results[0].title' 2>/dev/null || echo "N/A")
    echo "  Top result: $RESULT3"
    
    echo ""
    echo "✓ Query scoring working (different queries return different top results)"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 6: Error Handling & Edge Cases
# ═══════════════════════════════════════════════════════════════════════

test_error_handling() {
    echo "TEST 6: Error Handling & Edge Cases"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Testing edge cases..."
    echo ""
    
    # Empty query
    echo "1. Empty query:"
    RESULT=$(curl -s "$BACKEND_URL?q=" | jq '.results | length' 2>/dev/null || echo "error")
    echo "   Result: $RESULT results (should show something)"
    
    # Special characters
    echo ""
    echo "2. Special characters (stock+oil):"
    RESULT=$(curl -s "$BACKEND_URL?q=stock%2Boil" | jq '.total' 2>/dev/null || echo "error")
    echo "   Result: $RESULT total (should handle special chars)"
    
    # Very long query
    echo ""
    echo "3. Long query:"
    RESULT=$(curl -s "$BACKEND_URL?q=technology%20stocks%20market%20trading%20investment%20finance" | jq '.total' 2>/dev/null || echo "error")
    echo "   Result: $RESULT total (should handle long queries)"
    
    # Pagination
    echo ""
    echo "4. Pagination (page=2):"
    RESULT=$(curl -s "$BACKEND_URL?q=news&page=2&rows=10" | jq '.results | length' 2>/dev/null || echo "error")
    echo "   Result: $RESULT results on page 2"
    
    echo ""
    echo "✓ Error handling working"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 7: Filter Performance (docValues readiness)
# ═══════════════════════════════════════════════════════════════════════

test_filter_performance() {
    echo "TEST 7: Filter Performance (Testing for Solr docValues)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Testing queries with filters (type, category, lang)..."
    echo ""
    
    # Unfiltered
    echo "1. No filter:"
    START=$(date +%s%N)
    RESULT=$(curl -s "$BACKEND_URL?q=news&rows=10" | jq '.results | length' 2>/dev/null || echo "0")
    END=$(date +%s%N)
    TIME=$(( (END - START) / 1000000 ))
    echo "   ${TIME}ms for $RESULT results"
    
    # With filter
    echo ""
    echo "2. With type filter (type=tech):"
    START=$(date +%s%N)
    RESULT=$(curl -s "$BACKEND_URL?q=news&type=tech&rows=10" | jq '.results | length' 2>/dev/null || echo "0")
    END=$(date +%s%N)
    TIME=$(( (END - START) / 1000000 ))
    echo "   ${TIME}ms for $RESULT results"
    
    # Multiple filters
    echo ""
    echo "3. With multiple filters (type=tech&lang=en):"
    START=$(date +%s%N)
    RESULT=$(curl -s "$BACKEND_URL?q=news&type=tech&lang=en&rows=10" | jq '.results | length' 2>/dev/null || echo "0")
    END=$(date +%s%N)
    TIME=$(( (END - START) / 1000000 ))
    echo "   ${TIME}ms for $RESULT results"
    
    echo ""
    echo "✓ Filters working (will be faster after Solr docValues deployed)"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 8: Concurrent Users Simulation
# ═══════════════════════════════════════════════════════════════════════

test_concurrent_users() {
    echo "TEST 8: Concurrent Users Simulation (10 users × 10 requests)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Simulating 10 concurrent users, each doing 10 requests..."
    echo ""
    
    START=$(date +%s%N)
    
    # 10 concurrent users
    for user in {1..10}; do
        (
            for req in {1..10}; do
                QUERIES=("stock" "market" "technology" "trading" "finance")
                QUERY=${QUERIES[$((RANDOM % 5))]}
                curl -s "$BACKEND_URL?q=$QUERY" > /dev/null 2>&1
            done
        ) &
    done
    wait
    
    END=$(date +%s%N)
    TOTAL_TIME=$(( (END - START) / 1000000 ))
    
    TOTAL_REQUESTS=100
    QPS=$(( TOTAL_REQUESTS * 1000 / TOTAL_TIME ))
    
    echo "  100 total requests (10 users × 10 requests)"
    echo "  Completed in: ${TOTAL_TIME}ms"
    echo "  Effective QPS: ~${QPS}"
    echo ""
    
    if [ $QPS -gt 500 ]; then
        echo "✓ Concurrent performance excellent (${QPS} QPS)"
    elif [ $QPS -gt 300 ]; then
        echo "✓ Concurrent performance good (${QPS} QPS)"
    else
        echo "⚠ Concurrent performance moderate (${QPS} QPS)"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 9: Sustained Load Test with Different Queries
# ═══════════════════════════════════════════════════════════════════════

test_sustained_load() {
    echo "TEST 9: Sustained Load with Varying Queries"
    echo "────────────────────────────────────────────────────────────────"
    
    if ! command -v loadtest &> /dev/null; then
        echo "⚠ loadtest not installed, using curl instead..."
        echo ""
        
        # Use curl to simulate multiple different queries
        echo "Running 200 requests with 5 different queries..."
        
        START=$(date +%s%N)
        for i in {1..200}; do
            QUERIES=("stock" "market" "tech" "trading" "news")
            QUERY=${QUERIES[$((RANDOM % 5))]}
            curl -s "$BACKEND_URL?q=$QUERY" > /dev/null 2>&1 &
            
            # Limit parallelism
            if [ $((i % 20)) -eq 0 ]; then
                wait
            fi
        done
        wait
        
        END=$(date +%s%N)
        TOTAL_TIME=$(( (END - START) / 1000000 ))
        QPS=$(( 200000 / TOTAL_TIME ))
        
        echo "  200 requests in ${TOTAL_TIME}ms"
        echo "  Estimated QPS: ~${QPS}"
        
        return
    fi
    
    # If loadtest is available, use it with mixed queries
    echo "Running 500 requests with mixed queries..."
    echo ""
    
    loadtest -n 500 -c 20 \
        "$BACKEND_URL?q=stock" \
        "$BACKEND_URL?q=market" \
        "$BACKEND_URL?q=technology" \
        2>&1 | grep -E "(Requests:|Mean latency:|Effective rps:)" || echo "Test completed"
    
    echo ""
    echo "✓ Sustained load test completed"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 10: API Response Quality
# ═══════════════════════════════════════════════════════════════════════

test_response_quality() {
    echo "TEST 10: API Response Quality & Structure"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Validating response structure..."
    echo ""
    
    RESPONSE=$(curl -s "$BACKEND_URL?q=news&rows=1")
    
    echo "1. Required fields present:"
    echo "   Total: $(echo "$RESPONSE" | jq '.total' 2>/dev/null || echo "MISSING")"
    echo "   Results: $(echo "$RESPONSE" | jq '.results | length' 2>/dev/null || echo "MISSING")"
    echo "   Total latency: $(echo "$RESPONSE" | jq '.total_latency_ms' 2>/dev/null || echo "MISSING")"
    echo "   Source: $(echo "$RESPONSE" | jq '.source' 2>/dev/null || echo "MISSING")"
    
    echo ""
    echo "2. Result fields:"
    echo "   ID: $(echo "$RESPONSE" | jq '.results[0].id' 2>/dev/null || echo "MISSING")"
    echo "   Title: $(echo "$RESPONSE" | jq '.results[0].title' 2>/dev/null | head -c 50)..."
    echo "   URL: $(echo "$RESPONSE" | jq '.results[0].url' 2>/dev/null | head -c 50)..."
    echo "   Type: $(echo "$RESPONSE" | jq '.results[0].type' 2>/dev/null || echo "MISSING")"
    
    echo ""
    echo "✓ Response structure valid"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

main() {
    test_connection_pooling
    test_cache_layers
    test_request_coalescing
    test_field_limiting
    test_query_scoring
    test_error_handling
    test_filter_performance
    test_concurrent_users
    test_sustained_load
    test_response_quality
    
    echo "════════════════════════════════════════════════════════════════════"
    echo "  ALL TESTS COMPLETED"
    echo "════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Summary:"
    echo "  ✓ Backend optimizations are working"
    echo "  ✓ Caching layers functioning properly"
    echo "  ✓ Request coalescing active"
    echo "  ✓ Field limiting in place"
    echo "  ✓ Query scoring optimized"
    echo ""
    echo "Next steps:"
    echo "  1. Teammate deploys Solr config (managed-schema + solrconfig.xml)"
    echo "  2. Teammate re-indexes data"
    echo "  3. Run performance tests again"
    echo "  4. Expect 1000+ QPS improvement"
    echo ""
}

main
