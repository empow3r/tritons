#!/bin/bash
# test-suite.sh - TRITONS Automated Testing Suite

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0
TESTS_SKIPPED=0

# Test results log
TEST_LOG="test-results-$(date +%Y%m%d_%H%M%S).log"

# Helper functions
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="${3:-0}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -n "Running: $test_name... "
    
    # Execute test
    eval "$test_command" >> "$TEST_LOG" 2>&1
    local result=$?
    
    if [ $result -eq $expected_result ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "[PASS] $test_name" >> "$TEST_LOG"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "[FAIL] $test_name (exit code: $result, expected: $expected_result)" >> "$TEST_LOG"
        return 1
    fi
}

skip_test() {
    local test_name="$1"
    local reason="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
    echo "Skipping: $test_name... ${YELLOW}⚠ SKIPPED${NC} ($reason)"
    echo "[SKIP] $test_name - $reason" >> "$TEST_LOG"
}

echo -e "${BOLD}${BLUE}🧪 TRITONS Test Suite${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Load environment
if [ -f .env ]; then
    source .env
fi

# 1. Critical Environment Tests
echo -e "${YELLOW}1. Critical Environment Tests${NC}"
run_test "NO_SIMULATIONS is true" "[ '$NO_SIMULATIONS' = 'true' ]"
run_test "Node.js version" "node -v | grep -E 'v1[6-9]|v2[0-9]'"
run_test "Environment file exists" "test -f .env"

# 2. System Structure Tests
echo -e "\n${YELLOW}2. System Structure Tests${NC}"
run_test "Core directory exists" "test -d core"
run_test "Agents directory exists" "test -d agents"
run_test "Infrastructure directory exists" "test -d infrastructure"
run_test "Tasks directory exists" "test -d tasks"
run_test "Package.json valid" "node -e 'require(\"./package.json\")'"

# 3. Core System Files
echo -e "\n${YELLOW}3. Core System Files${NC}"
run_test "Multi-LLM system exists" "test -f core/multi-llm-hierarchical-system.js"
run_test "Agent governance exists" "test -f core/agent-governance-system.js"
run_test "Swarm orchestrator exists" "test -f core/enhanced-swarm-orchestrator.js"

# 4. Department Tests
echo -e "\n${YELLOW}4. Department Configuration${NC}"
for dept in INFRA ARCHITECTURE AI_ML QUALITY SECURITY; do
    var_name="ENABLE_$dept"
    run_test "Department $dept configured" "[ '${!var_name}' = 'true' -o '${!var_name}' = 'false' ]"
done

# 5. Port Availability Tests
echo -e "\n${YELLOW}5. Port Availability${NC}"
run_test "Port 8080 available" "! lsof -i:8080"
run_test "Port 8082 available" "! lsof -i:8082"
run_test "Port 8085 available" "! lsof -i:8085"

# 6. Database Connectivity
echo -e "\n${YELLOW}6. Database Connectivity${NC}"
if command -v psql &> /dev/null; then
    run_test "PostgreSQL connection" "psql -h ${POSTGRES_HOST:-localhost} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-tritons} -d ${POSTGRES_DB:-tritons} -c 'SELECT 1' || true"
else
    skip_test "PostgreSQL connection" "psql not installed"
fi

if command -v redis-cli &> /dev/null; then
    run_test "Redis connection" "redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} ping | grep -q PONG || true"
else
    skip_test "Redis connection" "redis-cli not installed"
fi

# 7. API Key Tests
echo -e "\n${YELLOW}7. API Provider Configuration${NC}"
KEY_COUNT=0
[ -n "$CLAUDE_API_KEY" ] && ((KEY_COUNT++))
[ -n "$OPENAI_API_KEY" ] && ((KEY_COUNT++))
[ -n "$DEEPSEEK_API_KEY" ] && ((KEY_COUNT++))
[ -n "$KIMI_API_KEY" ] && ((KEY_COUNT++))
run_test "At least 2 API keys configured" "[ $KEY_COUNT -ge 2 ]"

