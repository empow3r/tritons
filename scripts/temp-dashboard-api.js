
const express = require('express');
const cors = require('cors');
const app = express();
const port = 8084;

app.use(cors());
app.use(express.json());

// In-memory task storage (will be replaced by real implementation)
let tasks = [];
let agents = [
    { id: 'backend_lead_deepseek', status: 'active', load: 0.3, tasksCompleted: 15 },
    { id: 'frontend_lead_kimi', status: 'active', load: 0.6, tasksCompleted: 8 },
    { id: 'strategy_advisor', status: 'active', load: 0.2, tasksCompleted: 12 }
];

// Dashboard data endpoint
app.get('/api/dashboard/enhanced', (req, res) => {
    res.json({
        system: {
            uptime: Math.floor(process.uptime()),
            totalRequests: 150,
            successRate: '94.2%',
            averageResponseTime: 180,
            totalCost: '2.43',
            tasksPerHour: 12
        },
        agents: agents,
        tasks: tasks,
        taskDeployment: {
            queue: tasks.filter(t => t.status === 'pending'),
            statistics: {
                total: tasks.length,
                completed: tasks.filter(t => t.status === 'completed').length,
                in_progress: tasks.filter(t => t.status === 'assigned').length,
                ready: tasks.filter(t => t.status === 'pending').length
            }
        },
        liveStats: {
            tasksProcessing: tasks.filter(t => t.status === 'assigned').length,
            queueDepth: tasks.filter(t => t.status === 'pending').length,
            agentsActive: agents.filter(a => a.status === 'active').length,
            avgResponseTime: 180,
            successRate: 94.2,
            currentCost: 0.12
        }
    });
});

// Task queue endpoint
app.get('/api/tasks', (req, res) => {
    res.json({ tasks: tasks });
});

// Add task to local storage when submitted
app.post('/api/tasks/local', (req, res) => {
    const task = {
        ...req.body,
        id: 'task_' + Date.now(),
        status: 'assigned',
        createdAt: new Date().toISOString()
    };
    tasks.push(task);
    res.json({ success: true, taskId: task.id });
});

app.listen(port, () => {
    console.log(`🚀 Temporary Dashboard API running on http://localhost:${port}`);
    console.log('   This provides dashboard data while main APIs are being implemented');
});
