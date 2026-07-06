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
  preferredTasks: string[];
  notes: string;
  source: string;
}

export interface UnifiedModel extends OpenRouterModel {
  capabilities: ModelCapabilities;
}

export interface CallModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
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
}

export interface RouterAgentResponse {
  taskType: string;
  complexity: "low" | "medium" | "high";
  reasoningNeeded: boolean;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCost: number;
  selectedModel: string;
  confidence: number;
  reason: string;
  fallbackModel: string;
  alternatives: AlternativeModel[];
}
