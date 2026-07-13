/**
 * Test script to verify Orion orchestration
 * Run with: npx ts-node test-orchestrator.ts
 */

import { Orchestrator } from "./lib/orchestration/orchestrator";

async function testOrchestrator() {
  console.log("=== Orion Orchestration Test ===\n");

  try {
    // Test prompts
    const testPrompts = [
      "Build a React dashboard with authentication and a database",
      "Write a comprehensive README for a Node.js project",
      "Analyze this PDF and extract key information",
    ];

    for (const prompt of testPrompts) {
      console.log(`\n--- Testing: "${prompt.substring(0, 50)}..." ---`);

      const orchestrator = new Orchestrator();
      console.log(`Execution ID: ${orchestrator.getExecutionId()}`);

      // Subscribe to dashboard updates
      const unsubscribe = orchestrator.subscribeDashboard((update) => {
        console.log(`  Dashboard: ${update.currentAgent} - ${update.status}`);
      });

      try {
        // Note: This will fail without proper API keys, but tests the structure
        const response = await orchestrator.orchestrate(prompt);
        console.log(`✓ Response generated (${response.artifacts.length} artifacts)`);
      } catch (error) {
        console.log(`✗ Orchestration error (expected without API keys):`, 
          error instanceof Error ? error.message : String(error));
      }

      unsubscribe();
    }

    console.log("\n=== Test Complete ===");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

testOrchestrator().catch(console.error);
