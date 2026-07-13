import type {
  DecisionFrameworkOutput,
  ExecutionPlan,
  ExecutionTask,
  AgentSelection,
  SkillMatrix,
} from "@/types";

/**
 * Execution Planner: STEP 6-7 of Decision Framework
 * 
 * STEP 6 — Execution Strategy:
 * - Determine whether tasks can execute in parallel
 * - Independent tasks → Promise.all() (parallel)
 * - Dependent tasks → Sequential execution
 * - Never serialize independent work
 *
 * STEP 7 — Model Routing:
 * - Do NOT choose models directly
 * - Each agent asks Orion Router
 * - Router decides using: capability match, quality, context window, cost, latency, availability
 * - Never hardcode model selection
 * (Actual model selection happens inside agents, not here)
 */

export class ExecutionPlanner {
  /**
   * Create execution tasks from agent selection and skills
   */
  private createTasks(
    agents: AgentSelection,
    skillMatrix: SkillMatrix
  ): ExecutionTask[] {
    const tasks: ExecutionTask[] = [];

    // Add research task if research agent is active
    if (agents.research && skillMatrix.research.length > 0) {
      tasks.push({
        agentId: "research",
        skill: skillMatrix.research[0] || "research",
        priority: "high",
        dependsOn: [],
        isParallelizable: true,
      });
    }

    // Add engineering task if engineering agent is active
    // Engineering depends on research if both are active (R&D does planning first)
    if (agents.engineering && skillMatrix.engineering.length > 0) {
      tasks.push({
        agentId: "engineering",
        skill: skillMatrix.engineering[0] || "frontend",
        priority: "critical",
        dependsOn: agents.research ? ["research"] : [],
        isParallelizable: !agents.research, // Only parallel if no R&D dependency
      });
    }

    // Add marketing task if marketing agent is active
    // Marketing is usually independent and can run in parallel
    if (agents.marketing && skillMatrix.marketing.length > 0) {
      tasks.push({
        agentId: "marketing",
        skill: skillMatrix.marketing[0] || "documentation",
        priority: "normal",
        dependsOn: [],
        isParallelizable: true,
      });
    }

    return tasks;
  }

  /**
   * Group tasks for parallel execution
   * Tasks are parallelizable if they have no dependencies
   */
  private groupParallelTasks(
    tasks: ExecutionTask[]
  ): { parallelGroups: ExecutionTask[][]; sequential: ExecutionTask[] } {
    const parallelGroups: ExecutionTask[][] = [];
    const sequential: ExecutionTask[] = [];

    // First pass: collect all tasks that can run in parallel (no dependencies)
    const parallelTasks = tasks.filter(
      (t) => t.isParallelizable && t.dependsOn.length === 0
    );

    if (parallelTasks.length > 0) {
      parallelGroups.push(parallelTasks);
    }

    // Second pass: collect tasks with dependencies
    const dependentTasks = tasks.filter((t) => t.dependsOn.length > 0);
    dependentTasks.forEach((t) => {
      sequential.push(t);
    });

    return { parallelGroups, sequential };
  }

  /**
   * Build sequential order based on dependencies
   */
  private buildSequentialOrder(tasks: ExecutionTask[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected: ${taskId}`);
      }

      visiting.add(taskId);

      const task = tasks.find((t) => t.agentId === taskId);
      if (task) {
        task.dependsOn.forEach((dep) => visit(dep));
      }

      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    tasks.forEach((t) => visit(t.agentId));
    return order;
  }

  /**
   * Main planning function
   */
  plan(framework: DecisionFrameworkOutput): ExecutionPlan {
    console.log(`[v0] ExecutionPlanner.plan() starting`);

    // Create tasks from agent selection
    const tasks = this.createTasks(
      framework.selectedAgents,
      framework.skillMatrix
    );

    console.log(`[v0] Created ${tasks.length} tasks`);

    // Group tasks for parallel execution (STEP 6)
    const { parallelGroups, sequential } = this.groupParallelTasks(tasks);

    console.log(`[v0] Parallel groups: ${parallelGroups.length}`);
    console.log(`[v0] Sequential tasks: ${sequential.length}`);

    // Build sequential order
    const sequentialOrder = this.buildSequentialOrder(tasks);

    // Estimate execution strategy
    const executionStrategy = framework.executionStrategy;

    // Estimate latency
    let estimatedLatency: "low" | "medium" | "high" = "low";
    if (tasks.length > 2) {
      estimatedLatency = "medium";
    }
    if (tasks.length > 4) {
      estimatedLatency = "high";
    }

    // Estimate timeline (rough)
    let timelineEstimate = 1000; // base 1s
    if (framework.selectedAgents.engineering)
      timelineEstimate += 5000; // +5s for engineering
    if (framework.selectedAgents.research) timelineEstimate += 3000; // +3s for research
    if (framework.selectedAgents.marketing) timelineEstimate += 2000; // +2s for marketing

    // If parallel, reduce time
    if (executionStrategy === "parallel") {
      timelineEstimate = Math.ceil(timelineEstimate * 0.6);
    }

    const plan: ExecutionPlan = {
      tasks,
      parallelGroups,
      sequentialOrder,
      estimatedCost: framework.estimatedCost,
      estimatedLatency,
      timelineEstimate,
    };

    console.log(`[v0] ExecutionPlanner result:`, {
      taskCount: tasks.length,
      estimatedLatency,
      timelineEstimate,
    });

    return plan;
  }
}

/**
 * Convenience function
 */
export const planExecution = (
  framework: DecisionFrameworkOutput
): ExecutionPlan => {
  const planner = new ExecutionPlanner();
  return planner.plan(framework);
};
