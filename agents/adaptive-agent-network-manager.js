// adaptive-agent-network-manager.js - Fault-Tolerant Updateable Agent Network with Ollama + Free LLM Rotation

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');

class AdaptiveAgentNetworkManager extends EventEmitter {
  constructor() {
    super();
    
    this.nodeId = this.generateNodeId();
    this.networkState = new Map();
    this.ollamaModels = new Map();
    this.freeLLMRotation = new FreeLLMRotationManager();
    this.healthMonitor = new NetworkHealthMonitor();
    this.syncManager = new StateSyncManager();
    
    this.config = {
      heartbeatInterval: 5000,      // 5 seconds
      syncInterval: 30000,          // 30 seconds  
      healthCheckTimeout: 15000,    // 15 seconds
      maxOfflineTime: 300000,       // 5 minutes before node considered dead
      updateCheckInterval: 60000,   // 1 minute
      statePersistInterval: 10000   // 10 seconds
    };
    
    this.initialize();
  }

  generateNodeId() {
    const hostname = require('os').hostname();
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `node-${hostname}-${timestamp}-${random}`;
  }

  async initialize() {
    console.log(`🚀 Initializing Adaptive Agent Network Node: ${this.nodeId}`);
    
    // 1. Detect hardware capabilities
    await this.detectHardwareCapabilities();
    
    // 2. Setup Ollama based on hardware
    await this.setupOllama();
    
    // 3. Initialize free LLM rotation
    await this.freeLLMRotation.initialize();
    
    // 4. Start network discovery
    await this.startNetworkDiscovery();
    
    // 5. Begin state synchronization
    await this.syncManager.start(this);
    
    // 6. Start health monitoring
    this.healthMonitor.start(this);
    
    // 7. Enable auto-updates
    this.startAutoUpdateSystem();
    
    console.log(`✅ Node ${this.nodeId} fully operational`);
    this.emit('node:ready', { nodeId: this.nodeId });
  }

  async detectHardwareCapabilities() {
    console.log('🔍 Detecting hardware capabilities...');
    
    const capabilities = {
      nodeId: this.nodeId,
      hostname: require('os').hostname(),
      platform: require('os').platform(),
      arch: require('os').arch(),
      memory: require('os').totalmem(),
      cpus: require('os').cpus().length,
      gpu: await this.detectGPU(),
      ollamaCapable: false,
      recommendedModels: []
    };

    // Determine Ollama capabilities based on hardware
    if (capabilities.gpu.nvidia && capabilities.gpu.vram >= 12) {
      // High-end server (like dual P40 Tesla)
      capabilities.ollamaCapable = true;
      capabilities.recommendedModels = [
        'llama3.1:70b',      // Large model for complex tasks
        'deepseek-coder:33b', // Code-specific large model
        'mixtral:8x7b',      // Mixture of experts
        'codellama:34b'      // Code generation
      ];
      capabilities.tier = 'server';
      
    } else if (capabilities.gpu.nvidia && capabilities.gpu.vram >= 6) {
      // Mid-tier GPU
      capabilities.ollamaCapable = true;
      capabilities.recommendedModels = [
        'llama3.1:8b',       // Efficient general model
        'deepseek-coder:6.7b', // Code-specific medium
        'codellama:7b',      // Code generation
        'mistral:7b'         // Fast inference
      ];
      capabilities.tier = 'workstation';
      
    } else if (capabilities.memory >= 8 * 1024 * 1024 * 1024) {
      // Laptop with sufficient RAM
      capabilities.ollamaCapable = true;
      capabilities.recommendedModels = [
        'llama3.1:3b',       // Small efficient model
        'deepseek-coder:1.3b', // Tiny code model
        'phi3:mini',         // Microsoft's efficient model
        'gemma:2b'           // Google's small model
      ];
      capabilities.tier = 'laptop';
      
    } else {
      // Low-spec device - cloud only
      capabilities.ollamaCapable = false;
      capabilities.recommendedModels = [];
      capabilities.tier = 'minimal';
    }

    this.capabilities = capabilities;
    console.log(`✅ Hardware tier: ${capabilities.tier}`);
    return capabilities;
  }

