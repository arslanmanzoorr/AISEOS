import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAdr, slugify, nextAdrNumber } from "../src/adr.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "seos-adr-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Use PostgreSQL as Primary Store!")).toBe("use-postgresql-as-primary-store");
  });
});

describe("nextAdrNumber", () => {
  it("returns 1 for an empty directory", async () => {
    expect(await nextAdrNumber(dir)).toBe(1);
  });
});

describe("writeAdr", () => {
  it("writes 0001-<slug>.md with decision and reason and returns its path", async () => {
    const path = await writeAdr(
      { decision: "Use PostgreSQL", reason: "Transactional workload", date: "2026-06-19" },
      dir,
    );
    expect(path).toContain("0001-use-postgresql.md");
    const body = await readFile(path, "utf8");
    expect(body).toContain("# 1. Use PostgreSQL");
    expect(body).toContain("Transactional workload");
    expect(body).toContain("2026-06-19");
    expect(body).toContain("accepted");
  });

  it("increments the number for subsequent ADRs", async () => {
    await writeAdr({ decision: "First", reason: "r1", date: "2026-06-19" }, dir);
    const second = await writeAdr({ decision: "Second", reason: "r2", date: "2026-06-19" }, dir);
    expect(second).toContain("0002-second.md");
    const files = (await readdir(dir)).sort();
    expect(files).toEqual(["0001-first.md", "0002-second.md"]);
  });
});
