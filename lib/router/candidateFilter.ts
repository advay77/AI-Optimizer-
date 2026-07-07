import type { UnifiedModel, PromptProfile, RejectedModel } from "@/types";

export function filterCandidates(
  allModels: UnifiedModel[],
  profile: PromptProfile
): { eligible: UnifiedModel[]; rejected: RejectedModel[] } {
  const eligible: UnifiedModel[] = [];
  const rejected: RejectedModel[] = [];

  for (const model of allModels) {
    const caps = model.capabilities;

    // Skip any model missing our custom capabilities
    if (!caps.reasoning || !caps.coding || caps.benchmarkScore === undefined) {
      rejected.push({
        model: model.id,
        reason: "Missing complete capability data",
      });
      continue;
    }

    // Reject deprecated models
    if (model.description && model.description.toLowerCase().includes("deprecated")) {
      rejected.push({
        model: model.id,
        reason: "Model is deprecated",
      });
      continue;
    }

    // Reject free models (unless allowed by env, default false)
    if (!process.env.ALLOW_FREE_MODELS && model.id.includes(":free")) {
      rejected.push({
        model: model.id,
        reason: "Free models not enabled",
      });
      continue;
    }

    // Multimodal requirement check
    if (profile.multimodalRequirement && !caps.multimodal) {
      rejected.push({
        model: model.id,
        reason: "Multimodal capability required but not available",
      });
      continue;
    }

    // Long context requirement check
    if (model.context_length < profile.longContextRequirement) {
      rejected.push({
        model: model.id,
        reason: `Context window ${model.context_length} < required ${profile.longContextRequirement}`,
      });
      continue;
    }

    // Coding requirement check
    if (profile.codingRequirement === "high" && (caps.coding ?? 0) < 70) {
      rejected.push({
        model: model.id,
        reason: `Coding score ${caps.coding} < threshold 70 for high coding requirement`,
      });
      continue;
    }
    if (profile.codingRequirement === "medium" && (caps.coding ?? 0) < 50) {
      rejected.push({
        model: model.id,
        reason: `Coding score ${caps.coding} < threshold 50 for medium coding requirement`,
      });
      continue;
    }

    // Reasoning requirement check
    if (profile.reasoningRequirement === "high" && (caps.reasoning ?? 0) < 70) {
      rejected.push({
        model: model.id,
        reason: `Reasoning score ${caps.reasoning} < threshold 70 for high reasoning requirement`,
      });
      continue;
    }
    if (profile.reasoningRequirement === "medium" && (caps.reasoning ?? 0) < 50) {
      rejected.push({
        model: model.id,
        reason: `Reasoning score ${caps.reasoning} < threshold 50 for medium reasoning requirement`,
      });
      continue;
    }

    // Translation check (multilingual requirement)
    if (profile.taskCategory === "translation" && (caps.multilingual ?? 0) < 60) {
      rejected.push({
        model: model.id,
        reason: `Multilingual score ${caps.multilingual} < threshold 60 for translation task`,
      });
      continue;
    }

    // If passed all checks, add to eligible
    eligible.push(model);
  }

  return { eligible, rejected };
}
