// enhanced-swarm-orchestrator.js - Advanced Multi-Agent Context System with Hierarchical Decision Making

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// ===== HIERARCHICAL DECISION SYSTEM =====
class HierarchicalDecisionSystem {
  constructor() {
    this.levels = [
      { name: 'operational', threshold: 0.6, agents: ['analyst', 'engineer', 'reviewer'] },
      { name: 'tactical', threshold: 0.8, agents: ['architect', 'lead', 'manager'] },
      { name: 'strategic', threshold: 0.9, agents: ['director', 'vp', 'cto'] },
      { name: 'critical', threshold: 0.95, agents: ['legal', 'ethical', 'fortuneTeller'] }
    ];
    this.votingHistory = new Map();
  }

  async makeDecision(context, criticality = 0.5) {
    console.log(`🗳️ Initiating decision process (criticality: ${criticality})`);
    
    // Determine which level needs to vote
    const requiredLevels = this.levels.filter(l => criticality >= l.threshold);
    
    const decisions = new Map();
    
    // Collect votes from each required level
    for (const level of requiredLevels) {
      const levelVotes = await this.collectVotes(level, context);
      decisions.set(level.name, levelVotes);
    }
    
    // Aggregate and score decisions
    const finalDecision = this.aggregateDecisions(decisions, criticality);
    
    // Record for learning
    this.recordDecision(context, finalDecision, criticality);
    
    return finalDecision;
  }

  async collectVotes(level, context) {
    const votes = [];
    
    // Get 3 votes from agents at this level
    const voters = this.selectVoters(level.agents, 3);
    
    const votePromises = voters.map(async (voter) => {
      const vote = await this.getVote(voter, context);
      return {
        voter,
        decision: vote.decision,
        confidence: vote.confidence,
        reasoning: vote.reasoning
      };
    });
    
    return Promise.all(votePromises);
  }

  selectVoters(agents, count) {
    // Randomly select 3 different agents for voting
    const shuffled = [...agents].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, agents.length));
  }

  async getVote(voter, context) {
    // Simulate agent voting (in real system, this would call actual agent)
    const decisions = ['approve', 'modify', 'reject', 'escalate'];
    const decision = decisions[Math.floor(Math.random() * decisions.length)];
    
    return {
      decision,
      confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
      reasoning: `${voter} analysis based on ${context.type}`
    };
  }

  aggregateDecisions(decisions, criticality) {
    const aggregated = {
      finalDecision: null,
      confidence: 0,
      votes: [],
      escalated: false
    };
    
    // Weight votes by level importance
    let totalWeight = 0;
    const weightedVotes = new Map();
    
    for (const [level, votes] of decisions) {
      const levelWeight = this.getLevelWeight(level, criticality);
      
      votes.forEach(vote => {
        const voteWeight = levelWeight * vote.confidence;
        totalWeight += voteWeight;
        
        if (!weightedVotes.has(vote.decision)) {
          weightedVotes.set(vote.decision, 0);
        }
        weightedVotes.set(vote.decision, 
          weightedVotes.get(vote.decision) + voteWeight
        );
        
        aggregated.votes.push({
          level,
          ...vote,
          weight: voteWeight
        });
      });
    }
    
    // Find winning decision
    let maxWeight = 0;
    for (const [decision, weight] of weightedVotes) {
      const normalizedWeight = weight / totalWeight;
      if (normalizedWeight > maxWeight) {
        maxWeight = normalizedWeight;
        aggregated.finalDecision = decision;
        aggregated.confidence = normalizedWeight;
      }
    }
    
    // Check if escalation needed
    if (aggregated.finalDecision === 'escalate' || aggregated.confidence < 0.7) {
      aggregated.escalated = true;
    }
    
    return aggregated;
  }

  getLevelWeight(level, criticality) {
    const weights = {
      'operational': 1.0,
      'tactical': 2.0,
      'strategic': 3.0,
      'critical': 5.0
    };
    
    // Increase weight for higher levels when criticality is high
    return weights[level] * (1 + criticality);
  }

  recordDecision(context, decision, criticality) {
    const key = `${context.type}:${criticality.toFixed(1)}`;
    if (!this.votingHistory.has(key)) {
      this.votingHistory.set(key, []);
    }
    
    this.votingHistory.get(key).push({
      decision: decision.finalDecision,
      confidence: decision.confidence,
      timestamp: Date.now()
    });
  }
}

