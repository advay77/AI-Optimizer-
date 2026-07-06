/**
 * routerAgent.ts
 *
 * Orion's AI routing gateway. Architecture:
 *
 *  1. Analyse the user prompt deterministically — extract signals with no LLM cost.
 *  2. Fetch live candidate models (RouterCandidate) containing capability characteristics.
 *  3. Present candidates + prompt signals to the Router LLM as structured context.
 *  4. Router LLM compares candidates using a weighted scoring model and selects
 *     the candidate maximizing expected quality-to-cost value.
 *  5. Validate the LLM response; compute dynamic confidence based on score separation.
 *  6. Return a FinalRouterDecision to the API layer.
 *
 * Design principles:
 *  - No provider names hardcoded.
 *  - No rule-based tier mapping (no static coding -> Medium rules).
 *  - Dynamic optimization of Expected Quality / Cost.
 *  - Backend calculates confidence, token estimates, and actual transaction costs.
 */

import { OpenRouterService } from "./openrouter";
import type {
  RouterAgentResponse,
  TaskType,
  FinalRouterDecision,
  UnifiedModel,
  ChatMessage,
  RouterCandidate,
} from "@/types";
import { getFallbackModel, getModelById, getRouterCandidates } from "./modelCatalog";
import { z } from "zod";

// ─── Router Model ──────────────────────────────────────────────────────────────
const ROUTER_MODEL = "openai/gpt-4o-mini";

// ─── Zod Schema (Router-generated fields ONLY) ────────────────────────────────
const AlternativeModelSchema = z.object({
  model: z.string().min(1),
  status: z.enum(["Rejected", "Considered"]),
  reason: z.string().min(1),
  score: z.number(),
});

const RouterLLMOutputSchema = z.object({
  taskType: z.enum([
    "coding", "writing", "analysis", "translation", "general",
    "research", "debugging", "architecture", "simple_tasks",
    "content_generation", "complex_reasoning", "simple_coding", "multimodal",
  ]),
  complexity: z.enum(["low", "medium", "high"]),
  reasoningNeeded: z.boolean(),
  selectedModel: z.string().min(1),
  qualityScore: z.number(),
  costScore: z.number(),
  valueScore: z.number(),
  benchmarkScore: z.number(),
  estimatedLatency: z.enum(["low", "medium", "high"]),
  reason: z.string().min(1),
  tradeoffAnalysis: z.string().min(1),
  alternatives: z.array(AlternativeModelSchema).default([]),
});

// ─── Prompt Analysis ──────────────────────────────────────────────────────────
interface PromptAnalysis {
  promptLength: number;
  containsCode: boolean;
  containsMath: boolean;
  containsImageRequest: boolean;
  containsTranslation: boolean;
  containsArchitecture: boolean;
  containsDebugging: boolean;
  containsResearch: boolean;
  estimatedReasoningLevel: "Low" | "Medium" | "High";
}

function analysePrompt(prompt: string): PromptAnalysis {
  const lower = prompt.toLowerCase();

  const containsCode =
    /```[\s\S]*?```/.test(prompt) ||
    /(function|class|import|export|const|let|var|def |=>|async |await |\bSQL\b|\bAPI\b)/i.test(prompt) ||
    /(write.*code|implement|refactor|debug|fix.*bug|unit test|algorithm)/i.test(lower);

  const containsMath =
    /(\d+[\+\-\*\/\^]\d+|integral|derivative|matrix|equation|solve for|calculate|probability)/i.test(prompt);

  const containsImageRequest =
    /(image|photo|picture|diagram|chart|visuali[sz]e|generate.*image|draw)/i.test(lower);

  const containsTranslation =
    /(translate|translation|in (french|spanish|german|chinese|japanese|arabic|hindi|portuguese|korean)|convert.*language)/i.test(lower);

  const containsArchitecture =
    /(architecture|system design|design pattern|microservice|infrastructure|scalab|high.level|ERD|UML|flow.*diagram)/i.test(lower);

  const containsDebugging =
    /(debug|traceback|error|exception|stack.*trace|why.*fail|not.*working|unexpected behavior|bug)/i.test(lower);

  const containsResearch =
    /(research|literature|survey|compare.*models|state.*of.*art|paper|study|explain.*concept|summarize)/i.test(lower);

  const highComplexityCount = [
    containsArchitecture,
    containsResearch,
    containsMath,
    containsDebugging && containsCode,
  ].filter(Boolean).length;

  const estimatedReasoningLevel: PromptAnalysis["estimatedReasoningLevel"] =
    highComplexityCount >= 2 ? "High"
    : highComplexityCount === 1 || containsCode ? "Medium"
    : "Low";

  return {
    promptLength: prompt.length,
    containsCode,
    containsMath,
    containsImageRequest,
    containsTranslation,
    containsArchitecture,
    containsDebugging,
    containsResearch,
    estimatedReasoningLevel,
  };
}

