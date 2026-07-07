import type { PromptProfile, TaskType } from "@/types";

export function profilePrompt(prompt: string): PromptProfile {
  const p = prompt.toLowerCase();

  // Task category detection
  let taskCategory: TaskType = "general";
  if (/\b(?:function|class|import|export|const|let|var|def|code|implement|refactor|debug|error|bug)\b/i.test(p)) {
    if (/\b(?:debug|error|bug|fix|traceback)\b/i.test(p)) {
      taskCategory = "debugging";
    } else {
      taskCategory = "coding";
    }
  } else if (/\b(?:write|draft|essay|article|post|story|content|content_generation)\b/i.test(p)) {
    taskCategory = "writing";
  } else if (/\b(?:translate|translation|language|english|spanish|french|german|hindi|chinese|japanese)\b/i.test(p)) {
    taskCategory = "translation";
  } else if (/\b(?:architecture|system design|design pattern|microservice|scalable|infrastructure)\b/i.test(p)) {
    taskCategory = "architecture";
  } else if (/\b(?:research|paper|study|explain|concept|summarize|compare|analyze)\b/i.test(p)) {
    taskCategory = "research";
  } else if (/\b(?:image|photo|picture|diagram|visual|chart)\b/i.test(p)) {
    taskCategory = "multimodal";
  } else if (/\b(?:hi|hello|what|who|when|where|simple|quick|easy|short)\b/i.test(p)) {
    taskCategory = "simple_tasks";
  } else if (/\b(?:why|how|solve|problem|think|reason|complex)\b/i.test(p)) {
    taskCategory = "complex_reasoning";
  }

  // Complexity detection
  let complexity: "low" | "medium" | "high" = "low";
  let wordCount = prompt.split(/\s+/).length;
  if (wordCount > 50 || /\b(?:complex|difficult|advanced|expert)\b/i.test(p)) {
    complexity = "medium";
  }
  if (wordCount > 150 || /\b(?:architecture|research|debug|complex_reasoning)\b/i.test(p)) {
    complexity = "high";
  }

  // Estimated token usage
  const estimatedTokenUsage = Math.ceil(prompt.length / 4) + 500;

  // Requirements detection
  let reasoningRequirement: "low" | "medium" | "high" = "low";
  if (taskCategory === "complex_reasoning" || taskCategory === "research" || taskCategory === "architecture" || taskCategory === "debugging") {
    reasoningRequirement = "high";
  } else if (taskCategory === "coding") {
    reasoningRequirement = "medium";
  }

  let codingRequirement: "low" | "medium" | "high" = "low";
  if (taskCategory === "coding" || taskCategory === "debugging" || taskCategory === "architecture") {
    codingRequirement = "high";
  }

  const multimodalRequirement = /\b(?:image|photo|picture|diagram|visual|chart)\b/i.test(p);

  let longContextRequirement = 8000; // default
  if (/\b(?:long context|long document|large file|100k|128k)\b/i.test(p)) {
    longContextRequirement = 128000;
  } else if (/\b(?:medium context|32k)\b/i.test(p)) {
    longContextRequirement = 32000;
  }

  let latencySensitivity: "low" | "medium" | "high" = "medium";
  if (taskCategory === "simple_tasks") latencySensitivity = "high";
  if (taskCategory === "research" || taskCategory === "architecture") latencySensitivity = "low";

  let costSensitivity: "low" | "medium" | "high" = "medium";
  if (taskCategory === "simple_tasks") costSensitivity = "high";
  if (/\b(?:budget|cheap|save cost)\b/i.test(p)) costSensitivity = "high";
  if (/\b(?:premium|best quality|don't worry about cost)\b/i.test(p)) costSensitivity = "low";

  // Task ambiguity
  let taskAmbiguity = 30;
  if (prompt.length < 50) taskAmbiguity += 40;
  if (!/write|code|explain|translate|fix/i.test(p)) taskAmbiguity += 20;
  if (/\?/.test(p) && !/\b(?:what|how|why|when|where)\b/i.test(p)) taskAmbiguity += 10;

  return {
    taskCategory,
    complexity,
    estimatedTokenUsage,
    reasoningRequirement,
    codingRequirement,
    multimodalRequirement,
    longContextRequirement,
    latencySensitivity,
    costSensitivity,
    taskAmbiguity: Math.min(100, taskAmbiguity),
  };
}
