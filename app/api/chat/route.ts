import { NextResponse } from "next/server";
import { initializeModelCatalog, getTopCandidates, getModelById, getFallbackModel } from "@/lib/modelCatalog";
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
    const topCandidates = getTopCandidates();
    const routerAgent = new RouterAgent();
    const routerDecision = await routerAgent.route(prompt, topCandidates);

    let selectedModel = getModelById(routerDecision.selectedModel);
    if (!selectedModel) {
      selectedModel = getFallbackModel();
    }

    const openRouterService = new OpenRouterService();
    let modelResponse;
    let finalModelUsed = selectedModel.id;

    try {
      modelResponse = await openRouterService.callModel(
        selectedModel.id,
        prompt,
        { maxTokens: routerDecision.estimatedCompletionTokens }
      );
    } catch (error) {
      console.error(`Failed to use ${selectedModel.id}, trying fallback...`, error);
      const fallback = getFallbackModel();
      finalModelUsed = fallback.id;
      modelResponse = await openRouterService.callModel(
        fallback.id,
        prompt,
        { maxTokens: routerDecision.estimatedCompletionTokens }
      );
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
