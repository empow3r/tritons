// enterprise-message-bus.js - Enterprise-Grade Message Queue and Event Bus System

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ===== MESSAGE TYPES AND SCHEMAS =====
class MessageSchemaRegistry {
  constructor() {
    this.schemas = new Map();
    this.versions = new Map();
    
    this.registerCoreSchemas();
  }

  registerCoreSchemas() {
    // Task messages
    this.registerSchema('task.created', {
      version: '1.0.0',
      schema: {
        type: 'object',
        required: ['id', 'type', 'priority', 'payload'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string' },
          priority: { enum: ['low', 'normal', 'high', 'critical'] },
          payload: { type: 'object' },
          metadata: {
            type: 'object',
            properties: {
              correlationId: { type: 'string' },
              causationId: { type: 'string' },
              timestamp: { type: 'number' },
              source: { type: 'string' }
            }
          }
        }
      }
    });

    // Agent messages
    this.registerSchema('agent.status', {
      version: '1.0.0',
      schema: {
        type: 'object',
        required: ['agentId', 'status', 'timestamp'],
        properties: {
          agentId: { type: 'string' },
          status: { enum: ['starting', 'ready', 'busy', 'idle', 'error', 'stopping', 'stopped'] },
          workload: { type: 'number', minimum: 0, maximum: 100 },
          timestamp: { type: 'number' }
        }
      }
    });

    // System messages
    this.registerSchema('system.alert', {
      version: '1.0.0',
      schema: {
        type: 'object',
        required: ['severity', 'message', 'source'],
        properties: {
          severity: { enum: ['info', 'warning', 'error', 'critical'] },
          message: { type: 'string' },
          source: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        }
      }
    });
  }

  registerSchema(messageType, config) {
    this.schemas.set(messageType, config.schema);
    
    if (!this.versions.has(messageType)) {
      this.versions.set(messageType, []);
    }
    this.versions.get(messageType).push(config.version);
  }

  validateMessage(messageType, message) {
    const schema = this.schemas.get(messageType);
    if (!schema) {
      return { valid: false, error: `Unknown message type: ${messageType}` };
    }

    // Simple validation - in production use JSON Schema validator
    const errors = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in message)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== MESSAGE QUEUE =====
class MessageQueue extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.messages = [];
    this.subscribers = new Map();
    this.deadLetterQueue = [];
    this.config = {
      maxSize: options.maxSize || 10000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ttl: options.ttl || 3600000, // 1 hour
      persistent: options.persistent || false,
      priority: options.priority || false
    };
    
    this.stats = {
      enqueued: 0,
      dequeued: 0,
      failed: 0,
      dlq: 0
    };
    
