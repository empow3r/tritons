#!/bin/bash
# health-check.sh - TRITONS System Health Check

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏥 TRITONS Health Check${NC}"
echo "======================"

# Load environment
if [ -f ".env" ]; then
    source .env 2>/dev/null || true
fi

HEALTH_SCORE=0
MAX_SCORE=15

# 1. Check Node.js
echo -n "Node.js runtime: "
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗${NC}"
fi

# 2. Check Docker
echo -n "Docker installed: "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${YELLOW}⚠️ (optional)${NC}"
fi

# 3. Check dependencies
echo -n "Dependencies installed: "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗${NC}"
fi

# 4. Check NO_SIMULATIONS flag
echo -n "NO_SIMULATIONS enforced: "
if [ "$NO_SIMULATIONS" = "true" ]; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗ CRITICAL${NC}"
fi

# 5. Check API keys
echo -n "API keys configured: "
KEY_COUNT=0
[ -n "$CLAUDE_API_KEY" ] && ((KEY_COUNT++))
[ -n "$OPENAI_API_KEY" ] && ((KEY_COUNT++))
[ -n "$DEEPSEEK_API_KEY" ] && ((KEY_COUNT++))
[ -n "$KIMI_API_KEY" ] && ((KEY_COUNT++))

if [ $KEY_COUNT -gt 2 ]; then
    echo -e "${GREEN}✓ ($KEY_COUNT keys)${NC}"
    ((HEALTH_SCORE+=2))
elif [ $KEY_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️ ($KEY_COUNT keys)${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗${NC}"
fi

# 6. Check core ports
echo -n "Port 8080 available: "
if ! lsof -i:8080 &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${YELLOW}⚠️ (in use)${NC}"
fi

echo -n "Port 8082 available: "
if ! lsof -i:8082 &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${YELLOW}⚠️ (in use)${NC}"
fi

# 7. Check databases
echo -n "PostgreSQL connection: "
if command -v psql &> /dev/null && psql -h ${POSTGRES_HOST:-localhost} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-tritons} -d ${POSTGRES_DB:-tritons} -c "SELECT 1" &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${YELLOW}⚠️ (not connected)${NC}"
fi

echo -n "Redis connection: "
if command -v redis-cli &> /dev/null && redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} ping &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${YELLOW}⚠️ (not connected)${NC}"
fi

# 8. Check Ollama (local LLM)
echo -n "Ollama availability: "
if curl -s ${OLLAMA_HOST:-http://localhost:11434}/api/tags &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${YELLOW}⚠️ (optional)${NC}"
fi

# 9. Check directories
echo -n "Required directories: "
if [ -d "core" ] && [ -d "agents" ] && [ -d "infrastructure" ]; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗${NC}"
fi

# 10. Check core files
echo -n "Core system files: "
if [ -f "core/multi-llm-hierarchical-system.js" ] && [ -f "core/agent-governance-system.js" ]; then
    echo -e "${GREEN}✓${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗${NC}"
fi

# 11. Check memory
echo -n "System memory: "
if command -v free &> /dev/null; then
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    AVAIL_MEM=$(free -m | awk 'NR==2{print $7}')
    if [ $AVAIL_MEM -gt 4096 ]; then
        echo -e "${GREEN}✓ (${AVAIL_MEM}MB available)${NC}"
        ((HEALTH_SCORE++))
    else
        echo -e "${YELLOW}⚠️ (${AVAIL_MEM}MB available)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ (cannot check)${NC}"
fi

# 12. Check disk space
echo -n "Disk space: "
DISK_USAGE=$(df -h . | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo -e "${GREEN}✓ (${DISK_USAGE}% used)${NC}"
    ((HEALTH_SCORE++))
else
    echo -e "${RED}✗ (${DISK_USAGE}% used)${NC}"
fi

# Department Status
echo ""
echo "Department Status:"
for dept in INFRA ARCHITECTURE AI_ML QUALITY SECURITY; do
    echo -n "• $dept: "
    var_name="ENABLE_$dept"
    if [ "${!var_name}" = "true" ]; then
        echo -e "${GREEN}Active${NC}"
    else
        echo -e "${YELLOW}Inactive${NC}"
    fi
done

# Summary
echo ""
echo "======================"
echo -e "Health Score: ${HEALTH_SCORE}/${MAX_SCORE}"

if [ $HEALTH_SCORE -ge 13 ]; then
    echo -e "${GREEN}✅ System is healthy and ready!${NC}"
elif [ $HEALTH_SCORE -ge 10 ]; then
    echo -e "${GREEN}✅ System is operational${NC}"
elif [ $HEALTH_SCORE -ge 7 ]; then
    echo -e "${YELLOW}⚠️ System needs attention${NC}"
else
    echo -e "${RED}❌ System has critical issues${NC}"
fi

# Recommendations
echo ""
echo "Recommendations:"
[ $HEALTH_SCORE -lt $MAX_SCORE ] && {
    [ "$NO_SIMULATIONS" != "true" ] && echo "• CRITICAL: Set NO_SIMULATIONS=true in .env"
    [ ! -d "node_modules" ] && echo "• Run: npm install"
    [ $KEY_COUNT -eq 0 ] && echo "• Add API keys to .env file"
    [ $KEY_COUNT -lt 3 ] && echo "• Add more API keys for better rotation"
    [ $DISK_USAGE -gt 80 ] && echo "• Free up disk space"
    echo "• Consider setting up Docker for production deployment"
}

# Quick API test
echo ""
echo "API Provider Status:"
echo -n "• Claude: "
[ -n "$CLAUDE_API_KEY" ] && echo -e "${GREEN}Configured${NC}" || echo -e "${RED}Missing${NC}"
echo -n "• OpenAI: "
[ -n "$OPENAI_API_KEY" ] && echo -e "${GREEN}Configured${NC}" || echo -e "${RED}Missing${NC}"
echo -n "• DeepSeek: "
[ -n "$DEEPSEEK_API_KEY" ] && echo -e "${GREEN}Configured${NC}" || echo -e "${RED}Missing${NC}"
echo -n "• Local LLM: "
curl -s ${OLLAMA_HOST:-http://localhost:11434}/api/tags &> /dev/null && echo -e "${GREEN}Available${NC}" || echo -e "${YELLOW}Not available${NC}"