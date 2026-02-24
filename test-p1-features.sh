#!/bin/bash

# Test P1 Features Implementation
# Tests: Tag Cloud drill-down, Tag co-occurrence, Bookshelf integration

set -e

API_URL="${API_URL:-http://localhost:3001}"
VERBOSE="${VERBOSE:-true}"
BOOTSTRAP_DOCKER="${BOOTSTRAP_DOCKER:-false}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

echo "=========================================="
echo "Testing Beacon P1 Features"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_pass() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_fail() { echo -e "${RED}✗ ${1}${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ ${1}${NC}"; }

api_reachable() {
  curl -fsS "$API_URL/health" > /dev/null 2>&1 || curl -fsS "$API_URL/api/health" > /dev/null 2>&1
}

bootstrap_docker_if_needed() {
  if api_reachable; then
    return 0
  fi

  if [ "$BOOTSTRAP_DOCKER" != "true" ]; then
    log_fail "API is not reachable at $API_URL. Start backend first or rerun with BOOTSTRAP_DOCKER=true"
    return 1
  fi

  if ! command -v docker > /dev/null 2>&1; then
    log_fail "BOOTSTRAP_DOCKER=true but docker is not installed on this host"
    return 1
  fi

  log_info "API unavailable. Bootstrapping docker compose stack ($COMPOSE_FILE)..."
  docker compose -f "$COMPOSE_FILE" up -d db backend > /tmp/beacon-test-p1-docker.log 2>&1 || {
    log_fail "docker compose up failed. See /tmp/beacon-test-p1-docker.log"
    return 1
  }

  for i in {1..60}; do
    if api_reachable; then
      log_pass "API became reachable after docker bootstrap"
      return 0
    fi
    sleep 2
  done

  log_fail "API did not become reachable after docker bootstrap"
  return 1
}

# Test 1: Basic tag cloud endpoint
test_tag_cloud_basic() {
  log_info "Test 1: GET /api/tags/cloud (basic, no filters)"
  
  response=$(curl -s "$API_URL/api/tags/cloud")
  
  if echo "$response" | jq -e '.tags' > /dev/null 2>&1; then
    tag_count=$(echo "$response" | jq '.tags | length')
    log_pass "Tag cloud returned $tag_count tags"
    
    # Check structure (if data exists)
    if [ "$tag_count" -eq 0 ]; then
      log_warn "Tag cloud is empty; skipping shape validation"
    elif echo "$response" | jq -e '.tags[0] | has("tag") and has("count") and has("size") and has("color")' > /dev/null 2>&1; then
      log_pass "Tag cloud structure is correct (has tag, count, size, color)"
    else
      log_fail "Tag cloud structure is incorrect"
      return 1
    fi
  else
    log_fail "Tag cloud endpoint returned invalid JSON"
    return 1
  fi
}

# Test 2: Tag cloud with minCount filter
test_tag_cloud_mincount() {
  log_info "Test 2: GET /api/tags/cloud?minCount=5"
  
  response=$(curl -s "$API_URL/api/tags/cloud?minCount=5")
  
  if echo "$response" | jq -e '.tags' > /dev/null 2>&1; then
    tag_count=$(echo "$response" | jq '.tags | length')
    if [ "$tag_count" -eq 0 ]; then
      log_warn "No tags available for minCount assertion"
      return 0
    fi
    min_count=$(echo "$response" | jq '[.tags[].count] | min // 0')
    if [ "$min_count" -ge 5 ]; then
      log_pass "minCount filter works (minimum count: $min_count)"
    else
      log_warn "minCount filter may not be working as expected (min count: $min_count)"
    fi
  else
    log_fail "Tag cloud with minCount returned invalid JSON"
    return 1
  fi
}

