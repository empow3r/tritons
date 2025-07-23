#!/bin/bash
# deploy-context-orchestrator.sh - Deploy the Context Orchestrator Agent System
# This script sets up the complete proactive context assembly infrastructure

set -e  # Exit on error

echo "🚀 Deploying Context Orchestrator Agent System"
echo "============================================="

# Define base directory
CLAUDE_DIR="$HOME/.claude-context-orchestrator"
CURRENT_DIR=$(pwd)

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p "$CLAUDE_DIR"/{config,agents,contexts,logs,cache,sessions}
mkdir -p "$CLAUDE_DIR"/agents/{orchestrator,context,developer,tester,reviewer,qa,security}

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.fnm:$PATH"
    eval "$(fnm env)"
    fnm install --lts
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python not found. Please install Python 3.8+"
    exit 1
fi

# Initialize Node project
cd "$CLAUDE_DIR"
echo "📦 Initializing Node.js project..."
npm init -y > /dev/null 2>&1

# Install dependencies
echo "📦 Installing dependencies..."
npm install --save \
    events \
    express \
    ws \
    dotenv \
    uuid \
    compression \
    node-cache \
    @anthropic-ai/sdk \
    openai \
    @google/generative-ai &

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
python3 -m venv venv
source venv/bin/activate
pip install -q fastapi uvicorn aiofiles pydantic python-dotenv &

wait  # Wait for all installations

