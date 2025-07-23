#!/bin/bash
# task.sh - Easy TRITONS task submission

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# TRITONS API endpoint
API_URL="http://localhost:8080/api/tasks/submit"

# Function to submit task
submit_task() {
    local department="$1"
    local prompt="$2"
    
    echo -e "${BLUE}🚀 Submitting task to ${department} department...${NC}"
    
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"type\":\"$department\",\"prompt\":\"$prompt\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        task_id=$(echo "$response" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Task submitted successfully!${NC}"
        echo -e "${YELLOW}Task ID: $task_id${NC}"
        echo -e "${BLUE}📊 Monitor progress: http://localhost:8080${NC}"
    else
        echo -e "${RED}❌ Task submission failed${NC}"
        echo "$response"
    fi
}

# Function to show usage
show_usage() {
    echo -e "${BLUE}🤖 TRITONS Task Submission Tool${NC}"
    echo ""
    echo "Usage:"
    echo "  ./task.sh \"Your task description here\""
    echo "  ./task.sh DEPARTMENT \"Your task description\""
    echo ""
    echo "Departments:"
    echo "  AI_ML       - Machine learning, AI implementations"
    echo "  INFRA       - Infrastructure, deployment, DevOps"
    echo "  ARCHITECTURE - System design, architecture"
    echo "  QUALITY     - Testing, QA, code review"
    echo "  SECURITY    - Security audits, compliance"
    echo ""
    echo "Examples:"
    echo "  ./task.sh \"Write a Python script to analyze logs\""
    echo "  ./task.sh AI_ML \"Create a sentiment analysis model\""
    echo "  ./task.sh SECURITY \"Audit the authentication system\""
    echo ""
    echo "Quick commands:"
    echo "  ./task.sh --status    - Check system status"
    echo "  ./task.sh --dashboard - Open dashboard"
}

# Function to check system status
check_status() {
    echo -e "${BLUE}🔍 Checking TRITONS system status...${NC}"
    
    # Check main system
    if curl -s http://localhost:8080 > /dev/null; then
        echo -e "${GREEN}✅ Main TRITONS system: Running${NC}"
        
        # Get agent count
        agent_count=$(curl -s http://localhost:8080 | grep -o 'Active Agents: [0-9]*' | grep -o '[0-9]*' || echo "Unknown")
        echo -e "${YELLOW}   Active Agents: $agent_count${NC}"
    else
        echo -e "${RED}❌ Main TRITONS system: Not responding${NC}"
        return 1
    fi
    
    # Check recent tasks
    echo -e "${BLUE}📋 Recent task status available at: http://localhost:8080${NC}"
}

# Function to open dashboard
open_dashboard() {
    echo -e "${BLUE}📊 Opening TRITONS dashboard...${NC}"
    if command -v open > /dev/null; then
        open http://localhost:8080
    elif command -v xdg-open > /dev/null; then
        xdg-open http://localhost:8080
    else
        echo -e "${YELLOW}Visit: http://localhost:8080${NC}"
    fi
}

# Main script logic
case "$1" in
    --help|-h)
        show_usage
        ;;
    --status|-s)
        check_status
        ;;
    --dashboard|-d)
        open_dashboard
        ;;
    "")
        show_usage
        ;;
    *)
        # Check if first argument is a department
        if [[ "$1" =~ ^(AI_ML|INFRA|ARCHITECTURE|QUALITY|SECURITY)$ ]]; then
            if [ -z "$2" ]; then
                echo -e "${RED}❌ Please provide a task description${NC}"
                echo "Usage: ./task.sh $1 \"Your task description\""
                exit 1
            fi
            submit_task "$1" "$2"
        else
            # Treat first argument as task description, auto-detect department
            department="AI_ML"  # Default department
            
            # Simple keyword-based department detection
            if [[ "$1" =~ (deploy|infrastructure|docker|server|devops) ]]; then
                department="INFRA"
            elif [[ "$1" =~ (test|quality|qa|bug|debug) ]]; then
                department="QUALITY"
            elif [[ "$1" =~ (security|audit|vulnerability|auth) ]]; then
                department="SECURITY"
            elif [[ "$1" =~ (design|architecture|system|structure) ]]; then
                department="ARCHITECTURE"
            fi
            
            echo -e "${YELLOW}📝 Auto-detected department: $department${NC}"
            submit_task "$department" "$1"
        fi
        ;;
esac