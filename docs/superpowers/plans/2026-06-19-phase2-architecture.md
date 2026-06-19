# Phase 2 — Engineering Quality Layer (`@seos/architecture`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `@seos/architecture`, an MCP server that makes the AI design architecture *before* writing code — capturing scale requirements, generating a structured architecture proposal, reviewing the design against rules, and recording Architecture Decision Records (ADRs).

**Architecture:** A second package in the existing `engineering-os` pnpm monorepo. Same stack and discipline as Phase 1 (`@seos/knowledge`): TypeScript, Node 24, ESM/NodeNext, `@modelcontextprotocol/sdk@1.29`, Zod, Vitest. All tools are **deterministic primitives** with dependency injection so the suite runs offline. The coding LLM does open-ended reasoning; this server enforces structure, validation, and persistence. ADRs written here are designed to be ingested later by Phase 7 (Engineering Memory).

**Tech Stack:** TypeScript 5.5+, Node 24, `@modelcontextprotocol/sdk@^1.0.0`, `zod@^3.23`, Vitest 2, tsup. Reuses root `tsconfig.base.json`.

---

## Design decision (locked)

`generateArchitecture` and `reviewDesign` are **rule/heuristic engines**, not LLM calls. Rationale: this server is consumed *by* a coding LLM via MCP; its job is to impose deterministic structure and catch known anti-patterns, exactly as Phase 1's tools do. Every heuristic and rule below is explicit and unit-tested. The LLM consumes the structured proposal and fills in the open-ended detail.

---

## File Structure

```
engineering-os/
  packages/
    architecture/                 # NEW — @seos/architecture
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts                  # MCP server; registers 4 tools
        types.ts                  # IntakeAnswers, RequirementsProfile, ArchitectureProposal, DesignFinding, DesignReview, AdrRecord
        intake.ts                 # intake(): validate + normalize + derive scale
        generateArchitecture.ts   # generateArchitecture(): deterministic proposal
        reviewDesign.ts           # reviewDesign(): rule engine -> findings + approved
        adr.ts                    # writeAdr(): sequential ADR file writer (+ slugify, nextAdrNumber)
      tests/
        intake.test.ts
        generateArchitecture.test.ts
        reviewDesign.test.ts
        adr.test.ts
        index.smoke.test.ts       # in-process tool registration smoke (optional belt-and-suspenders)
      README.md
```

**Tool ↔ function map:**
| MCP tool | function | input | output |
|----------|----------|-------|--------|
| `intake_requirements` | `intake` | IntakeAnswers | RequirementsProfile |
| `generate_architecture` | `generateArchitecture` | RequirementsProfile | ArchitectureProposal |
| `review_design` | `reviewDesign` | ArchitectureProposal | DesignReview |
| `write_adr` | `writeAdr` | AdrRecord (+dir from env) | { path } |

---

## Task 2.0: Scaffold `@seos/architecture` package

**Files:**
- Create: `packages/architecture/package.json`
- Create: `packages/architecture/tsconfig.json`
- Create: `packages/architecture/vitest.config.ts`

- [ ] **Step 1: Create `packages/architecture/package.json`**

```json
{
  "name": "@seos/architecture",
  "version": "0.1.0",
  "type": "module",
  "bin": { "seos-architecture": "dist/index.js" },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/architecture/tsconfig.json`** (matches the `@seos/knowledge` convention: `rootDir: "."` so `tests/` type-checks)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `packages/architecture/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Install**

Run from `D:\Claude Code\Devkit`: `pnpm install`
Expected: pnpm picks up the new workspace package `@seos/architecture` and links deps; exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/architecture/package.json packages/architecture/tsconfig.json packages/architecture/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(architecture): scaffold @seos/architecture package"
```

---

## Task 2.1: Shared types

