// restore-point-system.js - Comprehensive Restore Point and Recovery System

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const EventEmitter = require('events');

class RestorePointSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      baseDir: config.baseDir || path.join(process.env.HOME, '.swarm-restore-points'),
      maxSnapshots: config.maxSnapshots || 50,
      autoSnapshotInterval: config.autoSnapshotInterval || 300000, // 5 minutes
      compressionEnabled: config.compressionEnabled !== false,
      encryptionEnabled: config.encryptionEnabled || false,
      encryptionKey: config.encryptionKey || this.generateKey(),
      retentionDays: config.retentionDays || 7
    };
    
    this.snapshots = new Map();
    this.currentSnapshot = null;
    this.autoSnapshotTimer = null;
    
    this.initialize();
  }

  async initialize() {
    // Create restore point directory structure
    await this.createDirectoryStructure();
    
    // Load existing snapshots
    await this.loadExistingSnapshots();
    
    // Start auto-snapshot if enabled
    if (this.config.autoSnapshotInterval > 0) {
      this.startAutoSnapshot();
    }
    
    console.log('✅ Restore Point System initialized');
    console.log(`📁 Restore points directory: ${this.config.baseDir}`);
    console.log(`🔄 Auto-snapshot every ${this.config.autoSnapshotInterval / 1000} seconds`);
  }

  async createDirectoryStructure() {
    const dirs = [
      this.config.baseDir,
      path.join(this.config.baseDir, 'snapshots'),
      path.join(this.config.baseDir, 'incremental'),
      path.join(this.config.baseDir, 'logs'),
      path.join(this.config.baseDir, 'temp')
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  async createRestorePoint(metadata = {}) {
    const snapshotId = this.generateSnapshotId();
    const timestamp = Date.now();
    
    console.log(`📸 Creating restore point: ${snapshotId}`);
    
    const snapshot = {
      id: snapshotId,
      timestamp,
      type: metadata.type || 'manual',
      description: metadata.description || 'Manual restore point',
      systemState: await this.captureSystemState(),
      agentStates: await this.captureAgentStates(),
      contextStates: await this.captureContextStates(),
      decisionHistory: await this.captureDecisionHistory(),
      resourceState: await this.captureResourceState(),
      metadata: {
        ...metadata,
        created: new Date(timestamp).toISOString(),
        size: 0,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled
      }
    };
    
    // Save snapshot
    const savedPath = await this.saveSnapshot(snapshot);
    snapshot.metadata.path = savedPath;
    snapshot.metadata.size = await this.getFileSize(savedPath);
    
    // Update snapshot index
    this.snapshots.set(snapshotId, snapshot.metadata);
    await this.updateSnapshotIndex();
    
    // Clean old snapshots
    await this.cleanOldSnapshots();
    
    this.currentSnapshot = snapshotId;
    
    console.log(`✅ Restore point created: ${snapshotId} (${this.formatSize(snapshot.metadata.size)})`);
    
    this.emit('snapshot:created', snapshot.metadata);
    
    return snapshotId;
  }

  async captureSystemState() {
    return {
      activeProcesses: await this.getActiveProcesses(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      environment: this.getSafeEnvironment(),
      configuration: await this.getSystemConfiguration()
    };
  }

  async captureAgentStates() {
    // Capture all agent states
    const agentStates = new Map();
    
    // This would integrate with your agent system
    const mockAgents = [
      { id: 'orchestrator-1', type: 'orchestrator', status: 'active', workload: 3 },
      { id: 'context-assembler-1', type: 'assembler', status: 'idle', workload: 0 },
      { id: 'analyzer-1', type: 'analyzer', status: 'processing', workload: 2 }
    ];
    
    for (const agent of mockAgents) {
      agentStates.set(agent.id, {
        ...agent,
        memory: Math.random() * 100000000, // Mock memory usage
        lastActivity: Date.now() - Math.random() * 60000,
        processedTasks: Math.floor(Math.random() * 100)
      });
    }
    
    return Array.from(agentStates.entries());
  }

  async captureContextStates() {
    // Capture all active contexts
    const contexts = [];
    
    // This would integrate with your context system
    const mockContexts = [
      { 
        taskId: 'task-001', 
        status: 'assembled', 
        size: 4096,
        components: ['history', 'objective', 'patterns']
      }
    ];
    
    return mockContexts;
  }

  async captureDecisionHistory() {
    // Capture recent decision history
    return {
      recentDecisions: [],
      votingPatterns: {},
      escalationHistory: []
    };
  }

  async captureResourceState() {
    return {
      cpu: await this.getCPUUsage(),
      memory: await this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      network: await this.getNetworkState()
    };
  }

  async saveSnapshot(snapshot) {
    const filename = `snapshot-${snapshot.id}.json`;
    const filepath = path.join(this.config.baseDir, 'snapshots', filename);
    
    let data = JSON.stringify(snapshot, null, 2);
    
    // Compress if enabled
    if (this.config.compressionEnabled) {
      data = await this.compress(data);
    }
    
    // Encrypt if enabled
    if (this.config.encryptionEnabled) {
      data = await this.encrypt(data);
    }
    
    await fs.writeFile(filepath, data);
    
    return filepath;
  }

  async restoreFromPoint(snapshotId) {
    console.log(`🔄 Restoring from snapshot: ${snapshotId}`);
    
    const snapshotMeta = this.snapshots.get(snapshotId);
    if (!snapshotMeta) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    // Load snapshot data
    const snapshot = await this.loadSnapshot(snapshotId);
    
    // Create pre-restore backup
    await this.createRestorePoint({
      type: 'pre-restore',
      description: `Pre-restore backup before restoring to ${snapshotId}`
    });
    
    try {
      // Restore system state
      await this.restoreSystemState(snapshot.systemState);
      
      // Restore agent states
      await this.restoreAgentStates(snapshot.agentStates);
      
      // Restore context states
      await this.restoreContextStates(snapshot.contextStates);
      
      // Restore decision history
      await this.restoreDecisionHistory(snapshot.decisionHistory);
      
      console.log(`✅ Successfully restored from snapshot: ${snapshotId}`);
      
      this.emit('snapshot:restored', {
        snapshotId,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      
      // Attempt to restore from pre-restore backup
      await this.emergencyRestore();
      
      throw error;
    }
  }

  async loadSnapshot(snapshotId) {
    const snapshotMeta = this.snapshots.get(snapshotId);
    let data = await fs.readFile(snapshotMeta.path);
    
    // Decrypt if needed
    if (snapshotMeta.encrypted) {
      data = await this.decrypt(data);
    }
    
    // Decompress if needed
    if (snapshotMeta.compressed) {
      data = await this.decompress(data);
    }
    
    return JSON.parse(data);
  }

  async restoreSystemState(systemState) {
    // Restore configuration
    if (systemState.configuration) {
      await this.applySystemConfiguration(systemState.configuration);
    }
    
    // Note: Some system states like memory/CPU can't be directly restored
    // but we can use them for validation
    console.log('📊 System state restored');
  }

  async restoreAgentStates(agentStates) {
    // Restore each agent
    for (const [agentId, state] of agentStates) {
      await this.restoreAgent(agentId, state);
    }
    
    console.log(`🤖 Restored ${agentStates.length} agents`);
  }

  async restoreAgent(agentId, state) {
    // This would integrate with your agent system
    // For now, we'll simulate the restoration
    console.log(`  → Restoring agent ${agentId} (${state.type})`);
  }

  async restoreContextStates(contextStates) {
    // Restore contexts
    for (const context of contextStates) {
      await this.restoreContext(context);
    }
    
    console.log(`📋 Restored ${contextStates.length} contexts`);
  }

  async restoreContext(context) {
    // This would integrate with your context system
    console.log(`  → Restoring context for task ${context.taskId}`);
  }

  async restoreDecisionHistory(decisionHistory) {
    // Restore decision history
    console.log('🗳️ Decision history restored');
  }

  async emergencyRestore() {
    console.log('🚨 Attempting emergency restore...');
    
    // Find the most recent pre-restore backup
    const preRestoreSnapshots = Array.from(this.snapshots.values())
      .filter(s => s.type === 'pre-restore')
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (preRestoreSnapshots.length > 0) {
      const latest = preRestoreSnapshots[0];
      await this.restoreFromPoint(latest.id);
      console.log('✅ Emergency restore completed');
    } else {
      console.error('❌ No pre-restore backup available');
    }
  }

  startAutoSnapshot() {
    this.autoSnapshotTimer = setInterval(async () => {
      try {
        await this.createRestorePoint({
          type: 'auto',
          description: 'Automatic snapshot'
        });
      } catch (error) {
        console.error('Auto-snapshot failed:', error);
      }
    }, this.config.autoSnapshotInterval);
    
    console.log('🔄 Auto-snapshot enabled');
  }

  stopAutoSnapshot() {
    if (this.autoSnapshotTimer) {
      clearInterval(this.autoSnapshotTimer);
      this.autoSnapshotTimer = null;
      console.log('🛑 Auto-snapshot disabled');
    }
  }

  async listSnapshots() {
    const snapshots = Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return snapshots.map(s => ({
      id: s.id,
      created: s.created,
      type: s.type,
      description: s.description,
      size: this.formatSize(s.size),
      age: this.getAge(s.timestamp)
    }));
  }

  async getSnapshotDetails(snapshotId) {
    const meta = this.snapshots.get(snapshotId);
    if (!meta) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    const snapshot = await this.loadSnapshot(snapshotId);
    
    return {
      metadata: meta,
      systemState: snapshot.systemState,
      agentCount: snapshot.agentStates.length,
      contextCount: snapshot.contextStates.length,
      decisionCount: snapshot.decisionHistory.recentDecisions?.length || 0
    };
  }

  async cleanOldSnapshots() {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const snapshotsToDelete = [];
    
    for (const [id, meta] of this.snapshots) {
      if (meta.timestamp < cutoffTime && meta.type === 'auto') {
        snapshotsToDelete.push(id);
      }
    }
    
    for (const id of snapshotsToDelete) {
      await this.deleteSnapshot(id);
    }
    
    // Also enforce max snapshots limit
    const sortedSnapshots = Array.from(this.snapshots.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    if (sortedSnapshots.length > this.config.maxSnapshots) {
      const toDelete = sortedSnapshots.slice(this.config.maxSnapshots);
      for (const [id] of toDelete) {
        if (this.snapshots.get(id).type === 'auto') {
          await this.deleteSnapshot(id);
        }
      }
    }
  }

  async deleteSnapshot(snapshotId) {
    const meta = this.snapshots.get(snapshotId);
    if (!meta) return;
    
    try {
      await fs.unlink(meta.path);
      this.snapshots.delete(snapshotId);
      await this.updateSnapshotIndex();
      
      console.log(`🗑️ Deleted snapshot: ${snapshotId}`);
    } catch (error) {
      console.error(`Failed to delete snapshot ${snapshotId}:`, error);
    }
  }

  async loadExistingSnapshots() {
    const indexPath = path.join(this.config.baseDir, 'snapshot-index.json');
    
    try {
      const data = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(data);
      
      for (const [id, meta] of Object.entries(index)) {
        this.snapshots.set(id, meta);
      }
      
      console.log(`📚 Loaded ${this.snapshots.size} existing snapshots`);
    } catch (error) {
      // No existing index, start fresh
      console.log('📚 Starting with fresh snapshot index');
    }
  }

  async updateSnapshotIndex() {
    const indexPath = path.join(this.config.baseDir, 'snapshot-index.json');
    const index = Object.fromEntries(this.snapshots);
    
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  generateSnapshotId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  // Utility methods
  async getActiveProcesses() {
    try {
      const { stdout } = await execAsync('ps aux | wc -l');
      return parseInt(stdout.trim()) - 1; // Subtract header line
    } catch {
      return 0;
    }
  }

  getSafeEnvironment() {
    const safe = {};
    const allowedKeys = ['NODE_ENV', 'PORT', 'HOME', 'USER'];
    
    for (const key of allowedKeys) {
      if (process.env[key]) {
        safe[key] = process.env[key];
      }
    }
    
    return safe;
  }

  async getSystemConfiguration() {
    // This would load your actual system configuration
    return {
      maxAgents: 20,
      maxContexts: 100,
      decisionThresholds: {
        operational: 0.6,
        tactical: 0.8,
        strategic: 0.9,
        critical: 0.95
      }
    };
  }

  async applySystemConfiguration(config) {
    // This would apply the configuration to your system
    console.log('  → Applying system configuration');
  }

  async getCPUUsage() {
    try {
      const { stdout } = await execAsync("top -l 1 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'");
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  async getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: used.rss,
      heapTotal: used.heapTotal,
      heapUsed: used.heapUsed,
      external: used.external
    };
  }

  async getDiskUsage() {
    try {
      const { stdout } = await execAsync("df -h . | tail -1 | awk '{print $5}' | sed 's/%//'");
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  async getNetworkState() {
    // Basic network state
    return {
      connections: 0,
      bandwidth: 0
    };
  }

  async getFileSize(filepath) {
    const stats = await fs.stat(filepath);
    return stats.size;
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  getAge(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  }

  // Compression/Encryption stubs (would use actual libraries in production)
  async compress(data) {
    // In production, use zlib or similar
    return Buffer.from(data);
  }

  async decompress(data) {
    // In production, use zlib or similar
    return data.toString();
  }

  async encrypt(data) {
    // In production, use crypto properly
    return data;
  }

  async decrypt(data) {
    // In production, use crypto properly
    return data;
  }
}

// Agent Failure Recovery
class AgentFailureRecovery extends EventEmitter {
  constructor(restoreSystem) {
    super();
    this.restoreSystem = restoreSystem;
    this.failureHistory = new Map();
    this.recoveryStrategies = {
      'restart': this.restartAgent,
      'restore': this.restoreAgent,
      'replace': this.replaceAgent,
      'failover': this.failoverAgent
    };
  }

  async handleAgentFailure(agentId, error) {
    console.log(`🚨 Agent failure detected: ${agentId}`);
    console.log(`   Error: ${error.message}`);
    
    // Record failure
    this.recordFailure(agentId, error);
    
    // Determine recovery strategy
    const strategy = this.determineStrategy(agentId);
    
    // Create restore point before recovery
    await this.restoreSystem.createRestorePoint({
      type: 'agent-failure',
      description: `Agent ${agentId} failed: ${error.message}`,
      failedAgent: agentId
    });
    
    // Execute recovery
    try {
      await this.recoveryStrategies[strategy].call(this, agentId, error);
      console.log(`✅ Agent ${agentId} recovered using ${strategy} strategy`);
      
      this.emit('agent:recovered', {
        agentId,
        strategy,
        timestamp: Date.now()
      });
    } catch (recoveryError) {
      console.error(`❌ Recovery failed for ${agentId}:`, recoveryError);
      
      // Escalate to system recovery
      await this.escalateToSystemRecovery(agentId, recoveryError);
    }
  }

  recordFailure(agentId, error) {
    if (!this.failureHistory.has(agentId)) {
      this.failureHistory.set(agentId, []);
    }
    
    this.failureHistory.get(agentId).push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack
    });
  }

  determineStrategy(agentId) {
    const failures = this.failureHistory.get(agentId) || [];
    const recentFailures = failures.filter(f => 
      Date.now() - f.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentFailures.length === 0) {
      return 'restart';
    } else if (recentFailures.length < 3) {
      return 'restore';
    } else if (recentFailures.length < 5) {
      return 'replace';
    } else {
      return 'failover';
    }
  }

  async restartAgent(agentId) {
    console.log(`  → Restarting agent ${agentId}`);
    // Implementation would restart the specific agent
  }

  async restoreAgent(agentId) {
    console.log(`  → Restoring agent ${agentId} from last known good state`);
    // Implementation would restore agent state from snapshot
  }

  async replaceAgent(agentId) {
    console.log(`  → Replacing agent ${agentId} with fresh instance`);
    // Implementation would spawn a new agent instance
  }

  async failoverAgent(agentId) {
    console.log(`  → Failing over agent ${agentId} tasks to redundant agents`);
    // Implementation would redistribute tasks to other agents
  }

  async escalateToSystemRecovery(agentId, error) {
    console.log(`🚨 Escalating to system recovery due to agent ${agentId} failure`);
    
    // Find recent healthy snapshot
    const snapshots = await this.restoreSystem.listSnapshots();
    const healthySnapshot = snapshots.find(s => 
      s.type === 'auto' && !s.description.includes('failure')
    );
    
    if (healthySnapshot) {
      await this.restoreSystem.restoreFromPoint(healthySnapshot.id);
    } else {
      console.error('❌ No healthy snapshot available for system recovery');
    }
  }
}

module.exports = {
  RestorePointSystem,
  AgentFailureRecovery
};

// Example usage
if (require.main === module) {
  const restoreSystem = new RestorePointSystem({
    autoSnapshotInterval: 60000, // 1 minute for demo
    maxSnapshots: 20,
    compressionEnabled: true
  });

  const agentRecovery = new AgentFailureRecovery(restoreSystem);

  // Simulate creating manual restore point
  setTimeout(async () => {
    const snapshotId = await restoreSystem.createRestorePoint({
      type: 'manual',
      description: 'System stable state checkpoint'
    });
    
    console.log(`\n📸 Created manual restore point: ${snapshotId}`);
    
    // List snapshots
    const snapshots = await restoreSystem.listSnapshots();
    console.log('\n📚 Available restore points:');
    snapshots.forEach(s => {
      console.log(`  - ${s.id}: ${s.description} (${s.age}, ${s.size})`);
    });
  }, 2000);

  // Simulate agent failure
  setTimeout(async () => {
    console.log('\n🔥 Simulating agent failure...');
    await agentRecovery.handleAgentFailure('context-assembler-1', new Error('Memory overflow'));
  }, 5000);
}