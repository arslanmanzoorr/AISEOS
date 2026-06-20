import { describe, it, expect } from "vitest";
import { rootCause } from "../src/rootCause.js";
import type { Issue } from "../src/types.js";

const issue = (signature: string): Issue => ({ id: "issue-1", signature, count: 1, severity: "high", sample: signature });

describe("rootCause", () => {
  it("classifies a timeout as connectivity", () => {
    const rc = rootCause(issue("timeout after n ms calling db"));
    expect(rc.category).toBe("connectivity");
    expect(rc.evidence.length).toBeGreaterThan(0);
  });
  it("classifies a null pointer as null-reference", () => {
    expect(rootCause(issue("null pointer in handler")).category).toBe("null-reference");
  });
  it("classifies heap exhaustion as memory", () => {
    expect(rootCause(issue("javascript heap out of memory")).category).toBe("memory");
  });
  it("falls back to unknown", () => {
    expect(rootCause(issue("something weird happened")).category).toBe("unknown");
  });
  it("classifies connection refused as connectivity", () => {
    expect(rootCause(issue("econnrefused connecting to redis")).category).toBe("connectivity");
  });
  it("classifies a deadlock as concurrency", () => {
    expect(rootCause(issue("deadlock detected on table orders")).category).toBe("concurrency");
  });
});
