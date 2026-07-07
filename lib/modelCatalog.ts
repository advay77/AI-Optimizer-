import { OpenRouterService } from "./openrouter";
import type { ModelCapabilities, UnifiedModel, RouterCandidate, CostTier } from "@/types";
import fs from "fs";
import path from "path";

let modelCatalog: UnifiedModel[] = [];
let isCatalogInitialized = false;
let refreshInterval: NodeJS.Timeout | null = null;

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const TOP_CANDIDATES_COUNT = 8;
const FALLBACK_MODEL = "openai/gpt-4o-mini";
const ALLOW_FREE_MODELS = process.env.ALLOW_FREE_MODELS === "true";
export const FALLBACK_CHAIN = [
  "meta-llama/llama-3.1-70b-instruct",
  "google/gemini-2.0-flash-exp",
  "openai/gpt-4o-mini"
];

const defaultCapabilities: ModelCapabilities = {
  preferredTasks: ["general"],
  notes: "General-purpose model suitable for most tasks.",
  source: "Default capabilities",
  benchmarkScore: 0
};

function calculateCostTier(promptPrice: string, completionPrice: string): CostTier {
  const totalPrice = parseFloat(promptPrice) + parseFloat(completionPrice);
  
  if (totalPrice <= 0.00001) return "Very Low";
  if (totalPrice <= 0.0001) return "Low";
  if (totalPrice <= 0.001) return "Medium";
  return "High";
}

function extractProvider(modelId: string): string {
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[0] : "Unknown";
}

function getDynamicPreferredTasks(capabilities: ModelCapabilities): string[] {
  if (capabilities.preferredTasks) {
    return capabilities.preferredTasks;
  }
  const tasks: string[] = [];
  if (capabilities.coding && capabilities.coding >= 85) tasks.push("coding");
  if (capabilities.reasoning && capabilities.reasoning >= 85) tasks.push("complex_reasoning");
  if (capabilities.instructionFollowing && capabilities.instructionFollowing >= 85) tasks.push("instruction_following");
  if (capabilities.longContext && capabilities.longContext >= 85) tasks.push("long_context");
  if (capabilities.multilingual && capabilities.multilingual >= 85) tasks.push("translation");
  if (capabilities.multimodal) tasks.push("multimodal");
  if (tasks.length === 0) tasks.push("general");
  return tasks;
}

export function buildRouterCandidate(model: UnifiedModel): RouterCandidate {
  const caps = model.capabilities;
  const costTier = calculateCostTier(model.pricing.prompt, model.pricing.completion);
  
  const compactNotes = [
    `r=${caps.reasoning ?? 50}`,
    `c=${caps.coding ?? 50}`,
    `i=${caps.instructionFollowing ?? 70}`,
    `j=${caps.jsonReliability ?? 70}`,
    `ctx=${model.context_length}`,
    `lat=${caps.latency ?? "medium"}`,
    `cost=${costTier}`
  ].join(",");

  return {
    id: model.id,
    provider: extractProvider(model.id),
    costTier,
    contextWindow: model.context_length,
    preferredTasks: getDynamicPreferredTasks(model.capabilities),
    notes: compactNotes,
    capabilityNotes: compactNotes,
  };
}

async function loadCapabilities(): Promise<Record<string, ModelCapabilities>> {
  try {
    const capabilitiesPath = path.join(process.cwd(), "config", "capabilities.json");
    const capabilitiesData = fs.readFileSync(capabilitiesPath, "utf-8");
    return JSON.parse(capabilitiesData);
  } catch (error) {
    console.warn("Could not load capabilities.json, using default capabilities:", error);
    return {};
  }
}

function isModelEligible(model: UnifiedModel, capabilities: Record<string, ModelCapabilities>): boolean {
  // Check if model uses default capabilities (exclude those)
  if (!capabilities[model.id]) return false;
  
  const caps = model.capabilities;
  
  // Check required fields
  if (caps.benchmarkScore === undefined || caps.benchmarkScore === null) return false;
  if (caps.reasoning === undefined || caps.reasoning === null) return false;
  if (caps.coding === undefined || caps.coding === null) return false;
  
  // Check deprecated (OpenRouter often includes deprecated in description)
  if (model.description && model.description.toLowerCase().includes("deprecated")) return false;
  
  // Check free models
  if (!ALLOW_FREE_MODELS && model.id.includes(":free")) return false;
  
  return true;
}

async function fetchAndMergeModels(): Promise<{ catalog: UnifiedModel[], capabilities: Record<string, ModelCapabilities> }> {
  const openRouterService = new OpenRouterService();
  const [openRouterModels, capabilities] = await Promise.all([
    openRouterService.fetchModels(),
    loadCapabilities(),
  ]);

  const catalog = openRouterModels
    .filter(model => model.pricing && model.pricing.prompt && model.pricing.completion)
    .map((model) => ({
      ...model,
      capabilities: capabilities[model.id] || defaultCapabilities,
    }));
    
  return { catalog, capabilities };
}

function validateCatalog(catalog: UnifiedModel[], capabilities: Record<string, ModelCapabilities>): void {
  const capabilityModelIds = Object.keys(capabilities);
  const catalogModelIds = catalog.map(m => m.id);
  
  // Warn if capability models are missing from catalog
  for (const capabilityId of capabilityModelIds) {
    if (!catalogModelIds.includes(capabilityId)) {
      console.warn(`WARNING: Model in capabilities.json not found in OpenRouter catalog: ${capabilityId}`);
    }
  }
  
  // Warn if premium models missing benchmarkScore
  for (const model of catalog) {
    if (capabilities[model.id] && !capabilities[model.id].benchmarkScore) {
      console.warn(`WARNING: Model ${model.id} has no benchmarkScore in capabilities.json`);
    }
  }
}

