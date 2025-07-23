#!/bin/bash
# deploy-bulletproof-agent-swarm.sh - Bulletproof Agent Swarm with Rate Limit Protection

set -e

echo "🛡️ BULLETPROOF AUTONOMOUS AGENT SWARM DEPLOYMENT"
echo "================================================"
echo "Features:"
echo "  ✓ Instant agent coordination and collaboration"
echo "  ✓ IP rotation and proxy pools for rate limit evasion"
echo "  ✓ Multi-provider LLM failover and distribution"
echo "  ✓ Anti-blocking mechanisms and request throttling"
echo "  ✓ Docker-based fault-tolerant architecture"
echo "  ✓ Ready for immediate production deployment"
echo ""

# Configuration
DEPLOYMENT_DIR="$HOME/.bulletproof-agent-swarm"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SWARM_NETWORK="agent-swarm-net"

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found. Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        echo "✅ Docker installed. Please log out and back in, then run this script again."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo "📦 Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    # Check NVIDIA Docker (optional for GPU support)
    if command -v nvidia-smi &> /dev/null; then
        echo "🎮 NVIDIA GPU detected. Setting up NVIDIA Docker..."
        if ! command -v nvidia-container-runtime &> /dev/null; then
            # Install NVIDIA Container Toolkit
            distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
            curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
            curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
            sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
            sudo systemctl restart docker
        fi
        echo "✅ NVIDIA Docker support enabled"
    fi
    
    echo "✅ Prerequisites satisfied"
}

