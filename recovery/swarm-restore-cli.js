#!/usr/bin/env node
// swarm-restore-cli.js - CLI for managing restore points

const { RestorePointSystem, AgentFailureRecovery } = require('./restore-point-system');
const readline = require('readline');
const { promisify } = require('util');

class RestoreCLI {
  constructor() {
    this.restoreSystem = new RestorePointSystem({
      autoSnapshotInterval: 300000, // 5 minutes
      maxSnapshots: 50,
      compressionEnabled: true,
      retentionDays: 7
    });
    
    this.agentRecovery = new AgentFailureRecovery(this.restoreSystem);
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'swarm-restore> '
    });
    
    this.commands = {
      'help': this.showHelp,
      'create': this.createSnapshot,
      'list': this.listSnapshots,
      'restore': this.restoreSnapshot,
      'delete': this.deleteSnapshot,
      'info': this.showSnapshotInfo,
      'auto': this.toggleAutoSnapshot,
      'status': this.showStatus,
      'test-failure': this.testAgentFailure,
      'export': this.exportSnapshot,
      'import': this.importSnapshot,
      'verify': this.verifySnapshot,
      'compare': this.compareSnapshots,
      'exit': this.exit
    };
  }

  async start() {
    console.log('🔄 Swarm Restore Point System CLI');
    console.log('================================');
    console.log('Type "help" for available commands\n');
    
    this.rl.prompt();
    
    this.rl.on('line', async (line) => {
      const [cmd, ...args] = line.trim().split(' ');
      
      if (this.commands[cmd]) {
        try {
          await this.commands[cmd].call(this, args);
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
        }
      } else if (cmd) {
        console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
      }
      
      this.rl.prompt();
    });
    
    this.rl.on('close', () => {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });
  }

  async showHelp() {
    console.log(`
Available Commands:
==================

📸 Snapshot Management:
  create [description]     Create a manual restore point
  list                    List all available restore points
  restore <snapshot-id>   Restore system to specific snapshot
  delete <snapshot-id>    Delete a specific snapshot
  info <snapshot-id>      Show detailed information about a snapshot

🔄 Auto-Snapshot:
  auto on|off            Enable/disable automatic snapshots
  auto status            Show auto-snapshot status

📊 System:
  status                 Show system restore status
  verify <snapshot-id>   Verify snapshot integrity
  compare <id1> <id2>    Compare two snapshots

🧪 Testing:
  test-failure           Simulate agent failure and recovery

📦 Import/Export:
  export <snapshot-id>   Export snapshot to file
  import <file>          Import snapshot from file

🚪 Exit:
  exit                   Exit the CLI
`);
  }

  async createSnapshot(args) {
    const description = args.join(' ') || 'Manual snapshot';
    
    console.log('📸 Creating restore point...');
    const snapshotId = await this.restoreSystem.createRestorePoint({
      type: 'manual',
      description
    });
    
    console.log(`✅ Restore point created: ${snapshotId}`);
  }

  async listSnapshots() {
    const snapshots = await this.restoreSystem.listSnapshots();
    
    if (snapshots.length === 0) {
      console.log('No snapshots available.');
      return;
    }
    
    console.log('\n📚 Available Restore Points:');
    console.log('===========================\n');
    
    // Group by type
    const grouped = {
      manual: [],
      auto: [],
      'pre-restore': [],
      'agent-failure': []
    };
    
    snapshots.forEach(s => {
      const type = s.type || 'manual';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(s);
    });
    
    // Display each group
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      
      console.log(`${this.getTypeIcon(type)} ${type.toUpperCase()} (${items.length}):`);
      items.forEach(s => {
        console.log(`  ${s.id}`);
        console.log(`    📝 ${s.description}`);
        console.log(`    📅 ${s.created} (${s.age})`);
        console.log(`    💾 Size: ${s.size}`);
        console.log('');
      });
    }
  }

  getTypeIcon(type) {
    const icons = {
      'manual': '👤',
      'auto': '🔄',
      'pre-restore': '🛡️',
      'agent-failure': '🚨'
    };
    return icons[type] || '📸';
  }

  async restoreSnapshot(args) {
    const snapshotId = args[0];
    
    if (!snapshotId) {
      console.log('Usage: restore <snapshot-id>');
      return;
    }
    
    // Confirm restoration
    const answer = await this.confirm(
      `⚠️  Are you sure you want to restore from snapshot ${snapshotId}? This will overwrite current state.`
    );
    
    if (!answer) {
      console.log('Restoration cancelled.');
      return;
    }
    
    console.log('🔄 Starting restoration...');
    
    try {
      await this.restoreSystem.restoreFromPoint(snapshotId);
      console.log('✅ System restored successfully!');
    } catch (error) {
      console.error(`❌ Restoration failed: ${error.message}`);
    }
  }

  async deleteSnapshot(args) {
    const snapshotId = args[0];
    
    if (!snapshotId) {
      console.log('Usage: delete <snapshot-id>');
      return;
    }
    
    const answer = await this.confirm(
      `⚠️  Are you sure you want to delete snapshot ${snapshotId}?`
    );
    
    if (!answer) {
      console.log('Deletion cancelled.');
      return;
    }
    
    await this.restoreSystem.deleteSnapshot(snapshotId);
    console.log('✅ Snapshot deleted.');
  }

  async showSnapshotInfo(args) {
    const snapshotId = args[0];
    
    if (!snapshotId) {
      console.log('Usage: info <snapshot-id>');
      return;
    }
    
    const details = await this.restoreSystem.getSnapshotDetails(snapshotId);
    
    console.log('\n📋 Snapshot Details:');
    console.log('==================\n');
    console.log(`ID: ${details.metadata.id}`);
    console.log(`Type: ${details.metadata.type}`);
    console.log(`Created: ${details.metadata.created}`);
    console.log(`Description: ${details.metadata.description}`);
    console.log(`Size: ${this.restoreSystem.formatSize(details.metadata.size)}`);
    console.log(`Compressed: ${details.metadata.compressed ? 'Yes' : 'No'}`);
    console.log(`Encrypted: ${details.metadata.encrypted ? 'Yes' : 'No'}`);
    console.log('\n📊 Contents:');
    console.log(`  Agents: ${details.agentCount}`);
    console.log(`  Contexts: ${details.contextCount}`);
    console.log(`  Decisions: ${details.decisionCount}`);
    console.log('\n💻 System State:');
    console.log(`  Uptime: ${Math.floor(details.systemState.uptime / 60)} minutes`);
    console.log(`  Memory: ${this.restoreSystem.formatSize(details.systemState.memoryUsage.heapUsed)}`);
    console.log(`  Active Processes: ${details.systemState.activeProcesses}`);
  }

  async toggleAutoSnapshot(args) {
    const action = args[0];
    
    if (action === 'on') {
      this.restoreSystem.startAutoSnapshot();
      console.log('✅ Auto-snapshot enabled');
    } else if (action === 'off') {
      this.restoreSystem.stopAutoSnapshot();
      console.log('🛑 Auto-snapshot disabled');
    } else if (action === 'status') {
      const enabled = this.restoreSystem.autoSnapshotTimer !== null;
      console.log(`Auto-snapshot: ${enabled ? '✅ Enabled' : '🛑 Disabled'}`);
      if (enabled) {
        console.log(`Interval: Every ${this.restoreSystem.config.autoSnapshotInterval / 60000} minutes`);
      }
    } else {
      console.log('Usage: auto on|off|status');
    }
  }

  async showStatus() {
    console.log('\n📊 Restore System Status:');
    console.log('=======================\n');
    
    const snapshots = await this.restoreSystem.listSnapshots();
    const typeCount = {};
    
    snapshots.forEach(s => {
      typeCount[s.type] = (typeCount[s.type] || 0) + 1;
    });
    
    console.log(`Total Snapshots: ${snapshots.length}/${this.restoreSystem.config.maxSnapshots}`);
    console.log(`Retention Period: ${this.restoreSystem.config.retentionDays} days`);
    console.log(`Compression: ${this.restoreSystem.config.compressionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Encryption: ${this.restoreSystem.config.encryptionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Auto-snapshot: ${this.restoreSystem.autoSnapshotTimer ? 'Enabled' : 'Disabled'}`);
    
    console.log('\n📸 Snapshot Types:');
    for (const [type, count] of Object.entries(typeCount)) {
      console.log(`  ${this.getTypeIcon(type)} ${type}: ${count}`);
    }
    
    if (this.restoreSystem.currentSnapshot) {
      console.log(`\n🎯 Current Snapshot: ${this.restoreSystem.currentSnapshot}`);
    }
    
    // Calculate total size
    let totalSize = 0;
    for (const s of snapshots) {
      const sizeMatch = s.size.match(/(\d+\.?\d*)\s*(\w+)/);
      if (sizeMatch) {
        const [, num, unit] = sizeMatch;
        const multipliers = { B: 1, KB: 1024, MB: 1024*1024, GB: 1024*1024*1024 };
        totalSize += parseFloat(num) * (multipliers[unit] || 1);
      }
    }
    
    console.log(`\n💾 Total Storage: ${this.restoreSystem.formatSize(totalSize)}`);
  }

  async testAgentFailure() {
    console.log('🧪 Simulating agent failure...\n');
    
    const agents = ['context-assembler-1', 'analyzer-2', 'orchestrator-1'];
    const errors = [
      'Memory overflow',
      'Timeout exceeded',
      'Connection lost',
      'Invalid state'
    ];
    
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const error = errors[Math.floor(Math.random() * errors.length)];
    
    console.log(`💥 Agent ${agent} failed with: ${error}`);
    
    await this.agentRecovery.handleAgentFailure(agent, new Error(error));
  }

  async verifySnapshot(args) {
    const snapshotId = args[0];
    
    if (!snapshotId) {
      console.log('Usage: verify <snapshot-id>');
      return;
    }
    
    console.log(`🔍 Verifying snapshot ${snapshotId}...`);
    
    try {
      const snapshot = await this.restoreSystem.loadSnapshot(snapshotId);
      
      const checks = {
        'Structure intact': !!snapshot.systemState && !!snapshot.agentStates,
        'Agent states valid': Array.isArray(snapshot.agentStates),
        'Context states valid': Array.isArray(snapshot.contextStates),
        'Metadata present': !!snapshot.metadata,
        'Timestamp valid': !!snapshot.timestamp && snapshot.timestamp > 0
      };
      
      console.log('\n✅ Verification Results:');
      for (const [check, passed] of Object.entries(checks)) {
        console.log(`  ${passed ? '✓' : '✗'} ${check}`);
      }
      
      const allPassed = Object.values(checks).every(v => v);
      console.log(`\n${allPassed ? '✅ Snapshot is valid' : '❌ Snapshot has issues'}`);
      
    } catch (error) {
      console.error(`❌ Verification failed: ${error.message}`);
    }
  }

  async compareSnapshots(args) {
    const [id1, id2] = args;
    
    if (!id1 || !id2) {
      console.log('Usage: compare <snapshot-id-1> <snapshot-id-2>');
      return;
    }
    
    console.log(`🔍 Comparing snapshots...\n`);
    
    try {
      const details1 = await this.restoreSystem.getSnapshotDetails(id1);
      const details2 = await this.restoreSystem.getSnapshotDetails(id2);
      
      console.log('📊 Comparison Results:');
      console.log('====================\n');
      
      // Time difference
      const timeDiff = Math.abs(details1.metadata.timestamp - details2.metadata.timestamp);
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`⏱️  Time Difference: ${hours}h ${minutes}m`);
      console.log(`📦 Size Difference: ${details1.metadata.size} vs ${details2.metadata.size}`);
      console.log(`🤖 Agent Count: ${details1.agentCount} vs ${details2.agentCount}`);
      console.log(`📋 Context Count: ${details1.contextCount} vs ${details2.contextCount}`);
      console.log(`🗳️  Decision Count: ${details1.decisionCount} vs ${details2.decisionCount}`);
      
    } catch (error) {
      console.error(`❌ Comparison failed: ${error.message}`);
    }
  }

  async exportSnapshot(args) {
    const snapshotId = args[0];
    
    if (!snapshotId) {
      console.log('Usage: export <snapshot-id>');
      return;
    }
    
    console.log(`📦 Exporting snapshot ${snapshotId}...`);
    // Implementation would export to external file
    console.log('✅ Export feature coming soon!');
  }

  async importSnapshot(args) {
    const file = args[0];
    
    if (!file) {
      console.log('Usage: import <file>');
      return;
    }
    
    console.log(`📦 Importing snapshot from ${file}...`);
    // Implementation would import from external file
    console.log('✅ Import feature coming soon!');
  }

  async confirm(question) {
    return new Promise((resolve) => {
      this.rl.question(`${question} (y/n) `, (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  async exit() {
    const answer = await this.confirm('Are you sure you want to exit?');
    
    if (answer) {
      this.rl.close();
    }
  }
}

// Start CLI
const cli = new RestoreCLI();
cli.start();