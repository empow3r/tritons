#!/bin/bash
# quick-recover.sh - Fast recovery script for TRITONS agents

echo "🔄 TRITONS Quick Recovery"
echo "========================"

# Check if Redis is available
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis not available - starting it first"
    if command -v brew > /dev/null; then
        brew services start redis
        sleep 2
    fi
fi

# Function to check last state
check_last_state() {
    echo ""
    echo "📊 Checking last state..."
    
    # Check Redis for session state
    local state=$(redis-cli get tritons:session:state 2>/dev/null)
    if [ ! -z "$state" ]; then
        echo "✅ Found Redis session state"
        echo "$state" | jq '.timestamp, .activeAgents, .activeTasks' 2>/dev/null || echo "$state"
    else
        echo "❌ No Redis state found"
    fi
    
    # Check file-based state
    local latest_state="$HOME/.tritons/agent-states/latest.json"
    if [ -f "$latest_state" ]; then
        echo ""
        echo "📁 Found file-based state:"
        jq '.timestamp, .systemHealth' "$latest_state" 2>/dev/null || head -5 "$latest_state"
    fi
}

# Function to perform quick recovery
quick_recover() {
    echo ""
    echo "🚀 Starting Quick Recovery..."
    
    # Set environment
    export NO_SIMULATIONS=true
    
    # Check current processes
    if lsof -i :8080 > /dev/null 2>&1; then
        echo "⚠️  TRITONS already running on port 8080"
        echo "Use './manage-services.sh status' to check"
        return 1
    fi
    
    # Try Redis recovery first
    echo "📡 Attempting Redis recovery..."
    node -e "
        const recovery = require('./redis-recovery-integration.js');
        recovery.init().then(async () => {
            const state = await recovery.recover();
            if (state) {
                console.log('✅ Redis recovery successful');
                process.exit(0);
            } else {
                console.log('⚠️  No Redis state to recover');
                process.exit(1);
            }
        });
    " 2>/dev/null
    
    local redis_result=$?
    
    # Start TRITONS with recovery flag
    echo ""
    echo "🏁 Starting TRITONS with recovery mode..."
    
    if [ "$1" == "docker" ]; then
        # Docker recovery
        export TRITONS_RECOVERY=true
        ./start-tritons.sh docker
    else
        # Local recovery
        export TRITONS_RECOVERY=true
        ./start-tritons.sh
    fi
}

# Function to save current state
save_state() {
    echo ""
    echo "💾 Saving current state..."
    
    # Create restore point
    ./restore-point.sh create recovery "Quick save before shutdown"
    
    # Force Redis checkpoint
    node -e "
        const recovery = require('./redis-recovery-integration.js');
        recovery.init().then(async () => {
            await recovery.checkpoint({
                activeAgents: [],
                activeTasks: [],
                lastActivity: Date.now()
            });
            console.log('✅ Redis checkpoint saved');
            process.exit(0);
        });
    " 2>/dev/null
}

# Main menu
case "${1:-menu}" in
    check)
        check_last_state
        ;;
    recover)
        check_last_state
        quick_recover "$2"
        ;;
    save)
        save_state
        ;;
    auto)
        # Automatic recovery - no prompts
        export TRITONS_AUTO_RECOVER=true
        quick_recover "$2"
        ;;
    *)
        echo ""
        echo "Usage: $0 {check|recover|save|auto} [docker]"
        echo ""
        echo "Commands:"
        echo "  check    - Check last saved state"
        echo "  recover  - Recover from last state"
        echo "  save     - Save current state"
        echo "  auto     - Auto-recover without prompts"
        echo ""
        echo "Options:"
        echo "  docker   - Use Docker mode"
        echo ""
        echo "Examples:"
        echo "  $0 check"
        echo "  $0 recover"
        echo "  $0 recover docker"
        echo "  $0 auto docker"
        ;;
esac