// ===== MULTIPLE CONTEXT AGENTS =====
class MultiContextAgentSystem {
  constructor() {
    this.agents = new Map();
    this.agentTypes = [
      'assembler',      // Main context assembly
      'analyzer',       // Pre-analysis
      'reviewer',       // Review and validation
      'optimizer',      // Context optimization
      'compressor',     // Data compression
      'cache-manager',  // Cache handling
      'predictor'       // Predictive assembly
    ];
    
    this.initializeAgents();
  }

  initializeAgents() {
    // Create multiple instances of each agent type for redundancy
    this.agentTypes.forEach(type => {
      const agentCount = this.getAgentCount(type);
      
      for (let i = 0; i < agentCount; i++) {
        const agent = new ContextAgent(type, i);
        this.agents.set(`${type}-${i}`, agent);
      }
    });
    
    console.log(`✅ Initialized ${this.agents.size} context agents`);
  }

  getAgentCount(type) {
    // Different agent types need different counts for redundancy
    const counts = {
      'assembler': 3,      // Triple redundancy for critical path
      'analyzer': 2,       // Dual redundancy
      'reviewer': 2,       // Dual redundancy
      'optimizer': 2,      // Dual redundancy
      'compressor': 4,     // More for parallel processing
      'cache-manager': 1,  // Single instance sufficient
      'predictor': 2       // Dual for different prediction strategies
    };
    
    return counts[type] || 1;
  }

  async processContext(task, step) {
    const startTime = Date.now();
    
    // Parallel processing pipeline
    const pipeline = [
      { stage: 'analyze', agents: ['analyzer'] },
      { stage: 'assemble', agents: ['assembler', 'predictor'] },
      { stage: 'optimize', agents: ['optimizer', 'compressor'] },
      { stage: 'review', agents: ['reviewer'] }
    ];
    
    let context = { task, step };
    
    for (const stage of pipeline) {
      context = await this.runStage(stage, context);
    }
    
    const duration = Date.now() - startTime;
    console.log(`⚡ Context processed in ${duration}ms`);
    
    return context;
  }

  async runStage(stage, context) {
    console.log(`🔄 Running stage: ${stage.stage}`);
    
    // Get available agents for this stage
    const availableAgents = this.getAvailableAgents(stage.agents);
    
    if (availableAgents.length === 0) {
      throw new Error(`No available agents for stage: ${stage.stage}`);
    }
    
    // Run agents in parallel
    const results = await Promise.all(
      availableAgents.map(agent => agent.process(context))
    );
    
    // Merge results (voting if multiple agents)
    if (results.length > 1) {
      return this.mergeResults(results);
    }
    
    return results[0];
  }

  getAvailableAgents(types) {
    const available = [];
    
    types.forEach(type => {
      for (const [id, agent] of this.agents) {
        if (id.startsWith(type) && agent.isAvailable()) {
          available.push(agent);
        }
      }
    });
    
    return available;
  }

  mergeResults(results) {
    // Simple voting mechanism for redundant processing
    const merged = {
      ...results[0],
      _confidence: 0,
      _sources: results.length
    };
    
    // Calculate confidence based on agreement
    let agreements = 0;
    const baseHash = this.hashResult(results[0]);
    
    results.forEach(result => {
      if (this.hashResult(result) === baseHash) {
        agreements++;
      }
    });
    
    merged._confidence = agreements / results.length;
    
    return merged;
  }

  hashResult(result) {
    // Simple hash for comparison
    return JSON.stringify(result).length;
  }
}

