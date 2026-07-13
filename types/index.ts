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

// New types for the modular router
export interface PromptProfile {
  taskCategory: TaskType;
  complexity: "low" | "medium" | "high";
  estimatedTokenUsage: number;
  reasoningRequirement: "low" | "medium" | "high";
  codingRequirement: "low" | "medium" | "high";
  multimodalRequirement: boolean;
  longContextRequirement: number; // minimum required context window
  latencySensitivity: "low" | "medium" | "high";
  costSensitivity: "low" | "medium" | "high";
  taskAmbiguity: number; // 0-100
}

export interface RejectedModel {
  model: string;
  reason: string;
}

export interface WeightedScore {
  taskFit: number;
  capability: number;
  benchmark: number;
  latency: number;
  context: number;
  cost: number;
  total: number;
}

export interface TaskWeights {
  [key: string]: number;
}

export interface ScoredCandidate {
  model: UnifiedModel;
  scores: WeightedScore;
  totalScore: number;
}

export interface RouterDecision {
  promptProfile: PromptProfile;
  eligibleModels: string[];
  rejectedModels: RejectedModel[];
  scoringBreakdown: { model: string; scores: WeightedScore }[];
  tieBreakReason: string | null;
  finalSelectedModel: string;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: "low" | "medium" | "high";
  tradeoffAnalysis: string;
}

// ─── Orchestration Types ───────────────────────────────────────────────

export type PrimaryTaskType = 
  | "static_html"
  | "react_app"
  | "fullstack_app"
  | "backend_api"
  | "dashboard"
  | "research"
  | "documentation"
  | "pdf_analysis"
  | "image_analysis"
  | "technical_writing"
  | "marketing"
  | "presentation";

export interface CapabilityFlags {
  frontend: boolean;
  backend: boolean;
  api: boolean;
  database: boolean;
  authentication: boolean;
  vision: boolean;
  pdf_analysis: boolean;
  research: boolean;
  documentation: boolean;
  marketing: boolean;
  artifact_generation: boolean;
}

export interface IntentAnalysis {
  userQuestion: string;
  primaryDeliverable: string;
  taskType: PrimaryTaskType;
  complexity: "low" | "medium" | "high";
  isComplete: boolean;
  missingInfo: string[];
  availableContext: string[];
  estimatedAgentCount: number;
}

export interface AgentSelection {
  engineering: boolean;
  research: boolean;
  marketing: boolean;
}

export interface SkillMatrix {
  engineering: string[];
  research: string[];
  marketing: string[];
}

export interface DecisionFrameworkOutput {
  intentAnalysis: IntentAnalysis;
  capabilities: CapabilityFlags;
  selectedAgents: AgentSelection;
  skillMatrix: SkillMatrix;
  executionStrategy: "parallel" | "sequential" | "mixed";
  estimatedCost: number;
  estimatedTokens: number;
  confidence: number;
}

export interface ExecutionTask {
  agentId: string;
  skill: string;
  priority: "critical" | "high" | "normal" | "low";
  dependsOn: string[];
  isParallelizable: boolean;
}

export interface ExecutionPlan {
  tasks: ExecutionTask[];
  parallelGroups: ExecutionTask[][];
  sequentialOrder: string[];
  estimatedCost: number;
  estimatedLatency: "low" | "medium" | "high";
  timelineEstimate: number; // milliseconds
}

export interface MemoryStore {
  intent?: IntentAnalysis;
  planning?: DecisionFrameworkOutput;
  research?: Record<string, unknown>;
  engineering?: Record<string, unknown>;
  marketing?: Record<string, unknown>;
  artifacts?: ArtifactManifest;
  metrics?: ExecutionMetrics;
}

export interface ArtifactFile {
  path: string;
  type: "code" | "config" | "document" | "data" | "media";
  content: string;
  language?: string;
  size: number;
}

export interface ArtifactManifest {
  files: ArtifactFile[];
  validated: boolean;
  validationErrors: string[];
  repairAttempts: number;
}

export interface ExecutionMetrics {
  startTime: number;
  endTime?: number;
  totalLatency?: number;
  agentsExecuted: string[];
  skillsExecuted: string[];
  totalTokensUsed: number;
  totalCost: number;
  confidenceScore: number;
  successRate: number;
}

export interface OrchestratorResponse {
  answer: string;
  artifacts: ArtifactFile[];
  executionReport: {
    agentsUsed: string[];
    skillsUsed: string[];
    totalTime: number;
    totalCost: number;
  };
  metrics: ExecutionMetrics;
  confidence: number;
}
