import type {
  IntentAnalysis,
  CapabilityFlags,
  AgentSelection,
  SkillMatrix,
  DecisionFrameworkOutput,
  PrimaryTaskType,
} from "@/types";

/**
 * Decision Framework Evaluator: STEP 3-5 of Decision Framework
 * 
 * STEP 3 — Determine Required Capabilities:
 * - Analyze which capabilities are needed (boolean flags)
 * - frontend, backend, api, database, authentication, vision, pdf_analysis,
 *   research, documentation, marketing, artifact_generation
 *
 * STEP 4 — Select Agents:
 * - Activate ONLY the agents that are required
 * - Never activate all agents
 * - Engineering: if frontend/backend/api/db/testing needed
 * - R&D: if planning/vision/pdf/research/reasoning needed
 * - Marketing: if documentation/readme/seo/presentation needed
 *
 * STEP 5 — Select Skills:
 * - Each activated agent receives ONLY the skills it needs
 * - Never pass unused skills to agents
 * - Mark unused capabilities as FALSE
 */

export class DecisionFrameworkEvaluator {
  /**
   * Evaluate capabilities based on task type
   */
  private evaluateCapabilities(
    taskType: PrimaryTaskType,
    userPrompt: string
  ): CapabilityFlags {
    const flags: CapabilityFlags = {
      frontend: false,
      backend: false,
      api: false,
      database: false,
      authentication: false,
      vision: false,
      pdf_analysis: false,
      research: false,
      documentation: false,
      marketing: false,
      artifact_generation: false,
    };

    // Map task type to required capabilities
    switch (taskType) {
      case "static_html":
        flags.frontend = true;
        flags.artifact_generation = true;
        break;

      case "react_app":
        flags.frontend = true;
        flags.artifact_generation = true;
        break;

      case "fullstack_app":
        flags.frontend = true;
        flags.backend = true;
        flags.api = true;
        flags.database = true;
        flags.authentication = true;
        flags.artifact_generation = true;
        break;

      case "backend_api":
        flags.backend = true;
        flags.api = true;
        flags.database = true;
        flags.artifact_generation = true;
        break;

      case "dashboard":
        flags.frontend = true;
        flags.backend = true;
        flags.api = true;
        flags.database = true;
        flags.artifact_generation = true;
        break;

      case "research":
        flags.research = true;
        break;

      case "documentation":
        flags.documentation = true;
        flags.marketing = true;
        break;

      case "pdf_analysis":
        flags.pdf_analysis = true;
        flags.research = true;
        break;

      case "image_analysis":
        flags.vision = true;
        flags.research = true;
        break;

      case "technical_writing":
        flags.documentation = true;
        flags.marketing = true;
        break;

      case "marketing":
        flags.marketing = true;
        break;

      case "presentation":
        flags.documentation = true;
        flags.marketing = true;
        flags.artifact_generation = true;
        break;

      default:
        // Default: require all for unknown task type
        Object.keys(flags).forEach((key) => {
          flags[key as keyof CapabilityFlags] = true;
        });
    }

    // Parse prompt for additional capability hints
    const promptLower = userPrompt.toLowerCase();

    if (promptLower.includes("auth") || promptLower.includes("login")) {
      flags.authentication = true;
    }
    if (promptLower.includes("database") || promptLower.includes("data")) {
      flags.database = true;
    }
    if (
      promptLower.includes("api") ||
      promptLower.includes("endpoint") ||
      promptLower.includes("rest")
    ) {
      flags.api = true;
    }
    if (promptLower.includes("image") || promptLower.includes("vision")) {
      flags.vision = true;
    }
    if (promptLower.includes("pdf")) {
      flags.pdf_analysis = true;
    }

    return flags;
  }

  /**
   * STEP 4: Select agents based on capabilities
   * PRIMARY PRINCIPLE: Never activate all agents. Activate ONLY what's required.
   */
  private selectAgents(capabilities: CapabilityFlags): AgentSelection {
    const agents: AgentSelection = {
      engineering: false,
      research: false,
      marketing: false,
    };

    // Engineering: needed if any frontend/backend/api/db/testing
    if (
      capabilities.frontend ||
      capabilities.backend ||
      capabilities.api ||
      capabilities.database ||
      capabilities.authentication ||
      capabilities.artifact_generation
    ) {
      agents.engineering = true;
    }

    // R&D: needed if any research/vision/pdf/analysis
    if (
      capabilities.research ||
      capabilities.vision ||
      capabilities.pdf_analysis
    ) {
      agents.research = true;
    }

    // Marketing: needed if any documentation/marketing
    if (capabilities.documentation || capabilities.marketing) {
      agents.marketing = true;
    }

    return agents;
  }

