import { BaseAgent } from "./base-agent";
import type { MemoryService } from "@/lib/orchestration/memory-service";

/**
 * Engineering Agent
 * 
 * Assigned Skills:
 * - frontend: React/Next.js component development
 * - backend: API routes, server logic
 * - api: REST/GraphQL endpoint design
 * - database: Schema design, queries
 * - authentication: Auth flow implementation
 * - artifact_generation: File generation and structure
 * 
 * Generates: Code files, components, configurations, tests
 * Returns: Structured output with file paths
 */

interface EngineeringOutput {
  files: Array<{
    path: string;
    content: string;
    language: string;
    type: "code" | "config" | "test";
  }>;
  summary: string;
  dependencies: string[];
  setupInstructions: string[];
  apiEndpoints?: Array<{
    method: string;
    path: string;
    description: string;
  }>;
}

export class EngineeringAgent extends BaseAgent {
  constructor(skills: string[], memoryService: MemoryService) {
    super("Engineering", skills, memoryService);
  }

  /**
   * Execute engineering tasks
   */
  async execute(taskDescription: string): Promise<void> {
    console.log(`[v0] EngineeringAgent executing...`);
    
    try {
      // Get context from memory
      const context = this.getContextFromMemory();

      // Select best model for coding task
      const model = await this.selectModel(
        `Engineering task: ${taskDescription}`
      );

      // Build prompt based on assigned skills
      const prompt = this.buildEngineeringPrompt(
        taskDescription,
        this.skills,
        context
      );

      // Call the model
      console.log(`[v0] EngineeringAgent calling model: ${model}`);
      
      const response = await this.openRouterService.callModel(
        model,
        [
          {
            role: "system" as const,
            content: `You are an expert software engineer. Generate clean, production-ready code. Always respond with valid JSON.`,
          },
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        {
          temperature: 0.3, // Lower for consistency
          maxTokens: 4096,
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

      const output: EngineeringOutput = JSON.parse(jsonMatch[0]);

      // Write to memory
      this.writeToMemory({
        files: output.files,
        summary: output.summary,
        dependencies: output.dependencies,
        setupInstructions: output.setupInstructions,
        apiEndpoints: output.apiEndpoints,
        timestamp: new Date().toISOString(),
      });

      console.log(`[v0] EngineeringAgent completed`);
      console.log(`[v0] Generated ${output.files.length} files`);
    } catch (error) {
      console.error(`[v0] EngineeringAgent error:`, error);
      throw error;
    }
  }

  /**
   * Build engineering prompt based on assigned skills
   */
  private buildEngineeringPrompt(
    taskDescription: string,
    skills: string[],
    context: string
  ): string {
    const skillsText = skills.join(", ");

    return `
You are an expert engineering agent. Based on the assigned skills, generate the required code.

Assigned Skills: ${skillsText}

Context:
${context}

Task: ${taskDescription}

Generate a JSON response (no markdown code blocks):
{
  "files": [
    {
      "path": "path/to/file.ts",
      "content": "file content here",
      "language": "typescript",
      "type": "code"
    }
  ],
  "summary": "Brief description of what was generated",
  "dependencies": ["package1", "package2"],
  "setupInstructions": ["instruction1", "instruction2"],
  "apiEndpoints": [
    {
      "method": "GET",
      "path": "/api/endpoint",
      "description": "Description of endpoint"
    }
  ]
}

Requirements:
- Only generate code for the assigned skills
- Include all necessary imports
- Follow best practices and security guidelines
- If database skills assigned, include schema design
- If authentication skills assigned, include secure auth implementation
- If API skills assigned, include proper error handling
- Files should be production-ready
- Always use TypeScript for backend code
- Always use React/Next.js for frontend code
`;
  }
}
