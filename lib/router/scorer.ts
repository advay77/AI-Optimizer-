import type { UnifiedModel, PromptProfile, TaskWeights, WeightedScore, ScoredCandidate } from "@/types";

function calculateLogarithmicCostScore(model: UnifiedModel): number {
  const promptCost = parseFloat(model.pricing.prompt) * 1000000;
  const completionCost = parseFloat(model.pricing.completion) * 1000000;
  const totalCost = promptCost + completionCost;
  const logScore = 100 - Math.log10(1 + totalCost) * 30;
  return Math.max(0, Math.min(100, logScore));
}

function calculateLatencyScore(latency: "low" | "medium" | "high" | undefined): number {
  if (!latency) return 70;
  if (latency === "low") return 100;
  if (latency === "medium") return 70;
  return 40;
}

function calculateContextScore(contextWindow: number): number {
  if (contextWindow >= 128000) return 100;
  if (contextWindow >= 32000) return 85;
  if (contextWindow >= 8000) return 70;
  return 50;
}

function calculateTaskFitScore(model: UnifiedModel, profile: PromptProfile): number {
  const caps = model.capabilities;
  let score = 70;

  if (profile.taskCategory === "coding" || profile.taskCategory === "debugging" || profile.taskCategory === "architecture") {
    score = caps.coding ?? 70;
  } else if (profile.taskCategory === "translation") {
    score = caps.multilingual ?? 70;
  } else if (profile.taskCategory === "multimodal") {
    score = caps.multimodal ? 90 : 60;
  } else if (profile.taskCategory === "complex_reasoning" || profile.taskCategory === "research") {
    score = caps.reasoning ?? 70;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateCapabilityScore(model: UnifiedModel): number {
  const caps = model.capabilities;
  const scores = [
    caps.reasoning ?? 50,
    caps.coding ?? 50,
    caps.instructionFollowing ?? 70,
    caps.jsonReliability ?? 70,
    caps.longContext ?? 60,
    caps.multilingual ?? 60,
  ];
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function scoreCandidates(
  eligibleModels: UnifiedModel[],
  profile: PromptProfile,
  taskWeights: TaskWeights
): ScoredCandidate[] {
  return eligibleModels.map((model) => {
    const caps = model.capabilities;
    const taskFit = calculateTaskFitScore(model, profile);
    const capability = calculateCapabilityScore(model);
    const benchmark = caps.benchmarkScore ?? 70;
    const latency = calculateLatencyScore(caps.latency);
    const context = calculateContextScore(model.context_length);
    const cost = calculateLogarithmicCostScore(model);

    // Apply task-specific weights
    let totalScore = 0;
    for (const [key, weight] of Object.entries(taskWeights)) {
      switch (key) {
        case "coding":
          totalScore += (caps.coding ?? 50) * weight;
          break;
        case "reasoning":
          totalScore += (caps.reasoning ?? 50) * weight;
          break;
        case "instructionFollowing":
          totalScore += (caps.instructionFollowing ?? 70) * weight;
          break;
        case "jsonReliability":
          totalScore += (caps.jsonReliability ?? 70) * weight;
          break;
        case "multilingual":
          totalScore += (caps.multilingual ?? 60) * weight;
          break;
        case "multimodal":
          totalScore += (caps.multimodal ? 90 : 60) * weight;
          break;
        case "context":
          totalScore += context * weight;
          break;
        case "latency":
          totalScore += latency * weight;
          break;
        case "cost":
          totalScore += cost * weight;
          break;
        case "benchmark":
          totalScore += benchmark * weight;
          break;
      }
    }

    const scores: WeightedScore = {
      taskFit,
      capability,
      benchmark,
      latency,
      context,
      cost,
      total: totalScore,
    };

    return { model, scores, totalScore };
  }).sort((a, b) => b.totalScore - a.totalScore);
}
