#!/bin/bash
# monitor-phase1-execution.sh - Monitor Phase 1 task execution in real-time

echo "🎯 Phase 1 Task Execution Monitor"
echo "================================="
echo ""

# Phase 1 task IDs to monitor
PHASE1_TASKS=(
    "REDIS_CLUSTER_PROD"
    "CIRCUIT_BREAKER_SYSTEM" 
    "ERROR_RECOVERY_PROD"
    "OBSERVABILITY_STACK"
    "PERFORMANCE_OPTIMIZATION"
)

# Function to get task status from TRITONS
get_task_status() {
    local search_term="$1"
    curl -s http://localhost:8080/api/tasks 2>/dev/null | \
        jq -r --arg search "$search_term" '.tasks[] | select(.description | contains($search)) | "\(.status)|\(.assignedDepartment)|\(.assignedAgents | length)|\(.id)"' 2>/dev/null | \
        head -1
}

# Function to display task progress
show_task_progress() {
    local task_name="$1"
    local search_term="$2"
    
    local status_info=$(get_task_status "$search_term")
    
    if [ ! -z "$status_info" ]; then
        IFS='|' read -r status department agents task_id <<< "$status_info"
        
        case $status in
            "assigned")
                echo "🔄 $task_name: IN PROGRESS ($department dept, $agents agents) [$task_id]"
                ;;
            "completed")
                echo "✅ $task_name: COMPLETED ($department dept) [$task_id]"
                ;;
            "failed")
                echo "❌ $task_name: FAILED ($department dept) [$task_id]"
                ;;
            *)
                echo "⏳ $task_name: $status ($department dept, $agents agents) [$task_id]"
                ;;
        esac
    else
        echo "❓ $task_name: Not found in system"
    fi
}

