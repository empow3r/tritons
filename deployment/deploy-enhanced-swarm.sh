#!/bin/bash
# deploy-enhanced-swarm.sh - Deploy Enhanced Swarm with Hierarchical Decision Making

set -e

echo "🚀 Deploying Enhanced Swarm Orchestrator System"
echo "============================================="
echo "Features:"
echo "  ✓ Multiple Context Agents (redundancy & speed)"
echo "  ✓ Hierarchical Decision System (3-vote consensus)"
echo "  ✓ Legal/Ethical/Fortune Teller Advisory"
echo "  ✓ Granular Task Decomposition"
echo "  ✓ Resource Monitoring & Alerts"
echo ""

# Configuration
SWARM_DIR="$HOME/.enhanced-swarm-orchestrator"
CURRENT_DIR=$(pwd)

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p "$SWARM_DIR"/{config,agents,contexts,decisions,logs,cache,alerts}
mkdir -p "$SWARM_DIR"/agents/{context,decision,resource,task}

# Copy files
echo "📋 Copying system files..."
cp ../core/enhanced-swarm-orchestrator.js "$SWARM_DIR/"
cp swarm-dashboard.html "$SWARM_DIR/public/"
mkdir -p "$SWARM_DIR/public"
cp swarm-dashboard.html "$SWARM_DIR/public/index.html"

# Initialize npm project
cd "$SWARM_DIR"
echo "📦 Initializing Node.js project..."
npm init -y > /dev/null 2>&1

# Install dependencies
echo "📦 Installing dependencies..."
npm install --save \
    express \
    ws \
    events \
    uuid \
    dotenv \
    node-cache \
    pm2 \
    @anthropic-ai/sdk \
    openai

# Create main server file
echo "🌐 Creating main server..."
cat > "$SWARM_DIR/server.js" << 'EOF'
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { 
    EnhancedSwarmOrchestrator,
    HierarchicalDecisionSystem,
    MultiContextAgentSystem,
    ResourceMonitor,
    TaskDecomposer 
} = require('./enhanced-swarm-orchestrator');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize systems
const orchestrator = new EnhancedSwarmOrchestrator();
const stats = {
    activeTasks: 0,
    decisionsM
: 0,
    contextsProcessed: 0,
    alerts: []
};

