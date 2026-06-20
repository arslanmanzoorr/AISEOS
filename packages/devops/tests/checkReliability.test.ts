import { describe, it, expect } from "vitest";
import { checkReliability } from "../src/checkReliability.js";

describe("checkReliability", () => {
  it("is ready when all three strategies are present", () => {
    const r = checkReliability({ backupStrategy: "daily snapshot", restoreStrategy: "PITR", rollbackStrategy: "blue/green" });
    expect(r).toEqual({ ready: true, missing: [] });
  });
  it("reports each missing strategy", () => {
    const r = checkReliability({ backupStrategy: "daily snapshot" });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["restoreStrategy", "rollbackStrategy"]);
  });
  it("treats an empty string as missing", () => {
    const r = checkReliability({ backupStrategy: "", restoreStrategy: "x", rollbackStrategy: "y" });
    expect(r.missing).toEqual(["backupStrategy"]);
  });
});
