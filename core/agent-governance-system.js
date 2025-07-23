// agent-governance-system.js - Agent Role Review, Creation, and Oversight System

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ===== AGENT ROLE DEFINITIONS =====
class AgentRoleRegistry {
  constructor() {
    this.roles = new Map();
    this.roleVersions = new Map();
    this.templates = new Map();
    
    this.initializeStandardRoles();
  }

  initializeStandardRoles() {
    // Core system roles
    this.registerRole({
      id: 'orchestrator',
      name: 'Orchestrator Agent',
      category: 'system',
      description: 'Coordinates tasks and manages agent workflows',
      capabilities: ['task_routing', 'workflow_management', 'resource_allocation'],
      permissions: ['read_all_tasks', 'assign_tasks', 'monitor_agents'],
      resourceLimits: {
        memory: '1GB',
        cpu: '2 cores',
        networkConnections: 100
      },
      securityLevel: 'high',
      complianceRequirements: ['audit_logging', 'access_control'],
      approvalLevel: 'strategic'
    });

    this.registerRole({
      id: 'context-assembler',
      name: 'Context Assembly Agent',
      category: 'processing',
      description: 'Assembles and optimizes context for task execution',
      capabilities: ['context_assembly', 'data_compression', 'pattern_matching'],
      permissions: ['read_contexts', 'write_contexts', 'access_knowledge_base'],
      resourceLimits: {
        memory: '512MB',
        cpu: '1 core',
        networkConnections: 50
      },
      securityLevel: 'medium',
      complianceRequirements: ['data_classification'],
      approvalLevel: 'tactical'
    });

    this.registerRole({
      id: 'compliance-monitor',
      name: 'Compliance Monitoring Agent',
      category: 'governance',
      description: 'Monitors system compliance and enforces policies',
      capabilities: ['compliance_checking', 'policy_enforcement', 'audit_reporting'],
      permissions: ['read_all_resources', 'enforce_policies', 'generate_reports'],
      resourceLimits: {
        memory: '256MB',
        cpu: '0.5 cores',
        networkConnections: 25
      },
      securityLevel: 'critical',
      complianceRequirements: ['immutable_logs', 'encryption', 'access_control'],
      approvalLevel: 'critical'
    });

    this.registerRole({
      id: 'developer',
      name: 'Development Agent',
      category: 'development',
      description: 'Performs development tasks including coding and testing',
      capabilities: ['code_generation', 'code_review', 'testing', 'debugging'],
      permissions: ['read_code', 'write_code', 'execute_tests', 'access_development_tools'],
      resourceLimits: {
        memory: '2GB',
        cpu: '4 cores',
        networkConnections: 100
      },
      securityLevel: 'medium',
      complianceRequirements: ['code_scanning', 'secret_detection'],
      approvalLevel: 'operational'
    });

    this.registerRole({
      id: 'security-scanner',
      name: 'Security Scanning Agent',
      category: 'security',
      description: 'Performs security scans and vulnerability assessments',
      capabilities: ['vulnerability_scanning', 'threat_detection', 'security_analysis'],
      permissions: ['read_system_config', 'scan_resources', 'generate_security_reports'],
      resourceLimits: {
        memory: '1GB',
        cpu: '2 cores',
        networkConnections: 200
      },
      securityLevel: 'critical',
      complianceRequirements: ['secure_communication', 'audit_logging'],
      approvalLevel: 'strategic'
    });
  }

  registerRole(roleDefinition) {
    const role = {
      ...roleDefinition,
      id: roleDefinition.id,
      version: '1.0.0',
      status: 'active',
      createdAt: Date.now(),
      lastModified: Date.now(),
      createdBy: 'system'
    };

    this.roles.set(role.id, role);
    
    // Track versions
    if (!this.roleVersions.has(role.id)) {
      this.roleVersions.set(role.id, []);
    }
    this.roleVersions.get(role.id).push({
      version: role.version,
      timestamp: role.createdAt,
      changes: 'Initial creation'
    });

    return role.id;
  }

  getRole(roleId) {
    return this.roles.get(roleId);
  }

  getAllRoles() {
    return Array.from(this.roles.values());
  }

  getRolesByCategory(category) {
    return this.getAllRoles().filter(role => role.category === category);
  }