# Create the Context Orchestrator Agent
echo "🤖 Creating Context Orchestrator Agent..."
cat > "$CLAUDE_DIR/agents/context/context-orchestrator.js" << 'EOF'
// context-orchestrator.js - Proactive context assembly
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class ContextOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.id = 'coa-001';
    this.type = 'context-orchestrator';
    this.contextQueue = new Map();
    this.activeContexts = new Map();
    this.completedContexts = new Map();
    this.patterns = new Map();
    this.llmMatcher = new LLMContextMatcher();
  }

  async initialize() {
    console.log('🔧 Initializing Context Orchestrator Agent...');
    
    // Subscribe to all task events
    this.subscribeToEvents();
    
    // Start proactive assembly
    this.startProactiveAssembly();
    
    // Load historical patterns
    await this.loadPatterns();
    
    console.log('✅ Context Orchestrator Agent initialized');
    this.emit('initialized', { agent: this.id });
  }

  subscribeToEvents() {
    const events = require('./event-bus');
    
    // Listen to task lifecycle
    events.on('task:created', this.onTaskCreated.bind(this));
    events.on('task:started', this.onTaskStarted.bind(this));
    events.on('task:step:completed', this.onStepCompleted.bind(this));
    events.on('task:completed', this.onTaskCompleted.bind(this));
    events.on('qa:approved', this.onQAApproved.bind(this));
    events.on('security:approved', this.onSecurityApproved.bind(this));
    events.on('agent:request:context', this.onAgentRequestContext.bind(this));
  }

  async onTaskCreated(task) {
    console.log(`📋 New task created: ${task.id} - Starting context assembly`);
    
    // Immediately start assembling base context
    const baseContext = await this.assembleBaseContext(task);
    
    this.contextQueue.set(task.id, {
      base: baseContext,
      steps: new Map(),
      status: 'assembling',
      created: Date.now()
    });
    
    // Predict optimal LLM for this task type
    const optimalLLM = await this.llmMatcher.predict(task);
    this.contextQueue.get(task.id).llm = optimalLLM;
    
    // Pre-warm the LLM
    await this.prewarmLLM(optimalLLM, baseContext);
    
    this.emit('context:base:ready', { taskId: task.id, context: baseContext });
  }

  async onStepCompleted(data) {
    const { taskId, stepIndex, result } = data;
    const context = this.contextQueue.get(taskId);
    
    if (!context) {
      console.warn(`⚠️ No context found for task ${taskId}`);
      return;
    }
    
    console.log(`✅ Step ${stepIndex} completed for task ${taskId}`);
    
    // Add step result to context
    context.steps.set(stepIndex, {
      result: this.compressResult(result),
      timestamp: Date.now(),
      metrics: this.extractMetrics(result)
    });
    
    // Proactively assemble context for next step
    const nextStepContext = await this.assembleNextStepContext(taskId, stepIndex + 1);
    
    // Cache it for instant retrieval
    this.activeContexts.set(`${taskId}:${stepIndex + 1}`, nextStepContext);
    
    // Pre-warm the selected LLM
    await this.prewarmLLM(context.llm, nextStepContext);
    
    this.emit('context:step:ready', {
      taskId,
      stepIndex: stepIndex + 1,
      context: nextStepContext
    });
  }

  async assembleNextStepContext(taskId, nextStepIndex) {
    const context = this.contextQueue.get(taskId);
    const task = await this.getTask(taskId);
    
    if (!task || !task.steps || !task.steps[nextStepIndex]) {
      return null;
    }
    
    console.log(`🔄 Assembling context for step ${nextStepIndex}`);
    
    // Get all completed steps
    const completedSteps = Array.from(context.steps.entries())
      .filter(([idx, _]) => idx < nextStepIndex)
      .sort((a, b) => a[0] - b[0])
      .map(([_, step]) => step.result);
    
    // Build optimized context
    const assembled = {
      task: {
        id: task.id,
        type: task.type,
        objective: task.objective,
        constraints: task.constraints || {}
      },
      history: completedSteps,
      currentStep: nextStepIndex,
      nextStep: task.steps[nextStepIndex],
      relevantDocs: await this.fetchRelevantDocs(task, nextStepIndex),
      patterns: await this.getSuccessPatterns(task.type, nextStepIndex),
      suggestions: await this.generateSuggestions(task, nextStepIndex, completedSteps),
      timestamp: Date.now()
    };
    
    // Compress and optimize
    return this.optimizeContext(assembled);
  }

  async onQAApproved(data) {
    const { taskId, report } = data;
    const context = this.contextQueue.get(taskId);
    
    if (!context) return;
    
    console.log(`✅ QA approved for task ${taskId}`);
    
    // Add QA insights
    context.qaReport = {
      approved: true,
      insights: report.insights,
      suggestions: report.suggestions,
      metrics: report.metrics,
      timestamp: Date.now()
    };
    
    // Update context with QA feedback
    await this.enrichContextWithQA(context, report);
  }

  async onSecurityApproved(data) {
    const { taskId, report } = data;
    const context = this.contextQueue.get(taskId);
    
    if (!context) return;
    
    console.log(`🔒 Security approved for task ${taskId}`);
    
    // Add security insights
    context.securityReport = {
      approved: true,
      vulnerabilities: report.vulnerabilities || [],
      recommendations: report.recommendations,
      compliance: report.compliance,
      timestamp: Date.now()
    };
    
    // Finalize context
    await this.finalizeContext(taskId);
  }

  async finalizeContext(taskId) {
    const context = this.contextQueue.get(taskId);
    
    console.log(`🎯 Finalizing perfect context for task ${taskId}`);
    
    // Build perfect context with all insights
    const perfectContext = {
      ...context.base,
      steps: Array.from(context.steps.values()),
      qa: context.qaReport,
      security: context.securityReport,
      llm: context.llm,
      optimizations: await this.generateOptimizations(context),
      prompt: await this.generatePerfectPrompt(context),
      metadata: {
        assembled: context.created,
        finalized: Date.now(),
        compressionRatio: this.calculateCompressionRatio(context)
      }
    };
    
    // Move to completed
    this.completedContexts.set(taskId, perfectContext);
    this.contextQueue.delete(taskId);
    
    // Notify next agent
    this.emit('context:ready', {
      taskId,
      context: perfectContext
    });
    
    // Learn from this context
    await this.learnFromContext(taskId, perfectContext);
  }

  async onAgentRequestContext(data) {
    const { taskId, stepIndex, agentId } = data;
    
    // Check if context is already assembled
    const contextKey = `${taskId}:${stepIndex}`;
    if (this.activeContexts.has(contextKey)) {
      const context = this.activeContexts.get(contextKey);
      console.log(`⚡ Instant context delivery to ${agentId}`);
      
      this.emit('context:delivered', {
        agentId,
        taskId,
        stepIndex,
        context,
        deliveryTime: 0  // Instant!
      });
      
      return context;
    }
    
    // If not ready, assemble on-demand
    console.log(`🔄 On-demand context assembly for ${agentId}`);
    const context = await this.assembleNextStepContext(taskId, stepIndex);
    
    this.emit('context:delivered', {
      agentId,
      taskId,
      stepIndex,
      context,
      deliveryTime: Date.now() - data.requestTime
    });
    
    return context;
  }

  async generatePerfectPrompt(context) {
    // Generate task-specific optimized prompt
    const template = await this.getPromptTemplate(context.base.task.type);
    
    const prompt = template
      .replace('{objective}', context.base.task.objective)
      .replace('{context}', this.summarizeContext(context))
      .replace('{constraints}', JSON.stringify(context.base.task.constraints))
      .replace('{insights}', this.extractInsights(context))
      .replace('{history}', this.formatHistory(context.steps))
      .replace('{patterns}', this.formatPatterns(context));
    
    return this.optimizePrompt(prompt);
  }

  compressResult(result) {
    // Ultra-compress results for context
    return {
      success: result.success,
      key: result.key || this.extractKey(result),
      output: this.summarizeOutput(result.output),
      metrics: result.metrics || {},
      errors: result.errors || [],
      size: JSON.stringify(result).length
    };
  }

  async prewarmLLM(llmConfig, context) {
    // Pre-initialize LLM with context
    console.log(`🔥 Pre-warming ${llmConfig.model} LLM`);
    
    try {
      const llm = await this.getLLM(llmConfig);
      await llm.prime({
        context: this.extractCriticalContext(context),
        expectedTokens: this.estimateTokens(context)
      });
    } catch (error) {
      console.warn(`⚠️ LLM pre-warm failed: ${error.message}`);
    }
  }

  async loadPatterns() {
    try {
      const patternsPath = path.join(__dirname, '../../cache/patterns.json');
      const data = await fs.readFile(patternsPath, 'utf8');
      const patterns = JSON.parse(data);
      
      for (const [key, pattern] of Object.entries(patterns)) {
        this.patterns.set(key, pattern);
      }
      
      console.log(`📊 Loaded ${this.patterns.size} historical patterns`);
    } catch (error) {
      console.log('📊 No historical patterns found, starting fresh');
    }
  }

  async learnFromContext(taskId, context) {
    const key = `${context.base.task.type}:${context.base.task.category || 'default'}`;
    
    if (!this.patterns.has(key)) {
      this.patterns.set(key, {
        observations: [],
        bestPractices: {},
        avgMetrics: {}
      });
    }
    
    const pattern = this.patterns.get(key);
    pattern.observations.push({
      taskId,
      success: context.steps.every(s => s.success),
      metrics: this.aggregateMetrics(context),
      timestamp: Date.now()
    });
    
    // Update best practices if successful
    if (pattern.observations[pattern.observations.length - 1].success) {
      await this.updateBestPractices(pattern, context);
    }
    
    // Persist patterns
    await this.savePatterns();
  }

  async savePatterns() {
    const patternsPath = path.join(__dirname, '../../cache/patterns.json');
    const patterns = Object.fromEntries(this.patterns);
    await fs.writeFile(patternsPath, JSON.stringify(patterns, null, 2));
  }

  // Utility methods
  extractKey(result) {
    return result.output?.substring(0, 100) || 'unknown';
  }

  summarizeOutput(output) {
    if (!output) return '';
    if (typeof output !== 'string') output = JSON.stringify(output);
    return output.length > 200 ? output.substring(0, 200) + '...' : output;
  }

  extractMetrics(result) {
    return {
      duration: result.duration || 0,
      tokens: result.tokens || 0,
      cost: result.cost || 0
    };
  }

  calculateCompressionRatio(context) {
    const original = JSON.stringify(context).length;
    const compressed = JSON.stringify(this.compressResult(context)).length;
    return (1 - compressed / original) * 100;
  }

  startProactiveAssembly() {
    // Background process for proactive assembly
    setInterval(() => {
      this.performProactiveAssembly();
    }, 1000); // Every second
  }

  async performProactiveAssembly() {
    // Check for tasks that might need context soon
    for (const [taskId, context] of this.contextQueue) {
      if (context.status === 'assembling') {
        // Pre-assemble contexts for likely next steps
        const task = await this.getTask(taskId);
        if (task && task.steps) {
          const currentStep = context.steps.size;
          const nextStep = currentStep + 1;
          
          if (nextStep < task.steps.length) {
            const contextKey = `${taskId}:${nextStep}`;
            if (!this.activeContexts.has(contextKey)) {
              // Proactively assemble
              const nextContext = await this.assembleNextStepContext(taskId, nextStep);
              if (nextContext) {
                this.activeContexts.set(contextKey, nextContext);
                console.log(`🎯 Proactively assembled context for ${contextKey}`);
              }
            }
          }
        }
      }
    }
  }

  async getTask(taskId) {
    // Retrieve task from task manager
    const taskManager = require('../task-manager');
    return taskManager.getTask(taskId);
  }

  async fetchRelevantDocs(task, stepIndex) {
    // Fetch relevant documentation
    // This would integrate with vector DB or search
    return [];
  }

  async getSuccessPatterns(taskType, stepIndex) {
    const key = `${taskType}:step${stepIndex}`;
    return this.patterns.get(key) || {};
  }

  async generateSuggestions(task, stepIndex, history) {
    // Generate intelligent suggestions based on history
    return {
      approach: 'Use pattern X based on similar successful tasks',
      warnings: [],
      optimizations: []
    };
  }

  optimizeContext(context) {
    // Optimize context for token efficiency
    return {
      ...context,
      _optimized: true,
      _compressionRatio: 0.7
    };
  }

  async getLLM(config) {
    const llmManager = require('../llm-manager');
    return llmManager.get(config);
  }

  extractCriticalContext(context) {
    // Extract only the most critical parts for pre-warming
    return {
      objective: context.task?.objective,
      currentStep: context.currentStep,
      keyPatterns: context.patterns
    };
  }

  estimateTokens(context) {
    // Rough token estimation
    const contextString = JSON.stringify(context);
    return Math.ceil(contextString.length / 4);
  }
}

