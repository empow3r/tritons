// enterprise-resource-manager.js - Enterprise-Grade Resource Management System

const EventEmitter = require('events');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

// ===== ENTERPRISE STANDARDS ENFORCEMENT =====
class EnterpriseStandardsEnforcer {
  constructor() {
    this.standards = {
      naming: {
        // File naming standards
        files: {
          pattern: /^[a-z]+(-[a-z]+)*\.(js|ts|yaml|yml|json|md)$/,
          maxLength: 64,
          reserved: ['index', 'main', 'app', 'server', 'client'],
          examples: ['user-service.js', 'payment-processor.yaml', 'auth-middleware.ts']
        },
        // Folder naming standards
        folders: {
          pattern: /^[a-z]+(-[a-z]+)*$/,
          maxLength: 32,
          required: ['src', 'test', 'docs', 'config', 'scripts'],
          examples: ['user-management', 'payment-processing', 'auth-services']
        },
        // Service naming standards
        services: {
          pattern: /^[a-z]+-service$/,
          maxLength: 48,
          prefix: {
            'api': 'api-',
            'worker': 'worker-',
            'scheduler': 'scheduler-',
            'gateway': 'gateway-'
          }
        },
        // API endpoint standards
        endpoints: {
          pattern: /^\/api\/v\d+\/[a-z]+(-[a-z]+)*(\/[a-z]+(-[a-z]+)*)*$/,
          versions: ['v1', 'v2', 'v3'],
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          examples: ['/api/v1/users', '/api/v2/payments/process']
        },
        // Database standards
        database: {
          tables: /^[a-z]+(_[a-z]+)*$/,
          columns: /^[a-z]+(_[a-z]+)*$/,
          indexes: /^idx_[a-z]+(_[a-z]+)*$/,
          constraints: /^fk_[a-z]+(_[a-z]+)*$/
        },
        // Environment variables
        environment: {
          pattern: /^[A-Z]+(_[A-Z]+)*$/,
          required: ['NODE_ENV', 'PORT', 'DATABASE_URL', 'API_KEY'],
          prefixes: {
            'database': 'DB_',
            'api': 'API_',
            'service': 'SERVICE_',
            'feature': 'FEATURE_'
          }
        }
      },
      structure: {
        // Standard project structure
        required: [
          'src/',
          'src/controllers/',
          'src/services/',
          'src/models/',
          'src/middlewares/',
          'src/utils/',
          'src/config/',
          'test/',
          'test/unit/',
          'test/integration/',
          'test/e2e/',
          'docs/',
          'docs/api/',
          'docs/architecture/',
          'config/',
          'scripts/',
          'scripts/deployment/',
          'scripts/migration/'
        ],
        // File organization
        fileOrganization: {
          'controllers': ['*-controller.js', '*-controller.ts'],
          'services': ['*-service.js', '*-service.ts'],
          'models': ['*-model.js', '*-model.ts'],
          'middlewares': ['*-middleware.js', '*-middleware.ts'],
          'utils': ['*-util.js', '*-util.ts', '*-helper.js'],
          'config': ['*.config.js', '*.config.yaml', '*.config.json']
        }
      },
      ports: {
        // Standard port allocation
        ranges: {
          'development': { start: 3000, end: 3999 },
          'testing': { start: 4000, end: 4999 },
          'staging': { start: 5000, end: 5999 },
          'production': { start: 8000, end: 8999 },
          'internal': { start: 9000, end: 9999 }
        },
        reserved: {
          3000: 'main-api',
          3001: 'admin-api',
          3002: 'websocket',
          5432: 'postgresql',
          6379: 'redis',
          27017: 'mongodb',
          9200: 'elasticsearch'
        }
      },
      templates: {
        // YAML template standards
        yaml: {
          required: ['version', 'metadata', 'spec'],
          metadata: ['name', 'description', 'author', 'created', 'updated'],
          indentation: 2,
          maxDepth: 5
        },
        // Service template
        service: {
          required: ['name', 'version', 'dependencies', 'endpoints', 'config'],
          optional: ['documentation', 'monitoring', 'scaling']
        }
      },
      code: {
        // Code style standards
        style: {
          maxLineLength: 100,
          indentation: 2,
          quotes: 'single',
          semicolons: true,
          trailingComma: 'es5'
        },
        // Documentation standards
        documentation: {
          required: ['description', 'params', 'returns', 'throws'],
          format: 'jsdoc'
        },
        // Error handling
        errors: {
          format: {
            code: 'UPPERCASE_SNAKE_CASE',
            message: 'Human readable message',
            details: 'object'
          },
          required: ['code', 'message', 'timestamp', 'correlationId']
        }
      }
    };
  }

