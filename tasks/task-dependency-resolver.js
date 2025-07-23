#!/usr/bin/env node
// task-dependency-resolver.js - Intelligent task dependency management

const EventEmitter = require('events');

class TaskDependencyResolver extends EventEmitter {
    constructor() {
        super();
        
        // Task dependency graph
        this.taskGraph = new Map();
        
        // Task status tracking
        this.taskStatus = new Map();
        
        // Blocked tasks waiting for dependencies
        this.blockedTasks = new Map();
        
        // Execution order cache
        this.executionOrder = [];
        
        // Circular dependency detection
        this.visitedNodes = new Set();
        this.recursionStack = new Set();
    }

    // Add task with dependencies
    addTask(taskId, dependencies = [], metadata = {}) {
        // Initialize task node
        this.taskGraph.set(taskId, {
            id: taskId,
            dependencies: new Set(dependencies),
            dependents: new Set(),
            metadata,
            addedAt: Date.now()
        });
        
        // Set initial status
        this.taskStatus.set(taskId, {
            status: dependencies.length > 0 ? 'blocked' : 'ready',
            blockedBy: new Set(dependencies),
            startTime: null,
            endTime: null
        });
        
        // Update dependent relationships
        dependencies.forEach(depId => {
            if (this.taskGraph.has(depId)) {
                this.taskGraph.get(depId).dependents.add(taskId);
            } else {
                // Create placeholder for missing dependency
                this.taskGraph.set(depId, {
                    id: depId,
                    dependencies: new Set(),
                    dependents: new Set([taskId]),
                    metadata: { placeholder: true },
                    addedAt: Date.now()
                });
            }
        });
        
        // Check for circular dependencies
        if (this.hasCircularDependency(taskId)) {
            this.taskGraph.delete(taskId);
            this.taskStatus.delete(taskId);
            throw new Error(`Circular dependency detected for task ${taskId}`);
        }
        
        // Update execution order
        this.calculateExecutionOrder();
        
        this.emit('taskAdded', { taskId, dependencies });
        
        return this.getTaskInfo(taskId);
    }

    // Check for circular dependencies using DFS
    hasCircularDependency(startNode) {
        this.visitedNodes.clear();
        this.recursionStack.clear();
        
        const visit = (nodeId) => {
            this.visitedNodes.add(nodeId);
            this.recursionStack.add(nodeId);
            
            const node = this.taskGraph.get(nodeId);
            if (!node) return false;
            
            for (const depId of node.dependencies) {
                if (!this.visitedNodes.has(depId)) {
                    if (visit(depId)) return true;
                } else if (this.recursionStack.has(depId)) {
                    return true; // Circular dependency found
                }
            }
            
            this.recursionStack.delete(nodeId);
            return false;
        };
        
        return visit(startNode);
    }

    // Calculate optimal execution order using topological sort
    calculateExecutionOrder() {
        const inDegree = new Map();
        const queue = [];
        this.executionOrder = [];
        
        // Calculate in-degree for each node
        for (const [taskId, task] of this.taskGraph) {
            if (!task.metadata?.placeholder) {
                inDegree.set(taskId, task.dependencies.size);
                if (task.dependencies.size === 0) {
                    queue.push(taskId);
                }
            }
        }
        
        // Process nodes with no dependencies first
        while (queue.length > 0) {
            const taskId = queue.shift();
            this.executionOrder.push(taskId);
            
            const task = this.taskGraph.get(taskId);
            if (task) {
                // Reduce in-degree for dependent tasks
                for (const dependentId of task.dependents) {
                    const currentDegree = inDegree.get(dependentId) || 0;
                    inDegree.set(dependentId, currentDegree - 1);
                    
                    if (currentDegree - 1 === 0) {
                        queue.push(dependentId);
                    }
                }
            }
        }
        
        return this.executionOrder;
    }

    // Get next available tasks
    getAvailableTasks() {
        const available = [];
        
        for (const [taskId, status] of this.taskStatus) {
            if (status.status === 'ready') {
                const task = this.taskGraph.get(taskId);
                if (task && !task.metadata?.placeholder) {
                    available.push({
                        id: taskId,
                        priority: this.calculatePriority(taskId),
                        metadata: task.metadata
                    });
                }
            }
        }
        
        // Sort by priority
        return available.sort((a, b) => b.priority - a.priority);
    }

