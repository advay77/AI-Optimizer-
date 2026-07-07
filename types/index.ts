export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

export interface ModelCapabilities {
  benchmarkScore?: number;
  preferredTasks?: string[];
  reasoning?: number;
  coding?: number;
  instructionFollowing?: number;
  jsonReliability?: number;
  longContext?: number;
  multilingual?: number;
  multimodal?: boolean;
  latency?: "low" | "medium" | "high";
  notes: string;
  source: string;
}

export interface UnifiedModel extends OpenRouterModel {
  capabilities: ModelCapabilities;
}

export type CostTier = "Very Low" | "Low" | "Medium" | "High";

export interface RouterCandidate {
  id: string;
  provider: string;
  costTier: CostTier;
  contextWindow: number;
  preferredTasks: string[];
  notes: string;
  capabilityNotes: string;
}

export interface CallModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallModelResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AlternativeModel {
  model: string;
  status: "Rejected" | "Considered";
  reason: string;
  score: number;
}

export type TaskType = "coding" | "writing" | "analysis" | "translation" | "general" | "research" | "debugging" | "architecture" | "simple_tasks" | "content_generation" | "complex_reasoning" | "simple_coding" | "multimodal";

export interface RouterAgentResponse {
  taskType: TaskType;
  complexity: "low" | "medium" | "high";
  reasoningNeeded: boolean;
  selectedModel: string;
  reason: string;
  alternatives: AlternativeModel[];
  qualityScore: number;
  costScore: number;
  valueScore: number;
  benchmarkScore: number;
  estimatedLatency: "low" | "medium" | "high";
  tradeoffAnalysis: string;
}

export interface FinalRouterDecision extends RouterAgentResponse {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCost: number;
  confidence: number;
  fallbackModel: string;
}