    if (this.config.persistent) {
      this.initializePersistence();
    }
  }

  async enqueue(message, options = {}) {
    if (this.messages.length >= this.config.maxSize) {
      throw new Error(`Queue ${this.name} is full`);
    }

    const queueMessage = {
      id: crypto.randomUUID(),
      payload: message,
      priority: options.priority || 'normal',
      timestamp: Date.now(),
      ttl: options.ttl || this.config.ttl,
      retries: 0,
      metadata: {
        correlationId: options.correlationId || crypto.randomUUID(),
        causationId: options.causationId,
        source: options.source || 'unknown'
      }
    };

    if (this.config.priority) {
      this.enqueuePriority(queueMessage);
    } else {
      this.messages.push(queueMessage);
    }

    this.stats.enqueued++;
    
    // Persist if enabled
    if (this.config.persistent) {
      await this.persistMessage(queueMessage);
    }

    // Notify subscribers
    this.emit('message:enqueued', queueMessage);
    
    // Process immediately if subscribers waiting
    this.processNext();

    return queueMessage.id;
  }

  enqueuePriority(message) {
    const priorityValues = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3
    };

    const insertIndex = this.messages.findIndex(
      m => priorityValues[m.priority] > priorityValues[message.priority]
    );

    if (insertIndex === -1) {
      this.messages.push(message);
    } else {
      this.messages.splice(insertIndex, 0, message);
    }
  }

  async dequeue() {
    // Remove expired messages
    this.cleanExpiredMessages();

    if (this.messages.length === 0) {
      return null;
    }

    const message = this.messages.shift();
    this.stats.dequeued++;

    // Update persistence
    if (this.config.persistent) {
      await this.removePersistedMessage(message.id);
    }

    this.emit('message:dequeued', message);

    return message;
  }

  async subscribe(subscriberId, handler, options = {}) {
    const subscription = {
      id: subscriberId,
      handler,
      filter: options.filter,
      concurrency: options.concurrency || 1,
      active: 0
    };

    this.subscribers.set(subscriberId, subscription);
    
    // Start processing if messages available
    this.processNext();

    return {
      unsubscribe: () => this.unsubscribe(subscriberId)
    };
  }

  unsubscribe(subscriberId) {
    this.subscribers.delete(subscriberId);
  }

  async processNext() {
    for (const [id, subscriber] of this.subscribers) {
      if (subscriber.active >= subscriber.concurrency) {
        continue;
      }

      const message = await this.getNextForSubscriber(subscriber);
      if (!message) {
        continue;
      }

      subscriber.active++;
      
      this.processMessage(message, subscriber)
        .finally(() => {
          subscriber.active--;
          // Process next message
          setImmediate(() => this.processNext());
        });
    }
  }

  async getNextForSubscriber(subscriber) {
    if (subscriber.filter) {
      const index = this.messages.findIndex(m => subscriber.filter(m));
      if (index !== -1) {
        return this.messages.splice(index, 1)[0];
      }
    } else if (this.messages.length > 0) {
      return this.messages.shift();
    }
    
    return null;
  }

  async processMessage(message, subscriber) {
    try {
      await subscriber.handler(message.payload, message.metadata);
      
      this.stats.dequeued++;
      this.emit('message:processed', { message, subscriber: subscriber.id });
      
    } catch (error) {
      message.retries++;
      
      if (message.retries < this.config.maxRetries) {
        // Retry with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, message.retries - 1);
        
        setTimeout(() => {
          this.messages.push(message);
          this.emit('message:retry', { message, attempt: message.retries });
        }, delay);
        
      } else {
        // Move to dead letter queue
        this.deadLetterQueue.push({
          ...message,
          failedAt: Date.now(),
          error: error.message
        });
        
        this.stats.failed++;
        this.stats.dlq++;
        
        this.emit('message:dlq', { message, error });
      }
    }
  }

  cleanExpiredMessages() {
    const now = Date.now();
    this.messages = this.messages.filter(m => {
      const expired = now > (m.timestamp + m.ttl);
      if (expired) {
        this.emit('message:expired', m);
      }
      return !expired;
    });
  }

  // Persistence methods
  async initializePersistence() {
    this.persistencePath = path.join(
      process.env.HOME,
      '.enterprise-queue',
      this.name
    );
    
    await fs.mkdir(this.persistencePath, { recursive: true });
    
    // Load existing messages
    await this.loadPersistedMessages();
  }

  async persistMessage(message) {
    const filePath = path.join(this.persistencePath, `${message.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(message));
  }

  async removePersistedMessage(messageId) {
    const filePath = path.join(this.persistencePath, `${messageId}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async loadPersistedMessages() {
    try {
      const files = await fs.readdir(this.persistencePath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.persistencePath, file),
            'utf8'
          );
          const message = JSON.parse(content);
          this.messages.push(message);
        }
      }
      
      // Sort by timestamp if priority not enabled
      if (!this.config.priority) {
        this.messages.sort((a, b) => a.timestamp - b.timestamp);
      }
      
    } catch (error) {
      console.error(`Failed to load persisted messages: ${error.message}`);
    }
  }

  getStats() {
    return {
      ...this.stats,
      queueLength: this.messages.length,
      dlqLength: this.deadLetterQueue.length,
      subscribers: this.subscribers.size
    };
  }
}

// ===== EVENT BUS =====
class EnterpriseEventBus extends EventEmitter {
  constructor() {
    super();
    this.schemaRegistry = new MessageSchemaRegistry();
    this.topics = new Map();
    this.subscriptions = new Map();
    this.eventStore = [];
    this.config = {
      maxEventStoreSize: 100000,
      enableEventSourcing: true,
      enableReplay: true
    };
  }

  createTopic(name, options = {}) {
    if (this.topics.has(name)) {
      throw new Error(`Topic ${name} already exists`);
    }

    const topic = {
      name,
      created: Date.now(),
      config: {
        persistent: options.persistent || false,
        partitions: options.partitions || 1,
        replicationFactor: options.replicationFactor || 1
      },
      subscribers: new Set(),
      stats: {
        published: 0,
        delivered: 0,
        failed: 0
      }
    };

    this.topics.set(name, topic);
    this.emit('topic:created', { name });

    return topic;
  }

