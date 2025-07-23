# TRITONS API Endpoints Reference

## Overview

This document provides comprehensive documentation for all TRITONS API endpoints, enabling external integrations and third-party applications.

## Base URLs

| Service | Base URL | Purpose |
|---------|----------|---------|
| Main TRITONS | `http://localhost:8080` | Core orchestrator and agent management |
| Smart Key Manager | `http://localhost:8082` | API key management and verification |
| Performance Metrics | `http://localhost:8083` | Agent performance and analytics |
| Task Integration | `http://localhost:8084` | Unified task deployment and monitoring |

## Authentication

### API Key Authentication
```bash
# Include API key in header
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8080/api/agents
```

### Basic Authentication (Development Only)
```bash
# For local development
curl -u admin:password \
  http://localhost:8080/api/health
```

## Main TRITONS API (Port 8080)

### System Health

#### GET /health
Get system health status and basic metrics.

**Response:**
```json
{
  "status": "healthy",
  "agents": 9,
  "departments": 7,
  "llm_providers": {
    "claude": {
      "name": "Claude",
      "active_agents": 5,
      "status": "active"
    }
  },
  "phase": "bootstrap",
  "timestamp": 1753247992875
}
```

#### GET /api/status
Detailed system status including all components.

**Response:**
```json
{
  "system": {
    "uptime": 3600,
    "memory_usage": "256MB",
    "cpu_usage": 15.2
  },
  "services": {
    "redis": "connected",
    "key_manager": "available",
    "metrics": "running"
  }
}
```

### Agent Management

#### GET /api/agents
List all active agents and their status.

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_001",
      "type": "backend",
      "department": "ARCHITECTURE",
      "status": "active",
      "current_task": "TASK_123",
      "load": 0.7,
      "success_rate": 0.98,
      "last_activity": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 9,
  "active": 7,
  "idle": 2
}
```

#### GET /api/agents/{agent_id}
Get detailed information about a specific agent.

**Parameters:**
- `agent_id` (string): Unique agent identifier

**Response:**
```json
{
  "id": "agent_001",
  "type": "backend",
  "department": "ARCHITECTURE",
  "status": "active",
  "capabilities": ["javascript", "python", "sql"],
  "performance": {
    "tasks_completed": 45,
    "success_rate": 0.98,
    "avg_response_time": 150,
    "cost_efficiency": 0.08
  },
  "current_task": {
    "id": "TASK_123",
    "title": "Implement Redis clustering",
    "started_at": "2024-01-15T10:00:00Z"
  }
}
```

#### POST /api/agents/{agent_id}/assign
Assign a task to a specific agent.

**Parameters:**
- `agent_id` (string): Target agent ID

**Request Body:**
```json
{
  "task_id": "TASK_456",
  "priority": "high",
  "estimated_duration": 120
}
```

**Response:**
```json
{
  "success": true,
  "agent_id": "agent_001",
  "task_id": "TASK_456",
  "estimated_completion": "2024-01-15T12:00:00Z"
}
```

### Task Management

#### POST /api/tasks/submit
Submit a new task for processing.

**Request Body:**
```json
{
  "title": "Implement new feature",
  "description": "Add user authentication system",
  "type": "development",
  "department": "ARCHITECTURE",
  "priority": "high",
  "requirements": [
    "JWT token implementation",
    "Password hashing",
    "Session management"
  ],
  "estimated_hours": 8
}
```

**Response:**
```json
{
  "success": true,
  "task_id": "TASK_789",
  "status": "queued",
  "position": 3,
  "estimated_start": "2024-01-15T11:00:00Z"
}
```

#### GET /api/tasks
List all tasks with filtering options.

**Query Parameters:**
- `status` (optional): Filter by status (queued, in_progress, completed, failed)
- `department` (optional): Filter by department
- `priority` (optional): Filter by priority
- `limit` (optional): Maximum number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "tasks": [
    {
      "id": "TASK_123",
      "title": "Implement Redis clustering",
      "status": "in_progress",
      "priority": "critical",
      "department": "INFRA",
      "assigned_agent": "agent_002",
      "progress": 65,
      "created_at": "2024-01-15T09:00:00Z",
      "started_at": "2024-01-15T09:30:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 50
}
```

#### GET /api/tasks/{task_id}
Get detailed information about a specific task.

**Parameters:**
- `task_id` (string): Task identifier

**Response:**
```json
{
  "id": "TASK_123",
  "title": "Implement Redis clustering",
  "description": "Set up high-availability Redis cluster",
  "status": "in_progress",
  "priority": "critical",
  "department": "INFRA",
  "assigned_agent": "agent_002",
  "progress": 65,
  "subtasks": [
    {
      "id": "subtask_1",
      "title": "Research Redis Cluster",
      "status": "completed"
    },
    {
      "id": "subtask_2",
      "title": "Implement configuration",
      "status": "in_progress"
    }
  ],
  "metrics": {
    "api_calls": 23,
    "cost": 1.25,
    "duration": 3600
  },
  "created_at": "2024-01-15T09:00:00Z",
  "started_at": "2024-01-15T09:30:00Z"
}
```