function getEligibleCandidates(catalog: UnifiedModel[], capabilities: Record<string, ModelCapabilities>): UnifiedModel[] {
  return catalog
    .filter(m => isModelEligible(m, capabilities))
    .sort((a, b) => {
      const scoreA = calculateWeightedScore(a);
      const scoreB = calculateWeightedScore(b);
      return scoreB - scoreA;
    });
}

let cachedCapabilities: Record<string, ModelCapabilities> = {};

export async function initializeModelCatalog(): Promise<void> {
  if (isCatalogInitialized) {
    return;
  }

  try {
    const { catalog, capabilities } = await fetchAndMergeModels();
    modelCatalog = catalog;
    cachedCapabilities = capabilities;
    isCatalogInitialized = true;
    
    // Run catalog validation
    validateCatalog(catalog, capabilities);
    
    // Print final router candidate pool
    const eligible = getEligibleCandidates(catalog, capabilities);
    console.log(`Model catalog initialized with ${catalog.length} models, ${eligible.length} eligible for routing`);
    console.log("Eligible router candidates (top 10):", eligible.slice(0, 10).map(m => m.id));

    if (!refreshInterval) {
      refreshInterval = setInterval(async () => {
        try {
          console.log("Refreshing model catalog...");
          const { catalog: newCatalog, capabilities: newCapabilities } = await fetchAndMergeModels();
          modelCatalog = newCatalog;
          cachedCapabilities = newCapabilities;
          
          // Re-validate on refresh
          validateCatalog(newCatalog, newCapabilities);
          
          const newEligible = getEligibleCandidates(newCatalog, newCapabilities);
          console.log(`Model catalog refreshed with ${newCatalog.length} models, ${newEligible.length} eligible for routing`);
        } catch (error) {
          console.error("Failed to refresh model catalog, keeping existing catalog:", error);
        }
      }, REFRESH_INTERVAL_MS);
    }
  } catch (error) {
    console.error("Failed to initialize model catalog:", error);
    throw error;
  }
}

export function getModelCatalog(): UnifiedModel[] {
  if (!isCatalogInitialized) {
    throw new Error("Model catalog not initialized. Call initializeModelCatalog first.");
  }
  return modelCatalog;
}

export function getModelById(modelId: string): UnifiedModel | undefined {
  return getModelCatalog().find((model) => model.id === modelId);
}

export function getFallbackModel(): UnifiedModel {
  const fallback = getModelById(FALLBACK_MODEL);
  if (!fallback) {
    return getEligibleCandidates(modelCatalog, cachedCapabilities)[0];
  }
  return fallback;
}

function calculateLogarithmicCostScoreForCatalog(model: UnifiedModel): number {
  // Calculate total cost per 1M tokens (prompt + completion)
  const promptCost = parseFloat(model.pricing.prompt) * 1000000;
  const completionCost = parseFloat(model.pricing.completion) * 1000000;
  const totalCost = promptCost + completionCost;

  // Use logarithmic scale to penalize very expensive models smoothly
  // $0 → 100, $1 → ~80, $10 → ~60, $100 → ~40
  const logScore = 100 - Math.log10(1 + totalCost) * 30;
  return Math.max(0, Math.min(100, logScore));
}

function calculateWeightedScore(model: UnifiedModel): number {
  const caps = model.capabilities;
  const reasoning = caps.reasoning ?? 50;
  const coding = caps.coding ?? 50;
  const instruction = caps.instructionFollowing ?? 70;
  const jsonReliability = caps.jsonReliability ?? 70;
  const contextLength = model.context_length >= 128000 ? 100 : model.context_length >= 32000 ? 85 : model.context_length >= 8000 ? 70 : 50;
  const latencyScore = caps.latency === "low" ? 100 : caps.latency === "medium" ? 70 : 40;
  
  const costScore = calculateLogarithmicCostScoreForCatalog(model);
  const benchmarkScore = caps.benchmarkScore ?? 70;

  // Normalized weights (sums exactly to 1.0)
    const score = 
      reasoning * 0.28 + 
      coding * 0.23 + 
      instruction * 0.14 + 
      jsonReliability * 0.09 + 
      contextLength * 0.07 + 
      latencyScore * 0.05 + 
      benchmarkScore * 0.05 +
      costScore * 0.09;

  return score;
}

export function getTopCandidates(): UnifiedModel[] {
  const catalog = getModelCatalog();
  const eligible = getEligibleCandidates(catalog, cachedCapabilities);
  return eligible.slice(0, TOP_CANDIDATES_COUNT);
}

export function getRouterCandidates(): RouterCandidate[] {
  return getTopCandidates().map(buildRouterCandidate);
}

// Also export eligible candidates for RouterAgent to use!
export function getEligibleRouterCandidates(): UnifiedModel[] {
  const catalog = getModelCatalog();
  return getEligibleCandidates(catalog, cachedCapabilities);
}

export async function refreshModelCatalog(): Promise<void> {
  const { catalog: newCatalog, capabilities: newCapabilities } = await fetchAndMergeModels();
  modelCatalog = newCatalog;
  cachedCapabilities = newCapabilities;
  console.log(`Model catalog manually refreshed with ${newCatalog.length} models`);
}
