#!/usr/bin/env node
// redis-recovery-integration.js - Lightweight Redis-based recovery for TRITONS

const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000)
};

// Redis key patterns
const KEYS = {
    SESSION_STATE: 'tritons:session:state',
    AGENT_PREFIX: 'tritons:agent:',
    TASK_PREFIX: 'tritons:task:',
    CHECKPOINT: 'tritons:checkpoint:latest',
    RECOVERY_LOCK: 'tritons:recovery:lock'
};

class RedisRecovery {
    constructor() {
        this.redis = new Redis(REDIS_CONFIG);
        this.sessionId = `session_${Date.now()}`;
        this.checkpointInterval = null;
    }

    // Initialize recovery system
    async init() {
        try {
            await this.redis.ping();
            console.log('✅ Redis recovery system connected');
            
            // Start automatic checkpointing
            this.startAutoCheckpoint();
            
            return true;
        } catch (err) {
            console.error('❌ Redis connection failed:', err.message);
            return false;
        }
    }

    // Save minimal state to Redis every minute
    async saveState(state) {
        const minimalState = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            activeAgents: state.activeAgents || [],
            activeTasks: state.activeTasks || [],
            completedTasks: state.completedTasks || [],
            lastActivity: state.lastActivity || Date.now(),
            processId: process.pid
        };

        try {
            // Save state with 2-hour expiry
            await this.redis.setex(
                KEYS.SESSION_STATE,
                7200,
                JSON.stringify(minimalState)
            );

            // Update checkpoint
            await this.redis.set(
                KEYS.CHECKPOINT,
                JSON.stringify({
                    timestamp: Date.now(),
                    sessionId: this.sessionId
                })
            );

            return true;
        } catch (err) {
            console.error('Failed to save state to Redis:', err.message);
            return false;
        }
    }

    // Quick state recovery
    async recoverState() {
        try {
            // Check for recovery lock
            const lock = await this.redis.get(KEYS.RECOVERY_LOCK);
            if (lock) {
                console.log('⚠️  Recovery already in progress');
                return null;
            }

            // Set recovery lock (5 second expiry)
            await this.redis.setex(KEYS.RECOVERY_LOCK, 5, '1');

            // Get last state
            const stateStr = await this.redis.get(KEYS.SESSION_STATE);
            if (!stateStr) {
                console.log('No previous state found in Redis');
                return null;
            }

            const state = JSON.parse(stateStr);
            console.log(`🔄 Recovering session: ${state.sessionId}`);
            console.log(`  Last activity: ${new Date(state.lastActivity).toISOString()}`);
            console.log(`  Active agents: ${state.activeAgents.length}`);
            console.log(`  Active tasks: ${state.activeTasks.length}`);

            // Remove recovery lock
            await this.redis.del(KEYS.RECOVERY_LOCK);

            return state;
        } catch (err) {
            console.error('Recovery failed:', err.message);
            await this.redis.del(KEYS.RECOVERY_LOCK);
            return null;
        }
    }

    // Register agent activity
    async registerAgent(agentId, status = 'active') {
        const key = `${KEYS.AGENT_PREFIX}${agentId}`;
        await this.redis.setex(key, 300, JSON.stringify({
            id: agentId,
            status,
            lastSeen: Date.now()
        }));
    }

    // Register task
    async registerTask(taskId, data) {
        const key = `${KEYS.TASK_PREFIX}${taskId}`;
        await this.redis.setex(key, 3600, JSON.stringify({
            id: taskId,
            ...data,
            timestamp: Date.now()
        }));
    }

    // Get active agents
    async getActiveAgents() {
        const keys = await this.redis.keys(`${KEYS.AGENT_PREFIX}*`);
        const agents = [];
        
        for (const key of keys) {
            try {
                const data = await this.redis.get(key);
                if (data) agents.push(JSON.parse(data));
            } catch (err) {}
        }
        
        return agents;
    }

    // Get active tasks
    async getActiveTasks() {
        const keys = await this.redis.keys(`${KEYS.TASK_PREFIX}*`);
        const tasks = [];
        
        for (const key of keys.slice(0, 50)) { // Limit to 50 for performance
            try {
                const data = await this.redis.get(key);
                if (data) tasks.push(JSON.parse(data));
            } catch (err) {}
        }
        
        return tasks;
    }

    // Start automatic checkpointing
    startAutoCheckpoint() {
        // Clear existing interval
        if (this.checkpointInterval) {
            clearInterval(this.checkpointInterval);
        }

        // Checkpoint every minute
        this.checkpointInterval = setInterval(async () => {
            if (!global.isProcessing) { // Only checkpoint when not processing
                const agents = await this.getActiveAgents();
                const tasks = await this.getActiveTasks();
                
                await this.saveState({
                    activeAgents: agents,
                    activeTasks: tasks,
                    lastActivity: Date.now()
                });
            }
        }, 60000);

        console.log('⏰ Auto-checkpoint enabled (1 minute interval)');
    }

    // Stop checkpointing
    stopAutoCheckpoint() {
        if (this.checkpointInterval) {
            clearInterval(this.checkpointInterval);
            this.checkpointInterval = null;
        }
    }

    // Clean shutdown
    async shutdown() {
        this.stopAutoCheckpoint();
        await this.redis.quit();
        console.log('Redis recovery system shutdown');
    }
}

// Integration with existing TRITONS system
const redisRecovery = new RedisRecovery();

// Export recovery functions for integration
module.exports = {
    // Initialize recovery
    init: () => redisRecovery.init(),
    
    // Save current state
    checkpoint: async (state) => {
        return await redisRecovery.saveState(state);
    },
    
    // Recover last state
    recover: async () => {
        return await redisRecovery.recoverState();
    },
    
    // Register agent/task activity
    registerAgent: (id, status) => redisRecovery.registerAgent(id, status),
    registerTask: (id, data) => redisRecovery.registerTask(id, data),
    
    // Get current state
    getState: async () => {
        return {
            agents: await redisRecovery.getActiveAgents(),
            tasks: await redisRecovery.getActiveTasks()
        };
    },
    
    // Shutdown
    shutdown: () => redisRecovery.shutdown()
};

// If run directly, start monitoring
if (require.main === module) {
    (async () => {
        console.log('🔄 Redis Recovery System');
        console.log('=======================');
        
        // Initialize
        const connected = await redisRecovery.init();
        if (!connected) {
            console.error('Failed to connect to Redis');
            process.exit(1);
        }
        
        // Try to recover previous state
        const recovered = await redisRecovery.recoverState();
        if (recovered) {
            console.log('✅ Previous state recovered');
        } else {
            console.log('📝 Starting fresh session');
        }
        
        // Monitor for shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down...');
            await redisRecovery.shutdown();
            process.exit(0);
        });
        
        // Keep alive
        process.stdin.resume();
    })();
}