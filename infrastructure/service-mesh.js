// service-mesh.js - Enterprise Service Mesh with Circuit Breaker, Load Balancing, and Service Discovery

const EventEmitter = require('events');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// ===== SERVICE REGISTRY =====
class ServiceRegistry extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.healthChecks = new Map();
    this.watchInterval = null;
  }

  register(service) {
    const serviceId = service.id || crypto.randomUUID();
    const registration = {
      id: serviceId,
      name: service.name,
      version: service.version || '1.0.0',
      endpoint: service.endpoint,
      protocol: service.protocol || 'http',
      port: service.port,
      metadata: service.metadata || {},
      tags: service.tags || [],
      healthCheck: service.healthCheck || {
        interval: 30000,
        timeout: 5000,
        path: '/health',
        retries: 3
      },
      status: 'registering',
      registeredAt: Date.now(),
      lastSeen: Date.now()
    };

    this.services.set(serviceId, registration);
    
    // Start health checking
    this.startHealthCheck(serviceId);
    
    this.emit('service:registered', registration);
    
    return serviceId;
  }

  deregister(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) return false;
    
    // Stop health check
    this.stopHealthCheck(serviceId);
    
    this.services.delete(serviceId);
    this.emit('service:deregistered', { serviceId, name: service.name });
    
    return true;
  }

  discover(criteria) {
    const results = [];
    
    for (const [id, service] of this.services) {
      if (this.matchesCriteria(service, criteria)) {
        results.push(service);
      }
    }
    
    return results;
  }

  matchesCriteria(service, criteria) {
    if (criteria.name && service.name !== criteria.name) return false;
    if (criteria.version && service.version !== criteria.version) return false;
    if (criteria.status && service.status !== criteria.status) return false;
    
    if (criteria.tags) {
      for (const tag of criteria.tags) {
        if (!service.tags.includes(tag)) return false;
      }
    }
    
    return true;
  }

  startHealthCheck(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) return;
    
    const check = async () => {
      const healthy = await this.checkHealth(service);
      
      service.status = healthy ? 'healthy' : 'unhealthy';
      service.lastSeen = Date.now();
      
      this.emit('health:checked', { serviceId, healthy, status: service.status });
    };
    
    // Initial check
    check();
    
    // Schedule periodic checks
    const interval = setInterval(check, service.healthCheck.interval);
    this.healthChecks.set(serviceId, interval);
  }

  stopHealthCheck(serviceId) {
    const interval = this.healthChecks.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(serviceId);
    }
  }

  async checkHealth(service) {
    try {
      const url = `${service.protocol}://${service.endpoint}:${service.port}${service.healthCheck.path}`;
      const response = await this.makeHealthRequest(url, service.healthCheck.timeout);
      
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (error) {
      return false;
    }
  }

  makeHealthRequest(url, timeout) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const req = client.get(url, { timeout }, (res) => {
        res.on('data', () => {}); // Consume response
        res.on('end', () => resolve(res));
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });
    });
  }

  getService(serviceId) {
    return this.services.get(serviceId);
  }

  getAllServices() {
    return Array.from(this.services.values());
  }

  getHealthyServices(name) {
    return this.discover({ name, status: 'healthy' });
  }
}

// ===== LOAD BALANCER =====
class LoadBalancer {
  constructor(strategy = 'round-robin') {
    this.strategy = strategy;
    this.currentIndex = 0;
    this.strategies = {
      'round-robin': this.roundRobin.bind(this),
      'least-connections': this.leastConnections.bind(this),
      'weighted': this.weighted.bind(this),
      'random': this.random.bind(this),
      'ip-hash': this.ipHash.bind(this)
    };
    
    this.connectionCounts = new Map();
  }

  selectInstance(instances, context = {}) {
    if (!instances || instances.length === 0) {
      return null;
    }
    
    if (instances.length === 1) {
      return instances[0];
    }
    
    const strategyFunc = this.strategies[this.strategy];
    if (!strategyFunc) {
      throw new Error(`Unknown load balancing strategy: ${this.strategy}`);
    }
    
    return strategyFunc(instances, context);
  }

  roundRobin(instances) {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }

  leastConnections(instances) {
    let minConnections = Infinity;
    let selectedInstance = null;
    
    for (const instance of instances) {
      const connections = this.connectionCounts.get(instance.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedInstance = instance;
      }
    }
    
    return selectedInstance || instances[0];
  }

  weighted(instances) {
    // Assume instances have a 'weight' property
    const totalWeight = instances.reduce((sum, inst) => sum + (inst.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= (instance.weight || 1);
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0];
  }

  random(instances) {
    return instances[Math.floor(Math.random() * instances.length)];
  }

  ipHash(instances, context) {
    if (!context.clientIp) {
      return this.random(instances);
    }
    
    // Simple hash based on IP
    let hash = 0;
    for (let i = 0; i < context.clientIp.length; i++) {
      hash = ((hash << 5) - hash) + context.clientIp.charCodeAt(i);
      hash |= 0;
    }
    
    return instances[Math.abs(hash) % instances.length];
  }

  recordConnection(instanceId) {
    const count = this.connectionCounts.get(instanceId) || 0;
    this.connectionCounts.set(instanceId, count + 1);
  }

  releaseConnection(instanceId) {
    const count = this.connectionCounts.get(instanceId) || 0;
    if (count > 0) {
      this.connectionCounts.set(instanceId, count - 1);
    }
  }

  setStrategy(strategy) {
    if (!this.strategies[strategy]) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.strategy = strategy;
  }
}

// ===== CIRCUIT BREAKER =====
class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000,
      monitoringPeriod: options.monitoringPeriod || 10000,
      minimumRequests: options.minimumRequests || 20,
      errorPercentageThreshold: options.errorPercentageThreshold || 50
    };
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    this.metrics = {
      requests: [],
      windowStart: Date.now()
    };
  }

  async execute(serviceCall) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }
      
      // Try half-open
      this.state = 'HALF_OPEN';
      this.emit('state:changed', { state: 'HALF_OPEN' });
    }
    
    try {
      const result = await serviceCall();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.successes++;
    
    this.recordMetric(true);
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.emit('state:changed', { state: 'CLOSED' });
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    this.recordMetric(false);
    
    if (this.state === 'HALF_OPEN') {
      this.open();
    } else if (this.shouldOpen()) {
      this.open();
    }
  }

  shouldOpen() {
    // Check failure count threshold
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }
    
    // Check error percentage
    const recentMetrics = this.getRecentMetrics();
    if (recentMetrics.total >= this.config.minimumRequests) {
      const errorPercentage = (recentMetrics.failures / recentMetrics.total) * 100;
      return errorPercentage >= this.config.errorPercentageThreshold;
    }
    
    return false;
  }

  open() {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    this.emit('state:changed', { state: 'OPEN' });
    this.emit('circuit:opened', {
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    });
  }

  recordMetric(success) {
    const now = Date.now();
    
    // Clean old metrics
    this.metrics.requests = this.metrics.requests.filter(
      m => now - m.timestamp < this.config.monitoringPeriod
    );
    
    // Add new metric
    this.metrics.requests.push({
      timestamp: now,
      success
    });
  }

  getRecentMetrics() {
    const recent = this.metrics.requests;
    const failures = recent.filter(m => !m.success).length;
    
    return {
      total: recent.length,
      failures,
      successes: recent.length - failures
    };
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      metrics: this.getRecentMetrics()
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.metrics.requests = [];
    
    this.emit('circuit:reset');
  }
}