  validateFileName(filename) {
    const errors = [];
    
    if (!this.standards.naming.files.pattern.test(filename)) {
      errors.push(`Invalid filename format: ${filename}. Must match pattern: lowercase-hyphenated.extension`);
    }
    
    if (filename.length > this.standards.naming.files.maxLength) {
      errors.push(`Filename too long: ${filename}. Max length: ${this.standards.naming.files.maxLength}`);
    }
    
    return { valid: errors.length === 0, errors };
  }

  validateFolderName(foldername) {
    const errors = [];
    
    if (!this.standards.naming.folders.pattern.test(foldername)) {
      errors.push(`Invalid folder name: ${foldername}. Must be lowercase-hyphenated`);
    }
    
    if (foldername.length > this.standards.naming.folders.maxLength) {
      errors.push(`Folder name too long: ${foldername}. Max length: ${this.standards.naming.folders.maxLength}`);
    }
    
    return { valid: errors.length === 0, errors };
  }

  validateServiceName(serviceName, type = 'api') {
    const errors = [];
    const prefix = this.standards.naming.services.prefix[type];
    
    if (prefix && !serviceName.startsWith(prefix)) {
      errors.push(`Service name must start with '${prefix}' for ${type} services`);
    }
    
    if (!this.standards.naming.services.pattern.test(serviceName)) {
      errors.push(`Invalid service name: ${serviceName}. Must end with '-service'`);
    }
    
    return { valid: errors.length === 0, errors };
  }

  validateAPIEndpoint(endpoint) {
    const errors = [];
    
    if (!this.standards.naming.endpoints.pattern.test(endpoint)) {
      errors.push(`Invalid API endpoint: ${endpoint}. Must follow pattern: /api/v{version}/resource`);
    }
    
    return { valid: errors.length === 0, errors };
  }

  validateProjectStructure(projectPath) {
    const errors = [];
    const missing = [];
    
    for (const requiredPath of this.standards.structure.required) {
      // Check if required directory exists
      const fullPath = path.join(projectPath, requiredPath);
      if (!fs.existsSync(fullPath)) {
        missing.push(requiredPath);
      }
    }
    
    if (missing.length > 0) {
      errors.push(`Missing required directories: ${missing.join(', ')}`);
    }
    
    return { valid: errors.length === 0, errors, missing };
  }

  validatePort(port, environment = 'development') {
    const errors = [];
    const range = this.standards.ports.ranges[environment];
    
    if (!range) {
      errors.push(`Unknown environment: ${environment}`);
      return { valid: false, errors };
    }
    
    if (port < range.start || port > range.end) {
      errors.push(`Port ${port} outside allowed range for ${environment}: ${range.start}-${range.end}`);
    }
    
    if (this.standards.ports.reserved[port]) {
      errors.push(`Port ${port} is reserved for: ${this.standards.ports.reserved[port]}`);
    }
    
    return { valid: errors.length === 0, errors };
  }

  generateCompliantName(type, baseN
) {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(3).toString('hex');
    
    switch (type) {
      case 'file':
        return `${baseName}-${hash}.js`;
      case 'folder':
        return `${baseName}-${hash}`;
      case 'service':
        return `${baseName}-service`;
      case 'endpoint':
        return `/api/v1/${baseName}`;
      default:
        return `${baseName}-${timestamp}`;
    }
  }
}

// ===== RESOURCE LOCK MANAGER =====
class ResourceLockManager extends EventEmitter {
  constructor() {
    super();
    this.locks = new Map();
    this.lockHistory = [];
    this.deadlockDetector = new DeadlockDetector();
  }