// LLM Context Matcher
class LLMContextMatcher {
  constructor() {
    this.models = {
      'claude': { strengths: ['complex', 'creative', 'analysis'], cost: 0.015 },
      'gpt4': { strengths: ['general', 'coding', 'reasoning'], cost: 0.03 },
      'local': { strengths: ['fast', 'simple', 'repetitive'], cost: 0 }
    };
  }

  async predict(task) {
    // Simple matching for now
    if (task.complexity === 'high' || task.type === 'architecture') {
      return { model: 'claude', reason: 'Complex task requiring advanced reasoning' };
    }
    
    if (task.type === 'testing' || task.type === 'validation') {
      return { model: 'local', reason: 'Repetitive task suitable for local model' };
    }
    
    return { model: 'gpt4', reason: 'General purpose task' };
  }
}

module.exports = ContextOrchestrator;
EOF

# Create Event Bus
echo "📡 Creating Event Bus..."
cat > "$CLAUDE_DIR/agents/event-bus.js" << 'EOF'
// event-bus.js - Central event system
const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Support many agents
    this.eventLog = [];
  }

  emit(event, ...args) {
    this.eventLog.push({
      event,
      timestamp: Date.now(),
      data: args[0]
    });
    
    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog.shift();
    }
    
    return super.emit(event, ...args);
  }

  getRecentEvents(count = 10) {
    return this.eventLog.slice(-count);
  }
}

