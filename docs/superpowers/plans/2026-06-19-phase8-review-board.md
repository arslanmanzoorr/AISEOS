# Phase 8 — Multi-Agent Review Board (`@seos/review-board`) Implementation Plan

> **For agentic workers:** Execute task-by-task with strict TDD (failing test first → confirm fail → implement → confirm pass → commit). Steps use checkbox (`- [ ]`).

**Goal:** Ship `@seos/review-board`, an MCP server that mimics an engineering org's PR review: a set of review agents each vote approve/reject with recommendations, and a PR is approved only when no agent rejects.

**Architecture:** A package in the `engineering-os` pnpm monorepo, same stack/discipline as the other `@seos/*` packages. The board is built around a **`ReviewAgent` interface** — the integration seam each phase's reviewer conforms to — plus a `runBoard` aggregator and several **self-contained reference agents**. The sibling packages expose no reusable library exports (their `main` is the stdio server, with side effects), so the board does **not** import them; instead it ships reference agents and accepts injected agents via the interface. **No new runtime dependencies.**

**Scope note:** One core tool — `review_pr` — running the default board over a PR. The board ships three reference agents (documentation, security-secrets, large-file). Production deployments can add Architecture/QA/Performance/DevOps agents that wrap the corresponding servers via the `ReviewAgent` interface; that wiring is a documented follow-up.

---

## File Structure

```
packages/review-board/
  package.json            # name @seos/review-board, bin seos-review-board
  tsconfig.json           # mirror architecture
  vitest.config.ts        # mirror architecture
  src/
    index.ts              # MCP server; review_pr tool
    types.ts              # ReviewFile, PullRequest, Vote, BoardResult, ReviewAgent
    board.ts              # runBoard()
    agents.ts             # documentationAgent, secretAgent, largeFileAgent, defaultAgents
  tests/
    board.test.ts
    agents.test.ts
  README.md
```

**Tool ↔ function map:**
| MCP tool | function | input | output |
|----------|----------|-------|--------|
| `review_pr` | `runBoard` (with `defaultAgents`) | `PullRequest` | `BoardResult` |

---

## Task 8.0: Scaffold `@seos/review-board`
Mirror `packages/architecture` exactly, name `@seos/review-board`, bin `seos-review-board`.
- [ ] Create `package.json`, `tsconfig.json`, `vitest.config.ts` (mirror architecture).
- [ ] `pnpm install` from repo root (exit 0). Root `package.json` already has `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` — reuse; do not duplicate.
- [ ] Commit `chore(review-board): scaffold @seos/review-board package` (+ lockfile).

## Task 8.1: Shared types
**Files:** Create `packages/review-board/src/types.ts`
- [ ] **Step 1: Write the types**
```typescript
export interface ReviewFile {
  path: string;
  content: string;
}

export interface PullRequest {
  files: ReviewFile[];
  description?: string;
}

export type VoteValue = "approve" | "reject";

export interface Vote {
  name: string; // agent name
  vote: VoteValue;
  recommendations: string[];
}

export interface BoardResult {
  approved: boolean; // true only when no agent rejects
  votes: Vote[];
}

export interface ReviewAgent {
  name: string;
  review(pr: PullRequest): Vote | Promise<Vote>;
}
```
- [ ] `pnpm --filter @seos/review-board exec tsc --noEmit` → exit 0.
- [ ] Commit `feat(review-board): add shared types`.

## Task 8.2: `runBoard`
**Behavior:** Run every agent's `review(pr)` (await each), collect votes; `approved = votes.every(v => v.vote === "approve")`. An empty agent list approves by default (vacuously true) — documented.
**Files:** Create `packages/review-board/src/board.ts`, test `packages/review-board/tests/board.test.ts`.
- [ ] **Step 1: Failing test**
```typescript
import { describe, it, expect } from "vitest";
import { runBoard } from "../src/board.js";
import type { ReviewAgent } from "../src/types.js";

const approver = (name: string): ReviewAgent => ({ name, review: () => ({ name, vote: "approve", recommendations: [] }) });
const rejecter = (name: string): ReviewAgent => ({ name, review: () => ({ name, vote: "reject", recommendations: [`${name} says no`] }) });

const pr = { files: [{ path: "a.ts", content: "x" }] };

describe("runBoard", () => {
  it("approves when every agent approves", async () => {
    const r = await runBoard(pr, [approver("arch"), approver("sec")]);
    expect(r.approved).toBe(true);
    expect(r.votes).toHaveLength(2);
  });
  it("rejects when any agent rejects, recording all votes", async () => {
    const r = await runBoard(pr, [approver("arch"), rejecter("sec")]);
    expect(r.approved).toBe(false);
    expect(r.votes.find((v) => v.name === "sec")?.recommendations).toEqual(["sec says no"]);
  });
  it("awaits async agents", async () => {
    const asyncAgent: ReviewAgent = { name: "async", review: async () => ({ name: "async", vote: "approve", recommendations: [] }) };
    const r = await runBoard(pr, [asyncAgent]);
    expect(r.approved).toBe(true);
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**
```typescript
import type { BoardResult, PullRequest, ReviewAgent } from "./types.js";

