# Phase 6 — DevOps Layer (`@seos/devops`) Implementation Plan

> **For agentic workers:** Execute task-by-task with strict TDD (failing test first → confirm fail → implement → confirm pass → commit). Steps use checkbox (`- [ ]`).

**Goal:** Ship `@seos/devops`, an MCP server that gives solo founders SRE-level practices: generate deployment infrastructure (Dockerfile, CI pipeline, health check), generate observability scaffolding (logging/metrics/tracing), and check reliability readiness (backup/restore/rollback).

**Architecture:** A package in the `engineering-os` pnpm monorepo, same stack/discipline as the other `@seos/*` packages (TypeScript, Node 24, ESM/NodeNext, `@modelcontextprotocol/sdk@^1.0.0`, Zod, Vitest, tsup). All tools are pure deterministic functions. **No new runtime dependencies.**

**Scope note:** Three tools — `generate_infra`, `generate_observability`, `check_reliability`. Generators emit conventional, templated text (a deployer adapts them); they are not provider-specific IaC. Documented as a v0.1 baseline.

---

## File Structure

```
packages/devops/
  package.json            # name @seos/devops, bin seos-devops
  tsconfig.json           # mirror architecture (rootDir ".", include ["src","tests"])
  vitest.config.ts        # mirror architecture
  src/
    index.ts              # MCP server; 3 tools
    types.ts              # InfraProfile, InfraArtifacts, ObservabilityConfig, ReliabilityConfig, ReliabilityResult
    generateInfra.ts
    generateObservability.ts
    checkReliability.ts
  tests/
    generateInfra.test.ts
    generateObservability.test.ts
    checkReliability.test.ts
  README.md
```

**Tool ↔ function map:**
| MCP tool | function | input | output |
|----------|----------|-------|--------|
| `generate_infra` | `generateInfra` | `InfraProfile` | `InfraArtifacts` |
| `generate_observability` | `generateObservability` | `{ appName }` | `ObservabilityConfig` |
| `check_reliability` | `checkReliability` | `ReliabilityConfig` | `ReliabilityResult` |

---

## Task 6.0: Scaffold `@seos/devops`
Mirror `packages/architecture` exactly, name `@seos/devops`, bin `seos-devops`.
- [ ] Create `package.json`, `tsconfig.json`, `vitest.config.ts` (mirror architecture).
- [ ] `pnpm install` from repo root (exit 0). Root `package.json` already has `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` — reuse; do not duplicate.
- [ ] Commit `chore(devops): scaffold @seos/devops package` (+ lockfile).

## Task 6.1: Shared types
**Files:** Create `packages/devops/src/types.ts`
- [ ] **Step 1: Write the types**
```typescript
export interface InfraProfile {
  appName: string;
  port: number;
  nodeVersion?: string; // default "24"
  startCommand?: string; // default "node dist/index.js"
}

export interface InfraArtifacts {
  dockerfile: string;
  ciPipeline: string;
  healthcheckPath: string;
}

export interface ObservabilityConfig {
  logging: string;
  metrics: string;
  tracing: string;
}

export interface ReliabilityConfig {
  backupStrategy?: string;
  restoreStrategy?: string;
  rollbackStrategy?: string;
}

export interface ReliabilityResult {
  ready: boolean;
  missing: string[];
}
```
- [ ] `pnpm --filter @seos/devops exec tsc --noEmit` → exit 0.
- [ ] Commit `feat(devops): add shared types`.

## Task 6.2: `checkReliability`
**Behavior:** `missing` = the strategy keys not provided (non-empty string required); `ready = missing.length === 0`. Order: backupStrategy, restoreStrategy, rollbackStrategy.
**Files:** Create `packages/devops/src/checkReliability.ts`, test `packages/devops/tests/checkReliability.test.ts`.
- [ ] **Step 1: Failing test**
```typescript
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
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**
```typescript
import type { ReliabilityConfig, ReliabilityResult } from "./types.js";

const REQUIRED: (keyof ReliabilityConfig)[] = ["backupStrategy", "restoreStrategy", "rollbackStrategy"];

