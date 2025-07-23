# 🤖 TRITONS - Autonomous AI Agent Swarm Platform

## Overview

TRITONS is the world's first bulletproof autonomous AI agent swarm platform providing enterprise-grade software development as a service. The system is designed for Fortune 500-grade software development with zero human intervention required.

## Key System Characteristics

- **Zero-touch development** - Complete automation from requirements to deployment
- **Multi-machine agent collaboration** - Distributed agents across network infrastructure
- **Bulletproof rate limiting** - Never gets blocked by LLM providers
- **15+ LLM provider support** - Automatic rotation and failover
- **Enterprise compliance** - GDPR, HIPAA, SOX, PCI-DSS automated monitoring
- **5-minute initialization** - From zero to fully operational swarm

## Port Configuration

- **8080**: Main API and Dashboard
- **8082**: Agent Communication
- **8085**: Workflow Visualizer
- **9090**: Prometheus Metrics
- **3000**: Grafana Dashboard

## Quick Start

```bash
# Start the main system
npm start

# Docker deployment (recommended)
docker-compose up -d

# Deploy with auto-scaling
npm run deploy

# Monitor system
npm run monitor
```

## Architecture

### Core Components

- **Multi-LLM Hierarchical System**: Main orchestration with real LLM APIs
- **Agent Governance System**: Lifecycle and compliance management
- **Enhanced Swarm Orchestrator**: Distributed coordination with Raft consensus
- **Enterprise Message Bus**: Inter-agent communication
- **Task Deployment System**: Intelligent task routing and execution

### Department Structure

- **INFRA**: Infrastructure, deployment, DevOps
- **ARCHITECTURE**: System design, architecture decisions
- **AI_ML**: Machine learning, AI implementations
- **QUALITY**: Testing, QA, code review
- **SECURITY**: Security audits, compliance

## NO SIMULATIONS Policy

⚠️ **CRITICAL**: All simulation code has been removed. The system:
- Only executes with real LLM APIs
- Returns errors if no real service is available
- Falls back to local LLMs via Ollama when APIs fail
- Requires `NO_SIMULATIONS=true` environment variable

## Performance Targets

- Agent response time: < 200ms average
- Task completion: 99.9% success rate
- System uptime: 99.99% availability
- Cost per task: < $0.10
- Concurrent tasks: 1000+ simultaneous

## Infrastructure Requirements

### Minimum Deployment
- Docker & Docker Compose
- 8GB+ RAM
- Node.js 16+
- Internet connection

### Production Deployment
- **Orchestrator**: 4 vCPU, 16GB RAM, 100GB SSD
- **Redis Cluster**: 2 vCPU, 8GB RAM, 50GB SSD (3 replicas)
- **PostgreSQL**: 8 vCPU, 32GB RAM, 500GB SSD
- **Agent Workers**: Auto-scaling 5-50 nodes

## Task Management

### Submit Tasks
```bash
# Using task CLI
./tasks/task.sh AI_ML "Implement user authentication"

# Via API
curl -X POST http://localhost:8080/api/tasks/submit \
  -H "Content-Type: application/json" \
  -d '{"type":"ARCHITECTURE","prompt":"Design microservices architecture"}'
```

### Monitor Progress
- Dashboard: http://localhost:8080
- Task Monitor: http://localhost:8085
- Metrics: http://localhost:9090

## Recovery System

### Quick Recovery
```bash
./recovery/quick-recover.sh check    # Check state
./recovery/quick-recover.sh recover  # Recover from last state
./recovery/quick-recover.sh auto     # Auto-recover
```

### Restore Points
```bash
./recovery/restore-point.sh create "description"
./recovery/restore-point.sh list
./recovery/restore-point.sh restore <name>
```

## Enterprise Features

### Security
- Mutual TLS for all communications
- Zero-trust architecture
- Encrypted storage
- Comprehensive audit logging

### Compliance
- GDPR data protection
- HIPAA healthcare compliance
- SOX financial controls
- PCI-DSS payment security
- ISO 27001 alignment

## Related Systems

- **SUPERCLAUDE**: Claude Code IDE enhancement (separate system)
- **kb**: Shared resources and documentation

## Support

For detailed documentation see:
- `docs/TRITONS-ROADMAP-2025.md` - Development roadmap
- `docs/API-ENDPOINTS-REFERENCE.md` - API documentation
- `docs/PRODUCTION-DEPLOYMENT-GUIDE.md` - Deployment guide