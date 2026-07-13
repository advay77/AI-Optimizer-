import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/execution/[id]
 * 
 * Fetch execution status and metrics
 * (Currently a placeholder - in production, would query execution state)
 */

// In-memory execution tracking (replace with database in production)
const executionStates = new Map<
  string,
  {
    status: string;
    progress: number;
    currentAgent?: string;
    estimatedTime?: number;
  }
>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const executionId = id;

    if (!executionId) {
      return NextResponse.json(
        { error: "Missing execution ID" },
        { status: 400 }
      );
    }

    // Get execution state (placeholder)
    const state = executionStates.get(executionId) || {
      status: "not_found",
      progress: 0,
    };

    return NextResponse.json(
      {
        executionId,
        ...state,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[v0] /api/execution error:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch execution",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execution/[id]/cancel
 * Cancel a running execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const executionId = id;
    const action = request.nextUrl.searchParams.get("action");

    if (action === "cancel") {
      // Remove execution state
      executionStates.delete(executionId);

      return NextResponse.json(
        {
          executionId,
          status: "cancelled",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error(`[v0] /api/execution POST error:`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}