  async acquireLock(resourceId, agentId, lockType = 'exclusive') {
    const lockKey = this.generateLockKey(resourceId);
    
    // Check if resource is already locked
    if (this.locks.has(lockKey)) {
      const existingLock = this.locks.get(lockKey);
      
      // Check for shared lock compatibility
      if (lockType === 'shared' && existingLock.type === 'shared') {
        existingLock.holders.add(agentId);
        return { success: true, lockId: existingLock.id };
      }
      
      // Lock conflict
      return {
        success: false,
        reason: 'Resource locked',
        holder: existingLock.holder,
        type: existingLock.type
      };
    }
    
    // Create new lock
    const lock = {
      id: crypto.randomUUID(),
      resourceId,
      holder: lockType === 'exclusive' ? agentId : null,
      holders: lockType === 'shared' ? new Set([agentId]) : null,
      type: lockType,
      acquired: Date.now(),
      timeout: Date.now() + 300000 // 5 minute timeout
    };
    
    this.locks.set(lockKey, lock);
    
    // Record in history
    this.lockHistory.push({
      action: 'acquire',
      lockId: lock.id,
      resourceId,
      agentId,
      timestamp: Date.now()
    });
    
    // Set timeout for automatic release
    setTimeout(() => {
      this.autoReleaseLock(lockKey);
    }, 300000);
    
    this.emit('lock:acquired', { resourceId, agentId, lockType });
    
    return { success: true, lockId: lock.id };
  }

  async releaseLock(resourceId, agentId) {
    const lockKey = this.generateLockKey(resourceId);
    const lock = this.locks.get(lockKey);
    
    if (!lock) {
      return { success: false, reason: 'No lock found' };
    }
    
    // Verify agent has permission to release
    if (lock.type === 'exclusive' && lock.holder !== agentId) {
      return { success: false, reason: 'Not lock holder' };
    }
    
    if (lock.type === 'shared') {
      lock.holders.delete(agentId);
      if (lock.holders.size > 0) {
        // Other agents still hold shared lock
        return { success: true, remaining: lock.holders.size };
      }
    }
    
    // Release lock
    this.locks.delete(lockKey);
    
    // Record in history
    this.lockHistory.push({
      action: 'release',
      lockId: lock.id,
      resourceId,
      agentId,
      timestamp: Date.now()
    });
    
    this.emit('lock:released', { resourceId, agentId });
    
    return { success: true };
  }

  autoReleaseLock(lockKey) {
    const lock = this.locks.get(lockKey);
    if (lock && Date.now() > lock.timeout) {
      this.locks.delete(lockKey);
      this.emit('lock:timeout', { resourceId: lock.resourceId });
    }
  }

  checkDeadlock(agentId, requestedResource) {
    return this.deadlockDetector.detectDeadlock(
      this.locks,
      agentId,
      requestedResource
    );
  }

  generateLockKey(resourceId) {
    return `lock:${resourceId}`;
  }

  getLockInfo(resourceId) {
    const lockKey = this.generateLockKey(resourceId);
    return this.locks.get(lockKey);
  }

  getAllLocks() {
    return Array.from(this.locks.entries()).map(([key, lock]) => ({
      resourceId: lock.resourceId,
      type: lock.type,
      holder: lock.holder,
      holders: lock.holders ? Array.from(lock.holders) : null,
      acquired: new Date(lock.acquired).toISOString(),
      timeout: new Date(lock.timeout).toISOString()
    }));
  }
}

// ===== DEADLOCK DETECTOR =====
class DeadlockDetector {
  detectDeadlock(locks, agentId, requestedResource) {
    // Build wait-for graph
    const waitForGraph = new Map();
    
    // Check if requested resource is locked
    const requestedLock = locks.get(`lock:${requestedResource}`);
    if (!requestedLock) return false;
    
    // Simple cycle detection
    const visited = new Set();
    const stack = new Set();
    
    const hasCycle = (agent) => {
      if (stack.has(agent)) return true;
      if (visited.has(agent)) return false;
      
      visited.add(agent);
      stack.add(agent);
      
      // Find resources held by this agent
      for (const [, lock] of locks) {
        if (lock.holder === agent || (lock.holders && lock.holders.has(agent))) {
          // Check who is waiting for these resources
          // This is simplified - in production, track waiting queues
        }
      }
      
      stack.delete(agent);
      return false;
    };
    
    return hasCycle(agentId);
  }
}