## Smart Key Manager API (Port 8082)

### Key Management

#### GET /api/keys
List all configured API keys and providers.

**Response:**
```json
{
  "keys": {
    "claude": {
      "provider": "Anthropic",
      "status": "verified",
      "last_tested": "2024-01-15T10:00:00Z",
      "test_success": true
    },
    "openai": {
      "provider": "OpenAI",
      "status": "verified",
      "last_tested": "2024-01-15T10:01:00Z",
      "test_success": true
    }
  },
  "total": 5,
  "verified": 5,
  "providers": ["claude", "openai", "deepseek", "gemini", "groq"]
}
```

#### POST /api/keys/add
Add a new API key.

**Request Body:**
```json
{
  "provider": "claude",
  "key": "your-api-key-here",
  "name": "Production Claude Key"
}
```

**Response:**
```json
{
  "success": true,
  "provider": "claude",
  "status": "verified",
  "message": "API key added and verified successfully"
}
```

#### POST /api/keys/test
Test API key functionality.

**Request Body:**
```json
{
  "provider": "claude",
  "test_prompt": "Hello, world!"
}
```

**Response:**
```json
{
  "success": true,
  "provider": "claude",
  "response_time": 150,
  "cost": 0.001,
  "test_result": "API key working correctly"
}
```

#### DELETE /api/keys/{provider}
Remove an API key.

**Parameters:**
- `provider` (string): Provider name

**Response:**
```json
{
  "success": true,
  "provider": "claude",
  "message": "API key removed successfully"
}
```

### Key Verification

#### POST /api/keys/verify-all
Test all configured API keys.

**Response:**
```json
{
  "results": {
    "claude": {
      "success": true,
      "response_time": 150,
      "cost": 0.001
    },
    "openai": {
      "success": false,
      "error": "Invalid API key"
    }
  },
  "summary": {
    "total": 5,
    "verified": 4,
    "failed": 1
  }
}
```

## Performance Metrics API (Port 8083)

### System Metrics

#### GET /metrics
Get comprehensive system performance metrics.

**Response:**
```json
{
  "system": {
    "uptime": 7200,
    "totalTasks": 156,
    "completedTasks": 142,
    "failedTasks": 3,
    "successRate": "94.2",
    "totalApiCalls": 1247,
    "totalCost": "12.35",
    "avgCostPerTask": "0.08",
    "tasksPerHour": "2.5",
    "activeAgents": 7
  },
  "agents": [
    {
      "id": "agent_001",
      "status": "active",
      "load": 0.7,
      "tasksCompleted": 23,
      "successRate": "96.7",
      "avgResponseTime": 145,
      "costPerTask": "0.07"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /leaderboard
Get agent performance leaderboard.

**Response:**
```json
{
  "leaderboard": [
    {
      "agentId": "agent_003",
      "score": "94.2",
      "tasksCompleted": 45,
      "successRate": "98.0",
      "avgResponseTime": "120",
      "costPerTask": "0.06",
      "rank": 1
    },
    {
      "agentId": "agent_001",
      "score": "91.8",
      "tasksCompleted": 42,
      "successRate": "95.2",
      "avgResponseTime": "145",
      "costPerTask": "0.07",
      "rank": 2
    }
  ],
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Historical Data

#### GET /metrics/history
Get historical performance data.

**Query Parameters:**
- `period` (optional): Time period (hour, day, week, month)
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)

**Response:**
```json
{
  "period": "day",
  "data": [
    {
      "timestamp": "2024-01-15T00:00:00Z",
      "tasks_completed": 45,
      "success_rate": 94.2,
      "avg_response_time": 150,
      "total_cost": 3.45
    }
  ],
  "summary": {
    "total_data_points": 24,
    "avg_success_rate": 94.5,
    "peak_performance_hour": "14:00"
  }
}
```

## Task Integration API (Port 8084)

### Enhanced Dashboard

#### GET /api/dashboard/enhanced
Get comprehensive dashboard data combining all services.

