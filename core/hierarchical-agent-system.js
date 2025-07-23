#!/usr/bin/env node
// hierarchical-agent-system.js - Intelligent Agent Hierarchy with Task Routing

const express = require('express');
const WebSocket = require('ws');
const http = require('http');

class IntelligentMasterOrchestrator {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.agents = new Map();
        this.tasks = [];
        this.departments = new Map();
        this.taskRouter = new TaskRouter();
        this.targetAgents = 1000;
        this.currentPhase = 'bootstrap';
        
        console.log('🏢 Intelligent Hierarchical Agent System Starting');
        console.log('================================================');
        
        this.initializeDepartments();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startInitialAgents();
    }
    
    initializeDepartments() {
        // Executive Level
        this.departments.set('executive', {
            name: 'Executive Leadership',
            icon: '👑',
            color: '#8B5CF6',
            roles: ['ceo', 'cto', 'strategy_director'],
            capabilities: ['strategic_planning', 'decision_making', 'resource_allocation'],
            priority_access: 'highest'
        });
        
        // Engineering Departments
        this.departments.set('frontend', {
            name: 'Frontend Engineering',
            icon: '🎨',
            color: '#06B6D4',
            roles: ['frontend_lead', 'ui_specialist', 'ux_engineer'],
            capabilities: ['react', 'vue', 'ui_design', 'responsive_design', 'accessibility'],
            specialties: ['component_library', 'design_systems', 'user_experience']
        });
        
        this.departments.set('backend', {
            name: 'Backend Engineering',
            icon: '⚙️',
            color: '#10B981',
            roles: ['backend_lead', 'api_architect', 'database_specialist'],
            capabilities: ['nodejs', 'python', 'database_design', 'api_development', 'microservices'],
            specialties: ['scalability', 'performance', 'data_architecture']
        });
        
        this.departments.set('devops', {
            name: 'DevOps & Infrastructure',
            icon: '🚀',
            color: '#F59E0B',
            roles: ['devops_lead', 'cloud_architect', 'security_engineer'],
            capabilities: ['docker', 'kubernetes', 'aws', 'ci_cd', 'monitoring'],
            specialties: ['deployment', 'scaling', 'infrastructure', 'security']
        });
        
        this.departments.set('ai_ml', {
            name: 'AI/ML Engineering',
            icon: '🤖',
            color: '#EF4444',
            roles: ['ml_lead', 'data_scientist', 'ai_researcher'],
            capabilities: ['machine_learning', 'deep_learning', 'nlp', 'computer_vision'],
            specialties: ['model_training', 'data_analysis', 'ai_integration']
        });
        
        // Quality & Testing
        this.departments.set('qa', {
            name: 'Quality Assurance',
            icon: '🔍',
            color: '#8B5CF6',
            roles: ['qa_lead', 'test_engineer', 'automation_specialist'],
            capabilities: ['testing', 'automation', 'quality_control', 'bug_tracking'],
            specialties: ['e2e_testing', 'performance_testing', 'security_testing']
        });
        
        // Product & Design
        this.departments.set('product', {
            name: 'Product Management',
            icon: '📊',
            color: '#6366F1',
            roles: ['product_manager', 'product_analyst', 'user_researcher'],
            capabilities: ['product_strategy', 'user_research', 'analytics', 'roadmap_planning'],
            specialties: ['feature_planning', 'user_feedback', 'market_analysis']
        });
        
        // Security
        this.departments.set('security', {
            name: 'Cybersecurity',
            icon: '🛡️',
            color: '#DC2626',
            roles: ['security_lead', 'penetration_tester', 'compliance_officer'],
            capabilities: ['security_audit', 'vulnerability_assessment', 'compliance', 'incident_response'],
            specialties: ['threat_analysis', 'security_architecture', 'compliance_monitoring']
        });
        
        // Data & Analytics
        this.departments.set('data', {
            name: 'Data & Analytics',
            icon: '📈',
            color: '#059669',
            roles: ['data_lead', 'data_engineer', 'business_analyst'],
            capabilities: ['data_pipeline', 'analytics', 'reporting', 'data_visualization'],
            specialties: ['etl', 'business_intelligence', 'predictive_analytics']
        });
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                agents: this.agents.size,
                departments: this.departments.size,
                phase: this.currentPhase,
                timestamp: Date.now()
            });
        });
        
        // Agent registration with department assignment
        this.app.post('/api/agents/register', (req, res) => {
            const agent = {
                id: req.body.id,
                role: req.body.role,
                department: req.body.department,
                specialties: req.body.specialties || [],
                capabilities: req.body.capabilities || [],
                status: 'active',
                performance: { completed: 0, success_rate: 100 },
                registeredAt: Date.now(),
                lastSeen: Date.now()
            };
            
            this.agents.set(agent.id, agent);
            console.log(`✅ ${agent.department.toUpperCase()} Agent registered: ${agent.id} (${agent.role})`);
            
            res.json({ success: true, message: 'Hierarchical agent registered successfully' });
        });
        
        // Smart task submission with automatic routing
        this.app.post('/api/tasks/submit', (req, res) => {
            const task = {
                id: this.generateTaskId(),
                description: req.body.description || 'Generic task',
                priority: req.body.priority || 'medium', // high, medium, low
                requirements: req.body.requirements || [],
                context: req.body.context || '',
                deadline: req.body.deadline || null,
                status: 'analyzing',
                createdAt: Date.now(),
                assignedAgent: null,
                assignedDepartment: null,
                routingDecision: null
            };
            
            this.tasks.push(task);
            console.log(`📝 Task received: "${task.description}" (Priority: ${task.priority})`);
            
            // Intelligent task routing
            this.intelligentTaskRouting(task);
            
            res.json({ 
                success: true, 
                taskId: task.id, 
                task,
                routing: task.routingDecision
            });
        });
        
        // Spawn specialized agents
        this.app.post('/api/agents/spawn', async (req, res) => {
            const { count = 1, department, role, specialties = [] } = req.body;
            
            try {
                const spawnedAgents = await this.spawnSpecializedAgents(count, department, role, specialties);
                this.updateGrowthPhase();
                
                res.json({ 
                    success: true, 
                    spawnedAgents: spawnedAgents.length,
                    totalAgents: this.agents.size,
                    phase: this.currentPhase,
                    agents: spawnedAgents
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
        
        // Department overview
        this.app.get('/api/departments', (req, res) => {
            const departmentStats = {};
            
            for (const [deptId, dept] of this.departments) {
                const deptAgents = Array.from(this.agents.values())
                    .filter(agent => agent.department === deptId);
                
                departmentStats[deptId] = {
                    ...dept,
                    agentCount: deptAgents.length,
                    activeAgents: deptAgents.filter(a => a.status === 'active').length,
                    totalTasks: this.tasks.filter(t => t.assignedDepartment === deptId).length,
                    avgPerformance: this.calculateDepartmentPerformance(deptId)
                };
            }
            
            res.json(departmentStats);
        });
        
        // Enhanced dashboard
        this.app.get('/', (req, res) => {
            res.send(this.generateHierarchicalDashboard());
        });
    }
    
    intelligentTaskRouting(task) {
        console.log(`🧠 Analyzing task: "${task.description}"`);
        
        // Route to appropriate department and agent
        const routingDecision = this.taskRouter.analyzeAndRoute(task, this.departments, this.agents);
        
        task.assignedDepartment = routingDecision.department;
        task.assignedAgent = routingDecision.agent;
        task.routingDecision = routingDecision;
        task.status = 'assigned';
        task.assignedAt = Date.now();
        
        console.log(`📋 Task "${task.description}" → ${routingDecision.department.toUpperCase()} → ${routingDecision.agent} (Confidence: ${routingDecision.confidence}%)`);
        
        // Simulate task execution
        this.simulateTaskExecution(task);
    }
    
    async simulateTaskExecution(task) {
        // Simulate execution time based on priority
        const executionTime = task.priority === 'high' ? 3000 : 
                             task.priority === 'medium' ? 6000 : 9000;
        
        setTimeout(() => {
            task.status = 'completed';
            task.completedAt = Date.now();
            
            // Update agent performance
            const agent = this.agents.get(task.assignedAgent);
            if (agent) {
                agent.performance.completed++;
                agent.lastSeen = Date.now();
            }
            
            console.log(`✅ Task completed: "${task.description}" by ${task.assignedAgent} (${task.assignedDepartment})`);
            this.broadcastUpdate();
        }, executionTime);
    }
    
    async startInitialAgents() {
        console.log('🏢 Spawning initial departmental agents...');
        
        // Spawn one agent per department initially
        const initialAgents = [
            { department: 'executive', role: 'ceo', specialties: ['strategic_planning'] },
            { department: 'frontend', role: 'frontend_lead', specialties: ['react', 'ui_design'] },
            { department: 'backend', role: 'backend_lead', specialties: ['nodejs', 'api_development'] },
            { department: 'devops', role: 'devops_lead', specialties: ['docker', 'ci_cd'] },
            { department: 'qa', role: 'qa_lead', specialties: ['automation', 'testing'] },
            { department: 'ai_ml', role: 'ml_lead', specialties: ['machine_learning'] },
            { department: 'security', role: 'security_lead', specialties: ['security_audit'] },
            { department: 'data', role: 'data_lead', specialties: ['analytics'] }
        ];
        
        for (let i = 0; i < initialAgents.length; i++) {
            setTimeout(() => {
                this.spawnSpecializedAgent(
                    initialAgents[i].department, 
                    initialAgents[i].role, 
                    initialAgents[i].specialties
                );
            }, i * 1000);
        }
    }
    
    async spawnSpecializedAgent(department, role, specialties = []) {
        const deptConfig = this.departments.get(department);
        if (!deptConfig) {
            throw new Error(`Unknown department: ${department}`);
        }
        
        const agentId = `${department}_${role}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        
        const agent = {
            id: agentId,
            role: role,
            department: department,
            specialties: specialties,
            capabilities: deptConfig.capabilities,
            status: 'active',
            performance: { completed: 0, success_rate: 100, efficiency: 95 },
            spawnedAt: Date.now(),
            departmentInfo: deptConfig
        };
        
        this.agents.set(agentId, agent);
        
        console.log(`🤖 ${deptConfig.icon} ${deptConfig.name}: ${agentId} spawned (${role})`);
        
        return agent;
    }
    
    async spawnSpecializedAgents(count, department, role, specialties) {
        const spawnedAgents = [];
        
        for (let i = 0; i < count; i++) {
            const agent = await this.spawnSpecializedAgent(department, role, specialties);
            spawnedAgents.push(agent);
            
            // Stagger spawning
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return spawnedAgents;
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            console.log('🔗 Dashboard connected');
            
            // Send initial state
            ws.send(JSON.stringify({
                type: 'initial_state',
                data: {
                    agents: this.agents.size,
                    departments: this.departments.size,
                    tasks: this.tasks.length,
                    phase: this.currentPhase
                }
            }));
        });
    }
    
    broadcastUpdate() {
        const updateData = {
            type: 'system_update',
            data: {
                agents: this.agents.size,
                tasks: this.tasks.length,
                phase: this.currentPhase,
                timestamp: Date.now(),
                recentTasks: this.tasks.slice(-3)
            }
        };
        
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(updateData));
            }
        });
    }
    
    calculateDepartmentPerformance(deptId) {
        const deptAgents = Array.from(this.agents.values())
            .filter(agent => agent.department === deptId);
        
        if (deptAgents.length === 0) return 0;
        
        const avgPerformance = deptAgents.reduce((sum, agent) => 
            sum + agent.performance.efficiency, 0) / deptAgents.length;
        
        return Math.round(avgPerformance);
    }
    
    generateHierarchicalDashboard() {
        const departmentCards = Array.from(this.departments.entries()).map(([deptId, dept]) => {
            const deptAgents = Array.from(this.agents.values())
                .filter(agent => agent.department === deptId);
            const deptTasks = this.tasks.filter(t => t.assignedDepartment === deptId);
            
            return `
                <div class="department-card" style="border-color: ${dept.color}">
                    <div class="dept-header">
                        <span class="dept-icon">${dept.icon}</span>
                        <h3>${dept.name}</h3>
                        <span class="agent-count">${deptAgents.length}</span>
                    </div>
                    <div class="dept-stats">
                        <div>Active: ${deptAgents.filter(a => a.status === 'active').length}</div>
                        <div>Tasks: ${deptTasks.length}</div>
                        <div>Completed: ${deptTasks.filter(t => t.status === 'completed').length}</div>
                    </div>
                    <div class="dept-agents">
                        ${deptAgents.map(agent => `
                            <div class="agent-badge" title="${agent.specialties.join(', ')}">
                                ${agent.role.replace(/_/g, ' ')}
                            </div>
                        `).join('')}
                    </div>
                    <button class="spawn-btn" onclick="spawnDepartmentAgent('${deptId}')">
                        Spawn ${dept.name} Agent
                    </button>
                </div>
            `;
        }).join('');
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>🏢 Tritons Hierarchical Agent System</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            min-height: 100vh;
            padding: 20px;
        }
        
        .header { 
            text-align: center; 
            color: white; 
            margin-bottom: 30px; 
        }
        
        .stats-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            color: white;
            text-align: center;
            backdrop-filter: blur(10px);
        }
        
        .stat-number { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; opacity: 0.8; }
        
        .departments-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .department-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            border-left: 4px solid;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .department-card:hover { transform: translateY(-2px); }
        
        .dept-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .dept-icon { font-size: 24px; }
        .dept-header h3 { flex: 1; color: #333; }
        .agent-count { 
            background: #e9ecef; 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: bold;
        }
        
        .dept-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 15px;
            font-size: 12px;
            color: #666;
        }
        
        .dept-agents {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-bottom: 15px;
        }
        
        .agent-badge {
            background: #f8f9fa;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            color: #495057;
            text-transform: capitalize;
        }
        
        .spawn-btn {
            width: 100%;
            padding: 10px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }
        
        .spawn-btn:hover { background: #5a6fd8; }
        
        .task-submission {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #333;
        }
        
        .form-control {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .priority-buttons {
            display: flex;
            gap: 10px;
        }
        
        .priority-btn {
            padding: 8px 16px;
            border: 2px solid;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .priority-btn.high { border-color: #dc3545; color: #dc3545; }
        .priority-btn.medium { border-color: #ffc107; color: #856404; }
        .priority-btn.low { border-color: #28a745; color: #28a745; }
        
        .priority-btn.active { background-color: currentColor; color: white; }
        
        .recent-tasks {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .task-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            margin-bottom: 10px;
        }
        
        .task-status {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .status-completed { background: #d4edda; color: #155724; }
        .status-assigned { background: #cce5ff; color: #004085; }
        .status-analyzing { background: #fff3cd; color: #856404; }
        
        @media (max-width: 768px) {
            .departments-grid { grid-template-columns: 1fr; }
            .stats-bar { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏢 Tritons Hierarchical Agent System</h1>
        <p>Intelligent Task Routing & Department Specialization</p>
    </div>
    
    <div class="stats-bar">
        <div class="stat-card">
            <div class="stat-number" id="total-agents">${this.agents.size}</div>
            <div class="stat-label">Total Agents</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="total-departments">${this.departments.size}</div>
            <div class="stat-label">Departments</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="total-tasks">${this.tasks.length}</div>
            <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="completed-tasks">${this.tasks.filter(t => t.status === 'completed').length}</div>
            <div class="stat-label">Completed</div>
        </div>
    </div>
    
    <div class="task-submission">
        <h3>🎯 Smart Task Submission</h3>
        <p style="margin-bottom: 20px; color: #666;">Describe your task - our AI will automatically route it to the right department and specialist!</p>
        
        <div class="form-group">
            <label>Task Description</label>
            <textarea class="form-control" id="task-description" rows="3" 
                placeholder="e.g., Build a responsive login page with authentication, Fix database performance issues, Deploy application to AWS..."></textarea>
        </div>
        
        <div class="form-group">
            <label>Priority Level</label>
            <div class="priority-buttons">
                <button class="priority-btn high" onclick="setPriority('high')">🔥 High</button>
                <button class="priority-btn medium active" onclick="setPriority('medium')">⚡ Medium</button>
                <button class="priority-btn low" onclick="setPriority('low')">📅 Low</button>
            </div>
        </div>
        
        <button class="spawn-btn" onclick="submitIntelligentTask()" style="margin-top: 15px;">
            🧠 Submit Task (Auto-Route)
        </button>
    </div>
    
    <div class="departments-grid">
        ${departmentCards}
    </div>
    
    <div class="recent-tasks">
        <h3>📋 Recent Task Activity</h3>
        <div id="recent-tasks-container">
            ${this.tasks.slice(-5).map(task => `
                <div class="task-item">
                    <div>
                        <strong>${task.description}</strong><br>
                        <small>${task.assignedDepartment ? task.assignedDepartment.toUpperCase() : 'Unassigned'} → ${task.assignedAgent || 'Pending'}</small>
                    </div>
                    <div class="task-status status-${task.status}">${task.status.toUpperCase()}</div>
                </div>
            `).join('') || '<div class="task-item"><div>No tasks yet - submit one above!</div></div>'}
        </div>
    </div>
    
    <script>
        let selectedPriority = 'medium';
        
        // WebSocket connection
        const ws = new WebSocket('ws://localhost:8080');
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'system_update') {
                updateStats(data.data);
                updateRecentTasks(data.data.recentTasks);
            }
        };
        
        function updateStats(data) {
            document.getElementById('total-agents').textContent = data.agents;
            document.getElementById('total-tasks').textContent = data.tasks;
        }
        
        function updateRecentTasks(tasks) {
            const container = document.getElementById('recent-tasks-container');
            container.innerHTML = tasks.map(task => \`
                <div class="task-item">
                    <div>
                        <strong>\${task.description}</strong><br>
                        <small>\${task.assignedDepartment ? task.assignedDepartment.toUpperCase() : 'Unassigned'} → \${task.assignedAgent || 'Pending'}</small>
                    </div>
                    <div class="task-status status-\${task.status}">\${task.status.toUpperCase()}</div>
                </div>
            \`).join('');
        }
        
        function setPriority(priority) {
            selectedPriority = priority;
            document.querySelectorAll('.priority-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector(\`.priority-btn.\${priority}\`).classList.add('active');
        }
        
        async function submitIntelligentTask() {
            const description = document.getElementById('task-description').value.trim();
            
            if (!description) {
                alert('Please enter a task description');
                return;
            }
            
            try {
                const response = await fetch('/api/tasks/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: description,
                        priority: selectedPriority
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(\`✅ Task submitted successfully!\\n\\nRouted to: \${result.routing.department.toUpperCase()}\\nAssigned to: \${result.routing.agent}\\nConfidence: \${result.routing.confidence}%\`);
                    document.getElementById('task-description').value = '';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    alert('❌ Task submission failed');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('❌ Network error');
            }
        }
        
        async function spawnDepartmentAgent(department) {
            try {
                const response = await fetch('/api/agents/spawn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        department: department,
                        role: department + '_specialist',
                        count: 1
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(\`✅ Spawned \${result.spawnedAgents} new \${department} agent(s)!\`);
                    setTimeout(() => location.reload(), 1000);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            fetch('/api/departments')
                .then(response => response.json())
                .then(data => {
                    // Update department stats
                    console.log('Department stats updated');
                })
                .catch(error => console.error('Error updating stats:', error));
        }, 30000);
    </script>
</body>
</html>`;
    }
    
    updateGrowthPhase() {
        const agentCount = this.agents.size;
        const oldPhase = this.currentPhase;
        
        if (agentCount <= 15) {
            this.currentPhase = 'bootstrap';
        } else if (agentCount <= 100) {
            this.currentPhase = 'departmental';
        } else {
            this.currentPhase = 'enterprise';
        }
        
        if (oldPhase !== this.currentPhase) {
            console.log(`📈 Growth phase: ${oldPhase} → ${this.currentPhase}`);
        }
    }
    
    generateTaskId() {
        return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    }
    
    start() {
        this.server.listen(8080, () => {
            console.log('');
            console.log('🌐 Hierarchical Agent Dashboard: http://localhost:8080');
            console.log('');
            console.log('🏢 Departments Active:');
            for (const [id, dept] of this.departments) {
                console.log(`  ${dept.icon} ${dept.name}`);
            }
            console.log('');
            console.log('✨ Submit any task - AI will route to the right specialist!');
        });
    }
}

class TaskRouter {
    analyzeAndRoute(task, departments, agents) {
        const analysis = this.analyzeTaskContent(task.description.toLowerCase());
        
        // Find best department match
        const departmentScores = new Map();
        
        for (const [deptId, dept] of departments) {
            let score = 0;
            
            // Check capabilities match
            for (const capability of dept.capabilities) {
                if (analysis.keywords.includes(capability) || 
                    analysis.keywords.some(kw => capability.includes(kw))) {
                    score += 10;
                }
            }
            
            // Check specialties match
            if (dept.specialties) {
                for (const specialty of dept.specialties) {
                    if (analysis.keywords.includes(specialty) || 
                        analysis.keywords.some(kw => specialty.includes(kw))) {
                        score += 15;
                    }
                }
            }
            
            // Domain-specific scoring
            score += this.getDomainScore(analysis.domain, deptId);
            
            if (score > 0) {
                departmentScores.set(deptId, score);
            }
        }
        
        // Get best department
        const bestDept = Array.from(departmentScores.entries())
            .sort((a, b) => b[1] - a[1])[0];
        
        if (!bestDept) {
            // Fallback to backend for unknown tasks
            const fallbackDept = 'backend';
            const fallbackAgent = this.findBestAgent(fallbackDept, agents, task.priority);
            
            return {
                department: fallbackDept,
                agent: fallbackAgent,
                confidence: 50,
                reasoning: 'Fallback routing - task type unclear'
            };
        }
        
        const selectedDept = bestDept[0];
        const confidence = Math.min(95, bestDept[1] * 2);
        
        // Find best agent in department
        const bestAgent = this.findBestAgent(selectedDept, agents, task.priority);
        
        return {
            department: selectedDept,
            agent: bestAgent,
            confidence: confidence,
            reasoning: `Matched ${analysis.keywords.length} keywords, domain: ${analysis.domain}`
        };
    }
    
    analyzeTaskContent(description) {
        const keywords = [];
        const domain = this.identifyDomain(description);
        
        // Extract relevant keywords
        const words = description.match(/\b\w{3,}\b/g) || [];
        
        // Technology keywords
        const techKeywords = ['react', 'vue', 'angular', 'nodejs', 'python', 'javascript', 
                             'database', 'sql', 'api', 'frontend', 'backend', 'ui', 'ux', 
                             'deploy', 'docker', 'kubernetes', 'aws', 'testing', 'security',
                             'machine', 'learning', 'ai', 'data', 'analytics'];
        
        words.forEach(word => {
            if (techKeywords.some(tech => word.includes(tech) || tech.includes(word))) {
                keywords.push(word);
            }
        });
        
        return { keywords, domain, originalWords: words };
    }
    
    identifyDomain(description) {
        if (/frontend|ui|ux|design|component|responsive/i.test(description)) return 'frontend';
        if (/backend|api|server|database|microservice/i.test(description)) return 'backend';
        if (/deploy|docker|kubernetes|infrastructure|ci\/cd/i.test(description)) return 'devops';
        if (/test|qa|quality|bug|automation/i.test(description)) return 'qa';
        if (/machine learning|ai|ml|data science|model/i.test(description)) return 'ai_ml';
        if (/security|audit|vulnerability|compliance/i.test(description)) return 'security';
        if (/data|analytics|reporting|dashboard/i.test(description)) return 'data';
        if (/product|feature|user|requirements/i.test(description)) return 'product';
        
        return 'general';
    }
    
    getDomainScore(domain, deptId) {
        const domainMatches = {
            'frontend': { 'frontend': 20, 'product': 5 },
            'backend': { 'backend': 20, 'devops': 5 },
            'devops': { 'devops': 20, 'backend': 5 },
            'qa': { 'qa': 20, 'backend': 3 },
            'ai_ml': { 'ai_ml': 20, 'data': 10 },
            'security': { 'security': 20, 'devops': 8 },
            'data': { 'data': 20, 'ai_ml': 10 },
            'product': { 'product': 20, 'frontend': 5 }
        };
        
        return domainMatches[domain]?.[deptId] || 0;
    }
    
    findBestAgent(department, agents, priority) {
        const deptAgents = Array.from(agents.values())
            .filter(agent => agent.department === department && agent.status === 'active');
        
        if (deptAgents.length === 0) {
            return `${department}_auto_spawn_${Date.now()}`;
        }
        
        // Priority-based selection
        if (priority === 'high') {
            // Find best performing agent
            const bestAgent = deptAgents.sort((a, b) => 
                b.performance.success_rate - a.performance.success_rate)[0];
            return bestAgent.id;
        } else {
            // Round-robin or least loaded
            const leastLoaded = deptAgents.sort((a, b) => 
                a.performance.completed - b.performance.completed)[0];
            return leastLoaded.id;
        }
    }
}

// Start the hierarchical system
const orchestrator = new IntelligentMasterOrchestrator();
orchestrator.start();