// ===== RESOURCE ALLOCATION MANAGER =====
class ResourceAllocationManager extends EventEmitter {
  constructor(standards) {
    super();
    this.standards = standards;
    this.allocations = new Map();
    this.resourcePools = {
      ports: new Map(),
      files: new Map(),
      services: new Map(),
      memory: new Map(),
      connections: new Map()
    };
    this.quotas = {
      maxFilesPerAgent: 100,
      maxMemoryPerAgent: 1024 * 1024 * 512, // 512MB
      maxConnectionsPerAgent: 50,
      maxPortsPerService: 5
    };
  }

  async allocateResource(type, agentId, requirements) {
    // Validate agent quota
    const quotaCheck = this.checkQuota(type, agentId);
    if (!quotaCheck.allowed) {
      return {
        success: false,
        reason: `Quota exceeded: ${quotaCheck.reason}`
      };
    }
    
    // Validate requirements against standards
    const validationResult = this.validateRequirements(type, requirements);
    if (!validationResult.valid) {
      return {
        success: false,
        reason: 'Standards violation',
        errors: validationResult.errors
      };
    }
    
    // Allocate resource
    let allocation;
    switch (type) {
      case 'port':
        allocation = await this.allocatePort(agentId, requirements);
        break;
      case 'file':
        allocation = await this.allocateFile(agentId, requirements);
        break;
      case 'service':
        allocation = await this.allocateService(agentId, requirements);
        break;
      case 'memory':
        allocation = await this.allocateMemory(agentId, requirements);
        break;
      default:
        return { success: false, reason: `Unknown resource type: ${type}` };
    }
    
    if (allocation.success) {
      this.recordAllocation(type, agentId, allocation);
      this.emit('resource:allocated', {
        type,
        agentId,
        resource: allocation.resource
      });
    }
    
    return allocation;
  }

  async allocatePort(agentId, requirements) {
    const { environment = 'development', service } = requirements;
    const range = this.standards.ports.ranges[environment];
    
    if (!range) {
      return { success: false, reason: `Invalid environment: ${environment}` };
    }
    
    // Find available port
    for (let port = range.start; port <= range.end; port++) {
      if (!this.resourcePools.ports.has(port) && 
          !this.standards.ports.reserved[port]) {
        
        this.resourcePools.ports.set(port, {
          agentId,
          service,
          allocated: Date.now()
        });
        
        return {
          success: true,
          resource: { port, environment, service }
        };
      }
    }
    
    return { success: false, reason: 'No available ports in range' };
  }

  async allocateFile(agentId, requirements) {
    const { path: filePath, type } = requirements;
    
    // Validate file path
    const validation = this.standards.validateFileName(path.basename(filePath));
    if (!validation.valid) {
      return {
        success: false,
        reason: 'Invalid filename',
        errors: validation.errors
      };
    }
    
    // Check if file already allocated
    if (this.resourcePools.files.has(filePath)) {
      return {
        success: false,
        reason: 'File already allocated',
        holder: this.resourcePools.files.get(filePath).agentId
      };
    }
    
    // Allocate file
    this.resourcePools.files.set(filePath, {
      agentId,
      type,
      allocated: Date.now()
    });
    
    return {
      success: true,
      resource: { path: filePath, type }
    };
  }

  async allocateService(agentId, requirements) {
    const { name, type = 'api' } = requirements;
    
    // Validate service name
    const validation = this.standards.validateServiceName(name, type);
    if (!validation.valid) {
      return {
        success: false,
        reason: 'Invalid service name',
        errors: validation.errors
      };
    }
    
    // Check if service name already taken
    if (this.resourcePools.services.has(name)) {
      return {
        success: false,
        reason: 'Service name already in use',
        holder: this.resourcePools.services.get(name).agentId
      };
    }
    
    // Allocate service
    this.resourcePools.services.set(name, {
      agentId,
      type,
      allocated: Date.now()
    });
    
    return {
      success: true,
      resource: { name, type }
    };
  }

