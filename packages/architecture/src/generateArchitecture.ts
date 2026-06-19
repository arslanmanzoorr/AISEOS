import type { ArchitectureProposal, RequirementsProfile } from "./types.js";

export function generateArchitecture(profile: RequirementsProfile): ArchitectureProposal {
  const services: string[] = ["api"];
  const rationale: string[] = [];

  const datastore = { primary: "PostgreSQL" } as ArchitectureProposal["datastore"];
  rationale.push("PostgreSQL chosen as primary datastore for transactional, relational workloads.");

  const needsCache = profile.scale === "large" || profile.expectedRequestsPerSecond >= 1_000;
  if (needsCache) {
    datastore.cache = "Redis";
    rationale.push("Redis cache added to absorb read load at high scale/traffic.");
  }

  if (profile.expectedRequestsPerSecond >= 100) {
    services.push("worker");
    rationale.push("Worker service added to offload asynchronous/background processing from the request path.");
  }

  if (profile.multiRegion) {
    services.push("cdn");
    rationale.push("CDN/edge layer added to serve multiple regions with low latency.");
  }

  const deploymentModel = profile.multiRegion ? "multi-region" : "single-region";
  rationale.push(`Deployment model: ${deploymentModel} (driven by expectedRegions=${profile.expectedRegions}).`);

  return { services, datastore, deploymentModel, rationale };
}
