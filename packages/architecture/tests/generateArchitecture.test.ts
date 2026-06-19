import { describe, it, expect } from "vitest";
import { generateArchitecture } from "../src/generateArchitecture.js";
import type { RequirementsProfile } from "../src/types.js";

function profile(overrides: Partial<RequirementsProfile> = {}): RequirementsProfile {
  return {
    expectedUsers: 100,
    expectedRequestsPerSecond: 5,
    expectedDataSizeGb: 1,
    expectedRegions: 1,
    scale: "small",
    multiRegion: false,
    ...overrides,
  };
}

describe("generateArchitecture", () => {
  it("always proposes PostgreSQL as the primary datastore", () => {
    expect(generateArchitecture(profile()).datastore.primary).toBe("PostgreSQL");
  });

  it("omits a cache for small, low-traffic systems", () => {
    expect(generateArchitecture(profile()).datastore.cache).toBeUndefined();
  });

  it("adds a Redis cache at large scale", () => {
    expect(generateArchitecture(profile({ scale: "large" })).datastore.cache).toBe("Redis");
  });

  it("adds a worker service when RPS >= 100", () => {
    const p = generateArchitecture(profile({ expectedRequestsPerSecond: 250 }));
    expect(p.services).toContain("worker");
  });

  it("adds a cdn and multi-region deployment when multiRegion", () => {
    const p = generateArchitecture(profile({ multiRegion: true, expectedRegions: 3 }));
    expect(p.services).toContain("cdn");
    expect(p.deploymentModel).toBe("multi-region");
  });

  it("defaults to single-region with only an api service for the minimal case", () => {
    const p = generateArchitecture(profile());
    expect(p.services).toEqual(["api"]);
    expect(p.deploymentModel).toBe("single-region");
  });

  it("records a rationale entry for every decision made", () => {
    const p = generateArchitecture(profile({ scale: "large", expectedRequestsPerSecond: 1500, multiRegion: true, expectedRegions: 2 }));
    expect(p.rationale.length).toBe(5);
  });
});