export async function runBoard(pr: PullRequest, agents: ReviewAgent[]): Promise<BoardResult> {
  const votes = await Promise.all(agents.map(async (a) => a.review(pr)));
  return { approved: votes.every((v) => v.vote === "approve"), votes };
}
```
- [ ] **Step 4:** Run → 3 PASS. `tsc --noEmit` → 0.
- [ ] **Step 5:** Commit `feat(review-board): add board aggregation`.

## Task 8.3: Reference agents
**Behavior (self-contained, deterministic):**
- `documentationAgent`: if the PR touches code (`.ts/.tsx/.js/.jsx`) but touches no docs (`.md` or a `docs/` path or a README) and has no `description`, reject; else approve.
- `secretAgent`: reject if any file content matches an obvious secret pattern (`sk-...`, `AKIA...`, private key block); recommendations name the files.
- `largeFileAgent`: reject if any file's content length exceeds 50,000 characters (maintainability); recommendation names the file.
- `defaultAgents = [documentationAgent, secretAgent, largeFileAgent]`.
**Files:** Create `packages/review-board/src/agents.ts`, test `packages/review-board/tests/agents.test.ts`.
- [ ] **Step 1: Failing test**
```typescript
import { describe, it, expect } from "vitest";
import { documentationAgent, secretAgent, largeFileAgent, defaultAgents } from "../src/agents.js";

describe("documentationAgent", () => {
  it("rejects code-only PRs with no docs and no description", () => {
    const v = documentationAgent.review({ files: [{ path: "src/a.ts", content: "x" }] });
    expect(v.vote).toBe("reject");
  });
  it("approves when docs are included", () => {
    const v = documentationAgent.review({ files: [{ path: "src/a.ts", content: "x" }, { path: "README.md", content: "d" }] });
    expect(v.vote).toBe("approve");
  });
  it("approves a code PR that has a description", () => {
    const v = documentationAgent.review({ files: [{ path: "src/a.ts", content: "x" }], description: "explains the change" });
    expect(v.vote).toBe("approve");
  });
});

describe("secretAgent", () => {
  it("rejects when a file contains a secret", () => {
    const v = secretAgent.review({ files: [{ path: "src/a.ts", content: "const k='sk-abcdefghijklmnopqrstuvwxyz0123'" }] });
    expect(v.vote).toBe("reject");
    expect(v.recommendations[0]).toContain("src/a.ts");
  });
  it("approves clean files", () => {
    expect(secretAgent.review({ files: [{ path: "a.ts", content: "const x=1" }] }).vote).toBe("approve");
  });
});

describe("largeFileAgent", () => {
  it("rejects an oversized file", () => {
    const v = largeFileAgent.review({ files: [{ path: "big.ts", content: "x".repeat(50_001) }] });
    expect(v.vote).toBe("reject");
  });
  it("approves normal files", () => {
    expect(largeFileAgent.review({ files: [{ path: "ok.ts", content: "x".repeat(100) }] }).vote).toBe("approve");
  });
});

