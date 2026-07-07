import type {
  FinalRouterDecision,
  UnifiedModel,
  AlternativeModel,
} from "@/types";
import { getFallbackModel, getEligibleRouterCandidates } from "./modelCatalog";
import { routePrompt } from "./router";

// ─── Main Router Agent Class ───────────────────────────────────────────────
export class RouterAgent {
  async route(prompt: string): Promise<FinalRouterDecision> {
    const allModels = getEligibleRouterCandidates();
    const fallbackModel = getFallbackModel();

    // Step 1: Use new modular router
    const decision = routePrompt(prompt, allModels);

    // Step 2: Log diagnostics
    console.log("\n=== Routing Diagnostics ===");
    console.log(`Prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}"`);
    console.log(`Task Category: ${decision.promptProfile.taskCategory}`);
    console.log(`Complexity: ${decision.promptProfile.complexity}`);
    console.log(`Eligible Models: ${decision.eligibleModels.length}`);
    console.log(`Rejected Models: ${decision.rejectedModels.length}`);
    console.log("\nTop 5 Scored Models:");
    decision.scoringBreakdown.forEach((item, i) => {
      console.log(
        `${i + 1}. ${item.model} (Total Score: ${item.scores.total.toFixed(2)})`
      );
    });
    console.log(`\nSelected Model: ${decision.finalSelectedModel}`);
    if (decision.tieBreakReason) {
      console.log(`Tie Break Reason: ${decision.tieBreakReason}`);
    }
    console.log(`Confidence: ${decision.confidence}%\n`);

    // Step 3: Build alternatives list (for compatibility with existing API)
    const alternatives: AlternativeModel[] = decision.eligibleModels
      .filter((id) => id !== decision.finalSelectedModel)
      .slice(0, 2)
      .map((id) => ({
        model: id,
        status: "Considered" as const,
        reason: "Eligible candidate but not selected",
        score: 70,
      }));

    // Step 4: Find selected model to get capabilities
    const selectedModel = allModels.find((m) => m.id === decision.finalSelectedModel) || fallbackModel;
    const caps = selectedModel.capabilities;

    return {
      taskType: decision.promptProfile.taskCategory,
      complexity: decision.promptProfile.complexity,
      reasoningNeeded:
        decision.promptProfile.reasoningRequirement !== "low",
      selectedModel: decision.finalSelectedModel,
      reason: decision.tradeoffAnalysis,
      qualityScore: Math.round(
        ((caps.reasoning ?? 50) + (caps.coding ?? 50)) / 2
      ),
      costScore: Math.round(100 - decision.estimatedCost * 1000),
      valueScore: Math.round(
        decision.scoringBreakdown[0]?.scores.total ?? 70
      ),
      benchmarkScore: caps.benchmarkScore ?? 70,
      estimatedLatency: decision.estimatedLatency,
      tradeoffAnalysis: decision.tradeoffAnalysis,
      alternatives,
      estimatedPromptTokens: decision.promptProfile.estimatedTokenUsage,
      estimatedCompletionTokens:
        decision.promptProfile.complexity === "low"
          ? 512
          : decision.promptProfile.complexity === "medium"
            ? 1024
            : 2048,
      estimatedCost: decision.estimatedCost,
      confidence: decision.confidence,
      fallbackModel: fallbackModel.id,
    };
  }
}
