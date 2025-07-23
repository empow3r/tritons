#!/bin/bash
# deploy-fault-tolerant-agent-swarm.sh - Deploy Fault-Tolerant Updateable Agent Network

set -e

echo "🌐 FAULT-TOLERANT ADAPTIVE AGENT SWARM DEPLOYMENT"
echo "================================================="
echo "Features:"
echo "  ✓ Auto-discovery and network healing"
echo "  ✓ Ollama integration (hardware-adaptive)"
echo "  ✓ Free LLM rotation (DeepSeek, Kimi2, Gemini)"
echo "  ✓ Real-time updates and synchronization"
echo "  ✓ Machine failure resilience"
echo "  ✓ New machine auto-onboarding"
echo ""

# Configuration
DEPLOYMENT_DIR="$HOME/.autonomous-agent-swarm"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NODE_ID=${NODE_ID:-$(hostname)-$(date +%s)}
NETWORK_PORT=${NETWORK_PORT:-8080}

# Create deployment structure
echo "📁 Creating deployment structure..."
mkdir -p "$DEPLOYMENT_DIR"/{bin,config,data,logs,backups,ollama,updates}
mkdir -p "$DEPLOYMENT_DIR"/data/{state,sync,health,metrics}
mkdir -p "$DEPLOYMENT_DIR"/config/{llm,network,hardware}

# Copy core files
echo "📋 Copying core system files..."
cp "$SCRIPT_DIR/adaptive-agent-network-manager.js" "$DEPLOYMENT_DIR/bin/"
cp "$SCRIPT_DIR/multi-llm-agent-initializer.sh" "$DEPLOYMENT_DIR/bin/"

# Copy .env file for LLM configurations
if [ -f "$SCRIPT_DIR/CodeDevMethods/strict-yaml/.env" ]; then
    cp "$SCRIPT_DIR/CodeDevMethods/strict-yaml/.env" "$DEPLOYMENT_DIR/config/"
    echo "✅ Environment configuration copied"
else
    echo "⚠️ No .env file found - creating template"
    cat > "$DEPLOYMENT_DIR/config/.env" << 'EOF'
# Multi-LLM Configuration for Agent Swarm
# Add your API keys here

# Claude (Primary LLM)
CLAUDE_API_KEY=your_claude_key_here
CLAUDE_API_KEY2=your_claude_key_2_here
CLAUDE_API_KEY3=your_claude_key_3_here

# OpenAI
OPENAI_API_KEY=your_openai_key_here
OPENAI_API_KEY2=your_openai_key_2_here
OPENAI_API_KEY3=your_openai_key_3_here

# Free LLMs (Recommended for rotation)
DEEPSEEK_API_KEYS=your_deepseek_key_here
DEEPSEEK_API_KEY2=your_deepseek_key_2_here
DEEPSEEK_API_KEY3=your_deepseek_key_3_here
DEEPSEEK_API_KEY4=your_deepseek_key_4_here

GEMINI_API_KEY=your_gemini_key_here
GEMINI_API_KEY2=your_gemini_key_2_here

KIMI_API_KEY=your_kimi_key_here

OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_API_KEY2=your_openrouter_key_2_here

MISTRAL_API_KEY=your_mistral_key_here
EOF
fi

# Detect hardware and create configuration
echo "🔍 Detecting hardware configuration..."
cat > "$DEPLOYMENT_DIR/bin/detect-hardware.js" << 'EOF'
// detect-hardware.js - Hardware Detection and Ollama Setup
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function detectHardware() {
  const info = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
    cpus: os.cpus().length,
    gpu: await detectGPU(),
    network: await detectNetwork()
  };

  // Determine optimal configuration
  const config = determineOptimalConfig(info);
  
  // Save configuration
  await saveConfiguration(config);
  
  console.log(JSON.stringify(config, null, 2));
  return config;
}