  async publish(topic, event, options = {}) {
    const topicObj = this.topics.get(topic);
    if (!topicObj) {
      throw new Error(`Topic ${topic} does not exist`);
    }

    // Validate event schema if type provided
    if (options.type) {
      const validation = this.schemaRegistry.validateMessage(options.type, event);
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const eventEnvelope = {
      id: crypto.randomUUID(),
      topic,
      type: options.type || 'generic',
      payload: event,
      timestamp: Date.now(),
      metadata: {
        correlationId: options.correlationId || crypto.randomUUID(),
        causationId: options.causationId,
        source: options.source || 'unknown',
        version: options.version || '1.0.0'
      }
    };

    // Store event if event sourcing enabled
    if (this.config.enableEventSourcing) {
      this.storeEvent(eventEnvelope);
    }

    // Update stats
    topicObj.stats.published++;

    // Deliver to subscribers
    const deliveries = [];
    for (const subscriberId of topicObj.subscribers) {
      const subscription = this.subscriptions.get(subscriberId);
      if (subscription && this.matchesFilter(eventEnvelope, subscription.filter)) {
        deliveries.push(this.deliverEvent(eventEnvelope, subscription));
      }
    }

    await Promise.allSettled(deliveries);

    this.emit('event:published', eventEnvelope);

    return eventEnvelope.id;
  }

  subscribe(topic, subscriberId, handler, options = {}) {
    const topicObj = this.topics.get(topic);
    if (!topicObj) {
      throw new Error(`Topic ${topic} does not exist`);
    }

    const subscription = {
      id: subscriberId,
      topic,
      handler,
      filter: options.filter,
      fromBeginning: options.fromBeginning || false,
      created: Date.now()
    };

    this.subscriptions.set(subscriberId, subscription);
    topicObj.subscribers.add(subscriberId);

    // Replay events if requested
    if (subscription.fromBeginning && this.config.enableReplay) {
      this.replayEvents(topic, subscription);
    }

    this.emit('subscription:created', { topic, subscriberId });

    return {
      unsubscribe: () => this.unsubscribe(topic, subscriberId)
    };
  }

  unsubscribe(topic, subscriberId) {
    const topicObj = this.topics.get(topic);
    if (topicObj) {
      topicObj.subscribers.delete(subscriberId);
    }
    
    this.subscriptions.delete(subscriberId);
    this.emit('subscription:removed', { topic, subscriberId });
  }

  async deliverEvent(event, subscription) {
    try {
      await subscription.handler(event.payload, {
        ...event.metadata,
        eventId: event.id,
        topic: event.topic,
        timestamp: event.timestamp
      });

      const topic = this.topics.get(event.topic);
      if (topic) {
        topic.stats.delivered++;
      }

    } catch (error) {
      const topic = this.topics.get(event.topic);
      if (topic) {
        topic.stats.failed++;
      }

      this.emit('delivery:failed', {
        event,
        subscription: subscription.id,
        error: error.message
      });
    }
  }

  matchesFilter(event, filter) {
    if (!filter) return true;

    if (typeof filter === 'function') {
      return filter(event);
    }

    // Object filter matching
    for (const [key, value] of Object.entries(filter)) {
      if (event.payload[key] !== value) {
        return false;
      }
    }

    return true;
  }

  storeEvent(event) {
    this.eventStore.push(event);

    // Trim if exceeds max size
    if (this.eventStore.length > this.config.maxEventStoreSize) {
      this.eventStore.shift();
    }
  }

  async replayEvents(topic, subscription) {
    const events = this.eventStore.filter(e => 
      e.topic === topic && this.matchesFilter(e, subscription.filter)
    );

    for (const event of events) {
      await this.deliverEvent(event, subscription);
    }
  }

  getTopicStats(topic) {
    const topicObj = this.topics.get(topic);
    if (!topicObj) {
      return null;
    }

    return {
      ...topicObj.stats,
      subscribers: topicObj.subscribers.size,
      config: topicObj.config
    };
  }

  getAllStats() {
    const stats = {
      topics: this.topics.size,
      subscriptions: this.subscriptions.size,
      eventStoreSize: this.eventStore.length,
      topicStats: {}
    };

    for (const [name, topic] of this.topics) {
      stats.topicStats[name] = this.getTopicStats(name);
    }

    return stats;
  }
}

// ===== MESSAGE BROKER =====
class MessageBroker {
  constructor() {
    this.queues = new Map();
    this.eventBus = new EnterpriseEventBus();
    this.dlqProcessor = new DeadLetterQueueProcessor();
    
    this.initialize();
  }

  initialize() {
    // Create default queues
    this.createQueue('tasks', { priority: true, persistent: true });
    this.createQueue('commands', { maxRetries: 5 });
    this.createQueue('events', { ttl: 3600000 });
    this.createQueue('alerts', { priority: true });

    // Create default topics
    this.eventBus.createTopic('system.events');
    this.eventBus.createTopic('agent.events');
    this.eventBus.createTopic('task.events');
    this.eventBus.createTopic('compliance.events');

    console.log('✅ Message Broker initialized');
  }

