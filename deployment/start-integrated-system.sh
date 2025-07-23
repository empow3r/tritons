#!/bin/bash
# start-integrated-system.sh - Start complete Tritons + Minimal VibeTunnel system

set -e

echo "🚀 TRITONS + MINIMAL VIBETUNNEL INTEGRATION"
echo "==========================================="
echo "Ultra-lightweight cross-device agent control"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() { echo -e "${BLUE}🔹 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Check if services are running
check_services() {
    print_step "Checking system status"
    
    # Check Tritons MVP
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        print_success "Tritons MVP running on port 8080"
    else
        print_info "Starting Tritons MVP..."
        node simple-mvp-master.js &
        sleep 5
    fi
    
    # Check Minimal VibeTunnel
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Minimal VibeTunnel running on port 3001"
    else
        print_info "Starting Minimal VibeTunnel..."
        python3 minimal-vibe-terminal.py 3001 &
        sleep 3
    fi
}

# Show system status
show_status() {
    echo ""
    echo -e "${GREEN}🎉 INTEGRATED SYSTEM READY!${NC}"
    echo "=================================="
    echo ""
    echo "🌐 Access Points:"
    echo "  • Tritons Dashboard: http://localhost:8080"
    echo "  • Terminal Access:   http://localhost:3001"
    echo ""
    echo "📱 Mobile Access:"
    echo "  • Dashboard: http://$(ipconfig getifaddr en0 2>/dev/null || echo "your-ip"):8080"
    echo "  • Terminal:  http://$(ipconfig getifaddr en0 2>/dev/null || echo "your-ip"):3001"
    echo ""
    echo "🎯 What You Can Do:"
    echo "  1. Spawn agents from dashboard (8080)"
    echo "  2. Control agents via terminal (3001)"
    echo "  3. Access from any device (phone, tablet, laptop)"
    echo "  4. Monitor system remotely"
    echo ""
    echo "💡 Integration Features:"
    echo "  • Zero overhead terminal access (5MB RAM)"
    echo "  • Cross-device agent control"
    echo "  • Real-time system monitoring"
    echo "  • Mobile-friendly interfaces"
    echo "  • Secure command filtering"
    echo ""
    echo "🔧 Terminal Commands:"
    echo "  tritons-status  - Check agent system"
    echo "  tritons-agents  - List active agents"
    echo "  tritons-health  - System health check"
    echo ""
    echo "🚀 Perfect for distributed development!"
}

# Test integration
test_integration() {
    print_step "Testing system integration"
    
    # Test Tritons API
    if curl -f http://localhost:8080/api/status > /dev/null 2>&1; then
        print_success "Tritons API responding"
    else
        print_info "Tritons API not yet ready"
    fi
    
    # Test Terminal access
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Terminal access ready"
    else
        print_info "Terminal access not yet ready"
    fi
}

# Main execution
main() {
    check_services
    sleep 2
    test_integration
    show_status
    
    echo ""
    echo "Press Ctrl+C to stop both services"
    
    # Keep script running
    trap 'echo -e "\n🛑 Stopping integrated system..."; pkill -f simple-mvp-master.js; pkill -f minimal-vibe-terminal.py; exit' INT
    
    # Monitor services
    while true; do
        sleep 10
        if ! curl -f http://localhost:8080/health > /dev/null 2>&1; then
            print_info "Restarting Tritons MVP..."
            node simple-mvp-master.js &
        fi
        
        if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
            print_info "Restarting Minimal VibeTunnel..."
            python3 minimal-vibe-terminal.py 3001 &
        fi
    done
}

main "$@"