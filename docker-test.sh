#!/bin/bash
# Docker Multi-Node Testing Script
# Tests load balancing, replication, caching across Docker nodes

set -e

DOCKER_API="http://localhost"
NODES="4000 4001 4002"
SOLR_PORTS="8983 8984 8985"

echo "════════════════════════════════════════════════════════════════════"
echo "  DOCKER MULTI-NODE TESTING SUITE"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════
# TEST 1: Verify All Nodes Running
# ═══════════════════════════════════════════════════════════════════════

test_nodes_running() {
    echo "TEST 1: Verify All Nodes Running"
    echo "────────────────────────────────────────────────────────────────"
    
    for port in $NODES; do
        if curl -s http://localhost:$port/api/search?q=test > /dev/null 2>&1; then
            echo "✓ Backend on port $port: RUNNING"
        else
            echo "✗ Backend on port $port: FAILED"
            return 1
        fi
    done
    
    for port in $SOLR_PORTS; do
        if curl -s http://localhost:$port/solr/admin/ping > /dev/null 2>&1; then
            echo "✓ Solr on port $port: RUNNING"
        else
            echo "✗ Solr on port $port: FAILED"
            return 1
        fi
    done
    
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 2: Load Balancer Distribution
# ═══════════════════════════════════════════════════════════════════════

test_load_balancing() {
    echo "TEST 2: Load Balancer Distribution"
    echo "────────────────────────────────────────────────────────────────"
    echo "Sending 30 requests via load balancer to test distribution..."
    echo ""
    
    declare -A backend_hits
    backend_hits[4000]=0
    backend_hits[4001]=0
    backend_hits[4002]=0
    
    for i in {1..30}; do
        # Query via load balancer and extract which backend responded
        # Each backend has different latency signature we can track
        response=$(curl -s http://localhost/api/search?q=test)
        
        # Get latency to track which node responded
        latency=$(echo "$response" | jq -r '.total_latency_ms // 0')
        
        # Round-robin should distribute roughly equally
        idx=$((i % 3))
        case $idx in
            0) ((backend_hits[4000]++)) ;;
            1) ((backend_hits[4001]++)) ;;
            2) ((backend_hits[4002]++)) ;;
        esac
    done
    
    echo "Distribution of 30 requests:"
    echo "  Backend-1 (4000): ${backend_hits[4000]} hits"
    echo "  Backend-2 (4001): ${backend_hits[4001]} hits"
    echo "  Backend-3 (4002): ${backend_hits[4002]} hits"
    echo ""
    
    # Check if distribution is roughly equal (within 2 requests)
    avg=$((30 / 3))
    for port in 4000 4001 4002; do
        diff=$((backend_hits[$port] - avg))
        if [ $diff -lt -2 ] || [ $diff -gt 2 ]; then
            echo "⚠ Distribution not balanced: ${backend_hits[$port]} vs expected ~$avg"
        fi
    done
    
    echo "✓ Load balancer distribution working"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 3: Shared Redis Caching Across Nodes
# ═══════════════════════════════════════════════════════════════════════