    // Calculate task priority based on various factors
    calculatePriority(taskId) {
        const task = this.taskGraph.get(taskId);
        if (!task) return 0;
        
        let priority = 0;
        
        // Factor 1: Number of dependent tasks (critical path)
        priority += task.dependents.size * 10;
        
        // Factor 2: Task metadata priority
        if (task.metadata.priority === 'critical') priority += 100;
        else if (task.metadata.priority === 'high') priority += 50;
        else if (task.metadata.priority === 'medium') priority += 25;
        else if (task.metadata.priority === 'low') priority += 10;
        
        // Factor 3: Wait time (older tasks get higher priority)
        const waitTime = Date.now() - task.addedAt;
        priority += Math.min(waitTime / 60000, 50); // Max 50 points for wait time
        
        // Factor 4: Execution order position
        const orderIndex = this.executionOrder.indexOf(taskId);
        if (orderIndex !== -1) {
            priority += (this.executionOrder.length - orderIndex);
        }
        
        return priority;
    }

    // Mark task as started
    startTask(taskId) {
        const status = this.taskStatus.get(taskId);
        if (!status || status.status !== 'ready') {
            throw new Error(`Task ${taskId} is not ready to start`);
        }
        
        status.status = 'in_progress';
        status.startTime = Date.now();
        
        this.emit('taskStarted', { taskId, startTime: status.startTime });
        
        return true;
    }

    // Mark task as completed
    completeTask(taskId, success = true, result = null) {
        const status = this.taskStatus.get(taskId);
        if (!status) {
            throw new Error(`Task ${taskId} not found`);
        }
        
        status.status = success ? 'completed' : 'failed';
        status.endTime = Date.now();
        status.result = result;
        
        // Update dependent tasks
        const task = this.taskGraph.get(taskId);
        if (task && success) {
            for (const dependentId of task.dependents) {
                this.updateDependentTask(dependentId, taskId);
            }
        }
        
        this.emit('taskCompleted', { 
            taskId, 
            success, 
            duration: status.endTime - status.startTime 
        });
        
        // Check if all tasks are complete
        this.checkCompletion();
        
        return this.getAvailableTasks();
    }

    // Update dependent task when dependency completes
    updateDependentTask(dependentId, completedDepId) {
        const status = this.taskStatus.get(dependentId);
        if (!status) return;
        
        // Remove from blocked list
        status.blockedBy.delete(completedDepId);
        
        // Check if all dependencies are satisfied
        if (status.blockedBy.size === 0) {
            status.status = 'ready';
            this.emit('taskUnblocked', { taskId: dependentId });
        }
    }

    // Get task information
    getTaskInfo(taskId) {
        const task = this.taskGraph.get(taskId);
        const status = this.taskStatus.get(taskId);
        
        if (!task || !status) return null;
        
        return {
            id: taskId,
            dependencies: Array.from(task.dependencies),
            dependents: Array.from(task.dependents),
            status: status.status,
            blockedBy: Array.from(status.blockedBy),
            metadata: task.metadata,
            priority: this.calculatePriority(taskId)
        };
    }

    // Get dependency graph visualization data
    getGraphData() {
        const nodes = [];
        const edges = [];
        
        for (const [taskId, task] of this.taskGraph) {
            if (!task.metadata?.placeholder) {
                const status = this.taskStatus.get(taskId);
                nodes.push({
                    id: taskId,
                    label: task.metadata.title || taskId,
                    status: status.status,
                    priority: task.metadata.priority
                });
                
                for (const depId of task.dependencies) {
                    edges.push({
                        from: depId,
                        to: taskId
                    });
                }
            }
        }
        
        return { nodes, edges };
    }

    // Check if all tasks are complete
    checkCompletion() {
        let allComplete = true;
        let hasFailures = false;
        
        for (const [taskId, status] of this.taskStatus) {
            const task = this.taskGraph.get(taskId);
            if (task && !task.metadata?.placeholder) {
                if (status.status !== 'completed' && status.status !== 'failed') {
                    allComplete = false;
                }
                if (status.status === 'failed') {
                    hasFailures = true;
                }
            }
        }
        
        if (allComplete) {
            this.emit('allTasksComplete', { hasFailures });
        }
    }

