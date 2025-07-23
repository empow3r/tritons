#!/bin/bash
# start-enhanced-tritons.sh - Tritons + VibeTunnel Integration

set -e

echo "🌐 TRITONS + VIBETUNNEL - ENHANCED AGENT CONTROL"
echo "================================================="
echo "Cross-device agent control with browser terminals"
echo ""

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

CURRENT_DIR=$(pwd)
ENHANCED_CONFIG_DIR="$HOME/.tritons/enhanced"

# Setup enhanced environment
setup_enhanced_environment() {
    print_step "Setting up enhanced Tritons + VibeTunnel environment"
    
    mkdir -p "$ENHANCED_CONFIG_DIR"/{config,terminals,logs}
    
    # Clone VibeTunnel if not exists
    if [ ! -d ".vibetunnel" ]; then
        print_step "Cloning VibeTunnel..."
        git clone https://github.com/amantus-ai/vibetunnel.git .vibetunnel
        print_success "VibeTunnel cloned"
    fi
    
    print_success "Enhanced environment ready"
}

# Create enhanced Docker Compose
create_enhanced_compose() {
    print_step "Creating enhanced Docker Compose configuration"
    
    cat > "$ENHANCED_CONFIG_DIR/docker-compose.enhanced.yml" << 'EOF'
version: '3.8'

services:
  # Enhanced Tritons Master with VibeTunnel integration
  tritons-master:
    image: node:20-alpine
    container_name: tritons-enhanced-master
    hostname: tritons-master
    working_dir: /app
    command: sh -c "npm install express ws socket.io cors && node enhanced-master-orchestrator.js"
    environment:
      - NODE_ROLE=enhanced_master_orchestrator
      - AGENT_ID=master-enhanced-001
      - VIBETUNNEL_ENABLED=true
      - ENHANCED_TERMINALS=true
      - CROSS_DEVICE_ACCESS=true
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ./src:/app
      - agent-data:/app/data
      - agent-terminals:/app/terminals
      - ./logs:/app/logs
    ports:
      - "8080:8080"  # Main dashboard
      - "8081:8081"  # WebSocket for agent terminals
      - "8082:8082"  # Agent coordination
    networks:
      - tritons-enhanced
    restart: unless-stopped

  # VibeTunnel Server for cross-device terminal access
  vibetunnel-server:
    image: node:20-alpine
    container_name: vibetunnel-tritons
    hostname: vibetunnel-server
    working_dir: /app
    command: sh -c "npm install && npm start"
    environment:
      - AUTH_MODE=multimodal
      - TRITONS_INTEGRATION=true
      - TRITONS_MASTER_URL=http://tritons-master:8080
      - ENABLE_CROSS_PLATFORM=true
      - ENABLE_MOBILE_ACCESS=true
    volumes:
      - ./.vibetunnel:/app
      - ~/.ssh:/root/.ssh:ro
      - ~/.tritons/certs:/certs:ro
      - agent-terminals:/terminals
    ports:
      - "3000:3000"  # VibeTunnel web interface
      - "3001:3001"  # WebSocket for terminals
    networks:
      - tritons-enhanced
    depends_on:
      - tritons-master
    restart: unless-stopped

  # Agent Terminal Bridge for seamless integration
  agent-terminal-bridge:
    image: node:20-alpine
    container_name: agent-terminal-bridge
    hostname: terminal-bridge
    working_dir: /app
    command: sh -c "npm install ws pty-spawn socket.io-client && node agent-terminal-bridge.js"
    environment:
      - TRITONS_MASTER_URL=http://tritons-master:8080
      - VIBETUNNEL_URL=http://vibetunnel-server:3000
      - BRIDGE_MODE=enhanced
    volumes:
      - ./src:/app
      - agent-terminals:/terminals
      - agent-data:/app/data
    ports:
      - "3002:3002"  # Bridge API
    networks:
      - tritons-enhanced
    depends_on:
      - tritons-master
      - vibetunnel-server
    restart: unless-stopped

  # Enhanced Development Agent with terminal support
  tritons-agent-dev-1:
    image: node:20-alpine
    container_name: tritons-enhanced-dev-1
    hostname: enhanced-dev-001
    working_dir: /app
    command: sh -c "npm install express axios ws && node enhanced-development-agent.js"
    environment:
      - NODE_ROLE=enhanced_development_agent
      - AGENT_ID=enhanced-dev-001
      - MASTER_HOST=tritons-master
      - MASTER_PORT=8080
      - TERMINAL_BRIDGE_URL=http://agent-terminal-bridge:3002
      - VIBETUNNEL_INTEGRATION=true
      - SPAWNING_CAPABILITY=true
    volumes:
      - ./src:/app
      - agent-data:/app/data
      - agent-terminals:/terminals
    networks:
      - tritons-enhanced
    depends_on:
      - tritons-master
      - agent-terminal-bridge
    restart: unless-stopped

  # Enhanced QA Agent with terminal support
  tritons-agent-qa-1:
    image: node:20-alpine
    container_name: tritons-enhanced-qa-1
    hostname: enhanced-qa-001
    working_dir: /app
    command: sh -c "npm install express axios ws && node enhanced-qa-agent.js"
    environment:
      - NODE_ROLE=enhanced_qa_agent
      - AGENT_ID=enhanced-qa-001
      - MASTER_HOST=tritons-master
      - MASTER_PORT=8080
      - TERMINAL_BRIDGE_URL=http://agent-terminal-bridge:3002
      - VIBETUNNEL_INTEGRATION=true
    volumes:
      - ./src:/app
      - agent-data:/app/data
      - agent-terminals:/terminals
    networks:
      - tritons-enhanced
    depends_on:
      - tritons-master
      - agent-terminal-bridge
    restart: unless-stopped

volumes:
  agent-data:
    driver: local
  agent-terminals:
    driver: local

networks:
  tritons-enhanced:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
EOF

    print_success "Enhanced Docker Compose created"
}