// ===== INDIVIDUAL CONTEXT AGENT =====
class ContextAgent {
  constructor(type, id) {
    this.type = type;
    this.id = `${type}-${id}`;
    this.status = 'idle';
    this.workload = 0;
    this.maxWorkload = this.getMaxWorkload();
    this.processingTime = new Map();
  }

  getMaxWorkload() {
    const limits = {
      'assembler': 3,
      'analyzer': 5,
      'reviewer': 4,
      'optimizer': 4,
      'compressor': 10,
      'cache-manager': 20,
      'predictor': 3
    };
    return limits[this.type] || 5;
  }

  isAvailable() {
    return this.status === 'idle' && this.workload < this.maxWorkload;
  }

  async process(context) {
    this.status = 'busy';
    this.workload++;
    
    const startTime = Date.now();
    
    try {
      // Process based on agent type
      let result;
      switch (this.type) {
        case 'analyzer':
          result = await this.analyze(context);
          break;
        case 'assembler':
          result = await this.assemble(context);
          break;
        case 'reviewer':
          result = await this.review(context);
          break;
        case 'optimizer':
          result = await this.optimize(context);
          break;
        case 'compressor':
          result = await this.compress(context);
          break;
        case 'predictor':
          result = await this.predict(context);
          break;
        default:
          result = context;
      }
      
      const duration = Date.now() - startTime;
      this.recordProcessingTime(duration);
      
      return result;
    } finally {
      this.workload--;
      this.status = 'idle';
    }
  }

  async analyze(context) {
    // Simulate analysis
    await this.simulate(50);
    return {
      ...context,
      analysis: {
        complexity: Math.random(),
        requiredModels: ['gpt4', 'claude'],
        estimatedTokens: Math.floor(Math.random() * 4000) + 1000
      }
    };
  }

  async assemble(context) {
    await this.simulate(100);
    return {
      ...context,
      assembled: true,
      components: ['history', 'objective', 'constraints', 'patterns'],
      timestamp: Date.now()
    };
  }

  async review(context) {
    await this.simulate(30);
    return {
      ...context,
      reviewed: true,
      issues: [],
      score: Math.random() * 0.3 + 0.7
    };
  }

  async optimize(context) {
    await this.simulate(40);
    return {
      ...context,
      optimized: true,
      reduction: Math.random() * 0.5 + 0.3
    };
  }

  async compress(context) {
    await this.simulate(20);
    const original = JSON.stringify(context).length;
    return {
      ...context,
      compressed: true,
      originalSize: original,
      compressedSize: Math.floor(original * 0.6)
    };
  }

  async predict(context) {
    await this.simulate(60);
    return {
      ...context,
      predictions: {
        nextSteps: ['implement', 'test', 'deploy'],
        likelyIssues: [],
        suggestedApproach: 'iterative'
      }
    };
  }

  async simulate(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  recordProcessingTime(duration) {
    const hour = new Date().getHours();
    if (!this.processingTime.has(hour)) {
      this.processingTime.set(hour, []);
    }
    this.processingTime.get(hour).push(duration);
  }

  getAverageProcessingTime() {
    let total = 0;
    let count = 0;
    
    for (const times of this.processingTime.values()) {
      total += times.reduce((a, b) => a + b, 0);
      count += times.length;
    }
    
    return count > 0 ? total / count : 0;
  }
}

// ===== RESOURCE MONITOR =====
class ResourceMonitor extends EventEmitter {
  constructor() {
    super();
    this.thresholds = {
      cpu: 80,          // %
      memory: 85,       // %
      agents: 90,       // % of max
      latency: 1000     // ms
    };
    this.alerts = [];
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => this.checkResources(), 1000);
    setInterval(() => this.checkLatency(), 5000);
  }

