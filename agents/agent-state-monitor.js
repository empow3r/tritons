#!/usr/bin/env node
// agent-state-monitor.js - Lightweight agent state persistence with auto-recovery

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const STATE_DIR = path.join(process.env.HOME, '.tritons', 'agent-states');
const CHECKPOINT_INTERVAL = 60000; // 1 minute
const MAX_STATE_FILES = 5; // Keep only last 5 states

// Global state tracking
let isProcessing = false;
let lastCheckpoint = Date.now();
let checkpointTimer = null;
let processMonitor = {};

// Agent state structure
class AgentState {
    constructor() {
        this.timestamp = new Date().toISOString();
        this.agents = {};
        this.activeTasks = [];
        this.completedTasks = [];
        this.systemHealth = {};
        this.lastActivity = {};
        this.processId = process.pid;
    }
}

// Initialize state directory
async function initStateDir() {
    try {
        await fs.mkdir(STATE_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create state directory:', err);
    }
}

// Lightweight state capture
async function captureAgentState() {
    const state = new AgentState();
    
    try {
        // Get active Node processes (TRITONS agents)
        const { stdout: psOutput } = await execPromise("ps aux | grep -E 'node.*tritons|multi-llm' | grep -v grep");
        const processes = psOutput.trim().split('\n').filter(Boolean);
        
        processes.forEach(proc => {
            const parts = proc.split(/\s+/);
            const pid = parts[1];
            const cpu = parts[2];
            const mem = parts[3];
            const cmd = parts.slice(10).join(' ');
            
            state.agents[pid] = {
                pid,
                cpu,
                memory: mem,
                command: cmd,
                started: parts[8]
            };
        });
        
        // Check Redis for active tasks (lightweight query)
        try {
            const { stdout: redisKeys } = await execPromise("redis-cli --scan --pattern 'task:*' 2>/dev/null | head -20");
            state.activeTasks = redisKeys.trim().split('\n').filter(Boolean);
        } catch (err) {
            // Redis might not be available
            state.activeTasks = [];
        }
        
        // System health check (minimal)
        state.systemHealth = {
            timestamp: Date.now(),
            activeAgents: Object.keys(state.agents).length,
            taskCount: state.activeTasks.length,
            isProcessing: isProcessing
        };
        
        // Save process monitor state
        state.processMonitor = processMonitor;
        
    } catch (err) {
        console.error('Error capturing state:', err.message);
    }
    
    return state;
}

// Save state to file (optimized for speed)
async function saveState(state) {
    const filename = `state_${Date.now()}.json`;
    const filepath = path.join(STATE_DIR, filename);
    
    try {
        // Write atomically to prevent corruption
        const tempFile = filepath + '.tmp';
        await fs.writeFile(tempFile, JSON.stringify(state, null, 2));
        await fs.rename(tempFile, filepath);
        
        // Create latest symlink for quick access
        const latestLink = path.join(STATE_DIR, 'latest.json');
        try {
            await fs.unlink(latestLink);
        } catch (err) {}
        await fs.symlink(filename, latestLink);
        
        // Cleanup old states
        await cleanupOldStates();
        
        return filepath;
    } catch (err) {
        console.error('Failed to save state:', err);
        return null;
    }
}

// Cleanup old state files
async function cleanupOldStates() {
    try {
        const files = await fs.readdir(STATE_DIR);
        const stateFiles = files
            .filter(f => f.startsWith('state_') && f.endsWith('.json'))
            .sort()
            .reverse();
        
        // Remove old files
        for (let i = MAX_STATE_FILES; i < stateFiles.length; i++) {
            await fs.unlink(path.join(STATE_DIR, stateFiles[i]));
        }
    } catch (err) {
        // Ignore cleanup errors
    }
}

// Process-aware checkpoint
async function checkpoint() {
    // Skip if in the middle of processing
    if (isProcessing) {
        console.log('⏸️  Checkpoint delayed - agent processing');
        return;
    }
    
    const state = await captureAgentState();
    const saved = await saveState(state);
    
    if (saved) {
        lastCheckpoint = Date.now();
        console.log(`✅ State checkpoint saved: ${path.basename(saved)}`);
    }
}

// Mark processing state
function setProcessing(status) {
    isProcessing = status;
    
    // If processing just finished, do immediate checkpoint
    if (!status && Date.now() - lastCheckpoint > 30000) {
        checkpoint();
    }
}

// Fast state recovery
async function recoverLatestState() {
    const latestPath = path.join(STATE_DIR, 'latest.json');
    
    try {
        const stateData = await fs.readFile(latestPath, 'utf8');
        const state = JSON.parse(stateData);
        
        console.log('🔄 Recovering from state:', state.timestamp);
        console.log(`  Active agents: ${Object.keys(state.agents).length}`);
        console.log(`  Active tasks: ${state.activeTasks.length}`);
        
        // Restore process monitor state
        if (state.processMonitor) {
            processMonitor = state.processMonitor;
        }
        
        return state;
    } catch (err) {
        console.error('No previous state to recover');
        return null;
    }
}

// Monitor integration hooks
const stateMonitor = {
    // Call when starting a task
    startTask: (taskId, description) => {
        setProcessing(true);
        processMonitor[taskId] = {
            started: Date.now(),
            description,
            status: 'active'
        };
    },
    
    // Call when completing a task
    completeTask: (taskId) => {
        if (processMonitor[taskId]) {
            processMonitor[taskId].status = 'completed';
            processMonitor[taskId].completed = Date.now();
        }
        
        // Check if any tasks still active
        const activeTasks = Object.values(processMonitor)
            .filter(t => t.status === 'active').length;
        
        if (activeTasks === 0) {
            setProcessing(false);
        }
    },
    
    // Force checkpoint
    forceCheckpoint: () => {
        return checkpoint();
    },
    
    // Get current state
    getCurrentState: async () => {
        return await captureAgentState();
    },
    
    // Recover state
    recover: async () => {
        return await recoverLatestState();
    }
};

// Start monitoring if run directly
if (require.main === module) {
    console.log('🔍 Agent State Monitor Started');
    console.log(`📁 State directory: ${STATE_DIR}`);
    console.log(`⏰ Checkpoint interval: ${CHECKPOINT_INTERVAL / 1000}s`);
    
    // Initialize
    initStateDir();
    
    // Initial checkpoint
    checkpoint();
    
    // Set up interval
    checkpointTimer = setInterval(() => {
        checkpoint();
    }, CHECKPOINT_INTERVAL);
    
    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down monitor...');
        clearInterval(checkpointTimer);
        await checkpoint(); // Final checkpoint
        process.exit(0);
    });
    
    // Keep process alive
    process.stdin.resume();
}

// Export for use in other modules
module.exports = stateMonitor;