import { BaseAgent } from "./base-agent";
import type { MemoryService } from "@/lib/orchestration/memory-service";

/**
 * Marketing Agent
 * 
 * Assigned Skills:
 * - documentation: Technical documentation
 * - marketing: Marketing copy, product descriptions
 * - presentation: Presentation content, summaries
 * - readme: README files and guides
 * - seo: SEO optimization, metadata
 * 
 * Generates: Content ONLY when decision framework selects it
 * Returns: Formatted content
 */

interface MarketingOutput {
  content: Array<{
    type: string;
    title?: string;
    body: string;
    metadata?: Record<string, string>;
  }>;
  summary: string;
  keyMessages: string[];
}

export class MarketingAgent extends BaseAgent {
  constructor(skills: string[], memoryService: MemoryService) {
    super("Marketing", skills, memoryService);
  }

  /**
   * Execute marketing tasks
   */
  async execute(taskDescription: string): Promise<void> {
    console.log(`[v0] MarketingAgent executing...`);
    
    try {
      // Get context from memory
      const context = this.getContextFromMemory();

      // Select best model for writing task
      const model = await this.selectModel(
        `Marketing/documentation task: ${taskDescription}`
      );

      // Build prompt based on assigned skills
      const prompt = this.buildMarketingPrompt(
        taskDescription,
        this.skills,
        context
      );

      // Call the model
      console.log(`[v0] MarketingAgent calling model: ${model}`);
      
      const response = await this.openRouterService.callModel(
        model,
        [
          {
            role: "system" as const,
            content: `You are an expert marketing and documentation specialist. Create clear, engaging, and well-structured content. Always respond with valid JSON.`,
          },
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        {
          temperature: 0.5, // Moderate for creative content
          maxTokens: 2048,
        }
      );

      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from model");
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from model response");
      }

      const output: MarketingOutput = JSON.parse(jsonMatch[0]);

      // Write to memory
      this.writeToMemory({
        content: output.content,
        summary: output.summary,
        keyMessages: output.keyMessages,
        timestamp: new Date().toISOString(),
      });

      console.log(`[v0] MarketingAgent completed`);
      console.log(`[v0] Generated ${output.content.length} content pieces`);
    } catch (error) {
      console.error(`[v0] MarketingAgent error:`, error);
      throw error;
    }
  }

  /**
   * Build marketing prompt based on assigned skills
   */
  private buildMarketingPrompt(
    taskDescription: string,
    skills: string[],
    context: string
  ): string {
    const skillsText = skills.join(", ");

    return `
You are an expert marketing and content specialist. Based on the assigned skills, create compelling content.

Assigned Skills: ${skillsText}

Context:
${context}

Task: ${taskDescription}

Generate a JSON response (no markdown code blocks):
{
  "content": [
    {
      "type": "documentation|marketing|presentation|readme|seo",
      "title": "Optional title",
      "body": "Main content",
      "metadata": {
        "keywords": "Optional keywords",
        "audience": "Target audience",
        "tone": "Professional, casual, etc"
      }
    }
  ],
  "summary": "Brief summary of content created",
  "keyMessages": ["Key message 1", "Key message 2"]
}

Requirements:
- Only generate content for the assigned skills
- If documentation skill: Create clear, well-structured technical docs
- If marketing skill: Create compelling copy focused on benefits
- If presentation skill: Create concise, engaging summaries
- If readme skill: Create friendly, easy-to-follow README content
- If seo skill: Include relevant metadata and keywords
- Content should be engaging and clear
- Use appropriate tone for the audience
- Include practical examples where relevant
- Keep paragraphs short and scannable
`;
  }
}
