# TRITONS Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying TRITONS in production environments, from development to enterprise-scale deployments.

## Prerequisites

### System Requirements

#### Minimum Requirements (Development)
- **OS**: macOS 10.15+, Ubuntu 20.04+, or Windows 10+ with WSL2
- **CPU**: 4 cores, 2.5GHz
- **Memory**: 8GB RAM
- **Storage**: 20GB free space
- **Network**: Stable internet connection

#### Recommended Requirements (Production)
- **OS**: Ubuntu 22.04 LTS or macOS
- **CPU**: 8+ cores, 3.0GHz
- **Memory**: 32GB RAM
- **Storage**: 100GB SSD
- **Network**: High-speed internet with static IP

#### Enterprise Requirements (High Availability)
- **Load Balancer**: HAProxy or NGINX
- **Database**: PostgreSQL cluster
- **Cache**: Redis cluster (3+ nodes)
- **Monitoring**: Prometheus + Grafana
- **Storage**: Distributed storage (NFS/S3)

### Software Dependencies

```bash
# Core dependencies
node --version        # v18.0.0+
python3 --version     # v3.9.0+
redis-server --version # v6.0.0+
docker --version      # v20.0.0+

# Optional for enterprise
postgresql --version  # v13.0.0+
nginx --version      # v1.20.0+
```

## Installation Methods

### Method 1: Single Server Deployment (Recommended for Start)

#### Step 1: Environment Setup

```bash
# Clone the repository
git clone https://github.com/your-org/tritons.git
cd tritons

# Install Node.js dependencies
npm install

# Install Python dependencies
pip3 install -r requirements.txt

# Start Redis
brew services start redis  # macOS
# or
sudo systemctl start redis # Linux
```

#### Step 2: Configuration

```bash
# Create environment file
cp .env.example .env

# Edit configuration
vim .env
```

Required environment variables:
```bash
# Core Configuration
NO_SIMULATIONS=true
NODE_ENV=production
LOG_LEVEL=info

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password

# API Configuration
API_KEY_CLAUDE=your_claude_key
API_KEY_OPENAI=your_openai_key
API_KEY_DEEPSEEK=your_deepseek_key

# Optional: Database
DATABASE_URL=postgresql://user:pass@localhost:5432/tritons

# Optional: Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
```

#### Step 3: Start Services

```bash
# Start integrated system
./start-integrated-tritons.sh

# Verify all services are running
./monitor-system.sh status
```

### Method 2: Docker Deployment

#### Step 1: Build Docker Images

```bash
# Build main application
docker build -t tritons:latest .

# Or use docker-compose
docker-compose -f docker-compose.simple.yml up -d
```

#### Step 2: Configure Environment

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  tritons:
    build: .
    ports:
      - "8080:8080"
      - "8082:8082"
    environment:
      - NO_SIMULATIONS=true
      - NODE_ENV=production
      - REDIS_HOST=redis
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

  performance-metrics:
    build: .
    command: node agent-performance-metrics.js
    ports:
      - "8083:8083"
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis-data:
```

#### Step 3: Deploy

```bash
# Deploy with production configuration
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose logs -f
```

### Method 3: Kubernetes Deployment

#### Step 1: Create Kubernetes Manifests

```yaml
# k8s/tritons-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tritons
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tritons
  template:
    metadata:
      labels:
        app: tritons
    spec:
      containers:
      - name: tritons
        image: tritons:latest
        ports:
        - containerPort: 8080
        - containerPort: 8082
        env:
        - name: NO_SIMULATIONS
          value: "true"
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
---
apiVersion: v1
kind: Service
metadata:
  name: tritons-service
spec:
  selector:
    app: tritons
  ports:
  - name: dashboard
    port: 8080
    targetPort: 8080
  - name: key-manager
    port: 8082
    targetPort: 8082
  type: LoadBalancer
```

#### Step 2: Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/tritons
```

## Production Configuration

### Security Hardening

#### SSL/TLS Configuration

```bash
# Generate SSL certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tritons.key -out tritons.crt

# Configure NGINX reverse proxy
cat > /etc/nginx/sites-available/tritons << 'EOF'
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/tritons.crt;
    ssl_certificate_key /path/to/tritons.key;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/keys {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/tritons /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### Firewall Configuration

```bash
# UFW (Ubuntu)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 8080/tcp   # Block direct access
ufw deny 8082/tcp   # Block direct access
ufw enable

# iptables alternative
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j DROP
iptables -A INPUT -p tcp --dport 8082 -j DROP
```

### High Availability Setup

#### Redis Clustering

```bash
# Configure Redis cluster (3 master nodes)
# Node 1 (7001)
redis-server --port 7001 --cluster-enabled yes \
  --cluster-config-file nodes-7001.conf \
  --cluster-node-timeout 5000 \
  --appendonly yes

# Node 2 (7002) 
redis-server --port 7002 --cluster-enabled yes \
  --cluster-config-file nodes-7002.conf \
  --cluster-node-timeout 5000 \
  --appendonly yes

# Node 3 (7003)
redis-server --port 7003 --cluster-enabled yes \
  --cluster-config-file nodes-7003.conf \
  --cluster-node-timeout 5000 \
  --appendonly yes

# Create cluster
redis-cli --cluster create 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 \
  --cluster-replicas 0