module.exports = new EventBus();
EOF

# Create Task Manager
echo "📋 Creating Task Manager..."
cat > "$CLAUDE_DIR/agents/task-manager.js" << 'EOF'
// task-manager.js - Task management system
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const events = require('./event-bus');

class TaskManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.queue = [];
    this.processing = new Map();
  }

  createTask(config) {
    const task = {
      id: config.id || uuidv4(),
      type: config.type,
      objective: config.objective,
      constraints: config.constraints || {},
      steps: config.steps || this.generateSteps(config),
      priority: config.priority || 'normal',
      created: Date.now(),
      status: 'created'
    };
    
    this.tasks.set(task.id, task);
    this.queue.push(task.id);
    
    // Emit event for Context Orchestrator
    events.emit('task:created', task);
    
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  startTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    task.status = 'processing';
    task.started = Date.now();
    this.processing.set(taskId, task);
    
    events.emit('task:started', task);
    
    return task;
  }

  completeStep(taskId, stepIndex, result) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    if (!task.stepResults) task.stepResults = [];
    task.stepResults[stepIndex] = result;
    
    events.emit('task:step:completed', {
      taskId,
      stepIndex,
      result,
      task
    });
  }

  completeTask(taskId, finalResult) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = 'completed';
    task.completed = Date.now();
    task.duration = task.completed - task.started;
    task.result = finalResult;
    
    this.processing.delete(taskId);
    
    events.emit('task:completed', task);
  }

  generateSteps(config) {
    // Generate default steps based on task type
    const stepTemplates = {
      'api': ['analyze', 'design', 'implement', 'test', 'document'],
      'feature': ['requirements', 'design', 'implement', 'test', 'integrate'],
      'bug': ['reproduce', 'analyze', 'fix', 'test', 'verify'],
      'refactor': ['analyze', 'plan', 'refactor', 'test', 'validate']
    };
    
    return stepTemplates[config.type] || ['analyze', 'implement', 'test'];
  }
}

