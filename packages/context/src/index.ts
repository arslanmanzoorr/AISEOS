export interface ToolContext {
  userId: string; // "local" for stdio use; the token's user id when hosted
  paths: {
    memory: string; // path to this user's memory.json
    adrDir: string; // this user's ADR directory
    knowledge: string; // curated stack profile (shared, read-only when hosted)
  };
  createPrMode: "execute" | "plan"; // hosted = "plan" (never runs git)
}

export function localContext(): ToolContext {
  return {
    userId: "local",
    paths: {
      memory: process.env.SEOS_MEMORY_PATH ?? "memory.json",
      adrDir: process.env.SEOS_ADR_DIR ?? "docs/adr",
      knowledge: process.env.SEOS_KNOWLEDGE_PATH ?? "knowledge.json",
    },
    createPrMode: "execute",
  };
}
