import { OpenRouterService } from "./openrouter";
import type { ModelCapabilities, UnifiedModel } from "@/types";
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

  // Filter models with valid pricing
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

    // Set up auto-refresh
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
    return getModelCatalog()[0]; // Fallback to first model if our fallback isn't available
  }
  return fallback;
}

export function getTopCandidates(): UnifiedModel[] {
  const catalog = getModelCatalog();
  
  // First prioritize models with custom capabilities (we know about them)
  const withKnownCapabilities = catalog.filter(m => m.capabilities.source !== "Default capabilities");
  const sorted = [...withKnownCapabilities].sort((a, b) => {
    const costA = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
    const costB = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
    return costA - costB;
  });
  
  // Take top candidates, fill rest with other models sorted by cost
  const rest = catalog
    .filter(m => !withKnownCapabilities.find(km => km.id === m.id))
    .sort((a, b) => {
      const costA = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
      const costB = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
      return costA - costB;
    });
  
  return [...sorted, ...rest].slice(0, TOP_CANDIDATES_COUNT);
}

export async function refreshModelCatalog(): Promise<void> {
  const newCatalog = await fetchAndMergeModels();
  modelCatalog = newCatalog;
  console.log(`Model catalog manually refreshed with ${modelCatalog.length} models`);
}
