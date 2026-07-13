/**
 * Dashboard Service: Real-time execution tracking
 * 
 * Tracks during orchestration:
 * - Current agent executing
 * - Current capability/skill running
 * - Selected model + router reasoning
 * - Status per step
 * - Latency per step
 * - Tokens consumed
 * - Cost breakdown per agent
 * - Overall confidence score
 */

export interface DashboardUpdate {
  executionId: string;
  timestamp: number;
  currentAgent?: string;
  currentSkill?: string;
  selectedModel?: string;
  status: "pending" | "running" | "complete" | "error";
  progress: number; // 0-100
  stepMetrics?: {
    stepName: string;
    startTime: number;
    endTime?: number;
    latency?: number;
    tokensUsed?: number;
    cost?: number;
  };
  overallMetrics?: {
    totalTime: number;
    totalTokens: number;
    totalCost: number;
    agentsCompleted: string[];
  };
  error?: string;
}

export class DashboardService {
  private updates: DashboardUpdate[] = [];
  private callbacks: Set<(update: DashboardUpdate) => void> = new Set();
  private executionId: string;
  private startTime: number;

  constructor(executionId: string) {
    this.executionId = executionId;
    this.startTime = Date.now();
    console.log(`[v0] DashboardService initialized: ${executionId}`);
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribe(callback: (update: DashboardUpdate) => void): () => void {
    this.callbacks.add(callback);
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Record agent starting
   */
  recordAgentStart(agent: string, skill: string, model: string): void {
    const update: DashboardUpdate = {
      executionId: this.executionId,
      timestamp: Date.now(),
      currentAgent: agent,
      currentSkill: skill,
      selectedModel: model,
      status: "running",
      progress: this.calculateProgress([agent]),
    };

    this.recordUpdate(update);
  }

  /**
   * Record agent completion
   */
  recordAgentComplete(
    agent: string,
    latency: number,
    tokensUsed: number,
    cost: number
  ): void {
    const update: DashboardUpdate = {
      executionId: this.executionId,
      timestamp: Date.now(),
      currentAgent: agent,
      status: "complete",
      progress: this.calculateProgress([agent]),
      stepMetrics: {
        stepName: agent,
        startTime: this.startTime,
        endTime: Date.now(),
        latency,
        tokensUsed,
        cost,
      },
    };

    this.recordUpdate(update);
  }

  /**
   * Record agent error
   */
  recordAgentError(agent: string, error: string): void {
    const update: DashboardUpdate = {
      executionId: this.executionId,
      timestamp: Date.now(),
      currentAgent: agent,
      status: "error",
      progress: this.calculateProgress([agent]),
      error,
    };

    this.recordUpdate(update);
  }

  /**
   * Record execution complete
   */
  recordExecutionComplete(
    totalTime: number,
    totalTokens: number,
    totalCost: number,
    agentsCompleted: string[]
  ): void {
    const update: DashboardUpdate = {
      executionId: this.executionId,
      timestamp: Date.now(),
      status: "complete",
      progress: 100,
      overallMetrics: {
        totalTime,
        totalTokens,
        totalCost,
        agentsCompleted,
      },
    };

    this.recordUpdate(update);
  }

  /**
   * Record a dashboard update and emit to subscribers
   */
  private recordUpdate(update: DashboardUpdate): void {
    this.updates.push(update);
    console.log(
      `[v0] Dashboard update:`,
      update.currentAgent,
      update.status,
      update.progress + "%"
    );

    // Emit to all subscribers
    this.callbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error(`[v0] Dashboard callback error:`, error);
      }
    });
  }

  /**
   * Get all updates
   */
  getUpdates(): DashboardUpdate[] {
    return [...this.updates];
  }

  /**
   * Get latest update
   */
  getLatestUpdate(): DashboardUpdate | undefined {
    return this.updates[this.updates.length - 1];
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(completedAgents: string[]): number {
    // Simple progress: each agent is roughly 30% if all three are needed
    const agentProgress: Record<string, number> = {
      research: 30,
      engineering: 60,
      marketing: 90,
    };

    let progress = 0;
    completedAgents.forEach((agent) => {
      progress = Math.max(progress, agentProgress[agent.toLowerCase()] || 0);
    });

    return Math.min(99, progress); // Never reach 100 until complete
  }

  /**
   * Clear updates (for cleanup)
   */
  clear(): void {
    this.updates = [];
    console.log(`[v0] DashboardService cleared`);
  }
}

/**
 * Convenience function
 */
export const createDashboardService = (executionId: string): DashboardService => {
  return new DashboardService(executionId);
};