  checkResources() {
    const stats = {
      cpu: this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      agents: this.getAgentUsage(),
      timestamp: Date.now()
    };
    
    // Check thresholds
    for (const [resource, value] of Object.entries(stats)) {
      if (resource === 'timestamp') continue;
      
      if (value > this.thresholds[resource]) {
        this.raiseAlert(resource, value);
      }
    }
    
    this.emit('stats', stats);
  }

  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return 100 - ~~(100 * totalIdle / totalTick);
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total * 100).toFixed(2);
  }

  getAgentUsage() {
    // This would check actual agent usage
    return Math.random() * 100; // Simulated
  }

  async checkLatency() {
    const start = Date.now();
    // Simulate a context assembly
    await new Promise(resolve => setTimeout(resolve, 10));
    const latency = Date.now() - start;
    
    if (latency > this.thresholds.latency) {
      this.raiseAlert('latency', latency);
    }
  }

  raiseAlert(resource, value) {
    const alert = {
      resource,
      value,
      threshold: this.thresholds[resource],
      severity: this.getSeverity(resource, value),
      timestamp: Date.now(),
      suggestions: this.getSuggestions(resource, value)
    };
    
    this.alerts.push(alert);
    this.emit('alert', alert);
    
    console.log(`🚨 ALERT: ${resource} at ${value} (threshold: ${this.thresholds[resource]})`);
    console.log(`💡 Suggestions: ${alert.suggestions.join(', ')}`);
  }

  getSeverity(resource, value) {
    const ratio = value / this.thresholds[resource];
    if (ratio > 1.2) return 'critical';
    if (ratio > 1.1) return 'high';
    return 'medium';
  }

  getSuggestions(resource, value) {
    const suggestions = {
      cpu: [
        'Scale out agents to multiple processes',
        'Optimize context compression algorithms',
        'Reduce parallel processing limit'
      ],
      memory: [
        'Clear context cache',
        'Reduce context retention period',
        'Implement more aggressive compression'
      ],
      agents: [
        'Spawn additional agent instances',
        'Implement agent pooling',
        'Queue low-priority tasks'
      ],
      latency: [
        'Enable context pre-warming',
        'Increase cache hit rate',
        'Optimize database queries'
      ]
    };
    
    return suggestions[resource] || ['Review system configuration'];
  }
}

// ===== GRANULAR TASK DECOMPOSER =====
class TaskDecomposer {
  constructor() {
    this.decompositionRules = new Map();
    this.minTaskDuration = 100; // ms
    this.maxParallelTasks = 20;
  }

  async decompose(task) {
    console.log(`🔨 Decomposing task: ${task.type}`);
    
    // Check if task needs decomposition
    if (this.isAtomic(task)) {
      return [task];
    }
    
    // Apply decomposition rules
    const subtasks = await this.applyDecompositionRules(task);
    
    // Further decompose if needed
    const granularTasks = [];
    for (const subtask of subtasks) {
      if (this.needsFurtherDecomposition(subtask)) {
        const decomposed = await this.decompose(subtask);
        granularTasks.push(...decomposed);
      } else {
        granularTasks.push(subtask);
      }
    }
    
    // Optimize for parallel execution
    return this.optimizeForParallelism(granularTasks);
  }

  isAtomic(task) {
    // Check if task is already atomic
    return task.atomic === true || 
           task.estimatedDuration < this.minTaskDuration ||
           !task.steps || task.steps.length <= 1;
  }

  async applyDecompositionRules(task) {
    const rules = {
      'api': ['parse-spec', 'design-endpoints', 'implement-routes', 'add-validation', 'test-endpoints'],
      'feature': ['analyze-requirements', 'design-ui', 'implement-logic', 'add-tests', 'integrate'],
      'optimization': ['profile-baseline', 'identify-bottlenecks', 'apply-fixes', 'measure-improvement'],
      'refactor': ['analyze-code', 'plan-changes', 'refactor-modules', 'update-tests', 'verify']
    };
    
    const subtasks = [];
    const steps = rules[task.type] || ['analyze', 'implement', 'test'];
    
    steps.forEach((step, index) => {
      subtasks.push({
        id: `${task.id}-${step}`,
        parent: task.id,
        type: step,
        step: index,
        dependencies: index > 0 ? [`${task.id}-${steps[index-1]}`] : [],
        atomic: true,
        estimatedDuration: this.estimateDuration(step)
      });
    });
    
    return subtasks;
  }