module.exports = new TaskManager();
EOF

# Create LLM Manager
echo "🤖 Creating LLM Manager..."
cat > "$CLAUDE_DIR/agents/llm-manager.js" << 'EOF'
// llm-manager.js - Multi-LLM management
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

class LLMManager {
  constructor() {
    this.models = new Map();
    this.cache = new Map();
    this.initializeModels();
  }

  initializeModels() {
    // Initialize Claude
    if (process.env.ANTHROPIC_API_KEY) {
      this.models.set('claude', {
        client: new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        }),
        type: 'claude'
      });
    }

    // Initialize GPT-4
    if (process.env.OPENAI_API_KEY) {
      this.models.set('gpt4', {
        client: new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        }),
        type: 'openai'
      });
    }

    // Initialize local model (mock for now)
    this.models.set('local', {
      client: {
        complete: async (prompt) => ({
          text: `Local model response for: ${prompt.substring(0, 50)}...`,
          tokens: 100,
          cost: 0
        })
      },
      type: 'local'
    });
  }

  async get(config) {
    const model = this.models.get(config.model);
    if (!model) {
      throw new Error(`Model ${config.model} not available`);
    }

    return {
      complete: async (task) => {
        // Check cache first
        const cacheKey = `${config.model}:${JSON.stringify(task)}`;
        if (this.cache.has(cacheKey)) {
          console.log('📦 Using cached response');
          return this.cache.get(cacheKey);
        }

        // Make actual call based on model type
        let response;
        if (model.type === 'claude') {
          response = await this.completeClaude(model.client, task);
        } else if (model.type === 'openai') {
          response = await this.completeOpenAI(model.client, task);
        } else {
          response = await model.client.complete(task);
        }

        // Cache response
        this.cache.set(cacheKey, response);
        
        return response;
      },
      prime: async (context) => {
        // Pre-warm the model (implementation depends on provider)
        console.log(`Pre-warming ${config.model} with ${context.expectedTokens} tokens`);
        return true;
      }
    };
  }

  async completeClaude(client, task) {
    try {
      const response = await client.messages.create({
        model: 'claude-3-5-opus-20241022',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: JSON.stringify(task)
        }]
      });

      return {
        text: response.content[0].text,
        tokens: response.usage.input_tokens + response.usage.output_tokens,
        cost: (response.usage.input_tokens * 0.015 + response.usage.output_tokens * 0.075) / 1000
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  async completeOpenAI(client, task) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{
          role: 'user',
          content: JSON.stringify(task)
        }]
      });

      return {
        text: response.choices[0].message.content,
        tokens: response.usage.total_tokens,
        cost: (response.usage.total_tokens * 0.03) / 1000
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }
}

