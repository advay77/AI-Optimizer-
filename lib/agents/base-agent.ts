import { RouterAgent } from "@/lib/routerAgent";
import { OpenRouterService } from "@/lib/openrouter";
import type { MemoryService } from "@/lib/orchestration/memory-service";

/**
 * BaseAgent: Foundation for all specialized agents
 * 
 * Each agent:
 * - Has a specific role (Engineering, R&D, Marketing)
 * - Receives ONLY the skills it needs (from SkillMatrix)
 * - STEP 7: Never chooses models directly; asks router for best model
 * - Calls OpenRouter through existing integration
 * - Writes results to MemoryService (no direct agent communication)
 */

export abstract class BaseAgent {
  protected name: string;
  protected skills: string[];
  protected routerAgent: RouterAgent;
  protected openRouterService: OpenRouterService;
  protected memoryService: MemoryService;

  constructor(
    name: string,
    skills: string[],
    memoryService: MemoryService
  ) {
    this.name = name;
    this.skills = skills;
    this.memoryService = memoryService;
    this.routerAgent = new RouterAgent();
    this.openRouterService = new OpenRouterService();

    console.log(`[v0] ${name} Agent initialized with skills:`, skills);
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get assigned skills
   */
  getSkills(): string[] {
    return this.skills;
  }

  /**
   * STEP 7: Ask router for best model based on task
   * Never hardcode model selection
   */
  protected async selectModel(taskDescription: string): Promise<string> {
    console.log(`[v0] ${this.name} asking router for best model...`);
    
    const decision = await this.routerAgent.route(taskDescription);
    const selectedModel = decision.selectedModel;

    console.log(`[v0] ${this.name} selected model: ${selectedModel}`);
    console.log(`[v0] Model selected reason: ${decision.reason}`);

    return selectedModel;
  }

  /**
   * Template method pattern - must be implemented by subclasses
   */
  abstract execute(taskDescription: string): Promise<void>;

  /**
   * Helper to build context from memory for agent
   */
  protected getContextFromMemory(): string {
    const allMemory = this.memoryService.getAll();
    let context = "";

    if (allMemory.intent) {
      context += `\n--- Intent Analysis ---\n`;
      context += `Task: ${allMemory.intent.taskType}\n`;
      context += `Deliverable: ${allMemory.intent.primaryDeliverable}\n`;
    }

    if (allMemory.planning) {
      context += `\n--- Planning ---\n`;
      context += `Selected Agents: ${Object.entries(allMemory.planning.selectedAgents)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ")}\n`;
    }

    return context;
  }

  /**
   * Helper to write results to memory
   */
  protected writeToMemory<T extends Record<string, unknown>>(
    data: T
  ): void {
    const agentMemoryKey = this.name.toLowerCase().replace(" ", "_");
    this.memoryService.write(
      agentMemoryKey as any,
      data
    );
  }
}
