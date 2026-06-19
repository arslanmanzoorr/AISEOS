# Phase 7 — Engineering Memory (`@seos/memory`) Implementation Plan

> **For agentic workers:** Execute task-by-task with strict TDD (failing test first → confirm fail → implement → confirm pass → commit). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `@seos/memory`, an MCP server giving the system persistent institutional memory: decisions, project context, and historical incidents/bugs/bottlenecks that survive across sessions.

**Architecture:** A package in the `engineering-os` pnpm monorepo. Same stack/discipline as the other `@seos/*` packages: TypeScript, Node 24, ESM/NodeNext, `@modelcontextprotocol/sdk@1.29`, Zod, Vitest, tsup. Persistence is a **JSON-file-backed store behind a `MemoryStore` interface** (avoids native deps like `better-sqlite3` that are build-risky on Windows). Tests use an **in-memory store**; one test exercises the JSON file store for real cross-instance persistence. **No new runtime dependencies.**

**Tech Stack:** TypeScript 5.5+, Node 24, `@modelcontextprotocol/sdk@^1.0.0`, `zod@^3.23`, Vitest 2, tsup. Reuses root `tsconfig.base.json`.

**Scope note:** Six tools across three memory kinds (decisions, context, history). Phase-7-as-MCP-resources and direct ingestion of Phase 2's ADR files are **deferred** (documented in README) — they're additive and depend on Phase 2 file layout that can be wired at integration time.

---

## File Structure

```
packages/memory/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts        # MCP server; 6 tools
    types.ts        # DecisionRecord, ContextRecord, HistoryRecord, MemoryState, MemoryStore
    store.ts        # inMemoryStore() + jsonFileStore(path)
    memory.ts       # recordDecision, queryDecisions, setContext, getContext, recordHistory, searchHistory
  tests/
    memory.test.ts  # operations against an in-memory store
    store.test.ts   # jsonFileStore persistence across instances (temp file)
  README.md
```

**Tool ↔ function map:**
| MCP tool | function | input | output |
|----------|----------|-------|--------|
| `record_decision` | `recordDecision` | `{ decision, reason, date }` | `DecisionRecord` |
| `query_decisions` | `queryDecisions` | `{ query? }` | `DecisionRecord[]` |
| `set_context` | `setContext` | partial `ContextRecord` | `ContextRecord` |
| `get_context` | `getContext` | `{}` | `ContextRecord` |
| `record_history` | `recordHistory` | `{ type, summary, date }` | `HistoryRecord` |
| `search_history` | `searchHistory` | `{ query }` | `HistoryRecord[]` |

---

## Task 7.0: Scaffold `@seos/memory`

**Mirror `packages/architecture`** changing only the name.

- [ ] **Step 1:** `packages/memory/package.json` — identical to architecture's except `"name": "@seos/memory"`, `"bin": { "seos-memory": "dist/index.js" }`.
- [ ] **Step 2:** `packages/memory/tsconfig.json` — identical (`rootDir: "."`, `include: ["src","tests"]`).
- [ ] **Step 3:** `packages/memory/vitest.config.ts` — identical.
- [ ] **Step 4:** `pnpm install` from repo root (exit 0).
- [ ] **Step 5: Commit** `chore(memory): scaffold @seos/memory package` (+ lockfile).

---

## Task 7.1: Shared types

**Files:** Create `packages/memory/src/types.ts`

- [ ] **Step 1: Write the types**

```typescript
export interface DecisionRecord {
  id: string;
  decision: string;
  reason: string;
  date: string; // ISO date
}

export type HistoryKind = "bug" | "incident" | "bottleneck";

export interface HistoryRecord {
  id: string;
  type: HistoryKind;
  summary: string;
  date: string;
}

export interface ContextRecord {
  architecture?: string;
  constraints?: string[];
  businessGoals?: string[];
  techStack?: string[];
}

export interface MemoryState {
  decisions: DecisionRecord[];
  context: ContextRecord;
  history: HistoryRecord[];
}

export interface MemoryStore {
  load(): Promise<MemoryState>;
  save(state: MemoryState): Promise<void>;
}

export function emptyState(): MemoryState {
  return { decisions: [], context: {}, history: [] };
}
```