  validateRoleDefinition(roleDefinition) {
    const errors = [];
    const warnings = [];

    // Required fields
    const required = ['id', 'name', 'category', 'description', 'capabilities', 'permissions'];
    for (const field of required) {
      if (!roleDefinition[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // ID format validation
    if (roleDefinition.id && !/^[a-z]+(-[a-z]+)*$/.test(roleDefinition.id)) {
      errors.push('Role ID must be lowercase with hyphens');
    }

    // Security level validation
    const validSecurityLevels = ['low', 'medium', 'high', 'critical'];
    if (roleDefinition.securityLevel && !validSecurityLevels.includes(roleDefinition.securityLevel)) {
      errors.push(`Invalid security level. Must be one of: ${validSecurityLevels.join(', ')}`);
    }

    // Resource limits validation
    if (roleDefinition.resourceLimits) {
      if (!roleDefinition.resourceLimits.memory) {
        warnings.push('No memory limit specified - using default 256MB');
      }
      if (!roleDefinition.resourceLimits.cpu) {
        warnings.push('No CPU limit specified - using default 0.5 cores');
      }
    }

    // Capability validation
    if (roleDefinition.capabilities && roleDefinition.capabilities.length === 0) {
      warnings.push('No capabilities specified - agent may have limited functionality');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ===== AGENT PROPOSAL SYSTEM =====
class AgentProposalSystem extends EventEmitter {
  constructor(roleRegistry, decisionSystem) {
    super();
    this.roleRegistry = roleRegistry;
    this.decisionSystem = decisionSystem;
    this.proposals = new Map();
    this.proposalHistory = [];
    
    this.proposalStates = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented'];
  }

  async createProposal(proposalData) {
    const proposal = {
      id: crypto.randomUUID(),
      type: proposalData.type || 'new_role', // new_role, modify_role, retire_role
      title: proposalData.title,
      description: proposalData.description,
      justification: proposalData.justification,
      proposedBy: proposalData.proposedBy,
      priority: proposalData.priority || 'normal',
      expectedBenefits: proposalData.expectedBenefits || [],
      risksAndMitigation: proposalData.risksAndMitigation || [],
      resourceRequirements: proposalData.resourceRequirements || {},
      implementationPlan: proposalData.implementationPlan || {},
      roleDefinition: proposalData.roleDefinition || null,
      state: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviews: [],
      approvals: [],
      rejections: []
    };

    // Validate role definition if provided
    if (proposal.roleDefinition) {
      const validation = this.roleRegistry.validateRoleDefinition(proposal.roleDefinition);
      if (!validation.valid) {
        throw new Error(`Invalid role definition: ${validation.errors.join(', ')}`);
      }
      proposal.validationWarnings = validation.warnings;
    }

    this.proposals.set(proposal.id, proposal);
    
    this.emit('proposal:created', proposal);
    
    return proposal.id;
  }

  async submitProposal(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.state !== 'draft') {
      throw new Error(`Proposal ${proposalId} is not in draft state`);
    }

    // Perform pre-submission validation
    const validation = await this.validateProposal(proposal);
    if (!validation.valid) {
      throw new Error(`Proposal validation failed: ${validation.errors.join(', ')}`);
    }

    proposal.state = 'submitted';
    proposal.updatedAt = Date.now();
    proposal.submittedAt = Date.now();

    // Automatically assign reviewers based on proposal type and impact
    await this.assignReviewers(proposal);

    this.emit('proposal:submitted', proposal);

    return true;
  }

  async validateProposal(proposal) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!proposal.title) errors.push('Title is required');
    if (!proposal.description) errors.push('Description is required');
    if (!proposal.justification) errors.push('Justification is required');

    // Check role definition for new roles
    if (proposal.type === 'new_role' && !proposal.roleDefinition) {
      errors.push('Role definition is required for new role proposals');
    }

    // Check for duplicate role IDs
    if (proposal.roleDefinition && this.roleRegistry.getRole(proposal.roleDefinition.id)) {
      errors.push(`Role ID '${proposal.roleDefinition.id}' already exists`);
    }

    // Check resource impact
    if (proposal.resourceRequirements) {
      const impact = this.assessResourceImpact(proposal.resourceRequirements);
      if (impact.level === 'high') {
        warnings.push('High resource impact detected - additional approvals may be required');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async assignReviewers(proposal) {
    const reviewers = [];

    // Assign based on proposal type and impact
    switch (proposal.type) {
      case 'new_role':
        reviewers.push('architecture-team', 'security-team');
        if (proposal.roleDefinition?.securityLevel === 'critical') {
          reviewers.push('compliance-team', 'legal-team');
        }
        break;
      
      case 'modify_role':
        reviewers.push('architecture-team');
        if (this.isSecurityImpacting(proposal)) {
          reviewers.push('security-team');
        }
        break;
      
      case 'retire_role':
        reviewers.push('architecture-team', 'operations-team');
        break;
    }

    // Add resource reviewer for high-impact proposals
    const resourceImpact = this.assessResourceImpact(proposal.resourceRequirements);
    if (resourceImpact.level === 'high') {
      reviewers.push('resource-management-team');
    }

    proposal.assignedReviewers = reviewers;
    proposal.state = 'under_review';

    this.emit('proposal:review_assigned', {
      proposalId: proposal.id,
      reviewers
    });
  }

  async submitReview(proposalId, reviewerId, review) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const reviewRecord = {
      reviewerId,
      decision: review.decision, // approve, reject, request_changes
      comments: review.comments,
      concerns: review.concerns || [],
      recommendations: review.recommendations || [],
      timestamp: Date.now()
    };

    proposal.reviews.push(reviewRecord);
    proposal.updatedAt = Date.now();

    // Check if all required reviews are complete
    await this.checkReviewCompletion(proposal);

    this.emit('proposal:reviewed', {
      proposalId,
      reviewerId,
      decision: review.decision
    });

    return true;
  }

  async checkReviewCompletion(proposal) {
    const requiredReviewers = proposal.assignedReviewers || [];
    const completedReviews = new Set(proposal.reviews.map(r => r.reviewerId));

    // Check if all required reviewers have submitted reviews
    const allReviewsComplete = requiredReviewers.every(reviewer => 
      completedReviews.has(reviewer)
    );

    if (allReviewsComplete) {
      // Determine overall review outcome
      const approvals = proposal.reviews.filter(r => r.decision === 'approve').length;
      const rejections = proposal.reviews.filter(r => r.decision === 'reject').length;
      const changesRequested = proposal.reviews.filter(r => r.decision === 'request_changes').length;

      if (rejections > 0) {
        proposal.state = 'rejected';
        this.emit('proposal:rejected', proposal);
      } else if (changesRequested > 0) {
        proposal.state = 'draft'; // Back to draft for modifications
        this.emit('proposal:changes_requested', proposal);
      } else if (approvals === requiredReviewers.length) {
        // All approved - move to decision system
        await this.escalateToDecisionSystem(proposal);
      }
    }
  }

  async escalateToDecisionSystem(proposal) {
    // Determine criticality for hierarchical decision system
    const criticality = this.calculateProposalCriticality(proposal);
    
    const decisionContext = {
      type: 'agent_proposal',
      proposal: proposal,
      impact: this.assessOverallImpact(proposal),
      urgency: proposal.priority
    };

    // Use hierarchical decision system
    const decision = await this.decisionSystem.makeDecision(decisionContext, criticality);

    if (decision.finalDecision === 'approve') {
      proposal.state = 'approved';
      proposal.approvedAt = Date.now();
      proposal.finalDecision = decision;
      
      // Schedule implementation
      await this.scheduleImplementation(proposal);
      
      this.emit('proposal:approved', proposal);
    } else {
      proposal.state = 'rejected';
      proposal.rejectedAt = Date.now();
      proposal.finalDecision = decision;
      
      this.emit('proposal:rejected', proposal);
    }
  }

  calculateProposalCriticality(proposal) {
    let criticality = 0.5; // Base level

    // Security level impact
    if (proposal.roleDefinition?.securityLevel === 'critical') {
      criticality += 0.3;
    } else if (proposal.roleDefinition?.securityLevel === 'high') {
      criticality += 0.2;
    }

    // Resource impact
    const resourceImpact = this.assessResourceImpact(proposal.resourceRequirements);
    if (resourceImpact.level === 'high') {
      criticality += 0.2;
    }

    // Compliance requirements
    if (proposal.roleDefinition?.complianceRequirements?.length > 2) {
      criticality += 0.15;
    }

    // System impact
    if (proposal.type === 'new_role' && proposal.roleDefinition?.category === 'system') {
      criticality += 0.1;
    }

    return Math.min(criticality, 1.0);
  }

  assessResourceImpact(resourceRequirements) {
    if (!resourceRequirements) return { level: 'low', score: 0 };

    let score = 0;

    // Memory impact
    if (resourceRequirements.memory) {
      const memoryGB = this.parseMemoryToGB(resourceRequirements.memory);
      if (memoryGB > 4) score += 3;
      else if (memoryGB > 2) score += 2;
      else if (memoryGB > 1) score += 1;
    }

    // CPU impact
    if (resourceRequirements.cpu) {
      const cpuCores = this.parseCPUCores(resourceRequirements.cpu);
      if (cpuCores > 4) score += 3;
      else if (cpuCores > 2) score += 2;
      else if (cpuCores > 1) score += 1;
    }

    // Network impact
    if (resourceRequirements.networkConnections > 200) score += 2;
    else if (resourceRequirements.networkConnections > 100) score += 1;

    let level = 'low';
    if (score >= 6) level = 'high';
    else if (score >= 3) level = 'medium';

    return { level, score };
  }

  parseMemoryToGB(memoryStr) {
    const match = memoryStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'GB': return value;
      case 'MB': return value / 1024;
      case 'KB': return value / (1024 * 1024);
      default: return 0;
    }
  }

  parseCPUCores(cpuStr) {
    const match = cpuStr.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  isSecurityImpacting(proposal) {
    if (proposal.roleDefinition) {
      // Check if modifying security-related capabilities or permissions
      const securityCapabilities = ['security_scanning', 'compliance_checking', 'access_control'];
      const securityPermissions = ['admin_access', 'security_config', 'audit_logs'];

      return (
        proposal.roleDefinition.capabilities?.some(cap => securityCapabilities.includes(cap)) ||
        proposal.roleDefinition.permissions?.some(perm => securityPermissions.includes(perm))
      );
    }
    return false;
  }

  assessOverallImpact(proposal) {
    const impacts = {
      security: this.isSecurityImpacting(proposal) ? 'high' : 'low',
      performance: this.assessResourceImpact(proposal.resourceRequirements).level,
      compliance: proposal.roleDefinition?.complianceRequirements?.length > 0 ? 'medium' : 'low',
      operational: proposal.type === 'retire_role' ? 'high' : 'medium'
    };

    return impacts;
  }

  async scheduleImplementation(proposal) {
    const implementation = {
      proposalId: proposal.id,
      scheduledAt: Date.now(),
      estimatedDuration: this.estimateImplementationTime(proposal),
      steps: this.generateImplementationSteps(proposal),
      status: 'scheduled'
    };

    proposal.implementation = implementation;

    this.emit('implementation:scheduled', {
      proposalId: proposal.id,
      implementation
    });
  }

  estimateImplementationTime(proposal) {
    // Base time estimates in minutes
    const baseTime = {
      'new_role': 120,
      'modify_role': 60,
      'retire_role': 30
    };

    let time = baseTime[proposal.type] || 60;

    // Adjust for complexity
    if (proposal.roleDefinition?.securityLevel === 'critical') {
      time *= 1.5;
    }

    const resourceImpact = this.assessResourceImpact(proposal.resourceRequirements);
    if (resourceImpact.level === 'high') {
      time *= 1.3;
    }

    return Math.round(time);
  }

  generateImplementationSteps(proposal) {
    const steps = [];

    switch (proposal.type) {
      case 'new_role':
        steps.push(
          { name: 'Create role definition', duration: 15 },
          { name: 'Set up resource allocations', duration: 30 },
          { name: 'Configure permissions', duration: 20 },
          { name: 'Deploy agent template', duration: 45 },
          { name: 'Run validation tests', duration: 30 },
          { name: 'Update documentation', duration: 15 }
        );
        break;

      case 'modify_role':
        steps.push(
          { name: 'Backup current configuration', duration: 10 },
          { name: 'Apply modifications', duration: 30 },
          { name: 'Update permissions', duration: 15 },
          { name: 'Test changes', duration: 20 },
          { name: 'Update documentation', duration: 10 }
        );
        break;

      case 'retire_role':
        steps.push(
          { name: 'Identify active instances', duration: 10 },
          { name: 'Graceful shutdown', duration: 15 },
          { name: 'Resource cleanup', duration: 10 },
          { name: 'Remove permissions', duration: 5 },
          { name: 'Archive configuration', duration: 5 }
        );
        break;
    }

    return steps;
  }

  getProposal(proposalId) {
    return this.proposals.get(proposalId);
  }

  getAllProposals() {
    return Array.from(this.proposals.values());
  }

  getProposalsByState(state) {
    return this.getAllProposals().filter(proposal => proposal.state === state);
  }

  getProposalsByProposer(proposedBy) {
    return this.getAllProposals().filter(proposal => proposal.proposedBy === proposedBy);
  }
}

// ===== AGENT OVERSIGHT SYSTEM =====
class AgentOversightSystem extends EventEmitter {
  constructor(roleRegistry) {
    super();
    this.roleRegistry = roleRegistry;
    this.activeAgents = new Map();
    this.oversightRules = new Map();
    this.violations = new Map();
    
    this.initializeOversightRules();
    this.startContinuousMonitoring();
  }

  initializeOversightRules() {
    // Resource usage rules
    this.addOversightRule('resource_limits', {
      description: 'Monitor agent resource usage against defined limits',
      checkInterval: 30000, // 30 seconds
      severity: 'high',
      check: (agent) => this.checkResourceUsage(agent),
      action: (agent, violation) => this.handleResourceViolation(agent, violation)
    });

    // Permission compliance rules
    this.addOversightRule('permission_compliance', {
      description: 'Ensure agents only use permitted capabilities',
      checkInterval: 60000, // 1 minute
      severity: 'critical',
      check: (agent) => this.checkPermissionCompliance(agent),
      action: (agent, violation) => this.handlePermissionViolation(agent, violation)
    });

    // Health and availability rules
    this.addOversightRule('health_check', {
      description: 'Monitor agent health and responsiveness',
      checkInterval: 15000, // 15 seconds
      severity: 'medium',
      check: (agent) => this.checkAgentHealth(agent),
      action: (agent, violation) => this.handleHealthViolation(agent, violation)
    });

    // Security compliance rules
    this.addOversightRule('security_compliance', {
      description: 'Verify security requirements are met',
      checkInterval: 120000, // 2 minutes
      severity: 'critical',
      check: (agent) => this.checkSecurityCompliance(agent),
      action: (agent, violation) => this.handleSecurityViolation(agent, violation)
    });
  }

  addOversightRule(ruleId, rule) {
    this.oversightRules.set(ruleId, {
      ...rule,
      id: ruleId,
      lastCheck: 0,
      violations: 0
    });
  }

  registerAgent(agentInstance) {
    const agent = {
      id: agentInstance.id,
      roleId: agentInstance.roleId,
      role: this.roleRegistry.getRole(agentInstance.roleId),
      instance: agentInstance,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      status: 'active',
      resourceUsage: {
        memory: 0,
        cpu: 0,
        networkConnections: 0
      },
      violations: [],
      metrics: {
        tasksCompleted: 0,
        errorsEncountered: 0,
        averageResponseTime: 0
      }
    };

    this.activeAgents.set(agent.id, agent);
    
    this.emit('agent:registered', agent);
    
    return agent.id;
  }

  deregisterAgent(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return false;

    agent.status = 'deregistered';
    agent.deregisteredAt = Date.now();

    this.activeAgents.delete(agentId);
    
    this.emit('agent:deregistered', { agentId, roleId: agent.roleId });
    
    return true;
  }

  startContinuousMonitoring() {
    setInterval(async () => {
      await this.performOversightChecks();
    }, 10000); // Check every 10 seconds

    console.log('🔍 Agent oversight monitoring started');
  }

  async performOversightChecks() {
    const now = Date.now();

    for (const [ruleId, rule] of this.oversightRules) {
      if (now - rule.lastCheck >= rule.checkInterval) {
        await this.executeOversightRule(rule);
        rule.lastCheck = now;
      }
    }
  }

  async executeOversightRule(rule) {
    for (const [agentId, agent] of this.activeAgents) {
      if (agent.status !== 'active') continue;

      try {
        const violation = await rule.check(agent);
        
        if (violation) {
          await this.recordViolation(agent, rule, violation);
          await rule.action(agent, violation);
        }
      } catch (error) {
        console.error(`Oversight rule ${rule.id} failed for agent ${agentId}:`, error);
      }
    }
  }

  async checkResourceUsage(agent) {
    const role = agent.role;
    if (!role?.resourceLimits) return null;

    const violations = [];

    // Check memory usage
    if (role.resourceLimits.memory) {
      const limitMB = this.parseMemoryToMB(role.resourceLimits.memory);
      const usageMB = agent.resourceUsage.memory / (1024 * 1024);
      
      if (usageMB > limitMB) {
        violations.push({
          type: 'memory_exceeded',
          limit: limitMB,
          usage: usageMB,
          severity: 'high'
        });
      }
    }

    // Check CPU usage
    if (role.resourceLimits.cpu) {
      const limitCores = this.parseCPUCores(role.resourceLimits.cpu);
      const usageCores = agent.resourceUsage.cpu;
      
      if (usageCores > limitCores) {
        violations.push({
          type: 'cpu_exceeded',
          limit: limitCores,
          usage: usageCores,
          severity: 'high'
        });
      }
    }

    // Check network connections
    if (role.resourceLimits.networkConnections) {
      const limit = role.resourceLimits.networkConnections;
      const usage = agent.resourceUsage.networkConnections;
      
      if (usage > limit) {
        violations.push({
          type: 'network_exceeded',
          limit: limit,
          usage: usage,
          severity: 'medium'
        });
      }
    }

    return violations.length > 0 ? { violations } : null;
  }

  async checkPermissionCompliance(agent) {
    const role = agent.role;
    if (!role?.permissions) return null;

    // This would check actual agent activities against permitted actions
    // For demo, we'll simulate random compliance checks
    const compliance = Math.random() > 0.05; // 95% compliance rate

    if (!compliance) {
      return {
        type: 'unauthorized_action',
        action: 'attempted_privileged_operation',
        severity: 'critical'
      };
    }

    return null;
  }

  async checkAgentHealth(agent) {
    // Check if agent is responsive
    const timeSinceLastSeen = Date.now() - agent.lastSeen;
    
    if (timeSinceLastSeen > 60000) { // 1 minute
      return {
        type: 'unresponsive',
        lastSeen: agent.lastSeen,
        severity: 'high'
      };
    }

    // Check error rate
    if (agent.metrics.errorsEncountered > 10) {
      return {
        type: 'high_error_rate',
        errorCount: agent.metrics.errorsEncountered,
        severity: 'medium'
      };
    }

    return null;
  }

  async checkSecurityCompliance(agent) {
    const role = agent.role;
    if (!role?.complianceRequirements) return null;

    // Check each compliance requirement
    for (const requirement of role.complianceRequirements) {
      const compliant = await this.verifyComplianceRequirement(agent, requirement);
      
      if (!compliant) {
        return {
          type: 'compliance_violation',
          requirement: requirement,
          severity: 'critical'
        };
      }
    }

    return null;
  }

  async verifyComplianceRequirement(agent, requirement) {
    // Simulate compliance verification
    // In production, this would check actual compliance status
    return Math.random() > 0.02; // 98% compliance rate
  }

  async recordViolation(agent, rule, violation) {
    const violationRecord = {
      id: crypto.randomUUID(),
      agentId: agent.id,
      ruleId: rule.id,
      violation: violation,
      timestamp: Date.now(),
      severity: violation.severity || rule.severity,
      resolved: false
    };

    agent.violations.push(violationRecord);
    
    if (!this.violations.has(agent.id)) {
      this.violations.set(agent.id, []);
    }
    this.violations.get(agent.id).push(violationRecord);

    this.emit('violation:detected', violationRecord);
  }

  async handleResourceViolation(agent, violation) {
    console.log(`⚠️ Resource violation for agent ${agent.id}:`, violation);
    
    // Implement resource violation handling
    if (violation.violations.some(v => v.severity === 'high')) {
      // Suspend agent temporarily
      await this.suspendAgent(agent.id, 'resource_violation');
    }
  }

  async handlePermissionViolation(agent, violation) {
    console.log(`🚨 Permission violation for agent ${agent.id}:`, violation);
    
    // Immediate action for security violations
    await this.suspendAgent(agent.id, 'security_violation');
    
    // Notify security team
    this.emit('security:violation', {
      agentId: agent.id,
      violation: violation,
      severity: 'critical'
    });
  }

  async handleHealthViolation(agent, violation) {
    console.log(`💊 Health violation for agent ${agent.id}:`, violation);
    
    if (violation.type === 'unresponsive') {
      // Attempt to restart agent
      await this.restartAgent(agent.id);
    }
  }

  async handleSecurityViolation(agent, violation) {
    console.log(`🔒 Security compliance violation for agent ${agent.id}:`, violation);
    
    // Suspend until compliance is restored
    await this.suspendAgent(agent.id, 'compliance_violation');
  }

  async suspendAgent(agentId, reason) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return false;

    agent.status = 'suspended';
    agent.suspendedAt = Date.now();
    agent.suspensionReason = reason;

    // Notify the agent instance to stop operations
    if (agent.instance && typeof agent.instance.suspend === 'function') {
      await agent.instance.suspend();
    }

    this.emit('agent:suspended', { agentId, reason });
    
    return true;
  }

  async restartAgent(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return false;

    // Notify the agent instance to restart
    if (agent.instance && typeof agent.instance.restart === 'function') {
      await agent.instance.restart();
    }

    agent.lastSeen = Date.now();
    agent.status = 'active';

    this.emit('agent:restarted', { agentId });
    
    return true;
  }

  getOversightReport() {
    const report = {
      timestamp: Date.now(),
      activeAgents: this.activeAgents.size,
      totalViolations: Array.from(this.violations.values()).flat().length,
      ruleStatistics: {},
      agentStatistics: {},
      recentViolations: []
    };

    // Rule statistics
    for (const [ruleId, rule] of this.oversightRules) {
      report.ruleStatistics[ruleId] = {
        violations: rule.violations,
        lastCheck: rule.lastCheck,
        description: rule.description
      };
    }

    // Agent statistics
    for (const [agentId, agent] of this.activeAgents) {
      report.agentStatistics[agentId] = {
        roleId: agent.roleId,
        status: agent.status,
        violations: agent.violations.length,
        uptime: Date.now() - agent.registeredAt,
        lastSeen: agent.lastSeen
      };
    }

    // Recent violations (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const violations of this.violations.values()) {
      report.recentViolations.push(
        ...violations.filter(v => v.timestamp > oneDayAgo)
      );
    }

    report.recentViolations.sort((a, b) => b.timestamp - a.timestamp);
    report.recentViolations = report.recentViolations.slice(0, 20); // Last 20

    return report;
  }

  parseMemoryToMB(memoryStr) {
    const match = memoryStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'GB': return value * 1024;
      case 'MB': return value;
      case 'KB': return value / 1024;
      default: return 0;
    }
  }

  parseCPUCores(cpuStr) {
    const match = cpuStr.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }
}

// ===== MAIN GOVERNANCE SYSTEM =====
class AgentGovernanceSystem extends EventEmitter {
  constructor(decisionSystem) {
    super();
    this.roleRegistry = new AgentRoleRegistry();
    this.proposalSystem = new AgentProposalSystem(this.roleRegistry, decisionSystem);
    this.oversightSystem = new AgentOversightSystem(this.roleRegistry);
    
    this.setupEventHandlers();
    console.log('✅ Agent Governance System initialized');
  }

  setupEventHandlers() {
    // Proposal system events
    this.proposalSystem.on('proposal:approved', (proposal) => {
      console.log(`✅ Proposal approved: ${proposal.title}`);
      this.implementApprovedProposal(proposal);
    });

    this.proposalSystem.on('proposal:rejected', (proposal) => {
      console.log(`❌ Proposal rejected: ${proposal.title}`);
    });

    // Oversight system events
    this.oversightSystem.on('violation:detected', (violation) => {
      console.log(`⚠️ Oversight violation: ${violation.ruleId} for agent ${violation.agentId}`);
    });

    this.oversightSystem.on('agent:suspended', (data) => {
      console.log(`🚫 Agent suspended: ${data.agentId} (${data.reason})`);
    });
  }

  async implementApprovedProposal(proposal) {
    try {
      if (proposal.type === 'new_role') {
        // Register the new role
        const roleId = this.roleRegistry.registerRole(proposal.roleDefinition);
        
        console.log(`✅ New role implemented: ${roleId}`);
        
        this.emit('role:implemented', {
          roleId,
          proposalId: proposal.id
        });
      }
      
      // Update proposal status
      proposal.state = 'implemented';
      proposal.implementedAt = Date.now();
      
    } catch (error) {
      console.error(`Failed to implement proposal ${proposal.id}:`, error);
      
      proposal.state = 'implementation_failed';
      proposal.implementationError = error.message;
    }
  }

  // Public API methods
  async proposeNewRole(roleDefinition, proposalData) {
    return await this.proposalSystem.createProposal({
      type: 'new_role',
      roleDefinition,
      ...proposalData
    });
  }

  async proposeRoleModification(roleId, modifications, proposalData) {
    const existingRole = this.roleRegistry.getRole(roleId);
    if (!existingRole) {
      throw new Error(`Role ${roleId} not found`);
    }

    const modifiedRole = { ...existingRole, ...modifications };

    return await this.proposalSystem.createProposal({
      type: 'modify_role',
      roleDefinition: modifiedRole,
      originalRoleId: roleId,
      ...proposalData
    });
  }

  async proposeRoleRetirement(roleId, proposalData) {
    const existingRole = this.roleRegistry.getRole(roleId);
    if (!existingRole) {
      throw new Error(`Role ${roleId} not found`);
    }

    return await this.proposalSystem.createProposal({
      type: 'retire_role',
      targetRoleId: roleId,
      ...proposalData
    });
  }

  async submitProposal(proposalId) {
    return await this.proposalSystem.submitProposal(proposalId);
  }

  async reviewProposal(proposalId, reviewerId, review) {
    return await this.proposalSystem.submitReview(proposalId, reviewerId, review);
  }

  registerAgent(agentInstance) {
    return this.oversightSystem.registerAgent(agentInstance);
  }

  deregisterAgent(agentId) {
    return this.oversightSystem.deregisterAgent(agentId);
  }

  getGovernanceReport() {
    return {
      timestamp: Date.now(),
      roles: {
        total: this.roleRegistry.getAllRoles().length,
        byCategory: this.getRolesByCategory(),
        active: this.roleRegistry.getAllRoles().filter(r => r.status === 'active').length
      },
      proposals: {
        total: this.proposalSystem.getAllProposals().length,
        byState: this.getProposalsByState(),
        pending: this.proposalSystem.getProposalsByState('under_review').length
      },
      oversight: this.oversightSystem.getOversightReport()
    };
  }

  getRolesByCategory() {
    const categories = {};
    for (const role of this.roleRegistry.getAllRoles()) {
      categories[role.category] = (categories[role.category] || 0) + 1;
    }
    return categories;
  }

  getProposalsByState() {
    const states = {};
    for (const proposal of this.proposalSystem.getAllProposals()) {
      states[proposal.state] = (states[proposal.state] || 0) + 1;
    }
    return states;
  }
}

// ===== EXPORTS =====
module.exports = {
  AgentGovernanceSystem,
  AgentRoleRegistry,
  AgentProposalSystem,
  AgentOversightSystem
};

// Example usage
if (require.main === module) {
  // Import decision system if available
  let decisionSystem;
  try {
    const { HierarchicalDecisionSystem } = require('./enhanced-swarm-orchestrator');
    decisionSystem = new HierarchicalDecisionSystem();
  } catch (error) {
    console.log('Running without hierarchical decision system');
    // Mock decision system
    decisionSystem = {
      makeDecision: async (context, criticality) => ({
        finalDecision: criticality > 0.8 ? 'approve' : 'approve', // Mock approval
        confidence: 0.9
      })
    };
  }

  async function demonstrateGovernance() {
    console.log('\n🏛️ Agent Governance System Demonstration\n');
    
    const governance = new AgentGovernanceSystem(decisionSystem);
    
    // 1. Propose a new agent role
    console.log('1️⃣ Proposing new agent role...\n');
    
    const proposalId = await governance.proposeNewRole({
      id: 'data-analyst',
      name: 'Data Analysis Agent',
      category: 'analytics',
      description: 'Performs complex data analysis and generates insights',
      capabilities: ['data_processing', 'statistical_analysis', 'visualization', 'reporting'],
      permissions: ['read_data', 'write_reports', 'access_analytics_tools'],
      resourceLimits: {
        memory: '2GB',
        cpu: '3 cores',
        networkConnections: 75
      },
      securityLevel: 'medium',
      complianceRequirements: ['data_privacy', 'audit_logging'],
      approvalLevel: 'tactical'
    }, {
      title: 'Add Data Analysis Agent',
      description: 'New agent type for advanced data analytics capabilities',
      justification: 'Need specialized agent for growing analytics workload',
      proposedBy: 'analytics-team',
      priority: 'normal',
      expectedBenefits: [
        'Improved data processing efficiency',
        'Automated report generation',
        'Better insights from data'
      ],
      resourceRequirements: {
        memory: '2GB',
        cpu: '3 cores'
      }
    });
    
    console.log(`✅ Proposal created: ${proposalId}`);
    
    // 2. Submit proposal for review
    await governance.submitProposal(proposalId);
    console.log('📋 Proposal submitted for review');
    
    // 3. Submit reviews
    await governance.reviewProposal(proposalId, 'architecture-team', {
      decision: 'approve',
      comments: 'Architecture looks solid, good resource allocation',
      recommendations: ['Consider adding caching capabilities']
    });
    
    await governance.reviewProposal(proposalId, 'security-team', {
      decision: 'approve',
      comments: 'Security requirements are appropriate',
      concerns: ['Monitor data access patterns']
    });
    
    console.log('✅ Reviews submitted');
    
    // Wait for decision processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Register a mock agent for oversight
    console.log('\n2️⃣ Registering agent for oversight...\n');
    
    const mockAgent = {
      id: 'agent-test-001',
      roleId: 'developer',
      suspend: async () => console.log('Agent suspended'),
      restart: async () => console.log('Agent restarted')
    };
    
    const agentId = governance.registerAgent(mockAgent);
    console.log(`✅ Agent registered: ${agentId}`);
    
    // 5. Simulate resource usage update
    const oversightAgent = governance.oversightSystem.activeAgents.get(agentId);
    if (oversightAgent) {
      oversightAgent.resourceUsage = {
        memory: 3 * 1024 * 1024 * 1024, // 3GB (exceeds 2GB limit)
        cpu: 2.5,
        networkConnections: 50
      };
      oversightAgent.lastSeen = Date.now();
    }
    
    // Wait for oversight checks
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 6. Generate governance report
    console.log('\n📊 Governance Report:');
    const report = governance.getGovernanceReport();
    console.log(JSON.stringify(report, null, 2));
    
    // Cleanup
    governance.deregisterAgent(agentId);
  }
  
  demonstrateGovernance().catch(console.error);
}