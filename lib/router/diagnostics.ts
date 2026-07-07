import type { RouterDecision, PromptProfile, ScoredCandidate, RejectedModel } from "@/types";

export function logDiagnostics(
  prompt: string,
  promptProfile: PromptProfile,
  eligible: string[],
  rejected: RejectedModel[],
  scoredCandidates: ScoredCandidate[],
  decision: RouterDecision
): void {
  console.log("\n=== Routing Diagnostics ===");
  console.log(`Prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}"`);
  console.log(`Task Category: ${promptProfile.taskCategory}`);
  console.log(`Complexity: ${promptProfile.complexity}`);
  console.log(`Reasoning Requirement: ${promptProfile.reasoningRequirement}`);
  console.log(`Coding Requirement: ${promptProfile.codingRequirement}`);
  console.log(`Multimodal Requirement: ${promptProfile.multimodalRequirement}`);
  console.log(`Latency Sensitivity: ${promptProfile.latencySensitivity}`);
  console.log(`Cost Sensitivity: ${promptProfile.costSensitivity}`);
  console.log(`Task Ambiguity: ${promptProfile.taskAmbiguity}`);
  console.log(`Eligible Models: ${eligible.length}`);
  console.log(`Rejected Models: ${rejected.length}`);

  if (rejected.length > 0 && rejected.length <= 5) {
    console.log("\nRejected Models (first 5):");
    rejected.slice(0, 5).forEach((r) => {
      console.log(`- ${r.model}: ${r.reason}`);
    });
  }

  console.log("\nTop 5 Scored Models:");
  scoredCandidates.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.model.id} (Total: ${c.scores.total.toFixed(2)})`);
    console.log(`   Task Fit: ${c.scores.taskFit.toFixed(1)}, Capability: ${c.scores.capability.toFixed(1)}, Benchmark: ${c.scores.benchmark}`);
    console.log(`   Latency: ${c.scores.latency}, Context: ${c.scores.context}, Cost: ${c.scores.cost.toFixed(1)}`);
  });

  console.log(`\nFinal Selected Model: ${decision.finalSelectedModel}`);
  if (decision.tieBreakReason) {
    console.log(`Tie Break Reason: ${decision.tieBreakReason}`);
  }
  console.log(`Confidence: ${decision.confidence}%`);
  console.log(`Estimated Cost: $${decision.estimatedCost.toFixed(6)}`);
  console.log(`Estimated Latency: ${decision.estimatedLatency}`);
  console.log(`Tradeoff Analysis: ${decision.tradeoffAnalysis}`);
  console.log("=== End Routing Diagnostics ===\n");
}
