#!/bin/bash
# monitor-system.sh - Monitor TRITONS integrated system performance

echo "📊 TRITONS System Monitor"
echo "========================"
echo ""

# Function to check service health
check_service() {
    local service_name="$1"
    local port="$2"
    local url="$3"
    
    if curl -s --connect-timeout 3 "$url" > /dev/null 2>&1; then
        echo "✅ $service_name (Port $port): Running"
        return 0
    else
        echo "❌ $service_name (Port $port): Not responding"
        return 1
    fi
}

# Function to get system metrics
get_system_metrics() {
    echo "📈 System Metrics"
    echo "=================="
    
    # Check all services
    local healthy_services=0
    local total_services=5
    
    echo ""
    echo "🔍 Service Health:"
    
    if check_service "Main TRITONS" "8080" "http://localhost:8080/health"; then
        ((healthy_services++))
        
        # Get agent status
        local agent_data=$(curl -s http://localhost:8080/health 2>/dev/null)
        if [ ! -z "$agent_data" ]; then
            echo "   Agents: $(echo "$agent_data" | jq -r '.agents // "N/A"')"
            echo "   Phase: $(echo "$agent_data" | jq -r '.phase // "N/A"')"
        fi
    fi
    
    if check_service "Smart Key Server" "8082" "http://localhost:8082/api/keys"; then
        ((healthy_services++))
        
        # Get key count
        local key_data=$(curl -s http://localhost:8082/api/keys 2>/dev/null)
        if [ ! -z "$key_data" ]; then
            echo "   API Keys: $(echo "$key_data" | jq -r '.total // "N/A"')"
            echo "   Providers: $(echo "$key_data" | jq -r '.providers | length // "N/A"')"
        fi
    fi
    
    if check_service "Performance Metrics" "8083" "http://localhost:8083/metrics"; then
        ((healthy_services++))
    fi
    
    if check_service "Task Integration" "8084" "http://localhost:8084/api/dashboard/enhanced"; then
        ((healthy_services++))
    fi
    
    # Check Redis
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis: Running"
        ((healthy_services++))
        
        # Get Redis stats
        local redis_info=$(redis-cli info memory 2>/dev/null | grep used_memory_human)
        if [ ! -z "$redis_info" ]; then
            echo "   Memory: $(echo "$redis_info" | cut -d: -f2)"
        fi
    else
        echo "❌ Redis: Not responding"
    fi
    
    echo ""
    echo "🎯 Overall Health: $healthy_services/$total_services services running"
    
    local health_percentage=$((healthy_services * 100 / total_services))
    if [ $health_percentage -ge 80 ]; then
        echo "🟢 System Status: Healthy ($health_percentage%)"
    elif [ $health_percentage -ge 60 ]; then
        echo "🟡 System Status: Degraded ($health_percentage%)"
    else
        echo "🔴 System Status: Critical ($health_percentage%)"
    fi
}

# Function to get task metrics
get_task_metrics() {
    echo ""
    echo "📋 Task Deployment Metrics"
    echo "=========================="
    
    # Get task queue size
    local queue_size=$(redis-cli zcard tritons:tasks:queue 2>/dev/null || echo "0")
    echo "📦 Tasks in queue: $queue_size"
    
    # Get task status counts
    local task_keys=$(redis-cli keys 'tritons:tasks:status:*' 2>/dev/null)
    if [ ! -z "$task_keys" ]; then
        local total_tasks=$(echo "$task_keys" | wc -l)
        echo "📊 Total tasks tracked: $total_tasks"
        
        # Count by status
        local completed=0
        local in_progress=0
        local queued=0
        local failed=0
        
        for key in $task_keys; do
            local status=$(redis-cli hget "$key" status 2>/dev/null)
            case "$status" in
                "completed") ((completed++));;
                "in_progress") ((in_progress++));;
                "queued") ((queued++));;
                "failed") ((failed++));;
            esac
        done
        
        echo "   ✅ Completed: $completed"
        echo "   🔄 In Progress: $in_progress"
        echo "   ⏳ Queued: $queued"
        echo "   ❌ Failed: $failed"
        
        if [ $total_tasks -gt 0 ]; then
            local success_rate=$((completed * 100 / total_tasks))
            echo "   📈 Success Rate: $success_rate%"
        fi
    else
        echo "📊 No tasks found in system"
    fi
}

