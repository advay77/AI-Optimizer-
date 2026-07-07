import { NextResponse } from "next/server";
import { initializeModelCatalog, getModelById, getFallbackModel, FALLBACK_CHAIN } from "@/lib/modelCatalog";
import { RouterAgent } from "@/lib/routerAgent";
import { OpenRouterService } from "@/lib/openrouter";

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
    const maxTokens = Math.max(routerDecision.estimatedCompletionTokens, 1024); // Reduce max tokens to fit budget!

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
        try {
          console.log("All fallbacks failed, trying original fallback model");
          const finalFallback = getFallbackModel();
          modelResponse = await openRouterService.callModel(
            finalFallback.id,
            prompt,
            { maxTokens }
          );
          finalModelUsed = finalFallback.id;
        } catch (finalFallbackError) {
          console.error("All models failed:", finalFallbackError);
          return NextResponse.json(
            { error: "All AI models are currently unavailable. Please try again later." },
            { status: 503 }
          );
        }
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
