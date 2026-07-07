import type { TaskWeights, TaskType } from "@/types";

export const getTaskWeights = (taskCategory: TaskType): TaskWeights => {
  const weights: Record<TaskType, TaskWeights> = {
    coding: {
      coding: 0.40,
      reasoning: 0.25,
      instructionFollowing: 0.15,
      jsonReliability: 0.10,
      latency: 0.05,
      cost: 0.05,
    },
    debugging: {
      coding: 0.35,
      reasoning: 0.30,
      instructionFollowing: 0.15,
      jsonReliability: 0.08,
      latency: 0.07,
      cost: 0.05,
    },
    writing: {
      instructionFollowing: 0.35,
      reasoning: 0.25,
      multilingual: 0.15,
      latency: 0.15,
      cost: 0.10,
    },
    translation: {
      multilingual: 0.45,
      instructionFollowing: 0.25,
      reasoning: 0.15,
      latency: 0.10,
      cost: 0.05,
    },
    architecture: {
      reasoning: 0.40,
      coding: 0.30,
      context: 0.15,
      instructionFollowing: 0.10,
      cost: 0.05,
    },
    research: {
      reasoning: 0.35,
      instructionFollowing: 0.25,
      context: 0.20,
      benchmark: 0.10,
      cost: 0.10,
    },
    multimodal: {
      multimodal: 0.40,
      instructionFollowing: 0.25,
      reasoning: 0.15,
      latency: 0.10,
      cost: 0.10,
    },
    simple_tasks: {
      instructionFollowing: 0.30,
      latency: 0.30,
      cost: 0.25,
      reasoning: 0.08,
      benchmark: 0.07,
    },
    complex_reasoning: {
      reasoning: 0.45,
      benchmark: 0.25,
      instructionFollowing: 0.15,
      context: 0.10,
      cost: 0.05,
    },
    analysis: {
      reasoning: 0.35,
      instructionFollowing: 0.25,
      benchmark: 0.20,
      context: 0.10,
      cost: 0.10,
    },
    content_generation: {
      instructionFollowing: 0.35,
      reasoning: 0.20,
      multilingual: 0.15,
      latency: 0.15,
      cost: 0.15,
    },
    simple_coding: {
      coding: 0.35,
      instructionFollowing: 0.25,
      latency: 0.20,
      cost: 0.20,
    },
    general: {
      instructionFollowing: 0.30,
      reasoning: 0.25,
      latency: 0.20,
      cost: 0.15,
      benchmark: 0.10,
    },
  };

  return weights[taskCategory] || weights.general;
};
