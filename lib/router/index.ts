import type { UnifiedModel, RouterDecision } from "@/types";
import { profilePrompt } from "./promptProfiler";
import { filterCandidates } from "./candidateFilter";
import { getTaskWeights } from "./taskWeights";
import { scoreCandidates } from "./scorer";
import { breakTies } from "./tieBreaker";
import { calculateConfidence } from "./confidence";
import { logDiagnostics } from "./diagnostics";

export * from "./promptProfiler";
export * from "./candidateFilter";
export * from "./taskWeights";
export * from "./scorer";
export * from "./tieBreaker";
export * from "./confidence";
export * from "./diagnostics";

export function routePrompt(
  prompt: string,
  allModels: UnifiedModel[],
  logEnabled = true
): RouterDecision {
  // Step 1: Prompt Analysis
  const promptProfile = profilePrompt(prompt);

  // Step 2: Candidate Filtering
  const { eligible, rejected } = filterCandidates(allModels, promptProfile);

  // Step 3: Task‑Specific Scoring
  const taskWeights = getTaskWeights(promptProfile.taskCategory);
  const scoredCandidates = scoreCandidates(eligible, promptProfile, taskWeights);

  // Step 4: Intelligent Tie Breaking
  const { winner, reason: tieBreakReason } = breakTies(scoredCandidates, 3.0);

  // Step 5: Confidence Calculation
  const confidence = calculateConfidence(scoredCandidates, promptProfile);

  // Calculate estimated cost and latency
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const estimatedCompletionTokens =
    promptProfile.complexity === "low"
      ? 512
      : promptProfile.complexity === "medium"
        ? 1024
        : 2048;
  const estimatedCost =
    parseFloat(winner.model.pricing.prompt) * estimatedPromptTokens +
    parseFloat(winner.model.pricing.completion) * estimatedCompletionTokens;

  // Build tradeoff analysis
  const tradeoffAnalysis =
    `Selected ${winner.model.id} based on ${promptProfile.taskCategory}‑specific scoring. ` +
    `Score gap: ${(scoredCandidates[0].totalScore - (scoredCandidates[1]?.totalScore ?? 0)).toFixed(2)} points.`;

  const decision: RouterDecision = {
    promptProfile,
    eligibleModels: eligible.map((m) => m.id),
    rejectedModels: rejected,
    scoringBreakdown: scoredCandidates.slice(0, 5).map((c) => ({
      model: c.model.id,
      scores: c.scores,
    })),
    tieBreakReason,
    finalSelectedModel: winner.model.id,
    confidence,
    estimatedCost,
    estimatedLatency: winner.model.capabilities.latency ?? "medium",
    tradeoffAnalysis,
  };

  // Log diagnostics if enabled
  if (logEnabled) {
    logDiagnostics(
      prompt,
      promptProfile,
      eligible.map((m) => m.id),
      rejected,
      scoredCandidates,
      decision
    );
  }

  return decision;
}