  needsFurtherDecomposition(task) {
    return task.estimatedDuration > this.minTaskDuration * 10 && !task.atomic;
  }

  optimizeForParallelism(tasks) {
    // Build dependency graph
    const graph = this.buildDependencyGraph(tasks);
    
    // Find parallel execution paths
    const parallelGroups = this.findParallelGroups(graph);
    
    // Balance workload
    return this.balanceWorkload(parallelGroups);
  }

  buildDependencyGraph(tasks) {
    const graph = new Map();
    
    tasks.forEach(task => {
      graph.set(task.id, {
        task,
        dependencies: task.dependencies || [],
        dependents: []
      });
    });
    
    // Build dependents
    graph.forEach((node, id) => {
      node.dependencies.forEach(dep => {
        if (graph.has(dep)) {
          graph.get(dep).dependents.push(id);
        }
      });
    });
    
    return graph;
  }

  findParallelGroups(graph) {
    const groups = [];
    const visited = new Set();
    
    // Topological sort to find execution order
    const sorted = this.topologicalSort(graph);
    
    // Group tasks that can run in parallel
    let currentGroup = [];
    let currentDeps = new Set();
    
    sorted.forEach(taskId => {
      const node = graph.get(taskId);
      const canParallel = node.dependencies.every(dep => 
        visited.has(dep) && !currentDeps.has(dep)
      );
      
      if (canParallel && currentGroup.length < this.maxParallelTasks) {
        currentGroup.push(node.task);
        node.dependencies.forEach(dep => currentDeps.add(dep));
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [node.task];
        currentDeps = new Set(node.dependencies);
      }
      
      visited.add(taskId);
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  topologicalSort(graph) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error('Circular dependency detected');
      
      visiting.add(id);
      
      const node = graph.get(id);
      if (node) {
        node.dependencies.forEach(dep => visit(dep));
      }
      
      visiting.delete(id);
      visited.add(id);
      sorted.push(id);
    };
    
    graph.forEach((_, id) => visit(id));
    
    return sorted;
  }

  balanceWorkload(groups) {
    // Balance tasks across groups for optimal resource usage
    return groups.map(group => ({
      tasks: group,
      estimatedDuration: Math.max(...group.map(t => t.estimatedDuration || 100)),
      parallelism: group.length
    }));
  }

  estimateDuration(step) {
    const estimates = {
      'analyze': 200,
      'design': 300,
      'implement': 500,
      'test': 400,
      'optimize': 300,
      'review': 200
    };
    return estimates[step] || 250;
  }
}

// ===== MAIN ORCHESTRATOR =====
class EnhancedSwarmOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.contextSystem = new MultiContextAgentSystem();
    this.decisionSystem = new HierarchicalDecisionSystem();
    this.resourceMonitor = new ResourceMonitor();
    this.taskDecomposer = new TaskDecomposer();
    this.activeProcesses = new Map();
    
