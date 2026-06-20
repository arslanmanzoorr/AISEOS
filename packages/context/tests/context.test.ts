import { describe, it, expect, afterEach } from "vitest";
import { localContext } from "../src/index.js";

const KEYS = ["SEOS_MEMORY_PATH", "SEOS_ADR_DIR", "SEOS_KNOWLEDGE_PATH"] as const;
afterEach(() => { for (const k of KEYS) delete process.env[k]; });

describe("localContext", () => {
  it("uses userId 'local' and execute mode by default", () => {
    const ctx = localContext();
    expect(ctx.userId).toBe("local");
    expect(ctx.createPrMode).toBe("execute");
  });

  it("reads path overrides from env vars", () => {
    process.env.SEOS_MEMORY_PATH = "/tmp/m.json";
    process.env.SEOS_ADR_DIR = "/tmp/adr";
    process.env.SEOS_KNOWLEDGE_PATH = "/tmp/k.json";
    const ctx = localContext();
    expect(ctx.paths).toEqual({ memory: "/tmp/m.json", adrDir: "/tmp/adr", knowledge: "/tmp/k.json" });
  });

  it("falls back to conventional relative defaults", () => {
    const ctx = localContext();
    expect(ctx.paths.adrDir).toBe("docs/adr");
    expect(ctx.paths.memory).toBe("memory.json");
    expect(ctx.paths.knowledge).toBe("knowledge.json");
  });
});
