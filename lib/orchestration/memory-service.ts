import type { MemoryStore } from "@/types";

/**
 * MemoryService: Central state management for orchestration
 * 
 * STEP 8 (Shared Memory): All inter-agent communication flows through MemoryService.
 * Agents NEVER communicate directly; they only read from and write to this store.
 * 
 * Structure:
 * - intent.json: User intent analysis (from Intent Analyzer)
 * - planning.json: Decision framework output (agent selection + skills)
 * - research.json: R&D agent output
 * - engineering.json: Engineering agent output
 * - marketing.json: Marketing agent output
 * - artifacts.json: Generated artifacts manifest
 * - metrics.json: Execution metrics (cost, tokens, confidence)
 */
export class MemoryService {
  private store: MemoryStore = {};
  private executionId: string;

  constructor(executionId: string) {
    this.executionId = executionId;
    console.log(`[v0] MemoryService initialized for execution: ${executionId}`);
  }

  /**
   * Write data to memory store for a given key
   */
  write<K extends keyof MemoryStore>(key: K, data: MemoryStore[K]): void {
    this.store[key] = data;
    console.log(`[v0] MemoryService write: ${String(key)}`);
  }

  /**
   * Read data from memory store for a given key
   */
  read<K extends keyof MemoryStore>(key: K): MemoryStore[K] | undefined {
    return this.store[key];
  }

  /**
   * Get all memory data
   */
  getAll(): MemoryStore {
    return { ...this.store };
  }

  /**
   * Delete a key from memory store
   */
  delete<K extends keyof MemoryStore>(key: K): void {
    delete this.store[key];
    console.log(`[v0] MemoryService delete: ${String(key)}`);
  }

  /**
   * Check if a key exists in memory store
   */
  has<K extends keyof MemoryStore>(key: K): boolean {
    return key in this.store;
  }

  /**
   * Get execution ID
   */
  getExecutionId(): string {
    return this.executionId;
  }

  /**
   * Merge incoming data into existing data for a key (shallow merge for objects)
   */
  merge<K extends keyof MemoryStore>(
    key: K,
    data: Partial<MemoryStore[K]>
  ): void {
    const existing = this.store[key];
    if (typeof existing === "object" && existing !== null) {
      this.store[key] = { ...existing, ...data } as MemoryStore[K];
    } else {
      this.store[key] = data as MemoryStore[K];
    }
    console.log(`[v0] MemoryService merge: ${String(key)}`);
  }

  /**
   * Clear entire memory store (for cleanup)
   */
  clear(): void {
    this.store = {};
    console.log(`[v0] MemoryService cleared`);
  }
}

/**
 * Global memory service instance per execution
 * In a production app, this could be backed by Redis, PostgreSQL, or file system
 */
export const createMemoryService = (executionId: string): MemoryService => {
  return new MemoryService(executionId);
};