- [ ] **Step 2:** `pnpm --filter @seos/memory exec tsc --noEmit` → exit 0.
- [ ] **Step 3: Commit** `feat(memory): add shared types`.

---

## Task 7.2: Stores (`inMemoryStore`, `jsonFileStore`)

**Behavior:**
- `inMemoryStore(initial?)`: holds state in a closure; `load` returns a structuredClone; `save` replaces it with a structuredClone. (Clone so callers can't mutate internal state by reference.)
- `jsonFileStore(path)`: `load` reads+parses the file, returns `emptyState()` if the file is missing; `save` writes pretty JSON, creating parent dirs.

**Files:** Create `packages/memory/src/store.ts`, test `packages/memory/tests/store.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inMemoryStore, jsonFileStore } from "../src/store.js";
import { emptyState } from "../src/types.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "seos-mem-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("inMemoryStore", () => {
  it("round-trips state and isolates by clone", async () => {
    const s = inMemoryStore();
    const state = emptyState();
    state.decisions.push({ id: "d1", decision: "x", reason: "y", date: "2026-06-19" });
    await s.save(state);
    const loaded = await s.load();
    expect(loaded.decisions).toHaveLength(1);
    loaded.decisions.push({ id: "d2", decision: "z", reason: "w", date: "2026-06-19" });
    expect((await s.load()).decisions).toHaveLength(1); // internal state not mutated by the returned reference
  });
});

describe("jsonFileStore", () => {
  it("returns empty state when the file does not exist", async () => {
    const s = jsonFileStore(join(dir, "memory.json"));
    expect(await s.load()).toEqual(emptyState());
  });

  it("persists across separate store instances pointing at the same file", async () => {
    const path = join(dir, "memory.json");
    const a = jsonFileStore(path);
    const state = emptyState();
    state.context.architecture = "modular monolith";
    await a.save(state);
    const b = jsonFileStore(path);
    expect((await b.load()).context.architecture).toBe("modular monolith");
  });
});
```

- [ ] **Step 2:** Run test → FAIL.

- [ ] **Step 3: Implement**

```typescript
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MemoryState, MemoryStore } from "./types.js";
import { emptyState } from "./types.js";

export function inMemoryStore(initial?: MemoryState): MemoryStore {
  let state: MemoryState = structuredClone(initial ?? emptyState());
  return {
    async load() {
      return structuredClone(state);
    },
    async save(next) {
      state = structuredClone(next);
    },
  };
}

export function jsonFileStore(path: string): MemoryStore {
  return {
    async load() {
      try {
        const raw = await readFile(path, "utf8");
        return JSON.parse(raw) as MemoryState;
      } catch {
        return emptyState();
      }
    },
    async save(next) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(next, null, 2), "utf8");
    },
  };
}
```

- [ ] **Step 4:** Run test → 3 PASS. `tsc --noEmit` → exit 0.
- [ ] **Step 5: Commit** `feat(memory): add in-memory and json-file stores`.

---

## Task 7.3: Memory operations

**Behavior (each takes a `MemoryStore`, mutates via load→modify→save):**
- `recordDecision(store, { decision, reason, date })`: id = `d${decisions.length + 1}`; append; save; return the new `DecisionRecord`.
- `queryDecisions(store, query?)`: return all when `query` empty; else case-insensitive substring match on `decision` or `reason`.
- `setContext(store, partial)`: shallow-merge `partial` into `context` (only provided keys overwrite); save; return the merged `ContextRecord`.
- `getContext(store)`: return `context`.
- `recordHistory(store, { type, summary, date })`: id = `h${history.length + 1}`; append; save; return the new `HistoryRecord`.
- `searchHistory(store, query)`: case-insensitive substring match on `summary` (and exact match on `type` if query equals a kind).

**Files:** Create `packages/memory/src/memory.ts`, test `packages/memory/tests/memory.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { inMemoryStore } from "../src/store.js";
import {
  recordDecision,
  queryDecisions,
  setContext,
  getContext,
  recordHistory,
  searchHistory,
} from "../src/memory.js";

describe("decisions", () => {
  it("records decisions with sequential ids and queries them", async () => {
    const store = inMemoryStore();
    const d1 = await recordDecision(store, { decision: "Use Redis", reason: "reduce DB load", date: "2026-06-19" });
    await recordDecision(store, { decision: "Use Postgres", reason: "transactions", date: "2026-06-19" });
    expect(d1.id).toBe("d1");
    expect(await queryDecisions(store)).toHaveLength(2);
    const hits = await queryDecisions(store, "redis");
    expect(hits).toHaveLength(1);
    expect(hits[0].decision).toBe("Use Redis");
  });
});

describe("context", () => {
  it("merges context partials without dropping prior keys", async () => {
    const store = inMemoryStore();
    await setContext(store, { architecture: "monolith", techStack: ["ts"] });
    const merged = await setContext(store, { techStack: ["ts", "node"] });
    expect(merged.architecture).toBe("monolith");
    expect(merged.techStack).toEqual(["ts", "node"]);
    expect((await getContext(store)).architecture).toBe("monolith");
  });
});

describe("history", () => {
  it("records and searches history", async () => {
    const store = inMemoryStore();
    await recordHistory(store, { type: "incident", summary: "DB outage on launch day", date: "2026-06-19" });
    await recordHistory(store, { type: "bug", summary: "off-by-one in pagination", date: "2026-06-19" });
    expect(await searchHistory(store, "outage")).toHaveLength(1);
    expect(await searchHistory(store, "bug")).toHaveLength(1); // matches type
  });
});
```

- [ ] **Step 2:** Run test → FAIL.

- [ ] **Step 3: Implement**

```typescript
import type { ContextRecord, DecisionRecord, HistoryKind, HistoryRecord, MemoryStore } from "./types.js";

const KINDS: HistoryKind[] = ["bug", "incident", "bottleneck"];

export async function recordDecision(
  store: MemoryStore,
  input: { decision: string; reason: string; date: string },
): Promise<DecisionRecord> {
  const state = await store.load();
  const record: DecisionRecord = { id: `d${state.decisions.length + 1}`, ...input };
  state.decisions.push(record);
  await store.save(state);
  return record;
}

export async function queryDecisions(store: MemoryStore, query?: string): Promise<DecisionRecord[]> {
  const { decisions } = await store.load();
  if (!query) return decisions;
  const q = query.toLowerCase();
  return decisions.filter((d) => d.decision.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q));
}

export async function setContext(store: MemoryStore, partial: ContextRecord): Promise<ContextRecord> {
  const state = await store.load();
  state.context = { ...state.context, ...partial };
  await store.save(state);
  return state.context;
}

export async function getContext(store: MemoryStore): Promise<ContextRecord> {
  return (await store.load()).context;
}

export async function recordHistory(
  store: MemoryStore,
  input: { type: HistoryKind; summary: string; date: string },
): Promise<HistoryRecord> {
  const state = await store.load();
  const record: HistoryRecord = { id: `h${state.history.length + 1}`, ...input };
  state.history.push(record);
  await store.save(state);
  return record;
}

export async function searchHistory(store: MemoryStore, query: string): Promise<HistoryRecord[]> {
  const { history } = await store.load();
  const q = query.toLowerCase();
  const isKind = (KINDS as string[]).includes(q);
  return history.filter((h) => h.summary.toLowerCase().includes(q) || (isKind && h.type === q));
}
```

- [ ] **Step 4:** Run test → 3 PASS. `tsc --noEmit` → exit 0.
- [ ] **Step 5: Commit** `feat(memory): add decision/context/history operations`.

---

## Task 7.4: MCP server entry

**Mirror the known-good `packages/knowledge/src/index.ts` SDK usage.** Default store path from `process.env.SEOS_MEMORY_PATH ?? "memory.json"`, resolved relative to the built file using `fileURLToPath(new URL("../memory.json", import.meta.url))` as the default base (consistent with the Phase 1 hardening fix) — i.e. `const MEMORY_PATH = process.env.SEOS_MEMORY_PATH ?? fileURLToPath(new URL("../memory.json", import.meta.url));`. Each tool builds `jsonFileStore(MEMORY_PATH)` and calls the matching operation.

**Files:** Create `packages/memory/src/index.ts`

- [ ] **Step 1: Write the server entry**

```typescript
#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { jsonFileStore } from "./store.js";
import {
  recordDecision,
  queryDecisions,
  setContext,
  getContext,
  recordHistory,
  searchHistory,
} from "./memory.js";

const MEMORY_PATH = process.env.SEOS_MEMORY_PATH ?? fileURLToPath(new URL("../memory.json", import.meta.url));
const store = () => jsonFileStore(MEMORY_PATH);

const server = new McpServer({ name: "seos-memory", version: "0.1.0" });

server.tool(
  "record_decision",
  "Record an engineering decision (what + why + date) into persistent memory.",
  { decision: z.string().min(1), reason: z.string().min(1), date: z.string().min(1) },
  async (input) => ({ content: [{ type: "text", text: JSON.stringify(await recordDecision(store(), input), null, 2) }] }),
);

server.tool(
  "query_decisions",
  "Query recorded decisions by optional case-insensitive substring of the decision or reason.",
  { query: z.string().optional() },
  async ({ query }) => ({ content: [{ type: "text", text: JSON.stringify(await queryDecisions(store(), query), null, 2) }] }),
);

server.tool(
  "set_context",
  "Merge project context (architecture, constraints, business goals, tech stack) into persistent memory.",
  {
    architecture: z.string().optional(),
    constraints: z.array(z.string()).optional(),
    businessGoals: z.array(z.string()).optional(),
    techStack: z.array(z.string()).optional(),
  },
  async (partial) => ({ content: [{ type: "text", text: JSON.stringify(await setContext(store(), partial), null, 2) }] }),
);

server.tool(
  "get_context",
  "Retrieve the stored project context.",
  {},
  async () => ({ content: [{ type: "text", text: JSON.stringify(await getContext(store()), null, 2) }] }),
);

server.tool(
  "record_history",
  "Record a historical bug, incident, or performance bottleneck into persistent memory.",
  { type: z.enum(["bug", "incident", "bottleneck"]), summary: z.string().min(1), date: z.string().min(1) },
  async (input) => ({ content: [{ type: "text", text: JSON.stringify(await recordHistory(store(), input), null, 2) }] }),
);

server.tool(
  "search_history",
  "Search historical records by case-insensitive substring of the summary (or by exact kind).",
  { query: z.string().min(1) },
  async ({ query }) => ({ content: [{ type: "text", text: JSON.stringify(await searchHistory(store(), query), null, 2) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2:** `tsc --noEmit` → exit 0.
- [ ] **Step 3:** `pnpm --filter @seos/memory build` → `dist/index.js`, shebang intact.
- [ ] **Step 4: Commit** `feat(memory): wire MCP server entry with six tools`.

---

## Task 7.5: Full suite + smoke + README

- [ ] **Step 1:** `pnpm --filter @seos/memory test` → expect store(3) + memory(3) = **6 tests** pass.
- [ ] **Step 2:** Stdio smoke (5s timeout), confirm 6 tools: `record_decision`, `query_decisions`, `set_context`, `get_context`, `record_history`, `search_history`.
- [ ] **Step 3:** Write `packages/memory/README.md` — title `# @seos/memory`, tagline "Phase 7 of the Engineering OS. Persistent institutional memory.", `## Tools` list (six), `## Register with Claude Code` JSON block (command `node`, args `./packages/memory/dist/index.js`, env `SEOS_MEMORY_PATH`), and a note: "MCP resources and direct ADR-file ingestion (from @seos/architecture) are deferred follow-ups."
- [ ] **Step 4: Commit** `feat(memory): add README; Phase 7 complete`.

**Phase 7 deliverable:** runnable MCP server — decisions, context, and history that persist across sessions. ✅

---

## Self-Review (against the Phase 7 sub-plan)
- Decision memory → `record_decision`/`query_decisions` ✅ ; Context memory → `set_context`/`get_context` ✅ ; Historical memory → `record_history`/`search_history` ✅.
- Acceptance: decisions/context/history persist across process restarts (Task 7.2 jsonFileStore cross-instance test) and are queryable (Task 7.3). ✅
- MCP resources + ADR ingestion explicitly deferred and documented. No placeholders; complete code + commands throughout.