# Function to get system metrics
get_system_metrics() {
    local health_data=$(curl -s http://localhost:8080/health 2>/dev/null)
    
    if [ ! -z "$health_data" ]; then
        local total_agents=$(echo "$health_data" | jq -r '.agents // 0')
        local claude_agents=$(echo "$health_data" | jq -r '.llm_providers.claude.active_agents // 0')
        local gpt4_agents=$(echo "$health_data" | jq -r '.llm_providers.gpt4.active_agents // 0')
        local deepseek_agents=$(echo "$health_data" | jq -r '.llm_providers.deepseek.active_agents // 0')
        
        echo "🤖 Active Agents: $total_agents total (Claude: $claude_agents, GPT-4: $gpt4_agents, DeepSeek: $deepseek_agents)"
    else
        echo "⚠️  System metrics unavailable"
    fi
}

# Function to monitor task execution
monitor_execution() {
    local completed_count=0
    local total_tasks=${#PHASE1_TASKS[@]}
    
    echo "📊 Monitoring ${total_tasks} Phase 1 foundation tasks..."
    echo ""
    
    while [ $completed_count -lt $total_tasks ]; do
        clear
        echo "🎯 Phase 1 Task Execution Monitor - $(date)"
        echo "================================================="
        echo ""
        
        get_system_metrics
        echo ""
        
        completed_count=0
        
        # Check each Phase 1 task
        show_task_progress "Redis Clustering" "3-node Redis cluster"
        [ "$(get_task_status "3-node Redis cluster" | cut -d'|' -f1)" = "completed" ] && ((completed_count++))
        
        show_task_progress "Circuit Breakers" "circuit breaker pattern"
        [ "$(get_task_status "circuit breaker pattern" | cut -d'|' -f1)" = "completed" ] && ((completed_count++))
        
        show_task_progress "Error Recovery" "error recovery with dead letter"
        [ "$(get_task_status "error recovery with dead letter" | cut -d'|' -f1)" = "completed" ] && ((completed_count++))
        
        show_task_progress "Observability" "OpenTelemetry, Jaeger"
        [ "$(get_task_status "OpenTelemetry, Jaeger" | cut -d'|' -f1)" = "completed" ] && ((completed_count++))
        
        show_task_progress "Performance Opt" "spawn time to <50ms"
        [ "$(get_task_status "spawn time to <50ms" | cut -d'|' -f1)" = "completed" ] && ((completed_count++))
        
        echo ""
        local progress=$((completed_count * 100 / total_tasks))
        echo "📈 Phase 1 Progress: $progress% ($completed_count/$total_tasks tasks completed)"
        
        if [ $completed_count -lt $total_tasks ]; then
            echo ""
            echo "🔄 Refreshing in 10 seconds... (Press Ctrl+C to stop)"
            sleep 10
        fi
    done
    
    echo ""
    echo "🎉 All Phase 1 Foundation Tasks Completed!"
    echo "✅ System ready for Phase 2: Enterprise Features"
}

# Function to show detailed task info
show_task_details() {
    echo "📋 Phase 1 Task Details"
    echo "======================="
    echo ""
    
    echo "1. 🗄️  Redis Clustering (CRITICAL - 24h)"
    echo "   Deploy 3-node Redis cluster with Sentinel"
    echo "   Configure automatic failover with 30s timeout"
    echo ""
    
    echo "2. 🔧 Circuit Breakers (CRITICAL - 20h)"
    echo "   Implement circuit breaker pattern for 15+ LLM providers"
    echo "   Configure failure thresholds and recovery timeouts"
    echo ""
    
    echo "3. 🚨 Error Recovery (HIGH - 32h)"
    echo "   Exponential backoff retry logic and dead letter queues"
    echo "   Automatic error classification and recovery workflows"
    echo ""
    
    echo "4. 📊 Observability (HIGH - 16h)"
    echo "   OpenTelemetry collector with Jaeger tracing"
    echo "   Prometheus metrics and Grafana dashboards"
    echo ""
    
    echo "5. ⚡ Performance Optimization (HIGH - 20h)"
    echo "   Agent spawn time <50ms with connection pooling"
    echo "   Predictive scaling and benchmarking suite"
    echo ""
    
    echo "Total estimated time: 112 hours"
    echo "Expected completion: 14 business days (with parallel execution)"
}

# Function to submit remaining tasks
submit_security_ha_tasks() {
    echo "🔐 Submitting Security and High Availability Tasks..."
    echo ""
    
    # Security hardening task
    curl -X POST http://localhost:8080/api/tasks/submit \
        -H "Content-Type: application/json" \
        -d '{
            "id": "SECURITY_HARDENING",
            "title": "Production Security Hardening",
            "description": "Implement API rate limiting, authentication, and security monitoring",
            "type": "security",
            "department": "SECURITY",
            "priority": "high",
            "requirements": [
                "Implement API rate limiting",
                "Add request authentication and authorization", 
                "Set up API key rotation system",
                "Configure network security policies"
            ],
            "estimated_hours": 18
        }' >/dev/null 2>&1
    
    echo "✅ Security hardening task submitted"
    
    # High availability task
    curl -X POST http://localhost:8080/api/tasks/submit \
        -H "Content-Type: application/json" \
        -d '{
            "id": "HIGH_AVAILABILITY",
            "title": "High Availability Infrastructure", 
            "description": "Set up load balancer, service mesh, and multi-region deployment",
            "type": "infrastructure",
            "department": "INFRA",
            "priority": "high",
            "requirements": [
                "Set up load balancer with health checks",
                "Implement service mesh for inter-service communication",
                "Configure automated failover procedures",
                "Set up multi-region deployment capability"
            ],
            "estimated_hours": 28
        }' >/dev/null 2>&1
    
    echo "✅ High availability task submitted"
    echo ""
}

# Command handling
case "${1:-monitor}" in
    monitor)
        monitor_execution
        ;;
    details)
        show_task_details
        ;;
    submit-more)
        submit_security_ha_tasks
        ;;
    status)
        echo "📊 Current Phase 1 Task Status"
        echo "=============================="
        echo ""
        show_task_progress "Redis Clustering" "3-node Redis cluster"
        show_task_progress "Circuit Breakers" "circuit breaker pattern" 
        show_task_progress "Error Recovery" "error recovery with dead letter"
        show_task_progress "Observability" "OpenTelemetry, Jaeger"
        show_task_progress "Performance Opt" "spawn time to <50ms"
        echo ""
        get_system_metrics
        ;;
    *)
        echo "Usage: $0 {monitor|details|status|submit-more}"
        echo ""
        echo "Commands:"
        echo "  monitor     - Real-time monitoring of Phase 1 execution"
        echo "  details     - Show detailed task descriptions"
        echo "  status      - Show current status snapshot"
        echo "  submit-more - Submit additional security and HA tasks"
        ;;
esac