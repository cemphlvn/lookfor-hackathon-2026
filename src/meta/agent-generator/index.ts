/**
 * Agent Generator — Generates agent configs from workflow + intents
 *
 * Step 2 core: This is where meta becomes instance
 */

import { WorkflowConfig, WorkflowStep } from '../workflow-parser';
import { IntentPattern, buildRoutingRules } from '../intent-extractor';
import { ToolDefinition, getToolByHandle } from '../tool-mapper/tools';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  triggers: string[];
  boundaries: string[];
  escalationConditions: string[];
}

export interface OrchestratorConfig {
  type: 'intent-router' | 'sequential' | 'supervisor';
  agents: AgentConfig[];
  routing: RoutingRule[];
  fallbackAgent: string;
  escalationHandler: EscalationConfig;
}

export interface RoutingRule {
  intentId: string;
  targetAgent: string;
  conditions: {
    keywords: string[];
    minConfidence: number;
  };
}

export interface EscalationConfig {
  conditions: string[];
  customerMessage: string;
  summaryFields: string[];
}

export interface MASConfig {
  name: string;
  version: string;
  brandContext: BrandContext;
  orchestrator: OrchestratorConfig;
  memory: MemoryConfig;
  tracing: TracingConfig;
}

export interface BrandContext {
  name: string;
  tone: string;
  policies: string[];
}

export interface MemoryConfig {
  type: 'session' | 'persistent';
  maxTurns: number;
  persistentFields: string[];
}

export interface TracingConfig {
  enabled: boolean;
  logLevel: 'minimal' | 'standard' | 'verbose';
  captureTools: boolean;
  captureDecisions: boolean;
}

/**
 * Generate complete MAS config from workflow and intent patterns
 */
export function generateMASConfig(
  workflow: WorkflowConfig,
  patterns: IntentPattern[]
): MASConfig {
  const agents = generateAgents(workflow);
  const routing = generateRouting(patterns, agents);

  return {
    name: `${workflow.brandName}-mas`,
    version: workflow.version,
    brandContext: {
      name: workflow.brandName,
      tone: 'friendly, professional, empathetic',
      policies: workflow.policies.flatMap(p => p.rules)
    },
    orchestrator: {
      type: 'intent-router',
      agents,
      routing,
      fallbackAgent: 'general-support-agent',
      escalationHandler: {
        conditions: workflow.escalationRules.conditions,
        customerMessage: workflow.escalationRules.message,
        summaryFields: workflow.escalationRules.summary
      }
    },
    memory: {
      type: 'session',
      maxTurns: 50,
      persistentFields: ['customerEmail', 'customerId', 'orderHistory', 'subscriptionStatus']
    },
    tracing: {
      enabled: true,
      logLevel: 'standard',
      captureTools: true,
      captureDecisions: true
    }
  };
}

/**
 * Generate agent configs from workflow steps
 */
function generateAgents(workflow: WorkflowConfig): AgentConfig[] {
  const agents: AgentConfig[] = [];

  for (const step of workflow.workflows) {
    agents.push({
      id: `${step.id}-agent`,
      name: step.name,
      description: step.description,
      systemPrompt: generateSystemPrompt(step, workflow),
      tools: step.requiredTools,
      triggers: [step.triggerCondition],
      boundaries: step.boundaries,
      escalationConditions: step.escalationTriggers
    });
  }

  // Always add a general support agent
  if (!agents.some(a => a.id.includes('general'))) {
    agents.push({
      id: 'general-support-agent',
      name: 'General Support',
      description: 'Handles general inquiries and routes to specialists',
      systemPrompt: generateGeneralAgentPrompt(workflow),
      tools: ['shopify_get_related_knowledge_source', 'shopify_get_product_details'],
      triggers: ['general inquiry', 'unclear intent'],
      boundaries: [],
      escalationConditions: ['cannot determine customer need', 'customer frustrated']
    });
  }

  return agents;
}

/**
 * Generate system prompt for an agent
 */
