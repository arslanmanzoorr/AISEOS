# Phase 3 — Security Layer (`@seos/security`) Implementation Plan

> **For agentic workers:** Execute task-by-task with strict TDD (failing test first → confirm fail → implement → confirm pass → commit). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `@seos/security`, an MCP server that performs automatic security review: secret scanning, live CVE/vulnerability scanning (OSV.dev), static injection/XSS detection, and threat modeling.

**Architecture:** A package in the `engineering-os` pnpm monorepo. Same stack/discipline as `@seos/knowledge` and `@seos/architecture`: TypeScript, Node 24, ESM/NodeNext, `@modelcontextprotocol/sdk@1.29`, Zod, Vitest, tsup. All tools are deterministic with dependency injection (the OSV client takes an injectable `fetch`) so the suite runs offline. **No new runtime dependencies.**

**Tech Stack:** TypeScript 5.5+, Node 24, `@modelcontextprotocol/sdk@^1.0.0`, `zod@^3.23`, Vitest 2, tsup. Reuses root `tsconfig.base.json`.

**Scope note:** Four tools — `scan_secrets`, `scan_dependencies`, `scan_code`, `threat_model`. Dedicated auth-flow review (session/RBAC/OAuth) is **deferred** to a later iteration — it is hard to do deterministically well and is partially covered by `scan_code`. This is documented in the README.

---

## File Structure

```
packages/security/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts             # MCP server; 4 tools
    types.ts             # Severity, SourceFile, Finding, DependencyRef, Vulnerability, SystemDescriptor, ThreatRisk
    scanSecrets.ts       # regex secret rules + frontend-reachability escalation
    scanDependencies.ts  # OSV.dev client (injectable fetch)
    scanCode.ts          # static injection/XSS/eval/command-injection rules
    threatModel.ts       # deterministic system->risks mapping
  tests/
    scanSecrets.test.ts
    scanDependencies.test.ts
    scanCode.test.ts
    threatModel.test.ts
  README.md
```

**Tool ↔ function map:**
| MCP tool | function | input | output |
|----------|----------|-------|--------|
| `scan_secrets` | `scanSecrets` | `{ files: SourceFile[] }` | `Finding[]` |
| `scan_dependencies` | `scanVulnerabilities` | `{ dependencies: DependencyRef[] }` | `Vulnerability[]` |
| `scan_code` | `scanCode` | `{ files: SourceFile[] }` | `Finding[]` |
| `threat_model` | `threatModel` | `SystemDescriptor` | `ThreatRisk[]` |

---

## Task 3.0: Scaffold `@seos/security`

**Mirror `packages/architecture` exactly** (it is known-good), changing only the name.

- [ ] **Step 1: Create `packages/security/package.json`** — identical to `packages/architecture/package.json` except `"name": "@seos/security"` and `"bin": { "seos-security": "dist/index.js" }`.
- [ ] **Step 2: Create `packages/security/tsconfig.json`** — identical to `packages/architecture/tsconfig.json` (`extends ../../tsconfig.base.json`, `rootDir: "."`, `outDir: "dist"`, `include: ["src","tests"]`).
- [ ] **Step 3: Create `packages/security/vitest.config.ts`** — identical to `packages/architecture/vitest.config.ts`.
- [ ] **Step 4:** Run `pnpm install` from repo root (exit 0).
- [ ] **Step 5: Commit** `chore(security): scaffold @seos/security package` (add the three files + `pnpm-lock.yaml`).

---

## Task 3.1: Shared types

**Files:** Create `packages/security/src/types.ts`

- [ ] **Step 1: Write the types**

```typescript
export type FetchFn = typeof fetch;

export type Severity = "critical" | "high" | "medium" | "low";

export interface SourceFile {
  path: string;
  content: string;
}

export interface Finding {
  severity: Severity;
  rule: string; // stable rule id
  message: string;
  file?: string;
  line?: number; // 1-based
}

export interface DependencyRef {
  name: string;
  version: string;
}

export interface Vulnerability {
  package: string;
  version: string;
  id: string; // e.g. OSV/GHSA id
  summary: string;
  severity: Severity;
}

export interface SystemDescriptor {
  hasAuth: boolean;
  publicApi: boolean;
  storesPii: boolean;
  multiService: boolean;
}

export interface ThreatRisk {
  id: string; // e.g. "account_takeover"
  title: string;
  mitigation: string;
}
```

- [ ] **Step 2:** `pnpm --filter @seos/security exec tsc --noEmit` → exit 0.
- [ ] **Step 3: Commit** `feat(security): add shared types`.

