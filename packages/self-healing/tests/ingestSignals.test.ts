import { describe, it, expect } from "vitest";
import { ingestSignals } from "../src/ingestSignals.js";

describe("ingestSignals", () => {
  it("groups messages that differ only by numbers into one issue", () => {
    const issues = ingestSignals([
      { source: "error", message: "Timeout after 3000 ms calling /users/42" },
      { source: "error", message: "Timeout after 5000 ms calling /users/99" },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].count).toBe(2);
  });

  it("keeps distinct messages as separate issues", () => {
    const issues = ingestSignals([
      { source: "error", message: "Timeout calling db" },
      { source: "error", message: "Null pointer in handler" },
    ]);
    expect(issues).toHaveLength(2);
  });

  it("escalates an issue to the highest severity in its group", () => {
    const issues = ingestSignals([
      { source: "error", message: "boom 1", severity: "low" },
      { source: "error", message: "boom 2", severity: "critical" },
    ]);
    expect(issues[0].severity).toBe("critical");
  });
});
