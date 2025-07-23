#!/bin/bash
# create-restore-point.sh - Create comprehensive system restore point

set -e

echo "💾 CREATING TRITONS SYSTEM RESTORE POINT"
echo "========================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() { echo -e "${BLUE}🔹 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
CURRENT_DIR=$(pwd)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESTORE_DIR="$HOME/.tritons/restore-points"
RESTORE_POINT_DIR="$RESTORE_DIR/restore-point-$TIMESTAMP"
RESTORE_METADATA="$RESTORE_POINT_DIR/restore-metadata.json"

# Create restore point directory
create_restore_structure() {
    print_step "Creating restore point structure"
    
    mkdir -p "$RESTORE_POINT_DIR"/{codebase,config,secure,docker,logs,scripts}
    
    print_success "Restore point directory created: $RESTORE_POINT_DIR"
}

# Backup entire codebase
backup_codebase() {
    print_step "Backing up Tritons codebase"
    
    # Copy all code files
    cp -r "$CURRENT_DIR"/*.js "$RESTORE_POINT_DIR/codebase/" 2>/dev/null || true
    cp -r "$CURRENT_DIR"/*.sh "$RESTORE_POINT_DIR/codebase/" 2>/dev/null || true
    cp -r "$CURRENT_DIR"/*.md "$RESTORE_POINT_DIR/codebase/" 2>/dev/null || true
    cp -r "$CURRENT_DIR"/*.json "$RESTORE_POINT_DIR/codebase/" 2>/dev/null || true
    cp -r "$CURRENT_DIR"/*.yml "$RESTORE_POINT_DIR/codebase/" 2>/dev/null || true
    cp -r "$CURRENT_DIR"/*.yaml "$RESTORE_POINT_DIR/codebase/" 2>/dev/null || true
    
    # Copy src directory if exists
    [ -d "$CURRENT_DIR/src" ] && cp -r "$CURRENT_DIR/src" "$RESTORE_POINT_DIR/codebase/"
    
    # Copy scripts directory if exists
    [ -d "$CURRENT_DIR/scripts" ] && cp -r "$CURRENT_DIR/scripts" "$RESTORE_POINT_DIR/codebase/"
    
    # Copy docs directory if exists
    [ -d "$CURRENT_DIR/docs" ] && cp -r "$CURRENT_DIR/docs" "$RESTORE_POINT_DIR/codebase/"
    
    print_success "Codebase backed up"
}

# Backup configuration
backup_configuration() {
    print_step "Backing up Tritons configuration"
    
    # Backup Tritons config directories
    [ -d ~/.tritons/config ] && cp -r ~/.tritons/config/* "$RESTORE_POINT_DIR/config/" 2>/dev/null || true
    [ -d ~/.tritons/mvp ] && cp -r ~/.tritons/mvp "$RESTORE_POINT_DIR/config/" 2>/dev/null || true
    [ -d ~/.tritons/enhanced ] && cp -r ~/.tritons/enhanced "$RESTORE_POINT_DIR/config/" 2>/dev/null || true
    
    # Backup package.json and dependencies info
    [ -f "$CURRENT_DIR/package.json" ] && cp "$CURRENT_DIR/package.json" "$RESTORE_POINT_DIR/config/"
    [ -f "$CURRENT_DIR/package-lock.json" ] && cp "$CURRENT_DIR/package-lock.json" "$RESTORE_POINT_DIR/config/"
    
    print_success "Configuration backed up"
}

# Backup secure storage (metadata only, not actual keys)
backup_secure_metadata() {
    print_step "Backing up secure storage metadata"
    
    # Create secure storage info (without actual keys)
    cat > "$RESTORE_POINT_DIR/secure/secure-storage-info.txt" << EOF
Tritons Secure Storage Backup Info
==================================
Timestamp: $(date)
Platform: $(uname -s)

Stored Keys (names only, actual keys remain in Keychain):
EOF
    
    # List stored key names without revealing keys
    if [ -f ~/.tritons/secure/api-manager.sh ]; then
        ~/.tritons/secure/api-manager.sh list >> "$RESTORE_POINT_DIR/secure/secure-storage-info.txt" 2>/dev/null || echo "No keys found" >> "$RESTORE_POINT_DIR/secure/secure-storage-info.txt"
        
        # Copy secure scripts (safe to backup)
        cp -r ~/.tritons/secure/*.sh "$RESTORE_POINT_DIR/secure/" 2>/dev/null || true
        cp -r ~/.tritons/secure/*.md "$RESTORE_POINT_DIR/secure/" 2>/dev/null || true
    fi
    
    print_success "Secure metadata backed up (keys remain safely in Keychain)"
}

# Backup Docker configurations
backup_docker_configs() {
    print_step "Backing up Docker configurations"
    
    # Find and backup all Docker compose files
    find "$CURRENT_DIR" -name "docker-compose*.yml" -exec cp {} "$RESTORE_POINT_DIR/docker/" \; 2>/dev/null || true
    find "$CURRENT_DIR" -name "Dockerfile*" -exec cp {} "$RESTORE_POINT_DIR/docker/" \; 2>/dev/null || true
    find ~/.tritons -name "docker-compose*.yml" -exec cp {} "$RESTORE_POINT_DIR/docker/" \; 2>/dev/null || true
    
    # Backup .env templates
    [ -f "$CURRENT_DIR/.env.example" ] && cp "$CURRENT_DIR/.env.example" "$RESTORE_POINT_DIR/docker/"
    [ -f "$CURRENT_DIR/.env.template" ] && cp "$CURRENT_DIR/.env.template" "$RESTORE_POINT_DIR/docker/"
    
    print_success "Docker configurations backed up"
}

# Backup system state
backup_system_state() {
    print_step "Capturing system state"
    
    # System information
    cat > "$RESTORE_POINT_DIR/logs/system-state.log" << EOF
Tritons System State - $(date)
=============================

Node.js Version:
$(node --version 2>/dev/null || echo "Node.js not found")

NPM Version:
$(npm --version 2>/dev/null || echo "NPM not found")

Docker Version:
$(docker --version 2>/dev/null || echo "Docker not found")

Docker Compose Version:
$(docker-compose --version 2>/dev/null || echo "Docker Compose not found")

Git Status:
$(cd "$CURRENT_DIR" && git status 2>/dev/null || echo "Not a git repository")

Git Remote:
$(cd "$CURRENT_DIR" && git remote -v 2>/dev/null || echo "No git remotes")

Current Directory:
$(pwd)

Environment Variables (filtered):
$(env | grep -i tritons || echo "No Tritons environment variables")

Running Processes:
$(ps aux | grep -i tritons | grep -v grep || echo "No Tritons processes running")

Network Ports:
$(lsof -i :8080 2>/dev/null || echo "Port 8080 not in use")
$(lsof -i :3000 2>/dev/null || echo "Port 3000 not in use")

Disk Usage:
$(df -h $HOME)

Memory Usage:
$(free -h 2>/dev/null || vm_stat | head -5)
EOF
    
    print_success "System state captured"
}

# Create restore metadata
create_restore_metadata() {
    print_step "Creating restore metadata"
    
    cat > "$RESTORE_METADATA" << EOF
{
  "restore_point": {
    "timestamp": "$TIMESTAMP",
    "created_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "system_info": {
      "platform": "$(uname -s)",
      "hostname": "$(hostname)",
      "user": "$(whoami)",
      "working_directory": "$CURRENT_DIR"
    },
    "tritons_state": {
      "mvp_running": $(ps aux | grep -q "simple-mvp-master.js" && echo "true" || echo "false"),
      "docker_running": $(docker info > /dev/null 2>&1 && echo "true" || echo "false"),
      "secure_storage": $([ -f ~/.tritons/secure/api-manager.sh ] && echo "true" || echo "false")
    },
    "backup_contents": {
      "codebase": "$(ls -la "$RESTORE_POINT_DIR/codebase" | wc -l) files",
      "configuration": "$(ls -la "$RESTORE_POINT_DIR/config" | wc -l) files",
      "docker_configs": "$(ls -la "$RESTORE_POINT_DIR/docker" | wc -l) files",
      "secure_metadata": "$(ls -la "$RESTORE_POINT_DIR/secure" | wc -l) files"
    },
    "restore_instructions": {
      "codebase": "cp -r $RESTORE_POINT_DIR/codebase/* /target/directory/",
      "configuration": "cp -r $RESTORE_POINT_DIR/config/* ~/.tritons/",
      "docker": "cp -r $RESTORE_POINT_DIR/docker/* /target/directory/",
      "secure_setup": "./scripts/setup-secure-storage.sh && import keys manually"
    },
    "notes": "This restore point contains all Tritons system files except actual API keys (which remain securely in Keychain)"
  }
}
EOF
    
    print_success "Restore metadata created"
}

# Create restore script
create_restore_script() {
    print_step "Creating restore script"
    
    cat > "$RESTORE_POINT_DIR/restore-tritons.sh" << 'EOF'
#!/bin/bash
# restore-tritons.sh - Restore Tritons system from this restore point

set -e

echo "🔄 RESTORING TRITONS SYSTEM"
echo "============================"

RESTORE_POINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$(pwd)}"

echo "📁 Restore Point: $RESTORE_POINT_DIR"
echo "🎯 Target Directory: $TARGET_DIR"
echo ""

read -p "Do you want to restore Tritons to $TARGET_DIR? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo "🔄 Restoring codebase..."
cp -r "$RESTORE_POINT_DIR/codebase/"* "$TARGET_DIR/" 2>/dev/null || true

echo "🔄 Restoring configuration..."
mkdir -p ~/.tritons
cp -r "$RESTORE_POINT_DIR/config/"* ~/.tritons/ 2>/dev/null || true

echo "🔄 Installing dependencies..."
cd "$TARGET_DIR"
[ -f package.json ] && npm install

echo "🔄 Setting up permissions..."
find "$TARGET_DIR" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

echo ""
echo "✅ TRITONS SYSTEM RESTORED!"
echo "=========================="
echo ""
echo "📋 Next steps:"
echo "1. Import your API keys: ./scripts/setup-secure-storage.sh"
echo "2. Start the system: node simple-mvp-master.js"
echo "3. Access dashboard: http://localhost:8080"
echo ""
echo "📄 View restore details: cat $RESTORE_POINT_DIR/restore-metadata.json"
EOF
    
    chmod +x "$RESTORE_POINT_DIR/restore-tritons.sh"
    
    print_success "Restore script created"
}

# Calculate backup size
calculate_backup_size() {
    print_step "Calculating backup size"
    
    BACKUP_SIZE=$(du -sh "$RESTORE_POINT_DIR" | cut -f1)
    
    print_success "Backup size: $BACKUP_SIZE"
}

# Create quick access link
create_quick_access() {
    print_step "Creating quick access links"
    
    # Create latest symlink
    ln -sfn "$RESTORE_POINT_DIR" "$RESTORE_DIR/latest"
    
    # Create convenient access script
    cat > "$RESTORE_DIR/list-restore-points.sh" << 'EOF'
#!/bin/bash
echo "📦 TRITONS RESTORE POINTS"
echo "========================"
echo ""

RESTORE_DIR="$HOME/.tritons/restore-points"

if [ ! -d "$RESTORE_DIR" ]; then
    echo "❌ No restore points found"
    exit 1
fi

echo "Available restore points:"
ls -la "$RESTORE_DIR" | grep "restore-point-" | while read line; do
    echo "  📁 $line"
done

echo ""
echo "🔗 Latest: $RESTORE_DIR/latest"
echo ""
echo "💡 To restore: cd restore-point-YYYYMMDD_HHMMSS && ./restore-tritons.sh"
EOF
    
    chmod +x "$RESTORE_DIR/list-restore-points.sh"
    
    print_success "Quick access created"
}

# Show summary
show_summary() {
    echo ""
    echo -e "${GREEN}💾 RESTORE POINT CREATED SUCCESSFULLY!${NC}"
    echo "=============================================="
    echo ""
    echo "📁 Location: $RESTORE_POINT_DIR"
    echo "🏷️ Timestamp: $TIMESTAMP"
    echo "📏 Size: $(du -sh "$RESTORE_POINT_DIR" | cut -f1)"
    echo ""
    echo "📦 Backed up:"
    echo "  ✅ Complete codebase"
    echo "  ✅ All configurations" 
    echo "  ✅ Docker files"
    echo "  ✅ Secure storage metadata"
    echo "  ✅ System state"
    echo ""
    echo "🚀 Quick commands:"
    echo "  List all restore points: ~/.tritons/restore-points/list-restore-points.sh"
    echo "  View latest: cat ~/.tritons/restore-points/latest/restore-metadata.json"
    echo "  Restore system: cd ~/.tritons/restore-points/latest && ./restore-tritons.sh"
    echo ""
    echo "🔐 Note: API keys remain safely in your Keychain (not backed up for security)"
    echo ""
    echo "✨ Your Tritons system is now fully backed up and can be restored at any time!"
}

# Main execution
main() {
    create_restore_structure
    backup_codebase
    backup_configuration
    backup_secure_metadata
    backup_docker_configs
    backup_system_state
    create_restore_metadata
    create_restore_script
    calculate_backup_size
    create_quick_access
    show_summary
}

main "$@"