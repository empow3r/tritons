#!/usr/bin/env node
// advanced-monitoring-system.js - Advanced monitoring and alerting for TRITONS

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class AdvancedMonitoringSystem extends EventEmitter {
    constructor() {
        super();
        
        this.metrics = {
            system: {
                startTime: Date.now(),
                uptime: 0,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                peakResponseTime: 0,
                memoryUsage: 0,
                cpuUsage: 0
            },
            agents: new Map(),
            tasks: new Map(),
            llmProviders: new Map(),
            departments: new Map(),
            alerts: []
        };
        
        this.thresholds = {
            responseTime: {
                warning: 500,  // ms
                critical: 1000 // ms
            },
            errorRate: {
                warning: 0.05,  // 5%
                critical: 0.10  // 10%
            },
            agentLoad: {
                warning: 0.80,  // 80%
                critical: 0.95  // 95%
            },
            memoryUsage: {
                warning: 0.80,  // 80%
                critical: 0.90  // 90%
            },
            taskQueueDepth: {
                warning: 50,
                critical: 100
            }
        };
        
        this.alertSubscribers = [];
        
        // Start monitoring loops
        this.startSystemMonitoring();
        this.startAlertProcessor();
    }

    // Start system resource monitoring
    startSystemMonitoring() {
        setInterval(async () => {
            await this.collectSystemMetrics();
            await this.checkSystemHealth();
        }, 15000); // Every 15 seconds
        
        console.log('📊 Advanced monitoring system started');
    }

    // Collect system metrics
    async collectSystemMetrics() {
        const now = Date.now();
        
        // Update uptime
        this.metrics.system.uptime = now - this.metrics.system.startTime;
        
        // Collect memory usage
        const memUsage = process.memoryUsage();
        this.metrics.system.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
        
        // Collect CPU usage (simplified)
        const cpuUsage = process.cpuUsage();
        this.metrics.system.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
        
        // Collect TRITONS-specific metrics
        await this.collectTritonsMetrics();
    }

    // Collect TRITONS-specific metrics
    async collectTritonsMetrics() {
        try {
            // Get system health from TRITONS
            const healthResponse = await fetch('http://localhost:8080/health');
            if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                
                // Update LLM provider metrics
                Object.entries(healthData.llm_providers || {}).forEach(([provider, data]) => {
                    if (!this.metrics.llmProviders.has(provider)) {
                        this.metrics.llmProviders.set(provider, {
                            name: data.name,
                            activeAgents: 0,
                            totalRequests: 0,
                            successfulRequests: 0,
                            failedRequests: 0,
                            totalCost: 0,
                            averageResponseTime: 0
                        });
                    }
                    
                    const providerMetrics = this.metrics.llmProviders.get(provider);
                    providerMetrics.activeAgents = data.active_agents || 0;
                });
                
                // Update overall agent count
                this.metrics.system.totalAgents = healthData.agents || 0;
            }
        } catch (err) {
            console.error('Failed to collect TRITONS metrics:', err.message);
        }
    }

    // Check system health and generate alerts
    async checkSystemHealth() {
        const alerts = [];
        
        // Check response time
        if (this.metrics.system.averageResponseTime > this.thresholds.responseTime.critical) {
            alerts.push({
                level: 'critical',
                type: 'performance',
                message: `Average response time is critically high: ${this.metrics.system.averageResponseTime}ms`,
                metric: 'response_time',
                value: this.metrics.system.averageResponseTime,
                threshold: this.thresholds.responseTime.critical
            });
        } else if (this.metrics.system.averageResponseTime > this.thresholds.responseTime.warning) {
            alerts.push({
                level: 'warning',
                type: 'performance',
                message: `Average response time is elevated: ${this.metrics.system.averageResponseTime}ms`,
                metric: 'response_time',
                value: this.metrics.system.averageResponseTime,
                threshold: this.thresholds.responseTime.warning
            });
        }
        
        // Check error rate
        const errorRate = this.metrics.system.totalRequests > 0 
            ? this.metrics.system.failedRequests / this.metrics.system.totalRequests
            : 0;
            
        if (errorRate > this.thresholds.errorRate.critical) {
            alerts.push({
                level: 'critical',
                type: 'reliability',
                message: `Error rate is critically high: ${(errorRate * 100).toFixed(2)}%`,
                metric: 'error_rate',
                value: errorRate,
                threshold: this.thresholds.errorRate.critical
            });
        } else if (errorRate > this.thresholds.errorRate.warning) {
            alerts.push({
                level: 'warning',
                type: 'reliability',
                message: `Error rate is elevated: ${(errorRate * 100).toFixed(2)}%`,
                metric: 'error_rate',
                value: errorRate,
                threshold: this.thresholds.errorRate.warning
            });
        }
        
        // Check memory usage
        if (this.metrics.system.memoryUsage > this.thresholds.memoryUsage.critical) {
            alerts.push({
                level: 'critical',
                type: 'resource',
                message: `Memory usage is critically high: ${(this.metrics.system.memoryUsage * 100).toFixed(1)}%`,
                metric: 'memory_usage',
                value: this.metrics.system.memoryUsage,
                threshold: this.thresholds.memoryUsage.critical
            });
        } else if (this.metrics.system.memoryUsage > this.thresholds.memoryUsage.warning) {
            alerts.push({
                level: 'warning',
                type: 'resource',
                message: `Memory usage is elevated: ${(this.metrics.system.memoryUsage * 100).toFixed(1)}%`,
                metric: 'memory_usage',
                value: this.metrics.system.memoryUsage,
                threshold: this.thresholds.memoryUsage.warning
            });
        }
        
        // Check agent health
        await this.checkAgentHealth(alerts);
        
        // Process alerts
        for (const alert of alerts) {
            await this.processAlert(alert);
        }
    }

    // Check individual agent health
    async checkAgentHealth(alerts) {
        for (const [agentId, metrics] of this.metrics.agents) {
            // Check agent load
            if (metrics.currentLoad > this.thresholds.agentLoad.critical) {
                alerts.push({
                    level: 'critical',
                    type: 'agent_performance',
                    message: `Agent ${agentId} is critically overloaded: ${(metrics.currentLoad * 100).toFixed(1)}%`,
                    metric: 'agent_load',
                    value: metrics.currentLoad,
                    threshold: this.thresholds.agentLoad.critical,
                    agentId
                });
            } else if (metrics.currentLoad > this.thresholds.agentLoad.warning) {
                alerts.push({
                    level: 'warning',
                    type: 'agent_performance',
                    message: `Agent ${agentId} is heavily loaded: ${(metrics.currentLoad * 100).toFixed(1)}%`,
                    metric: 'agent_load',
                    value: metrics.currentLoad,
                    threshold: this.thresholds.agentLoad.warning,
                    agentId
                });
            }
            
            // Check agent success rate
            const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
            const successRate = totalTasks > 0 ? metrics.tasksCompleted / totalTasks : 1;
            
            if (successRate < (1 - this.thresholds.errorRate.critical) && totalTasks >= 5) {
                alerts.push({
                    level: 'critical',
                    type: 'agent_reliability',
                    message: `Agent ${agentId} has low success rate: ${(successRate * 100).toFixed(1)}%`,
                    metric: 'agent_success_rate',
                    value: successRate,
                    threshold: 1 - this.thresholds.errorRate.critical,
                    agentId
                });
            }
        }
    }

    // Process and handle alerts
    async processAlert(alert) {
        alert.timestamp = new Date().toISOString();
        alert.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Add to alerts history
        this.metrics.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.metrics.alerts.length > 100) {
            this.metrics.alerts = this.metrics.alerts.slice(-100);
        }
        
        // Log alert
        const logLevel = alert.level === 'critical' ? '🚨' : '⚠️ ';
        console.log(`${logLevel} ALERT [${alert.level.toUpperCase()}] ${alert.message}`);
        
        // Emit alert event
        this.emit('alert', alert);
        
        // Send to subscribers
        for (const subscriber of this.alertSubscribers) {
            try {
                await subscriber(alert);
            } catch (err) {
                console.error('Failed to send alert to subscriber:', err.message);
            }
        }
        
        // Save critical alerts to file
        if (alert.level === 'critical') {
            await this.saveAlertToFile(alert);
        }
        
        // Auto-remediation for certain alert types
        await this.attemptAutoRemediation(alert);
    }

    // Attempt automatic remediation
    async attemptAutoRemediation(alert) {
        switch (alert.type) {
            case 'agent_performance':
                if (alert.level === 'critical') {
                    console.log(`🔧 Attempting auto-remediation for overloaded agent ${alert.agentId}`);
                    // Could trigger agent restart or load redistribution
                    this.emit('autoRemediation', {
                        type: 'agent_restart',
                        agentId: alert.agentId,
                        reason: 'overload'
                    });
                }
                break;
                
            case 'resource':
                if (alert.metric === 'memory_usage' && alert.level === 'critical') {
                    console.log('🔧 Attempting memory cleanup due to high usage');
                    // Trigger garbage collection
                    if (global.gc) {
                        global.gc();
                        console.log('✅ Garbage collection triggered');
                    }
                }
                break;
        }
    }

    // Save alert to file
    async saveAlertToFile(alert) {
        try {
            const alertsDir = path.join(process.cwd(), 'logs', 'alerts');
            await fs.mkdir(alertsDir, { recursive: true });
            
            const filename = `critical_alerts_${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(alertsDir, filename);
            
            let alerts = [];
            try {
                const existingData = await fs.readFile(filepath, 'utf8');
                alerts = JSON.parse(existingData);
            } catch (err) {
                // File doesn't exist yet
            }
            
            alerts.push(alert);
            await fs.writeFile(filepath, JSON.stringify(alerts, null, 2));
            
        } catch (err) {
            console.error('Failed to save alert to file:', err.message);
        }
    }

    // Start alert processing loop
    startAlertProcessor() {
        // Generate daily alert summary
        setInterval(() => {
            this.generateAlertSummary();
        }, 24 * 60 * 60 * 1000); // Every 24 hours
        
        // Cleanup old alerts
        setInterval(() => {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            this.metrics.alerts = this.metrics.alerts.filter(
                alert => new Date(alert.timestamp).getTime() > oneDayAgo
            );
        }, 60 * 60 * 1000); // Every hour
    }

    // Generate alert summary
    async generateAlertSummary() {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentAlerts = this.metrics.alerts.filter(
            alert => new Date(alert.timestamp) >= yesterday
        );
        
        const summary = {
            date: now.toISOString().split('T')[0],
            totalAlerts: recentAlerts.length,
            criticalAlerts: recentAlerts.filter(a => a.level === 'critical').length,
            warningAlerts: recentAlerts.filter(a => a.level === 'warning').length,
            alertsByType: {},
            topIssues: []
        };
        
        // Group by type
        for (const alert of recentAlerts) {
            summary.alertsByType[alert.type] = (summary.alertsByType[alert.type] || 0) + 1;
        }
        
        // Find top issues
        summary.topIssues = Object.entries(summary.alertsByType)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
        
        console.log('📊 Daily Alert Summary:', summary);
        
        // Save summary
        try {
            const summaryDir = path.join(process.cwd(), 'logs', 'summaries');
            await fs.mkdir(summaryDir, { recursive: true });
            
            const filename = `alert_summary_${summary.date}.json`;
            await fs.writeFile(
                path.join(summaryDir, filename),
                JSON.stringify(summary, null, 2)
            );
        } catch (err) {
            console.error('Failed to save alert summary:', err.message);
        }
    }

    // Subscribe to alerts
    subscribeToAlerts(callback) {
        this.alertSubscribers.push(callback);
    }

    // Record request metrics
    recordRequest(responseTime, success = true) {
        this.metrics.system.totalRequests++;
        
        if (success) {
            this.metrics.system.successfulRequests++;
        } else {
            this.metrics.system.failedRequests++;
        }
        
        // Update response time metrics
        const totalResponseTime = this.metrics.system.averageResponseTime * (this.metrics.system.totalRequests - 1);
        this.metrics.system.averageResponseTime = (totalResponseTime + responseTime) / this.metrics.system.totalRequests;
        
        if (responseTime > this.metrics.system.peakResponseTime) {
            this.metrics.system.peakResponseTime = responseTime;
        }
    }

    // Record agent metrics
    recordAgentMetrics(agentId, metrics) {
        if (!this.metrics.agents.has(agentId)) {
            this.metrics.agents.set(agentId, {
                tasksCompleted: 0,
                tasksFailed: 0,
                currentLoad: 0,
                totalResponseTime: 0,
                lastActive: Date.now()
            });
        }
        
        const agentMetrics = this.metrics.agents.get(agentId);
        Object.assign(agentMetrics, metrics);
        agentMetrics.lastActive = Date.now();
    }

    // Get monitoring dashboard data
    getDashboardData() {
        const now = Date.now();
        
        // Calculate success rate
        const successRate = this.metrics.system.totalRequests > 0
            ? (this.metrics.system.successfulRequests / this.metrics.system.totalRequests * 100).toFixed(2)
            : '100.00';
        
        // Get recent alerts
        const recentAlerts = this.metrics.alerts
            .filter(alert => now - new Date(alert.timestamp).getTime() < 60 * 60 * 1000) // Last hour
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);
        
        return {
            system: {
                uptime: Math.floor(this.metrics.system.uptime / 1000),
                totalRequests: this.metrics.system.totalRequests,
                successRate: successRate,
                averageResponseTime: Math.round(this.metrics.system.averageResponseTime),
                peakResponseTime: this.metrics.system.peakResponseTime,
                memoryUsage: (this.metrics.system.memoryUsage * 100).toFixed(1),
                cpuUsage: this.metrics.system.cpuUsage.toFixed(2),
                totalAgents: this.metrics.system.totalAgents || 0
            },
            alerts: {
                recent: recentAlerts,
                totalToday: this.metrics.alerts.filter(
                    alert => now - new Date(alert.timestamp).getTime() < 24 * 60 * 60 * 1000
                ).length,
                criticalActive: recentAlerts.filter(a => a.level === 'critical').length
            },
            agents: Array.from(this.metrics.agents.entries()).map(([id, metrics]) => ({
                id,
                ...metrics,
                healthScore: this.calculateAgentHealthScore(metrics)
            })),
            llmProviders: Array.from(this.metrics.llmProviders.entries()).map(([id, metrics]) => ({
                id,
                ...metrics
            })),
            timestamp: new Date().toISOString()
        };
    }

    // Calculate agent health score
    calculateAgentHealthScore(metrics) {
        const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
        const successRate = totalTasks > 0 ? metrics.tasksCompleted / totalTasks : 1;
        const loadScore = 1 - metrics.currentLoad;
        const activityScore = Math.min(1, (Date.now() - metrics.lastActive) / (5 * 60 * 1000)); // Active within 5 minutes
        
        return Math.round((successRate * 0.4 + loadScore * 0.4 + activityScore * 0.2) * 100);
    }

    // Start HTTP API for monitoring data
    startMonitoringAPI(port = 8085) {
        const http = require('http');
        
        const server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            if (req.url === '/monitoring/dashboard') {
                res.end(JSON.stringify(this.getDashboardData(), null, 2));
            } else if (req.url === '/monitoring/alerts') {
                res.end(JSON.stringify(this.metrics.alerts.slice(-50), null, 2));
            } else if (req.url === '/monitoring/health') {
                const healthStatus = this.metrics.alerts.filter(
                    a => a.level === 'critical' && 
                    Date.now() - new Date(a.timestamp).getTime() < 5 * 60 * 1000
                ).length === 0 ? 'healthy' : 'unhealthy';
                
                res.end(JSON.stringify({ status: healthStatus }));
            } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        });
        
        server.listen(port, () => {
            console.log(`📊 Advanced monitoring API running on http://localhost:${port}`);
        });
        
        return server;
    }
}

// Start monitoring system if run directly
if (require.main === module) {
    const monitoring = new AdvancedMonitoringSystem();
    
    // Start monitoring API
    monitoring.startMonitoringAPI();
    
    // Example alert subscriber
    monitoring.subscribeToAlerts((alert) => {
        console.log(`📧 Alert notification: ${alert.message}`);
    });
    
    // Simulate some metrics for testing
    setInterval(() => {
        monitoring.recordRequest(Math.random() * 500 + 100, Math.random() > 0.05);
        monitoring.recordAgentMetrics('test_agent_1', {
            currentLoad: Math.random() * 0.8,
            tasksCompleted: Math.floor(Math.random() * 100),
            tasksFailed: Math.floor(Math.random() * 5)
        });
    }, 10000);
    
    console.log('🚀 Advanced monitoring system started');
    console.log('📊 Dashboard API: http://localhost:8085/monitoring/dashboard');
    console.log('🚨 Alerts API: http://localhost:8085/monitoring/alerts');
}

module.exports = AdvancedMonitoringSystem;