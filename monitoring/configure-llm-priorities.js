#!/usr/bin/env node
// configure-llm-priorities.js - Configure TRITONS to prioritize cost-effective LLMs

const fs = require('fs').promises;
const path = require('path');

class LLMPriorityConfigurator {
    constructor() {
        // LLM cost and priority configuration
        this.llmConfig = {
            // Cost-effective providers (prioritize these)
            costEffective: {
                kimi: {
                    name: 'Kimi 2',
                    cost_per_1k_tokens: 0.0001,
                    priority: 1,
                    capabilities: ['reasoning', 'coding', 'analysis'],
                    max_agents_per_dept: 3
                },
                deepseek: {
                    name: 'DeepSeek Coder',
                    cost_per_1k_tokens: 0.0002,
                    priority: 2,
                    capabilities: ['coding', 'debugging', 'architecture'],
                    max_agents_per_dept: 2
                },
                groq: {
                    name: 'Groq',
                    cost_per_1k_tokens: 0.0003,
                    priority: 3,
                    capabilities: ['fast_inference', 'qa', 'testing'],
                    max_agents_per_dept: 2
                },
                gemini: {
                    name: 'Gemini Pro',
                    cost_per_1k_tokens: 0.0005,
                    priority: 4,
                    capabilities: ['multimodal', 'data_analysis', 'reasoning'],
                    max_agents_per_dept: 2
                },
                openrouter: {
                    name: 'OpenRouter',
                    cost_per_1k_tokens: 0.0008,
                    priority: 5,
                    capabilities: ['diverse_models', 'specialized_tasks'],
                    max_agents_per_dept: 1
                }
            },
            // Premium providers (use sparingly)
            premium: {
                claude: {
                    name: 'Claude',
                    cost_per_1k_tokens: 0.015,
                    priority: 10,
                    capabilities: ['complex_reasoning', 'writing', 'analysis'],
                    max_agents_per_dept: 1, // Limit Claude usage
                    use_cases: ['critical_tasks', 'complex_analysis']
                },
                gpt4: {
                    name: 'GPT-4',
                    cost_per_1k_tokens: 0.030,
                    priority: 11,
                    capabilities: ['reasoning', 'coding', 'creative'],
                    max_agents_per_dept: 1, // Limit GPT-4 usage
                    use_cases: ['final_review', 'complex_decisions']
                }
            }
        };

        this.departmentPriorities = {
            backend: {
                preferred: ['deepseek', 'kimi', 'groq'],
                fallback: ['claude', 'gpt4']
            },
            frontend: {
                preferred: ['kimi', 'gemini', 'deepseek'],
                fallback: ['claude', 'gpt4']
            },
            devops: {
                preferred: ['deepseek', 'kimi', 'groq'],
                fallback: ['claude']
            },
            ai_ml: {
                preferred: ['kimi', 'gemini', 'deepseek'],
                fallback: ['claude', 'gpt4']
            },
            qa: {
                preferred: ['groq', 'kimi', 'deepseek'],
                fallback: ['claude']
            },
            data: {
                preferred: ['gemini', 'kimi', 'deepseek'],
                fallback: ['claude']
            },
            security: {
                preferred: ['kimi', 'deepseek', 'groq'],
                fallback: ['claude']
            }
        };
    }

    // Generate TRITONS configuration update
    async generateTritonsConfig() {
        const config = {
            llm_priorities: {
                cost_optimization: true,
                prefer_cost_effective: true,
                premium_usage_limit: {
                    claude: { max_requests_per_hour: 20 },
                    gpt4: { max_requests_per_hour: 10 }
                }
            },
            department_llm_preferences: this.departmentPriorities,
            llm_routing_rules: {
                task_complexity: {
                    simple: ['kimi', 'deepseek', 'groq'],
                    medium: ['kimi', 'gemini', 'deepseek', 'claude'],
                    complex: ['claude', 'gpt4', 'kimi', 'gemini']
                },
                cost_mode: {
                    economy: ['kimi', 'deepseek', 'groq', 'gemini'],
                    balanced: ['kimi', 'deepseek', 'claude', 'gpt4'],
                    premium: ['claude', 'gpt4', 'kimi', 'gemini']
                }
            },
            current_mode: 'economy' // Default to cost-effective mode
        };

        return config;
    }

    // Submit configuration update to TRITONS
    async updateTritonsConfig() {
        console.log('🔧 Configuring TRITONS LLM Priorities');
        console.log('=====================================\n');

        const config = await this.generateTritonsConfig();

        // Submit task to update LLM priorities
        const updateTask = {
            id: 'UPDATE_LLM_PRIORITIES',
            title: 'Update LLM Priority Configuration',
            description: 'Reconfigure TRITONS to prioritize cost-effective LLMs over premium ones',
            type: 'configuration',
            department: 'ARCHITECTURE',
            priority: 'high',
            requirements: [
                'Prioritize Kimi 2, DeepSeek, and Groq over Claude/GPT-4',
                'Limit Claude usage to 20 requests/hour max',
                'Limit GPT-4 usage to 10 requests/hour max',
                'Update department LLM preferences',
                'Add cost-optimization routing rules'
            ],
            configuration: config,
            estimated_hours: 2
        };

        try {
            const response = await fetch('http://localhost:8080/api/tasks/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateTask)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ LLM priority update task submitted successfully');
                console.log(`   Task ID: ${result.taskId}`);
                console.log(`   Assigned to: ${result.routing?.department || 'TBD'}`);
            } else {
                console.error('❌ Failed to submit LLM priority update task');
            }
        } catch (err) {
            console.error('❌ Error submitting task:', err.message);
        }