// API Routes
app.post('/api/task', async (req, res) => {
    try {
        const task = {
            id: `task-${Date.now()}`,
            ...req.body,
            created: Date.now()
        };
        
        orchestrator.emit('task:created', task);
        stats.activeTasks++;
        
        res.json({ success: true, task });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats', (req, res) => {
    res.json({
        ...stats,
        resources: orchestrator.resourceMonitor.getLatestStats(),
        agents: orchestrator.contextSystem.getAgentStats()
    });
});

app.get('/api/decisions/:taskId', (req, res) => {
    const decisions = orchestrator.decisionSystem.getDecisionsForTask(req.params.taskId);
    res.json({ success: true, decisions });
});

// WebSocket for real-time updates
const server = app.listen(PORT, () => {
    console.log(`🚀 Enhanced Swarm running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

// Broadcast stats to all clients
function broadcastStats() {
    const data = JSON.stringify({
        type: 'stats',
        data: {
            activeTasks: stats.activeTasks,
            decisions: stats.decisions,
            contexts: stats.contextsProcessed,
            timestamp: Date.now()
        }
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Listen to orchestrator events
orchestrator.on('decision:made', (decision) => {
    stats.decisions++;
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'decision',
                data: decision
            }));
        }
    });
});

orchestrator.on('context:processed', (context) => {
    stats.contextsProcessed++;
});

orchestrator.on('resource:alert', (alert) => {
    stats.alerts.push(alert);
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'alert',
                data: alert
            }));
        }
    });
});

// Periodic broadcasts
setInterval(broadcastStats, 1000);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Enhanced Swarm...');
    process.exit(0);
});
EOF

# Create environment configuration
echo "🔧 Creating configuration..."
cat > "$SWARM_DIR/.env" << 'EOF'
# Enhanced Swarm Configuration
NODE_ENV=production
PORT=3001

# Agent Configuration
MAX_CONTEXT_AGENTS=20
MAX_DECISION_AGENTS=15
REDUNDANCY_FACTOR=3

# Decision Thresholds
OPERATIONAL_THRESHOLD=0.6
TACTICAL_THRESHOLD=0.8
STRATEGIC_THRESHOLD=0.9
CRITICAL_THRESHOLD=0.95

# Resource Limits
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
AGENT_THRESHOLD=90
LATENCY_THRESHOLD=1000

# API Keys (Optional)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
FORTUNE_TELLER_API=mystic_api_key_here
EOF

# Create PM2 ecosystem file
echo "🔧 Creating PM2 ecosystem config..."
cat > "$SWARM_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'enhanced-swarm',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create example usage script
echo "📝 Creating example usage..."
cat > "$SWARM_DIR/example-critical-decision.js" << 'EOF'
// example-critical-decision.js - Example of critical decision escalation

const http = require('http');

// Create a critical task that will escalate to Fortune Teller
const criticalTask = {
    type: 'payment',
    objective: 'Process $1M cryptocurrency transaction with regulatory compliance',
    priority: 'critical',
    legal: true,
    financial: true,
    constraints: {
        regulatory: 'GDPR, AML, KYC required',
        security: 'Multi-sig wallet, 2FA mandatory',
        timeLimit: '24 hours'
    },
    estimatedImpact: 'high',
    riskLevel: 0.95
};

// Send task to orchestrator
const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/task',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        const response = JSON.parse(data);
        console.log('Task submitted:', response);
        
        // Monitor decision making
        console.log('\n🔮 This task will escalate through:');
        console.log('1. Operational Level (Engineers)');
        console.log('2. Tactical Level (Architects)');
        console.log('3. Strategic Level (Directors)');
        console.log('4. Critical Level (Legal + Ethical + Fortune Teller)');
        console.log('\nThe Fortune Teller will provide mystical insights on risk!');
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(JSON.stringify(criticalTask));
req.end();
EOF

# Create start script
echo "🚀 Creating start script..."
cat > "$SWARM_DIR/start.sh" << 'EOF'
#!/bin/bash
echo "🚀 Starting Enhanced Swarm Orchestrator"
echo "====================================="

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Start with PM2
pm2 start ecosystem.config.js

echo ""
echo "✅ Enhanced Swarm is running!"
echo "📊 Dashboard: http://localhost:3001"
echo "📝 Logs: pm2 logs enhanced-swarm"
echo "🛑 Stop: pm2 stop enhanced-swarm"
echo ""
echo "🔮 Try the critical decision example:"
echo "   node example-critical-decision.js"
EOF

chmod +x "$SWARM_DIR/start.sh"

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > "$SWARM_DIR/monitor.sh" << 'EOF'
#!/bin/bash
echo "📊 Enhanced Swarm Monitor"
echo "======================="
echo ""
echo "Opening dashboard in browser..."
echo ""

# Detect OS and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3001
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3001
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    start http://localhost:3001
fi

# Show logs
echo "📋 Recent activity:"
pm2 logs enhanced-swarm --lines 20
EOF

chmod +x "$SWARM_DIR/monitor.sh"

# Create README
echo "📚 Creating documentation..."
cat > "$SWARM_DIR/README.md" << 'EOF'
# Enhanced Swarm Orchestrator

A sophisticated multi-agent system with hierarchical decision-making, including Legal, Ethical, and Fortune Teller advisors for critical decisions.

## Architecture

```
┌─────────────────────────────────────────────┐
│          Critical Decision Level            │
│    Legal ← → Ethical ← → Fortune Teller    │
└─────────────────┬───────────────────────────┘
                  │ 95% threshold
┌─────────────────┴───────────────────────────┐
│          Strategic Decision Level           │
│      Director ← → VP ← → CTO               │
└─────────────────┬───────────────────────────┘
                  │ 90% threshold
┌─────────────────┴───────────────────────────┐
│          Tactical Decision Level            │
│    Architect ← → Lead ← → Manager          │
└─────────────────┬───────────────────────────┘
                  │ 80% threshold
┌─────────────────┴───────────────────────────┐
│         Operational Decision Level          │
│    Analyst ← → Engineer ← → Reviewer       │
└─────────────────────────────────────────────┘
```

## Features

1. **Multiple Context Agents**: Redundant agents for each function
   - 3x Assemblers (critical path redundancy)
   - 2x Analyzers, Reviewers, Optimizers
   - 4x Compressors (parallel processing)
   - 2x Predictors (different strategies)

2. **Hierarchical Decisions**: 3-vote consensus at each level
   - Operational: Day-to-day decisions
   - Tactical: Architecture and design
   - Strategic: Business impact
   - Critical: Legal/Ethical/Mystical

3. **Resource Monitoring**: Real-time alerts
   - CPU, Memory, Agent usage
   - Automatic scaling suggestions
   - Critical limit notifications

4. **Task Decomposition**: Granular parallelization
   - Automatic task breakdown
   - Dependency management
   - Optimal parallel execution

## Quick Start

```bash
# Start the system
./start.sh

# Open monitoring dashboard
./monitor.sh

# Test critical decision
node example-critical-decision.js
```

## API Endpoints

- `POST /api/task` - Submit a new task
- `GET /api/stats` - Get system statistics
- `GET /api/decisions/:taskId` - Get decision history

## Configuration

Edit `.env` file to configure:
- Decision thresholds
- Resource limits
- API keys
- Agent counts

## The Fortune Teller 🔮

When task criticality exceeds 95%, the Fortune Teller provides:
- Risk predictions based on cosmic alignment
- Intuitive insights beyond data
- Lucky timing recommendations
- Karmic impact assessment

## Monitoring

Real-time dashboard shows:
- Active decision processes
- Agent workloads
- Resource usage
- System alerts
- Task decomposition trees

Access at: http://localhost:3001
EOF

# Final summary
echo ""
echo "✅ Enhanced Swarm Orchestrator Deployed!"
echo "========================================"
echo ""
echo "📁 Installation directory: $SWARM_DIR"
echo ""
echo "🚀 To start the system:"
echo "   cd $SWARM_DIR"
echo "   ./start.sh"
echo ""
echo "📊 Dashboard: http://localhost:3001"
echo ""
echo "🔮 Features:"
echo "   • Multiple redundant context agents"
echo "   • 3-vote hierarchical decision system"
echo "   • Legal/Ethical/Fortune Teller advisors"
echo "   • Automatic task decomposition"
echo "   • Real-time resource monitoring"
echo ""
echo "📝 Try the example:"
echo "   cd $SWARM_DIR"
echo "   node example-critical-decision.js"
echo ""
echo "The Fortune Teller awaits your most critical decisions! 🔮"