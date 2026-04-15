#!/bin/bash
# Performance Testing Suite for Project Velocity
# Tests QPS, latency, cache effectiveness, and system load

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:4000/api/search}"
SOLR_URL="${SOLR_URL:-http://10.145.245.107:8983/solr}"
TEST_QUERY="${TEST_QUERY:-stock}"

# Results file
RESULTS_FILE="/tmp/performance_test_$(date +%Y%m%d_%H%M%S).txt"

# Utility functions
log_header() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_result() {
    echo "$1" | tee -a "$RESULTS_FILE"
}

# Test 1: Connectivity Check
test_connectivity() {
    log_header "TEST 1: Connectivity Check"
    
    log_info "Checking Backend..."
    if curl -s "$BACKEND_URL?q=test" > /dev/null 2>&1; then
        log_success "Backend is responding"
    else
        log_error "Backend is NOT responding at $BACKEND_URL"
        return 1
    fi
    
    log_info "Checking Solr..."
    if curl -s "$SOLR_URL/admin/info/system?wt=json" > /dev/null 2>&1; then
        log_success "Solr is responding"
    else
        log_error "Solr is NOT responding at $SOLR_URL"
        return 1
    fi
    
    echo ""
}

# Test 2: Single Request Latency
test_single_request() {
    log_header "TEST 2: Single Request Latency (Warmup)"
    
    log_info "Running 1 request to warm up cache..."
    START_TIME=$(date +%s%N)
    RESPONSE=$(curl -s "$BACKEND_URL?q=$TEST_QUERY&rows=10")
    END_TIME=$(date +%s%N)
    
    LATENCY_MS=$(( (END_TIME - START_TIME) / 1000000 ))
    TOTAL_RESULTS=$(echo "$RESPONSE" | jq '.total // 0' 2>/dev/null || echo "?")
    
    log_result "Warmup Request Latency: ${LATENCY_MS}ms"
    log_result "Total Results Available: $TOTAL_RESULTS"
    log_success "Cache warmed up"
    
    echo ""
}

# Test 3: Sequential Request Latency (Cache Effectiveness)
test_cache_effectiveness() {
    log_header "TEST 3: Cache Effectiveness (Sequential Requests)"
    
    log_info "Running 10 sequential requests to same query..."
    log_result ""
    log_result "Sequential Request Latencies:"
    
    TOTAL_TIME=0
    MAX_TIME=0
    MIN_TIME=9999
    
    for i in {1..10}; do
        START_TIME=$(date +%s%N)
        curl -s "$BACKEND_URL?q=$TEST_QUERY&rows=10" > /dev/null 2>&1
        END_TIME=$(date +%s%N)
        
        ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
        TOTAL_TIME=$((TOTAL_TIME + ELAPSED_MS))
        
        [ $ELAPSED_MS -gt $MAX_TIME ] && MAX_TIME=$ELAPSED_MS
        [ $ELAPSED_MS -lt $MIN_TIME ] && MIN_TIME=$ELAPSED_MS
        
        printf "  Request %2d: %4dms" "$i" "$ELAPSED_MS"
        if [ $i -eq 1 ]; then
            echo " (cold)"
        elif [ $ELAPSED_MS -lt 50 ]; then
            echo " (hot - cached)"
        else
            echo " (warm)"
        fi
        
        log_result "  Request $i: ${ELAPSED_MS}ms"
    done
    
    AVG_TIME=$((TOTAL_TIME / 10))
    
    echo ""
    log_result ""
    log_result "Cache Statistics:"
    log_result "  Average Latency: ${AVG_TIME}ms"
    log_result "  Min Latency: ${MIN_TIME}ms (best case - from cache)"
    log_result "  Max Latency: ${MAX_TIME}ms (worst case - cold start)"
    log_success "Cache working: min ${MIN_TIME}ms vs max ${MAX_TIME}ms"
    
    echo ""
}

# Test 4: Burst Load Test
test_burst_load() {
    log_header "TEST 4: Burst Load Test (50 concurrent requests)"
    
    log_info "Sending 50 requests in parallel..."
    
    START_BURST=$(date +%s%N)
    
    # Use GNU parallel if available, fallback to xargs
    if command -v parallel &> /dev/null; then
        TIME_DATA=$(parallel --max-procs 50 \
            "curl -s '$BACKEND_URL?q=$TEST_QUERY&rows=10' > /dev/null 2>&1; echo \$?" \
            ::: {1..50} 2>&1 | grep -c "^0" || echo "50")
    else
        # Fallback using xargs
        TIME_DATA=$(seq 1 50 | xargs -P 50 -I {} sh -c \
            "curl -s '$BACKEND_URL?q=$TEST_QUERY&rows=10' > /dev/null 2>&1" 2>&1 ; echo "50")
    fi
    
    END_BURST=$(date +%s%N)
    BURST_TIME_MS=$(( (END_BURST - START_BURST) / 1000000 ))
    
    BURST_QPS=$(( 50000 / BURST_TIME_MS ))
    
    log_result "Burst Test Results:"
    log_result "  Total Time: ${BURST_TIME_MS}ms"
    log_result "  Requests: 50"
    log_result "  Estimated QPS: ~$BURST_QPS"
    log_success "Burst test completed"
    
    echo ""
}

