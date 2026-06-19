# AI Software Engineering Operating System (AI-SEOS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a governance layer ("Engineering OS") that sits between any coding LLM and production, enforcing engineering discipline — version/dependency governance, hallucination detection, architecture/security/QA/performance/DevOps review, engineering memory, and compliance — so a solo founder ships software with quality approaching a mature engineering org.

**Architecture:** A monorepo of MCP servers + agent definitions, all written in TypeScript on Node 24. Phase 1 ships a single runnable MCP server (`@seos/knowledge`) exposing four tools. Later phases add additional MCP servers and review agents that compose over Phase 1's primitives. Each phase is an independently shippable, testable subsystem.

**Tech Stack:** TypeScript 5.x, Node 24, `@modelcontextprotocol/sdk`, Zod (tool schemas), Vitest (tests), tsup (build), pnpm workspaces (monorepo).

---

## How to read this plan

This is a **program plan**, not a single sprint. It is divided into 10 phases mirroring the spec.

- **Phase 1 is fully executable** here: bite-sized TDD tasks with complete code. Implement it end-to-end first. At the end of Phase 1 you have a working, installable MCP server.
- **Phases 2-10 are structured sub-plans**: each defines scope, file layout, the public interface it must expose, an ordered task checklist, and acceptance criteria. **Before executing a Phase 2-10, re-invoke `superpowers:writing-plans` to expand that phase's checklist into full TDD tasks with code**, using the concrete artifacts Phase 1 produced. This is deliberate — writing exhaustive code now for tools that consume not-yet-existing outputs would be guesswork, which the writing-plans skill classifies as a plan failure.