  async allocateMemory(agentId, requirements) {
    const { size } = requirements;
    const currentUsage = this.getAgentMemoryUsage(agentId);
    
    if (currentUsage + size > this.quotas.maxMemoryPerAgent) {
      return {
        success: false,
        reason: 'Memory quota exceeded',
        current: currentUsage,
        requested: size,
        quota: this.quotas.maxMemoryPerAgent
      };
    }
    
    // Allocate memory
    const allocationId = crypto.randomUUID();
    this.resourcePools.memory.set(allocationId, {
      agentId,
      size,
      allocated: Date.now()
    });
    
    return {
      success: true,
      resource: { allocationId, size }
    };
  }

  async deallocateResource(type, resourceId, agentId) {
    let pool = this.resourcePools[type];
    if (!pool) {
      return { success: false, reason: `Unknown resource type: ${type}` };
    }
    
    const allocation = pool.get(resourceId);
    if (!allocation) {
      return { success: false, reason: 'Resource not found' };
    }
    
    if (allocation.agentId !== agentId) {
      return { success: false, reason: 'Not resource owner' };
    }
    
    pool.delete(resourceId);
    
    this.emit('resource:deallocated', {
      type,
      agentId,
      resourceId
    });
    
    return { success: true };
  }

  checkQuota(type, agentId) {
    const agentAllocations = this.getAgentAllocations(agentId);
    
    switch (type) {
      case 'file':
        const fileCount = agentAllocations.files.length;
        if (fileCount >= this.quotas.maxFilesPerAgent) {
          return {
            allowed: false,
            reason: `File limit reached: ${fileCount}/${this.quotas.maxFilesPerAgent}`
          };
        }
        break;
      
      case 'memory':
        const memoryUsage = this.getAgentMemoryUsage(agentId);
        if (memoryUsage >= this.quotas.maxMemoryPerAgent) {
          return {
            allowed: false,
            reason: `Memory limit reached: ${memoryUsage}/${this.quotas.maxMemoryPerAgent}`
          };
        }
        break;
    }
    
    return { allowed: true };
  }

  validateRequirements(type, requirements) {
    const errors = [];
    
    switch (type) {
      case 'port':
        if (!requirements.environment) {
          errors.push('Environment must be specified for port allocation');
        }
        if (!requirements.service) {
          errors.push('Service name must be specified for port allocation');
        }
        break;
      
      case 'file':
        if (!requirements.path) {
          errors.push('File path must be specified');
        }
        break;
      
      case 'service':
        if (!requirements.name) {
          errors.push('Service name must be specified');
        }
        break;
      
      case 'memory':
        if (!requirements.size || requirements.size <= 0) {
          errors.push('Valid memory size must be specified');
        }
        break;
    }
    
    return { valid: errors.length === 0, errors };
  }

  getAgentAllocations(agentId) {
    const allocations = {
      ports: [],
      files: [],
      services: [],
      memory: []
    };
    
    // Collect all allocations for agent
    for (const [port, alloc] of this.resourcePools.ports) {
      if (alloc.agentId === agentId) {
        allocations.ports.push({ port, ...alloc });
      }
    }
    
    for (const [path, alloc] of this.resourcePools.files) {
      if (alloc.agentId === agentId) {
        allocations.files.push({ path, ...alloc });
      }
    }
    
    for (const [name, alloc] of this.resourcePools.services) {
      if (alloc.agentId === agentId) {
        allocations.services.push({ name, ...alloc });
      }
    }
    
    for (const [id, alloc] of this.resourcePools.memory) {
      if (alloc.agentId === agentId) {
        allocations.memory.push({ id, ...alloc });
      }
    }
    
    return allocations;
  }

  getAgentMemoryUsage(agentId) {
    let total = 0;
    
    for (const [, alloc] of this.resourcePools.memory) {
      if (alloc.agentId === agentId) {
        total += alloc.size;
      }
    }
    
    return total;
  }