**Files:**
- Create: `packages/architecture/src/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// Raw answers captured before any code is written.
export interface IntakeAnswers {
  expectedUsers: number; // total registered/active users
  expectedRequestsPerSecond: number; // peak RPS
  expectedDataSizeGb: number; // projected primary dataset size in GB
  expectedRegions: number; // number of geographic regions served (>= 1)
}

export type Scale = "small" | "medium" | "large";

export interface RequirementsProfile extends IntakeAnswers {
  scale: Scale; // derived from the answers
  multiRegion: boolean; // derived: expectedRegions > 1
}

export interface Datastore {
  primary: string; // e.g. "PostgreSQL"
  cache?: string; // e.g. "Redis"
}

export interface ArchitectureProposal {
  services: string[]; // e.g. ["api", "worker"]
  datastore: Datastore;
  deploymentModel: "single-region" | "multi-region";
  rationale: string[]; // human-readable justification, one entry per decision
}

export type FindingSeverity = "error" | "warning";

export interface DesignFinding {
  severity: FindingSeverity;
  rule: string; // stable rule id, e.g. "cache-required-at-scale"
  message: string;
}

export interface DesignReview {
  approved: boolean; // true only when there are no "error" findings
  findings: DesignFinding[];
}

export interface AdrRecord {
  decision: string; // e.g. "Use PostgreSQL as the primary datastore"
  reason: string; // e.g. "Transactional workload with relational integrity needs"
  date: string; // ISO date string, e.g. "2026-06-19"
  status?: string; // e.g. "accepted" (default applied by writer)
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @seos/architecture exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/architecture/src/types.ts
git commit -m "feat(architecture): add shared types"
```

---

## Task 2.2: `intake` — validate, normalize, derive scale

**Scale thresholds (documented, deterministic):** classify by the dominant signal — the max of (users-based tier, rps-based tier).
- users: `< 10_000` → small, `< 1_000_000` → medium, else large.
- rps: `< 50` → small, `< 1_000` → medium, else large.
- Final scale = the higher of the two tiers (large > medium > small).
- `multiRegion = expectedRegions > 1`.

**Validation:** all four numbers must be finite and `>= 0`; `expectedRegions` must be an integer `>= 1`. Invalid input throws an `Error` with a specific message.

**Files:**
- Create: `packages/architecture/src/intake.ts`
- Test: `packages/architecture/tests/intake.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { intake } from "../src/intake.js";

const base = { expectedUsers: 100, expectedRequestsPerSecond: 5, expectedDataSizeGb: 1, expectedRegions: 1 };

describe("intake", () => {
  it("derives small scale and single region for tiny inputs", () => {
    const p = intake(base);
    expect(p.scale).toBe("small");
    expect(p.multiRegion).toBe(false);
  });

  it("derives large scale when users are very high", () => {
    const p = intake({ ...base, expectedUsers: 5_000_000 });
    expect(p.scale).toBe("large");
  });

  it("derives large scale when RPS is very high even if users are low", () => {
    const p = intake({ ...base, expectedRequestsPerSecond: 5_000 });
    expect(p.scale).toBe("large");
  });

  it("takes the higher of the user-tier and rps-tier", () => {
    // users -> medium, rps -> small => medium
    const p = intake({ ...base, expectedUsers: 50_000, expectedRequestsPerSecond: 5 });
    expect(p.scale).toBe("medium");
  });

  it("flags multiRegion when regions > 1", () => {
    expect(intake({ ...base, expectedRegions: 3 }).multiRegion).toBe(true);
  });

  it("throws on negative numbers", () => {
    expect(() => intake({ ...base, expectedUsers: -1 })).toThrow();
  });

  it("throws when regions < 1", () => {
    expect(() => intake({ ...base, expectedRegions: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/architecture exec vitest run tests/intake.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import type { IntakeAnswers, RequirementsProfile, Scale } from "./types.js";

const TIER_ORDER: Scale[] = ["small", "medium", "large"];

function usersTier(users: number): Scale {
  if (users < 10_000) return "small";
  if (users < 1_000_000) return "medium";
  return "large";
}

function rpsTier(rps: number): Scale {
  if (rps < 50) return "small";
  if (rps < 1_000) return "medium";
  return "large";
}

function higher(a: Scale, b: Scale): Scale {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

function assertNonNegativeFinite(label: string, n: number): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`intake: ${label} must be a finite number >= 0 (got ${n})`);
  }
}

export function intake(answers: IntakeAnswers): RequirementsProfile {
  assertNonNegativeFinite("expectedUsers", answers.expectedUsers);
  assertNonNegativeFinite("expectedRequestsPerSecond", answers.expectedRequestsPerSecond);
  assertNonNegativeFinite("expectedDataSizeGb", answers.expectedDataSizeGb);
  if (!Number.isInteger(answers.expectedRegions) || answers.expectedRegions < 1) {
    throw new Error(`intake: expectedRegions must be an integer >= 1 (got ${answers.expectedRegions})`);
  }

  const scale = higher(usersTier(answers.expectedUsers), rpsTier(answers.expectedRequestsPerSecond));
  return { ...answers, scale, multiRegion: answers.expectedRegions > 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/architecture exec vitest run tests/intake.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/architecture/src/intake.ts packages/architecture/tests/intake.test.ts
git commit -m "feat(architecture): add requirements intake with scale derivation"
```