    // Get execution statistics
    getStatistics() {
        const stats = {
            total: 0,
            ready: 0,
            blocked: 0,
            in_progress: 0,
            completed: 0,
            failed: 0,
            avgDuration: 0,
            criticalPath: []
        };
        
        let totalDuration = 0;
        let completedCount = 0;
        
        for (const [taskId, status] of this.taskStatus) {
            const task = this.taskGraph.get(taskId);
            if (task && !task.metadata?.placeholder) {
                stats.total++;
                stats[status.status]++;
                
                if (status.status === 'completed' && status.startTime && status.endTime) {
                    totalDuration += (status.endTime - status.startTime);
                    completedCount++;
                }
            }
        }
        
        if (completedCount > 0) {
            stats.avgDuration = Math.round(totalDuration / completedCount);
        }
        
        // Calculate critical path
        stats.criticalPath = this.calculateCriticalPath();
        
        return stats;
    }

    // Calculate critical path (longest dependency chain)
    calculateCriticalPath() {
        const memo = new Map();
        
        const getPathLength = (taskId) => {
            if (memo.has(taskId)) return memo.get(taskId);
            
            const task = this.taskGraph.get(taskId);
            if (!task || task.metadata?.placeholder) return { length: 0, path: [] };
            
            let maxLength = 0;
            let maxPath = [taskId];
            
            for (const depId of task.dependencies) {
                const depPath = getPathLength(depId);
                if (depPath.length + 1 > maxLength) {
                    maxLength = depPath.length + 1;
                    maxPath = [...depPath.path, taskId];
                }
            }
            
            const result = { length: maxLength, path: maxPath };
            memo.set(taskId, result);
            return result;
        };
        
        let criticalPath = [];
        let maxLength = 0;
        
        for (const [taskId] of this.taskGraph) {
            const pathInfo = getPathLength(taskId);
            if (pathInfo.length > maxLength) {
                maxLength = pathInfo.length;
                criticalPath = pathInfo.path;
            }
        }
        
        return criticalPath;
    }
}

// Example usage and testing
if (require.main === module) {
    const resolver = new TaskDependencyResolver();
    
    // Example: Phase 1 tasks with dependencies
    const phase1Tasks = [
        { id: 'SETUP_ENV', deps: [], priority: 'critical' },
        { id: 'REDIS_CLUSTER', deps: ['SETUP_ENV'], priority: 'critical' },
        { id: 'CIRCUIT_BREAKERS', deps: ['SETUP_ENV'], priority: 'critical' },
        { id: 'ERROR_RECOVERY', deps: ['CIRCUIT_BREAKERS'], priority: 'high' },
        { id: 'MONITORING', deps: ['REDIS_CLUSTER', 'CIRCUIT_BREAKERS'], priority: 'medium' },
        { id: 'TESTING', deps: ['ERROR_RECOVERY', 'MONITORING'], priority: 'high' },
        { id: 'DOCUMENTATION', deps: ['TESTING'], priority: 'low' }
    ];
    
    console.log('📊 Task Dependency Resolver Demo');
    console.log('================================\n');
    
    // Add tasks
    phase1Tasks.forEach(task => {
        try {
            resolver.addTask(task.id, task.deps, { 
                title: task.id.replace(/_/g, ' '),
                priority: task.priority 
            });
            console.log(`✅ Added task: ${task.id}`);
        } catch (err) {
            console.error(`❌ Error adding task ${task.id}:`, err.message);
        }
    });
    
    // Show execution order
    console.log('\n📋 Execution Order:');
    resolver.executionOrder.forEach((taskId, index) => {
        console.log(`  ${index + 1}. ${taskId}`);
    });
    
    // Show available tasks
    console.log('\n🚀 Available Tasks:');
    const available = resolver.getAvailableTasks();
    available.forEach(task => {
        console.log(`  - ${task.id} (priority: ${task.priority})`);
    });
    
    // Show statistics
    console.log('\n📈 Statistics:');
    const stats = resolver.getStatistics();
    console.log(`  Total tasks: ${stats.total}`);
    console.log(`  Ready: ${stats.ready}`);
    console.log(`  Blocked: ${stats.blocked}`);
    console.log(`  Critical path: ${stats.criticalPath.join(' → ')}`);
}

module.exports = TaskDependencyResolver;