#!/bin/bash
# Launch the Task Workflow Visualizer

echo "🔄 Starting TRITONS Task Workflow Visualizer..."

# Check if TRITONS system is running
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "❌ TRITONS system not running on port 8080"
    echo "Start it with: node multi-llm-hierarchical-system.js"
    exit 1
fi

# Check if workflow server is already running
if curl -s http://localhost:8085/health > /dev/null; then
    echo "✅ Workflow Visualizer already running at http://localhost:8085"
else
    echo "🚀 Starting workflow server..."
    # Start the workflow server
    node workflow-server.js &
    WORKFLOW_PID=$!
    
    # Wait for server to start
    sleep 2
    
    # Verify it started
    if curl -s http://localhost:8085/health > /dev/null; then
        echo "✅ Workflow Visualizer started successfully!"
    else
        echo "❌ Failed to start workflow visualizer"
        exit 1
    fi
fi

echo "✅ Workflow Visualizer started!"
echo ""
echo "🔄 Workflow Visualizer: http://localhost:8085"
echo "📊 Main Dashboard: http://localhost:8080"
echo ""

# Open in browser if available
if command -v open > /dev/null; then
    sleep 1
    open http://localhost:8085
elif command -v xdg-open > /dev/null; then
    sleep 1
    xdg-open http://localhost:8085
fi

echo "🎯 Features:"
echo "  • Submit tasks and watch real-time processing"
echo "  • See each step: Submit → Route → Assign → Process → Complete"
echo "  • Live task status with progress indicators"
echo "  • Visual timeline of task workflow"
echo ""
echo "Press Ctrl+C to stop the workflow visualizer"

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $WORKFLOW_PID 2>/dev/null
    rm -f temp-workflow-server.js
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for interrupt
wait