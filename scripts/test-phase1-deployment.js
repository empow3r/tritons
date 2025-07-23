#!/usr/bin/env node
// test-phase1-deployment.js - Test Phase 1 task deployment

const TaskDeploymentAgent = require('./task-deploy-agent');
const TaskDependencyResolver = require('./task-dependency-resolver');

async function testPhase1Deployment() {
    console.log('🧪 Testing Phase 1 Task Deployment');
    console.log('=================================\n');

    const deploymentAgent = new TaskDeploymentAgent();
    const dependencyResolver = new TaskDependencyResolver();

    try {
        // Initialize
        console.log('🔧 Initializing systems...');
        await deploymentAgent.init();
        
        // Define Phase 1 tasks with proper dependencies
        const phase1Tasks = [
            {
                id: 'SETUP_REDIS_CLUSTER',
                title: 'Complete Redis clustering for high availability',
                type: 'infrastructure',
                department: 'INFRA',
                priority: 'critical',
                estimatedHours: 16,
                dependencies: [],
                requirements: [
                    'Implement 3-node Redis cluster',
                    'Configure automatic failover',
                    'Set up data persistence',
                    'Add monitoring integration'
                ]
            },
            {
                id: 'IMPLEMENT_CIRCUIT_BREAKERS',
                title: 'Implement circuit breakers for all LLM providers',
                type: 'development',
                department: 'ARCHITECTURE',
                priority: 'critical',
                estimatedHours: 12,
                dependencies: [],
                requirements: [
                    'Add circuit breaker pattern',
                    'Configure thresholds per provider',
                    'Implement fallback mechanisms',
                    'Add metrics collection'
                ]
            },
            {
                id: 'ERROR_RECOVERY_MECHANISMS',
                title: 'Add comprehensive error recovery mechanisms',
                type: 'development',
                department: 'ARCHITECTURE',
                priority: 'high',
                estimatedHours: 20,
                dependencies: ['IMPLEMENT_CIRCUIT_BREAKERS'],
                requirements: [
                    'Implement retry logic with exponential backoff',
                    'Add dead letter queue for failed tasks',
                    'Create recovery dashboard',
                    'Implement automatic error classification'
                ]
            },
            {
                id: 'OPENTELEMETRY_TRACING',
                title: 'Deploy distributed tracing with OpenTelemetry',
                type: 'infrastructure',
                department: 'INFRA',
                priority: 'medium',
                estimatedHours: 8,
                dependencies: ['SETUP_REDIS_CLUSTER'],
                requirements: [
                    'Set up OpenTelemetry collector',
                    'Instrument all services',
                    'Configure trace sampling',
                    'Create visualization dashboards'
                ]
            },
            {
                id: 'PERFORMANCE_OPTIMIZATION',
                title: 'Optimize agent spawn time to < 100ms',
                type: 'development',
                department: 'ARCHITECTURE',
                priority: 'high',
                estimatedHours: 10,
                dependencies: ['ERROR_RECOVERY_MECHANISMS'],
                requirements: [
                    'Profile current spawn process',
                    'Optimize connection pooling',
                    'Implement agent warm-up',
                    'Add performance benchmarks'
                ]
            }
        ];

        console.log(`📋 Deploying ${phase1Tasks.length} Phase 1 tasks...\n`);

        // Add tasks with dependencies
        for (const task of phase1Tasks) {
            console.log(`📤 Queueing: ${task.id}`);
            
            // Add to dependency resolver
            dependencyResolver.addTask(task.id, task.dependencies, task);
            
            // Queue for deployment
            await deploymentAgent.queueTask(task);
            
            console.log(`   ✅ ${task.title} (${task.priority})`);
        }

        console.log('\n📊 Deployment Status:');
        
        // Show execution order
        const executionOrder = dependencyResolver.calculateExecutionOrder();
        console.log('\n🔄 Execution Order:');
        executionOrder.forEach((taskId, index) => {
            console.log(`   ${index + 1}. ${taskId}`);
        });

        // Show available tasks
        const availableTasks = dependencyResolver.getAvailableTasks();
        console.log(`\n🚀 Available Tasks (${availableTasks.length}):`);
        availableTasks.forEach(task => {
            console.log(`   - ${task.id} (priority: ${task.priority.toFixed(1)})`);
        });

        // Show statistics
        const stats = dependencyResolver.getStatistics();
        console.log('\n📈 Statistics:');
        console.log(`   Total tasks: ${stats.total}`);
        console.log(`   Ready to start: ${stats.ready}`);
        console.log(`   Blocked by dependencies: ${stats.blocked}`);
        console.log(`   Critical path: ${stats.criticalPath.join(' → ')}`);

        // Test task progression
        console.log('\n🔄 Testing Task Progression:');
        
        // Start first available task
        if (availableTasks.length > 0) {
            const firstTask = availableTasks[0];
            console.log(`\n▶️  Starting: ${firstTask.id}`);
            dependencyResolver.startTask(firstTask.id);
            
            // Simulate completion
            setTimeout(() => {
                console.log(`✅ Completed: ${firstTask.id}`);
                const newTasks = dependencyResolver.completeTask(firstTask.id, true);
                
                console.log(`\n🆕 Newly Available Tasks (${newTasks.length}):`);
                newTasks.forEach(task => {
                    console.log(`   - ${task.id} (priority: ${task.priority.toFixed(1)})`);
                });
                
                console.log('\n✅ Phase 1 deployment test completed successfully!');
                process.exit(0);
            }, 2000);
        }

    } catch (error) {
        console.error('❌ Deployment test failed:', error.message);
        process.exit(1);
    }
}

// Run test
if (require.main === module) {
    testPhase1Deployment();
}

module.exports = testPhase1Deployment;