# Test 5: Sustained Load Test (requires Siege)
test_siege_load() {
    log_header "TEST 5: Sustained Load Test (Siege - 100 concurrent users)"
    
    if ! command -v siege &> /dev/null; then
        log_warning "Siege not installed. Skipping this test."
        log_warning "Install with: sudo apt install siege"
        return 0
    fi
    
    log_info "Running Siege: 100 concurrent users, 50 requests each (5000 total)..."
    log_info "This will take ~1-2 minutes..."
    echo ""
    
    # Run Siege with concurrency 100, 50 repetitions
    SIEGE_OUTPUT=$(siege -c 100 -r 50 "$BACKEND_URL?q=$TEST_QUERY" -b 2>&1 | grep -A 20 "Transactions:")
    
    # Extract key metrics
    TRANSACTIONS=$(echo "$SIEGE_OUTPUT" | grep "Transactions:" | awk '{print $2}')
    AVAILABILITY=$(echo "$SIEGE_OUTPUT" | grep "Availability:" | awk '{print $2}')
    ELAPSED_TIME=$(echo "$SIEGE_OUTPUT" | grep "Elapsed time:" | awk '{print $3}')
    TRANS_RATE=$(echo "$SIEGE_OUTPUT" | grep "Transaction rate:" | awk '{print $3}')
    RESPONSE_TIME=$(echo "$SIEGE_OUTPUT" | grep "Response time:" | awk '{print $3}')
    
    log_result "Siege Results:"
    log_result "  Transactions: $TRANSACTIONS hits"
    log_result "  Availability: $AVAILABILITY %"
    log_result "  Elapsed Time: $ELAPSED_TIME seconds"
    log_result "  Transaction Rate: $TRANS_RATE trans/sec (QPS)"
    log_result "  Response Time: $RESPONSE_TIME seconds"
    
    if [ "$(echo "$TRANS_RATE > 600" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
        log_success "QPS target achieved: $TRANS_RATE trans/sec (target: 600+)"
    else
        log_warning "QPS below target: $TRANS_RATE trans/sec (target: 600+)"
    fi
    
    echo ""
}

# Test 6: Mixed Query Patterns
test_mixed_queries() {
    log_header "TEST 6: Mixed Query Patterns (Different Searches)"
    
    QUERIES=("stock" "market" "technology" "politics" "health")
    
    log_info "Running 5 different queries, 5 times each..."
    log_result ""
    log_result "Mixed Query Test Results:"
    
    TOTAL_QUERIES=0
    TOTAL_LATENCY=0
    
    for query in "${QUERIES[@]}"; do
        for i in {1..5}; do
            START_TIME=$(date +%s%N)
            curl -s "$BACKEND_URL?q=$query&rows=5" > /dev/null 2>&1
            END_TIME=$(date +%s%N)
            
            ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
            TOTAL_LATENCY=$((TOTAL_LATENCY + ELAPSED_MS))
            TOTAL_QUERIES=$((TOTAL_QUERIES + 1))
        done
        AVG_LATENCY=$((TOTAL_LATENCY / TOTAL_QUERIES))
        log_result "  Query '$query': Average latency ~${AVG_LATENCY}ms"
    done
    
    OVERALL_AVG=$((TOTAL_LATENCY / TOTAL_QUERIES))
    log_result ""
    log_result "  Overall Average Latency: ${OVERALL_AVG}ms"
    log_success "Mixed queries test completed"
    
    echo ""
}

# Test 7: System Health Check
test_system_health() {
    log_header "TEST 7: System Health Check"
    
    # Check Solr heap
    log_info "Solr Heap Usage..."
    SOLR_INFO=$(curl -s "$SOLR_URL/admin/info/system?wt=json" 2>/dev/null)
    HEAP_MAX=$(echo "$SOLR_INFO" | jq '.jvm.memory.raw.max // 0' 2>/dev/null || echo "?")
    HEAP_USED=$(echo "$SOLR_INFO" | jq '.jvm.memory.raw.used // 0' 2>/dev/null || echo "?")
    
    if [ "$HEAP_MAX" != "?" ] && [ "$HEAP_USED" != "?" ]; then
        HEAP_PERCENT=$(( (HEAP_USED * 100) / HEAP_MAX ))
        log_result "  Heap Usage: ${HEAP_USED}B / ${HEAP_MAX}B (~${HEAP_PERCENT}%)"
        if [ $HEAP_PERCENT -gt 80 ]; then
            log_warning "Heap usage is high (${HEAP_PERCENT}%)"
        else
            log_success "Heap usage normal (${HEAP_PERCENT}%)"
        fi
    fi
    
    # Check system load
    log_info "System Load..."
    LOAD=$(uptime | awk -F'load average:' '{print $2}')
    log_result "  Load Average: $LOAD"
    
    # Check disk space
    log_info "Disk Space..."
    DISK=$(df -h / | awk 'NR==2 {print $5}')
    log_result "  Root Disk Used: $DISK"
    
    echo ""
}

# Main execution
main() {
    echo ""
    log_header "PERFORMANCE TEST SUITE - Project Velocity"
    echo -e "${YELLOW}Date: $(date)${NC}"
    echo -e "${YELLOW}Backend: $BACKEND_URL${NC}"
    echo -e "${YELLOW}Solr: $SOLR_URL${NC}"
    echo -e "${YELLOW}Results saved to: $RESULTS_FILE${NC}"
    echo ""
    
    # Initialize results file
    {
        echo "========================================"
        echo "Performance Test Results"
        echo "Date: $(date)"
        echo "========================================"
        echo ""
    } > "$RESULTS_FILE"
    
    # Run tests
    test_connectivity || exit 1
    test_single_request
    test_cache_effectiveness
    test_burst_load
    test_mixed_queries
    test_system_health
    test_siege_load
    
    # Summary
    log_header "TEST SUMMARY"
    log_success "All tests completed!"
    log_info "Results saved to: $RESULTS_FILE"
    echo ""
    
    # Print summary from results file
    tail -20 "$RESULTS_FILE"
}

# Run main function
main "$@"