  recordAllocation(type, agentId, allocation) {
    if (!this.allocations.has(agentId)) {
      this.allocations.set(agentId, []);
    }
    
    this.allocations.get(agentId).push({
      type,
      resource: allocation.resource,
      timestamp: Date.now()
    });
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPorts: this.resourcePools.ports.size,
        totalFiles: this.resourcePools.files.size,
        totalServices: this.resourcePools.services.size,
        totalMemoryAllocations: this.resourcePools.memory.size
      },
      byAgent: {},
      violations: []
    };
    
    // Generate per-agent report
    for (const [agentId] of this.allocations) {
      report.byAgent[agentId] = this.getAgentAllocations(agentId);
    }
    
    return report;
  }
}

// ===== MAIN ENTERPRISE RESOURCE MANAGER =====
class EnterpriseResourceManager extends EventEmitter {
  constructor() {
    super();
    this.standards = new EnterpriseStandardsEnforcer();
    this.lockManager = new ResourceLockManager();
    this.allocationManager = new ResourceAllocationManager(this.standards);
    
    this.setupEventHandlers();
    console.log('✅ Enterprise Resource Manager initialized');
  }

  setupEventHandlers() {
    // Lock events
    this.lockManager.on('lock:acquired', (data) => {
      console.log(`🔒 Lock acquired: ${data.resourceId} by ${data.agentId}`);
    });
    
    this.lockManager.on('lock:released', (data) => {
      console.log(`🔓 Lock released: ${data.resourceId} by ${data.agentId}`);
    });
    
    this.lockManager.on('lock:timeout', (data) => {
      console.log(`⏱️ Lock timeout: ${data.resourceId}`);
    });
    
    // Allocation events
    this.allocationManager.on('resource:allocated', (data) => {
      console.log(`✅ Resource allocated: ${data.type} to ${data.agentId}`);
    });
    
    this.allocationManager.on('resource:deallocated', (data) => {
      console.log(`♻️ Resource deallocated: ${data.type} from ${data.agentId}`);
    });
  }

  async requestResource(agentId, resourceType, requirements) {
    console.log(`📋 Resource request from ${agentId}: ${resourceType}`);
    
    // First allocate the resource
    const allocation = await this.allocationManager.allocateResource(
      resourceType,
      agentId,
      requirements
    );
    
    if (!allocation.success) {
      return allocation;
    }
    
    // Then acquire lock if needed
    if (requirements.lockType) {
      const resourceId = this.getResourceId(resourceType, allocation.resource);
      const lock = await this.lockManager.acquireLock(
        resourceId,
        agentId,
        requirements.lockType
      );
      
      if (!lock.success) {
        // Rollback allocation
        await this.allocationManager.deallocateResource(
          resourceType,
          resourceId,
          agentId
        );
        
        return {
          success: false,
          reason: 'Failed to acquire lock',
          lockInfo: lock
        };
      }
      
      allocation.lockId = lock.lockId;
    }
    
    return allocation;
  }

  async releaseResource(agentId, resourceType, resourceId) {
    console.log(`♻️ Resource release from ${agentId}: ${resourceType} - ${resourceId}`);
    
    // Release lock if exists
    await this.lockManager.releaseLock(resourceId, agentId);
    
    // Deallocate resource
    return await this.allocationManager.deallocateResource(
      resourceType,
      resourceId,
      agentId
    );
  }

  validateStandards(type, value) {
    switch (type) {
      case 'filename':
        return this.standards.validateFileName(value);
      case 'foldername':
        return this.standards.validateFolderName(value);
      case 'servicename':
        return this.standards.validateServiceName(value);
      case 'endpoint':
        return this.standards.validateAPIEndpoint(value);
      case 'port':
        return this.standards.validatePort(value);
      default:
        return { valid: false, errors: [`Unknown validation type: ${type}`] };
    }
  }

  generateCompliantResource(type, baseName) {
    return this.standards.generateCompliantName(type, baseName);
  }

  getResourceId(resourceType, resource) {
    switch (resourceType) {
      case 'port':
        return `port:${resource.port}`;
      case 'file':
        return `file:${resource.path}`;
      case 'service':
        return `service:${resource.name}`;
      case 'memory':
        return `memory:${resource.allocationId}`;
      default:
        return `${resourceType}:${JSON.stringify(resource)}`;
    }
  }

  getSystemStatus() {
    return {
      locks: this.lockManager.getAllLocks(),
      allocations: this.allocationManager.generateReport(),
      standards: {
        naming: this.standards.standards.naming,
        structure: this.standards.standards.structure,
        ports: this.standards.standards.ports
      }
    };
  }

