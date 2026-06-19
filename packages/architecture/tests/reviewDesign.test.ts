import { describe, it, expect } from "vitest";
import { reviewDesign } from "../src/reviewDesign.js";
import type { ArchitectureProposal } from "../src/types.js";

function proposal(overrides: Partial<ArchitectureProposal> = {}): ArchitectureProposal {
  return {
    services: ["api"],
    datastore: { primary: "PostgreSQL" },
    deploymentModel: "single-region",
    rationale: [],
    ...overrides,
  };
}

describe("reviewDesign", () => {
  it("approves a sound single-region proposal", () => {
    const r = reviewDesign(proposal());
    expect(r.approved).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it("rejects a multi-region proposal that lacks a cdn (error)", () => {
    const r = reviewDesign(proposal({ deploymentModel: "multi-region", services: ["api"] }));
    expect(r.approved).toBe(false);
    expect(r.findings.some((f) => f.rule === "multiregion-needs-cdn" && f.severity === "error")).toBe(true);
  });

  it("warns but still approves a multi-region proposal that has cdn but no cache", () => {
    const r = reviewDesign(
      proposal({ deploymentModel: "multi-region", services: ["api", "cdn"], datastore: { primary: "PostgreSQL" } }),
    );
    expect(r.approved).toBe(true);
    expect(r.findings.some((f) => f.rule === "multiregion-needs-cache" && f.severity === "warning")).toBe(true);
  });

  it("rejects a proposal with no services", () => {
    const r = reviewDesign(proposal({ services: [] }));
    expect(r.approved).toBe(false);
    expect(r.findings.some((f) => f.rule === "no-services")).toBe(true);
  });

  it("rejects a proposal with no primary datastore", () => {
    const r = reviewDesign(proposal({ datastore: { primary: "" } }));
    expect(r.approved).toBe(false);
    expect(r.findings.some((f) => f.rule === "primary-datastore-required")).toBe(true);
  });
});
