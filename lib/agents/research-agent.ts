import { BaseAgent } from "./base-agent";
import type { MemoryService } from "@/lib/orchestration/memory-service";

/**
 * R&D Agent (Research & Development)
 * 
 * Assigned Skills:
 * - planning: Project planning, requirement analysis
 * - reasoning: Complex logical reasoning, problem solving
 * - vision: Image analysis, visual recognition
 * - pdf_analysis: PDF content extraction, analysis
 * - research: General research, information gathering
 * - summarization: Content summarization
 * 
 * Generates: Analysis results, insights, structured data (NOT essays)
 * Returns: Structured findings
 */

interface ResearchOutput {
  findings: Array<{
    category: string;
    insight: string;
    confidence: number;
    evidence?: string[];
  }>;
  recommendations: string[];
  risks?: Array<{
    risk: string;
    mitigation: string;
  }>;
  summary: string;
  metadata: {
    analysisType: string;
    timestamp: string;
    sources: string[];
  };
}

export class ResearchAgent extends BaseAgent {
  constructor(skills: string[], memoryService: MemoryService) {
    super("Research", skills, memoryService);
  }

  /**
   * Execute research tasks
   */
  async execute(taskDescription: string): Promise<void> {
    console.log(`[v0] ResearchAgent executing...`);
    
    try {
      // Get context from memory
      const context = this.getContextFromMemory();

      // Select best model for reasoning/research task
      const model = await this.selectModel(
        `Research task: ${taskDescription}`
      );

      // Build prompt based on assigned skills
      const prompt = this.buildResearchPrompt(
        taskDescription,
        this.skills,
        context
      );

      // Call the model
      console.log(`[v0] ResearchAgent calling model: ${model}`);
      
      const response = await this.openRouterService.callModel(
        model,
        [
          {
            role: "system" as const,
            content: `You are an expert research analyst. Provide structured, actionable insights. Always respond with valid JSON.`,
          },
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        {
          temperature: 0.4, // Moderate for analysis
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

      const output: ResearchOutput = JSON.parse(jsonMatch[0]);

      // Write to memory
      this.writeToMemory({
        findings: output.findings,
        recommendations: output.recommendations,
        risks: output.risks,
        summary: output.summary,
        metadata: output.metadata,
      });

      console.log(`[v0] ResearchAgent completed`);
      console.log(`[v0] Found ${output.findings.length} key findings`);
    } catch (error) {
      console.error(`[v0] ResearchAgent error:`, error);
      throw error;
    }
  }

  /**
   * Build research prompt based on assigned skills
   */
  private buildResearchPrompt(
    taskDescription: string,
    skills: string[],
    context: string
  ): string {
    const skillsText = skills.join(", ");

    return `
You are an expert research analyst. Based on the assigned skills, provide structured analysis.

Assigned Skills: ${skillsText}

Context:
${context}

Task: ${taskDescription}

Generate a JSON response (no markdown code blocks):
{
  "findings": [
    {
      "category": "Category name",
      "insight": "Key insight or finding",
      "confidence": 0.9,
      "evidence": ["Supporting evidence or source"]
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "risks": [
    {
      "risk": "Identified risk",
      "mitigation": "How to mitigate this risk"
    }
  ],
  "summary": "Executive summary of findings",
  "metadata": {
    "analysisType": "Type of analysis performed",
    "timestamp": "ISO timestamp",
    "sources": ["Source 1", "Source 2"]
  }
}

Requirements:
- Provide only findings relevant to assigned skills
- If vision skill assigned, analyze visual content structure
- If pdf_analysis skill assigned, extract key information
- If planning skill assigned, provide project planning insights
- If reasoning skill assigned, provide logical analysis
- Each finding should be actionable
- Confidence should be 0-1 scale
- Never include opinions, only facts and evidence
- Be specific and concise
`;
  }
}