```

#### Load Balancer Configuration

```nginx
# /etc/nginx/nginx.conf
upstream tritons_backend {
    least_conn;
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name tritons.company.com;
    
    location / {
        proxy_pass http://tritons_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Health check
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
}
```

## Monitoring & Observability

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'tritons'
    static_configs:
      - targets: ['localhost:8080', 'localhost:8083']
    scrape_interval: 5s
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
```

### Grafana Dashboard

```bash
# Import pre-built dashboard
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @grafana-dashboard.json
```

### Log Management

```bash
# Configure log rotation
cat > /etc/logrotate.d/tritons << 'EOF'
/var/log/tritons/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 tritons tritons
    postrotate
        systemctl reload tritons
    endscript
}
EOF
```

## Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup-tritons.sh

BACKUP_DIR="/backups/tritons/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup Redis data
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/"

# Backup configuration
cp -r /opt/tritons/config "$BACKUP_DIR/"

# Backup logs (last 7 days)
find /var/log/tritons -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/" \;

# Create agent state backup
./claude-agent-backup.sh backup

# Compress backup
cd /backups/tritons
tar -czf "$(basename $BACKUP_DIR).tar.gz" "$(basename $BACKUP_DIR)"
rm -rf "$BACKUP_DIR"

# Clean old backups (keep 30 days)
find /backups/tritons -name "*.tar.gz" -mtime +30 -delete
```

### Recovery Procedures

```bash
# 1. Stop services
systemctl stop tritons
systemctl stop redis

# 2. Restore Redis data
tar -xzf backup_20241201_120000.tar.gz
cp backup_20241201_120000/dump.rdb /var/lib/redis/

# 3. Restore configuration
cp -r backup_20241201_120000/config/* /opt/tritons/config/

# 4. Start services
systemctl start redis
systemctl start tritons

# 5. Verify recovery
./monitor-system.sh status
```

## Performance Optimization

### System Tuning

```bash
# Increase file descriptor limits
echo "tritons soft nofile 65536" >> /etc/security/limits.conf
echo "tritons hard nofile 65536" >> /etc/security/limits.conf

# Optimize TCP settings
cat >> /etc/sysctl.conf << 'EOF'
net.core.somaxconn = 1024
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_fin_timeout = 30
EOF

sysctl -p
```

### Redis Optimization

```bash
# redis.conf optimizations
maxmemory 4gb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 0
save 900 1
save 300 10
save 60 10000
```

### Node.js Optimization

```javascript
// process optimizations
process.env.UV_THREADPOOL_SIZE = 16;

// Memory management
if (process.env.NODE_ENV === 'production') {
    process.on('warning', (warning) => {
        console.warn(warning.name);
        console.warn(warning.message);
        console.warn(warning.stack);
    });
}
```

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check logs
./monitor-system.sh logs

# Check port conflicts
lsof -i :8080
lsof -i :8082

# Check Redis connection
redis-cli ping

# Restart services
./start-integrated-tritons.sh
```

#### High Memory Usage

```bash
# Check memory usage
./monitor-system.sh performance

# Restart specific service
pkill -f agent-performance-metrics.js
node agent-performance-metrics.js &

# Clear Redis cache if needed
redis-cli FLUSHDB
```

#### Slow Performance

```bash
# Check system resources
top -p $(pgrep -f tritons)

# Analyze task queue
redis-cli zrange tritons:tasks:queue 0 -1

# Check API response times
curl -w "@curl-format.txt" -s http://localhost:8080/health
```

## Maintenance

### Regular Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash

# Update system packages
apt update && apt upgrade -y

# Restart services
systemctl restart tritons
systemctl restart redis

# Clean up logs
find /var/log/tritons -name "*.log" -mtime +7 -delete

# Backup system
./backup-tritons.sh

# Run health check
./monitor-system.sh status
```

### Health Checks

```bash
# Set up health check cron job
crontab -e

# Add line:
# */5 * * * * /opt/tritons/monitor-system.sh health > /dev/null 2>&1
```

## Scaling

### Horizontal Scaling

1. **Add Application Nodes**
   ```bash
   # Deploy additional TRITONS instances
   docker-compose -f docker-compose.production.yml up -d --scale tritons=3
   ```

2. **Configure Load Balancer**
   ```bash
   # Update NGINX upstream configuration
   # Add new server entries
   ```

3. **Shared State Management**
   ```bash
   # Ensure all nodes use same Redis cluster
   # Configure shared file storage if needed
   ```

### Vertical Scaling

```bash
# Increase container resources
docker update --memory="8g" --cpus="4.0" tritons_container

# Or update Kubernetes deployment
kubectl patch deployment tritons -p '{"spec":{"template":{"spec":{"containers":[{"name":"tritons","resources":{"limits":{"memory":"8Gi","cpu":"4000m"}}}]}}}}'
```

## Success Metrics

### Key Performance Indicators

- **Uptime**: > 99.9%
- **Response Time**: < 200ms average
- **Task Success Rate**: > 95%
- **Agent Efficiency**: > 80% utilization
- **Cost per Task**: < $0.10

### Monitoring Dashboards

1. **System Health Dashboard**
   - Service status
   - Resource utilization
   - Error rates

2. **Task Performance Dashboard**
   - Task completion rates
   - Queue depths
   - Agent performance

3. **Business Metrics Dashboard**
   - Cost analysis
   - ROI metrics
   - Usage patterns

This guide provides a comprehensive approach to deploying TRITONS in production environments, from simple single-server setups to enterprise-scale high-availability deployments.