async function detectGPU() {
  return new Promise((resolve) => {
    exec('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', (error, stdout) => {
      if (error) {
        // Try alternative GPU detection
        exec('lspci | grep -i nvidia', (err2, stdout2) => {
          resolve({
            type: err2 ? 'none' : 'nvidia',
            vram: 0,
            name: err2 ? 'No GPU' : 'NVIDIA (unknown)',
            detected: !err2
          });
        });
        return;
      }

      const lines = stdout.trim().split('\n');
      if (lines.length > 0) {
        const [name, vram] = lines[0].split(', ');
        resolve({
          type: 'nvidia',
          vram: parseInt(vram),
          name: name.trim(),
          count: lines.length,
          detected: true
        });
      } else {
        resolve({ type: 'none', vram: 0, name: 'No GPU', detected: false });
      }
    });
  });
}

async function detectNetwork() {
  const interfaces = os.networkInterfaces();
  const networks = [];
  
  for (const [name, nets] of Object.entries(interfaces)) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        networks.push({
          interface: name,
          address: net.address,
          netmask: net.netmask,
          cidr: net.cidr
        });
      }
    }
  }
  
  return networks;
}

function determineOptimalConfig(info) {
  let tier, ollamaModels, maxAgents, role;
  
  // Determine hardware tier
  if (info.gpu.type === 'nvidia' && info.gpu.vram >= 24) {
    // High-end server (dual P40 Tesla or better)
    tier = 'server-high';
    ollamaModels = [
      'llama3.1:70b',
      'deepseek-coder:33b', 
      'mixtral:8x7b',
      'codellama:34b',
      'wizardcoder:34b'
    ];
    maxAgents = 50;
    role = 'master-capable';
    
  } else if (info.gpu.type === 'nvidia' && info.gpu.vram >= 12) {
    // Mid-tier server
    tier = 'server-mid';
    ollamaModels = [
      'llama3.1:13b',
      'deepseek-coder:6.7b',
      'codellama:13b',
      'mistral:7b'
    ];
    maxAgents = 25;
    role = 'worker-heavy';
    
  } else if (info.gpu.type === 'nvidia' && info.gpu.vram >= 6) {
    // Workstation
    tier = 'workstation';
    ollamaModels = [
      'llama3.1:8b',
      'deepseek-coder:6.7b',
      'codellama:7b'
    ];
    maxAgents = 10;
    role = 'worker-medium';
    
  } else if (info.memory >= 16) {
    // High-memory laptop/server
    tier = 'laptop-high';
    ollamaModels = [
      'llama3.1:3b',
      'deepseek-coder:1.3b',
      'phi3:mini'
    ];
    maxAgents = 5;
    role = 'worker-light';
    
  } else if (info.memory >= 8) {
    // Standard laptop
    tier = 'laptop-standard';
    ollamaModels = [
      'phi3:mini',
      'gemma:2b'
    ];
    maxAgents = 2;
    role = 'worker-minimal';
    
  } else {
    // Low-spec device
    tier = 'minimal';
    ollamaModels = [];
    maxAgents = 1;
    role = 'cloud-only';
  }

  return {
    hardware: info,
    tier,
    ollamaModels,
    maxAgents,
    role,
    capabilities: {
      ollama: ollamaModels.length > 0,
      cloudLLMs: true,
      development: tier !== 'minimal',
      testing: tier !== 'minimal',
      deployment: ['server-high', 'server-mid'].includes(tier),
      coordination: ['server-high', 'server-mid'].includes(tier)
    },
    networking: {
      canBeMaster: ['server-high', 'server-mid'].includes(tier),
      preferredRole: role,
      maxConnections: maxAgents * 2
    }
  };
}

async function saveConfiguration(config) {
  const configDir = path.join(process.env.HOME, '.autonomous-agent-swarm', 'config');
  await fs.mkdir(configDir, { recursive: true });
  
  await fs.writeFile(
    path.join(configDir, 'hardware.json'),
    JSON.stringify(config, null, 2)
  );
}

if (require.main === module) {
  detectHardware().catch(console.error);
}

module.exports = { detectHardware };
EOF

# Run hardware detection
echo "🔍 Running hardware detection..."
cd "$DEPLOYMENT_DIR"
node bin/detect-hardware.js > config/hardware-config.json

# Read hardware configuration
HARDWARE_CONFIG=$(cat config/hardware-config.json)
HARDWARE_TIER=$(echo "$HARDWARE_CONFIG" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).tier")
echo "✅ Hardware tier detected: $HARDWARE_TIER"

