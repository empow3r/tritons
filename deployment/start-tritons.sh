#!/bin/bash
# start-tritons.sh - Start Tritons AI Swarm with NO SIMULATIONS

echo "🚀 Starting TRITONS AI Swarm - Real APIs Only"
echo "============================================"

# Set NO_SIMULATIONS environment variable
export NO_SIMULATIONS=true

# Check for conflicts first
echo ""
echo "🔍 Checking for conflicts..."
./manage-services.sh status

# Check if running in Docker or locally
if [ "$1" == "docker" ]; then
    echo ""
    echo "📦 Starting with Docker..."
    echo "ℹ️  Docker Redis will use port 6380 to avoid conflicts"
    docker-compose -f docker-compose.simple.yml up -d
    echo ""
    echo "✅ Docker containers started!"
    echo "📊 View logs: docker-compose -f docker-compose.simple.yml logs -f"
    echo "🛑 Stop: docker-compose -f docker-compose.simple.yml down"
else
    echo ""
    echo "💻 Starting locally..."
    echo "ℹ️  Using existing Redis on port 6379 if available"
    
    # Start key manager in background
    echo "🔑 Starting key manager..."
    python3 smart-key-server.py &
    KEY_PID=$!
    
    # Give key manager time to start
    sleep 2
    
    # Start main system
    echo "🏢 Starting main system..."
    NO_SIMULATIONS=true node ../core/multi-llm-hierarchical-system.js &
    MAIN_PID=$!
    
    echo ""
    echo "✅ System started!"
    echo "🌐 Dashboard: http://localhost:8080"
    echo "🔑 Key Manager: http://localhost:8082"
    echo ""
    echo "📊 Test APIs: node api-test.js"
    echo "🛑 Stop: Press Ctrl+C"
    
    # Wait for processes
    wait $KEY_PID $MAIN_PID
fi