# Function to get performance metrics
get_performance_metrics() {
    echo ""
    echo "⚡ Performance Metrics"
    echo "====================="
    
    # Try to get metrics from the performance service
    local metrics_data=$(curl -s http://localhost:8083/metrics 2>/dev/null)
    if [ ! -z "$metrics_data" ]; then
        echo "📊 Performance data available"
        
        # Extract key metrics using jq if available
        if command -v jq > /dev/null; then
            local uptime=$(echo "$metrics_data" | jq -r '.system.uptime // "N/A"')
            local total_tasks=$(echo "$metrics_data" | jq -r '.system.totalTasks // "N/A"')
            local success_rate=$(echo "$metrics_data" | jq -r '.system.successRate // "N/A"')
            local cost=$(echo "$metrics_data" | jq -r '.system.totalCost // "N/A"')
            
            echo "   ⏰ Uptime: ${uptime}s"
            echo "   📋 Total Tasks: $total_tasks"
            echo "   📈 Success Rate: $success_rate%"
            echo "   💰 Total Cost: \$$cost"
        fi
    else
        echo "⚠️  Performance metrics service not responding"
    fi
    
    # System resource usage
    echo ""
    echo "💻 System Resources:"
    
    # CPU and Memory (macOS specific)
    local cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
    if [ ! -z "$cpu_usage" ]; then
        echo "   🔥 CPU Usage: $cpu_usage%"
    fi
    
    # Memory usage
    local memory_pressure=$(memory_pressure 2>/dev/null | grep "System-wide memory free percentage" | awk '{print $5}' | sed 's/%//')
    if [ ! -z "$memory_pressure" ]; then
        local memory_used=$((100 - memory_pressure))
        echo "   🧠 Memory Usage: $memory_used%"
    fi
    
    # Disk usage for logs
    if [ -d "logs" ]; then
        local log_size=$(du -sh logs 2>/dev/null | awk '{print $1}')
        echo "   📝 Log Size: $log_size"
    fi
}

# Function to show recent logs
show_recent_logs() {
    echo ""
    echo "📝 Recent System Logs"
    echo "===================="
    
    if [ -d "logs" ]; then
        echo ""
        echo "🔧 Main System (last 5 lines):"
        if [ -f "logs/tritons-main.log" ]; then
            tail -5 logs/tritons-main.log 2>/dev/null || echo "   No logs available"
        else
            echo "   Log file not found"
        fi
        
        echo ""
        echo "📊 Performance Metrics (last 3 lines):"
        if [ -f "logs/performance-metrics.log" ]; then
            tail -3 logs/performance-metrics.log 2>/dev/null || echo "   No logs available"
        else
            echo "   Log file not found"
        fi
        
        echo ""
        echo "🔗 Integration Service (last 3 lines):"
        if [ -f "logs/task-integration.log" ]; then
            tail -3 logs/task-integration.log 2>/dev/null || echo "   No logs available"
        else
            echo "   Log file not found"
        fi
    else
        echo "📁 Logs directory not found"
    fi
}

# Main monitoring loop
monitor_continuous() {
    echo "🔄 Starting continuous monitoring (Press Ctrl+C to stop)"
    echo "Refresh interval: 10 seconds"
    echo ""
    
    while true; do
        clear
        echo "📊 TRITONS System Monitor - $(date)"
        echo "================================================="
        
        get_system_metrics
        get_task_metrics
        get_performance_metrics
        
        echo ""
        echo "🔄 Next update in 10 seconds... (Press Ctrl+C to stop)"
        sleep 10
    done
}

# Command handling
case "${1:-status}" in
    status)
        get_system_metrics
        get_task_metrics
        get_performance_metrics
        ;;
    logs)
        show_recent_logs
        ;;
    watch)
        monitor_continuous
        ;;
    health)
        get_system_metrics
        ;;
    tasks)
        get_task_metrics
        ;;
    performance)
        get_performance_metrics
        ;;
    *)
        echo "Usage: $0 {status|logs|watch|health|tasks|performance}"
        echo ""
        echo "Commands:"
        echo "  status      - Show complete system status (default)"
        echo "  logs        - Show recent log entries"
        echo "  watch       - Continuous monitoring"
        echo "  health      - Service health check only"
        echo "  tasks       - Task metrics only"
        echo "  performance - Performance metrics only"
        ;;
esac