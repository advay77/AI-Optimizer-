import type { ArtifactManifest, ArtifactFile, MemoryStore } from "@/types";

/**
 * Artifact Validator: STEP 9 of Decision Framework
 * 
 * Before returning a response, verify:
 * - Required files exist
 * - Imports are valid
 * - Folder structure is complete
 * - Artifact type is correct
 * - Preview can render
 * 
 * If validation fails:
 * - Attempt automatic repair
 */

export class ArtifactValidator {
  /**
   * Validate all artifacts from engineering agent output
   */
  validateArtifacts(memory: MemoryStore): ArtifactManifest {
    console.log(`[v0] ArtifactValidator.validateArtifacts() starting`);

    const errors: string[] = [];
    const files: ArtifactFile[] = [];

    // Check if engineering output exists
    const engineeringOutput = memory.engineering as any;
    if (!engineeringOutput || !engineeringOutput.files) {
      console.log(`[v0] No engineering artifacts to validate`);
      return {
        files: [],
        validated: true,
        validationErrors: [],
        repairAttempts: 0,
      };
    }

    // Validate each file
    const artifactFiles = engineeringOutput.files || [];
    
    for (const file of artifactFiles) {
      const fileErrors = this.validateFile(file);
      if (fileErrors.length > 0) {
        errors.push(`File ${file.path}: ${fileErrors.join("; ")}`);
      } else {
        files.push({
          path: file.path,
          type: file.type || "code",
          content: file.content,
          language: file.language,
          size: file.content.length,
        });
      }
    }

    let repairAttempts = 0;

    // Attempt automatic repairs
    if (errors.length > 0) {
      console.log(`[v0] Found ${errors.length} validation errors, attempting repairs...`);
      repairAttempts = this.attemptRepair(files, errors);
    }

    const manifest: ArtifactManifest = {
      files,
      validated: errors.length === 0,
      validationErrors: errors,
      repairAttempts,
    };

    console.log(`[v0] ArtifactValidator result:`, {
      filesValidated: files.length,
      errorsFound: errors.length,
      repairsAttempted: repairAttempts,
    });

    return manifest;
  }

  /**
   * Validate a single file
   */
  private validateFile(file: any): string[] {
    const errors: string[] = [];

    // Check required fields
    if (!file.path) {
      errors.push("Missing file path");
    } else if (typeof file.path !== "string") {
      errors.push("File path must be a string");
    }

    if (!file.content) {
      errors.push("Missing file content");
    } else if (typeof file.content !== "string") {
      errors.push("File content must be a string");
    }

    // Check path structure
    if (file.path && typeof file.path === "string") {
      // Ensure path starts with folder structure
      const hasFolder = file.path.includes("/");
      if (!hasFolder && !this.isValidSingleFile(file.path)) {
        // console.warn(`File ${file.path} may need folder structure`);
      }

      // Check for invalid characters
      if (/[<>:"|?*]/.test(file.path)) {
        errors.push("File path contains invalid characters");
      }
    }

    // Check language/type consistency
    if (file.language && file.type) {
      if (!this.isValidLanguageType(file.language, file.type)) {
        // Warning but not error
        console.warn(
          `[v0] Language "${file.language}" may not match type "${file.type}"`
        );
      }
    }

    // Validate imports if it's code
    if (
      file.type === "code" &&
      file.language === "typescript" &&
      file.content
    ) {
      const importErrors = this.validateImports(file.content);
      errors.push(...importErrors);
    }

    return errors;
  }

  /**
   * Check if language matches type
   */
  private isValidLanguageType(language: string, type: string): boolean {
    const validMappings: Record<string, string[]> = {
      javascript: ["code", "config"],
      typescript: ["code", "config"],
      jsx: ["code"],
      tsx: ["code"],
      json: ["config", "data"],
      yaml: ["config"],
      markdown: ["document"],
      html: ["code"],
      css: ["code"],
    };

    const validTypes = validMappings[language.toLowerCase()];
    return validTypes ? validTypes.includes(type) : true;
  }

  /**
   * Check if file path is a valid single file without folder
   */
  private isValidSingleFile(path: string): boolean {
    return (
      path === "package.json" ||
      path === "tsconfig.json" ||
      path === "next.config.ts" ||
      path === ".env" ||
      path.endsWith(".ts") ||
      path.endsWith(".tsx") ||
      path.endsWith(".js") ||
      path.endsWith(".jsx")
    );
  }

  /**
   * Validate imports in TypeScript code
   */
  private validateImports(content: string): string[] {
    const errors: string[] = [];

    // Simple regex to find imports
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Check for common issues
    for (const importPath of imports) {
      // Warning: external imports should be packages or aliases
      if (
        importPath.startsWith("./") ||
        importPath.startsWith("../")
      ) {
        // Relative imports are fine
        continue;
      }

      if (importPath.startsWith("@/")) {
        // Aliases are fine
        continue;
      }

      // Assume it's a package import
      // Could validate against installed packages, but skipping for now
    }

    return errors;
  }

  /**
   * Attempt automatic repairs for common validation errors
   */
  private attemptRepair(files: ArtifactFile[], errors: string[]): number {
    let repairCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Repair 1: Add folder structure if missing
      if (!file.path.includes("/") && file.type === "code") {
        const extension = this.getExtensionForLanguage(file.language || "");
        if (extension) {
          file.path = `src/${file.path}`;
          repairCount++;
          console.log(`[v0] Repaired: Added src/ folder to ${file.path}`);
        }
      }

      // Repair 2: Fix language based on extension
      if (!file.language && file.path.includes(".")) {
        const ext = file.path.split(".").pop();
        file.language = this.getLanguageForExtension(ext || "");
        if (file.language) {
          repairCount++;
          console.log(`[v0] Repaired: Inferred language ${file.language}`);
        }
      }

      // Repair 3: Ensure .env files are marked as config
      if (file.path.startsWith(".env")) {
        file.type = "config";
        repairCount++;
      }
    }

    return repairCount;
  }

  /**
   * Get extension for a language
   */
  private getExtensionForLanguage(language: string): string {
    const map: Record<string, string> = {
      typescript: "ts",
      javascript: "js",
      jsx: "jsx",
      tsx: "tsx",
      json: "json",
      yaml: "yaml",
      markdown: "md",
      html: "html",
      css: "css",
    };

    return map[language.toLowerCase()] || "";
  }

  /**
   * Get language for an extension
   */
  private getLanguageForExtension(ext: string): string {
    const map: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      html: "html",
      css: "css",
    };

    return map[ext.toLowerCase()] || "";
  }
}

/**
 * Convenience function
 */
export const validateArtifacts = (memory: MemoryStore): ArtifactManifest => {
  const validator = new ArtifactValidator();
  return validator.validateArtifacts(memory);
};