// ===== SERVICE PROXY =====
class ServiceProxy {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.registry = options.registry;
    this.loadBalancer = new LoadBalancer(options.loadBalancingStrategy || 'round-robin');
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker || {});
    this.retryPolicy = options.retryPolicy || {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2
    };
    
    this.middleware = [];
  }

  use(middlewareFunc) {
    this.middleware.push(middlewareFunc);
  }

  async call(method, params, context = {}) {
    // Apply middleware
    let modifiedParams = params;
    for (const mw of this.middleware) {
      modifiedParams = await mw(method, modifiedParams, context);
    }
    
    return await this.circuitBreaker.execute(async () => {
      return await this.executeWithRetry(method, modifiedParams, context);
    });
  }

  async executeWithRetry(method, params, context) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        // Get healthy instances
        const instances = this.registry.getHealthyServices(this.serviceName);
        if (instances.length === 0) {
          throw new Error(`No healthy instances of ${this.serviceName} available`);
        }
        
        // Select instance
        const instance = this.loadBalancer.selectInstance(instances, context);
        
        // Make request
        const result = await this.makeRequest(instance, method, params);
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryPolicy.maxRetries) {
          // Calculate delay with exponential backoff
          const delay = this.retryPolicy.retryDelay * 
            Math.pow(this.retryPolicy.backoffMultiplier, attempt);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async makeRequest(instance, method, params) {
    // Simulate service call - in production would use actual HTTP/gRPC
    const url = `${instance.protocol}://${instance.endpoint}:${instance.port}/${method}`;
    
    console.log(`→ Calling ${url}`);
    
    // Record connection
    this.loadBalancer.recordConnection(instance.id);
    
    try {
      // Simulate request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate occasional failures for demo
      if (Math.random() < 0.1) {
        throw new Error('Service temporarily unavailable');
      }
      
      return { success: true, data: `Response from ${instance.id}` };
      
    } finally {
      // Release connection
      this.loadBalancer.releaseConnection(instance.id);
    }
  }
}

// ===== SERVICE MESH =====
class ServiceMesh extends EventEmitter {
  constructor() {
    super();
    this.registry = new ServiceRegistry();
    this.proxies = new Map();
    this.config = {
      defaultTimeout: 30000,
      enableMutualTLS: true,
      enableTracing: true,
      enableMetrics: true
    };
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.registry.on('service:registered', (service) => {
      console.log(`✅ Service registered: ${service.name} (${service.id})`);
    });
    
    this.registry.on('service:deregistered', (data) => {
      console.log(`❌ Service deregistered: ${data.name} (${data.serviceId})`);
    });
    
    this.registry.on('health:checked', (data) => {
      if (!data.healthy) {
        console.log(`⚠️ Service unhealthy: ${data.serviceId}`);
      }
    });
  }

  registerService(service) {
    return this.registry.register(service);
  }

  deregisterService(serviceId) {
    return this.registry.deregister(serviceId);
  }

  getProxy(serviceName, options = {}) {
    const key = `${serviceName}:${JSON.stringify(options)}`;
    
    if (!this.proxies.has(key)) {
      const proxy = new ServiceProxy(serviceName, {
        registry: this.registry,
        ...options
      });
      
      // Add default middleware
      if (this.config.enableTracing) {
        proxy.use(this.tracingMiddleware.bind(this));
      }
      
      if (this.config.enableMetrics) {
        proxy.use(this.metricsMiddleware.bind(this));
      }
      
      this.proxies.set(key, proxy);
    }
    
    return this.proxies.get(key);
  }

  async tracingMiddleware(method, params, context) {
    const traceId = context.traceId || crypto.randomUUID();
    const spanId = crypto.randomUUID();
    
    console.log(`🔍 Trace: ${traceId} | Span: ${spanId} | Method: ${method}`);
    
    // Add trace headers to context
    context.traceId = traceId;
    context.spanId = spanId;
    
    return params;
  }

  async metricsMiddleware(method, params, context) {
    const startTime = Date.now();
    
    // Record metric after execution
    context._onComplete = () => {
      const duration = Date.now() - startTime;
      console.log(`📊 Metric: ${method} took ${duration}ms`);
    };
    
    return params;
  }

  discoverServices(criteria) {
    return this.registry.discover(criteria);
  }

  getServiceHealth(serviceName) {
    const services = this.registry.discover({ name: serviceName });
    
    const health = {
      healthy: 0,
      unhealthy: 0,
      total: services.length
    };
    
    for (const service of services) {
      if (service.status === 'healthy') {
        health.healthy++;
      } else {
        health.unhealthy++;
      }
    }
    
    health.percentage = services.length > 0 
      ? (health.healthy / services.length) * 100 
      : 0;
    
    return health;
  }