---

## Task 2.3: `generateArchitecture` — deterministic proposal

**Heuristics (documented, deterministic):**
- `datastore.primary` is always `"PostgreSQL"` (transactional, relational default).
- Add `datastore.cache = "Redis"` when `scale` is `"large"` OR `expectedRequestsPerSecond >= 1_000`.
- `services` starts with `["api"]`; append `"worker"` when `expectedRequestsPerSecond >= 100` (offload async work); append `"cdn"` when `multiRegion` is true (edge delivery).
- `deploymentModel = multiRegion ? "multi-region" : "single-region"`.
- `rationale` contains one explanatory string per decision actually made (primary store always; cache only if added; worker only if added; cdn only if added; deployment model always).

**Files:**
- Create: `packages/architecture/src/generateArchitecture.ts`
- Test: `packages/architecture/tests/generateArchitecture.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
    // primary + cache + worker + cdn + deployment = 5 rationale entries
    expect(p.rationale.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/architecture exec vitest run tests/generateArchitecture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/architecture exec vitest run tests/generateArchitecture.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/architecture/src/generateArchitecture.ts packages/architecture/tests/generateArchitecture.test.ts
git commit -m "feat(architecture): add deterministic architecture generator"
```

---

## Task 2.4: `reviewDesign` — rule engine

**Rules (documented; each returns 0 or 1 finding):**
1. `cache-required-at-scale` (**error**): `scale`-implied — if the proposal serves large scale (cache present is the signal of large) ... but reviewDesign only sees the proposal, not the profile. So rules operate on the proposal alone:
   - `multiregion-needs-cdn` (**error**): `deploymentModel === "multi-region"` but `services` does not include `"cdn"`.
   - `multiregion-needs-cache` (**warning**): `deploymentModel === "multi-region"` but `datastore.cache` is undefined (cross-region reads benefit from caching).
   - `no-services` (**error**): `services` is empty.
   - `primary-datastore-required` (**error**): `datastore.primary` is empty/missing.
2. `approved = findings.every(f => f.severity !== "error")` (warnings do not block).

This keeps `reviewDesign` a pure function of the proposal (composable with any proposal source, not just `generateArchitecture`).

**Files:**
- Create: `packages/architecture/src/reviewDesign.ts`
- Test: `packages/architecture/tests/reviewDesign.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/architecture exec vitest run tests/reviewDesign.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/architecture exec vitest run tests/reviewDesign.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/architecture/src/reviewDesign.ts packages/architecture/tests/reviewDesign.test.ts
git commit -m "feat(architecture): add design review rule engine"
```

---

## Task 2.5: `writeAdr` — sequential ADR file writer

**Behavior:**
- ADRs are markdown files in a directory (default `docs/adr`, overridable). Filenames: `NNNN-<slug>.md` where `NNNN` is a zero-padded sequential number (0001, 0002, …) computed from the highest existing `NNNN-*.md` in the dir, +1.
- `slug` = lowercased decision, non-alphanumeric runs collapsed to single hyphens, trimmed, truncated to 60 chars.
- File body is a conventional ADR: title, status (default `"accepted"`), date, Decision, Reason sections — machine-parseable for Phase 7 ingestion.
- Creates the directory if missing. Returns the absolute path written.
- The filesystem is injected (`FsLike`) so tests use a temp dir or an in-memory fake — but the default uses `node:fs/promises`.