  async detectGPU() {
    return new Promise((resolve) => {
      exec('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', (error, stdout) => {
        if (error) {
          resolve({ nvidia: false, vram: 0, name: 'none' });
          return;
        }

        const lines = stdout.trim().split('\n');
        if (lines.length > 0) {
          const [name, vram] = lines[0].split(', ');
          resolve({
            nvidia: true,
            vram: parseInt(vram),
            name: name.trim(),
            count: lines.length
          });
        } else {
          resolve({ nvidia: false, vram: 0, name: 'none' });
        }
      });
    });
  }

  async setupOllama() {
    if (!this.capabilities.ollamaCapable) {
      console.log('⚠️ Hardware insufficient for Ollama - using cloud APIs only');
      return;
    }

    console.log('🤖 Setting up Ollama with optimal models...');

    try {
      // Check if Ollama is installed
      await this.execCommand('ollama --version');
      console.log('✅ Ollama already installed');
    } catch (error) {
      console.log('📦 Installing Ollama...');
      await this.installOllama();
    }

    // Pull recommended models based on hardware
    for (const model of this.capabilities.recommendedModels) {
      try {
        console.log(`📥 Pulling model: ${model}`);
        await this.execCommand(`ollama pull ${model}`);
        this.ollamaModels.set(model, {
          status: 'ready',
          lastUsed: null,
          performance: null
        });
        console.log(`✅ Model ready: ${model}`);
      } catch (error) {
        console.log(`❌ Failed to pull ${model}: ${error.message}`);
      }
    }

    // Start Ollama server
    this.startOllamaServer();
  }

  async installOllama() {
    const platform = require('os').platform();
    
    if (platform === 'linux') {
      await this.execCommand('curl -fsSL https://ollama.ai/install.sh | sh');
    } else if (platform === 'darwin') {
      await this.execCommand('brew install ollama');
    } else {
      throw new Error(`Unsupported platform for Ollama: ${platform}`);
    }
  }

  startOllamaServer() {
    this.ollamaProcess = spawn('ollama', ['serve'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.ollamaProcess.stdout.on('data', (data) => {
      console.log(`Ollama: ${data.toString()}`);
    });

    this.ollamaProcess.stderr.on('data', (data) => {
      console.error(`Ollama Error: ${data.toString()}`);
    });

    console.log('✅ Ollama server started');
  }

  async startNetworkDiscovery() {
    console.log('🌐 Starting network discovery...');
    
    // Try to discover existing network
    const existingNetwork = await this.discoverExistingNetwork();
    
    if (existingNetwork.length > 0) {
      console.log(`🔗 Found existing network with ${existingNetwork.length} nodes`);
      await this.joinExistingNetwork(existingNetwork[0]);
    } else {
      console.log('🆕 Creating new network as master node');
      await this.createNewNetwork();
    }

    // Start periodic network discovery
    setInterval(() => this.performNetworkDiscovery(), this.config.heartbeatInterval);
  }

  async discoverExistingNetwork() {
    const discoveredNodes = [];
    
    // Try common ports on local network
    const networkRange = this.getLocalNetworkRange();
    const ports = [8080, 8443, 3000, 3001];
    
    for (const ip of networkRange) {
      for (const port of ports) {
        try {
          const response = await this.httpRequest(`http://${ip}:${port}/health`, 1000);
          if (response && response.nodeType === 'agent-swarm') {
            discoveredNodes.push({ ip, port, ...response });
          }
        } catch (error) {
          // Ignore connection errors
        }
      }
    }
    
    return discoveredNodes;
  }

  getLocalNetworkRange() {
    const interfaces = require('os').networkInterfaces();
    const ranges = [];
    
    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          const baseIP = net.address.split('.').slice(0, 3).join('.');
          for (let i = 1; i <= 254; i++) {
            ranges.push(`${baseIP}.${i}`);
          }
          break;
        }
      }
    }
    
