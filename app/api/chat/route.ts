import { NextResponse } from "next/server";
import { initializeModelCatalog, getModelById, getFallbackModel } from "@/lib/modelCatalog";
import { RouterAgent } from "@/lib/routerAgent";
import { OpenRouterService } from "@/lib/openrouter";

const FALLBACK_CHAIN = [
  "meta-llama/llama-3.1-70b-instruct",
  "google/gemini-2.0-flash-exp",
  "openai/gpt-4o-mini"
];

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    await initializeModelCatalog();
    const routerAgent = new RouterAgent();
    const routerDecision = await routerAgent.route(prompt);
    const maxTokens = Math.max(routerDecision.estimatedCompletionTokens, 2048); // Give enough tokens for full answers!

    const openRouterService = new OpenRouterService();
    let modelResponse;
    let finalModelUsed = routerDecision.selectedModel;

    // Try selected model first
    try {
      modelResponse = await openRouterService.callModel(
        routerDecision.selectedModel,
        prompt,
        { maxTokens }
      );
    } catch (error) {
      console.error(`Failed to use ${routerDecision.selectedModel}, trying fallback chain...`, error);
      
      // Try fallback chain in order
      for (const fallbackModelId of FALLBACK_CHAIN) {
        try {
          console.log(`Trying fallback model: ${fallbackModelId}`);
          modelResponse = await openRouterService.callModel(
            fallbackModelId,
            prompt,
            { maxTokens }
          );
          finalModelUsed = fallbackModelId;
          break;
        } catch (fallbackError) {
          console.error(`Fallback model ${fallbackModelId} failed:`, fallbackError);
          continue;
        }
      }

      // If all fallbacks failed, try original fallback model
      if (!modelResponse) {
        console.log("All fallbacks failed, trying original fallback model");
        const finalFallback = getFallbackModel();
        modelResponse = await openRouterService.callModel(
          finalFallback.id,
          prompt,
          { maxTokens }
        );
        finalModelUsed = finalFallback.id;
      }
    }

    const answer = modelResponse.choices[0]?.message?.content || "";

    return NextResponse.json({
      routerDecision: {
        ...routerDecision,
        selectedModel: finalModelUsed,
      },
      answer,
    });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
