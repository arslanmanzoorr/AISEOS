import { describe, it, expect } from "vitest";
import { auditDependency } from "../../src/tools/auditDependency.js";

const client = {
  async fetchPackageInfo(name: string) {
    const map: Record<string, { latest: string; deprecated: boolean; lastPublishIso: string }> = {
      "fresh-popular": { latest: "1.0.0", deprecated: false, lastPublishIso: new Date().toISOString() },
      "old-niche": { latest: "1.0.0", deprecated: false, lastPublishIso: "2019-01-01T00:00:00.000Z" },
      "dead-pkg": { latest: "1.0.0", deprecated: true, lastPublishIso: "2018-01-01T00:00:00.000Z" },
      "stale-moderate": { latest: "1.0.0", deprecated: false, lastPublishIso: "2024-01-01T00:00:00.000Z" },
    };
    return { name, ...map[name] };
  },
  async fetchWeeklyDownloads(name: string) {
    const map: Record<string, number> = { "fresh-popular": 5_000_000, "old-niche": 500, "dead-pkg": 50, "stale-moderate": 50_000 };
    return map[name] ?? 0;
  },
};

describe("auditDependency", () => {
  it("rates a fresh, popular package as safe with low risk", async () => {
    const r = await auditDependency("fresh-popular", client);
    expect(r.recommendation).toBe("safe");
    expect(r.riskScore).toBeLessThan(30);
  });

  it("flags a deprecated, ancient, unpopular package as avoid", async () => {
    const r = await auditDependency("dead-pkg", client);
    expect(r.recommendation).toBe("avoid");
    expect(r.signals.deprecated).toBe(true);
    expect(r.riskScore).toBeGreaterThanOrEqual(60);
  });

  it("caps the score at 100", async () => {
    const r = await auditDependency("dead-pkg", client);
    expect(r.riskScore).toBeLessThanOrEqual(100);
  });

  it("rates a stale but moderately-used package as caution", async () => {
    const r = await auditDependency("stale-moderate", client);
    expect(r.recommendation).toBe("caution");
    expect(r.riskScore).toBeGreaterThanOrEqual(30);
    expect(r.riskScore).toBeLessThan(60);
  });
});