**Response:**
```json
{
  "system": {
    "uptime": 7200,
    "totalTasks": 156,
    "successRate": "94.2",
    "totalCost": "12.35"
  },
  "taskDeployment": {
    "queue": [
      {
        "id": "TASK_789",
        "title": "Implement user authentication",
        "priority": "high",
        "department": "ARCHITECTURE",
        "estimatedHours": 8,
        "priority_score": 85.5
      }
    ],
    "dependencies": {
      "nodes": [
        {
          "id": "TASK_123",
          "label": "Redis Clustering",
          "status": "in_progress",
          "priority": "critical"
        }
      ],
      "edges": [
        {
          "from": "TASK_123",
          "to": "TASK_456"
        }
      ]
    },
    "statistics": {
      "total": 156,
      "ready": 3,
      "blocked": 5,
      "in_progress": 7,
      "completed": 141,
      "criticalPath": ["TASK_123", "TASK_456", "TASK_789"]
    },
    "providers": ["claude", "openai", "deepseek", "gemini", "groq"]
  },
  "agents": [
    {
      "id": "agent_001",
      "status": "active",
      "load": 0.7,
      "tasksCompleted": 23
    }
  ],
  "leaderboard": [
    {
      "agentId": "agent_003",
      "score": "94.2",
      "rank": 1
    }
  ],
  "integrated": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Task Operations

#### POST /api/tasks/submit
Submit a task with dependencies.

**Request Body:**
```json
{
  "id": "TASK_NEW",
  "title": "New Feature Implementation",
  "type": "development",
  "department": "ARCHITECTURE",
  "priority": "high",
  "estimatedHours": 12,
  "dependencies": ["TASK_123", "TASK_456"],
  "requirements": [
    "Database schema updates",
    "API endpoint creation",
    "Frontend integration"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "TASK_NEW",
  "message": "Task queued successfully",
  "dependenciesResolved": false,
  "blockedBy": ["TASK_123"],
  "estimatedStart": "2024-01-15T14:00:00Z"
}
```

#### GET /api/tasks/dependencies
Get task dependency graph.

**Response:**
```json
{
  "nodes": [
    {
      "id": "TASK_123",
      "label": "Redis Clustering",
      "status": "in_progress",
      "priority": "critical"
    }
  ],
  "edges": [
    {
      "from": "TASK_123",
      "to": "TASK_456"
    }
  ]
}
```

#### GET /api/tasks/available
Get tasks ready for execution.

**Response:**
```json
{
  "available": [
    {
      "id": "TASK_789",
      "priority": 85.5,
      "metadata": {
        "title": "User Authentication",
        "department": "ARCHITECTURE",
        "estimatedHours": 8
      }
    }
  ],
  "count": 3
}
```

#### POST /api/tasks/complete
Mark a task as completed.

**Request Body:**
```json
{
  "taskId": "TASK_123",
  "success": true,
  "metrics": {
    "agentId": "agent_002",
    "duration": 3600,
    "apiCalls": 23,
    "cost": 1.25,
    "qualityScore": 0.94
  }
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "TASK_123",
  "newAvailableTasks": [
    {
      "id": "TASK_456",
      "priority": 78.2
    }
  ]
}
```

### Provider Status

#### GET /api/providers
Get API provider status and metrics.

**Response:**
```json
{
  "claude": {
    "available": true,
    "hasKey": true,
    "success": "145",
    "failed": "2",
    "totalCost": "8.45",
    "avgResponseTime": 150
  },
  "openai": {
    "available": true,
    "hasKey": true,
    "success": "89",
    "failed": "1",
    "totalCost": "3.90",
    "avgResponseTime": 200
  }
}
```

## WebSocket Endpoints

### Real-time Updates

#### WS /ws/dashboard
Real-time dashboard updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8084/ws/dashboard');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Dashboard update:', data);
};
```

**Message Format:**
```json
{
  "type": "task_update",
  "data": {
    "taskId": "TASK_123",
    "status": "completed",
    "progress": 100
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### WS /ws/agents
Real-time agent status updates.

**Message Format:**
```json
{
  "type": "agent_status",
  "data": {
    "agentId": "agent_001",
    "status": "active",
    "load": 0.8,
    "currentTask": "TASK_456"
  }
}
```

## Error Handling

### Standard Error Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request body is malformed",
    "details": {
      "field": "priority",
      "expected": "one of: critical, high, medium, low"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_12345"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Resource created |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (e.g., duplicate task ID) |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable |

## Rate Limiting

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /api/* | 1000/hour | 1 hour |
| POST /api/tasks/* | 100/hour | 1 hour |
| WebSocket connections | 10/minute | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```

## SDK Examples

### JavaScript/Node.js

```javascript
const TritonsClient = require('@tritons/client');

const client = new TritonsClient({
  baseUrl: 'http://localhost:8080',
  apiKey: 'your_api_key'
});

// Submit a task
const task = await client.tasks.submit({
  title: 'New Feature',
  department: 'ARCHITECTURE',
  priority: 'high'
});

// Monitor task progress
client.tasks.watch(task.id, (update) => {
  console.log('Task progress:', update.progress);
});
```

### Python

```python
from tritons_client import TritonsClient

client = TritonsClient(
    base_url='http://localhost:8080',
    api_key='your_api_key'
)

# Submit a task
task = client.tasks.submit({
    'title': 'New Feature',
    'department': 'ARCHITECTURE',
    'priority': 'high'
})

# Get task status
status = client.tasks.get(task['id'])
print(f"Task status: {status['status']}")
```

### cURL Examples

```bash
# Submit a task
curl -X POST http://localhost:8080/api/tasks/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "title": "Implement new feature",
    "department": "ARCHITECTURE",
    "priority": "high"
  }'

# Get system health
curl http://localhost:8080/health

# Get performance metrics
curl http://localhost:8083/metrics
```

This comprehensive API reference enables external systems to integrate with TRITONS for task management, monitoring, and automation workflows.