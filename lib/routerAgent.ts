import type {
  RouterAgentResponse,
  TaskType,
  FinalRouterDecision,
  UnifiedModel,
} from "@/types";
import { getFallbackModel, getModelById, getRouterCandidates } from "./modelCatalog";

// ─── Constants ─────────────────────────────────────────────────────────────────

// ─── Prompt Analysis Signals ────────────────────────────────────────────────────
interface PromptSignals {
  isCoding: boolean;
  isDebugging: boolean;
  isWriting: boolean;
  isTranslation: boolean;
  isMultimodal: boolean;
  isArchitecture: boolean;
  isResearch: boolean;
  isReasoning: boolean;
  isSimpleTask: boolean;
}

function analyzePrompt(prompt: string): PromptSignals {
  const p = prompt.toLowerCase();
  return {
    isCoding: /function|class|import|export|const|let|var|def|code|implement|refactor/.test(p),
    isDebugging: /debug|error|bug|fix|problem|traceback/.test(p),
    isWriting: /write|draft|essay|article|post|story|content/.test(p),
    isTranslation: /translate|translation|language|english|spanish|french|german|hindi|chinese|japanese/.test(p),
    isMultimodal: /image|photo|picture|diagram|visual|chart/.test(p),
    isArchitecture: /architecture|system design|design pattern|microservice|scalable|infrastructure/.test(p),
    isResearch: /research|paper|study|explain|concept|summarize|compare|analyze/.test(p),
    isReasoning: /why|how|solve|problem|think|reason|complex/.test(p),
    isSimpleTask: /hi|hello|what|who|when|where|simple|quick|easy|short/.test(p),
  };
}

// ─── Scoring Functions ─────────────────────────────────────────────────────────
interface ScoredCandidate {
  model: UnifiedModel;
  taskFit: number;
  capabilityScore: number;
  qualityScore: number;
  latencyScore: number;
  contextScore: number;
  costScore: number;
  overallValue: number;
}

function calculateScore(candidate: UnifiedModel, signals: PromptSignals): ScoredCandidate {
  const caps = candidate.capabilities;

  // Task Fit Score
  let taskFit = 50;
  if (signals.isCoding) taskFit = caps.coding || 50;
  if (signals.isDebugging) taskFit = caps.reasoning || 50;
  if (signals.isWriting) taskFit = caps.instructionFollowing || 70;
  if (signals.isTranslation) taskFit = caps.multilingual || 60;
  if (signals.isMultimodal) taskFit = caps.multimodal ? 90 : 30;
  if (signals.isArchitecture) taskFit = caps.reasoning || 50;
  if (signals.isResearch) taskFit = caps.longContext || 50;
  if (signals.isReasoning) taskFit = caps.reasoning || 50;
  if (signals.isSimpleTask) taskFit = 80;

  // Capability Score
  const capabilityScore =
    (caps.reasoning || 60) * 0.25 +
    (caps.coding || 50) * 0.2 +
    (caps.instructionFollowing || 70) * 0.2 +
    (caps.jsonReliability || 70) * 0.15 +
    (caps.longContext || 50) * 0.1 +
    (caps.multilingual || 60) * 0.1;

  // Quality Score
  const qualityScore = (capabilityScore * 0.7 + (caps.benchmarkScore || 80) * 0.3);

  // Latency Score
  const latencyScore = caps.latency === "low" ? 100 : caps.latency === "medium" ? 70 : 40;

  // Context Score
  const contextScore = candidate.context_length >= 128000 ? 100 : candidate.context_length >= 32000 ? 80 : 60;

  // Cost Score
  const totalCost = parseFloat(candidate.pricing.prompt) + parseFloat(candidate.pricing.completion);
  let costScore = 100;
  if (totalCost > 0.001) costScore = 40;
  else if (totalCost > 0.0001) costScore = 70;
  else if (totalCost > 0.00001) costScore = 90;

  // Overall Value Score
  const overallValue = (taskFit * capabilityScore * qualityScore) / Math.max(1, 100000 * totalCost);

  return {
    model: candidate,
    taskFit: Math.round(taskFit),
    capabilityScore: Math.round(capabilityScore),
    qualityScore: Math.round(qualityScore),
    latencyScore,
    contextScore,
    costScore,
    overallValue,
  };
}