  createQueue(name, options) {
    if (this.queues.has(name)) {
      throw new Error(`Queue ${name} already exists`);
    }

    const queue = new MessageQueue(name, options);
    this.queues.set(name, queue);

    // Setup DLQ processing
    queue.on('message:dlq', (data) => {
      this.dlqProcessor.process(data);
    });

    return queue;
  }

  getQueue(name) {
    return this.queues.get(name);
  }

  async sendToQueue(queueName, message, options) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    return await queue.enqueue(message, options);
  }

  async consumeQueue(queueName, consumerId, handler, options) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    return await queue.subscribe(consumerId, handler, options);
  }

  async publish(topic, event, options) {
    return await this.eventBus.publish(topic, event, options);
  }

  subscribe(topic, subscriberId, handler, options) {
    return this.eventBus.subscribe(topic, subscriberId, handler, options);
  }

  getStats() {
    const stats = {
      queues: {},
      topics: this.eventBus.getAllStats()
    };

    for (const [name, queue] of this.queues) {
      stats.queues[name] = queue.getStats();
    }

    return stats;
  }
}

// ===== DEAD LETTER QUEUE PROCESSOR =====
class DeadLetterQueueProcessor {
  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  registerDefaultStrategies() {
    // Retry with exponential backoff
    this.registerStrategy('retry', async (message, error) => {
      console.log(`🔄 Retrying message ${message.id} after delay`);
      // Implementation would retry with longer delays
    });

    // Alert administrators
    this.registerStrategy('alert', async (message, error) => {
      console.log(`🚨 Alerting admins about failed message ${message.id}`);
      // Implementation would send alerts
    });

    // Log and archive
    this.registerStrategy('archive', async (message, error) => {
      console.log(`📦 Archiving failed message ${message.id}`);
      // Implementation would store for analysis
    });
  }

  registerStrategy(name, handler) {
    this.strategies.set(name, handler);
  }

  async process(dlqData) {
    const { message, error } = dlqData;
    
    // Determine strategy based on message type and error
    const strategy = this.determineStrategy(message, error);
    
    const handler = this.strategies.get(strategy);
    if (handler) {
      await handler(message, error);
    }
  }

  determineStrategy(message, error) {
    // Simple strategy selection - could be more sophisticated
    if (message.priority === 'critical') {
      return 'alert';
    }
    
    if (message.retries < 10) {
      return 'retry';
    }
    
    return 'archive';
  }
}

// ===== EXPORTS =====
module.exports = {
  MessageBroker,
  MessageQueue,
  EnterpriseEventBus,
  MessageSchemaRegistry,
  DeadLetterQueueProcessor
};

// Example usage
if (require.main === module) {
  async function demonstrateMessaging() {
    console.log('📨 Enterprise Message Bus Demonstration\n');
    
    const broker = new MessageBroker();
    
    // Example 1: Task Queue with Priority
    console.log('1️⃣ Task Queue Example:');
    
    // Producer
    await broker.sendToQueue('tasks', 
      { action: 'process_payment', amount: 100 },
      { priority: 'high', correlationId: 'order-123' }
    );
    
    await broker.sendToQueue('tasks',
      { action: 'send_email', template: 'welcome' },
      { priority: 'low' }
    );
    
    await broker.sendToQueue('tasks',
      { action: 'critical_security_check' },
      { priority: 'critical' }
    );
    
    // Consumer
    await broker.consumeQueue('tasks', 'worker-1', async (message, metadata) => {
      console.log(`  Processing: ${message.action} (${metadata.correlationId})`);
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Example 2: Event Bus Pub/Sub
    console.log('\n2️⃣ Event Bus Example:');
    
    // Subscribe to agent events
    broker.subscribe('agent.events', 'monitor-1', (event, metadata) => {
      console.log(`  Agent Event: ${event.status} for ${event.agentId}`);
    });
    
    // Publish agent status
    await broker.publish('agent.events', {
      agentId: 'agent-123',
      status: 'ready',
      workload: 25
    }, { type: 'agent.status' });
    
    // Example 3: Filtered Subscription
    console.log('\n3️⃣ Filtered Subscription:');
    
    // Only subscribe to critical alerts
    broker.subscribe('system.events', 'critical-monitor', (event) => {
      console.log(`  🚨 CRITICAL: ${event.message}`);
    }, {
      filter: { severity: 'critical' }
    });
    
    // Publish various alerts
    await broker.publish('system.events', {
      severity: 'info',
      message: 'System running normally'
    });
    
    await broker.publish('system.events', {
      severity: 'critical',
      message: 'Database connection lost!'
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Show stats
    console.log('\n📊 Message Broker Stats:');
    console.log(JSON.stringify(broker.getStats(), null, 2));
  }
  
  demonstrateMessaging().catch(console.error);
}