import { describe, it, expect } from "vitest";
import { generateTests } from "../src/generateTests.js";

describe("generateTests", () => {
  it("creates a describe block per exported function and imports them", () => {
    const out = generateTests(
      { path: "src/math.ts", content: "export function add(a,b){return a+b}\nexport const sub = (a,b)=>a-b\n" },
      "unit",
    );
    expect(out).toContain('import { add, sub } from "./math.js"');
    expect(out).toContain('describe("add"');
    expect(out).toContain('describe("sub"');
    expect(out).toContain("unit");
  });
  it("returns a note when there are no exports", () => {
    const out = generateTests({ path: "src/empty.ts", content: "const x = 1;" }, "unit");
    expect(out).toContain("No exported symbols");
  });
});