    this.initialize();
  }

  initialize() {
    // Listen to resource alerts
    this.resourceMonitor.on('alert', (alert) => {
      this.handleResourceAlert(alert);
    });
    
    // Listen to context events
    this.on('task:created', async (task) => {
      await this.processTask(task);
    });
    
    console.log('✅ Enhanced Swarm Orchestrator initialized');
  }

  async processTask(task) {
    console.log(`📋 Processing task: ${task.id}`);
    
    // Decompose task into granular subtasks
    const subtasks = await this.taskDecomposer.decompose(task);
    console.log(`📊 Decomposed into ${subtasks.length} subtasks`);
    
    // Process subtask groups in parallel
    for (const group of subtasks) {
      await this.processTaskGroup(group);
    }
  }

  async processTaskGroup(group) {
    const processes = group.tasks.map(async (task) => {
      // Create context for each subtask
      const context = await this.contextSystem.processContext(task, 0);
      
      // Get decision on how to proceed
      const criticality = this.calculateCriticality(task);
      const decision = await this.decisionSystem.makeDecision(context, criticality);
      
      // Execute based on decision
      return this.executeDecision(task, context, decision);
    });
    
    // Wait for all parallel tasks
    const results = await Promise.all(processes);
    
    // Emit completion event
    this.emit('taskGroup:completed', {
      group,
      results,
      duration: group.estimatedDuration
    });
  }

  calculateCriticality(task) {
    // Calculate based on various factors
    let criticality = 0.5;
    
    if (task.type.includes('security')) criticality += 0.3;
    if (task.type.includes('payment')) criticality += 0.2;
    if (task.priority === 'high') criticality += 0.2;
    if (task.legal === true) criticality += 0.4;
    
    return Math.min(criticality, 1.0);
  }

  async executeDecision(task, context, decision) {
    console.log(`⚡ Executing decision: ${decision.finalDecision} for task ${task.id}`);
    
    switch (decision.finalDecision) {
      case 'approve':
        return this.executeTask(task, context);
      
      case 'modify':
        const modified = await this.modifyTask(task, decision.votes);
        return this.executeTask(modified, context);
      
      case 'reject':
        return { success: false, reason: 'Rejected by decision system', decision };
      
      case 'escalate':
        return this.escalateTask(task, context, decision);
      
      default:
        return this.executeTask(task, context);
    }
  }

  async executeTask(task, context) {
    // Simulate task execution
    await new Promise(resolve => setTimeout(resolve, task.estimatedDuration || 100));
    
    return {
      success: true,
      task: task.id,
      context: context,
      timestamp: Date.now()
    };
  }

  async modifyTask(task, votes) {
    // Apply modifications suggested by voters
    const modifications = votes
      .filter(v => v.decision === 'modify')
      .map(v => v.reasoning);
    
    return {
      ...task,
      modified: true,
      modifications
    };
  }

  async escalateTask(task, context, decision) {
    console.log(`🚨 Escalating task ${task.id} to critical decision makers`);
    
    // Get critical level decision
    const criticalDecision = await this.decisionSystem.makeDecision(context, 0.95);
    
    return {
      success: true,
      escalated: true,
      originalDecision: decision,
      criticalDecision,
      task: task.id
    };
  }

  handleResourceAlert(alert) {
    console.log(`🚨 Resource alert: ${alert.resource} - ${alert.severity}`);
    
    // Apply suggestions automatically
    if (alert.severity === 'critical') {
      this.applyCriticalMeasures(alert);
    }
    
    // Notify user
    this.emit('resource:alert', alert);
  }

  applyCriticalMeasures(alert) {
    switch (alert.resource) {
      case 'cpu':
        // Reduce parallel processing
        this.taskDecomposer.maxParallelTasks = Math.floor(this.taskDecomposer.maxParallelTasks * 0.7);
        break;
      
      case 'memory':
        // Clear caches
        this.contextSystem.agents.forEach(agent => {
          if (agent.type === 'cache-manager') {
            agent.clearCache();
          }
        });
        break;
      
      case 'agents':
        // Queue low priority tasks
        this.priorityQueueEnabled = true;
        break;
    }
  }
}

// ===== EXPORTS =====
module.exports = {
  EnhancedSwarmOrchestrator,
  HierarchicalDecisionSystem,
  MultiContextAgentSystem,
  ResourceMonitor,
  TaskDecomposer,
  ContextAgent
};

// ===== USAGE EXAMPLE =====
if (require.main === module) {
  const orchestrator = new EnhancedSwarmOrchestrator();
  
  // Create a complex task
  const task = {
    id: 'task-001',
    type: 'api',
    objective: 'Build secure payment processing API',
    priority: 'high',
    legal: true,
    steps: [
      'analyze security requirements',
      'design payment flow',
      'implement encryption',
      'add compliance checks',
      'test thoroughly'
    ]
  };
  
  // Process the task
  orchestrator.emit('task:created', task);
  
  // Monitor resources
  orchestrator.resourceMonitor.on('stats', (stats) => {
    console.log(`📊 Resources - CPU: ${stats.cpu}%, Memory: ${stats.memory}%`);
  });
}