import { describe, it, expect } from "vitest";
import { createPr } from "../src/createPr.js";
import type { CommandRunner, FixProposal } from "../src/types.js";

const fix: FixProposal = { category: "connectivity", summary: "s", patch: "p", tests: "t" };

describe("createPr", () => {
  it("runs a branch+commit+pr plan and never merges", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      return "ok";
    };
    const result = await createPr(fix, runner);
    expect(result.merged).toBe(false);
    expect(result.branch).toContain("fix/");
    // no command in the plan is a merge
    const flat = calls.map((c) => c.join(" ").toLowerCase());
    expect(flat.some((c) => c.includes("merge"))).toBe(false);
    // it did open a PR
    expect(flat.some((c) => c.includes("pr create"))).toBe(true);
  });

  it("does not false-positive when the summary contains the word 'merge'", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push([command, ...args]);
      return "ok";
    };
    const result = await createPr({ category: "connectivity", summary: "merge upstream timeout config", patch: "p", tests: "t" }, runner);
    expect(result.merged).toBe(false);
    expect(calls.some((c) => c.join(" ").includes("pr create"))).toBe(true);
  });
});