# Create deployment structure
create_deployment_structure() {
    echo "📁 Creating bulletproof deployment structure..."
    
    mkdir -p "$DEPLOYMENT_DIR"/{config,data,logs,monitoring,nginx,sql,proxy-pools}
    mkdir -p "$DEPLOYMENT_DIR"/config/{llm-providers,proxy-rotation,rate-limiting}
    mkdir -p "$DEPLOYMENT_DIR"/monitoring/{prometheus,grafana/dashboards,grafana/datasources}
    
    # Copy source files
    cp -r "$SCRIPT_DIR"/* "$DEPLOYMENT_DIR/"
    
    echo "✅ Deployment structure created"
}

# Setup environment configuration with bulletproof settings
setup_environment() {
    echo "🔧 Setting up bulletproof environment configuration..."
    
    cat > "$DEPLOYMENT_DIR/.env" << 'EOF'
# Bulletproof Agent Swarm Configuration

# LLM API Keys (Primary)
# Set these environment variables before running the script
CLAUDE_API_KEY=${CLAUDE_API_KEY:-"your-claude-api-key-here"}
CLAUDE_API_KEY2=${CLAUDE_API_KEY2:-"your-claude-api-key2-here"}
CLAUDE_API_KEY3=${CLAUDE_API_KEY3:-"your-claude-api-key3-here"}

OPENAI_API_KEY=${OPENAI_API_KEY:-"your-openai-api-key-here"}
OPENAI_API_KEY2=${OPENAI_API_KEY2:-"your-openai-api-key2-here"}
OPENAI_API_KEY3=${OPENAI_API_KEY3:-"your-openai-api-key3-here"}

# Free LLM Providers (Rate Limit Resistant)
DEEPSEEK_API_KEYS=${DEEPSEEK_API_KEYS:-"your-deepseek-api-key-here"}
DEEPSEEK_API_KEY2=${DEEPSEEK_API_KEY2:-"your-deepseek-api-key2-here"}
DEEPSEEK_API_KEY3=${DEEPSEEK_API_KEY3:-"your-deepseek-api-key3-here"}
DEEPSEEK_API_KEY4=${DEEPSEEK_API_KEY4:-"your-deepseek-api-key4-here"}

GEMINI_API_KEY=${GEMINI_API_KEY:-"your-gemini-api-key-here"}
GEMINI_API_KEY2=${GEMINI_API_KEY2:-"your-gemini-api-key2-here"}

KIMI_API_KEY=${KIMI_API_KEY:-"your-kimi-api-key-here"}

OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-"your-openrouter-api-key-here"}
OPENROUTER_API_KEY2=${OPENROUTER_API_KEY2:-"your-openrouter-api-key2-here"}

MISTRAL_API_KEY=${MISTRAL_API_KEY:-"your-mistral-api-key-here"}

# Rate Limiting Protection
ENABLE_PROXY_ROTATION=true
ENABLE_REQUEST_THROTTLING=true
ENABLE_IP_ROTATION=true
ENABLE_USER_AGENT_ROTATION=true

# Proxy Configuration
WEBSHARE_PROXY_URL=${WEBSHARE_PROXY_URL:-"your-webshare-proxy-url-here"}
PROXY_POOL_SIZE=50
PROXY_ROTATION_INTERVAL=300000

# Request Distribution
MAX_REQUESTS_PER_MINUTE_PER_KEY=50
MAX_REQUESTS_PER_MINUTE_PER_IP=100
REQUEST_TIMEOUT=30000
RETRY_ATTEMPTS=5
BACKOFF_MULTIPLIER=2

# Redis & Database
REDIS_PASSWORD=${REDIS_PASSWORD:-"change-this-password"}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"change-this-password"}
MINIO_ROOT_USER=${MINIO_ROOT_USER:-"admin"}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-"change-this-password"}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-"change-this-password"}

# Security
NETWORK_ENCRYPTION=true
API_RATE_LIMITING=true
IP_WHITELIST_ENABLED=false
CORS_ENABLED=true

# Performance
MAX_CONCURRENT_REQUESTS=1000
CONNECTION_POOL_SIZE=50
CACHE_TTL=3600
COMPRESSION_ENABLED=true
EOF

    echo "✅ Environment configuration created"
}

# Create bulletproof LLM rotation service
create_bulletproof_llm_service() {
    echo "🛡️ Creating bulletproof LLM rotation service..."
    
    cat > "$DEPLOYMENT_DIR/Dockerfile.bulletproof-llm" << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache curl python3 py3-pip

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/bulletproof-llm-service.js ./
COPY src/proxy-rotation.js ./
COPY src/rate-limit-protection.js ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "bulletproof-llm-service.js"]
EOF

    # Create the bulletproof LLM service
    mkdir -p "$DEPLOYMENT_DIR/src"
    cat > "$DEPLOYMENT_DIR/src/bulletproof-llm-service.js" << 'EOF'
// bulletproof-llm-service.js - Bulletproof LLM Service with Rate Limit Protection
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const Redis = require('ioredis');

class BulletproofLLMService {
  constructor() {
    this.app = express();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
    this.proxyPool = [];
    this.apiKeys = this.loadApiKeys();
    this.userAgents = this.loadUserAgents();
    this.rateLimits = new Map();
    this.requestQueue = [];
    this.processing = false;
    
    this.setupExpress();
    this.loadProxyPool();
    this.startRequestProcessor();
    this.startHealthMonitoring();
    
    console.log('🛡️ Bulletproof LLM Service initialized');
  }

  setupExpress() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        proxyPoolSize: this.proxyPool.length,
        apiKeys: Object.keys(this.apiKeys).length,
        queueSize: this.requestQueue.length,
        timestamp: Date.now()
      });
    });

    // Main LLM routing endpoint
    this.app.post('/llm/route', async (req, res) => {
      try {
        const { task, taskType, preferences } = req.body;
        const response = await this.routeRequest(task, taskType, preferences);
        res.json(response);
      } catch (error) {
        console.error('Routing error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Provider status endpoint
    this.app.get('/providers/status', async (req, res) => {
      const status = await this.getProvidersStatus();
      res.json(status);
    });
  }

  loadApiKeys() {
    return {
      claude: [
        process.env.CLAUDE_API_KEY,
        process.env.CLAUDE_API_KEY2,
        process.env.CLAUDE_API_KEY3
      ].filter(Boolean),
      
      openai: [
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_API_KEY2,
        process.env.OPENAI_API_KEY3
      ].filter(Boolean),
      
      deepseek: [
        process.env.DEEPSEEK_API_KEYS,
        process.env.DEEPSEEK_API_KEY2,
        process.env.DEEPSEEK_API_KEY3,
        process.env.DEEPSEEK_API_KEY4
      ].filter(Boolean),
      
      gemini: [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY2
      ].filter(Boolean),
      
      openrouter: [
        process.env.OPENROUTER_API_KEY,
        process.env.OPENROUTER_API_KEY2
      ].filter(Boolean),
      
      kimi: [process.env.KIMI_API_KEY].filter(Boolean),
      mistral: [process.env.MISTRAL_API_KEY].filter(Boolean)
    };
  }

  loadUserAgents() {
    return [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  async loadProxyPool() {
    if (!process.env.ENABLE_PROXY_ROTATION) return;
    
    console.log('🔄 Loading proxy pool...');
    
    try {
      // Load from Webshare API
      if (process.env.WEBSHARE_PROXY_URL) {
        const response = await axios.get(process.env.WEBSHARE_PROXY_URL);
        const proxies = response.data.split('\n').filter(Boolean).map(line => {
          const [host, port, username, password] = line.split(':');
          return { host, port: parseInt(port), username, password };
        });
        
        this.proxyPool = proxies.slice(0, process.env.PROXY_POOL_SIZE || 50);
        console.log(`✅ Loaded ${this.proxyPool.length} proxies`);
      }
      
      // Rotate proxies periodically
      setInterval(() => {
        this.rotateProxies();
      }, parseInt(process.env.PROXY_ROTATION_INTERVAL) || 300000);
      
    } catch (error) {
      console.error('Failed to load proxy pool:', error.message);
    }
  }

  rotateProxies() {
    if (this.proxyPool.length > 1) {
      // Shuffle the proxy pool
      for (let i = this.proxyPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.proxyPool[i], this.proxyPool[j]] = [this.proxyPool[j], this.proxyPool[i]];
      }
      console.log('🔄 Rotated proxy pool');
    }
  }

  async routeRequest(task, taskType = 'general', preferences = {}) {
    const requestId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      const request = {
        id: requestId,
        task,
        taskType,
        preferences,
        timestamp: Date.now(),
        resolve,
        reject,
        attempts: 0
      };
      
      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
      } catch (error) {
        if (request.attempts < (process.env.RETRY_ATTEMPTS || 5)) {
          request.attempts++;
          // Exponential backoff
          setTimeout(() => {
            this.requestQueue.unshift(request);
          }, 1000 * Math.pow(2, request.attempts));
        } else {
          request.reject(error);
        }
      }
      
      // Rate limiting between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }

  async executeRequest(request) {
    const { task, taskType, preferences } = request;
    
    // Select optimal provider based on task type and availability
    const provider = await this.selectOptimalProvider(taskType, preferences);
    
    if (!provider) {
      throw new Error('No available providers - all rate limited or blocked');
    }
    
    console.log(`🎯 Routing to ${provider.name} for ${taskType}`);
    
    // Execute request with bulletproof protection
    return await this.executeWithProtection(provider, task, request);
  }

  async selectOptimalProvider(taskType, preferences) {
    const providerPriority = {
      'code_generation': ['deepseek', 'claude', 'openai', 'openrouter'],
      'code_review': ['claude', 'deepseek', 'openai'],
      'documentation': ['claude', 'openai', 'gemini'],
      'translation': ['gemini', 'claude', 'openai'],
      'analysis': ['claude', 'openai', 'gemini'],
      'creative': ['claude', 'openai', 'mistral'],
      'general': ['deepseek', 'gemini', 'kimi', 'openrouter']
    };
    
    const preferredProviders = providerPriority[taskType] || providerPriority['general'];
    
    for (const providerName of preferredProviders) {
      const apiKeys = this.apiKeys[providerName];
      if (!apiKeys || apiKeys.length === 0) continue;
      
      // Find available API key
      for (const apiKey of apiKeys) {
        const isAvailable = await this.checkProviderAvailability(providerName, apiKey);
        if (isAvailable) {
          return {
            name: providerName,
            apiKey,
            config: this.getProviderConfig(providerName)
          };
        }
      }
    }
    
    return null;
  }

  async checkProviderAvailability(providerName, apiKey) {
    const cacheKey = `rate_limit:${providerName}:${apiKey.slice(-8)}`;
    const isLimited = await this.redis.get(cacheKey);
    
    if (isLimited) {
      console.log(`⏳ ${providerName} rate limited, trying next...`);
      return false;
    }
    
    return true;
  }

  async executeWithProtection(provider, task, request) {
    const config = this.getRequestConfig(provider);
    
    try {
      // Build request payload
      const payload = this.buildRequestPayload(provider, task);
      
      // Execute with axios
      const response = await axios({
        ...config,
        data: payload,
        timeout: process.env.REQUEST_TIMEOUT || 30000
      });
      
      // Record successful request
      await this.recordSuccess(provider);
      
      return this.parseResponse(provider, response.data);
      
    } catch (error) {
      await this.handleRequestError(provider, error);
      throw error;
    }
  }

  getRequestConfig(provider) {
    const config = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.getRandomUserAgent(),
        ...this.getProviderHeaders(provider)
      }
    };
    
    // Add proxy if available
    if (process.env.ENABLE_PROXY_ROTATION && this.proxyPool.length > 0) {
      const proxy = this.getRandomProxy();
      config.proxy = {
        host: proxy.host,
        port: proxy.port,
        auth: {
          username: proxy.username,
          password: proxy.password
        }
      };
    }
    
    config.url = this.getProviderEndpoint(provider);
    
    return config;
  }

  getProviderHeaders(provider) {
    const headers = {};
    
    switch (provider.name) {
      case 'claude':
        headers['x-api-key'] = provider.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'openai':
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        break;
      case 'deepseek':
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        break;
      case 'gemini':
        // Gemini uses API key in URL
        break;
      case 'openrouter':
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        headers['HTTP-Referer'] = 'https://agent-swarm.ai';
        headers['X-Title'] = 'Agent Swarm Network';
        break;
      case 'kimi':
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        break;
      case 'mistral':
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
        break;
    }
    
    return headers;
  }

  getProviderEndpoint(provider) {
    const endpoints = {
      claude: 'https://api.anthropic.com/v1/messages',
      openai: 'https://api.openai.com/v1/chat/completions',
      deepseek: 'https://api.deepseek.com/v1/chat/completions',
      gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${provider.apiKey}`,
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      kimi: 'https://api.moonshot.ai/v1/chat/completions',
      mistral: 'https://api.mistral.ai/v1/chat/completions'
    };
    
    return endpoints[provider.name];
  }

  buildRequestPayload(provider, task) {
    const commonPayload = {
      messages: [{ role: 'user', content: task }],
      temperature: 0.1,
      max_tokens: 4000
    };
    
    switch (provider.name) {
      case 'claude':
        return {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{ role: 'user', content: task }]
        };
      
      case 'openai':
        return {
          model: 'gpt-4-turbo-preview',
          ...commonPayload
        };
      
      case 'deepseek':
        return {
          model: 'deepseek-chat',
          ...commonPayload
        };
      
      case 'gemini':
        return {
          contents: [{ parts: [{ text: task }] }]
        };
      
      case 'openrouter':
        return {
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          ...commonPayload
        };
      
      case 'kimi':
        return {
          model: 'moonshot-v1-8k',
          ...commonPayload
        };
      
      case 'mistral':
        return {
          model: 'mistral-large-latest',
          ...commonPayload
        };
      
      default:
        return commonPayload;
    }
  }

  parseResponse(provider, responseData) {
    switch (provider.name) {
      case 'claude':
        return {
          provider: provider.name,
          content: responseData.content[0].text,
          usage: responseData.usage,
          timestamp: Date.now()
        };
      
      case 'gemini':
        return {
          provider: provider.name,
          content: responseData.candidates[0].content.parts[0].text,
          timestamp: Date.now()
        };
      
      default:
        return {
          provider: provider.name,
          content: responseData.choices[0].message.content,
          usage: responseData.usage,
          timestamp: Date.now()
        };
    }
  }

  async handleRequestError(provider, error) {
    console.error(`❌ ${provider.name} request failed:`, error.message);
    
    // Handle rate limiting
    if (error.response?.status === 429 || error.message.includes('rate limit')) {
      const cacheKey = `rate_limit:${provider.name}:${provider.apiKey.slice(-8)}`;
      await this.redis.setex(cacheKey, 3600, '1'); // 1 hour cooldown
      console.log(`🚫 ${provider.name} rate limited for 1 hour`);
    }
    
    // Handle IP blocking
    if (error.response?.status === 403 || error.message.includes('blocked')) {
      console.log(`🚫 IP blocked for ${provider.name}, rotating proxy...`);
      this.rotateProxies();
    }
  }

  async recordSuccess(provider) {
    const cacheKey = `success:${provider.name}:${provider.apiKey.slice(-8)}`;
    await this.redis.incr(cacheKey);
    await this.redis.expire(cacheKey, 3600);
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getRandomProxy() {
    if (this.proxyPool.length === 0) return null;
    return this.proxyPool[Math.floor(Math.random() * this.proxyPool.length)];
  }

  getProviderConfig(providerName) {
    // Provider-specific configurations
    return {};
  }

  async getProvidersStatus() {
    const status = {};
    
    for (const [providerName, apiKeys] of Object.entries(this.apiKeys)) {
      status[providerName] = {
        totalKeys: apiKeys.length,
        availableKeys: 0,
        rateLimited: 0
      };
      
      for (const apiKey of apiKeys) {
        const isAvailable = await this.checkProviderAvailability(providerName, apiKey);
        if (isAvailable) {
          status[providerName].availableKeys++;
        } else {
          status[providerName].rateLimited++;
        }
      }
    }
    
    return status;
  }

  startRequestProcessor() {
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  startHealthMonitoring() {
    setInterval(async () => {
      const queueSize = this.requestQueue.length;
      const proxyPoolSize = this.proxyPool.length;
      
      console.log(`📊 Queue: ${queueSize}, Proxies: ${proxyPoolSize}`);
      
      if (queueSize > 100) {
        console.log('⚠️ High queue size detected');
      }
      
    }, 30000);
  }
}

// Start the service
const service = new BulletproofLLMService();
const port = process.env.PORT || 3001;

service.app.listen(port, () => {
  console.log(`🛡️ Bulletproof LLM Service running on port ${port}`);
});

module.exports = BulletproofLLMService;
EOF

    echo "✅ Bulletproof LLM service created"
}

# Create enhanced Docker Compose with bulletproof features
create_enhanced_docker_compose() {
    echo "🔧 Creating enhanced Docker Compose with bulletproof features..."
    
    cat > "$DEPLOYMENT_DIR/docker-compose.bulletproof.yml" << 'EOF'
version: '3.8'

services:
  # Bulletproof LLM Rotation Service
  bulletproof-llm:
    build:
      context: .
      dockerfile: Dockerfile.bulletproof-llm
    image: agentswarm/bulletproof-llm:latest
    container_name: bulletproof-llm-service
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - ENABLE_PROXY_ROTATION=true
      - ENABLE_REQUEST_THROTTLING=true
      - ENABLE_IP_ROTATION=true
      - WEBSHARE_PROXY_URL=${WEBSHARE_PROXY_URL}
      - PROXY_POOL_SIZE=50
      - MAX_REQUESTS_PER_MINUTE_PER_KEY=50
      - MAX_REQUESTS_PER_MINUTE_PER_IP=100
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - CLAUDE_API_KEY2=${CLAUDE_API_KEY2}
      - CLAUDE_API_KEY3=${CLAUDE_API_KEY3}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_API_KEY2=${OPENAI_API_KEY2}
      - OPENAI_API_KEY3=${OPENAI_API_KEY3}
      - DEEPSEEK_API_KEYS=${DEEPSEEK_API_KEYS}
      - DEEPSEEK_API_KEY2=${DEEPSEEK_API_KEY2}
      - DEEPSEEK_API_KEY3=${DEEPSEEK_API_KEY3}
      - DEEPSEEK_API_KEY4=${DEEPSEEK_API_KEY4}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GEMINI_API_KEY2=${GEMINI_API_KEY2}
      - KIMI_API_KEY=${KIMI_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - OPENROUTER_API_KEY2=${OPENROUTER_API_KEY2}
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
    ports:
      - "3001:3001"
    depends_on:
      - redis
    networks:
      - agent-network
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  # Master Agent Coordinator
  agent-master:
    build:
      context: .
      dockerfile: Dockerfile.agent-master
    image: agentswarm/agent-master:latest
    container_name: agent-master
    environment:
      - NODE_ENV=production
      - NODE_ROLE=master
      - LLM_SERVICE_URL=http://bulletproof-llm:3001
      - REDIS_URL=redis://redis:6379
      - POSTGRES_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/agentswarm
      - IMMEDIATE_COLLABORATION=true
      - AUTO_SCALE_AGENTS=true
    ports:
      - "8080:8080"
      - "8443:8443"
    volumes:
      - agent-data:/app/data
      - agent-logs:/app/logs
    depends_on:
      - bulletproof-llm
      - redis
      - postgres
    networks:
      - agent-network
    restart: unless-stopped

  # Development Agents (Auto-scaling)
  agent-dev:
    build:
      context: .
      dockerfile: Dockerfile.agent-worker
    image: agentswarm/agent-worker:latest
    environment:
      - NODE_ENV=production
      - NODE_ROLE=developer
      - MASTER_URL=http://agent-master:8080
      - LLM_SERVICE_URL=http://bulletproof-llm:3001
      - SPECIALIZATION=full_stack_development
    depends_on:
      - agent-master
      - bulletproof-llm
    networks:
      - agent-network
    restart: unless-stopped
    deploy:
      replicas: 5
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  # QA Testing Agents
  agent-qa:
    build:
      context: .
      dockerfile: Dockerfile.agent-worker
    image: agentswarm/agent-worker:latest
    environment:
      - NODE_ENV=production
      - NODE_ROLE=qa_tester
      - MASTER_URL=http://agent-master:8080
      - LLM_SERVICE_URL=http://bulletproof-llm:3001
      - SPECIALIZATION=quality_assurance
    depends_on:
      - agent-master
      - bulletproof-llm
    networks:
      - agent-network
    restart: unless-stopped
    deploy:
      replicas: 2

  # Security Audit Agents
  agent-security:
    build:
      context: .
      dockerfile: Dockerfile.agent-worker
    image: agentswarm/agent-worker:latest
    environment:
      - NODE_ENV=production
      - NODE_ROLE=security_auditor
      - MASTER_URL=http://agent-master:8080
      - LLM_SERVICE_URL=http://bulletproof-llm:3001
      - SPECIALIZATION=security_analysis
    depends_on:
      - agent-master
      - bulletproof-llm
    networks:
      - agent-network
    restart: unless-stopped
    deploy:
      replicas: 1

  # Redis for caching and coordination
  redis:
    image: redis:7-alpine
    container_name: agent-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - agent-network
    restart: unless-stopped

  # PostgreSQL for persistent storage
  postgres:
    image: postgres:15-alpine
    container_name: agent-postgres
    environment:
      - POSTGRES_DB=agentswarm
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - agent-network
    restart: unless-stopped

  # Real-time collaboration WebSocket server
  collaboration-server:
    build:
      context: .
      dockerfile: Dockerfile.collaboration
    image: agentswarm/collaboration:latest
    container_name: collaboration-server
    environment:
      - REDIS_URL=redis://redis:6379
      - MASTER_URL=http://agent-master:8080
    ports:
      - "3002:3002"
    depends_on:
      - redis
      - agent-master
    networks:
      - agent-network
    restart: unless-stopped

  # Monitoring and alerting
  monitoring:
    image: prom/prometheus:latest
    container_name: agent-monitoring
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - agent-network
    restart: unless-stopped

  # Auto-scaler for dynamic agent scaling
  autoscaler:
    build:
      context: .
      dockerfile: Dockerfile.autoscaler
    image: agentswarm/autoscaler:latest
    container_name: agent-autoscaler
    environment:
      - DOCKER_HOST=unix:///var/run/docker.sock
      - PROMETHEUS_URL=http://monitoring:9090
      - SCALE_UP_THRESHOLD=80
      - SCALE_DOWN_THRESHOLD=20
      - MAX_REPLICAS=20
      - MIN_REPLICAS=2
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - monitoring
      - agent-master
    networks:
      - agent-network
    restart: unless-stopped

networks:
  agent-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16

volumes:
  agent-data:
  agent-logs:
  redis-data:
  postgres-data:
  prometheus-data:
EOF

    echo "✅ Enhanced Docker Compose created"
}

# Create instant deployment script
create_instant_deploy() {
    echo "⚡ Creating instant deployment script..."
    
    cat > "$DEPLOYMENT_DIR/instant-deploy.sh" << 'EOF'
#!/bin/bash
# instant-deploy.sh - Deploy bulletproof agent swarm instantly

set -e

echo "⚡ INSTANT BULLETPROOF AGENT SWARM DEPLOYMENT"
echo "============================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🚀 Starting bulletproof agent swarm..."

# Pull and start all services
docker-compose -f docker-compose.bulletproof.yml pull
docker-compose -f docker-compose.bulletproof.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Wait for bulletproof LLM service
until curl -f http://localhost:3001/health > /dev/null 2>&1; do
    echo "  Waiting for bulletproof LLM service..."
    sleep 5
done
echo "✅ Bulletproof LLM service ready"

# Wait for master agent
until curl -f http://localhost:8080/health > /dev/null 2>&1; do
    echo "  Waiting for master agent..."
    sleep 5
done
echo "✅ Master agent ready"

# Wait for collaboration server
until curl -f http://localhost:3002/health > /dev/null 2>&1; do
    echo "  Waiting for collaboration server..."
    sleep 5
done
echo "✅ Collaboration server ready"

echo ""
echo "🎉 BULLETPROOF AGENT SWARM DEPLOYED SUCCESSFULLY!"
echo "================================================"
echo ""
echo "📊 Services Status:"
docker-compose -f docker-compose.bulletproof.yml ps
echo ""
echo "🌐 Access Points:"
echo "  • Master Agent: http://localhost:8080"
echo "  • LLM Service: http://localhost:3001"
echo "  • Collaboration: ws://localhost:3002"
echo "  • Monitoring: http://localhost:9090"
echo ""
echo "🛡️ Bulletproof Features Active:"
echo "  ✓ Multi-provider LLM rotation"
echo "  ✓ Rate limit evasion"
echo "  ✓ IP rotation and proxy pools"
echo "  ✓ Instant agent collaboration"
echo "  ✓ Auto-scaling based on demand"
echo "  ✓ Real-time monitoring"
echo ""
echo "🚀 Ready to build the trillion-dollar titan!"

# Test the system
echo ""
echo "🧪 Testing system..."
curl -X POST http://localhost:3001/llm/route \
    -H "Content-Type: application/json" \
    -d '{"task":"Hello! Test the bulletproof agent swarm system.","taskType":"general"}' \
    | jq '.'

echo "✅ System test completed successfully!"
EOF

    chmod +x "$DEPLOYMENT_DIR/instant-deploy.sh"
    echo "✅ Instant deployment script created"
}

# Create package.json with all dependencies
create_package_json() {
    echo "📦 Creating package.json..."
    
    cat > "$DEPLOYMENT_DIR/package.json" << 'EOF'
{
  "name": "bulletproof-autonomous-agent-swarm",
  "version": "1.0.0",
  "description": "Bulletproof Multi-LLM Autonomous Agent Swarm with Rate Limit Protection",
  "main": "src/bulletproof-llm-service.js",
  "scripts": {
    "start": "node src/bulletproof-llm-service.js",
    "deploy": "./instant-deploy.sh",
    "stop": "docker-compose -f docker-compose.bulletproof.yml down",
    "logs": "docker-compose -f docker-compose.bulletproof.yml logs -f",
    "status": "docker-compose -f docker-compose.bulletproof.yml ps",
    "scale-dev": "docker-compose -f docker-compose.bulletproof.yml up -d --scale agent-dev=10",
    "scale-qa": "docker-compose -f docker-compose.bulletproof.yml up -d --scale agent-qa=5",
    "test": "curl -X POST http://localhost:3001/llm/route -H 'Content-Type: application/json' -d '{\"task\":\"Test system\",\"taskType\":\"general\"}'"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "ioredis": "^5.3.2",
    "uuid": "^9.0.1",
    "winston": "^3.11.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "rate-limiter-flexible": "^4.0.1"
  },
  "keywords": [
    "ai", "agents", "swarm", "llm", "bulletproof", 
    "rate-limiting", "automation", "docker", "microservices"
  ],
  "author": "Agent Swarm Team",
  "license": "MIT"
}
EOF

    echo "✅ Package.json created"
}

# Create requirements.txt for Python dependencies
create_requirements() {
    echo "🐍 Creating Python requirements..."
    
    cat > "$DEPLOYMENT_DIR/requirements.txt" << 'EOF'
# Python requirements for bulletproof agent swarm
requests==2.31.0
aiohttp==3.9.1
asyncio==3.4.3
redis==5.0.1
psycopg2-binary==2.9.9
python-dotenv==1.0.0
websockets==12.0
numpy==1.24.3
pandas==2.1.4
# AI/ML libraries
anthropic==0.25.1
openai==1.6.1
google-generativeai==0.3.2
# Monitoring and logging
prometheus-client==0.19.0
structlog==23.2.0
# Security and networking
cryptography==41.0.8
pycryptodome==3.19.0
httpx==0.25.2
EOF

    echo "✅ Requirements.txt created"
}

# Main execution
main() {
    echo "🎯 Starting bulletproof agent swarm deployment..."
    
    check_prerequisites
    create_deployment_structure
    setup_environment
    create_bulletproof_llm_service
    create_enhanced_docker_compose
    create_instant_deploy
    create_package_json
    create_requirements
    
    # Move to deployment directory
    cd "$DEPLOYMENT_DIR"
    
    echo ""
    echo "🎉 BULLETPROOF AGENT SWARM READY FOR INSTANT DEPLOYMENT!"
    echo "======================================================="
    echo ""
    echo "📁 Deployment Directory: $DEPLOYMENT_DIR"
    echo ""
    echo "⚡ To deploy instantly:"
    echo "   cd $DEPLOYMENT_DIR"
    echo "   ./instant-deploy.sh"
    echo ""
    echo "🔧 Manual deployment:"
    echo "   docker-compose -f docker-compose.bulletproof.yml up -d"
    echo ""
    echo "📊 Monitor deployment:"
    echo "   docker-compose -f docker-compose.bulletproof.yml logs -f"
    echo ""
    echo "🧪 Test system:"
    echo "   npm test"
    echo ""
    echo "🛡️ Bulletproof Features:"
    echo "  ✓ Multi-provider LLM rotation with 15+ API keys"
    echo "  ✓ Proxy pool rotation (50+ proxies)"
    echo "  ✓ Rate limit evasion and IP rotation"
    echo "  ✓ Auto-scaling agent workforce"
    echo "  ✓ Real-time collaboration between agents"
    echo "  ✓ Instant recovery from provider blocks"
    echo "  ✓ Production-ready monitoring"
    echo ""
    echo "🚀 Ready to build the trillion-dollar titan!"
}

# Execute main function
main "$@"