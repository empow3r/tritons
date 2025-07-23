#!/bin/bash
# deploy-tasks.sh - Deploy roadmap tasks to TRITONS agents

echo "🚀 TRITONS Task Deployment System"
echo "================================="
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check if TRITONS is running
    if ! lsof -i :8080 > /dev/null 2>&1; then
        echo "❌ TRITONS not running on port 8080"
        echo "   Please start TRITONS first: ./start-tritons.sh"
        return 1
    fi
    
    # Check Redis
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "❌ Redis not available"
        echo "   Please ensure Redis is running"
        return 1
    fi
    
    echo "✅ All prerequisites met"
    return 0
}

# Function to deploy phase 1 tasks
deploy_phase1() {
    echo ""
    echo "📋 Deploying Phase 1 Tasks (Foundation Stabilization)"
    echo "===================================================="
    
    # Start task deployment agent
    NO_SIMULATIONS=true node task-deploy-agent.js &
    DEPLOY_PID=$!
    
    echo "✅ Task deployment agent started (PID: $DEPLOY_PID)"
    
    # Give it time to load tasks
    sleep 5
    
    # Show deployment status
    echo ""
    echo "📊 Current Deployment Status:"
    redis-cli zcard tritons:tasks:queue | xargs -I {} echo "   Tasks in queue: {}"
    
    # Monitor for a bit
    echo ""
    echo "📺 Monitoring deployment (press Ctrl+C to stop)..."
    
    # Keep monitoring
    while true; do
        sleep 10
        echo -n "."
    done
}

# Function to submit individual task
submit_task() {
    local task_json="$1"
    
    echo "📤 Submitting task..."
    
    curl -X POST http://localhost:8080/api/tasks/submit \
        -H "Content-Type: application/json" \
        -d "$task_json" \
        -s -o /tmp/task_response.json
    
    if [ $? -eq 0 ]; then
        echo "✅ Task submitted successfully"
        cat /tmp/task_response.json | jq '.' 2>/dev/null || cat /tmp/task_response.json
    else
        echo "❌ Failed to submit task"
    fi
}

# Function to get task status
get_task_status() {
    local task_id="$1"
    
    echo "🔍 Getting status for task: $task_id"
    
    # Check Redis for status
    redis-cli hgetall "tritons:tasks:status:$task_id" | while read -r key; do
        read -r value
        echo "   $key: $value"
    done
}

# Function to list all tasks
list_tasks() {
    echo ""
    echo "📋 All Tasks in System"
    echo "====================="
    
    # Get all task status keys
    redis-cli keys "tritons:tasks:status:*" | while read -r key; do
        local task_id=$(echo "$key" | sed 's/tritons:tasks:status://')
        local status=$(redis-cli hget "$key" "status")
        local title=$(redis-cli hget "$key" "title")
        
        echo ""
        echo "Task: $task_id"
        echo "  Status: $status"
        [ ! -z "$title" ] && echo "  Title: $title"
    done
    
    # Show queue
    echo ""
    echo "📦 Task Queue:"
    local queue_size=$(redis-cli zcard tritons:tasks:queue)
    echo "  Items in queue: $queue_size"
}

# Function to deploy custom task
deploy_custom() {
    echo ""
    echo "📝 Deploy Custom Task"
    echo "===================="
    
    read -p "Task title: " title
    read -p "Department (INFRA/ARCHITECTURE/AI_ML/QUALITY/SECURITY): " dept
    read -p "Priority (critical/high/medium/low): " priority
    read -p "Estimated hours: " hours
    read -p "Requirements (comma-separated): " requirements
    
    # Convert requirements to JSON array
    IFS=',' read -ra req_array <<< "$requirements"
    req_json=$(printf '"%s",' "${req_array[@]}" | sed 's/,$//')
    
    # Create task JSON
    task_json=$(cat <<EOF
{
    "id": "CUSTOM_$(date +%s)",
    "title": "$title",
    "type": "development",
    "department": "$dept",
    "priority": "$priority",
    "estimatedHours": $hours,
    "requirements": [$req_json]
}
EOF
)
    
    echo ""
    echo "Task JSON:"
    echo "$task_json" | jq '.'
    
    echo ""
    read -p "Deploy this task? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        submit_task "$task_json"
    fi
}

# Main menu
main_menu() {
    while true; do
        echo ""
        echo "🎯 TRITONS Task Deployment"
        echo "========================="
        echo "1. Deploy Phase 1 roadmap tasks"
        echo "2. Deploy custom task"
        echo "3. List all tasks"
        echo "4. Get task status"
        echo "5. Show deployment statistics"
        echo "6. Exit"
        echo ""
        read -p "Select option (1-6): " choice
        
        case $choice in
            1)
                check_prerequisites && deploy_phase1
                ;;
            2)
                deploy_custom
                ;;
            3)
                list_tasks
                ;;
            4)
                read -p "Enter task ID: " task_id
                get_task_status "$task_id"
                ;;
            5)
                node -e "
                    const deployer = require('./task-deploy-agent.js');
                    const agent = new deployer();
                    agent.init().then(() => {
                        agent.getDeploymentStatus().then(() => {
                            process.exit(0);
                        });
                    });
                "
                ;;
            6)
                echo "👋 Goodbye!"
                exit 0
                ;;
            *)
                echo "❌ Invalid option"
                ;;
        esac
    done
}

# Handle command line arguments
case "${1:-menu}" in
    phase1)
        check_prerequisites && deploy_phase1
        ;;
    custom)
        deploy_custom
        ;;
    list)
        list_tasks
        ;;
    status)
        get_task_status "$2"
        ;;
    menu|*)
        main_menu
        ;;
esac