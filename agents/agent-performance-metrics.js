#!/usr/bin/env node
// agent-performance-metrics.js - Collect and analyze agent performance data

const Redis = require('ioredis');
const EventEmitter = require('events');

class AgentPerformanceMetrics extends EventEmitter {
    constructor() {
        super();
        
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379
        });
        
        // Metric storage keys
        this.KEYS = {
            AGENT_METRICS: 'tritons:metrics:agents:',
            TASK_METRICS: 'tritons:metrics:tasks:',
            SYSTEM_METRICS: 'tritons:metrics:system',
            HOURLY_STATS: 'tritons:metrics:hourly:',
            LEADERBOARD: 'tritons:metrics:leaderboard'
        };
        
        // In-memory cache for real-time metrics
        this.realtimeMetrics = {
            agents: new Map(),
            tasks: new Map(),
            system: {
                startTime: Date.now(),
                totalTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                totalApiCalls: 0,
                totalCost: 0
            }
        };
        
        // Performance thresholds
        this.thresholds = {
            responseTime: 200, // ms
            successRate: 0.95,
            maxLoad: 0.8,
            costPerTask: 0.10
        };
    }

    // Initialize metrics collection
    async init() {
        console.log('📊 Agent Performance Metrics Collector');
        console.log('====================================');
        
        try {
            await this.redis.ping();
            console.log('✅ Connected to Redis');
            
            // Start periodic metric aggregation
            this.startMetricAggregation();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            return true;
        } catch (err) {
            console.error('❌ Failed to initialize:', err.message);
            return false;
        }
    }

    // Record agent task start
    async recordTaskStart(agentId, taskId, taskType) {
        const timestamp = Date.now();
        
        // Update agent metrics
        if (!this.realtimeMetrics.agents.has(agentId)) {
            this.realtimeMetrics.agents.set(agentId, {
                id: agentId,
                tasksStarted: 0,
                tasksCompleted: 0,
                tasksFailed: 0,
                totalResponseTime: 0,
                apiCalls: 0,
                cost: 0,
                currentLoad: 0,
                lastActive: timestamp
            });
        }
        
        const agentMetrics = this.realtimeMetrics.agents.get(agentId);
        agentMetrics.tasksStarted++;
        agentMetrics.currentLoad = Math.min(1, agentMetrics.currentLoad + 0.1);
        agentMetrics.lastActive = timestamp;
        
        // Record task start
        this.realtimeMetrics.tasks.set(taskId, {
            id: taskId,
            agentId,
            type: taskType,
            startTime: timestamp,
            status: 'in_progress',
            apiCalls: 0,
            cost: 0
        });
        
        // Update Redis
        await this.redis.hset(
            `${this.KEYS.AGENT_METRICS}${agentId}`,
            'tasksStarted', agentMetrics.tasksStarted,
            'currentLoad', agentMetrics.currentLoad,
            'lastActive', timestamp
        );
        
        this.emit('taskStarted', { agentId, taskId, timestamp });
    }

    // Record agent task completion
    async recordTaskCompletion(agentId, taskId, success = true, metrics = {}) {
        const timestamp = Date.now();
        const taskMetrics = this.realtimeMetrics.tasks.get(taskId);
        
        if (!taskMetrics) {
            console.error(`Task ${taskId} not found in metrics`);
            return;
        }
        
        const responseTime = timestamp - taskMetrics.startTime;
        const agentMetrics = this.realtimeMetrics.agents.get(agentId);
        
        if (agentMetrics) {
            // Update agent metrics
            if (success) {
                agentMetrics.tasksCompleted++;
            } else {
                agentMetrics.tasksFailed++;
            }
            
            agentMetrics.totalResponseTime += responseTime;
            agentMetrics.apiCalls += metrics.apiCalls || 0;
            agentMetrics.cost += metrics.cost || 0;
            agentMetrics.currentLoad = Math.max(0, agentMetrics.currentLoad - 0.1);
            
            // Calculate success rate
            const totalTasks = agentMetrics.tasksCompleted + agentMetrics.tasksFailed;
            const successRate = totalTasks > 0 ? agentMetrics.tasksCompleted / totalTasks : 0;
            
            // Update Redis
            await this.redis.hmset(
                `${this.KEYS.AGENT_METRICS}${agentId}`,
                'tasksCompleted', agentMetrics.tasksCompleted,
                'tasksFailed', agentMetrics.tasksFailed,
                'totalResponseTime', agentMetrics.totalResponseTime,
                'apiCalls', agentMetrics.apiCalls,
                'cost', agentMetrics.cost.toFixed(2),
                'currentLoad', agentMetrics.currentLoad,
                'successRate', successRate.toFixed(3),
                'avgResponseTime', (agentMetrics.totalResponseTime / totalTasks).toFixed(0)
            );
        }
        
        // Update task metrics
        taskMetrics.status = success ? 'completed' : 'failed';
        taskMetrics.endTime = timestamp;
        taskMetrics.responseTime = responseTime;
        taskMetrics.apiCalls = metrics.apiCalls || 0;
        taskMetrics.cost = metrics.cost || 0;
        
        // Update system metrics
        this.realtimeMetrics.system.totalTasks++;
        if (success) {
            this.realtimeMetrics.system.completedTasks++;
        } else {
            this.realtimeMetrics.system.failedTasks++;
        }
        this.realtimeMetrics.system.totalApiCalls += metrics.apiCalls || 0;
        this.realtimeMetrics.system.totalCost += metrics.cost || 0;
        
        this.emit('taskCompleted', { 
            agentId, 
            taskId, 
            success, 
            responseTime, 
            metrics 
        });
        
        // Check performance thresholds
        this.checkPerformanceThresholds(agentId, agentMetrics);
    }

    // Record API call
    async recordApiCall(agentId, provider, success = true, cost = 0) {
        const agentMetrics = this.realtimeMetrics.agents.get(agentId);
        if (agentMetrics) {
            agentMetrics.apiCalls++;
            agentMetrics.cost += cost;
        }
        
        this.realtimeMetrics.system.totalApiCalls++;
        this.realtimeMetrics.system.totalCost += cost;
        
        // Track provider statistics
        const providerKey = `tritons:metrics:providers:${provider}`;
        await this.redis.hincrby(providerKey, success ? 'success' : 'failed', 1);
        await this.redis.hincrbyfloat(providerKey, 'totalCost', cost);
    }

    // Check performance thresholds
    checkPerformanceThresholds(agentId, metrics) {
        const warnings = [];
        
        // Check response time
        const avgResponseTime = metrics.totalResponseTime / 
            (metrics.tasksCompleted + metrics.tasksFailed);
        if (avgResponseTime > this.thresholds.responseTime) {
            warnings.push(`High response time: ${avgResponseTime.toFixed(0)}ms`);
        }
        
        // Check success rate
        const successRate = metrics.tasksCompleted / 
            (metrics.tasksCompleted + metrics.tasksFailed);
        if (successRate < this.thresholds.successRate) {
            warnings.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`);
        }
        
        // Check load
        if (metrics.currentLoad > this.thresholds.maxLoad) {
            warnings.push(`High load: ${(metrics.currentLoad * 100).toFixed(0)}%`);
        }
        
        // Check cost per task
        const costPerTask = metrics.cost / metrics.tasksCompleted;
        if (costPerTask > this.thresholds.costPerTask) {
            warnings.push(`High cost per task: $${costPerTask.toFixed(2)}`);
        }
        
        if (warnings.length > 0) {
            this.emit('performanceWarning', { agentId, warnings });
        }
    }

    // Get agent leaderboard
    async getAgentLeaderboard() {
        const agents = Array.from(this.realtimeMetrics.agents.values());
        
        // Calculate scores
        const leaderboard = agents.map(agent => {
            const totalTasks = agent.tasksCompleted + agent.tasksFailed;
            const successRate = totalTasks > 0 ? agent.tasksCompleted / totalTasks : 0;
            const avgResponseTime = totalTasks > 0 ? 
                agent.totalResponseTime / totalTasks : 0;
            const efficiency = totalTasks > 0 ? totalTasks / agent.cost : 0;
            
            // Composite score (weighted)
            const score = (
                successRate * 40 +                    // 40% weight on success rate
                (1 - avgResponseTime / 1000) * 30 +   // 30% weight on speed
                Math.min(efficiency / 10, 1) * 30     // 30% weight on cost efficiency
            );
            
            return {
                agentId: agent.id,
                score: score.toFixed(2),
                tasksCompleted: agent.tasksCompleted,
                successRate: (successRate * 100).toFixed(1),
                avgResponseTime: avgResponseTime.toFixed(0),
                costPerTask: (agent.cost / totalTasks).toFixed(2),
                currentLoad: (agent.currentLoad * 100).toFixed(0)
            };
        }).sort((a, b) => b.score - a.score);
        
        // Save to Redis
        await this.redis.set(
            this.KEYS.LEADERBOARD,
            JSON.stringify(leaderboard),
            'EX', 300 // 5 minute expiry
        );
        
        return leaderboard;
    }

    // Get system metrics summary
    async getSystemMetrics() {
        const uptime = Date.now() - this.realtimeMetrics.system.startTime;
        const totalTasks = this.realtimeMetrics.system.totalTasks;
        const completedTasks = this.realtimeMetrics.system.completedTasks;
        
        return {
            uptime: Math.floor(uptime / 1000), // seconds
            totalTasks,
            completedTasks,
            failedTasks: this.realtimeMetrics.system.failedTasks,
            successRate: totalTasks > 0 ? 
                (completedTasks / totalTasks * 100).toFixed(1) : 0,
            totalApiCalls: this.realtimeMetrics.system.totalApiCalls,
            totalCost: this.realtimeMetrics.system.totalCost.toFixed(2),
            avgCostPerTask: totalTasks > 0 ? 
                (this.realtimeMetrics.system.totalCost / totalTasks).toFixed(2) : 0,
            tasksPerHour: uptime > 0 ? 
                (completedTasks / (uptime / 3600000)).toFixed(2) : 0,
            activeAgents: this.realtimeMetrics.agents.size
        };
    }

    // Get dashboard data
    async getDashboardData() {
        const [systemMetrics, leaderboard] = await Promise.all([
            this.getSystemMetrics(),
            this.getAgentLeaderboard()
        ]);
        
        // Get active tasks
        const activeTasks = Array.from(this.realtimeMetrics.tasks.values())
            .filter(task => task.status === 'in_progress')
            .map(task => ({
                id: task.id,
                agentId: task.agentId,
                type: task.type,
                duration: Date.now() - task.startTime,
                apiCalls: task.apiCalls
            }));
        
        // Get agent status
        const agents = Array.from(this.realtimeMetrics.agents.values())
            .map(agent => ({
                id: agent.id,
                status: agent.currentLoad > 0 ? 'active' : 'idle',
                load: agent.currentLoad,
                tasksCompleted: agent.tasksCompleted,
                lastActive: agent.lastActive
            }));
        
        return {
            system: systemMetrics,
            leaderboard,
            activeTasks,
            agents,
            timestamp: new Date().toISOString()
        };
    }

    // Start metric aggregation
    startMetricAggregation() {
        // Aggregate metrics every minute
        setInterval(async () => {
            const hour = new Date().getHours();
            const key = `${this.KEYS.HOURLY_STATS}${hour}`;
            
            const systemMetrics = await this.getSystemMetrics();
            await this.redis.hmset(key, systemMetrics);
            await this.redis.expire(key, 86400); // 24 hour expiry
            
            console.log('📊 Hourly metrics aggregated');
        }, 60000);
    }

    // Start performance monitoring
    startPerformanceMonitoring() {
        // Monitor performance every 10 seconds
        setInterval(async () => {
            for (const [agentId, metrics] of this.realtimeMetrics.agents) {
                // Decay load for inactive agents
                const inactiveTime = Date.now() - metrics.lastActive;
                if (inactiveTime > 30000 && metrics.currentLoad > 0) {
                    metrics.currentLoad = Math.max(0, metrics.currentLoad - 0.05);
                }
                
                // Check thresholds
                this.checkPerformanceThresholds(agentId, metrics);
            }
        }, 10000);
    }
}

// Export for use in other modules
module.exports = AgentPerformanceMetrics;

// If run directly, start as service
if (require.main === module) {
    const metrics = new AgentPerformanceMetrics();
    
    (async () => {
        await metrics.init();
        
        // Listen for performance warnings
        metrics.on('performanceWarning', ({ agentId, warnings }) => {
            console.log(`⚠️  Performance warning for ${agentId}:`);
            warnings.forEach(w => console.log(`   - ${w}`));
        });
        
        // Example: Start HTTP server for metrics API
        const http = require('http');
        const server = http.createServer(async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            if (req.url === '/metrics') {
                const data = await metrics.getDashboardData();
                res.end(JSON.stringify(data, null, 2));
            } else if (req.url === '/leaderboard') {
                const data = await metrics.getAgentLeaderboard();
                res.end(JSON.stringify(data, null, 2));
            } else {
                res.statusCode = 404;
                res.end('Not found');
            }
        });
        
        server.listen(8083, () => {
            console.log('📊 Metrics API running on http://localhost:8083');
        });
        
        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down metrics collector...');
            await metrics.redis.quit();
            server.close();
            process.exit(0);
        });
    })();
}