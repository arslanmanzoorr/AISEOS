import type { ArchitectureProposal, DesignFinding, DesignReview } from "./types.js";

export function reviewDesign(proposal: ArchitectureProposal): DesignReview {
  const findings: DesignFinding[] = [];

  if (proposal.services.length === 0) {
    findings.push({ severity: "error", rule: "no-services", message: "Proposal defines no services." });
  }

  if (!proposal.datastore.primary) {
    findings.push({
      severity: "error",
      rule: "primary-datastore-required",
      message: "Proposal has no primary datastore.",
    });
  }

  if (proposal.deploymentModel === "multi-region") {
    if (!proposal.services.includes("cdn")) {
      findings.push({
        severity: "error",
        rule: "multiregion-needs-cdn",
        message: "Multi-region deployment should include a cdn/edge layer for latency.",
      });
    }
    if (!proposal.datastore.cache) {
      findings.push({
        severity: "warning",
        rule: "multiregion-needs-cache",
        message: "Multi-region deployment benefits from a cache to reduce cross-region read latency.",
      });
    }
  }

  const approved = findings.every((f) => f.severity !== "error");
  return { approved, findings };
}