function formatPromptSummary(analysis: PromptAnalysis): string {
  const flag = (v: boolean) => (v ? "Yes" : "No");
  return [
    "=== Prompt Analysis (deterministic) ===",
    `Length              : ${analysis.promptLength} chars`,
    `Contains Code       : ${flag(analysis.containsCode)}`,
    `Contains Math       : ${flag(analysis.containsMath)}`,
    `Contains Image Req  : ${flag(analysis.containsImageRequest)}`,
    `Contains Translation: ${flag(analysis.containsTranslation)}`,
    `Contains Architecture: ${flag(analysis.containsArchitecture)}`,
    `Contains Debugging  : ${flag(analysis.containsDebugging)}`,
    `Contains Research   : ${flag(analysis.containsResearch)}`,
    `Reasoning Required  : ${analysis.estimatedReasoningLevel}`,
  ].join("\n");
}

// ─── System Prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(candidateBlock: string): string {
  return `You are Orion, an intelligent production AI routing gateway.
Your objective is to select the model that maximizes the expected quality-to-cost ratio (Value Score) for the user's prompt. Do NOT simply choose the cheapest model. Optimize quality and cost together.

ROUTING LOGIC & SCORING:
For every candidate model, evaluate:
1. Capability Score (0-100): Weighted capability based on prompt requirements (Coding, Instruction Following, jsonReliability, Multilingual, etc.).
2. Reasoning Score (0-100): Reasoning and logical capabilities.
3. Context Suitability (0-100): Fits prompt length and context. Disqualify (score 0) if prompt fits poorly.
4. Latency Score (0-100): How fast the model is.
5. Benchmark Score (0-100): Overall benchmark average.
6. Cost Score (0-100): Higher means cheaper (100 = free/very low cost, 0 = high cost).

Calculate:
OverallScore (Value Score) = (CapabilityScore * W_cap + Reasoning * W_reason + Context * W_context + LatencyScore * W_latency + BenchmarkScore * W_benchmark + CostScore * W_cost) / Sum_of_Weights
- If Model A costs 10x more than Model B but only improves quality by 2%, do NOT choose Model A.
- If Model A costs 2x more than Model B but improves quality by 30%, choose Model A.
- Favour provider diversity. Never default to a single provider. Compare candidates dynamically.

CANDIDATE MODELS:
${candidateBlock}

OUTPUT FORMAT:
Return valid JSON only. Do not wrap in markdown or add text.
{
  "taskType": "coding" | "writing" | "analysis" | "translation" | "general" | "research" | "debugging" | "architecture" | "simple_tasks" | "content_generation" | "complex_reasoning" | "simple_coding" | "multimodal",
  "complexity": "low" | "medium" | "high",
  "reasoningNeeded": true | false,
  "selectedModel": "<exact model id from the candidate list>",
  "qualityScore": <calculated Capability Score, 0-100>,
  "costScore": <calculated Cost Score, 0-100>,
  "valueScore": <calculated OverallScore, 0-100>,
  "benchmarkScore": <calculated Benchmark Score, 0-100>,
  "estimatedLatency": "low" | "medium" | "high",
  "reason": "<brief summary of choice>",
  "tradeoffAnalysis": "<detailed explanation of the decision using measurable metrics (e.g. 'Selected Model X because Y costs 2.5x more with only a 3% quality gain in reasoning. Cheaper alternatives are rejected due to coding capabilities below 80/100.')>",
  "alternatives": [
    {
      "model": "<id>",
      "status": "Rejected" | "Considered",
      "score": <calculated OverallScore of this alternative, 0-100>,
      "reason": "<explain exactly why this model lost using measurable metrics (e.g. 'Costs 40% more with only a marginal 2-point increase in coding capability' or 'Lacks reasoning capability (76/100) needed for complex debugging')>"
    }
  ]
}`;
}

function buildCandidateBlock(candidates: RouterCandidate[]): string {
  return candidates
    .map((c) => {
      const tasks = c.preferredTasks.join(", ");
      return (
        `- ID: ${c.id}\n` +
        `  Provider: ${c.provider}\n` +
        `  Cost Tier: ${c.costTier}\n` +
        `  Context Window: ${c.contextWindow} tokens\n` +
        `  Preferred Tasks: ${tasks}\n` +
        `  Capability Notes: ${c.capabilityNotes}`
      );
    })
    .join("\n\n");
}

// ─── JSON Extraction ───────────────────────────────────────────────────────────
function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}

// ─── Backend-owned Calculations ───────────────────────────────────────────────
function calculateCompletionTokens(complexity: "low" | "medium" | "high"): number {
  const tokenMap: Record<"low" | "medium" | "high", number> = {
    low: 200,
    medium: 500,
    high: 1000,
  };
  return tokenMap[complexity];
}

function calculateEstimatedCost(
  model: UnifiedModel,
  promptTokens: number,
  completionTokens: number
): number {
  return (
    parseFloat(model.pricing.prompt) * promptTokens +
    parseFloat(model.pricing.completion) * completionTokens
  );
}

