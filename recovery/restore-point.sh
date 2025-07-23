#!/bin/bash
# restore-point.sh - Create and manage TRITONS restore points

RESTORE_DIR="$HOME/.tritons/restore-points"
CURRENT_DIR=$(pwd)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Ensure restore directory exists
mkdir -p "$RESTORE_DIR"

# Define what to include in restore points
CRITICAL_FILES=(
    "multi-llm-hierarchical-system.js"
    "smart-key-server.py"
    "package.json"
    "package-lock.json"
    ".env"
    "CLAUDE.md"
    "docker-compose.simple.yml"
    "Dockerfile"
    "start-tritons.sh"
    "manage-services.sh"
    "api-key-tester.js"
    "api-test.js"
)

CRITICAL_DIRS=(
    "agents"
    "config"
    "tools"
    "lib"
    "components"
)

# Function to create restore point
create_restore_point() {
    local name="${1:-auto}"
    local restore_name="${name}_${TIMESTAMP}"
    local restore_path="$RESTORE_DIR/$restore_name"
    
    echo "🔄 Creating Restore Point: $restore_name"
    echo "================================================"
    
    # Create restore point directory
    mkdir -p "$restore_path"
    
    # Save metadata
    cat > "$restore_path/metadata.json" << EOF
{
    "name": "$restore_name",
    "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "node_version": "$(node --version 2>/dev/null || echo 'N/A')",
    "python_version": "$(python3 --version 2>/dev/null || echo 'N/A')",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'N/A')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'N/A')",
    "description": "$2"
}
EOF
    
    # Copy critical files
    echo "📁 Backing up critical files..."
    for file in "${CRITICAL_FILES[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$restore_path/" 2>/dev/null && echo "  ✅ $file"
        fi
    done
    
    # Copy critical directories
    echo "📂 Backing up directories..."
    for dir in "${CRITICAL_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            cp -r "$dir" "$restore_path/" 2>/dev/null && echo "  ✅ $dir"
        fi
    done
    
    # Save current process state if running
    echo "📊 Saving process state..."
    if lsof -i :8080 >/dev/null 2>&1; then
        ps aux | grep -E "node|python" | grep -v grep > "$restore_path/process_state.txt"
        echo "  ✅ Process state saved"
    fi
    
    # Save Docker state if applicable
    if docker ps --format "{{.Names}}" | grep -q tritons; then
        echo "🐳 Saving Docker state..."
        docker ps -a --format "json" > "$restore_path/docker_state.json"
        docker-compose -f docker-compose.simple.yml config > "$restore_path/docker-compose.backup.yml" 2>/dev/null
        echo "  ✅ Docker state saved"
    fi
    
    # Save Redis data if available
    if command -v redis-cli >/dev/null 2>&1; then
        echo "💾 Backing up Redis data..."
        redis-cli --rdb "$restore_path/redis_backup.rdb" >/dev/null 2>&1 && echo "  ✅ Redis data saved"
    fi
    
    # Create restore script
    create_restore_script "$restore_path"
    
    echo ""
    echo "✅ Restore point created: $restore_name"
    echo "📍 Location: $restore_path"
    echo ""
    
    # Keep only last 10 restore points
    cleanup_old_restore_points
}