describe("defaultAgents", () => {
  it("includes the three reference agents", () => {
    expect(defaultAgents.map((a) => a.name).sort()).toEqual(["documentation", "large-file", "security-secrets"]);
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**
```typescript
import type { PullRequest, ReviewAgent, Vote } from "./types.js";

const CODE = /\.(?:ts|tsx|js|jsx)$/;
const DOC = /(?:readme)|(?:\.md$)|(?:(?:^|\/)docs\/)/i;
const SECRET = /sk-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/;
const MAX_FILE_CHARS = 50_000;

function approve(name: string): Vote {
  return { name, vote: "approve", recommendations: [] };
}

export const documentationAgent: ReviewAgent = {
  name: "documentation",
  review(pr: PullRequest): Vote {
    const touchesCode = pr.files.some((f) => CODE.test(f.path));
    const touchesDocs = pr.files.some((f) => DOC.test(f.path));
    if (touchesCode && !touchesDocs && !pr.description) {
      return { name: "documentation", vote: "reject", recommendations: ["Add documentation or a PR description for these code changes."] };
    }
    return approve("documentation");
  },
};

export const secretAgent: ReviewAgent = {
  name: "security-secrets",
  review(pr: PullRequest): Vote {
    const hits = pr.files.filter((f) => SECRET.test(f.content)).map((f) => `Possible secret in ${f.path}`);
    return hits.length > 0 ? { name: "security-secrets", vote: "reject", recommendations: hits } : approve("security-secrets");
  },
};

export const largeFileAgent: ReviewAgent = {
  name: "large-file",
  review(pr: PullRequest): Vote {
    const hits = pr.files.filter((f) => f.content.length > MAX_FILE_CHARS).map((f) => `${f.path} exceeds ${MAX_FILE_CHARS} chars; split it.`);
    return hits.length > 0 ? { name: "large-file", vote: "reject", recommendations: hits } : approve("large-file");
  },
};

export const defaultAgents: ReviewAgent[] = [documentationAgent, secretAgent, largeFileAgent];
```
- [ ] **Step 4:** Run → 8 PASS. `tsc --noEmit` → 0.
- [ ] **Step 5:** Commit `feat(review-board): add reference review agents`.

## Task 8.4: MCP server entry
Mirror `packages/knowledge/src/index.ts`. Shebang line 1.
**Files:** Create `packages/review-board/src/index.ts`
- [ ] **Step 1: Write the entry**
```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { runBoard } from "./board.js";
import { defaultAgents } from "./agents.js";

const server = new McpServer({ name: "seos-review-board", version: "0.1.0" });

server.tool(
  "review_pr",
  "Run the multi-agent review board (documentation, secret-scan, large-file) over a pull request; approves only when no agent rejects.",
  {
    files: z.array(z.object({ path: z.string(), content: z.string() })),
    description: z.string().optional(),
  },
  async (pr) => ({ content: [{ type: "text", text: JSON.stringify(await runBoard(pr, defaultAgents), null, 2) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```
- [ ] **Step 2:** `tsc --noEmit` → 0 (match knowledge/index.ts if SDK types complain).
- [ ] **Step 3:** `pnpm --filter @seos/review-board build` → `dist/index.js`, shebang intact.
- [ ] **Step 4:** Commit `feat(review-board): wire MCP server entry with review_pr tool`.

## Task 8.5: Full suite + smoke + README
- [ ] **Step 1:** `pnpm --filter @seos/review-board test` → expect board(3) + agents(8) = **11 tests**.
- [ ] **Step 2:** Stdio smoke (5s timeout) confirming the `review_pr` tool is listed.
- [ ] **Step 3:** Write `packages/review-board/README.md` — title `# @seos/review-board`, tagline "Phase 8 of the Engineering OS. A multi-agent PR review board.", `## Tools` (`review_pr`), `## Agents` (documentation, security-secrets, large-file), a `## Extending` note: "Add Architecture/QA/Performance/DevOps agents by implementing the `ReviewAgent` interface and passing them to `runBoard`; wiring those to the sibling servers is a follow-up.", and a `## Register with Claude Code` JSON block (command `node`, args `./packages/review-board/dist/index.js`).
- [ ] **Step 4:** Commit `feat(review-board): add README; Phase 8 complete`.

**Phase 8 deliverable:** runnable MCP server — a multi-agent review board that gates PRs (approve only when no agent rejects). ✅

## Self-Review
- ReviewAgent interface + runBoard aggregation (approve only when no reject) ✅ ; reference agents (documentation, security-secrets, large-file) ✅ ; `review_pr` tool ✅. Acceptance: a PR with a planted secret is rejected by the board; a clean, documented PR is approved; the verdict records each agent's vote + recommendations. No placeholders.