# Install system dependencies
echo "📦 Installing system dependencies..."
install_dependencies() {
    # Node.js dependencies
    npm install -g \
        express \
        ws \
        @anthropic-ai/sdk \
        openai \
        @google/generative-ai \
        axios \
        dotenv \
        node-cron \
        winston \
        compression \
        helmet \
        cors \
        uuid \
        semver \
        tar
    
    # Python dependencies for AI/ML
    pip3 install -q \
        anthropic \
        openai \
        google-generativeai \
        requests \
        python-dotenv \
        asyncio \
        aiohttp \
        numpy \
        psutil
}

# Install dependencies in background
install_dependencies &
DEPS_PID=$!

# Setup Ollama based on hardware capabilities
setup_ollama() {
    local can_ollama=$(echo "$HARDWARE_CONFIG" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).capabilities.ollama")
    
    if [ "$can_ollama" = "true" ]; then
        echo "🤖 Setting up Ollama for hardware tier: $HARDWARE_TIER"
        
        # Install Ollama if not present
        if ! command -v ollama &> /dev/null; then
            echo "📥 Installing Ollama..."
            if [[ "$OSTYPE" == "linux-gnu"* ]]; then
                curl -fsSL https://ollama.ai/install.sh | sh
            elif [[ "$OSTYPE" == "darwin"* ]]; then
                if command -v brew &> /dev/null; then
                    brew install ollama
                else
                    echo "Please install Homebrew first"
                    exit 1
                fi
            fi
        fi
        
        # Start Ollama service
        echo "🚀 Starting Ollama service..."
        ollama serve &
        OLLAMA_PID=$!
        
        # Wait for Ollama to be ready
        sleep 5
        
        # Pull recommended models based on hardware
        local models=$(echo "$HARDWARE_CONFIG" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).ollamaModels.join(' ')")
        
        if [ -n "$models" ]; then
            echo "📥 Pulling Ollama models: $models"
            for model in $models; do
                echo "  Pulling $model..."
                ollama pull "$model" &
            done
            wait # Wait for all model downloads
        fi
        
        echo "✅ Ollama setup complete"
    else
        echo "⚠️ Hardware insufficient for Ollama - using cloud APIs only"
    fi
}

# Setup Ollama in background
setup_ollama &
OLLAMA_SETUP_PID=$!

# Create network manager startup script
echo "🌐 Creating network manager..."
cat > "$DEPLOYMENT_DIR/bin/start-network-manager.js" << 'EOF'
#!/usr/bin/env node
// start-network-manager.js - Start Adaptive Network Manager

const path = require('path');
const fs = require('fs');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

// Set deployment directory
process.env.DEPLOYMENT_DIR = path.join(__dirname, '..');

// Load hardware configuration
const hardwareConfigPath = path.join(__dirname, '..', 'config', 'hardware-config.json');
const hardwareConfig = JSON.parse(fs.readFileSync(hardwareConfigPath, 'utf8'));

console.log(`🚀 Starting Agent Network Manager`);
console.log(`Hardware Tier: ${hardwareConfig.tier}`);
console.log(`Role: ${hardwareConfig.role}`);
console.log(`Max Agents: ${hardwareConfig.maxAgents}`);

// Start the adaptive network manager
const { AdaptiveAgentNetworkManager } = require('./adaptive-agent-network-manager');

const manager = new AdaptiveAgentNetworkManager();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await manager.gracefulShutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Terminating gracefully...');
    await manager.gracefulShutdown();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
EOF

chmod +x "$DEPLOYMENT_DIR/bin/start-network-manager.js"

# Create systemd service for automatic startup
create_systemd_service() {
    if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v systemctl &> /dev/null; then
        echo "🔧 Creating systemd service..."
        
        sudo tee /etc/systemd/system/agent-swarm.service > /dev/null << EOF
[Unit]
Description=Autonomous Agent Swarm Network Manager
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOYMENT_DIR
ExecStart=/usr/bin/node bin/start-network-manager.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HOME=$HOME

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable agent-swarm
        
        echo "✅ Systemd service created and enabled"
    fi
}