# Function to create restore script
create_restore_script() {
    local restore_path="$1"
    
    cat > "$restore_path/restore.sh" << 'RESTORE_SCRIPT'
#!/bin/bash
# Auto-generated restore script

echo "🔄 Restoring from $(basename $(dirname $0))"
echo "=================================="

# Stop current services
echo "🛑 Stopping current services..."
../../../manage-services.sh stop-conflicts 2>/dev/null
docker-compose down 2>/dev/null

# Restore files
echo "📁 Restoring files..."
for file in *.js *.py *.json *.yml *.sh *.md; do
    if [ -f "$file" ] && [ "$file" != "restore.sh" ]; then
        cp -f "$file" ../../../ && echo "  ✅ Restored $file"
    fi
done

# Restore directories
echo "📂 Restoring directories..."
for dir in agents config tools lib components; do
    if [ -d "$dir" ]; then
        rm -rf "../../../$dir" 2>/dev/null
        cp -r "$dir" ../../../ && echo "  ✅ Restored $dir"
    fi
done

# Make scripts executable
chmod +x ../../../*.sh

echo ""
echo "✅ Restore complete!"
echo ""
echo "Next steps:"
echo "  1. Review restored files"
echo "  2. Run: ./start-tritons.sh"
RESTORE_SCRIPT

    chmod +x "$restore_path/restore.sh"
}

# Function to list restore points
list_restore_points() {
    echo "📋 Available Restore Points"
    echo "=========================="
    
    if [ -d "$RESTORE_DIR" ]; then
        for point in "$RESTORE_DIR"/*; do
            if [ -d "$point" ]; then
                local name=$(basename "$point")
                local metadata="$point/metadata.json"
                if [ -f "$metadata" ]; then
                    local created=$(grep '"created"' "$metadata" | cut -d'"' -f4)
                    local desc=$(grep '"description"' "$metadata" | cut -d'"' -f4)
                    echo ""
                    echo "📍 $name"
                    echo "   Created: $created"
                    [ ! -z "$desc" ] && [ "$desc" != "null" ] && echo "   Description: $desc"
                fi
            fi
        done
    else
        echo "No restore points found."
    fi
    echo ""
}

# Function to restore from a point
restore_from_point() {
    local point_name="$1"
    
    if [ -z "$point_name" ]; then
        list_restore_points
        echo "Usage: $0 restore <restore-point-name>"
        return 1
    fi
    
    # Find matching restore point
    local restore_path=""
    for point in "$RESTORE_DIR"/*; do
        if [[ "$(basename "$point")" == *"$point_name"* ]]; then
            restore_path="$point"
            break
        fi
    done
    
    if [ -z "$restore_path" ] || [ ! -d "$restore_path" ]; then
        echo "❌ Restore point not found: $point_name"
        list_restore_points
        return 1
    fi
    
    echo "🔄 Restoring from: $(basename "$restore_path")"
    echo "=================================="
    echo ""
    
    # Create backup of current state
    echo "📸 Creating backup of current state..."
    create_restore_point "before_restore" "Backup before restoring from $point_name"
    
    # Execute restore
    cd "$restore_path" && bash restore.sh
    cd "$CURRENT_DIR"
    
    echo ""
    echo "✅ Restoration complete!"
}

# Function to cleanup old restore points
cleanup_old_restore_points() {
    local count=$(ls -1 "$RESTORE_DIR" 2>/dev/null | wc -l)
    if [ $count -gt 10 ]; then
        echo "🧹 Cleaning up old restore points..."
        ls -1t "$RESTORE_DIR" | tail -n +11 | xargs -I {} rm -rf "$RESTORE_DIR/{}"
    fi
}

# Function to create automatic restore point on failure
auto_restore_on_failure() {
    echo "🚨 Agent Failure Detected - Creating Restore Point"
    echo "================================================"
    
    create_restore_point "failure" "Automatic backup on agent failure"
    
    # Try to get error logs
    local error_log="$RESTORE_DIR/failure_${TIMESTAMP}/error_logs.txt"
    echo "=== Error Log Capture ===" > "$error_log"
    echo "Timestamp: $(date)" >> "$error_log"
    echo "" >> "$error_log"
    
    # Capture recent logs
    if [ -d "logs" ]; then
        tail -n 100 logs/*.log >> "$error_log" 2>/dev/null
    fi
    
    # Capture Docker logs if applicable
    docker-compose -f docker-compose.simple.yml logs --tail=100 >> "$error_log" 2>/dev/null
    
    echo "📋 Error logs saved to restore point"
}

# Main command handling
case "${1:-create}" in
    create)
        create_restore_point "${2:-manual}" "$3"
        ;;
    list)
        list_restore_points
        ;;
    restore)
        restore_from_point "$2"
        ;;
    auto-failure)
        auto_restore_on_failure
        ;;
    cleanup)
        cleanup_old_restore_points
        echo "✅ Old restore points cleaned up"
        ;;
    *)
        echo "Usage: $0 {create|list|restore|auto-failure|cleanup} [name] [description]"
        echo ""
        echo "Commands:"
        echo "  create [name] [desc]  - Create a new restore point"
        echo "  list                  - List all restore points"
        echo "  restore <name>        - Restore from a specific point"
        echo "  auto-failure          - Create restore point on failure"
        echo "  cleanup               - Remove old restore points"
        echo ""
        echo "Examples:"
        echo "  $0 create"
        echo "  $0 create pre-update \"Before major update\""
        echo "  $0 restore pre-update"
        ;;
esac