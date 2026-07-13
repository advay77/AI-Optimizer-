import { IntentAnalyzer } from "./intent-analyzer";
import { DecisionFrameworkEvaluator } from "./decision-framework";
import { ExecutionPlanner } from "./execution-planner";
import { createMemoryService, MemoryService } from "./memory-service";
import { EngineeringAgent } from "@/lib/agents/engineering-agent";
import { ResearchAgent } from "@/lib/agents/research-agent";
import { MarketingAgent } from "@/lib/agents/marketing-agent";
import { ArtifactValidator } from "./artifact-validator";
import { ResponseBuilder } from "./response-builder";
import { createDashboardService, DashboardService } from "./dashboard-service";
import type {
  OrchestratorResponse,
  ExecutionMetrics,
} from "@/types";

/**
 * Main Orchestrator: Executes the 10-step Decision Framework
 * 
 * STEPS 1-10:
 * 1-2: Intent Analyzer (understand + classify)
 * 3-5: Decision Framework (capabilities + agent selection + skills)
 * 6-7: Execution Planner (strategy + model routing)
 * 8: MemoryService (shared state)
 * 9: Artifact Validator (validate files)
 * 10: Response Builder (final response)
 */

export class Orchestrator {
  private memory: MemoryService;
  private dashboard: DashboardService;
  private executionId: string;