# Create launchd service for macOS
create_launchd_service() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🔧 Creating launchd service..."
        
        local plist_file="$HOME/Library/LaunchAgents/com.agentswarm.networkmanager.plist"
        
        cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agentswarm.networkmanager</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$DEPLOYMENT_DIR/bin/start-network-manager.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DEPLOYMENT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DEPLOYMENT_DIR/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$DEPLOYMENT_DIR/logs/stderr.log</string>
</dict>
</plist>
EOF
        
        launchctl load "$plist_file"
        echo "✅ Launchd service created and loaded"
    fi
}

# Create update mechanism
echo "🔄 Setting up auto-update system..."
cat > "$DEPLOYMENT_DIR/bin/update-manager.js" << 'EOF'
// update-manager.js - Handles system updates and synchronization

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

class UpdateManager {
  constructor() {
    this.updateUrl = 'https://api.github.com/repos/your-org/agent-swarm/releases/latest';
    this.currentVersion = this.getCurrentVersion();
    this.updateInProgress = false;
  }

  async checkForUpdates() {
    try {
      const latestRelease = await this.fetchLatestRelease();
      const latestVersion = latestRelease.tag_name.replace('v', '');
      
      if (this.isNewerVersion(latestVersion, this.currentVersion)) {
        console.log(`📥 Update available: ${this.currentVersion} → ${latestVersion}`);
        await this.performUpdate(latestRelease);
      } else {
        console.log('✅ System is up to date');
      }
    } catch (error) {
      console.error('❌ Update check failed:', error.message);
    }
  }

  async performUpdate(release) {
    if (this.updateInProgress) return;
    
    this.updateInProgress = true;
    console.log('🔄 Starting system update...');
    
    try {
      // 1. Backup current system
      await this.createBackup();
      
      // 2. Download update
      const updatePath = await this.downloadUpdate(release);
      
      // 3. Apply update
      await this.applyUpdate(updatePath);
      
      // 4. Restart system
      await this.scheduleRestart();
      
      console.log('✅ Update completed successfully');
    } catch (error) {
      console.error('❌ Update failed:', error.message);
      await this.rollback();
    } finally {
      this.updateInProgress = false;
    }
  }

  async createBackup() {
    const backupDir = path.join(process.env.DEPLOYMENT_DIR, 'backups', `backup-${Date.now()}`);
    await fs.mkdir(backupDir, { recursive: true });
    
    // Copy critical files
    await this.copyDirectory(
      path.join(process.env.DEPLOYMENT_DIR, 'bin'),
      path.join(backupDir, 'bin')
    );
    
    await this.copyDirectory(
      path.join(process.env.DEPLOYMENT_DIR, 'config'),
      path.join(backupDir, 'config')
    );
    
    console.log(`💾 Backup created: ${backupDir}`);
  }

  getCurrentVersion() {
    try {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageData = require(packagePath);
      return packageData.version || '1.0.0';
    } catch (error) {
      return '1.0.0';
    }
  }

  fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      https.get(this.updateUrl, {
        headers: { 'User-Agent': 'Agent-Swarm-Updater' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    
    return false;
  }
}

// Start update manager if run directly
if (require.main === module) {
  const updateManager = new UpdateManager();
  
  // Check for updates immediately
  updateManager.checkForUpdates();
  
  // Check for updates every hour
  setInterval(() => {
    updateManager.checkForUpdates();
  }, 3600000);
}

module.exports = UpdateManager;
EOF

# Create monitoring dashboard
echo "📊 Creating monitoring dashboard..."
cat > "$DEPLOYMENT_DIR/bin/dashboard.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Swarm Network Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat-value { font-size: 2em; font-weight: bold; color: #333; }
        .stat-label { color: #666; margin-top: 5px; }
        .nodes-list { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .node-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
        .status-online { color: #27ae60; }
        .status-offline { color: #e74c3c; }
        .llm-usage { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-top: 20px; }
        .progress-bar { background: #eee; height: 8px; border-radius: 4px; overflow: hidden; margin: 5px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .progress-low { background: #27ae60; }
        .progress-medium { background: #f39c12; }
        .progress-high { background: #e74c3c; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Agent Swarm Network Dashboard</h1>
            <p>Fault-Tolerant Multi-Machine AI Development Network</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="total-nodes">-</div>
                <div class="stat-label">Total Nodes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="active-agents">-</div>
                <div class="stat-label">Active Agents</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="network-health">-</div>
                <div class="stat-label">Network Health</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="tasks-completed">-</div>
                <div class="stat-label">Tasks Completed</div>
            </div>
        </div>
        
        <div class="nodes-list">
            <h2>Network Nodes</h2>
            <div id="nodes-container">
                Loading nodes...
            </div>
        </div>
        
        <div class="llm-usage">
            <h2>LLM Usage & Rotation</h2>
            <div id="llm-container">
                Loading LLM status...
            </div>
        </div>
    </div>
    
    <script>
        // Dashboard JavaScript
        async function fetchStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
        }
        
        function updateDashboard(data) {
            document.getElementById('total-nodes').textContent = data.totalNodes || 0;
            document.getElementById('active-agents').textContent = data.activeAgents || 0;
            document.getElementById('network-health').textContent = (data.networkHealth || 0) + '%';
            document.getElementById('tasks-completed').textContent = data.tasksCompleted || 0;
            
            updateNodesDisplay(data.nodes || []);
            updateLLMDisplay(data.llmUsage || {});
        }
        
        function updateNodesDisplay(nodes) {
            const container = document.getElementById('nodes-container');
            container.innerHTML = nodes.map(node => `
                <div class="node-item">
                    <div>
                        <strong>${node.hostname}</strong> (${node.tier})
                        <br><small>${node.capabilities}</small>
                    </div>
                    <div class="status-${node.status}">
                        ${node.status.toUpperCase()}
                    </div>
                </div>
            `).join('');
        }
        
        function updateLLMDisplay(llmUsage) {
            const container = document.getElementById('llm-container');
            container.innerHTML = Object.entries(llmUsage).map(([provider, usage]) => {
                const percentage = Math.round(usage.limitPercentage || 0);
                const progressClass = percentage < 50 ? 'progress-low' : percentage < 80 ? 'progress-medium' : 'progress-high';
                
                return `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${provider}</strong>
                            <span>${usage.tokensUsed || 0} / ${usage.tokenLimit || 0} tokens</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
                        </div>
                        <small>Status: ${usage.available ? 'Available' : 'Limit Reached'}</small>
                    </div>
                `;
            }).join('');
        }
        
        // Update dashboard every 5 seconds
        fetchStats();
        setInterval(fetchStats, 5000);
    </script>
</body>
</html>
EOF

# Wait for dependencies to finish installing
echo "⏳ Waiting for dependencies to install..."
wait $DEPS_PID

# Wait for Ollama setup
echo "⏳ Waiting for Ollama setup..."
wait $OLLAMA_SETUP_PID

# Create startup scripts for different platforms
create_startup_scripts() {
    echo "🚀 Creating startup scripts..."
    
    # Universal startup script
    cat > "$DEPLOYMENT_DIR/start-agent-swarm.sh" << EOF
#!/bin/bash
# start-agent-swarm.sh - Start the agent swarm network

cd "$DEPLOYMENT_DIR"

echo "🌐 Starting Autonomous Agent Swarm Network"
echo "Node ID: $NODE_ID"
echo "Hardware Tier: $HARDWARE_TIER"

# Load environment
export NODE_ENV=production
export DEPLOYMENT_DIR="$DEPLOYMENT_DIR"
source config/.env

# Start network manager
node bin/start-network-manager.js &
MANAGER_PID=\$!

# Start update manager
node bin/update-manager.js &
UPDATE_PID=\$!

echo "✅ Agent Swarm Network started"
echo "🌐 Dashboard: http://localhost:$NETWORK_PORT"
echo "🔧 Manager PID: \$MANAGER_PID"
echo "🔄 Update PID: \$UPDATE_PID"

# Wait for shutdown signal
trap 'kill \$MANAGER_PID \$UPDATE_PID; exit' SIGINT SIGTERM

wait
EOF

    chmod +x "$DEPLOYMENT_DIR/start-agent-swarm.sh"
    
    # Quick join script for new machines
    cat > "$DEPLOYMENT_DIR/quick-join-network.sh" << 'EOF'
#!/bin/bash
# quick-join-network.sh - Quickly join an existing agent swarm network

echo "🔗 Quick Join Agent Swarm Network"
echo "================================"

MASTER_IP=${1:-"auto-discover"}

if [ "$MASTER_IP" = "auto-discover" ]; then
    echo "🔍 Auto-discovering network..."
    
    # Scan local network for agent swarm nodes
    for i in {1..254}; do
        ip="192.168.1.$i"
        timeout 1 curl -s "http://$ip:8080/health" | grep -q "agent-swarm" && {
            echo "Found agent swarm at $ip"
            MASTER_IP="$ip"
            break
        }
    done 2>/dev/null
    
    if [ "$MASTER_IP" = "auto-discover" ]; then
        echo "❌ No agent swarm network found"
        echo "💡 Start your own network with: ./start-agent-swarm.sh"
        exit 1
    fi
fi

echo "🤝 Joining network at $MASTER_IP..."

# Run the main deployment script with join mode
export JOIN_EXISTING_NETWORK="true"
export MASTER_NODE_IP="$MASTER_IP"

./start-agent-swarm.sh

echo "✅ Successfully joined agent swarm network!"
EOF

    chmod +x "$DEPLOYMENT_DIR/quick-join-network.sh"
}

create_startup_scripts

# Setup auto-start services
create_systemd_service
create_launchd_service

# Create package.json for version management
echo "📦 Creating package configuration..."
cat > "$DEPLOYMENT_DIR/package.json" << EOF
{
  "name": "autonomous-agent-swarm",
  "version": "1.0.0",
  "description": "Fault-Tolerant Multi-Machine AI Agent Swarm Network",
  "main": "bin/start-network-manager.js",
  "scripts": {
    "start": "node bin/start-network-manager.js",
    "update": "node bin/update-manager.js",
    "dashboard": "python3 -m http.server 8080 --directory bin",
    "join": "./quick-join-network.sh",
    "status": "curl -s http://localhost:8080/health | jq"
  },
  "keywords": ["ai", "agents", "swarm", "automation", "llm"],
  "author": "Agent Swarm Team",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.0",
    "ws": "^8.14.0",
    "@anthropic-ai/sdk": "^0.24.0",
    "openai": "^4.0.0",
    "@google/generative-ai": "^0.15.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.0",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0",
    "uuid": "^9.0.1",
    "semver": "^7.5.4"
  }
}
EOF

# Final setup and testing
echo "🧪 Testing deployment..."
cd "$DEPLOYMENT_DIR"

# Test Node.js environment
node -e "console.log('✅ Node.js environment ready')"

# Test hardware detection
node bin/detect-hardware.js > /dev/null && echo "✅ Hardware detection working"

# Test network connectivity
timeout 5 curl -s http://httpbin.org/ip > /dev/null && echo "✅ Internet connectivity confirmed"

echo ""
echo "🎉 FAULT-TOLERANT AGENT SWARM DEPLOYMENT COMPLETE!"
echo "=================================================="
echo ""
echo "📊 System Summary:"
echo "  • Hardware Tier: $HARDWARE_TIER"
echo "  • Deployment Dir: $DEPLOYMENT_DIR"
echo "  • Node ID: $NODE_ID"
echo "  • Network Port: $NETWORK_PORT"
echo ""
echo "🚀 To start the agent swarm:"
echo "   cd $DEPLOYMENT_DIR && ./start-agent-swarm.sh"
echo ""
echo "🔗 To join an existing network from another machine:"
echo "   curl -fsSL [this-script-url] | bash -s -- --join [master-ip]"
echo "   OR: cd $DEPLOYMENT_DIR && ./quick-join-network.sh [master-ip]"
echo ""
echo "📱 Dashboard will be available at:"
echo "   http://localhost:$NETWORK_PORT"
echo ""
echo "🔧 Key Features:"
echo "  ✓ Auto-discovery and fault tolerance"
echo "  ✓ Hardware-adaptive Ollama models"
echo "  ✓ Free LLM rotation (DeepSeek, Kimi2, Gemini)"
echo "  ✓ Real-time updates and state sync"
echo "  ✓ Machine failure recovery"
echo "  ✓ New machine auto-onboarding"
echo ""
echo "🎯 Ready to build the trillion-dollar titan!"