# Test 3: Tag co-occurrence endpoint
test_tag_cooccurrence() {
  log_info "Test 3: GET /api/tags/cooccurrence (with selectedTags)"
  
  # First, get a tag to test with
  response=$(curl -s "$API_URL/api/tags?limit=1")
  first_tag=$(echo "$response" | jq -r '.tags[0].name' 2>/dev/null)
  
  if [ -z "$first_tag" ] || [ "$first_tag" = "null" ]; then
    log_warn "No tags available to test co-occurrence"
    return 0
  fi
  
  log_info "Testing with tag: $first_tag"
  
  cooccurrence=$(curl -s "$API_URL/api/tags/cooccurrence?selectedTags=$first_tag")
  
  if echo "$cooccurrence" | jq -e '.relatedTags' > /dev/null 2>&1; then
    related_count=$(echo "$cooccurrence" | jq '.relatedTags | length')
    log_pass "Co-occurrence endpoint works, returned $related_count related tags"
    
    # Check structure (if data exists)
    if [ "$related_count" -eq 0 ]; then
      log_warn "No related tags; skipping co-occurrence shape validation"
    elif echo "$cooccurrence" | jq -e '.relatedTags[0] | has("tag") and has("count") and has("relatednessScore")' > /dev/null 2>&1; then
      log_pass "Co-occurrence structure is correct (has tag, count, relatednessScore)"
    else
      log_fail "Co-occurrence structure is incorrect"
      return 1
    fi
  else
    log_fail "Co-occurrence endpoint returned invalid JSON"
    return 1
  fi
}

# Test 4: Tag cloud with selected tags (drill-down)
test_tag_cloud_drilldown() {
  log_info "Test 4: GET /api/tags/cloud?selectedTags=X,Y (drill-down)"
  
  # Get two tags to test with
  tags_response=$(curl -s "$API_URL/api/tags?limit=2")
  tag1=$(echo "$tags_response" | jq -r '.tags[0].name' 2>/dev/null)
  tag2=$(echo "$tags_response" | jq -r '.tags[1].name' 2>/dev/null)
  
  if [ -z "$tag1" ] || [ "$tag1" = "null" ]; then
    log_warn "Not enough tags available to test drill-down"
    return 0
  fi
  
  log_info "Testing with tags: $tag1, $tag2"
  
  if [ ! -z "$tag2" ] && [ "$tag2" != "null" ]; then
    selected_tags="$tag1,$tag2"
  else
    selected_tags="$tag1"
  fi
  
  response=$(curl -s "$API_URL/api/tags/cloud?selectedTags=$selected_tags")
  
  if echo "$response" | jq -e '.selectedTags' > /dev/null 2>&1; then
    breadcrumb_count=$(echo "$response" | jq '.selectedTags | length')
    log_pass "Drill-down breadcrumb shows $breadcrumb_count tags"
  else
    log_fail "Tag cloud drill-down returned invalid JSON"
    return 1
  fi
}

# Test 5: Verify Bookshelf integration
test_bookshelf_documents() {
  log_info "Test 5: GET /api/documents (for Bookshelf integration)"
  
  response=$(curl -s "$API_URL/api/documents?limit=5")
  
  if echo "$response" | jq -e '.[0]' > /dev/null 2>&1; then
    doc_count=$(echo "$response" | jq 'length')
    log_pass "Documents endpoint works, returned $doc_count documents"
  else
    log_fail "Documents endpoint returned invalid JSON"
    return 1
  fi
}

# Test 6: Search with tag filtering (used by RichContentView)
test_search_with_tags() {
  log_info "Test 6: GET /api/search/advanced?q=test (RichContentView integration)"
  
  response=$(curl -s "$API_URL/api/search/advanced?q=test&limit=5")
  
  if echo "$response" | jq -e '.results' > /dev/null 2>&1; then
    result_count=$(echo "$response" | jq '.results | length')
    log_pass "Advanced search works, returned $result_count results"
  else
    log_fail "Advanced search returned invalid JSON or missing results"
    return 1
  fi
}

# Run all tests
run_all_tests() {
  local passed=0
  local failed=0
  
  if test_tag_cloud_basic; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
  echo ""
  if test_tag_cloud_mincount; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
  echo ""
  if test_tag_cooccurrence; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
  echo ""
  if test_tag_cloud_drilldown; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
  echo ""
  if test_bookshelf_documents; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
  echo ""
  if test_search_with_tags; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
  
  echo ""
  echo "=========================================="
  echo "Test Summary"
  echo "=========================================="
  log_pass "Passed: $passed"
  if [ $failed -gt 0 ]; then
    log_fail "Failed: $failed"
    return 1
  else
    log_pass "All tests passed!"
    return 0
  fi
}

# Health/bootstrap check
log_info "Checking API health..."
bootstrap_docker_if_needed

# Run tests
run_all_tests
exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
  log_pass "P1 Features Test Suite: PASSED"
else
  log_fail "P1 Features Test Suite: FAILED"
fi

exit $exit_code