    return ranges.slice(0, 50); // Limit scan range
  }

  async joinExistingNetwork(masterNode) {
    console.log(`🤝 Joining network via master: ${masterNode.ip}:${masterNode.port}`);
    
    try {
      const joinResponse = await this.httpRequest(
        `http://${masterNode.ip}:${masterNode.port}/join`,
        5000,
        'POST',
        {
          nodeId: this.nodeId,
          capabilities: this.capabilities,
          ollamaModels: Array.from(this.ollamaModels.keys()),
          timestamp: Date.now()
        }
      );

      if (joinResponse.success) {
        this.networkMaster = masterNode;
        this.networkState = new Map(Object.entries(joinResponse.networkState || {}));
        console.log('✅ Successfully joined network');
        
        // Sync state with network
        await this.syncManager.fullSync();
      }
    } catch (error) {
      console.error(`❌ Failed to join network: ${error.message}`);
      await this.createNewNetwork();
    }
  }

  async createNewNetwork() {
    console.log('👑 Creating new network as master node');
    
    this.isMaster = true;
    this.networkState.set(this.nodeId, {
      ...this.capabilities,
      role: 'master',
      status: 'active',
      lastSeen: Date.now(),
      ollamaModels: Array.from(this.ollamaModels.keys())
    });

    // Start HTTP server for network coordination
    await this.startNetworkServer();
  }

  async startNetworkServer() {
    const express = require('express');
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        nodeId: this.nodeId,
        nodeType: 'agent-swarm',
        status: 'healthy',
        capabilities: this.capabilities,
        networkSize: this.networkState.size,
        timestamp: Date.now()
      });
    });

    // Node join endpoint
    app.post('/join', (req, res) => {
      const { nodeId, capabilities, ollamaModels } = req.body;
      
      this.networkState.set(nodeId, {
        ...capabilities,
        role: 'worker',
        status: 'active',
        lastSeen: Date.now(),
        ollamaModels: ollamaModels || []
      });

      console.log(`➕ Node joined network: ${nodeId}`);
      
      res.json({
        success: true,
        networkState: Object.fromEntries(this.networkState),
        masterNode: this.nodeId
      });
    });

    // State sync endpoint
    app.get('/sync', (req, res) => {
      res.json({
        networkState: Object.fromEntries(this.networkState),
        timestamp: Date.now()
      });
    });

    // Update propagation endpoint
    app.post('/update', (req, res) => {
      const { updateData, version } = req.body;
      this.handleNetworkUpdate(updateData, version);
      res.json({ success: true });
    });

    const port = 8080;
    this.networkServer = app.listen(port, () => {
      console.log(`🌐 Network server running on port ${port}`);
    });
  }

  startAutoUpdateSystem() {
    console.log('🔄 Starting auto-update system...');
    
    setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        console.error(`Update check failed: ${error.message}`);
      }
    }, this.config.updateCheckInterval);
  }

  async checkForUpdates() {
    // Check for system updates
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = await this.getLatestVersion();
    
    if (this.versionCompare(latestVersion, currentVersion) > 0) {
      console.log(`📥 Update available: ${currentVersion} → ${latestVersion}`);
      await this.performUpdate(latestVersion);
    }

    // Check for Ollama model updates
    await this.updateOllamaModels();
  }

  async performUpdate(newVersion) {
    console.log(`🔄 Performing update to version ${newVersion}...`);
    
    try {
      // 1. Backup current state
      await this.backupState();
      
      // 2. Download new version
      await this.downloadUpdate(newVersion);
      
      // 3. Apply update
      await this.applyUpdate(newVersion);
      
      // 4. Restart with new version
      await this.gracefulRestart();
      
      console.log(`✅ Update completed successfully`);
    } catch (error) {
      console.error(`❌ Update failed: ${error.message}`);
      await this.rollbackUpdate();
    }
  }

  async execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async httpRequest(url, timeout = 5000, method = 'GET', data = null) {
    // Simple HTTP request implementation
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? require('https') : require('http');
      const options = {
        method,
        timeout,
        headers: data ? { 'Content-Type': 'application/json' } : {}
      };

      const req = client.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  versionCompare(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }

  async getCurrentVersion() {
    try {
      const packagePath = path.join(__dirname, 'package.json');
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      return packageData.version || '1.0.0';
    } catch (error) {
      return '1.0.0';
    }
  }

  async getLatestVersion() {
    try {
      // Check GitHub releases or update server
      const response = await this.httpRequest('https://api.github.com/repos/your-org/agent-swarm/releases/latest');
      return response.tag_name.replace('v', '');
    } catch (error) {
      return this.getCurrentVersion();
    }
  }
}