  getMeshStatus() {
    const services = this.registry.getAllServices();
    const status = {
      services: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      proxies: this.proxies.size,
      serviceDetails: {}
    };
    
    // Group by service name
    for (const service of services) {
      if (!status.serviceDetails[service.name]) {
        status.serviceDetails[service.name] = {
          instances: 0,
          healthy: 0,
          versions: new Set()
        };
      }
      
      status.serviceDetails[service.name].instances++;
      if (service.status === 'healthy') {
        status.serviceDetails[service.name].healthy++;
      }
      status.serviceDetails[service.name].versions.add(service.version);
    }
    
    // Convert sets to arrays
    for (const name in status.serviceDetails) {
      status.serviceDetails[name].versions = 
        Array.from(status.serviceDetails[name].versions);
    }
    
    return status;
  }
}

// ===== EXPORTS =====
module.exports = {
  ServiceMesh,
  ServiceRegistry,
  LoadBalancer,
  CircuitBreaker,
  ServiceProxy
};

// Example usage
if (require.main === module) {
  async function demonstrateServiceMesh() {
    console.log('🌐 Service Mesh Demonstration\n');
    
    const mesh = new ServiceMesh();
    
    // Register services
    console.log('📝 Registering services...\n');
    
    // User service instances
    const user1 = mesh.registerService({
      name: 'user-service',
      version: '1.0.0',
      endpoint: 'localhost',
      port: 3001,
      tags: ['api', 'v1'],
      weight: 2
    });
    
    const user2 = mesh.registerService({
      name: 'user-service',
      version: '1.0.0',
      endpoint: 'localhost',
      port: 3002,
      tags: ['api', 'v1'],
      weight: 1
    });
    
    // Payment service
    const payment1 = mesh.registerService({
      name: 'payment-service',
      version: '2.0.0',
      endpoint: 'localhost',
      port: 3003,
      tags: ['api', 'v2', 'critical']
    });
    
    // Wait for health checks
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Service discovery
    console.log('\n🔍 Service Discovery:');
    const userServices = mesh.discoverServices({ name: 'user-service' });
    console.log(`Found ${userServices.length} user-service instances`);
    
    const criticalServices = mesh.discoverServices({ tags: ['critical'] });
    console.log(`Found ${criticalServices.length} critical services`);
    
    // Use service proxy
    console.log('\n📡 Making service calls:\n');
    
    const userProxy = mesh.getProxy('user-service', {
      loadBalancingStrategy: 'weighted',
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 10000
      }
    });
    
    // Make multiple calls to see load balancing
    for (let i = 0; i < 5; i++) {
      try {
        const result = await userProxy.call('getUser', { id: i }, {
          clientIp: '192.168.1.100'
        });
        console.log(`Call ${i + 1}: ${result.data}`);
      } catch (error) {
        console.log(`Call ${i + 1} failed: ${error.message}`);
      }
    }
    
    // Check mesh status
    console.log('\n📊 Mesh Status:');
    const status = mesh.getMeshStatus();
    console.log(JSON.stringify(status, null, 2));
    
    // Check service health
    console.log('\n❤️ Service Health:');
    const userHealth = mesh.getServiceHealth('user-service');
    console.log(`User Service: ${userHealth.percentage.toFixed(0)}% healthy (${userHealth.healthy}/${userHealth.total})`);
    
    // Simulate service failure
    console.log('\n💥 Simulating service failures...\n');
    
    // Create a proxy with aggressive circuit breaker
    const failingProxy = mesh.getProxy('payment-service', {
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 5000
      }
    });
    
    // Override makeRequest to always fail
    failingProxy.makeRequest = async () => {
      throw new Error('Service unavailable');
    };
    
    // Try multiple calls to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      try {
        await failingProxy.call('processPayment', { amount: 100 });
      } catch (error) {
        console.log(`Payment call ${i + 1}: ${error.message}`);
        const cbState = failingProxy.circuitBreaker.getState();
        console.log(`  Circuit Breaker: ${cbState.state} (failures: ${cbState.failures})`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    mesh.deregisterService(user1);
    mesh.deregisterService(user2);
    mesh.deregisterService(payment1);
  }
  
  demonstrateServiceMesh().catch(console.error);
}