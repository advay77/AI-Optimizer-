import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function calculateCost(
  promptPricePerToken: string,
  completionPricePerToken: string,
  promptTokens: number,
  completionTokens: number
): number {
  const promptCost = parseFloat(promptPricePerToken) * promptTokens;
  const completionCost = parseFloat(completionPricePerToken) * completionTokens;
  return promptCost + completionCost;
}