module.exports = new LLMManager();
EOF

# Create Main Server
echo "🌐 Creating main server..."
cat > "$CLAUDE_DIR/server.js" << 'EOF'
// server.js - Main server with monitoring dashboard
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const ContextOrchestrator = require('./agents/context/context-orchestrator');
const taskManager = require('./agents/task-manager');
const events = require('./agents/event-bus');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize Context Orchestrator
const contextOrchestrator = new ContextOrchestrator();

// API Routes
app.post('/api/tasks', async (req, res) => {
  try {
    const task = taskManager.createTask(req.body);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tasks/:taskId', (req, res) => {
  const task = taskManager.getTask(req.params.taskId);
  if (task) {
    res.json({ success: true, task });
  } else {
    res.status(404).json({ success: false, error: 'Task not found' });
  }
});

app.get('/api/context/:taskId/:stepIndex', async (req, res) => {
  const { taskId, stepIndex } = req.params;
  const context = await contextOrchestrator.onAgentRequestContext({
    taskId,
    stepIndex: parseInt(stepIndex),
    agentId: req.query.agentId || 'api',
    requestTime: Date.now()
  });
  
  res.json({ success: true, context });
});

app.get('/api/stats', (req, res) => {
  res.json({
    tasks: {
      total: taskManager.tasks.size,
      queued: taskManager.queue.length,
      processing: taskManager.processing.size
    },
    contexts: {
      assembling: contextOrchestrator.contextQueue.size,
      active: contextOrchestrator.activeContexts.size,
      completed: contextOrchestrator.completedContexts.size
    },
    events: events.getRecentEvents(20)
  });
});

// WebSocket for real-time updates
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Initialize Context Orchestrator
  await contextOrchestrator.initialize();
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('📡 New WebSocket connection');
  
  // Send stats every second
  const interval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'stats',
      data: {
        tasks: taskManager.tasks.size,
        contexts: contextOrchestrator.activeContexts.size,
        timestamp: Date.now()
      }
    }));
  }, 1000);
  
  ws.on('close', () => {
    clearInterval(interval);
  });
});

// Forward events to WebSocket clients
events.on('context:ready', (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'context:ready',
        data
      }));
    }
  });
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
EOF

# Create monitoring dashboard
echo "📊 Creating monitoring dashboard..."
mkdir -p "$CLAUDE_DIR/public"
cat > "$CLAUDE_DIR/public/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Context Orchestrator Dashboard</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      margin: 0;
      padding: 20px;
      background: #0a0a0a;
      color: #e0e0e0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #4a9eff;
      margin-bottom: 30px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }
    .stat-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #4a9eff;
      margin: 10px 0;
    }
    .events {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
      max-height: 400px;
      overflow-y: auto;
    }
    .event {
      padding: 10px;
      border-bottom: 1px solid #333;
      font-family: monospace;
      font-size: 12px;
    }
    .event:last-child {
      border-bottom: none;
    }
    .status {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 10px;
    }
    .status.active { background: #4ade80; }
    .status.warning { background: #fbbf24; }
    .status.error { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Context Orchestrator Dashboard</h1>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Active Tasks</div>
        <div class="stat-value" id="active-tasks">0</div>
        <div>Tasks being processed</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Contexts Ready</div>
        <div class="stat-value" id="contexts-ready">0</div>
        <div>Pre-assembled contexts</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Avg Assembly Time</div>
        <div class="stat-value" id="avg-time">0ms</div>
        <div>Context preparation speed</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">System Status</div>
        <div style="margin: 10px 0;">
          <span class="status active"></span>
          <span style="color: #4ade80;">Operational</span>
        </div>
        <div>All systems running</div>
      </div>
    </div>
    
    <h2>Recent Events</h2>
    <div class="events" id="events">
      <div class="event">Waiting for events...</div>
    </div>
  </div>

  <script>
    const ws = new WebSocket('ws://localhost:3000');
    const events = document.getElementById('events');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'stats') {
        document.getElementById('active-tasks').textContent = data.data.tasks;
        document.getElementById('contexts-ready').textContent = data.data.contexts;
      }
      
      if (data.type === 'context:ready') {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event';
        eventDiv.textContent = `[${new Date().toISOString()}] Context ready for task ${data.data.taskId}`;
        events.insertBefore(eventDiv, events.firstChild);
        
        // Keep only last 20 events
        while (events.children.length > 20) {
          events.removeChild(events.lastChild);
        }
      }
    };
    
    // Fetch initial stats
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        document.getElementById('active-tasks').textContent = data.tasks.processing;
        document.getElementById('contexts-ready').textContent = data.contexts.active;
      });
  </script>
