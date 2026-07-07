import type { ScoredCandidate, PromptProfile } from "@/types";

export function calculateConfidence(
  scoredCandidates: ScoredCandidate[],
  profile: PromptProfile
): number {
  if (scoredCandidates.length === 0) return 0;
  if (scoredCandidates.length === 1) return 95;

  const topScore = scoredCandidates[0].totalScore;
  const secondScore = scoredCandidates[1].totalScore;
  const scoreGap = topScore - secondScore;

  // Base confidence from score gap
  let confidence = 50 + Math.min(scoreGap * 2.5, 40);

  // Adjust for candidate count: more candidates = lower confidence if scores are close
  if (scoredCandidates.length > 5 && scoreGap < 5) {
    confidence -= 10;
  }

  // Adjust for task ambiguity
  confidence -= profile.taskAmbiguity * 0.2;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(confidence)));
}