  /**
   * STEP 5: Map skills per agent
   * Each agent gets ONLY the skills it needs
   */
  private mapSkills(
    capabilities: CapabilityFlags,
    agents: AgentSelection
  ): SkillMatrix {
    const skills: SkillMatrix = {
      engineering: [],
      research: [],
      marketing: [],
    };

    // Engineering skills
    if (agents.engineering) {
      if (capabilities.frontend) skills.engineering.push("frontend");
      if (capabilities.backend) skills.engineering.push("backend");
      if (capabilities.api) skills.engineering.push("api");
      if (capabilities.database) skills.engineering.push("database");
      if (capabilities.authentication) skills.engineering.push("authentication");
      if (capabilities.artifact_generation)
        skills.engineering.push("artifact_generation");
    }

    // R&D skills
    if (agents.research) {
      skills.research.push("planning");
      skills.research.push("reasoning");
      if (capabilities.research) skills.research.push("research");
      if (capabilities.vision) skills.research.push("vision");
      if (capabilities.pdf_analysis) skills.research.push("pdf_analysis");
    }

    // Marketing skills
    if (agents.marketing) {
      if (capabilities.documentation) skills.marketing.push("documentation");
      if (capabilities.marketing) skills.marketing.push("marketing");
      skills.marketing.push("presentation");
    }

    return skills;
  }

  /**
   * Determine execution strategy (parallel vs sequential)
   */
  private getExecutionStrategy(agents: AgentSelection): "parallel" | "sequential" | "mixed" {
    const activeAgentCount = [agents.engineering, agents.research, agents.marketing].filter(
      (v) => v
    ).length;

    if (activeAgentCount === 1) {
      return "sequential";
    }

    // If research and engineering are both needed, R&D goes first (dependency)
    if (agents.research && agents.engineering) {
      return "sequential";
    }

    // If marketing is alone with others, parallel
    if (agents.marketing && (agents.engineering || agents.research)) {
      return "mixed"; // Marketing can run in parallel, but prioritize others
    }

    return "parallel";
  }

  /**
   * Main evaluation function
   */
  evaluate(
    intentAnalysis: IntentAnalysis,
    userPrompt: string
  ): DecisionFrameworkOutput {
    console.log(`[v0] DecisionFrameworkEvaluator.evaluate() starting`);
    console.log(`[v0] Task type: ${intentAnalysis.taskType}`);

    // STEP 3: Evaluate capabilities
    const capabilities = this.evaluateCapabilities(
      intentAnalysis.taskType,
      userPrompt
    );

    console.log(`[v0] Capabilities:`, {
      frontend: capabilities.frontend,
      backend: capabilities.backend,
      api: capabilities.api,
      database: capabilities.database,
      research: capabilities.research,
      documentation: capabilities.documentation,
      marketing: capabilities.marketing,
    });

    // STEP 4: Select agents
    const selectedAgents = this.selectAgents(capabilities);

    console.log(`[v0] Selected agents:`, selectedAgents);

    // STEP 5: Map skills
    const skillMatrix = this.mapSkills(capabilities, selectedAgents);

    console.log(`[v0] Skill matrix:`, skillMatrix);

    // Determine execution strategy
    const executionStrategy = this.getExecutionStrategy(selectedAgents);

    // Estimate cost (rough)
    const estimatedCost = this.estimateCost(selectedAgents, skillMatrix);
    const estimatedTokens = this.estimateTokens(userPrompt, selectedAgents);
    const confidence = Math.min(
      100,
      (intentAnalysis.isComplete ? 90 : 70) +
        (selectedAgents.engineering ? 5 : 0) +
        (selectedAgents.research ? 5 : 0)
    );

    const result: DecisionFrameworkOutput = {
      intentAnalysis,
      capabilities,
      selectedAgents,
      skillMatrix,
      executionStrategy,
      estimatedCost,
      estimatedTokens,
      confidence,
    };

    console.log(`[v0] DecisionFrameworkEvaluator result:`, {
      selectedAgents,
      executionStrategy,
      confidence,
    });

    return result;
  }

  /**
   * Rough cost estimation
   */
  private estimateCost(
    agents: AgentSelection,
    _skillMatrix: SkillMatrix
  ): number {
    let cost = 0;

    if (agents.engineering) cost += 0.05;
    if (agents.research) cost += 0.03;
    if (agents.marketing) cost += 0.02;

    return cost;
  }

  /**
   * Rough token estimation
   */
  private estimateTokens(userPrompt: string, agents: AgentSelection): number {
    const baseTokens = Math.ceil(userPrompt.length / 4);
    const agentCount = [agents.engineering, agents.research, agents.marketing].filter(
      (v) => v
    ).length;

    // Each agent roughly doubles token usage
    return baseTokens * Math.pow(2, agentCount);
  }
}

/**
 * Convenience function
 */
export const evaluateDecisionFramework = (
  intentAnalysis: IntentAnalysis,
  userPrompt: string
): DecisionFrameworkOutput => {
  const evaluator = new DecisionFrameworkEvaluator();
  return evaluator.evaluate(intentAnalysis, userPrompt);
};
