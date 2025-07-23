#!/usr/bin/env node
// test-task-deployment.js - Integration test for TRITONS task deployment system

const Redis = require('ioredis');
const TaskDeploymentAgent = require('./task-deploy-agent');
const TaskDependencyResolver = require('./task-dependency-resolver');
const AgentPerformanceMetrics = require('./agent-performance-metrics');

class TaskDeploymentTest {
    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379
        });
        
        this.deploymentAgent = new TaskDeploymentAgent();
        this.dependencyResolver = new TaskDependencyResolver();
        this.performanceMetrics = new AgentPerformanceMetrics();
        
        this.testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    // Initialize test environment
    async init() {
        console.log('🧪 TRITONS Task Deployment Integration Test');
        console.log('==========================================\n');
        
        try {
            // Clean Redis
            console.log('🧹 Cleaning test environment...');
            const keys = await this.redis.keys('tritons:*');
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
            
            // Initialize components
            await this.deploymentAgent.init();
            await this.performanceMetrics.init();
            
            console.log('✅ Test environment ready\n');
            return true;
        } catch (err) {
            console.error('❌ Failed to initialize:', err.message);
            return false;
        }
    }

    // Test 1: Basic task submission
    async testBasicTaskSubmission() {
        console.log('📝 Test 1: Basic Task Submission');
        
        try {
            const task = {
                id: 'TEST_001',
                title: 'Test Task',
                type: 'development',
                department: 'ARCHITECTURE',
                priority: 'high',
                estimatedHours: 1,
                requirements: ['Test requirement']
            };
            
            await this.deploymentAgent.queueTask(task);
            
            // Verify task in queue
            const queueSize = await this.redis.zcard('tritons:tasks:queue');
            this.assert(queueSize === 1, 'Task added to queue');
            
            // Verify task status
            const status = await this.redis.hget('tritons:tasks:status:TEST_001', 'status');
            this.assert(status === 'queued', 'Task status is queued');
            
            this.recordTest('Basic Task Submission', true);
        } catch (err) {
            this.recordTest('Basic Task Submission', false, err.message);
        }
    }

    // Test 2: Task with dependencies
    async testTaskDependencies() {
        console.log('\n📝 Test 2: Task Dependencies');
        
        try {
            // Add tasks with dependencies
            this.dependencyResolver.addTask('DEP_A', [], { priority: 'high' });
            this.dependencyResolver.addTask('DEP_B', ['DEP_A'], { priority: 'high' });
            this.dependencyResolver.addTask('DEP_C', ['DEP_A', 'DEP_B'], { priority: 'critical' });
            
            // Check available tasks
            const available = this.dependencyResolver.getAvailableTasks();
            this.assert(available.length === 1, 'Only one task available initially');
            this.assert(available[0].id === 'DEP_A', 'First available task is DEP_A');
            
            // Complete first task
            this.dependencyResolver.startTask('DEP_A');
            this.dependencyResolver.completeTask('DEP_A', true);
            
            // Check newly available tasks
            const newAvailable = this.dependencyResolver.getAvailableTasks();
            this.assert(newAvailable.length === 1, 'One new task available');
            this.assert(newAvailable[0].id === 'DEP_B', 'Next available task is DEP_B');
            
            this.recordTest('Task Dependencies', true);
        } catch (err) {
            this.recordTest('Task Dependencies', false, err.message);
        }
    }

    // Test 3: Agent performance tracking
    async testAgentPerformance() {
        console.log('\n📝 Test 3: Agent Performance Tracking');
        
        try {
            const agentId = 'test_agent_001';
            const taskId = 'PERF_TEST_001';
            
            // Record task start
            await this.performanceMetrics.recordTaskStart(agentId, taskId, 'test');
            
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Record completion
            await this.performanceMetrics.recordTaskCompletion(agentId, taskId, true, {
                apiCalls: 5,
                cost: 0.05
            });
            
            // Get metrics
            const leaderboard = await this.performanceMetrics.getAgentLeaderboard();
            this.assert(leaderboard.length > 0, 'Leaderboard has entries');
            
            const agentMetrics = leaderboard.find(a => a.agentId === agentId);
            this.assert(agentMetrics !== undefined, 'Agent metrics recorded');
            this.assert(agentMetrics.tasksCompleted === 1, 'Task completion recorded');
            
            this.recordTest('Agent Performance Tracking', true);
        } catch (err) {
            this.recordTest('Agent Performance Tracking', false, err.message);
        }
    }

    // Test 4: Circular dependency detection
    async testCircularDependency() {
        console.log('\n📝 Test 4: Circular Dependency Detection');
        
        try {
            const resolver = new TaskDependencyResolver();
            
            // Create circular dependency
            resolver.addTask('CIRC_A', ['CIRC_B']);
            resolver.addTask('CIRC_B', ['CIRC_C']);
            
            let errorCaught = false;
            try {
                resolver.addTask('CIRC_C', ['CIRC_A']);
            } catch (err) {
                errorCaught = true;
                this.assert(err.message.includes('Circular dependency'), 'Circular dependency detected');
            }
            
            this.assert(errorCaught, 'Error thrown for circular dependency');
            this.recordTest('Circular Dependency Detection', true);
        } catch (err) {
            this.recordTest('Circular Dependency Detection', false, err.message);
        }
    }

    // Test 5: Priority-based task selection
    async testPrioritySelection() {
        console.log('\n📝 Test 5: Priority-based Task Selection');
        
        try {
            // Clear queue
            await this.redis.del('tritons:tasks:queue');
            
            // Add tasks with different priorities
            const tasks = [
                { id: 'PRIO_LOW', priority: 'low', estimatedHours: 1 },
                { id: 'PRIO_MED', priority: 'medium', estimatedHours: 1 },
                { id: 'PRIO_HIGH', priority: 'high', estimatedHours: 1 },
                { id: 'PRIO_CRIT', priority: 'critical', estimatedHours: 1 }
            ];
            
            for (const task of tasks) {
                await this.deploymentAgent.queueTask({
                    ...task,
                    title: `Priority ${task.priority} task`,
                    type: 'test',
                    department: 'ARCHITECTURE',
                    requirements: []
                });
            }
            
            // Get tasks in priority order
            const queuedTasks = await this.redis.zrange('tritons:tasks:queue', 0, -1, 'WITHSCORES');
            
            // Verify priority ordering (lower score = higher priority)
            this.assert(queuedTasks.length === 8, 'All tasks queued'); // 4 tasks * 2 (value + score)
            
            this.recordTest('Priority-based Task Selection', true);
        } catch (err) {
            this.recordTest('Priority-based Task Selection', false, err.message);
        }
    }

    // Test 6: Dashboard data generation
    async testDashboardData() {
        console.log('\n📝 Test 6: Dashboard Data Generation');
        
        try {
            const dashboardData = await this.performanceMetrics.getDashboardData();
            
            this.assert(dashboardData.system !== undefined, 'System metrics present');
            this.assert(dashboardData.leaderboard !== undefined, 'Leaderboard present');
            this.assert(dashboardData.agents !== undefined, 'Agent data present');
            this.assert(dashboardData.timestamp !== undefined, 'Timestamp present');
            
            this.recordTest('Dashboard Data Generation', true);
        } catch (err) {
            this.recordTest('Dashboard Data Generation', false, err.message);
        }
    }

    // Test 7: End-to-end task flow
    async testEndToEndFlow() {
        console.log('\n📝 Test 7: End-to-End Task Flow');
        
        try {
            // Create a complex task with subtasks
            const mainTask = {
                id: 'E2E_MAIN',
                title: 'End-to-End Test Task',
                type: 'development',
                department: 'ARCHITECTURE',
                priority: 'high',
                estimatedHours: 4,
                requirements: ['Build feature X', 'Test feature X'],
                subtasks: ['Design', 'Implement', 'Test', 'Deploy']
            };
            
            // Submit task
            await this.deploymentAgent.queueTask(mainTask);
            
            // Process task (simulate)
            await this.deploymentAgent.processNextTask();
            
            // Verify task was assigned
            const status = await this.redis.hget('tritons:tasks:status:E2E_MAIN', 'status');
            this.assert(status !== 'queued', 'Task processed from queue');
            
            this.recordTest('End-to-End Task Flow', true);
        } catch (err) {
            this.recordTest('End-to-End Task Flow', false, err.message);
        }
    }

    // Assertion helper
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
        console.log(`  ✓ ${message}`);
    }

    // Record test result
    recordTest(name, passed, error = null) {
        this.testResults.tests.push({ name, passed, error });
        if (passed) {
            this.testResults.passed++;
            console.log(`  ✅ ${name} PASSED`);
        } else {
            this.testResults.failed++;
            console.log(`  ❌ ${name} FAILED: ${error}`);
        }
    }

    // Run all tests
    async runAllTests() {
        const tests = [
            this.testBasicTaskSubmission,
            this.testTaskDependencies,
            this.testAgentPerformance,
            this.testCircularDependency,
            this.testPrioritySelection,
            this.testDashboardData,
            this.testEndToEndFlow
        ];

        for (const test of tests) {
            await test.call(this);
        }
    }

    // Generate test report
    generateReport() {
        console.log('\n📊 Test Results Summary');
        console.log('======================');
        console.log(`Total Tests: ${this.testResults.passed + this.testResults.failed}`);
        console.log(`Passed: ${this.testResults.passed} ✅`);
        console.log(`Failed: ${this.testResults.failed} ❌`);
        console.log(`Success Rate: ${(this.testResults.passed / (this.testResults.passed + this.testResults.failed) * 100).toFixed(1)}%`);
        
        if (this.testResults.failed > 0) {
            console.log('\nFailed Tests:');
            this.testResults.tests
                .filter(t => !t.passed)
                .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
        }
    }

    // Cleanup
    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        
        // Clear test data
        const keys = await this.redis.keys('tritons:*');
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
        
        await this.redis.quit();
        console.log('✅ Cleanup complete');
    }
}

// Run tests
if (require.main === module) {
    const tester = new TaskDeploymentTest();
    
    (async () => {
        const initialized = await tester.init();
        if (!initialized) {
            process.exit(1);
        }
        
        await tester.runAllTests();
        tester.generateReport();
        await tester.cleanup();
        
        process.exit(tester.testResults.failed > 0 ? 1 : 0);
    })();
}

module.exports = TaskDeploymentTest;