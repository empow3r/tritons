#!/bin/bash
# backup-restore.sh - TRITONS Backup and Restore Utility

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

BACKUP_DIR="../tritons-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

show_menu() {
    echo -e "${BOLD}${BLUE}🔄 TRITONS Backup & Restore${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "1) Create full backup"
    echo "2) Create state backup (quick)"
    echo "3) List backups"
    echo "4) Restore from backup"
    echo "5) Delete old backups"
    echo "6) Export database"
    echo "7) Import database"
    echo "8) Backup to cloud (S3)"
    echo "0) Exit"
    echo ""
}

create_full_backup() {
    echo -e "${YELLOW}📦 Creating full backup...${NC}"
    
    BACKUP_NAME="tritons_full_${TIMESTAMP}"
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
    
    mkdir -p "$BACKUP_PATH"
    
    # Stop services for consistency
    echo -e "${YELLOW}⚠️  Stopping services for consistent backup...${NC}"
    docker-compose stop 2>/dev/null || true
    
    # Backup all components
    echo "• Backing up core system..."
    cp -r core "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up agents..."
    cp -r agents "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up infrastructure..."
    cp -r infrastructure "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up tasks..."
    cp -r tasks "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up deployment configs..."
    cp -r deployment "$BACKUP_PATH/" 2>/dev/null
    cp docker-compose*.yml "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up environment..."
    cp .env "$BACKUP_PATH/" 2>/dev/null
    cp package.json "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up state..."
    cp -r state "$BACKUP_PATH/" 2>/dev/null
    
    echo "• Backing up logs..."
    cp -r logs "$BACKUP_PATH/" 2>/dev/null
    
    # Export databases
    echo "• Exporting PostgreSQL..."
    if command -v pg_dump &> /dev/null; then
        pg_dump -h ${POSTGRES_HOST:-localhost} \
                -U ${POSTGRES_USER:-tritons} \
                -d ${POSTGRES_DB:-tritons} \
                > "$BACKUP_PATH/postgres_dump.sql" 2>/dev/null || true
    fi
    
    echo "• Exporting Redis..."
    if command -v redis-cli &> /dev/null; then
        redis-cli --rdb "$BACKUP_PATH/redis_dump.rdb" 2>/dev/null || true
    fi
    
    # Create manifest
    cat > "$BACKUP_PATH/manifest.json" << EOF
{
    "system": "TRITONS",
    "type": "full",
    "timestamp": "$TIMESTAMP",
    "date": "$(date)",
    "version": "$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")",
    "departments": ["INFRA", "ARCHITECTURE", "AI_ML", "QUALITY", "SECURITY"],
    "files": $(find "$BACKUP_PATH" -type f | wc -l),
    "size": "$(du -sh "$BACKUP_PATH" | cut -f1)"
}
EOF
    
    # Compress backup
    echo "• Compressing backup..."
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    rm -rf "$BACKUP_NAME"
    cd - > /dev/null
    
    # Restart services
    echo "• Restarting services..."
    docker-compose up -d 2>/dev/null || true
    
    echo -e "${GREEN}✅ Full backup created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz${NC}"
}

create_state_backup() {
    echo -e "${YELLOW}⚡ Creating quick state backup...${NC}"
    
    BACKUP_NAME="tritons_state_${TIMESTAMP}"
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup only essential state
    echo "• Backing up state files..."
    cp -r state "$BACKUP_PATH/" 2>/dev/null
    cp .env "$BACKUP_PATH/" 2>/dev/null
    
    # Quick Redis snapshot
    if command -v redis-cli &> /dev/null; then
        redis-cli BGSAVE 2>/dev/null || true
        sleep 2
        cp /var/lib/redis/dump.rdb "$BACKUP_PATH/" 2>/dev/null || true
    fi
    
    # Create manifest
    cat > "$BACKUP_PATH/manifest.json" << EOF
{
    "system": "TRITONS",
    "type": "state",
    "timestamp": "$TIMESTAMP",
    "date": "$(date)"
}
EOF
    
    # Compress
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    rm -rf "$BACKUP_NAME"
    cd - > /dev/null
    
    echo -e "${GREEN}✅ State backup created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz${NC}"
}

list_backups() {
    echo -e "${CYAN}📋 Available backups:${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "No backups found."
        return
    fi
    
    cd "$BACKUP_DIR"
    for backup in *.tar.gz; do
        if [ -f "$backup" ]; then
            size=$(du -h "$backup" | cut -f1)
            echo -e "${BOLD}$backup${NC} ($size)"
            
            # Extract and show manifest
            tar -xzf "$backup" --to-stdout "*/manifest.json" 2>/dev/null | \
                jq -r '  "  Type: \(.type)\n  Date: \(.date)\n  Version: \(.version // "N/A")\n  Files: \(.files // "N/A")"' 2>/dev/null || true
            echo ""
        fi
    done
    cd - > /dev/null
}