---

## Task 3.2: `scanSecrets`

**Rules (documented):** non-global regexes (no `/g` — avoids `lastIndex` state). Scan line by line; report 1-based line numbers. When a secret-like value appears in a **frontend-reachable** file, emit an additional `secret-in-frontend` finding (critical).

- `isFrontendPath(path)` = `/(?:\.(?:jsx|tsx)$)|(?:^|\/)(?:components|pages|public|app|client)(?:\/|$)/.test(path)`.

**Files:** Create `packages/security/src/scanSecrets.ts`, test `packages/security/tests/scanSecrets.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { scanSecrets } from "../src/scanSecrets.js";

describe("scanSecrets", () => {
  it("detects an OpenAI key", () => {
    const f = scanSecrets([{ path: "server/config.ts", content: "const k = 'sk-abcdefghijklmnopqrstuvwxyz0123';" }]);
    expect(f.some((x) => x.rule === "openai-api-key")).toBe(true);
  });

  it("detects an AWS access key id", () => {
    const f = scanSecrets([{ path: "server/aws.ts", content: "AKIAIOSFODNN7EXAMPLE" }]);
    expect(f.some((x) => x.rule === "aws-access-key-id")).toBe(true);
  });

  it("detects a private key block", () => {
    const f = scanSecrets([{ path: "k.pem", content: "-----BEGIN RSA PRIVATE KEY-----" }]);
    expect(f.some((x) => x.rule === "private-key")).toBe(true);
  });

  it("escalates with secret-in-frontend when the file is frontend-reachable", () => {
    const f = scanSecrets([{ path: "app/components/Chat.tsx", content: "const k = 'sk-abcdefghijklmnopqrstuvwxyz0123';" }]);
    expect(f.some((x) => x.rule === "secret-in-frontend" && x.severity === "critical")).toBe(true);
  });

  it("reports the 1-based line number", () => {
    const f = scanSecrets([{ path: "server/x.ts", content: "line1\nAKIAIOSFODNN7EXAMPLE" }]);
    expect(f.find((x) => x.rule === "aws-access-key-id")?.line).toBe(2);
  });

  it("returns no findings for clean content", () => {
    expect(scanSecrets([{ path: "server/clean.ts", content: "const x = 1;" }])).toEqual([]);
  });
});
```

- [ ] **Step 2:** Run test → FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
import type { Finding, Severity, SourceFile } from "./types.js";

interface SecretRule {
  rule: string;
  severity: Severity;
  regex: RegExp;
}

