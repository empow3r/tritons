#!/bin/bash
# start-integrated-tritons.sh - Start TRITONS with integrated task deployment

echo "🚀 Starting TRITONS Integrated System"
echo "===================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check Redis
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "❌ Redis not running"
        echo "   Starting Redis..."
        if command -v brew > /dev/null; then
            brew services start redis
            sleep 2
        else
            echo "   Please start Redis manually"
            exit 1
        fi
    fi
    
    echo "✅ Prerequisites ready"
}

# Start services in order
start_services() {
    echo ""
    echo "🔧 Starting services..."
    
    # 1. Start smart key server
    echo "🔑 Starting Smart Key Server (port 8082)..."
    python3 smart-key-server.py > logs/smart-key-server.log 2>&1 &
    KEY_SERVER_PID=$!
    sleep 2
    
    # 2. Start main TRITONS system
    echo "🏢 Starting TRITONS Main System (port 8080)..."
    NO_SIMULATIONS=true node ../core/multi-llm-hierarchical-system.js > logs/tritons-main.log 2>&1 &
    MAIN_PID=$!
    sleep 3
    
    # 3. Start performance metrics collector
    echo "📊 Starting Performance Metrics (port 8083)..."
    node agent-performance-metrics.js > logs/performance-metrics.log 2>&1 &
    METRICS_PID=$!
    sleep 2
    
    # 4. Start task deployment integration
    echo "🔗 Starting Task Deployment Integration (port 8084)..."
    node task-deployment-integration.js > logs/task-integration.log 2>&1 &
    INTEGRATION_PID=$!
    sleep 2
    
    # 5. Start task deployment agent
    echo "📋 Starting Task Deployment Agent..."
    node task-deploy-agent.js > logs/task-deploy-agent.log 2>&1 &
    DEPLOY_PID=$!
    
    echo ""
    echo "✅ All services started!"
    echo ""
    echo "📡 Service URLs:"
    echo "   Main Dashboard: http://localhost:8080"
    echo "   Key Manager: http://localhost:8082"
    echo "   Metrics API: http://localhost:8083/metrics"
    echo "   Task API: http://localhost:8084/api/dashboard/enhanced"
    echo ""
    echo "🖥️  Open Enhanced Dashboard:"
    echo "   file://$PWD/enhanced-swarm-dashboard.html"
    echo ""
    echo "📝 Logs available in ./logs/"
    echo ""
    echo "🛑 To stop all services: Press Ctrl+C"
    
    # Save PIDs for cleanup
    echo "$KEY_SERVER_PID" > .tritons.pids
    echo "$MAIN_PID" >> .tritons.pids
    echo "$METRICS_PID" >> .tritons.pids
    echo "$INTEGRATION_PID" >> .tritons.pids
    echo "$DEPLOY_PID" >> .tritons.pids
}

# Open dashboard in browser
open_dashboard() {
    echo ""
    read -p "📱 Open dashboard in browser? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v open > /dev/null; then
            open "file://$PWD/enhanced-swarm-dashboard.html"
        elif command -v xdg-open > /dev/null; then
            xdg-open "file://$PWD/enhanced-swarm-dashboard.html"
        fi
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    
    if [ -f .tritons.pids ]; then
        while read pid; do
            kill $pid 2>/dev/null
        done < .tritons.pids
        rm .tritons.pids
    fi
    
    # Also kill any orphaned processes
    pkill -f "smart-key-server.py" 2>/dev/null
    pkill -f "../core/multi-llm-hierarchical-system.js" 2>/dev/null
    pkill -f "agent-performance-metrics.js" 2>/dev/null
    pkill -f "task-deployment-integration.js" 2>/dev/null
    pkill -f "task-deploy-agent.js" 2>/dev/null
    
    echo "✅ All services stopped"
}

# Main execution
main() {
    # Create logs directory
    mkdir -p logs
    
    # Set up trap for cleanup
    trap cleanup EXIT INT TERM
    
    # Check and start
    check_prerequisites
    start_services
    open_dashboard
    
    # Keep script running
    echo ""
    echo "💡 System is running. Press Ctrl+C to stop."
    
    # Monitor processes
    while true; do
        sleep 5
        
        # Check if key processes are still running
        if ! kill -0 $MAIN_PID 2>/dev/null; then
            echo "⚠️  Main system stopped unexpectedly!"
            break
        fi
    done
}

# Run main function
main