  async performHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      healthy: true,
      issues: []
    };
    
    // Check for deadlocks
    const locks = this.lockManager.getAllLocks();
    if (locks.length > 100) {
      health.issues.push({
        severity: 'warning',
        message: `High number of active locks: ${locks.length}`
      });
    }
    
    // Check resource usage
    const report = this.allocationManager.generateReport();
    if (report.summary.totalMemoryAllocations > 1000) {
      health.issues.push({
        severity: 'warning',
        message: 'High memory allocation count'
      });
    }
    
    health.healthy = health.issues.filter(i => i.severity === 'error').length === 0;
    
    return health;
  }
}

// ===== EXPORT AND EXAMPLE USAGE =====
module.exports = {
  EnterpriseResourceManager,
  EnterpriseStandardsEnforcer,
  ResourceLockManager,
  ResourceAllocationManager
};

// Example usage
if (require.main === module) {
  const manager = new EnterpriseResourceManager();
  
  async function demonstrateUsage() {
    console.log('\n🏢 Enterprise Resource Manager Demo\n');
    
    // Validate standards
    console.log('📏 Standards Validation:');
    const validations = [
      { type: 'filename', value: 'user-service.js', expected: true },
      { type: 'filename', value: 'UserService.js', expected: false },
      { type: 'servicename', value: 'payment-service', expected: true },
      { type: 'endpoint', value: '/api/v1/users', expected: true },
      { type: 'endpoint', value: '/users', expected: false },
      { type: 'port', value: 3500, expected: true },
      { type: 'port', value: 5432, expected: false } // Reserved for PostgreSQL
    ];
    
    for (const test of validations) {
      const result = manager.validateStandards(test.type, test.value);
      const icon = result.valid === test.expected ? '✅' : '❌';
      console.log(`  ${icon} ${test.type}: ${test.value} - ${result.valid ? 'Valid' : result.errors.join(', ')}`);
    }
    
    // Resource allocation
    console.log('\n📦 Resource Allocation:');
    
    // Agent 1 requests a port
    const port1 = await manager.requestResource('agent-1', 'port', {
      environment: 'development',
      service: 'user-api',
      lockType: 'exclusive'
    });
    console.log(`  Agent 1 port allocation: ${port1.success ? `✅ Port ${port1.resource.port}` : `❌ ${port1.reason}`}`);
    
    // Agent 2 requests a file
    const file1 = await manager.requestResource('agent-2', 'file', {
      path: 'src/services/payment-service.js',
      type: 'service',
      lockType: 'exclusive'
    });
    console.log(`  Agent 2 file allocation: ${file1.success ? '✅ File allocated' : `❌ ${file1.reason}`}`);
    
    // Agent 3 tries to access same file (should fail)
    const file2 = await manager.requestResource('agent-3', 'file', {
      path: 'src/services/payment-service.js',
      type: 'service',
      lockType: 'exclusive'
    });
    console.log(`  Agent 3 file allocation: ${file2.success ? '✅' : '❌ Correctly prevented conflict'}`);
    
    // Generate compliant names
    console.log('\n🏷️ Compliant Name Generation:');
    console.log(`  Service: ${manager.generateCompliantResource('service', 'payment')}`);
    console.log(`  File: ${manager.generateCompliantResource('file', 'user-controller')}`);
    console.log(`  Endpoint: ${manager.generateCompliantResource('endpoint', 'orders')}`);
    
    // System status
    console.log('\n📊 System Status:');
    const status = manager.getSystemStatus();
    console.log(`  Active locks: ${status.locks.length}`);
    console.log(`  Total allocations: ${JSON.stringify(status.allocations.summary, null, 2)}`);
    
    // Health check
    const health = await manager.performHealthCheck();
    console.log(`\n🏥 Health Check: ${health.healthy ? '✅ Healthy' : '⚠️ Issues detected'}`);
    if (health.issues.length > 0) {
      health.issues.forEach(issue => {
        console.log(`  - ${issue.severity.toUpperCase()}: ${issue.message}`);
      });
    }
  }
  
  demonstrateUsage().catch(console.error);
}