**Dependency order:** Phase 1 → (Phase 7 Memory can start in parallel after Phase 1) → Phases 2-6 (each depends on Phase 1's knowledge tools) → Phase 8 (Review Board composes Phases 2-6 agents) → Phase 9 (Self-Healing needs Phase 6 observability + Phase 8 board) → Phase 10 (Compliance, last).

---

## Monorepo File Structure

```
engineering-os/
  package.json                # pnpm workspace root
  pnpm-workspace.yaml
  tsconfig.base.json
  packages/
    knowledge/                # Phase 1  — MCP server (BUILT IN FULL BELOW)
      package.json
      tsconfig.json
      src/
        index.ts              # MCP server entry; registers 4 tools
        types.ts              # shared types
        registry/
          npm.ts              # npm registry + downloads client
          node.ts             # Node.js release client
        tools/
          checkVersions.ts    # Version Validator
          verifyApi.ts        # Hallucination Detector
          auditDependency.ts  # Dependency Auditor
          getKnowledge.ts     # Knowledge lookup (curated + live)
        knowledge/
          store.ts            # curated knowledge profile loader
      tests/
        registry/npm.test.ts
        registry/node.test.ts
        tools/checkVersions.test.ts
        tools/verifyApi.test.ts
        tools/auditDependency.test.ts
        tools/getKnowledge.test.ts
    memory/                   # Phase 7  — sub-plan
    architecture/             # Phase 2  — sub-plan
    security/                 # Phase 3  — sub-plan
    qa/                       # Phase 4  — sub-plan
    performance/              # Phase 5  — sub-plan
    devops/                   # Phase 6  — sub-plan
    review-board/             # Phase 8  — sub-plan
    self-healing/             # Phase 9  — sub-plan
    compliance/               # Phase 10 — sub-plan
```

---

# PHASE 1 — Foundation (fully executable)

**Goal:** Prevent the LLM from generating dangerous or outdated code. Ship one MCP server, `@seos/knowledge`, exposing four tools: `check_versions`, `verify_api`, `audit_dependency`, `get_knowledge`.

**Why TDD here:** Every tool is a pure-ish function around a network client. We inject the `fetch` function so tests run offline with stubbed responses.

## Task 1.0: Monorepo + package scaffolding

**Files:**
- Create: `engineering-os/package.json`
- Create: `engineering-os/pnpm-workspace.yaml`
- Create: `engineering-os/tsconfig.base.json`
- Create: `engineering-os/packages/knowledge/package.json`
- Create: `engineering-os/packages/knowledge/tsconfig.json`
- Create: `engineering-os/packages/knowledge/vitest.config.ts`

- [ ] **Step 1: Create the workspace root `package.json`**

```json
{
  "name": "engineering-os",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Create `packages/knowledge/package.json`**

```json
{
  "name": "@seos/knowledge",
  "version": "0.1.0",
  "type": "module",
  "bin": { "seos-knowledge": "dist/index.js" },
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
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 5: Create `packages/knowledge/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `packages/knowledge/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 7: Install dependencies**

Run (from `engineering-os/`): `pnpm install`
Expected: pnpm resolves the `@seos/knowledge` workspace package and installs deps without error.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold engineering-os monorepo and @seos/knowledge package"
```

---

## Task 1.1: Shared types

**Files:**
- Create: `packages/knowledge/src/types.ts`

- [ ] **Step 1: Write the shared types**

```typescript
// Injected fetch signature so tools are testable offline.
export type FetchFn = typeof fetch;

export type VersionStatus = "ok" | "outdated" | "deprecated" | "unknown";

export interface VersionCheck {
  name: string;
  requested?: string;
  latest: string;
  deprecated: boolean;
  status: VersionStatus;
  reason?: string;
}

export type RiskRecommendation = "safe" | "caution" | "avoid";

export interface DependencyRisk {
  name: string;
  riskScore: number; // 0 (safe) .. 100 (very risky)
  signals: {
    lastPublishDays: number;
    weeklyDownloads: number;
    deprecated: boolean;
  };
  recommendation: RiskRecommendation;
}

export interface ApiCheck {
  package: string;
  symbolPath: string; // e.g. "user.createManyAndReturn"
  exists: boolean;
  checked: string[]; // path segments that resolved
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --filter @seos/knowledge exec tsc --noEmit`
Expected: PASS (no output, exit 0).

- [ ] **Step 3: Commit**

```bash
git add packages/knowledge/src/types.ts
git commit -m "feat(knowledge): add shared types"
```

---

## Task 1.2: npm registry client

**Files:**
- Create: `packages/knowledge/src/registry/npm.ts`
- Test: `packages/knowledge/tests/registry/npm.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { fetchPackageInfo, fetchWeeklyDownloads } from "../../src/registry/npm.js";

function stubFetch(body: unknown, ok = true): typeof fetch {
  return (async () =>
    ({
      ok,
      status: ok ? 200 : 404,
      json: async () => body,
    }) as Response) as unknown as typeof fetch;
}

describe("fetchPackageInfo", () => {
  it("returns latest version, deprecation, and last publish date", async () => {
    const now = new Date().toISOString();
    const info = await fetchPackageInfo(
      "prisma",
      stubFetch({
        "dist-tags": { latest: "8.0.0" },
        versions: { "8.0.0": { deprecated: undefined } },
        time: { "8.0.0": now },
      }),
    );
    expect(info.latest).toBe("8.0.0");
    expect(info.deprecated).toBe(false);
    expect(info.lastPublishIso).toBe(now);
  });

  it("flags deprecated when the latest version has a deprecated field", async () => {
    const info = await fetchPackageInfo(
      "request",
      stubFetch({
        "dist-tags": { latest: "2.88.2" },
        versions: { "2.88.2": { deprecated: "no longer maintained" } },
        time: { "2.88.2": "2020-01-01T00:00:00.000Z" },
      }),
    );
    expect(info.deprecated).toBe(true);
  });
});

describe("fetchWeeklyDownloads", () => {
  it("returns the downloads count", async () => {
    const n = await fetchWeeklyDownloads("prisma", stubFetch({ downloads: 1234567 }));
    expect(n).toBe(1234567);
  });

  it("returns 0 when the package is unknown", async () => {
    const n = await fetchWeeklyDownloads("nope-not-real", stubFetch({}, false));
    expect(n).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/registry/npm.test.ts`
Expected: FAIL — "Cannot find module '../../src/registry/npm.js'".

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { FetchFn } from "../types.js";

export interface PackageInfo {
  name: string;
  latest: string;
  deprecated: boolean;
  lastPublishIso: string;
}

export async function fetchPackageInfo(name: string, fetchFn: FetchFn = fetch): Promise<PackageInfo> {
  const res = await fetchFn(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!res.ok) {
    throw new Error(`npm registry returned ${res.status} for ${name}`);
  }
  const body = (await res.json()) as {
    "dist-tags"?: { latest?: string };
    versions?: Record<string, { deprecated?: string }>;
    time?: Record<string, string>;
  };
  const latest = body["dist-tags"]?.latest ?? "";
  const deprecated = Boolean(latest && body.versions?.[latest]?.deprecated);
  const lastPublishIso = (latest && body.time?.[latest]) || "";
  return { name, latest, deprecated, lastPublishIso };
}

export async function fetchWeeklyDownloads(name: string, fetchFn: FetchFn = fetch): Promise<number> {
  const res = await fetchFn(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`);
  if (!res.ok) return 0;
  const body = (await res.json()) as { downloads?: number };
  return body.downloads ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/registry/npm.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/knowledge/src/registry/npm.ts packages/knowledge/tests/registry/npm.test.ts
git commit -m "feat(knowledge): add npm registry client"
```

---

## Task 1.3: Node.js release client

**Files:**
- Create: `packages/knowledge/src/registry/node.ts`
- Test: `packages/knowledge/tests/registry/node.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { fetchLatestLtsNode } from "../../src/registry/node.js";

function stubFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => body }) as Response) as unknown as typeof fetch;
}

describe("fetchLatestLtsNode", () => {
  it("returns the highest LTS major version", async () => {
    const latest = await fetchLatestLtsNode(
      stubFetch([
        { version: "v24.1.0", lts: "Krypton" },
        { version: "v22.5.0", lts: "Jod" },
        { version: "v23.0.0", lts: false },
      ]),
    );
    expect(latest).toBe("24");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/registry/node.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { FetchFn } from "../types.js";

interface NodeRelease {
  version: string; // "v24.1.0"
  lts: string | false;
}

export async function fetchLatestLtsNode(fetchFn: FetchFn = fetch): Promise<string> {
  const res = await fetchFn("https://nodejs.org/dist/index.json");
  if (!res.ok) throw new Error(`nodejs.org returned ${res.status}`);
  const releases = (await res.json()) as NodeRelease[];
  const ltsMajors = releases
    .filter((r) => r.lts !== false)
    .map((r) => Number(r.version.replace(/^v/, "").split(".")[0]));
  if (ltsMajors.length === 0) return "";
  return String(Math.max(...ltsMajors));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/registry/node.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/knowledge/src/registry/node.ts packages/knowledge/tests/registry/node.test.ts
git commit -m "feat(knowledge): add node.js release client"
```

---

## Task 1.4: Version Validator (`check_versions` logic)

**Files:**
- Create: `packages/knowledge/src/tools/checkVersions.ts`
- Test: `packages/knowledge/tests/tools/checkVersions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { checkVersions } from "../../src/tools/checkVersions.js";

const fakeNpm = {
  async fetchPackageInfo(name: string) {
    const db: Record<string, { latest: string; deprecated: boolean; lastPublishIso: string }> = {
      prisma: { latest: "8.0.0", deprecated: false, lastPublishIso: "2026-05-01T00:00:00.000Z" },
      request: { latest: "2.88.2", deprecated: true, lastPublishIso: "2020-01-01T00:00:00.000Z" },
    };
    if (!db[name]) throw new Error("404");
    return { name, ...db[name] };
  },
};

describe("checkVersions", () => {
  it("marks an outdated package as outdated with the latest version", async () => {
    const [result] = await checkVersions([{ name: "prisma", requested: "5.0.0" }], fakeNpm);
    expect(result.status).toBe("outdated");
    expect(result.latest).toBe("8.0.0");
  });

  it("marks a matching package as ok", async () => {
    const [result] = await checkVersions([{ name: "prisma", requested: "8.0.0" }], fakeNpm);
    expect(result.status).toBe("ok");
  });

  it("marks a deprecated package as deprecated regardless of version", async () => {
    const [result] = await checkVersions([{ name: "request", requested: "2.88.2" }], fakeNpm);
    expect(result.status).toBe("deprecated");
    expect(result.reason).toContain("deprecated");
  });

  it("marks an unknown package as unknown", async () => {
    const [result] = await checkVersions([{ name: "does-not-exist" }], fakeNpm);
    expect(result.status).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/checkVersions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { VersionCheck } from "../types.js";
import { fetchPackageInfo, type PackageInfo } from "../registry/npm.js";

export interface NpmClient {
  fetchPackageInfo(name: string): Promise<PackageInfo>;
}

const defaultClient: NpmClient = { fetchPackageInfo: (n) => fetchPackageInfo(n) };

export interface VersionRequest {
  name: string;
  requested?: string;
}

export async function checkVersions(
  requests: VersionRequest[],
  client: NpmClient = defaultClient,
): Promise<VersionCheck[]> {
  return Promise.all(
    requests.map(async ({ name, requested }): Promise<VersionCheck> => {
      try {
        const info = await client.fetchPackageInfo(name);
        if (info.deprecated) {
          return {
            name,
            requested,
            latest: info.latest,
            deprecated: true,
            status: "deprecated",
            reason: `${name} is deprecated on the registry`,
          };
        }
        const status = requested && requested !== info.latest ? "outdated" : "ok";
        return {
          name,
          requested,
          latest: info.latest,
          deprecated: false,
          status,
          reason: status === "outdated" ? `requested ${requested}, latest is ${info.latest}` : undefined,
        };
      } catch {
        return { name, requested, latest: "", deprecated: false, status: "unknown" };
      }
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/checkVersions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/knowledge/src/tools/checkVersions.ts packages/knowledge/tests/tools/checkVersions.test.ts
git commit -m "feat(knowledge): add version validator"
```

---

## Task 1.5: Dependency Auditor (`audit_dependency` logic)

**Files:**
- Create: `packages/knowledge/src/tools/auditDependency.ts`
- Test: `packages/knowledge/tests/tools/auditDependency.test.ts`

**Risk model (documented so tests are deterministic):** start at 0. `+40` if deprecated. Add a "staleness" component: `min(40, floor(lastPublishDays / 30) * 5)` (5 points per month since last publish, capped at 40). Add a "popularity" component: `+20` if weeklyDownloads < 1000, `+10` if < 100000, else `+0`. Clamp 0..100. Recommendation: `>= 60` → `avoid`, `>= 30` → `caution`, else `safe`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { auditDependency } from "../../src/tools/auditDependency.js";

const client = {
  async fetchPackageInfo(name: string) {
    const map: Record<string, { latest: string; deprecated: boolean; lastPublishIso: string }> = {
      "fresh-popular": { latest: "1.0.0", deprecated: false, lastPublishIso: new Date().toISOString() },
      "old-niche": { latest: "1.0.0", deprecated: false, lastPublishIso: "2019-01-01T00:00:00.000Z" },
      "dead-pkg": { latest: "1.0.0", deprecated: true, lastPublishIso: "2018-01-01T00:00:00.000Z" },
    };
    return { name, ...map[name] };
  },
  async fetchWeeklyDownloads(name: string) {
    const map: Record<string, number> = { "fresh-popular": 5_000_000, "old-niche": 500, "dead-pkg": 50 };
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/auditDependency.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { DependencyRisk, RiskRecommendation } from "../types.js";
import { fetchPackageInfo, fetchWeeklyDownloads, type PackageInfo } from "../registry/npm.js";

export interface AuditClient {
  fetchPackageInfo(name: string): Promise<PackageInfo>;
  fetchWeeklyDownloads(name: string): Promise<number>;
}

const defaultClient: AuditClient = {
  fetchPackageInfo: (n) => fetchPackageInfo(n),
  fetchWeeklyDownloads: (n) => fetchWeeklyDownloads(n),
};

function daysSince(iso: string): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function recommend(score: number): RiskRecommendation {
  if (score >= 60) return "avoid";
  if (score >= 30) return "caution";
  return "safe";
}

export async function auditDependency(name: string, client: AuditClient = defaultClient): Promise<DependencyRisk> {
  const [info, weeklyDownloads] = await Promise.all([
    client.fetchPackageInfo(name),
    client.fetchWeeklyDownloads(name),
  ]);
  const lastPublishDays = daysSince(info.lastPublishIso);

  let score = 0;
  if (info.deprecated) score += 40;
  score += Math.min(40, Math.floor(lastPublishDays / 30) * 5);
  if (weeklyDownloads < 1000) score += 20;
  else if (weeklyDownloads < 100_000) score += 10;
  score = Math.max(0, Math.min(100, score));

  return {
    name,
    riskScore: score,
    signals: { lastPublishDays, weeklyDownloads, deprecated: info.deprecated },
    recommendation: recommend(score),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/auditDependency.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/knowledge/src/tools/auditDependency.ts packages/knowledge/tests/tools/auditDependency.test.ts
git commit -m "feat(knowledge): add dependency auditor with risk scoring"
```

---

## Task 1.6: Hallucination Detector (`verify_api` logic)

**Approach:** Resolve a package installed in a target project's `node_modules`, dynamically import it, and walk the dotted `symbolPath` over the resolved module object. If every segment resolves, the API exists. This catches calls like `prisma.user.createManyAndReturn` when the method does not exist on the installed version. The package's own module object is walked; an injectable `loadModule` keeps it testable without real installs.

**Files:**
- Create: `packages/knowledge/src/tools/verifyApi.ts`
- Test: `packages/knowledge/tests/tools/verifyApi.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { verifyApi } from "../../src/tools/verifyApi.js";

const fakePrismaModule = {
  user: {
    create() {},
    findMany() {},
    createMany() {},
    // note: createManyAndReturn intentionally absent
  },
};

const loader = async (pkg: string) => {
  if (pkg === "prisma") return fakePrismaModule;
  throw new Error("not installed");
};

describe("verifyApi", () => {
  it("confirms an existing method path", async () => {
    const r = await verifyApi("prisma", "user.create", loader);
    expect(r.exists).toBe(true);
    expect(r.checked).toEqual(["user", "create"]);
  });

  it("rejects a hallucinated method path", async () => {
    const r = await verifyApi("prisma", "user.createManyAndReturn", loader);
    expect(r.exists).toBe(false);
    expect(r.checked).toEqual(["user"]); // resolved up to the missing segment
  });

  it("returns exists=false when the package is not installed", async () => {
    const r = await verifyApi("ghost-pkg", "x.y", loader);
    expect(r.exists).toBe(false);
    expect(r.checked).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/verifyApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { ApiCheck } from "../types.js";

export type ModuleLoader = (pkg: string) => Promise<unknown>;

const defaultLoader: ModuleLoader = (pkg) => import(pkg);

export async function verifyApi(
  pkg: string,
  symbolPath: string,
  loader: ModuleLoader = defaultLoader,
): Promise<ApiCheck> {
  let mod: unknown;
  try {
    mod = await loader(pkg);
  } catch {
    return { package: pkg, symbolPath, exists: false, checked: [] };
  }

  const segments = symbolPath.split(".").filter(Boolean);
  const checked: string[] = [];
  let current: unknown = mod;

  for (const seg of segments) {
    if (current !== null && typeof current === "object" && seg in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[seg];
      checked.push(seg);
    } else {
      return { package: pkg, symbolPath, exists: false, checked };
    }
  }

  return { package: pkg, symbolPath, exists: true, checked };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/verifyApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/knowledge/src/tools/verifyApi.ts packages/knowledge/tests/tools/verifyApi.test.ts
git commit -m "feat(knowledge): add hallucination detector (verify_api)"
```

---

## Task 1.7: Knowledge store + `get_knowledge`

**Approach:** A curated, on-disk JSON profile of "authoritative" stack recommendations (the YAML-style truth the spec wants the LLM to read before coding), merged with live `check_versions` lookups. The store reads a `knowledge.json` file; `get_knowledge` returns the recommended stack plus live-validated latest versions.

**Files:**
- Create: `packages/knowledge/src/knowledge/store.ts`
- Create: `packages/knowledge/src/tools/getKnowledge.ts`
- Test: `packages/knowledge/tests/tools/getKnowledge.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { getKnowledge } from "../../src/tools/getKnowledge.js";

const store = {
  async loadProfile() {
    return {
      framework: "Next.js",
      runtime: "Node",
      orm: "Prisma",
      recommendedPackages: ["next", "prisma"],
    };
  },
};

const versionChecker = async (names: string[]) =>
  names.map((name) => ({
    name,
    latest: name === "next" ? "17.0.0" : "8.0.0",
    deprecated: false,
    status: "ok" as const,
  }));

describe("getKnowledge", () => {
  it("returns the curated profile enriched with live latest versions", async () => {
    const result = await getKnowledge(store, versionChecker);
    expect(result.framework).toBe("Next.js");
    expect(result.packages.find((p) => p.name === "next")?.latest).toBe("17.0.0");
    expect(result.packages.find((p) => p.name === "prisma")?.latest).toBe("8.0.0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/getKnowledge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the knowledge store**

```typescript
// packages/knowledge/src/knowledge/store.ts
import { readFile } from "node:fs/promises";

export interface StackProfile {
  framework: string;
  runtime: string;
  orm: string;
  recommendedPackages: string[];
}

export interface KnowledgeStore {
  loadProfile(): Promise<StackProfile>;
}

export function fileKnowledgeStore(path: string): KnowledgeStore {
  return {
    async loadProfile() {
      const raw = await readFile(path, "utf8");
      return JSON.parse(raw) as StackProfile;
    },
  };
}
```

- [ ] **Step 4: Write `getKnowledge`**

```typescript
// packages/knowledge/src/tools/getKnowledge.ts
import type { KnowledgeStore } from "../knowledge/store.js";
import type { VersionCheck } from "../types.js";

export type VersionCheckerFn = (names: string[]) => Promise<Pick<VersionCheck, "name" | "latest">[]>;

export interface KnowledgeResult {
  framework: string;
  runtime: string;
  orm: string;
  packages: { name: string; latest: string }[];
}

export async function getKnowledge(store: KnowledgeStore, checker: VersionCheckerFn): Promise<KnowledgeResult> {
  const profile = await store.loadProfile();
  const checks = await checker(profile.recommendedPackages);
  return {
    framework: profile.framework,
    runtime: profile.runtime,
    orm: profile.orm,
    packages: checks.map((c) => ({ name: c.name, latest: c.latest })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @seos/knowledge exec vitest run tests/tools/getKnowledge.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add packages/knowledge/src/knowledge/store.ts packages/knowledge/src/tools/getKnowledge.ts packages/knowledge/tests/tools/getKnowledge.test.ts
git commit -m "feat(knowledge): add curated knowledge store and get_knowledge tool"
```

---

## Task 1.8: MCP server entry — register the four tools

**Files:**
- Create: `packages/knowledge/src/index.ts`

- [ ] **Step 1: Write the server entry**

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { checkVersions } from "./tools/checkVersions.js";
import { auditDependency } from "./tools/auditDependency.js";
import { verifyApi } from "./tools/verifyApi.js";
import { getKnowledge } from "./tools/getKnowledge.js";
import { fileKnowledgeStore } from "./knowledge/store.js";

const KNOWLEDGE_PATH = process.env.SEOS_KNOWLEDGE_PATH ?? "./knowledge.json";

const server = new McpServer({ name: "seos-knowledge", version: "0.1.0" });

server.tool(
  "check_versions",
  "Validate package versions against the live npm registry; flags outdated and deprecated packages.",
  { packages: z.array(z.object({ name: z.string(), requested: z.string().optional() })) },
  async ({ packages }) => {
    const results = await checkVersions(packages);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  },
);

server.tool(
  "audit_dependency",
  "Audit a dependency for security/abandonment risk; returns a 0-100 risk score.",
  { name: z.string() },
  async ({ name }) => {
    const result = await auditDependency(name);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "verify_api",
  "Verify that a dotted symbol path (e.g. user.createManyAndReturn) exists on an installed package.",
  { package: z.string(), symbolPath: z.string() },
  async ({ package: pkg, symbolPath }) => {
    const result = await verifyApi(pkg, symbolPath);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_knowledge",
  "Return the curated authoritative stack profile enriched with live latest versions.",
  {},
  async () => {
    const result = await getKnowledge(fileKnowledgeStore(KNOWLEDGE_PATH), async (names) =>
      (await checkVersions(names.map((name) => ({ name })))).map((c) => ({ name: c.name, latest: c.latest })),
    );
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --filter @seos/knowledge exec tsc --noEmit`
Expected: PASS (exit 0). If the SDK's `server.tool` signature differs in the installed `@modelcontextprotocol/sdk` version, adjust the registration calls to match the SDK's current API (check `node_modules/@modelcontextprotocol/sdk/dist/server/mcp.d.ts`), keeping each tool's name, description, schema, and handler body identical.

- [ ] **Step 3: Build**

Run: `pnpm --filter @seos/knowledge build`
Expected: `dist/index.js` produced, exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/knowledge/src/index.ts
git commit -m "feat(knowledge): wire MCP server entry with four tools"
```

---

## Task 1.9: Full suite + smoke run + sample knowledge profile

**Files:**
- Create: `packages/knowledge/knowledge.json`
- Create: `packages/knowledge/README.md`

- [ ] **Step 1: Create a sample `knowledge.json`**

```json
{
  "framework": "Next.js",
  "runtime": "Node",
  "orm": "Prisma",
  "recommendedPackages": ["next", "prisma", "zod"]
}
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm --filter @seos/knowledge test`
Expected: PASS — all suites green (npm, node, checkVersions, auditDependency, verifyApi, getKnowledge).

- [ ] **Step 3: Smoke-test the built server over stdio**

Run:
```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node packages/knowledge/dist/index.js
```
Expected: a JSON-RPC response listing the four tools (`check_versions`, `audit_dependency`, `verify_api`, `get_knowledge`). If the SDK requires an `initialize` handshake first, prepend an `initialize` request line; the goal is to see the tool list returned without a crash.

- [ ] **Step 4: Write the README with the Claude Code MCP registration snippet**

````markdown
# @seos/knowledge

Phase 1 of the Engineering OS. An MCP server that prevents outdated/dangerous code.

## Tools
- `check_versions` — validate package versions vs npm registry
- `audit_dependency` — 0-100 abandonment/risk score
- `verify_api` — hallucination detector for installed packages
- `get_knowledge` — curated authoritative stack profile + live versions

## Register with Claude Code

```json
{
  "mcpServers": {
    "seos-knowledge": {
      "command": "node",
      "args": ["./packages/knowledge/dist/index.js"],
      "env": { "SEOS_KNOWLEDGE_PATH": "./packages/knowledge/knowledge.json" }
    }
  }
}
```
````

- [ ] **Step 5: Commit**

```bash
git add packages/knowledge/knowledge.json packages/knowledge/README.md
git commit -m "feat(knowledge): add sample knowledge profile and README; Phase 1 complete"
```

**Phase 1 deliverable:** a runnable MCP server that any coding LLM (via Claude Code) can call to avoid outdated versions, abandoned dependencies, and hallucinated APIs. ✅

---

# PHASES 2-10 — Structured Sub-Plans

> Each phase below is a self-contained subsystem. **When you reach a phase, re-invoke `superpowers:writing-plans` with that phase's sub-plan as the spec** to expand the task checklist into full TDD tasks with code, using Phase 1's actual artifacts. The interfaces below are the contract each phase must honor.

---

## PHASE 2 — Engineering Quality Layer

**Goal:** Make the AI design architecture before code. Ship `@seos/architecture` (MCP server + agent prompt).

**File layout:** `packages/architecture/src/{index.ts, intake.ts, designReview.ts, adr.ts}`, tests alongside.

**Public interface (must expose):**
- `intake(answers)` → captures `expected_users`, `expected_requests`, `expected_data_size`, `expected_regions` and returns a normalized `RequirementsProfile`.
- `generateArchitecture(profile)` → returns a structured architecture proposal (services, data stores, boundaries) — **not** code.
- `reviewDesign(proposal)` → `{ approved: boolean; findings: Finding[] }` over service boundaries, DB design, API design.
- `writeAdr(decision)` → persists an Architecture Decision Record (`{ decision, reason, date, status }`) to `docs/adr/NNNN-*.md`. ADRs feed Phase 7 memory.

**Task checklist (expand into TDD):**
- [ ] Scaffold `@seos/architecture` package (mirror Task 1.0).
- [ ] `RequirementsProfile` types + `intake` with validation; tests for missing/over-spec answers.
- [ ] `generateArchitecture` deterministic skeleton + heuristics (e.g. >1 region ⇒ recommend stateless services + managed DB); tests on representative profiles.
- [ ] `reviewDesign` rule set (boundary coupling, missing pagination, unindexed FKs); tests asserting `approved` flips on violations.
- [ ] `writeAdr` file writer with sequential numbering; test against a temp dir.
- [ ] MCP entry registering all four tools; smoke run.

**Acceptance criteria:** Given a requirements profile, the server returns an architecture proposal and a design-review verdict that rejects at least the documented anti-patterns; ADRs are written to disk and are machine-readable for Phase 7.

---

## PHASE 3 — Security Layer

**Goal:** Automate security review to match a dedicated security engineer. Ship `@seos/security`.

**File layout:** `packages/security/src/{index.ts, secrets.ts, authReview.ts, inputValidation.ts, vulnScan.ts, threatModel.ts}`.

**Public interface:**
- `scanSecrets(files)` → flags secrets (e.g. `OPENAI_API_KEY`) reachable from frontend bundles; returns `Finding[]` with file + line.
- `reviewAuth(spec)` → checks session management, RBAC, OAuth flows.
- `checkInputValidation(routes)` → flags SQLi/XSS/CSRF/SSRF exposure points.
- `scanVulnerabilities(deps)` → live CVE lookup (OSV.dev API: `https://api.osv.dev/v1/query`); composes with Phase 1 `audit_dependency`.
- `threatModel(architecture)` → `{ risks: ThreatRisk[] }` (e.g. `account_takeover`, `privilege_escalation`).

**Task checklist (expand into TDD):**
- [ ] Scaffold package.
- [ ] Secret scanner with a rules table (regex + frontend-reachability heuristic); tests on planted secrets.
- [ ] OSV.dev client with injectable `fetch` (mirror Phase 1 registry pattern); tests with stubbed CVE responses.
- [ ] Auth/input-validation rule engines with `Finding[]` output; tests per rule.
- [ ] `threatModel` mapping architecture (Phase 2 output) → ranked risks; tests on sample architectures.
- [ ] MCP entry + smoke run.

**Acceptance criteria:** Detects a frontend-exposed API key, reports at least one real CVE for a known-vulnerable test dependency via OSV, and emits a threat model from a Phase 2 architecture proposal.

---

## PHASE 4 — Quality Assurance Layer

**Goal:** Remove human QA bottlenecks. Ship `@seos/qa`.

**File layout:** `packages/qa/src/{index.ts, testGenerator.ts, coverage.ts, regression.ts}`.

**Public interface:**
- `generateTests(sourceFile, kind)` where `kind ∈ {unit, integration, e2e}` → returns test source.
- `checkCoverage(report, { minimum })` → `{ passed: boolean; actual: number }`; default minimum 80%.
- `detectRegressions(baseline, current)` → list of previously-passing tests now failing.

**Task checklist (expand into TDD):**
- [ ] Scaffold package.
- [ ] Coverage gate parser (read Vitest/Istanbul `coverage-summary.json`); tests on sample reports above/below threshold.
- [ ] Regression differ over two test-run JSON outputs; tests on flip cases.
- [ ] Test generator: parse exports of a target file, emit skeleton tests per public function; tests asserting generated tests reference real symbols (reuse Phase 1 `verify_api` to avoid hallucinated calls).
- [ ] MCP entry + smoke run.

**Acceptance criteria:** Coverage gate fails a sub-80% report; regression detector flags a newly-broken test; generated tests reference only real exported symbols.

---

## PHASE 5 — Performance Layer

**Goal:** Prevent scaling disasters. Ship `@seos/performance`.

**File layout:** `packages/performance/src/{index.ts, backendAnalyzer.ts, frontendAnalyzer.ts, loadSim.ts}`.

**Public interface:**
- `analyzeBackend(source)` → flags N+1 queries, missing indexes, inefficient joins.
- `analyzeFrontend(buildStats)` → flags large bundles, hydration issues, render loops (parse bundler stats JSON).
- `simulateLoad(target, { concurrency })` → runs staged stress (100 / 1000 / 10000) and returns latency/error metrics.

**Task checklist (expand into TDD):**
- [ ] Scaffold package.
- [ ] Static N+1 detector (loop containing an awaited query call) over an AST; tests on planted N+1 and clean code.
- [ ] Bundle-size analyzer reading `stats.json`; tests against over/under budget fixtures.
- [ ] Load simulator wrapping a load tool (e.g. autocannon) with injectable runner; tests on a stubbed runner.
- [ ] MCP entry + smoke run.

**Acceptance criteria:** Flags a planted N+1 query and an over-budget bundle; load sim produces staged metrics from a stubbed runner.

---

## PHASE 6 — DevOps Layer

**Goal:** SRE-level practices for solo founders. Ship `@seos/devops`.

**File layout:** `packages/devops/src/{index.ts, infra.ts, observability.ts, reliability.ts}`.

**Public interface:**
- `generateInfra(profile)` → emits Dockerfile, CI/CD pipeline, health checks, rollback config from a Phase 2 profile.
- `generateObservability(profile)` → logging/metrics/tracing scaffolding.
- `checkReliability(config)` → verifies `backup_strategy`, `restore_strategy`, `rollback_strategy` are defined; `{ ready: boolean; missing: string[] }`.

**Task checklist (expand into TDD):**
- [ ] Scaffold package.
- [ ] Reliability checker over a config object; tests for each missing-strategy case.
- [ ] Infra generators (templated, deterministic) with golden-file tests.
- [ ] Observability scaffolding generator with golden-file tests.
- [ ] MCP entry + smoke run.

**Acceptance criteria:** Reliability check reports each missing strategy; generated Dockerfile/CI/observability match golden files.

---

## PHASE 7 — Engineering Memory

**Goal:** Persistent institutional memory. Ship `@seos/memory`. **Can begin right after Phase 1.**

**File layout:** `packages/memory/src/{index.ts, store.ts, decision.ts, context.ts, history.ts}`. Storage: SQLite (`better-sqlite3`) or JSON-backed store behind an interface.

**Public interface:**
- `recordDecision({ decision, reason, date })` and `getDecisions(query)`.
- `setContext({ architecture, constraints, businessGoals, techStack })` and `getContext()`.
- `recordHistory({ type: "bug"|"incident"|"bottleneck", summary, date })` and `searchHistory(query)`.
- All retrievable by later AI sessions via MCP `resources` so context survives sessions. ADRs from Phase 2 are ingested here.

**Task checklist (expand into TDD):**
- [ ] Scaffold package + storage interface with an in-memory impl for tests.
- [ ] Decision store CRUD + query; tests.
- [ ] Context store get/set with merge semantics; tests.
- [ ] History store append + search; tests.
- [ ] Persistent (SQLite/JSON) impl behind the same interface; tests against a temp file.
- [ ] MCP entry exposing tools **and** resources; smoke run.

**Acceptance criteria:** Decisions/context/history persist across process restarts and are queryable; ADRs written in Phase 2 are importable.

---

## PHASE 8 — Multi-Agent Review Board

**Goal:** Mimic an engineering org's PR review. Ship `@seos/review-board` orchestrator that composes Phases 2-6 (+ a Documentation agent).

**File layout:** `packages/review-board/src/{index.ts, board.ts, agents/*.ts, verdict.ts}`.

**Public interface:**
- Each agent implements `review(pr): Promise<{ vote: "approve"|"reject"; recommendations: string[] }>`.
- `runBoard(pr)` → aggregates votes from Architecture, Security, QA, Performance, DevOps, Documentation agents → `{ approved: boolean; votes: Vote[] }`. `approved` only when no agent rejects.

**Task checklist (expand into TDD):**
- [ ] Scaffold package + `ReviewAgent` interface.
- [ ] Adapter for each Phase 2-6 server into a `ReviewAgent`; tests with stubbed agents.
- [ ] Documentation agent (checks README/ADR/API docs presence); tests.
- [ ] `runBoard` aggregation + veto logic; tests for unanimous-approve and single-reject cases.
- [ ] MCP entry + smoke run.

**Acceptance criteria:** A PR with a security finding is rejected by the board; a clean PR is approved; verdict records each agent's vote and recommendations.

---

## PHASE 9 — Self-Healing Development

**Goal:** Continuous monitor → diagnose → fix → PR loop (human approves). Ship `@seos/self-healing`. **Depends on Phase 6 (observability) + Phase 8 (board).**

**File layout:** `packages/self-healing/src/{index.ts, monitor.ts, rootCause.ts, fixProposer.ts, prCreator.ts}`.

**Public interface:**
- `ingestSignals(logs|errors|metrics)` → `Issue[]`.
- `rootCause(issue)` → `{ hypothesis, evidence }`.
- `proposeFix(rootCause)` → patch + generated tests (reuses Phase 4 `generateTests`).
- `createPr(fix)` → opens a PR via `gh`; **never auto-merges** — Phase 8 board + human approve.

**Task checklist (expand into TDD):**
- [ ] Scaffold package.
- [ ] Signal ingestion + deduplication into `Issue[]`; tests on sample log streams.
- [ ] Root-cause correlation (stack-trace → source map) with injectable inputs; tests.
- [ ] Fix proposer producing patch + tests; tests asserting tests accompany every patch.
- [ ] PR creator wrapping `gh` behind an injectable runner; tests on stubbed runner; assert no merge call.
- [ ] MCP entry + smoke run.

**Acceptance criteria:** From a sample error signal, produces a root-cause hypothesis, a patch with accompanying tests, and opens (not merges) a PR via a stubbed `gh`.

---

## PHASE 10 — Enterprise / Compliance Mode

**Goal:** Compete with internal engineering platforms. Ship `@seos/compliance`.

**File layout:** `packages/compliance/src/{index.ts, soc2.ts, gdpr.ts, hipaa.ts, pci.ts, auditLog.ts}`.

**Public interface:**
- `checkSoc2(system)`, `checkGdpr(system)`, `checkHipaa(system)`, `checkPci(system)` → each returns `{ compliant: boolean; gaps: Gap[] }` against a documented control checklist.
- `appendAuditLog(event)` → tamper-evident (hash-chained) audit log; `verifyAuditLog()` → integrity check.

**Task checklist (expand into TDD):**
- [ ] Scaffold package.
- [ ] Hash-chained audit log writer + verifier; tests detecting tampering.
- [ ] One compliance checker per framework over a documented control table; tests per gap.
- [ ] MCP entry + smoke run.

**Acceptance criteria:** Each checker reports specific control gaps for a non-compliant system; audit-log verification detects a tampered entry.

---

## Program-level acceptance

- Every package is independently installable and registerable as an MCP server in Claude Code.
- Phase 1 runs today; each later phase composes over Phase 1's `check_versions` / `audit_dependency` / `verify_api`.
- The Review Board (Phase 8) gates production; Self-Healing (Phase 9) never merges without board + human approval; Compliance (Phase 10) is the final gate.