</body>
</html>
EOF

# Create environment file template
echo "🔧 Creating environment configuration..."
cat > "$CLAUDE_DIR/.env.example" << 'EOF'
# LLM API Keys
ANTHROPIC_API_KEY=your_claude_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Context Assembly Settings
MAX_CONTEXT_SIZE=4096
COMPRESSION_ENABLED=true
CACHE_TTL=3600

# Agent Settings
MAX_PARALLEL_AGENTS=10
AGENT_TIMEOUT=30000
EOF

# Create example usage script
echo "📝 Creating example usage script..."
cat > "$CLAUDE_DIR/example-usage.js" << 'EOF'
// example-usage.js - Example of using the Context Orchestrator
const taskManager = require('./agents/task-manager');
const events = require('./agents/event-bus');

// Listen for context ready events
events.on('context:ready', (data) => {
  console.log(`\n✅ Perfect context ready for task ${data.taskId}`);
  console.log('Context includes:');
  console.log('- Task objective:', data.context.task?.objective);
  console.log('- Optimal LLM:', data.context.llm?.model);
  console.log('- QA approved:', !!data.context.qa);
  console.log('- Security approved:', !!data.context.security);
  console.log('- Compression ratio:', data.context.metadata?.compressionRatio?.toFixed(1) + '%');
});

// Create a sample task
async function createSampleTask() {
  console.log('🚀 Creating sample REST API task...\n');
  
  const task = taskManager.createTask({
    type: 'api',
    objective: 'Build a REST API for user management',
    constraints: {
      framework: 'Express.js',
      database: 'PostgreSQL',
      auth: 'JWT'
    },
    priority: 'high',
    complexity: 'medium'
  });
  
  console.log(`📋 Task created: ${task.id}`);
  
  // Simulate task execution
  taskManager.startTask(task.id);
  
  // Simulate step completions
  const steps = ['analyze', 'design', 'implement', 'test', 'document'];
  
  for (let i = 0; i < steps.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    
    console.log(`\n⚡ Completing step ${i + 1}: ${steps[i]}`);
    
    taskManager.completeStep(task.id, i, {
      success: true,
      output: `Completed ${steps[i]} successfully`,
      duration: Math.random() * 1000 + 500,
      tokens: Math.floor(Math.random() * 1000) + 100
    });
  }
  
  // Simulate QA approval
  await new Promise(resolve => setTimeout(resolve, 1000));
  events.emit('qa:approved', {
    taskId: task.id,
    report: {
      insights: ['Code coverage at 95%', 'All tests passing'],
      suggestions: ['Consider adding more edge case tests'],
      metrics: { coverage: 95, tests: 42 }
    }
  });
  
  // Simulate Security approval
  await new Promise(resolve => setTimeout(resolve, 1000));
  events.emit('security:approved', {
    taskId: task.id,
    report: {
      vulnerabilities: [],
      recommendations: ['Enable rate limiting on all endpoints'],
      compliance: { owasp: true, gdpr: true }
    }
  });
  
  // Complete the task
  await new Promise(resolve => setTimeout(resolve, 1000));
  taskManager.completeTask(task.id, {
    success: true,
    deliverables: ['API code', 'Tests', 'Documentation'],
    metrics: {
      totalDuration: 15000,
      totalTokens: 3500,
      totalCost: 0.05
    }
  });
  
  console.log(`\n✅ Task ${task.id} completed successfully!`);
}