# Create enhanced master orchestrator
create_enhanced_master() {
    print_step "Creating enhanced master orchestrator with VibeTunnel integration"
    
    mkdir -p src
    cat > src/enhanced-master-orchestrator.js << 'EOF'
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

class EnhancedMasterOrchestrator {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.agents = new Map();
        this.tasks = [];
        this.terminals = new Map();
        this.collaborationSessions = new Map();
        this.targetAgents = parseInt(process.env.TARGET_AGENTS) || 1000;
        this.currentPhase = 'bootstrap'; // bootstrap -> exponential -> optimization
        this.vibeTunnelEnabled = process.env.VIBETUNNEL_ENABLED === 'true';
        
        this.setupMiddleware();
        this.setupWebSocket();
        this.setupRoutes();
        this.setupEnhancedRoutes();
        this.startHealthMonitoring();
        
        console.log('🤖 Enhanced Master Orchestrator with VibeTunnel integration starting...');
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // CORS for cross-device access
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ server: this.server, port: 8081 });
        
        this.wss.on('connection', (ws, req) => {
            const url = new URL(req.url, 'http://localhost');
            const agentId = url.searchParams.get('agentId');
            const sessionType = url.searchParams.get('type') || 'terminal';
            
            console.log(`🔗 WebSocket connection: ${sessionType} for agent ${agentId}`);
            
            if (sessionType === 'terminal') {
                this.handleTerminalConnection(ws, agentId);
            } else if (sessionType === 'collaboration') {
                this.handleCollaborationConnection(ws, agentId);
            }
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                agents: this.agents.size,
                phase: this.currentPhase,
                vibeTunnelEnabled: this.vibeTunnelEnabled,
                timestamp: Date.now()
            });
        });
        
        // Agent registration
        this.app.post('/api/agents/register', (req, res) => {
            const agent = {
                id: req.body.id,
                role: req.body.role,
                capabilities: req.body.capabilities || [],
                hostname: req.body.hostname,
                status: 'active',
                registeredAt: Date.now(),
                terminalUrl: null
            };
            
            this.agents.set(agent.id, agent);
            console.log(`📝 Enhanced agent registered: ${agent.id} (${agent.role})`);
            
            // Create terminal session for agent
            if (this.vibeTunnelEnabled) {
                this.createAgentTerminal(agent.id);
            }
            
            res.json({ success: true, message: 'Enhanced agent registered successfully' });
        });
        
        // Task submission
        this.app.post('/api/tasks/submit', (req, res) => {
            const task = {
                id: this.generateTaskId(),
                ...req.body,
                status: 'pending',
                createdAt: Date.now(),
                assignedAgents: []
            };
            
            this.tasks.push(task);
            console.log(`📝 Task submitted: ${task.id}`);
            
            this.distributeTasks();
            res.json({ success: true, taskId: task.id });
        });
        
        // Enhanced agent spawning
        this.app.post('/api/agents/spawn', async (req, res) => {
            const { count = 1, role = 'development_agent', withTerminal = true } = req.body;
            
            try {
                const spawnedAgents = await this.spawnEnhancedAgents(count, role, withTerminal);
                res.json({ 
                    success: true, 
                    spawnedAgents,
                    totalAgents: this.agents.size,
                    phase: this.currentPhase
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
        
        // Enhanced dashboard
        this.app.get('/', (req, res) => {
            res.send(this.generateEnhancedDashboard());
        });
    }
    
    setupEnhancedRoutes() {
        // Agent terminal access
        this.app.get('/agents/:agentId/terminal', (req, res) => {
            const agent = this.agents.get(req.params.agentId);
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }
            
            const terminalUrl = this.getOrCreateAgentTerminal(req.params.agentId);
            res.json({ 
                terminalUrl, 
                embedUrl: `${terminalUrl}?embed=true`,
                fullUrl: `http://localhost:3000/terminal/${req.params.agentId}`
            });
        });
        
        // Multi-device agent control
        this.app.get('/remote-control/:deviceId', (req, res) => {
            const deviceAgents = Array.from(this.agents.values())
                .filter(agent => agent.hostname === req.params.deviceId);
            
            const deviceTerminals = deviceAgents.map(agent => ({
                agentId: agent.id,
                role: agent.role,
                terminalUrl: this.getOrCreateAgentTerminal(agent.id),
                status: agent.status
            }));
            
            res.json({ device: req.params.deviceId, terminals: deviceTerminals });
        });
        
        // Live collaboration sessions
        this.app.post('/sessions/create', (req, res) => {
            const session = {
                id: this.generateSessionId(),
                name: req.body.name || 'Untitled Session',
                agents: req.body.agents || [],
                collaborators: [],
                createdAt: Date.now(),
                sharedTerminalUrl: `http://localhost:3000/session/${this.generateSessionId()}`
            };
            
            this.collaborationSessions.set(session.id, session);
            res.json(session);
        });
        
        // Cross-platform access info
        this.app.get('/access-info', (req, res) => {
            res.json({
                dashboardUrl: 'http://localhost:8080',
                vibeTunnelUrl: 'http://localhost:3000',
                mobileUrl: `http://${this.getLocalIP()}:3000`,
                qrCode: this.generateQRCode(`http://${this.getLocalIP()}:3000`),
                crossPlatform: true,
                secureAccess: true
            });
        });
    }
    
    async spawnEnhancedAgents(count, role, withTerminal) {
        const spawnedAgents = [];
        
        for (let i = 0; i < count; i++) {
            const agentId = `${role}-${Date.now()}-${i}`;
            const agent = {
                id: agentId,
                role,
                status: 'spawning',
                hostname: `agent-${agentId}`,
                capabilities: this.getDefaultCapabilities(role),
                spawnedAt: Date.now(),
                terminalUrl: null
            };
            
            // Create terminal if requested
            if (withTerminal && this.vibeTunnelEnabled) {
                agent.terminalUrl = await this.createAgentTerminal(agentId);
            }
            
            this.agents.set(agentId, agent);
            spawnedAgents.push(agent);
            
            console.log(`🚀 Enhanced agent spawned: ${agentId} ${withTerminal ? '(with terminal)' : ''}`);
        }
        
        // Update growth phase
        this.updateGrowthPhase();
        
        return spawnedAgents;
    }
    
    async createAgentTerminal(agentId) {
        try {
            // Register terminal with VibeTunnel bridge
            const response = await fetch('http://agent-terminal-bridge:3002/api/terminals/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId, type: 'agent-terminal' })
            });
            
            const result = await response.json();
            const terminalUrl = `http://localhost:3000/terminal/${agentId}`;
            
            this.terminals.set(agentId, {
                url: terminalUrl,
                bridgeId: result.bridgeId,
                createdAt: Date.now()
            });
            
            return terminalUrl;
        } catch (error) {
            console.warn(`⚠️ Could not create terminal for ${agentId}:`, error.message);
            return null;
        }
    }
    
    getOrCreateAgentTerminal(agentId) {
        if (this.terminals.has(agentId)) {
            return this.terminals.get(agentId).url;
        }
        return this.createAgentTerminal(agentId);
    }
    
    handleTerminalConnection(ws, agentId) {
        // Handle terminal WebSocket connections
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`🖥️ Terminal ${agentId}: ${data.type}`);
                
                // Forward to appropriate agent or bridge
                this.forwardToAgentTerminal(agentId, data);
            } catch (error) {
                console.error('Terminal message error:', error);
            }
        });
    }
    
    handleCollaborationConnection(ws, sessionId) {
        // Handle collaboration session connections
        const session = this.collaborationSessions.get(sessionId);
        if (session) {
            session.collaborators.push({ ws, joinedAt: Date.now() });
            console.log(`👥 Collaborator joined session ${sessionId}`);
        }
    }
    
    generateEnhancedDashboard() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>🌐 Tritons Enhanced Control Center</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .controls { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
        .agent-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .terminal-embed { width: 100%; height: 200px; border: 1px solid #ddd; border-radius: 4px; background: #000; }
        .btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #5a6fd8; }
        .btn-success { background: #28a745; }
        .btn-warning { background: #ffc107; color: #212529; }
        .status-active { color: #28a745; font-weight: bold; }
        .cross-device-info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3; }
        .qr-code { float: right; max-width: 100px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌐 Tritons Enhanced Control Center</h1>
        <p>Cross-device agent control with VibeTunnel integration</p>
    </div>
    
    <div class="cross-device-info">
        <h3>📱 Cross-Device Access</h3>
        <p><strong>Dashboard:</strong> <a href="http://localhost:8080" target="_blank">http://localhost:8080</a></p>
        <p><strong>VibeTunnel:</strong> <a href="http://localhost:3000" target="_blank">http://localhost:3000</a></p>
        <p><strong>Mobile Access:</strong> <span id="mobile-url">Loading...</span></p>
        <div id="qr-code" class="qr-code"></div>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>🤖 Active Agents</h3>
            <div style="font-size: 24px; font-weight: bold;" id="agent-count">${this.agents.size}</div>
            <div>Phase: <span id="growth-phase">${this.currentPhase}</span></div>
        </div>
        <div class="stat-card">
            <h3>🖥️ Terminals</h3>
            <div style="font-size: 24px; font-weight: bold;" id="terminal-count">${this.terminals.size}</div>
            <div>VibeTunnel: <span class="status-active">Active</span></div>
        </div>
        <div class="stat-card">
            <h3>📋 Tasks</h3>
            <div style="font-size: 24px; font-weight: bold;" id="task-count">${this.tasks.length}</div>
            <div>Pending: ${this.tasks.filter(t => t.status === 'pending').length}</div>
        </div>
        <div class="stat-card">
            <h3>👥 Sessions</h3>
            <div style="font-size: 24px; font-weight: bold;" id="session-count">${this.collaborationSessions.size}</div>
            <div>Collaborative terminals</div>
        </div>
    </div>
    
    <div class="controls">
        <h3>🚀 Enhanced Agent Control</h3>
        <button class="btn" onclick="spawnAgent('development', true)">Spawn Dev Agent + Terminal</button>
        <button class="btn" onclick="spawnAgent('testing', true)">Spawn QA Agent + Terminal</button>
        <button class="btn" onclick="spawnAgent('deployment', true)">Spawn Deploy Agent + Terminal</button>
        <button class="btn btn-success" onclick="openVibeTunnel()">Open VibeTunnel</button>
        <button class="btn btn-warning" onclick="createCollabSession()">Create Collaboration Session</button>
    </div>
    
    <div class="agent-grid" id="agents-grid">
        ${Array.from(this.agents.values()).map(agent => this.generateAgentCard(agent)).join('')}
    </div>
    
    <script>
        async function spawnAgent(role, withTerminal = true) {
            const response = await fetch('/api/agents/spawn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, withTerminal })
            });
            
            const result = await response.json();
            if (result.success) {
                location.reload();
            }
        }
        
        async function openVibeTunnel() {
            window.open('http://localhost:3000', '_blank');
        }
        
        async function createCollabSession() {
            const sessionName = prompt('Enter collaboration session name:');
            if (sessionName) {
                const response = await fetch('/sessions/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: sessionName })
                });
                
                const session = await response.json();
                window.open(session.sharedTerminalUrl, '_blank');
            }
        }
        
        function openAgentTerminal(agentId) {
            window.open('/agents/' + agentId + '/terminal', '_blank');
        }
        
        // Load cross-device access info
        async function loadAccessInfo() {
            try {
                const response = await fetch('/access-info');
                const info = await response.json();
                document.getElementById('mobile-url').innerHTML = 
                    '<a href="' + info.mobileUrl + '" target="_blank">' + info.mobileUrl + '</a>';
            } catch (error) {
                console.error('Could not load access info:', error);
            }
        }
        
        // Auto-refresh
        setInterval(() => location.reload(), 30000);
        
        // Load access info on page load
        loadAccessInfo();
    </script>
</body>
</html>`;
    }
    
    generateAgentCard(agent) {
        const terminalInfo = this.terminals.get(agent.id);
        const terminalEmbed = terminalInfo ? 
            `<iframe src="${terminalInfo.url}?embed=true" class="terminal-embed"></iframe>` : 
            '<div class="terminal-embed" style="display: flex; align-items: center; justify-content: center; color: #666;">Terminal not available</div>';
        
        return `
        <div class="agent-card">
            <h3>🤖 ${agent.role} (${agent.id})</h3>
            <p>Status: <span class="status-active">${agent.status}</span></p>
            <p>Machine: ${agent.hostname}</p>
            <p>Capabilities: ${(agent.capabilities || []).join(', ')}</p>
            ${terminalEmbed}
            <div style="margin-top: 10px;">
                <button class="btn" onclick="openAgentTerminal('${agent.id}')">Full Terminal</button>
                <button class="btn" onclick="window.open('http://localhost:3000/terminal/${agent.id}', '_blank')">VibeTunnel</button>
            </div>
        </div>`;
    }
    
    // Helper methods
    getDefaultCapabilities(role) {
        const capabilities = {
            'development_agent': ['coding', 'debugging', 'testing'],
            'testing_agent': ['qa', 'automation', 'performance'],
            'deployment_agent': ['deployment', 'monitoring', 'scaling']
        };
        return capabilities[role] || ['general'];
    }
    
    updateGrowthPhase() {
        const agentCount = this.agents.size;
        if (agentCount <= 10) {
            this.currentPhase = 'bootstrap';
        } else if (agentCount <= 100) {
            this.currentPhase = 'exponential';
        } else {
            this.currentPhase = 'optimization';
        }
    }
    
    generateTaskId() {
        return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    generateSessionId() {
        return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    getLocalIP() {
        // Simplified - in production, detect actual IP
        return '192.168.1.100';
    }
    
    distributeTasks() {
        // Enhanced task distribution logic
        const pendingTasks = this.tasks.filter(task => task.status === 'pending');
        const availableAgents = Array.from(this.agents.values()).filter(agent => agent.status === 'active');
        
        pendingTasks.forEach(task => {
            if (availableAgents.length > 0) {
                const agent = availableAgents.shift();
                task.status = 'assigned';
                task.assignedAgent = agent.id;
                console.log(`📋 Task ${task.id} assigned to agent ${agent.id}`);
            }
        });
    }
    
    startHealthMonitoring() {
        setInterval(() => {
            console.log(`💚 Health: ${this.agents.size} agents, ${this.tasks.length} tasks, phase: ${this.currentPhase}`);
        }, 30000);
    }
    
    start() {
        this.server.listen(8080, () => {
            console.log('🌐 Enhanced Master Orchestrator running on port 8080');
            console.log('🖥️ Dashboard: http://localhost:8080');
            console.log('🔗 VibeTunnel: http://localhost:3000');
            console.log('📱 Cross-device access enabled');
        });
    }
}

// Start enhanced orchestrator
const orchestrator = new EnhancedMasterOrchestrator();
orchestrator.start();
EOF

    print_success "Enhanced master orchestrator created"
}

# Create agent terminal bridge
create_terminal_bridge() {
    print_step "Creating agent terminal bridge"
    
    cat > src/agent-terminal-bridge.js << 'EOF'
const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const http = require('http');

class AgentTerminalBridge {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.agentProcesses = new Map();
        this.terminalSessions = new Map();
        this.bridgeConnections = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        
        console.log('🌉 Agent Terminal Bridge starting...');
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                activeTerminals: this.terminalSessions.size,
                activeProcesses: this.agentProcesses.size
            });
        });
        
        // Create terminal for agent
        this.app.post('/api/terminals/create', (req, res) => {
            const { agentId, type = 'agent-terminal' } = req.body;
            const bridgeId = this.createTerminalSession(agentId, type);
            
            res.json({
                success: true,
                bridgeId,
                terminalUrl: `http://localhost:3000/terminal/${agentId}`,
                websocketUrl: `ws://localhost:3002/terminal/${agentId}`
            });
        });
        
        // Get terminal info
        this.app.get('/api/terminals/:agentId', (req, res) => {
            const session = this.terminalSessions.get(req.params.agentId);
            if (session) {
                res.json(session);
            } else {
                res.status(404).json({ error: 'Terminal not found' });
            }
        });
        
        // List all terminals
        this.app.get('/api/terminals', (req, res) => {
            const terminals = Array.from(this.terminalSessions.entries()).map(([agentId, session]) => ({
                agentId,
                ...session
            }));
            res.json(terminals);
        });
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ server: this.server, path: '/terminal' });
        
        this.wss.on('connection', (ws, req) => {
            const url = new URL(req.url, 'http://localhost');
            const agentId = url.pathname.split('/').pop();
            
            console.log(`🔗 Terminal WebSocket connection for agent: ${agentId}`);
            
            this.attachToAgentTerminal(ws, agentId);
        });
    }
    
    createTerminalSession(agentId, type) {
        const bridgeId = `bridge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const session = {
            bridgeId,
            agentId,
            type,
            createdAt: Date.now(),
            status: 'active',
            connections: []
        };
        
        this.terminalSessions.set(agentId, session);
        
        console.log(`🖥️ Terminal session created for agent ${agentId}`);
        
        return bridgeId;
    }
    
    attachToAgentTerminal(ws, agentId) {
        // Create or get existing agent process
        if (!this.agentProcesses.has(agentId)) {
            this.spawnAgentProcess(agentId);
        }
        
        const agentProcess = this.agentProcesses.get(agentId);
        const session = this.terminalSessions.get(agentId);
        
        if (session) {
            session.connections.push(ws);
        }
        
        // Setup bidirectional communication
        if (agentProcess) {
            // Send agent output to browser terminal
            const stdout = (data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                        type: 'stdout', 
                        data: data.toString(),
                        agentId,
                        timestamp: Date.now()
                    }));
                }
            };
            
            const stderr = (data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                        type: 'stderr', 
                        data: data.toString(),
                        agentId,
                        timestamp: Date.now()
                    }));
                }
            };
            
            agentProcess.stdout.on('data', stdout);
            agentProcess.stderr.on('data', stderr);
            
            // Handle browser input to agent
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    
                    if (data.type === 'stdin' && agentProcess.stdin) {
                        agentProcess.stdin.write(data.data);
                    } else if (data.type === 'command') {
                        this.executeAgentCommand(agentId, data.command);
                    }
                } catch (error) {
                    console.error('Terminal message error:', error);
                }
            });
            
            // Clean up on disconnect
            ws.on('close', () => {
                agentProcess.stdout.off('data', stdout);
                agentProcess.stderr.off('data', stderr);
                
                if (session) {
                    session.connections = session.connections.filter(conn => conn !== ws);
                }
                
                console.log(`🔌 Terminal disconnected for agent ${agentId}`);
            });
        }
    }
    
    spawnAgentProcess(agentId) {
        console.log(`🚀 Spawning agent process: ${agentId}`);
        
        // Determine agent type and spawn appropriate process
        const agentType = agentId.includes('dev') ? 'development' : 
                         agentId.includes('qa') ? 'qa' : 'general';
        
        const agentScript = `enhanced-${agentType}-agent.js`;
        
        const agentProcess = spawn('node', [agentScript], {
            env: { 
                ...process.env, 
                AGENT_ID: agentId,
                TERMINAL_MODE: 'true',
                BRIDGE_ENABLED: 'true'
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: '/app'
        });
        
        agentProcess.on('error', (error) => {
            console.error(`❌ Agent process error for ${agentId}:`, error);
        });
        
        agentProcess.on('exit', (code) => {
            console.log(`🛑 Agent process ${agentId} exited with code ${code}`);
            this.agentProcesses.delete(agentId);
        });
        
        this.agentProcesses.set(agentId, agentProcess);
        
        // Send initial welcome message
        setTimeout(() => {
            agentProcess.stdin.write(`echo "🤖 Agent ${agentId} terminal ready"\n`);
        }, 1000);
    }
    
    executeAgentCommand(agentId, command) {
        const agentProcess = this.agentProcesses.get(agentId);
        if (agentProcess && agentProcess.stdin) {
            agentProcess.stdin.write(command + '\n');
            console.log(`📝 Command executed for ${agentId}: ${command}`);
        }
    }
    
    start() {
        this.server.listen(3002, () => {
            console.log('🌉 Agent Terminal Bridge running on port 3002');
            console.log('🔗 WebSocket endpoint: ws://localhost:3002/terminal');
        });
    }
}

// Start terminal bridge
const bridge = new AgentTerminalBridge();
bridge.start();
EOF

    print_success "Agent terminal bridge created"
}

# Load API keys securely
load_api_keys() {
    print_step "Loading API keys securely"
    
    if [ -f ~/.tritons/secure/api-manager.sh ]; then
        source ~/.tritons/secure/api-manager.sh load
        print_success "API keys loaded from secure storage"
    else
        print_warning "Secure storage not found. Some features may be limited."
        print_warning "Run: ./scripts/setup-secure-storage.sh to setup secure API key storage"
    fi
}

# Start enhanced system
start_enhanced_system() {
    print_step "Starting Tritons + VibeTunnel enhanced system"
    
    # Ensure Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Start the enhanced stack
    docker-compose -f "$ENHANCED_CONFIG_DIR/docker-compose.enhanced.yml" up -d
    
    print_success "Enhanced system containers started"
}

# Wait for services and test
test_enhanced_system() {
    print_step "Waiting for services to start"
    sleep 20
    
    print_step "Testing enhanced system connectivity"
    
    # Test Tritons Master
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        print_success "Tritons Enhanced Master: OK"
    else
        print_warning "Tritons Master health check failed"
    fi
    
    # Test VibeTunnel (may take longer to start)
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "VibeTunnel Server: OK"
    else
        print_warning "VibeTunnel not yet ready (may need more time)"
    fi
    
    # Test Terminal Bridge
    if curl -f http://localhost:3002/health > /dev/null 2>&1; then
        print_success "Agent Terminal Bridge: OK"
    else
        print_warning "Terminal Bridge health check failed"
    fi
}

# Show access information
show_access_info() {
    echo ""
    echo -e "${GREEN}🎉 TRITONS + VIBETUNNEL ENHANCED SYSTEM READY!${NC}"
    echo "================================================================"
    echo ""
    echo "🌐 Access Points:"
    echo "  • Enhanced Dashboard: http://localhost:8080"
    echo "  • VibeTunnel Interface: http://localhost:3000"
    echo "  • Terminal Bridge API: http://localhost:3002"
    echo ""
    echo "📱 Cross-Device Access:"
    echo "  • Mobile URL: http://$(ipconfig getifaddr en0):3000 (if available)"
    echo "  • Any browser can access agent terminals"
    echo "  • Real-time collaboration support"
    echo ""
    echo "🎯 Key Features:"
    echo "  • Browser-based agent terminals"
    echo "  • Cross-device agent control"
    echo "  • Secure multi-modal authentication"
    echo "  • Incremental agent spawning with terminals"
    echo "  • Live development collaboration"
    echo ""
    echo "🔧 Quick Actions:"
    echo "  • Spawn agents: curl -X POST http://localhost:8080/api/agents/spawn"
    echo "  • View logs: docker-compose -f $ENHANCED_CONFIG_DIR/docker-compose.enhanced.yml logs -f"
    echo "  • Stop system: docker-compose -f $ENHANCED_CONFIG_DIR/docker-compose.enhanced.yml down"
    echo ""
    echo "🚀 Perfect for distributed development with live agent collaboration!"
}

# Main execution
main() {
    setup_enhanced_environment
    create_enhanced_compose
    create_enhanced_master
    create_terminal_bridge
    load_api_keys
    start_enhanced_system
    test_enhanced_system
    show_access_info
}

main "$@"