// ─── Backend Deterministic Calculations ────────────────────────────────────────
function calculateCompletionTokens(complexity: "low" | "medium" | "high"): number {
  return complexity === "low" ? 512 : complexity === "medium" ? 1024 : 2048;
}

function calculateEstimatedCost(model: UnifiedModel, promptTokens: number, completionTokens: number): number {
  return (parseFloat(model.pricing.prompt) * promptTokens) + (parseFloat(model.pricing.completion) * completionTokens);
}

function calculateDynamicConfidence(selectedValue: number, secondBestValue: number): number {
  const diff = selectedValue - secondBestValue;
  const conf = 50 + diff * 3.2;
  return Math.min(99, Math.max(50, Math.round(conf)));
}

function getTaskTypeFromSignals(signals: PromptSignals): TaskType {
  if (signals.isCoding) return "coding";
  if (signals.isDebugging) return "debugging";
  if (signals.isWriting) return "writing";
  if (signals.isTranslation) return "translation";
  if (signals.isMultimodal) return "multimodal";
  if (signals.isArchitecture) return "architecture";
  if (signals.isResearch) return "research";
  if (signals.isReasoning) return "complex_reasoning";
  if (signals.isSimpleTask) return "simple_tasks";
  return "general";
}

// ─── Main Router Agent Class ───────────────────────────────────────────────────
export class RouterAgent {
  async route(prompt: string): Promise<FinalRouterDecision> {
    const routerCandidates = getRouterCandidates();
    const candidateIds = routerCandidates.map(c => c.id);
    const allCandidates = candidateIds.map(id => getModelById(id)).filter(Boolean) as UnifiedModel[];
    const fallbackModel = getFallbackModel();

    // Step 1: Analyze Prompt
    const signals = analyzePrompt(prompt);
    const estimatedPromptTokens = Math.ceil(prompt.length / 4);

    // Step 2: Score all candidates
    const scoredCandidates = allCandidates.map(c => calculateScore(c, signals));
    scoredCandidates.sort((a, b) => b.overallValue - a.overallValue);

    const best = scoredCandidates[0] || {
      model: fallbackModel,
      overallValue: 100000,
      taskFit: 80,
      capabilityScore: 80,
      qualityScore: 80,
      latencyScore: 100,
      contextScore: 80,
      costScore: 90
    };
    const secondBest = scoredCandidates[1] || best;

    const complexity = signals.isReasoning || signals.isResearch ? "high" : signals.isCoding ? "medium" : "low";
    const estimatedCompletionTokens = calculateCompletionTokens(complexity);
    const estimatedCost = calculateEstimatedCost(
      best.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    const confidence = calculateDynamicConfidence(best.overallValue, secondBest.overallValue);

    const alternatives = scoredCandidates.slice(1, 3).map(s => ({
      model: s.model.id,
      status: "Considered" as const,
      reason: "High value but not top",
      score: Math.round(Math.min(100, Math.max(0, s.overallValue / 100)))
    }));

    return {
      taskType: getTaskTypeFromSignals(signals),
      complexity,
      reasoningNeeded: signals.isReasoning || signals.isResearch || signals.isDebugging,
      selectedModel: best.model.id,
      reason: "Selected best value model (quality/cost optimized)",
      qualityScore: best.qualityScore,
      costScore: best.costScore,
      valueScore: Math.round(Math.min(100, Math.max(0, best.overallValue / 100))),
      benchmarkScore: best.model.capabilities.benchmarkScore || 80,
      estimatedLatency: best.model.capabilities.latency || "low",
      tradeoffAnalysis: "Optimized for best quality/cost ratio",
      alternatives,
      estimatedPromptTokens,
      estimatedCompletionTokens,
      estimatedCost,
      confidence,
      fallbackModel: fallbackModel.id
    };
  }
}