// Free LLM Rotation Manager
class FreeLLMRotationManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.rotationIndex = 0;
    this.tokenLimits = new Map();
    this.usageTracking = new Map();
  }

  async initialize() {
    console.log('🔄 Initializing Free LLM Rotation...');
    
    // Setup free providers with token limits
    this.setupFreeProviders();
    
    // Start rotation scheduler
    this.startRotationScheduler();
    
    console.log('✅ Free LLM rotation ready');
  }

  setupFreeProviders() {
    // DeepSeek - Free tier
    this.providers.set('deepseek', {
      apiKey: process.env.DEEPSEEK_API_KEYS,
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      tokenLimit: 1000000, // Daily limit
      resetTime: '24h',
      priority: 1 // Higher priority for coding tasks
    });

    // Kimi2 - Free tier  
    this.providers.set('kimi2', {
      apiKey: process.env.KIMI_API_KEY,
      endpoint: 'https://api.moonshot.ai/v1/chat/completions',
      model: 'moonshot-v1-8k',
      tokenLimit: 500000, // Daily limit
      resetTime: '24h',
      priority: 2
    });

    // Gemini - Free tier
    this.providers.set('gemini', {
      apiKey: process.env.GEMINI_API_KEY,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      model: 'gemini-pro',
      tokenLimit: 1000000, // Daily limit
      resetTime: '24h',
      priority: 3
    });

    // OpenRouter - Free tier models
    this.providers.set('openrouter-free', {
      apiKey: process.env.OPENROUTER_API_KEY,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      tokenLimit: 200000, // Daily limit for free models
      resetTime: '24h',
      priority: 4
    });

    // Initialize usage tracking
    for (const [provider, config] of this.providers) {
      this.usageTracking.set(provider, {
        tokensUsed: 0,
        requestCount: 0,
        lastReset: Date.now(),
        available: true
      });
    }
  }

  startRotationScheduler() {
    // Check limits and rotate every hour
    setInterval(() => {
      this.checkLimitsAndRotate();
    }, 3600000); // 1 hour

    // Reset daily limits
    setInterval(() => {
      this.resetDailyLimits();
    }, 86400000); // 24 hours
  }

  async getOptimalProvider(taskType = 'general', estimatedTokens = 1000) {
    // Find available provider with sufficient quota
    const availableProviders = Array.from(this.providers.entries())
      .filter(([name, config]) => {
        const usage = this.usageTracking.get(name);
        return usage.available && 
               (usage.tokensUsed + estimatedTokens) < config.tokenLimit;
      })
      .sort((a, b) => a[1].priority - b[1].priority); // Sort by priority

    if (availableProviders.length === 0) {
      throw new Error('No available free LLM providers - all limits exceeded');
    }

    // Select based on task type
    let selectedProvider = availableProviders[0];
    
    if (taskType === 'coding' && availableProviders.find(p => p[0] === 'deepseek')) {
      selectedProvider = availableProviders.find(p => p[0] === 'deepseek');
    }

    return {
      name: selectedProvider[0],
      config: selectedProvider[1]
    };
  }

  recordUsage(providerName, tokensUsed) {
    const usage = this.usageTracking.get(providerName);
    if (usage) {
      usage.tokensUsed += tokensUsed;
      usage.requestCount += 1;
      
      // Check if approaching limit
      const config = this.providers.get(providerName);
      if (usage.tokensUsed > config.tokenLimit * 0.9) {
        usage.available = false;
        console.log(`⚠️ Provider ${providerName} approaching limit - marking unavailable`);
      }
    }
  }

  checkLimitsAndRotate() {
    console.log('🔄 Checking LLM limits and rotating...');
    
    for (const [name, usage] of this.usageTracking) {
      const config = this.providers.get(name);
      
      if (usage.tokensUsed >= config.tokenLimit) {
        usage.available = false;
        console.log(`🚫 Provider ${name} limit exceeded`);
      }
    }
  }

  resetDailyLimits() {
    console.log('🔄 Resetting daily LLM limits...');
    
    for (const [name, usage] of this.usageTracking) {
      usage.tokensUsed = 0;
      usage.requestCount = 0;
      usage.available = true;
      usage.lastReset = Date.now();
    }
  }

  getUsageStats() {
    const stats = {};
    
    for (const [name, usage] of this.usageTracking) {
      const config = this.providers.get(name);
      stats[name] = {
        ...usage,
        limitPercentage: (usage.tokensUsed / config.tokenLimit) * 100,
        remainingTokens: config.tokenLimit - usage.tokensUsed
      };
    }
    
    return stats;
  }
}