export function checkReliability(config: ReliabilityConfig): ReliabilityResult {
  const missing = REQUIRED.filter((k) => !config[k] || config[k]!.trim() === "");
  return { ready: missing.length === 0, missing };
}
```
- [ ] **Step 4:** Run → 3 PASS. `tsc --noEmit` → 0.
- [ ] **Step 5:** Commit `feat(devops): add reliability readiness check`.

## Task 6.3: `generateInfra`
**Behavior:** Emit a Dockerfile (multi-stage-ish, `node:<version>-slim`, `EXPOSE <port>`, `HEALTHCHECK` hitting the health path, runs the start command), a GitHub Actions CI YAML (install → build → test on pnpm), and `healthcheckPath = "/health"`. Defaults: `nodeVersion = "24"`, `startCommand = "node dist/index.js"`.
**Files:** Create `packages/devops/src/generateInfra.ts`, test `packages/devops/tests/generateInfra.test.ts`.
- [ ] **Step 1: Failing test**
```typescript
import { describe, it, expect } from "vitest";
import { generateInfra } from "../src/generateInfra.js";

describe("generateInfra", () => {
  it("produces a Dockerfile pinned to the default node version exposing the port", () => {
    const a = generateInfra({ appName: "api", port: 8080 });
    expect(a.dockerfile).toContain("FROM node:24-slim");
    expect(a.dockerfile).toContain("EXPOSE 8080");
    expect(a.dockerfile).toContain("HEALTHCHECK");
    expect(a.dockerfile).toContain("node dist/index.js");
  });
  it("honors a custom node version and start command", () => {
    const a = generateInfra({ appName: "api", port: 3000, nodeVersion: "22", startCommand: "node server.js" });
    expect(a.dockerfile).toContain("FROM node:22-slim");
    expect(a.dockerfile).toContain("node server.js");
  });
  it("emits a CI pipeline that installs, builds and tests", () => {
    const a = generateInfra({ appName: "api", port: 8080 });
    expect(a.ciPipeline).toContain("pnpm install");
    expect(a.ciPipeline).toContain("pnpm -r build");
    expect(a.ciPipeline).toContain("pnpm -r test");
  });
  it("uses /health as the health check path", () => {
    expect(generateInfra({ appName: "api", port: 8080 }).healthcheckPath).toBe("/health");
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**
```typescript
import type { InfraArtifacts, InfraProfile } from "./types.js";

export function generateInfra(profile: InfraProfile): InfraArtifacts {
  const node = profile.nodeVersion ?? "24";
  const start = profile.startCommand ?? "node dist/index.js";
  const healthcheckPath = "/health";

  const dockerfile = [
    `FROM node:${node}-slim`,
    "WORKDIR /app",
    "COPY package.json pnpm-lock.yaml ./",
    "RUN corepack enable && pnpm install --frozen-lockfile",
    "COPY . .",
    "RUN pnpm -r build",
    `EXPOSE ${profile.port}`,
    `HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:${profile.port}${healthcheckPath} || exit 1`,
    `CMD ${start}`,
    "",
  ].join("\n");

  const ciPipeline = [
    "name: ci",
    "on: [push, pull_request]",
    "jobs:",
    "  build-test:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: pnpm/action-setup@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    `          node-version: ${node}`,
    "      - run: pnpm install --frozen-lockfile",
    "      - run: pnpm -r build",
    "      - run: pnpm -r test",
    "",
  ].join("\n");

  return { dockerfile, ciPipeline, healthcheckPath };
}
```
- [ ] **Step 4:** Run → 4 PASS. `tsc --noEmit` → 0.
- [ ] **Step 5:** Commit `feat(devops): add infrastructure generator`.

## Task 6.4: `generateObservability`
**Behavior:** Return three scaffolding snippets keyed by concern, each a string referencing a conventional tool and the app name. Markers: logging mentions `pino`, metrics mentions `prom-client` and `/metrics`, tracing mentions `OpenTelemetry`.
**Files:** Create `packages/devops/src/generateObservability.ts`, test `packages/devops/tests/generateObservability.test.ts`.
- [ ] **Step 1: Failing test**
```typescript
import { describe, it, expect } from "vitest";
import { generateObservability } from "../src/generateObservability.js";

describe("generateObservability", () => {
  it("emits logging, metrics and tracing scaffolding referencing the app name", () => {
    const o = generateObservability({ appName: "api" });
    expect(o.logging).toContain("pino");
    expect(o.metrics).toContain("prom-client");
    expect(o.metrics).toContain("/metrics");
    expect(o.tracing).toContain("OpenTelemetry");
    expect(o.logging).toContain("api");
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**
```typescript
import type { ObservabilityConfig } from "./types.js";

export function generateObservability(profile: { appName: string }): ObservabilityConfig {
  const { appName } = profile;
  return {
    logging: `// structured logging for ${appName}\nimport pino from "pino";\nexport const logger = pino({ name: "${appName}", level: process.env.LOG_LEVEL ?? "info" });`,
    metrics: `// metrics for ${appName}\nimport client from "prom-client";\nclient.collectDefaultMetrics();\n// expose at GET /metrics -> client.register.metrics()`,
    tracing: `// tracing for ${appName}\n// Initialize OpenTelemetry NodeSDK with an OTLP exporter and auto-instrumentations.`,
  };
}
```
- [ ] **Step 4:** Run → 1 PASS. `tsc --noEmit` → 0.
- [ ] **Step 5:** Commit `feat(devops): add observability scaffolding generator`.

## Task 6.5: MCP server entry
Mirror `packages/knowledge/src/index.ts`. Shebang line 1.
**Files:** Create `packages/devops/src/index.ts`
- [ ] **Step 1: Write the entry**
```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { generateInfra } from "./generateInfra.js";
import { generateObservability } from "./generateObservability.js";
import { checkReliability } from "./checkReliability.js";

const server = new McpServer({ name: "seos-devops", version: "0.1.0" });

server.tool(
  "generate_infra",
  "Generate deployment infrastructure (Dockerfile, CI pipeline, health check) for a service.",
  {
    appName: z.string(),
    port: z.coerce.number().int().positive(),
    nodeVersion: z.string().optional(),
    startCommand: z.string().optional(),
  },
  async (profile) => ({ content: [{ type: "text", text: JSON.stringify(generateInfra(profile), null, 2) }] }),
);

server.tool(
  "generate_observability",
  "Generate logging, metrics and tracing scaffolding for a service.",
  { appName: z.string() },
  async ({ appName }) => ({ content: [{ type: "text", text: JSON.stringify(generateObservability({ appName }), null, 2) }] }),
);

server.tool(
  "check_reliability",
  "Check whether backup, restore and rollback strategies are defined; reports what's missing.",
  {
    backupStrategy: z.string().optional(),
    restoreStrategy: z.string().optional(),
    rollbackStrategy: z.string().optional(),
  },
  async (config) => ({ content: [{ type: "text", text: JSON.stringify(checkReliability(config), null, 2) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```
- [ ] **Step 2:** `tsc --noEmit` → 0 (match knowledge/index.ts if SDK types complain).
- [ ] **Step 3:** `pnpm --filter @seos/devops build` → `dist/index.js`, shebang intact.
- [ ] **Step 4:** Commit `feat(devops): wire MCP server entry with three tools`.

## Task 6.6: Full suite + smoke + README
- [ ] **Step 1:** `pnpm --filter @seos/devops test` → expect checkReliability(3) + generateInfra(4) + generateObservability(1) = **8 tests**.
- [ ] **Step 2:** Stdio smoke (5s timeout) confirming 3 tools: `generate_infra`, `generate_observability`, `check_reliability`.
- [ ] **Step 3:** Write `packages/devops/README.md` — title `# @seos/devops`, tagline "Phase 6 of the Engineering OS. SRE practices for solo founders.", `## Tools` list (three), `## Register with Claude Code` JSON block (command `node`, args `./packages/devops/dist/index.js`), note: "Generators emit conventional templated scaffolding, not provider-specific IaC — adapt to your platform."
- [ ] **Step 4:** Commit `feat(devops): add README; Phase 6 complete`.

**Phase 6 deliverable:** runnable MCP server — infra generation, observability scaffolding, reliability checks. ✅

## Self-Review
- generateInfra → `generate_infra` ✅ ; generateObservability → `generate_observability` ✅ ; checkReliability → `check_reliability` ✅. Acceptance: reliability check reports each missing strategy; generated Dockerfile/CI/observability contain the expected markers. No placeholders.
