import type { ScoredCandidate } from "@/types";

const usageHistory: Map<string, number> = new Map(); // model id → last used time

export function breakTies(
  scoredCandidates: ScoredCandidate[],
  scoreThreshold = 3.0
): { winner: ScoredCandidate; reason: string | null } {
  if (scoredCandidates.length === 0) {
    throw new Error("No candidates to break ties for");
  }

  if (scoredCandidates.length === 1) {
    return { winner: scoredCandidates[0], reason: "Only eligible candidate" };
  }

  const topScore = scoredCandidates[0].totalScore;
  const tieGroup: ScoredCandidate[] = [];

  for (const candidate of scoredCandidates) {
    if (topScore - candidate.totalScore <= scoreThreshold) {
      tieGroup.push(candidate);
    } else {
      break;
    }
  }

  if (tieGroup.length === 1) {
    return { winner: tieGroup[0], reason: null };
  }

  // Step 1: Provider diversity (prefer different provider than last used)
  let lastUsedModel: string | null = null;
  let lastUsedTime = 0;
  for (const [modelId, time] of usageHistory.entries()) {
    if (time > lastUsedTime) {
      lastUsedTime = time;
      lastUsedModel = modelId;
    }
  }

  if (lastUsedModel) {
    const lastProvider = lastUsedModel.split("/")[0];
    const diverseCandidates = tieGroup.filter(
      (c) => c.model.id.split("/")[0] !== lastProvider
    );
    if (diverseCandidates.length > 0) {
      const winner = diverseCandidates[0];
      usageHistory.set(winner.model.id, Date.now());
      return {
        winner,
        reason: "Provider diversity: used different provider than last selection",
      };
    }
  }

  // Step 2: Lower latency
  tieGroup.sort((a, b) => {
    const latencyOrder = { low: 0, medium: 1, high: 2 };
    const aLatency = a.model.capabilities.latency ?? "medium";
    const bLatency = b.model.capabilities.latency ?? "medium";
    return latencyOrder[aLatency] - latencyOrder[bLatency];
  });

  if (tieGroup.length > 0) {
    const winner = tieGroup[0];
    usageHistory.set(winner.model.id, Date.now());
    return {
      winner,
      reason: "Tie broken by lower latency",
    };
  }

  // Fallback to top scored
  const winner = scoredCandidates[0];
  usageHistory.set(winner.model.id, Date.now());
  return {
    winner,
    reason: null,
  };
}