**Files:**
- Create: `packages/architecture/src/adr.ts`
- Test: `packages/architecture/tests/adr.test.ts`

- [ ] **Step 1: Write the failing test** (uses a real temp dir via `node:os`/`node:fs`)

```typescript
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
    expect(body).toContain("accepted"); // default status
  });

  it("increments the number for subsequent ADRs", async () => {
    await writeAdr({ decision: "First", reason: "r1", date: "2026-06-19" }, dir);
    const second = await writeAdr({ decision: "Second", reason: "r2", date: "2026-06-19" }, dir);
    expect(second).toContain("0002-second.md");
    const files = (await readdir(dir)).sort();
    expect(files).toEqual(["0001-first.md", "0002-second.md"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/architecture exec vitest run tests/adr.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AdrRecord } from "./types.js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export async function nextAdrNumber(dir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 1; // directory does not exist yet
  }
  let max = 0;
  for (const name of entries) {
    const m = /^(\d{4})-.*\.md$/.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export async function writeAdr(record: AdrRecord, dir = "docs/adr"): Promise<string> {
  await mkdir(dir, { recursive: true });
  const n = await nextAdrNumber(dir);
  const num = String(n).padStart(4, "0");
  const slug = slugify(record.decision);
  const status = record.status ?? "accepted";
  const path = resolve(join(dir, `${num}-${slug}.md`));

  const body = [
    `# ${n}. ${record.decision}`,
    "",
    `- Status: ${status}`,
    `- Date: ${record.date}`,
    "",
    "## Decision",
    "",
    record.decision,
    "",
    "## Reason",
    "",
    record.reason,
    "",
  ].join("\n");

  await writeFile(path, body, "utf8");
  return path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/architecture exec vitest run tests/adr.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/architecture/src/adr.ts packages/architecture/tests/adr.test.ts
git commit -m "feat(architecture): add sequential ADR writer"
```

---

## Task 2.6: MCP server entry — register the four tools

**Files:**
- Create: `packages/architecture/src/index.ts`

> Reconcile against the installed `@modelcontextprotocol/sdk@1.29` API exactly as Phase 1 did: `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport` from `.../server/stdio.js`, register via `server.tool(name, description, zodShape, cb)` (zero-arg form `server.tool(name, description, cb)`), handlers return `{ content: [{ type: "text", text: string }] }`. If the installed signature differs, inspect the `.d.ts` and adapt the registration mechanics — keep tool names, inputs, and handler bodies as specified.

- [ ] **Step 1: Write the server entry**

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { intake } from "./intake.js";
import { generateArchitecture } from "./generateArchitecture.js";
import { reviewDesign } from "./reviewDesign.js";
import { writeAdr } from "./adr.js";

const ADR_DIR = process.env.SEOS_ADR_DIR ?? "docs/adr";

const server = new McpServer({ name: "seos-architecture", version: "0.1.0" });

const requirementsShape = {
  expectedUsers: z.number().nonnegative(),
  expectedRequestsPerSecond: z.number().nonnegative(),
  expectedDataSizeGb: z.number().nonnegative(),
  expectedRegions: z.number().int().min(1),
};

const proposalShape = {
  services: z.array(z.string()),
  datastore: z.object({ primary: z.string(), cache: z.string().optional() }),
  deploymentModel: z.enum(["single-region", "multi-region"]),
  rationale: z.array(z.string()),
};

server.tool(
  "intake_requirements",
  "Validate and normalize project scale requirements; derives scale and multi-region flags before any architecture is proposed.",
  requirementsShape,
  async (answers) => {
    const profile = intake(answers);
    return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
  },
);

server.tool(
  "generate_architecture",
  "Generate a deterministic architecture proposal (services, datastore, deployment model, rationale) from a requirements profile.",
  { ...requirementsShape, scale: z.enum(["small", "medium", "large"]), multiRegion: z.boolean() },
  async (profile) => {
    const proposal = generateArchitecture(profile);
    return { content: [{ type: "text", text: JSON.stringify(proposal, null, 2) }] };
  },
);

server.tool(
  "review_design",
  "Review an architecture proposal against design rules; returns approval status and findings.",
  proposalShape,
  async (proposal) => {
    const review = reviewDesign(proposal);
    return { content: [{ type: "text", text: JSON.stringify(review, null, 2) }] };
  },
);

server.tool(
  "write_adr",
  "Persist an Architecture Decision Record to disk with sequential numbering. Returns the file path.",
  { decision: z.string().min(1), reason: z.string().min(1), date: z.string().min(1), status: z.string().optional() },
  async (record) => {
    const path = await writeAdr(record, ADR_DIR);
    return { content: [{ type: "text", text: JSON.stringify({ path }, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @seos/architecture exec tsc --noEmit`
