import type {
  OrchestratorResponse,
  ArtifactFile,
  ExecutionMetrics,
  MemoryStore,
} from "@/types";

/**
 * Final Response Builder: STEP 10 of Decision Framework
 * 
 * Only after EVERY required agent finishes:
 * - Merge: Outputs + Artifacts + Memory + Metrics
 * - Never expose internal reasoning
 * - Never generate unnecessary work
 * - Return: Answer + Artifacts + Execution Report
 */

export class ResponseBuilder {
  /**
   * Build final response after all agents complete
   */
  buildResponse(
    memory: MemoryStore,
    artifacts: ArtifactFile[],
    metrics: ExecutionMetrics
  ): OrchestratorResponse {
    console.log(`[v0] ResponseBuilder.buildResponse() starting`);

    // Build answer/summary
    const answer = this.buildAnswer(memory);

    // Extract report data
    const executionReport = {
      agentsUsed: [
        ...(memory.planning?.selectedAgents?.engineering ? ["Engineering"] : []),
        ...(memory.planning?.selectedAgents?.research ? ["Research"] : []),
        ...(memory.planning?.selectedAgents?.marketing ? ["Marketing"] : []),
      ],
      skillsUsed: this.extractSkillsUsed(memory),
      totalTime: metrics.totalLatency || 0,
      totalCost: metrics.totalCost,
    };

    const response: OrchestratorResponse = {
      answer,
      artifacts,
      executionReport,
      metrics,
      confidence: metrics.confidenceScore,
    };

    console.log(`[v0] ResponseBuilder complete`);
    console.log(`[v0] Final response:`, {
      answerLength: answer.length,
      artifactCount: artifacts.length,
      agentsUsed: executionReport.agentsUsed,
      totalCost: executionReport.totalCost,
      confidence: response.confidence,
    });

    return response;
  }

  /**
   * Build user-friendly answer
   * Never expose internal reasoning
   */
  private buildAnswer(memory: MemoryStore): string {
    let answer = "";

    // Add synthesis based on what agents generated
    if (memory.intent) {
      const intent = memory.intent;
      answer += `# ${intent.taskType.replace(/_/g, " ").toUpperCase()}\n\n`;
      answer += `**Deliverable:** ${intent.primaryDeliverable}\n\n`;
    }

    // Add engineering summary if available
    if (memory.engineering) {
      const eng = memory.engineering as any;
      if (eng.summary) {
        answer += `## Implementation\n\n${eng.summary}\n\n`;
      }
      if (eng.setupInstructions && eng.setupInstructions.length > 0) {
        answer += `### Setup Instructions\n`;
        eng.setupInstructions.forEach((instr: string) => {
          answer += `- ${instr}\n`;
        });
        answer += "\n";
      }
    }

    // Add research summary if available
    if (memory.research) {
      const research = memory.research as any;
      if (research.summary) {
        answer += `## Analysis\n\n${research.summary}\n\n`;
      }
      if (research.recommendations && research.recommendations.length > 0) {
        answer += `### Recommendations\n`;
        research.recommendations.forEach((rec: string) => {
          answer += `- ${rec}\n`;
        });
        answer += "\n";
      }
    }

    // Add marketing summary if available
    if (memory.marketing) {
      const marketing = memory.marketing as any;
      if (marketing.summary) {
        answer += `## Documentation\n\n${marketing.summary}\n\n`;
      }
    }

    // If no content was generated, provide generic message
    if (answer.length === 0) {
      answer =
        "Your request has been processed and artifacts have been generated. Please review the artifacts section.";
    }

    return answer;
  }

  /**
   * Extract all skills that were actually used
   */
  private extractSkillsUsed(memory: MemoryStore): string[] {
    const skills = new Set<string>();

    if (memory.planning?.skillMatrix) {
      Object.values(memory.planning.skillMatrix).forEach((agentSkills) => {
        if (Array.isArray(agentSkills)) {
          agentSkills.forEach((s) => skills.add(s));
        }
      });
    }

    return Array.from(skills);
  }
}

/**
 * Convenience function
 */
export const buildFinalResponse = (
  memory: MemoryStore,
  artifacts: ArtifactFile[],
  metrics: ExecutionMetrics
): OrchestratorResponse => {
  const builder = new ResponseBuilder();
  return builder.buildResponse(memory, artifacts, metrics);
};