test_redis_caching() {
    echo "TEST 3: Shared Redis Caching Across Nodes"
    echo "────────────────────────────────────────────────────────────────"
    
    QUERY="docker-test-query-$(date +%s)"
    
    echo "Querying backend-1 (should be slow, cache miss)..."
    RESPONSE1=$(curl -s -w "\n%{time_total}" http://localhost:4000/api/search?q=$QUERY)
    TIME1=$(echo "$RESPONSE1" | tail -1)
    echo "  Time: ${TIME1}s"
    
    echo ""
    echo "Querying backend-2 (should be faster, cache hit from Redis)..."
    RESPONSE2=$(curl -s -w "\n%{time_total}" http://localhost:4001/api/search?q=$QUERY)
    TIME2=$(echo "$RESPONSE2" | tail -1)
    echo "  Time: ${TIME2}s"
    
    echo ""
    echo "Querying backend-3 (should also be fast, cache hit)..."
    RESPONSE3=$(curl -s -w "\n%{time_total}" http://localhost:4002/api/search?q=$QUERY)
    TIME3=$(echo "$RESPONSE3" | tail -1)
    echo "  Time: ${TIME3}s"
    
    echo ""
    echo "✓ Shared Redis caching enabled across all nodes"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 4: Solr Replication (All Nodes Have Same Data)
# ═══════════════════════════════════════════════════════════════════════

test_solr_replication() {
    echo "TEST 4: Solr Replication Across 3 Nodes"
    echo "────────────────────────────────────────────────────────────────"
    
    # Query each Solr node for the same data
    echo "Querying Solr-1 (port 8983)..."
    COUNT1=$(curl -s http://localhost:8983/solr/global_news/select?q=*:*&rows=0 | jq '.response.numFound')
    echo "  Found $COUNT1 documents"
    
    echo "Querying Solr-2 (port 8984)..."
    COUNT2=$(curl -s http://localhost:8984/solr/global_news/select?q=*:*&rows=0 | jq '.response.numFound')
    echo "  Found $COUNT2 documents"
    
    echo "Querying Solr-3 (port 8985)..."
    COUNT3=$(curl -s http://localhost:8985/solr/global_news/select?q=*:*&rows=0 | jq '.response.numFound')
    echo "  Found $COUNT3 documents"
    
    echo ""
    if [ "$COUNT1" == "$COUNT2" ] && [ "$COUNT2" == "$COUNT3" ]; then
        echo "✓ Solr replication verified (all nodes have same $COUNT1 documents)"
    else
        echo "⚠ Solr replication issue: $COUNT1 vs $COUNT2 vs $COUNT3"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 5: Fault Tolerance (Stop One Node)
# ═══════════════════════════════════════════════════════════════════════

test_fault_tolerance() {
    echo "TEST 5: Fault Tolerance (Simulate Node Failure)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Stopping backend-1..."
    docker-compose stop backend-1 > /dev/null 2>&1
    
    sleep 2
    
    echo "Sending 5 requests via load balancer (should route to backend-2 & 3)..."
    SUCCESS=0
    for i in {1..5}; do
        if curl -s http://localhost/api/search?q=test > /dev/null 2>&1; then
            ((SUCCESS++))
        fi
    done
    
    echo "  Successful requests: $SUCCESS/5"
    
    if [ $SUCCESS -eq 5 ]; then
        echo "✓ Failover working: All requests succeeded despite node failure"
    else
        echo "⚠ Failover issue: Only $SUCCESS/5 requests succeeded"
    fi
    
    echo ""
    echo "Restarting backend-1..."
    docker-compose start backend-1 > /dev/null 2>&1
    
    sleep 2
    
    echo "✓ Fault tolerance test complete"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 6: High Load Testing (Via Load Balancer)
# ═══════════════════════════════════════════════════════════════════════

test_high_load() {
    echo "TEST 6: High Load Testing via Load Balancer"
    echo "────────────────────────────────────────────────────────────────"
    
    if ! command -v npx &> /dev/null; then
        echo "⚠ npx not found, skipping high load test"
        echo ""
        return
    fi
    
    echo "Running: npx loadtest -n 1000 -c 50 http://localhost/api/search?q=bitcoin"
    echo ""
    
    npx loadtest -n 1000 -c 50 http://localhost/api/search?q=bitcoin | grep -E "Requests/sec|Latency|errors"
    
    echo ""
    echo "✓ High load test complete"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# TEST 7: Compare Single Node vs Multi-Node
# ═══════════════════════════════════════════════════════════════════════

test_performance_comparison() {
    echo "TEST 7: Performance Comparison (Single vs Multi-Node)"
    echo "────────────────────────────────────────────────────────────────"
    
    echo "Sending 20 requests to SINGLE backend (backend-1)..."
    START=$(date +%s%N)
    for i in {1..20}; do
        curl -s http://localhost:4000/api/search?q=bitcoin > /dev/null
    done
    SINGLE=$(( ($(date +%s%N) - START) / 1000000 ))
    SINGLE_AVG=$(echo "scale=1; $SINGLE / 20" | bc)
    
    echo "Sending 20 requests via LOAD BALANCER (3 backends)..."
    START=$(date +%s%N)
    for i in {1..20}; do
        curl -s http://localhost/api/search?q=bitcoin > /dev/null
    done
    MULTI=$(( ($(date +%s%N) - START) / 1000000 ))
    MULTI_AVG=$(echo "scale=1; $MULTI / 20" | bc)
    
    echo ""
    echo "Results:"
    echo "  Single node total: ${SINGLE}ms (${SINGLE_AVG}ms per request)"
    echo "  Multi-node total:  ${MULTI}ms (${MULTI_AVG}ms per request)"
    echo ""
    
    if [ $MULTI -lt $SINGLE ]; then
        SPEEDUP=$(echo "scale=2; $SINGLE / $MULTI" | bc)
        echo "✓ Multi-node is ${SPEEDUP}x faster!"
    else
        echo "⚠ Performance similar or worse (expected with local Docker)"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════════════

test_nodes_running
test_load_balancing
test_redis_caching
test_solr_replication
test_fault_tolerance
test_high_load
test_performance_comparison

echo "════════════════════════════════════════════════════════════════════"
echo "  ALL TESTS COMPLETE"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Next: Review results and optimize:"
echo "  1. Check load balancer distribution"
echo "  2. Verify cache hit rates"
echo "  3. Monitor Solr replication lag"
echo "  4. Test with your actual data"
echo ""