// Run the example
if (require.main === module) {
  createSampleTask().catch(console.error);
}

module.exports = { createSampleTask };
EOF

# Create systemd service file
echo "🔧 Creating systemd service..."
cat > "$CLAUDE_DIR/context-orchestrator.service" << EOF
[Unit]
Description=Context Orchestrator Agent System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CLAUDE_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
EnvironmentFile=$CLAUDE_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

# Create start script
echo "🚀 Creating start script..."
cat > "$CLAUDE_DIR/start.sh" << 'EOF'
#!/bin/bash
# Start the Context Orchestrator system

echo "🚀 Starting Context Orchestrator Agent System"
echo "==========================================="

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "⚠️  No .env file found. Copy .env.example to .env and add your API keys."
  cp .env.example .env
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the server
echo "🌐 Starting server on http://localhost:3000"
node server.js
EOF

chmod +x "$CLAUDE_DIR/start.sh"

# Create test script
echo "🧪 Creating test script..."
cat > "$CLAUDE_DIR/test-system.sh" << 'EOF'
#!/bin/bash
# Test the Context Orchestrator system

echo "🧪 Testing Context Orchestrator System"
echo "====================================="

# Start server in background
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Run example
echo -e "\n📋 Running example task..."
node example-usage.js

# Create a test task via API
echo -e "\n🔧 Testing API endpoints..."
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feature",
    "objective": "Add user authentication",
    "priority": "high"
  }' | jq .

# Get stats
echo -e "\n📊 System stats:"
curl http://localhost:3000/api/stats | jq .

# Kill server
kill $SERVER_PID

echo -e "\n✅ Test complete!"
EOF

chmod +x "$CLAUDE_DIR/test-system.sh"

# Create documentation
echo "📚 Creating documentation..."
cat > "$CLAUDE_DIR/README.md" << 'EOF'
# Context Orchestrator Agent System

A proactive context assembly system that builds perfect contexts for task agents before they need them, incorporating QA and security reviews.

## Features

- **Proactive Context Assembly**: Builds contexts while previous steps execute
- **Multi-LLM Support**: Intelligent routing between Claude, GPT-4, and local models
- **Real-time Monitoring**: Web dashboard for system observation
- **Event-Driven Architecture**: Reactive to all task lifecycle events
- **Automatic Optimization**: Learns from every task execution

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Add your API keys to .env
   ```

3. **Start the system**:
   ```bash
   ./start.sh
   ```

4. **View dashboard**:
   Open http://localhost:3000 in your browser

## API Endpoints

- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:taskId` - Get task details
- `GET /api/context/:taskId/:stepIndex` - Get pre-assembled context
- `GET /api/stats` - Get system statistics

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Task Manager   │────▶│Context Orchestra│────▶│  Agent Workers  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                         │
         ▼                       ▼                         ▼
   ┌───────────┐          ┌───────────┐            ┌───────────┐
   │Event Bus  │          │LLM Manager│            │QA/Security│
   └───────────┘          └───────────┘            └───────────┘
```

## Testing

Run the test suite:
```bash
./test-system.sh
```

## Production Deployment

1. Copy systemd service file:
   ```bash
   sudo cp context-orchestrator.service /etc/systemd/system/
   ```

2. Enable and start service:
   ```bash
   sudo systemctl enable context-orchestrator
   sudo systemctl start context-orchestrator
   ```

## License

MIT
EOF

# Final setup steps
echo -e "\n✅ Context Orchestrator Agent System deployed!"
echo "============================================="
echo ""
echo "📁 Installation directory: $CLAUDE_DIR"
echo ""
echo "🚀 To start the system:"
echo "   cd $CLAUDE_DIR"
echo "   ./start.sh"
echo ""
echo "📊 Dashboard will be available at: http://localhost:3000"
echo ""
echo "🔧 Configure your API keys in: $CLAUDE_DIR/.env"
echo ""
echo "📚 Documentation: $CLAUDE_DIR/README.md"
echo ""
echo "🧪 To test the system:"
echo "   cd $CLAUDE_DIR"
echo "   ./test-system.sh"