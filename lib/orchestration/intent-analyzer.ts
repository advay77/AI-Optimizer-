import type { IntentAnalysis, PrimaryTaskType } from "@/types";
import { RouterAgent } from "@/lib/routerAgent";
import { OpenRouterService } from "@/lib/openrouter";

/**
 * Intent Analyzer: STEP 1-2 of Decision Framework
 * 
 * STEP 1 — Understand the User Intent:
 * - What is the user actually asking?
 * - What is the final deliverable?
 * - What is NOT required?
 * - What information is already available?
 * - What additional information is needed?
 *
 * STEP 2 — Classify the Task:
 * - Identify ONE primary task category
 * - Never assume requirements that the user did not request
 */

const TASK_CLASSIFICATION_PROMPT = (userPrompt: string) => `
You are an expert task analyzer. Your job is to understand the user's request and classify it precisely.

User Request:
"${userPrompt}"

Analyze this request and respond with ONLY a valid JSON object (no markdown, no code blocks):
{
  "userQuestion": "Brief summary of what the user is asking",
  "primaryDeliverable": "Single sentence describing the final deliverable",
  "taskType": "One of: static_html, react_app, fullstack_app, backend_api, dashboard, research, documentation, pdf_analysis, image_analysis, technical_writing, marketing, presentation",
  "complexity": "low | medium | high",
  "isComplete": "true if the request has all necessary info, false if clarification needed",
  "missingInfo": ["List of info needed to proceed, or empty array"],
  "availableContext": ["List of context/constraints already provided, or empty array"],
  "estimatedAgentCount": "Number between 1 and 3 (Engineering, R&D, or Marketing)"
}
`;

export class IntentAnalyzer {
  private routerAgent: RouterAgent;
  private openRouterService: OpenRouterService;

  constructor() {
    this.routerAgent = new RouterAgent();
    this.openRouterService = new OpenRouterService();
  }

  /**
   * Analyze user intent and classify the task
   * Uses router to pick best reasoning model
   */
  async analyze(userPrompt: string): Promise<IntentAnalysis> {
    console.log(`[v0] IntentAnalyzer.analyze() starting`);
    console.log(`[v0] User prompt: "${userPrompt.substring(0, 100)}..."`);

    // STEP 1-2: Route to best reasoning model
    const routingDecision = await this.routerAgent.route(userPrompt);
    const selectedModel = routingDecision.selectedModel;

    console.log(`[v0] IntentAnalyzer selected model: ${selectedModel}`);

    try {
      // Call the selected model with classification prompt
      const response = await this.openRouterService.callModel(
        selectedModel,
        this.buildClassificationMessages(userPrompt),
        {
          temperature: 0.3, // Lower temperature for consistent classification
          maxTokens: 512,
        }
      );

      // Parse the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from model");
      }

      // Extract JSON from response (might be wrapped in code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from model response");
      }

      const analysis = JSON.parse(jsonMatch[0]) as IntentAnalysis;

      console.log(`[v0] IntentAnalyzer result:`, {
        taskType: analysis.taskType,
        complexity: analysis.complexity,
        isComplete: analysis.isComplete,
      });

      return analysis;
    } catch (error) {
      console.error(`[v0] IntentAnalyzer error:`, error);
      throw new Error(`Failed to analyze intent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build messages for classification
   */
  private buildClassificationMessages(userPrompt: string) {
    return [
      {
        role: "system" as const,
        content: `You are an expert task analyzer. Your job is to understand the user's request and classify it precisely. Always respond with ONLY a valid JSON object (no markdown, no code blocks, no explanation).`,
      },
      {
        role: "user" as const,
        content: TASK_CLASSIFICATION_PROMPT(userPrompt),
      },
    ];
  }
}

/**
 * Convenience function to create and analyze
 */
export const analyzeIntent = async (
  userPrompt: string
): Promise<IntentAnalysis> => {
  const analyzer = new IntentAnalyzer();
  return analyzer.analyze(userPrompt);
};