Expected: exit 0. (If the SDK `tool()` overload types reject a plain handler arg shape, mirror exactly what `@seos/knowledge/src/index.ts` does — that file is known-good against SDK 1.29.)

- [ ] **Step 3: Build**

Run: `pnpm --filter @seos/architecture build`
Expected: `packages/architecture/dist/index.js` produced, exit 0, shebang preserved on line 1.

- [ ] **Step 4: Commit**

```bash
git add packages/architecture/src/index.ts
git commit -m "feat(architecture): wire MCP server entry with four tools"
```

---

## Task 2.7: Full suite + smoke run + README

**Files:**
- Create: `packages/architecture/README.md`

- [ ] **Step 1: Run the full package suite**

Run: `pnpm --filter @seos/architecture test`
Expected: PASS — intake (7), generateArchitecture (7), reviewDesign (5), adr (4) = 23 tests.

- [ ] **Step 2: Smoke-test the built server over stdio** (5s timeout to avoid a hung stdio server)

Run (Git Bash):
```bash
cd "D:/Claude Code/Devkit"
timeout 5 bash -c 'printf "%s\n%s\n" "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"smoke\",\"version\":\"0.0.0\"}}}" "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{}}" | node packages/architecture/dist/index.js'
```
Expected: the id:2 response lists all four tools: `intake_requirements`, `generate_architecture`, `review_design`, `write_adr`.

- [ ] **Step 3: Write `packages/architecture/README.md`**

````markdown
# @seos/architecture

Phase 2 of the Engineering OS. An MCP server that makes the AI design architecture before writing code.

## Tools
- `intake_requirements` — validate/normalize scale inputs; derive scale + multi-region
- `generate_architecture` — deterministic proposal (services, datastore, deployment, rationale)
- `review_design` — rule-engine review of a proposal → approval + findings
- `write_adr` — persist an Architecture Decision Record (sequential `NNNN-slug.md`)

## Register with Claude Code

```json
{
  "mcpServers": {
    "seos-architecture": {
      "command": "node",
      "args": ["./packages/architecture/dist/index.js"],
      "env": { "SEOS_ADR_DIR": "./docs/adr" }
    }
  }
}
```

ADRs are written so they can be ingested by Phase 7 (Engineering Memory).
````

- [ ] **Step 4: Commit**

```bash
git add packages/architecture/README.md
git commit -m "feat(architecture): add README; Phase 2 complete"
```

**Phase 2 deliverable:** a runnable MCP server that enforces "architecture before code" — intake → proposal → review → ADR. ✅

---

## Self-Review (against the Phase 2 sub-plan)

- **intake** → `intake_requirements` ✅ (validation + scale derivation, Task 2.2)
- **generateArchitecture** → `generate_architecture` ✅ (deterministic proposal, Task 2.3)
- **reviewDesign** → `review_design` ✅ (rule engine, approval flips on error findings, Task 2.4)
- **ADR system** → `write_adr` ✅ (sequential numbering, machine-readable, Task 2.5)
- **Acceptance criteria** (from program plan): "returns an architecture proposal and a design-review verdict that rejects documented anti-patterns; ADRs are written to disk and machine-readable" — covered by Tasks 2.3/2.4 (rejects `multiregion-needs-cdn`, `no-services`, `primary-datastore-required`) and 2.5 (ADR files on disk with parseable headers).
- **Type consistency:** `RequirementsProfile` (intake out) = `generate_architecture` in; `ArchitectureProposal` (generate out) = `review_design` in; `AdrRecord` = `write_adr` in. Names match across tasks.
- **No placeholders:** every step has complete code and exact commands.