  constructor() {
    this.executionId = this.generateExecutionId();
    this.memory = createMemoryService(this.executionId);
    this.dashboard = createDashboardService(this.executionId);

    console.log(
      `[v0] Orchestrator initialized with execution ID: ${this.executionId}`
    );
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get execution ID
   */
  getExecutionId(): string {
    return this.executionId;
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribeDashboard(callback: (update: any) => void): () => void {
    return this.dashboard.subscribe(callback);
  }

  /**
   * Main orchestration flow
   */
  async orchestrate(userPrompt: string): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    const agentsStartTimes: Record<string, number> = {};
    const agentsEndTimes: Record<string, number> = {};

    try {
      console.log(`[v0] ============ ORCHESTRATION START ============`);
      console.log(`[v0] User prompt: "${userPrompt.substring(0, 100)}..."`);

      // STEP 1-2: Intent Analysis
      console.log(`[v0] --- STEP 1-2: Intent Analysis ---`);
      const intentAnalyzer = new IntentAnalyzer();
      const intentAnalysis = await intentAnalyzer.analyze(userPrompt);
      this.memory.write("intent", intentAnalysis);

      // STEP 3-5: Decision Framework
      console.log(`[v0] --- STEP 3-5: Decision Framework ---`);
      const framework = new DecisionFrameworkEvaluator();
      const decision = framework.evaluate(intentAnalysis, userPrompt);
      this.memory.write("planning", decision);

      // STEP 6-7: Execution Planning
      console.log(`[v0] --- STEP 6-7: Execution Planning ---`);
      const planner = new ExecutionPlanner();
      const executionPlan = planner.plan(decision);

      // STEP 8: Execute agents (with memory coordination)
      console.log(`[v0] --- STEP 8: Agent Execution ---`);
      const agentsToExecute = this.determineAgentsToExecute(
        decision.selectedAgents
      );

      if (decision.executionStrategy === "parallel") {
        console.log(`[v0] Executing agents in PARALLEL`);
        await this.executeAgentsParallel(
          agentsToExecute,
          decision,
          agentsStartTimes,
          agentsEndTimes
        );
      } else {
        console.log(`[v0] Executing agents SEQUENTIALLY`);
        await this.executeAgentsSequential(
          agentsToExecute,
          decision,
          agentsStartTimes,
          agentsEndTimes
        );
      }

      // STEP 9: Artifact Validation
      console.log(`[v0] --- STEP 9: Artifact Validation ---`);
      const validator = new ArtifactValidator();
      const artifactManifest = validator.validateArtifacts(
        this.memory.getAll()
      );
      this.memory.write("artifacts", artifactManifest);

      // Calculate metrics
      const endTime = Date.now();
      const totalLatency = endTime - startTime;
      const totalTokensUsed = this.estimateTotalTokens();
      const totalCost = this.calculateTotalCost(decision);
      const agentsExecuted = agentsToExecute.map((a) => a.name);

      const metrics: ExecutionMetrics = {
        startTime,
        endTime,
        totalLatency,
        agentsExecuted,
        skillsExecuted: this.extractSkillsUsed(decision),
        totalTokensUsed,
        totalCost,
        confidenceScore: decision.confidence,
        successRate: 1.0, // All agents executed
      };

      this.memory.write("metrics", metrics);

      // Record execution complete on dashboard
      this.dashboard.recordExecutionComplete(
        totalLatency,
        totalTokensUsed,
        totalCost,
        agentsExecuted
      );

      // STEP 10: Build Final Response
      console.log(`[v0] --- STEP 10: Final Response ---`);
      const builder = new ResponseBuilder();
      const response = builder.buildResponse(
        this.memory.getAll(),
        artifactManifest.files,
        metrics
      );

      console.log(`[v0] ============ ORCHESTRATION COMPLETE ============`);
      console.log(`[v0] Total execution time: ${totalLatency}ms`);
      console.log(`[v0] Agents executed: ${agentsExecuted.join(", ")}`);
      console.log(`[v0] Total cost: $${totalCost.toFixed(6)}`);
      console.log(`[v0] Confidence: ${metrics.confidenceScore}%`);

      return response;
    } catch (error) {
      console.error(`[v0] Orchestration error:`, error);
      this.dashboard.recordExecutionComplete(
        Date.now() - startTime,
        0,
        0,
        []
      );
      throw error;
    }
  }

  /**
   * Determine which agents need to execute
   */
  private determineAgentsToExecute(
    selectedAgents: any
  ): Array<{ name: string; type: string }> {
    const agents = [];

    if (selectedAgents.research) {
      agents.push({ name: "Research", type: "research" });
    }
    if (selectedAgents.engineering) {
      agents.push({ name: "Engineering", type: "engineering" });
    }
    if (selectedAgents.marketing) {
      agents.push({ name: "Marketing", type: "marketing" });
    }

    return agents;
  }

  /**
   * Execute agents in parallel
   */
  private async executeAgentsParallel(
    agents: Array<{ name: string; type: string }>,
    decision: any,
    startTimes: Record<string, number>,
    endTimes: Record<string, number>
  ): Promise<void> {
    const promises = agents.map(async (agent) => {
      startTimes[agent.name] = Date.now();
      this.dashboard.recordAgentStart(
        agent.name,
        decision.skillMatrix[agent.type.toLowerCase()]?.[0] || agent.type,
        "selected-model"
      );

      try {
        const agentInstance = this.createAgentInstance(
          agent.type,
          decision
        );
        await agentInstance.execute(`Assigned task for ${agent.name} agent`);

        endTimes[agent.name] = Date.now();
        const latency = endTimes[agent.name] - startTimes[agent.name];
        this.dashboard.recordAgentComplete(agent.name, latency, 0, 0);
      } catch (error) {
        endTimes[agent.name] = Date.now();
        this.dashboard.recordAgentError(
          agent.name,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    });

    await Promise.all(promises);
  }

  /**
   * Execute agents sequentially
   */
  private async executeAgentsSequential(
    agents: Array<{ name: string; type: string }>,
    decision: any,
    startTimes: Record<string, number>,
    endTimes: Record<string, number>
  ): Promise<void> {
    for (const agent of agents) {
      startTimes[agent.name] = Date.now();
      this.dashboard.recordAgentStart(
        agent.name,
        decision.skillMatrix[agent.type.toLowerCase()]?.[0] || agent.type,
        "selected-model"
      );

      try {
        const agentInstance = this.createAgentInstance(
          agent.type,
          decision
        );
        await agentInstance.execute(`Assigned task for ${agent.name} agent`);

        endTimes[agent.name] = Date.now();
        const latency = endTimes[agent.name] - startTimes[agent.name];
        this.dashboard.recordAgentComplete(agent.name, latency, 0, 0);
      } catch (error) {
        endTimes[agent.name] = Date.now();
        this.dashboard.recordAgentError(
          agent.name,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }
  }

  /**
   * Factory method to create agent instances
   */
  private createAgentInstance(type: string, decision: any): any {
    const skills =
      decision.skillMatrix[type.toLowerCase()] || [];

    switch (type) {
      case "research":
        return new ResearchAgent(skills, this.memory);
      case "engineering":
        return new EngineeringAgent(skills, this.memory);
      case "marketing":
        return new MarketingAgent(skills, this.memory);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  /**
   * Helper to estimate total tokens used
   */
  private estimateTotalTokens(): number {
    const metrics = this.memory.read("metrics");
    return metrics?.totalTokensUsed || 0;
  }

  /**
   * Helper to calculate total cost
   */
  private calculateTotalCost(decision: any): number {
    return decision.estimatedCost || 0;
  }

  /**
   * Helper to extract skills used
   */
  private extractSkillsUsed(decision: any): string[] {
    const skills = new Set<string>();

    Object.values(decision.skillMatrix).forEach((agentSkills: any) => {
      if (Array.isArray(agentSkills)) {
        agentSkills.forEach((s: string) => skills.add(s));
      }
    });

    return Array.from(skills);
  }
}
