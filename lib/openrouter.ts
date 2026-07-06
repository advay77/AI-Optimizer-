import type { CallModelOptions, CallModelResponse, OpenRouterModel, ChatMessage } from "@/types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const RETRY_STATUSES = [429, 500, 502, 503, 504];
const TIMEOUT_MS = 30000; // 30 seconds

export class OpenRouterService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set in environment variables");
    }
    this.apiKey = apiKey;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    retries = 1
  ): Promise<T> {
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (RETRY_STATUSES.includes(response.status) && i < retries) {
            console.warn(`Request failed with ${response.status}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            continue;
          }
          const errorText = await response.text();
          throw new Error(
            `OpenRouter API failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`);
        }

        if (i < retries) {
          console.warn(`Request failed, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unexpected error: retries exhausted");
  }

  async fetchModels(): Promise<OpenRouterModel[]> {
    try {
      const data = await this.fetchWithRetry<{ data: OpenRouterModel[] }>(
        `${OPENROUTER_API_BASE}/models`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return data.data;
    } catch (error) {
      console.error("Error fetching models from OpenRouter:", error);
      throw error;
    }
  }

  async callModel(
    modelId: string,
    prompt: string | ChatMessage[],
    options: CallModelOptions = {}
  ): Promise<CallModelResponse> {
    const { temperature = 0.7, maxTokens = 1024, topP = 1 } = options;

    const messages = Array.isArray(prompt)
      ? prompt
      : [{ role: "user" as const, content: prompt }];

    try {
      const response = await this.fetchWithRetry<CallModelResponse>(
        `${OPENROUTER_API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Orion AI Router",
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature,
            max_tokens: maxTokens,
            top_p: topP,
          }),
        }
      );

      return response;
    } catch (error) {
      console.error(`Error calling model ${modelId}:`, error);
      throw error;
    }
  }
}