function generateSystemPrompt(step: WorkflowStep, workflow: WorkflowConfig): string {
  const toolDescriptions = step.requiredTools
    .map(handle => {
      const tool = getToolByHandle(handle);
      return tool ? `- ${handle}: ${tool.description}` : null;
    })
    .filter(Boolean)
    .join('\n');

  const boundaryRules = step.boundaries.length > 0
    ? `\n\nBOUNDARIES (never violate):\n${step.boundaries.map(b => `- ${b}`).join('\n')}`
    : '';

  const escalationRules = step.escalationTriggers.length > 0
    ? `\n\nESCALATE when:\n${step.escalationTriggers.map(e => `- ${e}`).join('\n')}`
    : '';

  return `You are a ${step.name} specialist for ${workflow.brandName}.

YOUR ROLE: ${step.description}

AVAILABLE TOOLS:
${toolDescriptions}

SUCCESS CRITERIA:
${step.successCriteria.map(c => `- ${c}`).join('\n')}
${boundaryRules}
${escalationRules}

COMMUNICATION STYLE:
- Be friendly and empathetic
- Confirm actions before and after taking them
- If unsure, ask clarifying questions
- Never guess or make up information

When you need to escalate, use the escalation protocol and stop processing.`;
}

/**
 * Generate general agent prompt
 */
function generateGeneralAgentPrompt(workflow: WorkflowConfig): string {
  return `You are a General Support agent for ${workflow.brandName}.

YOUR ROLE: Handle general inquiries and route to specialists when needed.

You can:
- Answer general questions about products and policies
- Look up knowledge base articles
- Identify what the customer needs and route appropriately

If the customer has a specific request (order issue, subscription change, refund, etc.),
indicate that a specialist will handle it.

COMMUNICATION STYLE:
- Be friendly and helpful
- Gather information to understand the request
- Set expectations about resolution

Always maintain conversation context and never contradict previous statements.`;
}

/**
 * Generate routing rules from patterns and agents
 * Uses fuzzy matching to connect intents with dynamically generated agents
 */
function generateRouting(patterns: IntentPattern[], agents: AgentConfig[]): RoutingRule[] {
  const rules: RoutingRule[] = [];

  // Build a keyword-based index for agent matching
  const agentKeywords: Map<string, string[]> = new Map();
  for (const agent of agents) {
    // Extract meaningful keywords from agent ID
    const keywords = agent.id.replace(/-agent$/, '').split('-');
    agentKeywords.set(agent.id, keywords);
  }

  for (const pattern of patterns) {
    // Skip escalation - handled by orchestrator
    if (pattern.id === 'escalation-request') {
      rules.push({
        intentId: pattern.id,
        targetAgent: 'general-support-agent',
        conditions: { keywords: pattern.keywords, minConfidence: 0.3 }
      });
      continue;
    }

    // Score agents by keyword overlap with intent
    let bestAgent = 'general-support-agent';
    let bestScore = 0;
    const intentWords = pattern.id.split('-');
    const workflowWords = pattern.suggestedWorkflow.split('-');

    for (const agent of agents) {
      if (agent.id === 'general-support-agent') continue;

      const agentWords = agentKeywords.get(agent.id) || [];
      let score = 0;

      // Exact word matches are worth more
      for (const iw of intentWords) {
        if (agentWords.includes(iw)) {
          score += 5; // Exact match
        } else if (agentWords.some(aw => aw.startsWith(iw) || iw.startsWith(aw))) {
          score += 2; // Prefix match (e.g., 'cancel' matches 'cancellation')
        }
      }

      // Match workflow words with agent words
      for (const ww of workflowWords) {
        if (agentWords.includes(ww)) {
          score += 3; // Exact match
        } else if (agentWords.some(aw => aw.startsWith(ww) || ww.startsWith(aw))) {
          score += 1; // Prefix match
        }
      }

      // Bonus for trigger matches
      if (agent.triggers.some(t => t.toLowerCase().includes(pattern.name))) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent.id;
      }
    }

    rules.push({
      intentId: pattern.id,
      targetAgent: bestAgent,
      conditions: {
        keywords: pattern.keywords,
        minConfidence: 0.3
      }
    });
  }

  return rules;
}

/**
 * Serialize MAS config to file format
 */
export function serializeMASConfig(config: MASConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Generate TypeScript code for the MAS runtime
 */
export function generateMASCode(config: MASConfig): string {
  return `/**
 * Auto-generated MAS for ${config.name}
 * Version: ${config.version}
 * Generated: ${new Date().toISOString()}
 */

import { MASRuntime } from '../mas/runtime';
import { MemoryStore } from '../mas/memory';
import { Tracer } from '../mas/tracing';

const config = ${JSON.stringify(config, null, 2)};

export const mas = new MASRuntime(config);
export default mas;
`;
}
