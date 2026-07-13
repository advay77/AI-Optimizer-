import { Orchestrator } from "@/lib/orchestration/orchestrator";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/orchestrate
 * 
 * Main orchestration endpoint
 * Executes the 10-step Decision Framework pipeline
 * 
 * Request:
 * {
 *   "prompt": "User's request"
 * }
 * 
 * Response:
 * {
 *   "answer": "Generated answer",
 *   "artifacts": [...],
 *   "metrics": {...},
 *   "executionReport": {...},
 *   "confidence": 85
 * }
 */

export async function POST(request: NextRequest) {
  try {
    console.log(`[v0] POST /api/orchestrate`);

    // Parse request
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' field" },
        { status: 400 }
      );
    }

    if (prompt.length < 10) {
      return NextResponse.json(
        { error: "Prompt is too short (minimum 10 characters)" },
        { status: 400 }
      );
    }

    // Create orchestrator
    const orchestrator = new Orchestrator();
    const executionId = orchestrator.getExecutionId();

    console.log(`[v0] Orchestration starting with ID: ${executionId}`);

    // Run orchestration
    const response = await orchestrator.orchestrate(prompt);

    // Return response
    return NextResponse.json(
      {
        ...response,
        executionId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[v0] /api/orchestrate error:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Orchestration failed",
        executionId: "",
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/orchestrate
 * CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