const SECRET_RULES: SecretRule[] = [
  { rule: "openai-api-key", severity: "critical", regex: /sk-[A-Za-z0-9]{20,}/ },
  { rule: "aws-access-key-id", severity: "critical", regex: /AKIA[0-9A-Z]{16}/ },
  { rule: "private-key", severity: "critical", regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  {
    rule: "generic-api-key-assignment",
    severity: "high",
    regex: /(?:api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i,
  },
];

export function isFrontendPath(path: string): boolean {
  return /(?:\.(?:jsx|tsx)$)|(?:^|\/)(?:components|pages|public|app|client)(?:\/|$)/.test(path);
}

export function scanSecrets(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const frontend = isFrontendPath(file.path);
    const lines = file.content.split(/\r?\n/);
    lines.forEach((text, i) => {
      for (const r of SECRET_RULES) {
        if (r.regex.test(text)) {
          findings.push({ severity: r.severity, rule: r.rule, message: `Possible ${r.rule} detected.`, file: file.path, line: i + 1 });
          if (frontend) {
            findings.push({
              severity: "critical",
              rule: "secret-in-frontend",
              message: `Secret-like value in frontend-reachable file ${file.path}.`,
              file: file.path,
              line: i + 1,
            });
          }
        }
      }
    });
  }
  return findings;
}
```

- [ ] **Step 4:** Run test → 6 PASS. `tsc --noEmit` → exit 0.
- [ ] **Step 5: Commit** `feat(security): add secret scanner`.

---

## Task 3.3: `scanVulnerabilities` (OSV.dev)

**Behavior:** one POST per dependency to `https://api.osv.dev/v1/query` with body `{ version, package: { name, ecosystem: "npm" } }`. On `!res.ok`, that dep contributes no vulnerabilities (skip, don't throw). Map each returned vuln to `Vulnerability`. Severity from `database_specific.severity` string (`"CRITICAL"|"HIGH"|"MODERATE"|"LOW"`) → our `Severity`, defaulting to `"medium"`. Injectable `FetchFn`.

**Files:** Create `packages/security/src/scanDependencies.ts`, test `packages/security/tests/scanDependencies.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { scanVulnerabilities } from "../src/scanDependencies.js";

function stubFetch(byName: Record<string, unknown>): typeof fetch {
  return (async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? "{}") as { package?: { name?: string } };
    const name = body.package?.name ?? "";
    const payload = byName[name] ?? { vulns: [] };
    return { ok: true, status: 200, json: async () => payload } as Response;
  }) as unknown as typeof fetch;
}

describe("scanVulnerabilities", () => {
  it("maps OSV vulns to Vulnerability records with mapped severity", async () => {
    const fetchFn = stubFetch({
      lodash: { vulns: [{ id: "GHSA-xxxx", summary: "Prototype pollution", database_specific: { severity: "HIGH" } }] },
    });
    const vulns = await scanVulnerabilities([{ name: "lodash", version: "4.17.0" }], fetchFn);
    expect(vulns).toHaveLength(1);
    expect(vulns[0]).toMatchObject({ package: "lodash", id: "GHSA-xxxx", severity: "high" });
  });

  it("returns nothing for a clean package", async () => {
    const vulns = await scanVulnerabilities([{ name: "safe-pkg", version: "1.0.0" }], stubFetch({}));
    expect(vulns).toEqual([]);
  });

  it("defaults severity to medium when OSV omits it", async () => {
    const fetchFn = stubFetch({ x: { vulns: [{ id: "OSV-1", summary: "?" }] } });
    const vulns = await scanVulnerabilities([{ name: "x", version: "1.0.0" }], fetchFn);
    expect(vulns[0].severity).toBe("medium");
  });
});
```

- [ ] **Step 2:** Run test → FAIL.

- [ ] **Step 3: Implement**

```typescript
import type { DependencyRef, FetchFn, Severity, Vulnerability } from "./types.js";

function mapSeverity(s?: string): Severity {
  switch ((s ?? "").toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "LOW":
      return "low";
    case "MODERATE":
    case "MEDIUM":
      return "medium";
    default:
      return "medium";
  }
}

interface OsvVuln {
  id: string;
  summary?: string;
  database_specific?: { severity?: string };
}

async function queryOsv(dep: DependencyRef, fetchFn: FetchFn): Promise<Vulnerability[]> {
  const res = await fetchFn("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version: dep.version, package: { name: dep.name, ecosystem: "npm" } }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { vulns?: OsvVuln[] };
  return (body.vulns ?? []).map((v) => ({
    package: dep.name,
    version: dep.version,
    id: v.id,
    summary: v.summary ?? "",
    severity: mapSeverity(v.database_specific?.severity),
  }));
}

export async function scanVulnerabilities(deps: DependencyRef[], fetchFn: FetchFn = fetch): Promise<Vulnerability[]> {
  const all = await Promise.all(deps.map((d) => queryOsv(d, fetchFn)));
  return all.flat();
}
```

- [ ] **Step 4:** Run test → 3 PASS. `tsc --noEmit` → exit 0.
- [ ] **Step 5: Commit** `feat(security): add OSV.dev vulnerability scanner`.

---

## Task 3.4: `scanCode` (injection / XSS / eval / command injection)

**Rules (documented; line-based, non-global regexes):**
- `sql-injection-interpolation` (high): `/\b(?:query|execute|raw)\s*\(\s*`[^`]*\$\{/`
- `xss-dangerous-html` (high): `/dangerouslySetInnerHTML/`
- `eval-usage` (high): `/\beval\s*\(/`
- `command-injection` (critical): `/\bexec(?:Sync)?\s*\(\s*`[^`]*\$\{/`

**Files:** Create `packages/security/src/scanCode.ts`, test `packages/security/tests/scanCode.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { scanCode } from "../src/scanCode.js";

describe("scanCode", () => {
  it("flags SQL string interpolation", () => {
    const f = scanCode([{ path: "db.ts", content: "db.query(`SELECT * FROM users WHERE id = ${id}`)" }]);
    expect(f.some((x) => x.rule === "sql-injection-interpolation")).toBe(true);
  });

  it("flags dangerouslySetInnerHTML", () => {
    const f = scanCode([{ path: "View.tsx", content: "<div dangerouslySetInnerHTML={{ __html: x }} />" }]);
    expect(f.some((x) => x.rule === "xss-dangerous-html")).toBe(true);
  });

  it("flags eval", () => {
    const f = scanCode([{ path: "a.ts", content: "const r = eval(userInput);" }]);
    expect(f.some((x) => x.rule === "eval-usage")).toBe(true);
  });

  it("flags command injection via exec with interpolation as critical", () => {
    const f = scanCode([{ path: "run.ts", content: "exec(`rm -rf ${dir}`)" }]);
    expect(f.some((x) => x.rule === "command-injection" && x.severity === "critical")).toBe(true);
  });

  it("returns no findings for clean code", () => {
    expect(scanCode([{ path: "ok.ts", content: "const x = add(1, 2);" }])).toEqual([]);
  });
});
```

- [ ] **Step 2:** Run test → FAIL.

- [ ] **Step 3: Implement**

```typescript
import type { Finding, Severity, SourceFile } from "./types.js";

interface CodeRule {
  rule: string;
  severity: Severity;
  regex: RegExp;
}

const CODE_RULES: CodeRule[] = [
  { rule: "sql-injection-interpolation", severity: "high", regex: /\b(?:query|execute|raw)\s*\(\s*`[^`]*\$\{/ },
  { rule: "xss-dangerous-html", severity: "high", regex: /dangerouslySetInnerHTML/ },
  { rule: "eval-usage", severity: "high", regex: /\beval\s*\(/ },
  { rule: "command-injection", severity: "critical", regex: /\bexec(?:Sync)?\s*\(\s*`[^`]*\$\{/ },
];

export function scanCode(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((text, i) => {
      for (const r of CODE_RULES) {
        if (r.regex.test(text)) {
          findings.push({ severity: r.severity, rule: r.rule, message: `${r.rule} risk.`, file: file.path, line: i + 1 });
        }
      }
    });
  }
  return findings;
}
```

- [ ] **Step 4:** Run test → 5 PASS. `tsc --noEmit` → exit 0.
- [ ] **Step 5: Commit** `feat(security): add static code vulnerability scanner`.

---

## Task 3.5: `threatModel`

**Mapping (documented, deterministic):**
- `hasAuth` → `account_takeover` (mitigation: MFA, login rate-limiting, secure session management).
- `multiService` → `privilege_escalation` (mitigation: least-privilege service identities, network segmentation).
- `publicApi` → `injection` (mitigation: input validation + parameterized queries) **and** `denial_of_service` (mitigation: rate limiting + quotas).
- `storesPii` → `data_exposure` (mitigation: encryption at rest + strict access controls).

**Files:** Create `packages/security/src/threatModel.ts`, test `packages/security/tests/threatModel.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { threatModel } from "../src/threatModel.js";
import type { SystemDescriptor } from "../src/types.js";

const none: SystemDescriptor = { hasAuth: false, publicApi: false, storesPii: false, multiService: false };

describe("threatModel", () => {
  it("returns no risks for a system with no risk factors", () => {
    expect(threatModel(none)).toEqual([]);
  });

  it("maps auth to account_takeover", () => {
    expect(threatModel({ ...none, hasAuth: true }).some((r) => r.id === "account_takeover")).toBe(true);
  });

  it("maps a public api to injection and denial_of_service", () => {
    const ids = threatModel({ ...none, publicApi: true }).map((r) => r.id);
    expect(ids).toContain("injection");
    expect(ids).toContain("denial_of_service");
  });

  it("maps multi-service to privilege_escalation and pii to data_exposure", () => {
    const ids = threatModel({ hasAuth: false, publicApi: false, storesPii: true, multiService: true }).map((r) => r.id);
    expect(ids).toContain("privilege_escalation");
    expect(ids).toContain("data_exposure");
  });
});
```

- [ ] **Step 2:** Run test → FAIL.

- [ ] **Step 3: Implement**

```typescript
import type { SystemDescriptor, ThreatRisk } from "./types.js";

export function threatModel(system: SystemDescriptor): ThreatRisk[] {
  const risks: ThreatRisk[] = [];

  if (system.hasAuth) {
    risks.push({
      id: "account_takeover",
      title: "Account takeover",
      mitigation: "Enforce MFA, rate-limit login attempts, and use secure session management.",
    });
  }
  if (system.multiService) {
    risks.push({
      id: "privilege_escalation",
      title: "Privilege escalation across services",
      mitigation: "Use least-privilege service identities and network segmentation.",
    });
  }
  if (system.publicApi) {
    risks.push({
      id: "injection",
      title: "Injection via public API",
      mitigation: "Validate all input and use parameterized queries.",
    });
    risks.push({
      id: "denial_of_service",
      title: "Denial of service",
      mitigation: "Apply rate limiting and per-client quotas.",
    });
  }
  if (system.storesPii) {
    risks.push({
      id: "data_exposure",
      title: "PII data exposure",
      mitigation: "Encrypt PII at rest and enforce strict access controls.",
    });
  }

  return risks;
}
```

- [ ] **Step 4:** Run test → 4 PASS. `tsc --noEmit` → exit 0.
- [ ] **Step 5: Commit** `feat(security): add threat modeler`.

---

## Task 3.6: MCP server entry

**Mirror `packages/knowledge/src/index.ts` / `packages/architecture/src/index.ts` exactly** for SDK usage (`McpServer` from `.../server/mcp.js`, `StdioServerTransport` from `.../server/stdio.js`, `server.tool(name, desc, zodShape, cb)`, handlers return `{ content: [{ type: "text", text }] }`, end with `await server.connect(new StdioServerTransport())`). Shebang line 1.

**Files:** Create `packages/security/src/index.ts`

- [ ] **Step 1: Write the server entry**

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { scanSecrets } from "./scanSecrets.js";
import { scanVulnerabilities } from "./scanDependencies.js";
import { scanCode } from "./scanCode.js";
import { threatModel } from "./threatModel.js";

const server = new McpServer({ name: "seos-security", version: "0.1.0" });

const fileShape = { files: z.array(z.object({ path: z.string(), content: z.string() })) };

server.tool(
  "scan_secrets",
  "Scan source files for hardcoded secrets (API keys, private keys); escalates secrets in frontend-reachable files.",
  fileShape,
  async ({ files }) => ({ content: [{ type: "text", text: JSON.stringify(scanSecrets(files), null, 2) }] }),
);

server.tool(
  "scan_dependencies",
  "Check dependencies for known vulnerabilities via the OSV.dev database.",
  { dependencies: z.array(z.object({ name: z.string(), version: z.string() })) },
  async ({ dependencies }) => ({
    content: [{ type: "text", text: JSON.stringify(await scanVulnerabilities(dependencies), null, 2) }],
  }),
);

server.tool(
  "scan_code",
  "Statically scan source files for injection, XSS, eval, and command-injection risks.",
  fileShape,
  async ({ files }) => ({ content: [{ type: "text", text: JSON.stringify(scanCode(files), null, 2) }] }),
);

server.tool(
  "threat_model",
  "Generate a deterministic threat model (ranked risks + mitigations) from a system descriptor.",
  {
    hasAuth: z.boolean(),
    publicApi: z.boolean(),
    storesPii: z.boolean(),
    multiService: z.boolean(),
  },
  async (system) => ({ content: [{ type: "text", text: JSON.stringify(threatModel(system), null, 2) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2:** `tsc --noEmit` → exit 0 (match the known-good knowledge/architecture index if the SDK types complain).
- [ ] **Step 3:** `pnpm --filter @seos/security build` → `dist/index.js` produced, shebang intact.
- [ ] **Step 4: Commit** `feat(security): wire MCP server entry with four tools`.

---

## Task 3.7: Full suite + smoke + README

- [ ] **Step 1:** `pnpm --filter @seos/security test` → expect scanSecrets(6) + scanDependencies(3) + scanCode(5) + threatModel(4) = **18 tests** pass.
- [ ] **Step 2:** Stdio smoke (5s timeout), confirm 4 tools: `scan_secrets`, `scan_dependencies`, `scan_code`, `threat_model`. Use the same `printf initialize + tools/list | node dist/index.js` pattern as the other packages.
- [ ] **Step 3:** Write `packages/security/README.md` — title `# @seos/security`, tagline "Phase 3 of the Engineering OS. Automatic security review.", a `## Tools` list of the four tools, a `## Register with Claude Code` JSON block (command `node`, args `./packages/security/dist/index.js`), and a note: "Auth-flow review (sessions/RBAC/OAuth) is deferred to a later iteration."
- [ ] **Step 4: Commit** `feat(security): add README; Phase 3 complete`.

**Phase 3 deliverable:** runnable MCP server — secret scanning, live CVE scanning, static code scanning, threat modeling. ✅

---

## Self-Review (against the Phase 3 sub-plan)
- scanSecrets → `scan_secrets` ✅ ; scanVulnerabilities(OSV) → `scan_dependencies` ✅ ; scanCode (input validation/injection) → `scan_code` ✅ ; threatModel → `threat_model` ✅.
- Acceptance: detects a frontend-exposed key (Task 3.2 `secret-in-frontend`), reports a CVE for a vulnerable dep via OSV (Task 3.3), emits a threat model (Task 3.5). ✅
- Auth-flow review explicitly deferred and documented. No placeholders; complete code + commands throughout.