restore_backup() {
    list_backups
    
    echo -n "Enter backup filename to restore: "
    read backup_file
    
    if [ ! -f "${BACKUP_DIR}/${backup_file}" ]; then
        echo -e "${RED}❌ Backup not found${NC}"
        return
    fi
    
    echo -e "${YELLOW}⚠️  This will overwrite current system!${NC}"
    echo -e "${YELLOW}⚠️  All services will be stopped during restore.${NC}"
    echo -n "Continue? (y/N): "
    read confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Restore cancelled."
        return
    fi
    
    # Stop all services
    echo "• Stopping all services..."
    docker-compose down 2>/dev/null || true
    pkill -f "node.*tritons" 2>/dev/null || true
    
    # Create safety backup
    echo "• Creating safety backup..."
    create_state_backup
    
    # Extract backup
    echo "• Extracting backup..."
    cd "$BACKUP_DIR"
    tar -xzf "$backup_file"
    BACKUP_NAME="${backup_file%.tar.gz}"
    
    # Check backup type from manifest
    BACKUP_TYPE=$(jq -r '.type' "${BACKUP_NAME}/manifest.json" 2>/dev/null || echo "unknown")
    
    if [ "$BACKUP_TYPE" = "full" ]; then
        echo "• Restoring full system..."
        cp -r "${BACKUP_NAME}"/* ../../tritons/ 2>/dev/null
        
        # Restore databases
        if [ -f "${BACKUP_NAME}/postgres_dump.sql" ]; then
            echo "• Restoring PostgreSQL..."
            psql -h ${POSTGRES_HOST:-localhost} \
                 -U ${POSTGRES_USER:-tritons} \
                 -d ${POSTGRES_DB:-tritons} \
                 < "${BACKUP_NAME}/postgres_dump.sql" 2>/dev/null || true
        fi
        
        if [ -f "${BACKUP_NAME}/redis_dump.rdb" ]; then
            echo "• Restoring Redis..."
            cp "${BACKUP_NAME}/redis_dump.rdb" /var/lib/redis/dump.rdb 2>/dev/null || true
            redis-cli FLUSHALL 2>/dev/null || true
        fi
    else
        echo "• Restoring state only..."
        cp -r "${BACKUP_NAME}/state" ../../tritons/ 2>/dev/null
        cp "${BACKUP_NAME}/.env" ../../tritons/ 2>/dev/null || true
    fi
    
    # Cleanup
    rm -rf "$BACKUP_NAME"
    cd - > /dev/null
    
    # Restart services
    echo "• Restarting services..."
    cd ../tritons
    docker-compose up -d 2>/dev/null || true
    
    echo -e "${GREEN}✅ Restore complete!${NC}"
}

delete_old_backups() {
    echo -n "Keep backups from last N days (default 30): "
    read days
    days=${days:-30}
    
    echo -n "Delete state backups older than N days (default 7): "
    read state_days
    state_days=${state_days:-7}
    
    echo -e "${YELLOW}🗑️  Cleaning old backups...${NC}"
    
    if [ -d "$BACKUP_DIR" ]; then
        # Delete old full backups
        find "$BACKUP_DIR" -name "tritons_full_*.tar.gz" -mtime +$days -exec rm {} \;
        
        # Delete old state backups
        find "$BACKUP_DIR" -name "tritons_state_*.tar.gz" -mtime +$state_days -exec rm {} \;
        
        echo -e "${GREEN}✅ Old backups deleted${NC}"
    fi
}

export_database() {
    echo -e "${YELLOW}📤 Exporting databases...${NC}"
    
    EXPORT_DIR="tritons_db_export_${TIMESTAMP}"
    mkdir -p "$EXPORT_DIR"
    
    # PostgreSQL
    if command -v pg_dump &> /dev/null; then
        echo "• Exporting PostgreSQL..."
        pg_dump -h ${POSTGRES_HOST:-localhost} \
                -U ${POSTGRES_USER:-tritons} \
                -d ${POSTGRES_DB:-tritons} \
                > "$EXPORT_DIR/postgres.sql"
    fi
    
    # Redis
    if command -v redis-cli &> /dev/null; then
        echo "• Exporting Redis..."
        redis-cli --rdb "$EXPORT_DIR/redis.rdb" 2>/dev/null || true
        redis-cli --raw dump "*" > "$EXPORT_DIR/redis_keys.txt" 2>/dev/null || true
    fi
    
    # Compress
    tar -czf "${EXPORT_DIR}.tar.gz" "$EXPORT_DIR"
    rm -rf "$EXPORT_DIR"
    
    echo -e "${GREEN}✅ Databases exported: ${EXPORT_DIR}.tar.gz${NC}"
}

backup_to_cloud() {
    echo -e "${YELLOW}☁️  Backing up to cloud storage...${NC}"
    
    # Check for AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not installed${NC}"
        echo "Install with: brew install awscli"
        return
    fi
    
    # Create backup first
    create_full_backup
    
    # Get latest backup
    LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/tritons_full_*.tar.gz | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}❌ No backup found to upload${NC}"
        return
    fi
    
    echo -n "Enter S3 bucket name: "
    read bucket
    
    echo "• Uploading to S3..."
    aws s3 cp "$LATEST_BACKUP" "s3://${bucket}/tritons-backups/" || {
        echo -e "${RED}❌ Upload failed${NC}"
        return
    }
    
    echo -e "${GREEN}✅ Backup uploaded to S3${NC}"
}

# Main loop
while true; do
    show_menu
    read -p "Select option: " choice
    
    case $choice in
        1) create_full_backup ;;
        2) create_state_backup ;;
        3) list_backups ;;
        4) restore_backup ;;
        5) delete_old_backups ;;
        6) export_database ;;
        7) echo "Import database feature coming soon..." ;;
        8) backup_to_cloud ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    clear
done