function calculateDynamicConfidence(
  valueScore: number,
  alternatives: { score: number }[]
): number {
  if (alternatives.length === 0) {
    return 95;
  }
  const highestAltScore = Math.max(...alternatives.map((alt) => alt.score));
  const separation = valueScore - highestAltScore;
  // Separation of 15+ points -> 99% confidence. 0 separation -> 50% confidence.
  return Math.min(99, Math.max(50, Math.round(50 + separation * 3.2)));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createFallbackAgentResponse(fallbackModel: UnifiedModel): RouterAgentResponse {
  return {
    taskType: "general",
    complexity: "medium",
    reasoningNeeded: false,
    selectedModel: fallbackModel.id,
    reason: "Router LLM failed — using configured fallback model.",
    qualityScore: 50,
    costScore: 90,
    valueScore: 70,
    benchmarkScore: 89,
    estimatedLatency: "low",
    tradeoffAnalysis: "Fallback routing activated due to an error.",
    alternatives: [],
  };
}

function buildFinalDecision(
  agentResponse: RouterAgentResponse,
  prompt: string,
  fallbackModel: UnifiedModel
): FinalRouterDecision {
  const selectedModel = getModelById(agentResponse.selectedModel) ?? fallbackModel;
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const estimatedCompletionTokens = calculateCompletionTokens(agentResponse.complexity);
  const estimatedCost = calculateEstimatedCost(
    selectedModel,
    estimatedPromptTokens,
    estimatedCompletionTokens
  );
  const confidence = calculateDynamicConfidence(agentResponse.valueScore, agentResponse.alternatives);

  return {
    ...agentResponse,
    estimatedPromptTokens,
    estimatedCompletionTokens,
    estimatedCost,
    confidence,
    fallbackModel: fallbackModel.id,
  };
}

// ─── Router Agent ─────────────────────────────────────────────────────────────
export class RouterAgent {
  private openRouterService: OpenRouterService;

  constructor() {
    this.openRouterService = new OpenRouterService();
  }

  async route(prompt: string): Promise<FinalRouterDecision> {
    const candidates = getRouterCandidates();
    const fallbackModel = getFallbackModel();
    const candidateIdSet = new Set(candidates.map((c) => c.id));

    // Stage 1 — Deterministic prompt analysis.
    const analysis = analysePrompt(prompt);
    const promptSummary = formatPromptSummary(analysis);

    console.log(
      `[Router] Prompt signals: reasoning=${analysis.estimatedReasoningLevel}, ` +
      `code=${analysis.containsCode}, arch=${analysis.containsArchitecture}, ` +
      `research=${analysis.containsResearch}, debug=${analysis.containsDebugging}`
    );

    // Stage 2 — Build messages.
    const candidateBlock = buildCandidateBlock(candidates);
    const systemPrompt = buildSystemPrompt(candidateBlock);
    const userMessage = `${promptSummary}\n\n=== Original Prompt ===\n${prompt}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    let rawResponse: string | undefined;

    try {
      // Stage 3 — Call the Router LLM.
      const response = await this.openRouterService.callModel(
        ROUTER_MODEL,
        messages,
        { temperature: 0.1, maxTokens: 600 }
      );

      rawResponse = response.choices[0]?.message?.content;
      if (!rawResponse) {
        throw new Error("Router LLM returned empty content.");
      }

      // Stage 4a — Extract JSON.
      const jsonString = extractFirstJsonObject(rawResponse);
      if (!jsonString) {
        console.error("[Router] Raw response (no JSON found):", rawResponse);
        throw new Error("No JSON object found in Router LLM response.");
      }

      // Stage 4b — Parse.
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        console.error("[Router] JSON parse error:", parseError);
        console.error("[Router] Extracted string:", jsonString);
        throw new Error(`JSON.parse failed: ${String(parseError)}`);
      }

      // Stage 4c — Validate against Router-only schema.
      let validated: RouterAgentResponse;
      try {
        validated = RouterLLMOutputSchema.parse(parsed);
      } catch (validationError) {
        console.error("[Router] Zod validation error:", validationError);
        console.error("[Router] Parsed object:", parsed);
        throw new Error(`Schema validation failed: ${String(validationError)}`);
      }

      // Stage 5 — Guard: selected model must be one we showed the Router.
      if (!candidateIdSet.has(validated.selectedModel)) {
        console.warn(
          `[Router] Selected model "${validated.selectedModel}" was not in the candidate list. ` +
          `Falling back to "${fallbackModel.id}".`
        );
        validated.selectedModel = fallbackModel.id;
      }

      console.log(
        `[Router] Decision: ${validated.selectedModel} | Value: ${validated.valueScore} | ` +
        `Quality: ${validated.qualityScore} | Cost: ${validated.costScore} | ` +
        `Confidence: ${calculateDynamicConfidence(validated.valueScore, validated.alternatives)}%`
      );

      // Stage 6 — Enrich.
      return buildFinalDecision(validated, prompt, fallbackModel);

    } catch (error) {
      console.error("=== ROUTER FAILURE ===");
      console.error("[Router] Raw response:", rawResponse ?? "(none)");
      console.error("[Router] Error:", error);
      console.warn("[Router] Activating fallback model:", fallbackModel.id);

      const fallback = createFallbackAgentResponse(fallbackModel);
      return buildFinalDecision(fallback, prompt, fallbackModel);
    }
  }
}