        return config;
    }

    // Generate cost-effective agent spawn configuration
    async generateAgentSpawnConfig() {
        console.log('\n💰 Generating Cost-Effective Agent Configuration');
        console.log('===============================================');

        const spawnConfig = {};

        for (const [dept, prefs] of Object.entries(this.departmentPriorities)) {
            spawnConfig[dept] = {
                preferred_llms: prefs.preferred,
                fallback_llms: prefs.fallback,
                spawn_order: prefs.preferred.concat(prefs.fallback),
                cost_optimization: true
            };

            console.log(`📋 ${dept.toUpperCase()}: ${prefs.preferred.join(' → ')} (preferred)`);
        }

        // Save configuration to file
        await fs.writeFile(
            'llm-priority-config.json',
            JSON.stringify({ 
                llm_config: this.llmConfig,
                department_priorities: this.departmentPriorities,
                spawn_config: spawnConfig,
                generated_at: new Date().toISOString()
            }, null, 2)
        );

        console.log('\n💾 Configuration saved to: llm-priority-config.json');
        return spawnConfig;
    }

    // Submit individual agent spawn requests with cost-effective LLMs
    async spawnCostEffectiveAgents() {
        console.log('\n🤖 Spawning Cost-Effective Agents');
        console.log('=================================');

        const spawnRequests = [
            // Backend department - prioritize DeepSeek and Kimi
            { department: 'backend', llm: 'kimi', role: 'backend_lead_kimi' },
            { department: 'backend', llm: 'deepseek', role: 'api_specialist_deepseek' },
            
            // Frontend department - prioritize Kimi and Gemini
            { department: 'frontend', llm: 'kimi', role: 'frontend_lead_kimi' },
            { department: 'frontend', llm: 'gemini', role: 'ui_specialist_gemini' },
            
            // DevOps - prioritize DeepSeek and Kimi
            { department: 'devops', llm: 'deepseek', role: 'devops_lead_deepseek' },
            { department: 'devops', llm: 'kimi', role: 'infrastructure_kimi' },
            
            // AI/ML - prioritize Kimi and Gemini
            { department: 'ai_ml', llm: 'kimi', role: 'ml_engineer_kimi' },
            { department: 'ai_ml', llm: 'gemini', role: 'data_scientist_gemini' },
            
            // QA - prioritize Groq and Kimi
            { department: 'qa', llm: 'groq', role: 'qa_lead_groq' },
            { department: 'qa', llm: 'kimi', role: 'test_engineer_kimi' }
        ];

        for (const request of spawnRequests) {
            const spawnTask = {
                id: `SPAWN_${request.role.toUpperCase()}`,
                title: `Spawn ${request.role} with ${request.llm}`,
                description: `Create new ${request.department} agent using cost-effective ${request.llm} LLM`,
                type: 'agent_management',
                department: request.department.toUpperCase(),
                priority: 'medium',
                agent_config: {
                    llm: request.llm,
                    role: request.role,
                    cost_optimized: true
                }
            };

            try {
                const response = await fetch('http://localhost:8080/api/tasks/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(spawnTask)
                });

                if (response.ok) {
                    console.log(`✅ Queued spawn: ${request.role} (${request.llm})`);
                } else {
                    console.log(`⚠️  Failed to queue: ${request.role}`);
                }
            } catch (err) {
                console.log(`❌ Error spawning ${request.role}: ${err.message}`);
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Display cost analysis
    displayCostAnalysis() {
        console.log('\n💰 Cost Analysis');
        console.log('================');

        console.log('\n🏆 Most Cost-Effective LLMs:');
        const sortedCostEffective = Object.entries(this.llmConfig.costEffective)
            .sort(([,a], [,b]) => a.cost_per_1k_tokens - b.cost_per_1k_tokens);

        sortedCostEffective.forEach(([key, config], index) => {
            const savings = this.llmConfig.premium.claude.cost_per_1k_tokens - config.cost_per_1k_tokens;
            const savingsPercent = (savings / this.llmConfig.premium.claude.cost_per_1k_tokens * 100).toFixed(1);
            console.log(`   ${index + 1}. ${config.name}: $${config.cost_per_1k_tokens} (${savingsPercent}% cheaper than Claude)`);
        });

        console.log('\n💸 Premium LLMs (Use Sparingly):');
        Object.entries(this.llmConfig.premium).forEach(([key, config]) => {
            console.log(`   • ${config.name}: $${config.cost_per_1k_tokens} per 1K tokens`);
        });

        console.log('\n📊 Estimated Monthly Savings:');
        console.log('   • Using Kimi instead of Claude: ~95% cost reduction');
        console.log('   • Using DeepSeek instead of GPT-4: ~99% cost reduction');
        console.log('   • Blended approach: ~80-90% cost reduction');
    }

    // Run complete configuration update
    async run() {
        console.log('🚀 TRITONS LLM Priority Configurator');
        console.log('===================================\n');

        // Display cost analysis
        this.displayCostAnalysis();

        // Generate and save configuration
        await this.generateAgentSpawnConfig();

        // Update TRITONS configuration
        await this.updateTritonsConfig();

        // Spawn cost-effective agents
        await this.spawnCostEffectiveAgents();

        console.log('\n✅ TRITONS LLM priority configuration complete!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Monitor agent performance with new LLM priorities');
        console.log('   2. Update dashboard with LLM selection controls');
        console.log('   3. Review cost savings in next billing cycle');
    }
}

// Run configurator if executed directly
if (require.main === module) {
    const configurator = new LLMPriorityConfigurator();
    configurator.run().catch(console.error);
}

module.exports = LLMPriorityConfigurator;