// Network Health Monitor
class NetworkHealthMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.alertThresholds = {
      nodeOfflineTime: 300000, // 5 minutes
      networkPartition: 0.5,   // 50% of nodes unreachable
      lowPerformance: 0.3      // 30% below baseline
    };
  }

  start(networkManager) {
    this.networkManager = networkManager;
    
    setInterval(() => {
      this.performHealthChecks();
    }, networkManager.config.heartbeatInterval);
  }

  async performHealthChecks() {
    const now = Date.now();
    const unhealthyNodes = [];
    
    for (const [nodeId, nodeInfo] of this.networkManager.networkState) {
      const timeSinceLastSeen = now - nodeInfo.lastSeen;
      
      if (timeSinceLastSeen > this.alertThresholds.nodeOfflineTime) {
        unhealthyNodes.push(nodeId);
        nodeInfo.status = 'offline';
        
        console.log(`⚠️ Node ${nodeId} appears offline (${timeSinceLastSeen}ms)`);
      }
    }

    // Clean up old offline nodes
    for (const nodeId of unhealthyNodes) {
      if (now - this.networkManager.networkState.get(nodeId).lastSeen > 1800000) { // 30 minutes
        this.networkManager.networkState.delete(nodeId);
        console.log(`🗑️ Removed stale node: ${nodeId}`);
      }
    }

    // Check for network partition
    const totalNodes = this.networkManager.networkState.size;
    const offlineNodes = unhealthyNodes.length;
    
    if (offlineNodes / totalNodes > this.alertThresholds.networkPartition) {
      console.log('🚨 Network partition detected!');
      this.networkManager.emit('network:partition', { offlineNodes, totalNodes });
    }
  }
}

// State Synchronization Manager
class StateSyncManager {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = 0;
    this.stateBackups = new Map();
  }

  start(networkManager) {
    this.networkManager = networkManager;
    
    // Periodic state sync
    setInterval(() => {
      if (!this.syncInProgress) {
        this.incrementalSync();
      }
    }, networkManager.config.syncInterval);

    // State persistence
    setInterval(() => {
      this.persistState();
    }, networkManager.config.statePersistInterval);
  }

  async incrementalSync() {
    if (this.networkManager.isMaster) {
      // Master broadcasts state to all nodes
      await this.broadcastState();
    } else if (this.networkManager.networkMaster) {
      // Worker nodes sync with master
      await this.syncWithMaster();
    }
  }

  async fullSync() {
    this.syncInProgress = true;
    
    try {
      if (this.networkManager.networkMaster) {
        const response = await this.networkManager.httpRequest(
          `http://${this.networkManager.networkMaster.ip}:${this.networkManager.networkMaster.port}/sync`
        );
        
        this.networkManager.networkState = new Map(Object.entries(response.networkState));
        console.log('✅ Full state sync completed');
      }
    } catch (error) {
      console.error(`❌ Full sync failed: ${error.message}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  async persistState() {
    const stateFile = path.join(process.env.HOME, '.agent-swarm', 'network-state.json');
    
    try {
      await fs.mkdir(path.dirname(stateFile), { recursive: true });
      
      const stateData = {
        nodeId: this.networkManager.nodeId,
        networkState: Object.fromEntries(this.networkManager.networkState),
        capabilities: this.networkManager.capabilities,
        timestamp: Date.now()
      };
      
      await fs.writeFile(stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.error(`State persistence failed: ${error.message}`);
    }
  }

  async loadPersistedState() {
    const stateFile = path.join(process.env.HOME, '.agent-swarm', 'network-state.json');
    
    try {
      const stateData = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      
      if (Date.now() - stateData.timestamp < 3600000) { // 1 hour validity
        this.networkManager.networkState = new Map(Object.entries(stateData.networkState));
        console.log('✅ Loaded persisted network state');
        return true;
      }
    } catch (error) {
      console.log('No valid persisted state found');
    }
    
    return false;
  }
}

module.exports = {
  AdaptiveAgentNetworkManager,
  FreeLLMRotationManager,
  NetworkHealthMonitor,
  StateSyncManager
};

// Start network manager if run directly
if (require.main === module) {
  const manager = new AdaptiveAgentNetworkManager();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Graceful shutdown initiated...');
    await manager.gracefulShutdown();
    process.exit(0);
  });
}