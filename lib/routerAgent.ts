import { OpenRouterService } from "./openrouter";
import type { RouterAgentResponse, UnifiedModel, AlternativeModel } from "@/types";
import { getFallbackModel, getModelById } from "./modelCatalog";
import { z } from "zod";

const ROUTER_MODEL = "meta-llama/llama-3.1-8b-instruct";

const AlternativeModelSchema = z.object({
  model: z.string(),
  status: z.enum(["Rejected", "Considered"]),
  reason: z.string(),
});

const RouterAgentResponseSchema = z.object({
  taskType: z.string(),
  complexity: z.enum(["low", "medium", "high"]),
  reasoningNeeded: z.boolean(),
  estimatedPromptTokens: z.number().int().min(50),
  estimatedCompletionTokens: z.number().int().min(50),
  estimatedCost: z.number(),
  selectedModel: z.string(),
  confidence: z.number().int().min(0).max(100),
  reason: z.string(),
  fallbackModel: z.string(),
  alternatives: z.array(AlternativeModelSchema).min(2),
});

function createFallbackResponse(prompt: string, fallbackModel: UnifiedModel): RouterAgentResponse {
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const estimatedCompletionTokens = 500;
  const estimatedCost =
    (parseFloat(fallbackModel.pricing.prompt) * estimatedPromptTokens) +
    (parseFloat(fallbackModel.pricing.completion) * estimatedCompletionTokens);

  return {
    taskType: "general",
    complexity: "medium",
    reasoningNeeded: false,
    estimatedPromptTokens,
    estimatedCompletionTokens,
    estimatedCost,
    selectedModel: fallbackModel.id,
    confidence: 50,
    reason: "Fallback model used due to router agent failure",
    fallbackModel: fallbackModel.id,
    alternatives: [],
  };
}

export class RouterAgent {
  private openRouterService: OpenRouterService;

  constructor() {
    this.openRouterService = new OpenRouterService();
  }

  async route(prompt: string, topCandidates: UnifiedModel[]): Promise<RouterAgentResponse> {
    const fallbackModel = getFallbackModel();

    const systemPrompt = `You are Orion, an expert AI routing engine. Your job is to analyze the user's prompt and select the OPTIMAL model from the provided catalog by balancing multiple factors.

IMPORTANT: You MUST compare AT LEAST THREE candidate models before making your selection.

CANDIDATE MODELS (ONLY CHOOSE FROM THESE):
${topCandidates
  .map(
    (model) => `
- ID: ${model.id}
  Name: ${model.name}
  Pricing:
    - Prompt: $${model.pricing.prompt}/token
    - Completion: $${model.pricing.completion}/token
  Context Length: ${model.context_length} tokens
  Capabilities:
    - Preferred Tasks: ${model.capabilities.preferredTasks.join(", ")}
    - Notes: ${model.capabilities.notes}
`
  )
  .join("\n")}

OPTIMIZATION FACTORS (BALANCE ALL THESE):
1. Cost (lower is better, but don't sacrifice quality)
2. Expected Quality (match to task needs)
3. Context Length (ensure it fits your needs)
4. Coding Capability (for coding tasks)
5. Reasoning Requirement (for complex tasks)
6. Task Complexity (low/medium/high)

DECISION RULES:
1. FOR SIMPLE TASKS (chat, translation, summarization, rewriting): Prefer low-cost models like GPT-4o Mini, Claude Haiku, Llama 8B
2. FOR MEDIUM CODING TASKS: Prefer mid-tier models like Claude Sonnet, GPT-4o, Llama 70B
3. FOR ARCHITECTURE, DEBUGGING, RESEARCH, MULTI-STEP REASONING: Prefer stronger reasoning models like GPT-4o, Claude Sonnet, Llama 405B
4. NEVER ALWAYS CHOOSE THE SAME MODEL - vary your selections based on task
5. EXPENSIVE FRONTIER MODELS (like GPT-4o, Claude 3.5 Sonnet, Llama 405B) should ONLY be selected if cheaper models are UNLIKELY to provide similar quality
6. YOU MUST COMPARE AT LEAST THREE CANDIDATES in your "alternatives" list

CONFIDENCE ESTIMATION GUIDELINES:
- Simple chat/translation/summarization: 90-99%
- Coding tasks: 80-90%
- Architecture/debugging/multi-step reasoning: 65-80%
- Medical/legal/research: 60-75%

ESTIMATED COST CALCULATION:
1. Estimate number of prompt tokens (approximate: 1 token ≈ 4 characters)
2. Estimate number of completion tokens needed
3. Calculate cost as: (prompt_price * estimated_prompt_tokens) + (completion_price * estimated_completion_tokens)

RESPONSE FORMAT (RESPOND WITH VALID JSON ONLY - NO MARKUP, NO EXTRA TEXT):
{
  "taskType": "one of: coding, writing, analysis, translation, general, research, debugging, architecture",
  "complexity": "one of: low, medium, high",
  "reasoningNeeded": true or false,
  "estimatedPromptTokens": number (estimate of prompt length in tokens),
  "estimatedCompletionTokens": number (estimate of needed completion tokens),
  "estimatedCost": number (calculated cost in USD),
  "selectedModel": "model-id-from-catalog",
  "confidence": number 0-100,
  "reason": "detailed explanation of your decision, including tradeoffs considered",
  "fallbackModel": "reliable fallback model-id (e.g., openai/gpt-4o-mini)",
  "alternatives": [
    {
      "model": "model-id-1",
      "status": "Rejected",
      "reason": "why you rejected this model"
    },
    {
      "model": "model-id-2",
      "status": "Rejected",
      "reason": "why you rejected this model"
    },
    {
      "model": "model-id-3",
      "status": "Considered",
      "reason": "brief note why it was considered but not selected"
    }
  ]
}

CRITICAL REQUIREMENTS:
- "alternatives" array MUST have at least 2 entries
- You MUST compare at least three models total
- Return ONLY the raw JSON - no extra text!
- Calculate "estimatedCost" accurately using the provided pricing!
- Do NOT use markdown or code blocks!`;

    try {
      const response = await this.openRouterService.callModel(
        ROUTER_MODEL,
        `${systemPrompt}\n\nUSER PROMPT:\n${prompt}`,
        { temperature: 0.15, maxTokens: 1500 }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Router agent returned no content");
      }

      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Failed to parse router response as JSON");
      }

      const validated = RouterAgentResponseSchema.parse(parsed);

      const modelIds = topCandidates.map(m => m.id);
      if (!modelIds.includes(validated.selectedModel)) {
        validated.selectedModel = fallbackModel.id;
      }

      if (!modelIds.includes(validated.fallbackModel)) {
        validated.fallbackModel = fallbackModel.id;
      }

      const selectedModelData = getModelById(validated.selectedModel) || fallbackModel;
      validated.estimatedCost =
        (parseFloat(selectedModelData.pricing.prompt) * validated.estimatedPromptTokens) +
        (parseFloat(selectedModelData.pricing.completion) * validated.estimatedCompletionTokens);

      return validated;
    } catch (error) {
      console.error("Router agent failed, using fallback:", error);
      return createFallbackResponse(prompt, fallbackModel);
    }
  }
}
