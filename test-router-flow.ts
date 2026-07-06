
import { RouterAgent } from "./lib/routerAgent";
import { initializeModelCatalog, getRouterCandidates } from "./lib/modelCatalog";

// Test prompts to run through the flow
const testPrompts = [
  "Hello, how are you?",
  "Translate 'Hello World' to French",
  "Write a Python function to calculate fibonacci",
  "Design a REST API architecture for a blog",
];

async function testFlow(prompt: string) {
  console.log("\n=== TESTING PROMPT: " + prompt + " ===");

  try {
    await initializeModelCatalog();
    const routerCandidates = getRouterCandidates();
    console.log("\n[1] ROUTER CANDIDATES:");
    console.log(routerCandidates.map(c => `- ${c.id} (${c.costTier})`));

    const agent = new RouterAgent();
    // Let's monkey-patch the agent to log internal details
    const originalCallModel = agent['openRouterService'].callModel;
    agent['openRouterService'].callModel = async (modelId: string, prompt: string, options: any) => {
      console.log("\n[2] ROUTER PROMPT SENT:");
      console.log(prompt);
      const response = await originalCallModel.call(agent['openRouterService'], modelId, prompt, options);
      console.log("\n[3] OPENROUTER RESPONSE:");
      console.log(response);
      console.log("\n[4] RAW CONTENT:");
      console.log(response.choices[0]?.message?.content);
      return response;
    };

    const result = await agent.route(prompt);
    console.log("\n[5] FINAL ROUTER DECISION:");
    console.log(result);
  } catch (error) {
    console.error("\n[ERROR] FAILURE DURING FLOW:");
    console.error(error);
  }
}

async function main() {
  console.log("=== STARTING ROUTER FLOW TEST ===");
  for (const prompt of testPrompts) {
    await testFlow(prompt);
  }
  console.log("\n=== ALL TESTS COMPLETE ===");
}

main();
