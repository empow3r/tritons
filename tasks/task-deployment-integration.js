#!/usr/bin/env node
// task-deployment-integration.js - Integrates task deployment with existing dashboard

const http = require('http');
const Redis = require('ioredis');
const TaskDeploymentAgent = require('./task-deploy-agent');
const TaskDependencyResolver = require('./task-dependency-resolver');
const AgentPerformanceMetrics = require('./agent-performance-metrics');

class TaskDeploymentIntegration {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379
        });
        
        this.deploymentAgent = new TaskDeploymentAgent();
        this.dependencyResolver = new TaskDependencyResolver();
        this.performanceMetrics = new AgentPerformanceMetrics();
        
        this.port = 8084; // Task deployment API port
        this.keyManagerUrl = 'http://localhost:8082'; // Smart key server
        this.dashboardApiUrl = 'http://localhost:3002'; // Existing dashboard API
    }

    async init() {
        console.log('🔧 Task Deployment Integration Service');
        console.log('=====================================\n');
        
        try {
            // Initialize components
            await this.deploymentAgent.init();
            await this.performanceMetrics.init();
            
            // Connect to existing services
            await this.connectToKeyManager();
            await this.connectToDashboard();
            
            // Start API server
            this.startApiServer();
            
            console.log('✅ Integration service ready\n');
            return true;
        } catch (err) {
            console.error('❌ Failed to initialize:', err.message);
            return false;
        }
    }

    // Connect to smart key manager
    async connectToKeyManager() {
        try {
            const response = await fetch(`${this.keyManagerUrl}/api/keys`);
            if (response.ok) {
                const keys = await response.json();
                console.log(`✅ Connected to key manager - ${Object.keys(keys).length} providers available`);
                
                // Store available providers for agent selection
                this.availableProviders = Object.keys(keys);
            }
        } catch (err) {
            console.log('⚠️  Key manager not available - using environment keys');
        }
    }

    // Connect to existing dashboard API
    async connectToDashboard() {
        try {
            const response = await fetch(`${this.dashboardApiUrl}/api/dashboard`);
            if (response.ok) {
                console.log('✅ Connected to dashboard API');
                this.dashboardConnected = true;
            }
        } catch (err) {
            console.log('⚠️  Dashboard API not available');
            this.dashboardConnected = false;
        }
    }

    // Get enhanced dashboard data
    async getEnhancedDashboardData() {
        const baseData = await this.performanceMetrics.getDashboardData();
        
        // Add task deployment specific data
        const taskQueue = await this.redis.zrange('tritons:tasks:queue', 0, -1, 'WITHSCORES');
        const queuedTasks = [];
        
        for (let i = 0; i < taskQueue.length; i += 2) {
            try {
                const task = JSON.parse(taskQueue[i]);
                queuedTasks.push({
                    ...task,
                    priority_score: taskQueue[i + 1]
                });
            } catch (err) {}
        }
        
        // Get dependency graph
        const dependencyGraph = this.dependencyResolver.getGraphData();
        
        // Get task statistics
        const taskStats = this.dependencyResolver.getStatistics();
        
        // Combine with existing dashboard data if available
        let existingDashboardData = null;
        if (this.dashboardConnected) {
            try {
                const response = await fetch(`${this.dashboardApiUrl}/api/dashboard`);
                if (response.ok) {
                    existingDashboardData = await response.json();
                }
            } catch (err) {}
        }
        
        return {
            ...baseData,
            taskDeployment: {
                queue: queuedTasks,
                dependencies: dependencyGraph,
                statistics: taskStats,
                providers: this.availableProviders || []
            },
            existingDashboard: existingDashboardData,
            integrated: true,
            timestamp: new Date().toISOString()
        };
    }

    // Start API server
    startApiServer() {
        const server = http.createServer(async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            if (req.method === 'OPTIONS') {
                res.statusCode = 200;
                res.end();
                return;
            }
            
            const parsedUrl = new URL(req.url, `http://localhost:${this.port}`);
            const pathname = parsedUrl.pathname;
            
            try {
                // Enhanced dashboard endpoint
                if (pathname === '/api/dashboard/enhanced' && req.method === 'GET') {
                    const data = await this.getEnhancedDashboardData();
                    res.end(JSON.stringify(data, null, 2));
                }
                
                // Task submission endpoint
                else if (pathname === '/api/tasks/submit' && req.method === 'POST') {
                    const body = await this.parseBody(req);
                    const task = JSON.parse(body);
                    
                    // Add task with dependencies if specified
                    if (task.dependencies) {
                        this.dependencyResolver.addTask(task.id, task.dependencies, task);
                    }
                    
                    // Queue task
                    await this.deploymentAgent.queueTask(task);
                    
                    res.end(JSON.stringify({ 
                        success: true, 
                        taskId: task.id,
                        message: 'Task queued successfully'
                    }));
                }
                
                // Task dependencies endpoint
                else if (pathname === '/api/tasks/dependencies' && req.method === 'GET') {
                    const graph = this.dependencyResolver.getGraphData();
                    res.end(JSON.stringify(graph, null, 2));
                }
                
                // Available tasks endpoint
                else if (pathname === '/api/tasks/available' && req.method === 'GET') {
                    const available = this.dependencyResolver.getAvailableTasks();
                    res.end(JSON.stringify(available, null, 2));
                }
                
                // Task status endpoint
                else if (pathname.startsWith('/api/tasks/') && req.method === 'GET') {
                    const taskId = pathname.split('/')[3];
                    const status = await this.redis.hgetall(`tritons:tasks:status:${taskId}`);
                    res.end(JSON.stringify(status, null, 2));
                }
                
                // Complete task endpoint
                else if (pathname === '/api/tasks/complete' && req.method === 'POST') {
                    const body = await this.parseBody(req);
                    const { taskId, success, metrics } = JSON.parse(body);
                    
                    // Update dependency resolver
                    const newTasks = this.dependencyResolver.completeTask(taskId, success);
                    
                    // Record performance metrics
                    if (metrics) {
                        await this.performanceMetrics.recordTaskCompletion(
                            metrics.agentId || 'unknown',
                            taskId,
                            success,
                            metrics
                        );
                    }
                    
                    res.end(JSON.stringify({ 
                        success: true, 
                        newAvailableTasks: newTasks 
                    }));
                }
                
                // Provider status endpoint
                else if (pathname === '/api/providers' && req.method === 'GET') {
                    const providers = await this.getProviderStatus();
                    res.end(JSON.stringify(providers, null, 2));
                }
                
                else {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
                
            } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        
        server.listen(this.port, () => {
            console.log(`📡 Task Deployment API running on http://localhost:${this.port}`);
            console.log('📊 Enhanced dashboard: http://localhost:8084/api/dashboard/enhanced');
        });
        
        this.server = server;
    }

    // Get provider status from key manager
    async getProviderStatus() {
        try {
            const response = await fetch(`${this.keyManagerUrl}/api/keys`);
            if (response.ok) {
                const keys = await response.json();
                
                // Get provider metrics from Redis
                const providerStatus = {};
                for (const provider of Object.keys(keys)) {
                    const metrics = await this.redis.hgetall(`tritons:metrics:providers:${provider}`);
                    providerStatus[provider] = {
                        available: true,
                        hasKey: true,
                        ...metrics
                    };
                }
                
                return providerStatus;
            }
        } catch (err) {
            return { error: 'Key manager not available' };
        }
    }

    // Parse request body
    parseBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    // Shutdown
    async shutdown() {
        console.log('\n🛑 Shutting down integration service...');
        if (this.server) this.server.close();
        await this.redis.quit();
    }
}

// Start service
if (require.main === module) {
    const integration = new TaskDeploymentIntegration();
    
    (async () => {
        await integration.init();
        
        // Handle shutdown
        process.on('SIGINT', async () => {
            await integration.shutdown();
            process.exit(0);
        });
    })();
}

module.exports = TaskDeploymentIntegration;