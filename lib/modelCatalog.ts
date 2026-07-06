import { OpenRouterService } from "./openrouter";
import type { ModelCapabilities, UnifiedModel, RouterCandidate, CostTier } from "@/types";
import fs from "fs";
import path from "path";

let modelCatalog: UnifiedModel[] = [];
let isCatalogInitialized = false;
let refreshInterval: NodeJS.Timeout | null = null;

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const TOP_CANDIDATES_COUNT = 15;
const FALLBACK_MODEL = "openai/gpt-4o-mini";

const defaultCapabilities: ModelCapabilities = {
  preferredTasks: ["general"],
  notes: "General-purpose model suitable for most tasks.",
  source: "Default capabilities",
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
  const metrics = [
    caps.reasoning !== undefined ? `Reasoning: ${caps.reasoning}/100` : '',
    caps.coding !== undefined ? `Coding: ${caps.coding}/100` : '',
    caps.instructionFollowing !== undefined ? `Instruction Following: ${caps.instructionFollowing}/100` : '',
    caps.jsonReliability !== undefined ? `JSON Reliability: ${caps.jsonReliability}/100` : '',
    caps.longContext !== undefined ? `Long Context: ${caps.longContext}/100` : '',
    caps.multilingual !== undefined ? `Multilingual: ${caps.multilingual}/100` : '',
    caps.multimodal !== undefined ? `Multimodal: ${caps.multimodal}` : '',
    caps.latency !== undefined ? `Latency: ${caps.latency}` : '',
  ].filter(Boolean).join(", ");

  const capabilityNotes = `${metrics}. Notes: ${caps.notes}`;

  return {
    id: model.id,
    provider: extractProvider(model.id),
    costTier: calculateCostTier(model.pricing.prompt, model.pricing.completion),
    contextWindow: model.context_length,
    preferredTasks: getDynamicPreferredTasks(model.capabilities),
    notes: model.capabilities.notes,
    capabilityNotes,
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

async function fetchAndMergeModels(): Promise<UnifiedModel[]> {
  const openRouterService = new OpenRouterService();
  const [openRouterModels, capabilities] = await Promise.all([
    openRouterService.fetchModels(),
    loadCapabilities(),
  ]);

  return openRouterModels
    .filter(model => model.pricing && model.pricing.prompt && model.pricing.completion)
    .map((model) => ({
      ...model,
      capabilities: capabilities[model.id] || defaultCapabilities,
    }));
}

export async function initializeModelCatalog(): Promise<void> {
  if (isCatalogInitialized) {
    return;
  }

  try {
    modelCatalog = await fetchAndMergeModels();
    isCatalogInitialized = true;
    console.log(`Model catalog initialized with ${modelCatalog.length} models`);

    if (!refreshInterval) {
      refreshInterval = setInterval(async () => {
        try {
          console.log("Refreshing model catalog...");
          const newCatalog = await fetchAndMergeModels();
          modelCatalog = newCatalog;
          console.log(`Model catalog refreshed with ${modelCatalog.length} models`);
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
    return getModelCatalog()[0];
  }
  return fallback;
}

export function getTopCandidates(): UnifiedModel[] {
  const catalog = getModelCatalog();
  
  const withKnownCapabilities = catalog.filter(m => m.capabilities.source !== "Default capabilities");
  const sorted = [...withKnownCapabilities].sort((a, b) => {
    const costA = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
    const costB = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
    return costA - costB;
  });
  
  const rest = catalog
    .filter(m => !withKnownCapabilities.find(km => km.id === m.id))
    .sort((a, b) => {
      const costA = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
      const costB = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
      return costA - costB;
    });
  
  return [...sorted, ...rest].slice(0, TOP_CANDIDATES_COUNT);
}

export function getRouterCandidates(): RouterCandidate[] {
  return getTopCandidates().map(buildRouterCandidate);
}

export async function refreshModelCatalog(): Promise<void> {
  const newCatalog = await fetchAndMergeModels();
  modelCatalog = newCatalog;
  console.log(`Model catalog manually refreshed with ${modelCatalog.length} models`);
}
