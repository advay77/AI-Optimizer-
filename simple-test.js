
import { initializeModelCatalog, getRouterCandidates } from "./lib/modelCatalog.js";
import { RouterAgent } from "./lib/routerAgent.js";

async function test() {
  console.log("=== STARTING ===");
  await initializeModelCatalog();

  console.log("\n=== CANDIDATES ===");
  const candidates = getRouterCandidates();
  console.log(candidates);

  console.log("\n=== ROUTER PROMPT EXAMPLE ===");
  // Duplicate the router prompt building logic from routerAgent.ts for debugging
  const systemPrompt = `You are Orion, an AI routing engine. Choose the best model for the task.

CANDIDATE MODELS (only choose from these IDs):
${candidates.map(c => `- ID: ${c.id}\n  Cost Tier: ${c.costTier}\n  Context: ${c.contextWindow}\n  Tasks: ${c.preferredTasks.join(", ")}\n  Notes: ${c.notes}`).join("\n")}

RULES:
- Compare at least 3 candidates
- Simple tasks (chat/translation) → Very Low/Low cost
- Coding → Low/Medium cost
- Architecture/research → Medium/High cost
- No extra text, only JSON

RESPONSE FORMAT:
{
  "taskType": "coding|writing|analysis|translation|general|research|debugging|architecture",
  "complexity": "low|medium|high",
  "reasoningNeeded": true|false,
  "selectedModel": "model-id",
  "reason": "why this model",
  "alternatives": [{"model": "id", "status": "Rejected|Considered", "reason": "why"}]
}`;
  console.log(systemPrompt);
}

test().catch(console.error);