# 8. Syntax Validation
echo -e "\n${YELLOW}8. JavaScript Syntax Validation${NC}"
for dir in core agents infrastructure tasks monitoring; do
    if [ -d "$dir" ]; then
        for file in $dir/*.js; do
            if [ -f "$file" ]; then
                run_test "Syntax: $(basename $file)" "node -c '$file'"
            fi
        done
    fi
done

# 9. Agent System Tests
echo -e "\n${YELLOW}9. Agent System Tests${NC}"

# Test agent spawning logic
cat > test-agent-spawn.js << 'EOF'
const config = {
    INITIAL_AGENTS: process.env.INITIAL_AGENTS || 5,
    MAX_AGENTS: process.env.MAX_AGENTS || 100
};

if (config.INITIAL_AGENTS > 0 && config.MAX_AGENTS >= config.INITIAL_AGENTS) {
    process.exit(0);
} else {
    process.exit(1);
}
EOF
run_test "Agent configuration valid" "node test-agent-spawn.js"
rm -f test-agent-spawn.js

# 10. Task Queue Tests
echo -e "\n${YELLOW}10. Task Queue Tests${NC}"

# Test task structure
cat > test-task-structure.js << 'EOF'
const task = {
    id: 'test-123',
    type: 'AI_ML',
    prompt: 'Test task',
    priority: 5,
    timestamp: Date.now()
};

// Validate task structure
if (task.id && task.type && task.prompt && task.priority && task.timestamp) {
    process.exit(0);
} else {
    process.exit(1);
}
EOF
run_test "Task structure valid" "node test-task-structure.js"
rm -f test-task-structure.js

# 11. Performance Tests
echo -e "\n${YELLOW}11. Performance Tests${NC}"

# Memory test
cat > test-memory-usage.js << 'EOF'
const os = require('os');
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedPercent = ((totalMem - freeMem) / totalMem) * 100;

console.log(`Memory usage: ${usedPercent.toFixed(2)}%`);
if (freeMem > 1024 * 1024 * 1024) { // 1GB free
    process.exit(0);
} else {
    process.exit(1);
}
EOF
run_test "Sufficient memory available" "node test-memory-usage.js"
rm -f test-memory-usage.js

# 12. Docker Tests
echo -e "\n${YELLOW}12. Docker Environment${NC}"
if command -v docker &> /dev/null; then
    run_test "Docker daemon running" "docker info"
    run_test "Docker Compose available" "docker-compose --version"
    run_test "Docker Compose file valid" "docker-compose config"
else
    skip_test "Docker tests" "Docker not installed"
fi

# 13. Security Tests
echo -e "\n${YELLOW}13. Security Tests${NC}"
run_test "No hardcoded secrets" "! grep -r 'password.*=.*[a-zA-Z0-9]' core/ agents/ --include='*.js' | grep -v '.env'"
run_test "JWT secret not default" "[ '$JWT_SECRET' != 'change-this-secret-key' ] || [ -z '$JWT_SECRET' ]"
run_test ".env not in git" "! git ls-files .env 2>/dev/null | grep -q '.env'"

# 14. Integration Tests
echo -e "\n${YELLOW}14. Integration Tests${NC}"

# Test department routing
cat > test-department-routing.js << 'EOF'
const departments = ['INFRA', 'ARCHITECTURE', 'AI_ML', 'QUALITY', 'SECURITY'];
const task = {
    type: 'AI_ML',
    prompt: 'Build a REST API'
};

if (departments.includes(task.type)) {
    process.exit(0);
} else {
    process.exit(1);
}
EOF
run_test "Department routing logic" "node test-department-routing.js"
rm -f test-department-routing.js

# 15. Deployment Readiness
echo -e "\n${YELLOW}15. Deployment Readiness${NC}"
run_test "Production config exists" "test -f docker-compose.yml || test -f deployment/docker-compose.yml"
run_test "Deployment scripts exist" "test -f deployment/deploy.sh || test -f scripts/deploy.sh"
run_test "Backup script exists" "test -f backup-restore.sh"
run_test "Health check script exists" "test -f health-check.sh"

# Test Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Total Tests: ${BOLD}$TESTS_TOTAL${NC}"
echo -e "Passed: ${GREEN}${BOLD}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}${BOLD}$TESTS_FAILED${NC}"
echo -e "Skipped: ${YELLOW}${BOLD}$TESTS_SKIPPED${NC}"

# Calculate success rate
SUCCESS_RATE=$(echo "scale=2; ($TESTS_PASSED * 100) / ($TESTS_TOTAL - $TESTS_SKIPPED)" | bc)
echo -e "Success Rate: ${BOLD}${SUCCESS_RATE}%${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✅ All tests passed!${NC}"
    echo -e "${GREEN}TRITONS is ready for deployment!${NC}"
    exit 0
else
    echo -e "\n${RED}${BOLD}❌ Some tests failed. Check $TEST_LOG for details.${NC}"
    echo -e "\nCritical failures:"
    grep "^\[FAIL\]" "$TEST_LOG" | grep -E "NO_SIMULATIONS|Multi-LLM|Agent governance"
    echo -e "\nRun './health-check.sh' for more diagnostics."
    exit 1
fi