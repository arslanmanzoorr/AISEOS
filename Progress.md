# Engineering OS (AI-SEOS) — Progress Report

> **Live status of the project.** Updated as work lands. Last updated: **2026-06-19**.

## At a glance

| | |
|---|---|
| **Project** | AI Software Engineering Operating System (AI-SEOS) |
| **Current stage** | ✅ Phases 1, 2, 3, 4, 5, 7 COMPLETE — six runnable MCP servers shipped (101 tests). Phases 6, 8, 9, 10 awaiting expansion |
| **Plan** | [2026-06-19-engineering-os.md](2026-06-19-engineering-os.md) |
| **Repo state** | Git repo initialized; commits landing per task |
| **Tech stack** | TypeScript · Node 24 · `@modelcontextprotocol/sdk` · Zod · Vitest · tsup · pnpm workspaces |

## Overall progress

```
Planning   ████████████████████  100%
Phase 1    ████████████████████  100%  (@seos/knowledge;    21 tests green)
Phase 2    ████████████████████  100%  (@seos/architecture; 32 tests green)
Phase 3    ████████████████████  100%  (@seos/security;     22 tests green)
Phase 4    ████████████████████  100%  (@seos/qa;           10 tests green)
Phase 5    ████████████████████  100%  (@seos/performance;   8 tests green)
Phase 7    ████████████████████  100%  (@seos/memory;        8 tests green)
Phases 6,8,9,10 ░░░░░░░░░░░░░░░░   0%   (sub-plans only, not expanded)
```

**Repo total: 6 MCP servers · 101 tests green on `main`.**

---

## Done so far

- [x] **Scoped the vision** — confirmed the 10-phase spec is a multi-subsystem *program*, not one sprint. Chose to make Phase 1 fully executable and Phases 2-10 structured sub-plans.
- [x] **Decided tech stack** — TypeScript + Node (over Python).
- [x] **Decided scope** — full 10-phase plan in a single program document.
- [x] **Wrote the implementation plan** — [2026-06-19-engineering-os.md](2026-06-19-engineering-os.md), saved to repo root and `docs/superpowers/plans/`.
- [x] **Ran plan self-review** — spec coverage, placeholder scan, type consistency all checked.
- [x] **Created this progress report.**

## In progress

- _Nothing currently being implemented._ Six servers shipped (Phases 1–5, 7).

## Not started

- Phases 6 (DevOps), 8 (Review Board), 9 (Self-Healing), 10 (Compliance) — sub-plans pending expansion. Phase 8 composes 3/4/5/6; Phase 9 depends on 6/8.

---

## Phase 1 task tracker — `@seos/knowledge`

| Task | Description | Status |
|------|-------------|--------|
| 1.0 | Monorepo + package scaffolding (`git init`, pnpm workspace) | ✅ Done (`6f19056`) |
| 1.1 | Shared types (`src/types.ts`) | ✅ Done (`b4d02a9`) |
| 1.2 | npm registry client | ✅ Done (`fed4075`, 6 tests) |
| 1.3 | Node.js release client | ✅ Done (`3f019f9`) |
| 1.4 | Version Validator (`check_versions`) | ✅ Done (`750569f`) |
| 1.5 | Dependency Auditor (`audit_dependency`) | ✅ Done (`3e55061`, caution band covered) |
| 1.6 | Hallucination Detector (`verify_api`) | ✅ Done (`8e7196a`) |
| 1.7 | Knowledge store + `get_knowledge` | ✅ Done (`c5b3fba`) |
| 1.8 | MCP server entry — register 4 tools | ✅ Done (`4ebbad8`) |
| 1.9 | Full suite + smoke run + sample profile | ✅ Done (`3aa9279`) |
| 1.10 | Hardening (final-review fixes) | ✅ Done (`8956b6a`) |

**Phase 1 result:** `@seos/knowledge` MCP server, 21 tests passing, builds to `dist/index.js`, stdio smoke test lists all 4 tools. Registerable in Claude Code (see `packages/knowledge/README.md`).

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ❌ Blocked

---

## Phase 2 task tracker — `@seos/architecture`

| Task | Description | Status |
|------|-------------|--------|
| 2.0 | Scaffold `@seos/architecture` | ✅ Done (`018ccd3`) |
| 2.1 | Shared types | ✅ Done (`c7e076d`) |
| 2.2 | `intake` (validate + scale derivation) | ✅ Done (`4b178d4`) |
| 2.3 | `generateArchitecture` (deterministic proposal) | ✅ Done (`bea6f49`) |
| 2.4 | `reviewDesign` (rule engine) | ✅ Done (`ae38990`) |
| 2.5 | `writeAdr` (sequential ADR writer) | ✅ Done (`39754b7`) |
| 2.6 | MCP server entry — 4 tools | ✅ Done (`f94db11`) |
| 2.7 | Suite + smoke + README | ✅ Done (`d39d586`) |
| 2.8 | Hardening (final-review fixes) | ✅ Done (`0bc5206`) |

**Phase 2 result:** `@seos/architecture` MCP server — `intake_requirements`, `generate_architecture`, `review_design`, `write_adr`. 32 tests passing (incl. generator→reviewer integration invariant + tier-boundary tests), builds to `dist/index.js`, stdio smoke lists all 4 tools. Plan: [docs/superpowers/plans/2026-06-19-phase2-architecture.md](docs/superpowers/plans/2026-06-19-phase2-architecture.md).

---

## Phase 3 — `@seos/security` (executed in parallel worktree)

Plan: [docs/superpowers/plans/2026-06-19-phase3-security.md](docs/superpowers/plans/2026-06-19-phase3-security.md). Built end-to-end by a background agent (TDD per task), then final-reviewed + hardened on `main`.

| Tool | Purpose |
|------|---------|
| `scan_secrets` | Regex secret rules (OpenAI incl. `sk-proj-`, AWS, private keys, generic); escalates `secret-in-frontend` for frontend-reachable paths (Windows paths normalized) |
| `scan_dependencies` | Live CVE lookup via OSV.dev (injectable fetch); **throws** on OSV service errors rather than reporting a false "all clear" |
| `scan_code` | Static rules: SQL-injection interpolation, XSS `dangerouslySetInnerHTML`, `eval`, command injection |
| `threat_model` | Deterministic system→risk mapping (account takeover, privilege escalation, injection, DoS, data exposure) |

**Result:** 22 tests passing, builds + stdio smoke (4 tools). Hardening `639ac05`. Auth-flow review (sessions/RBAC/OAuth) and multi-line/concat injection patterns are documented v0.1 gaps.

---

## Phase 7 — `@seos/memory` (executed in parallel worktree)

Plan: [docs/superpowers/plans/2026-06-19-phase7-memory.md](docs/superpowers/plans/2026-06-19-phase7-memory.md). Built end-to-end by a background agent (TDD per task), then final-reviewed + hardened on `main`.

| Tool | Purpose |
|------|---------|
| `record_decision` / `query_decisions` | Persist + substring-query engineering decisions |
| `set_context` / `get_context` | Merge/read project context (architecture, constraints, goals, stack) |
| `record_history` / `search_history` | Persist + search bugs/incidents/bottlenecks (substring or exact kind) |

**Result:** 8 tests passing, builds + stdio smoke (6 tools). `MemoryStore` interface with `inMemoryStore` (tests) + `jsonFileStore` (persists across instances). Hardening `d65a946`: corrupt-file now fails loud (ENOENT→empty, else rethrow). MCP resources + direct ADR-file ingestion from `@seos/architecture` are documented deferred follow-ups.

---

## Phase 4 — `@seos/qa`

Plan: [docs/superpowers/plans/2026-06-19-phase4-qa.md](docs/superpowers/plans/2026-06-19-phase4-qa.md).

| Tool | Purpose |
|------|---------|
| `generate_tests` | Extract a file's real exported symbols → emit a Vitest skeleton importing them (no fabricated assertions) |
| `check_coverage` | Gate line-coverage against a minimum (default 80%) |
| `detect_regressions` | Diff baseline vs current test results → names of previously-passing tests that no longer pass (incl. disappeared) |

**Result:** 10 tests passing, builds + stdio smoke (3 tools). Pure deterministic functions.

---

## Phase 5 — `@seos/performance`

Plan: [docs/superpowers/plans/2026-06-19-phase5-performance.md](docs/superpowers/plans/2026-06-19-phase5-performance.md).

| Tool | Purpose |
|------|---------|
| `analyze_backend` | Detect N+1 queries (awaited DB call inside a loop) and `SELECT *` |
| `analyze_frontend` | Flag bundle assets over a byte budget (>2× budget → high severity) |
| `simulate_load` | Staged load simulation (default [100,1000,10000]) with an injectable runner; default is a concurrent-fetch sampler |

**Result:** 8 tests passing, builds + stdio smoke (3 tools). Static analysis is regex/heuristic (documented v0.1 gaps: multi-line & string-concat patterns, `spawn`/`execFile`); the default load runner is a lightweight sampler, not a full load tool.

---

## Phases 2-10 — sub-plan status

| Phase | Subsystem | Package | Sub-plan written | Expanded to TDD | Built |
|-------|-----------|---------|:---:|:---:|:---:|
| 2 | Engineering Quality | `@seos/architecture` | ✅ | ✅ | ✅ |
| 3 | Security | `@seos/security` | ✅ | ✅ | ✅ |
| 4 | Quality Assurance | `@seos/qa` | ✅ | ✅ | ✅ |
| 5 | Performance | `@seos/performance` | ✅ | ✅ | ✅ |
| 6 | DevOps | `@seos/devops` | ✅ | ⬜ | ⬜ |
| 7 | Engineering Memory | `@seos/memory` | ✅ | ✅ | ✅ |
| 8 | Multi-Agent Review Board | `@seos/review-board` | ✅ | ⬜ | ⬜ |
| 9 | Self-Healing | `@seos/self-healing` | ✅ | ⬜ | ⬜ |
| 10 | Enterprise / Compliance | `@seos/compliance` | ✅ | ⬜ | ⬜ |

---

## Decisions log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-06-19 | TypeScript + Node 24 for all packages | Best-supported MCP path; native npm registry access |
| 2026-06-19 | Phase 1 fully executable; Phases 2-10 as sub-plans | Avoids fabricating code against not-yet-existing inputs (placeholder risk) |
| 2026-06-19 | pnpm monorepo with one package per phase | Each subsystem independently installable/registerable as an MCP server |
| 2026-06-19 | Inject `fetch`/clients into all tools | Offline, deterministic tests |
| 2026-06-19 | Run Phases 3 & 7 in parallel via background agents in isolated git worktrees | User requested parallelism; disjoint packages; avoids `.git/index.lock` + lockfile collisions of same-tree parallel work |
| 2026-06-19 | Parallel phases use TDD + a final whole-package review (not per-task two-stage review) | Per-task review can't run across concurrent autonomous executors; final review is where prior phases' real findings surfaced anyway |
| 2026-06-19 | `@seos/memory` uses JSON-file store, not better-sqlite3 | Avoids native build risk on Windows; interface allows swapping later |
| 2026-06-19 | Security/memory add no new runtime deps | Minimizes lockfile churn across parallel worktrees (OSV via `fetch`, memory via fs) |
| 2026-06-19 | Phases 4 & 5: discard the parallel worktree output, rebuild on `main` from the detailed plans | The `isolation: worktree` base predated the just-committed Phase 4/5 plans, so both agents improvised from the coarse sub-spec and diverged from the reviewed contracts. Rebuilding verbatim from the detailed plans was cleaner than merge-then-rewrite. **Lesson: commit plan files well before dispatching worktree agents, or pass the plan inline.** |

## Open questions / next decision

- **Next phases:** 4 (QA), 5 (Performance), 6 (DevOps) are independent and could also run in parallel. Phase 8 (Review Board) should follow 4/5/6 since it composes them. Each needs writing-plans expansion before execution.

## Known caveats & deferred follow-ups

- **SDK API:** `@modelcontextprotocol/sdk@1.29.0` uses `McpServer.tool(name, desc, zodShape, cb)` (deprecated in favor of `registerTool`, but functional). Reconciled during Task 1.8.
- `verify_api` reliably catches module/namespace-level symbols; runtime-instance-only methods are a known limitation to refine later. Empty `symbolPath` now rejected at the schema (`min(1)`).
- **Deferred to Phase 2 (from final review):**
  - **#4** `daysSince("")` returns 0, so a package with missing registry publish-date metadata scores as "published today" (no staleness penalty). Rare on the public registry; relevant for private mirrors.
  - **#6** `tsconfig.json` uses `rootDir:"."` + `include:["src","tests"]` so a bare `tsc --emit` would emit tests into `dist/`. Harmless today (build uses tsup); split into `tsconfig.build.json` if CI ever emits via tsc.

---

## Changelog

- **2026-06-19** — Plan authored, self-reviewed, and saved. Progress report created.
- **2026-06-19** — Began Phase 1 via subagent-driven development (implementer + spec review + code-quality review per task). Toolchain verified: Node 24.13, pnpm 10.32, git 2.52.
- **2026-06-19** — Task 1.0 done: monorepo + `@seos/knowledge` scaffolded; deps resolved (`@modelcontextprotocol/sdk` 1.29, zod 3.25, tsup 8.5, vitest 2.1).
- **2026-06-19** — Task 1.1 done: shared types (`FetchFn`, `VersionCheck`, `DependencyRisk`, `ApiCheck`).
- **2026-06-19** — Task 1.2 done: npm registry client (`fetchPackageInfo`, `fetchWeeklyDownloads`); 6 tests. Review hardening: 404→0 but throw on other non-ok statuses; tsconfig now type-checks `tests/`.
- **2026-06-19** — Tasks 1.3–1.9 done: Node LTS client, version validator, dependency auditor (+caution-band test), hallucination detector, knowledge store + `get_knowledge`, MCP server entry (4 tools wired against SDK 1.29), sample profile + README + stdio smoke test. `@types/node` added where needed.
- **2026-06-19** — Final whole-implementation review run. Task 1.10 hardening landed (`8956b6a`): semver-aware `check_versions` (ranges no longer false-flagged), `get_knowledge` surfaces per-package `status` + wires `latestLtsRuntime` (removed dead code), `verify_api` rejects empty `symbolPath`, `KNOWLEDGE_PATH` defaults relative to the built file. Added `semver`/`@types/semver`.
- **2026-06-19** — ✅ **Phase 1 complete.** 21 tests green; 13 commits on the default branch; server builds and runs.
- **2026-06-19** — Phase 2 expanded into a detailed TDD plan and executed subagent-driven. Tasks 2.0–2.7 done: `@seos/architecture` with `intake`, `generateArchitecture`, `reviewDesign`, `writeAdr`, MCP entry (4 tools), README; 23 tests.
- **2026-06-19** — Phase 2 final review + Task 2.8 hardening (`0bc5206`): `z.coerce.number()` inputs, `generate_architecture` now derives the profile via `intake()` (no inconsistent derived fields), `slugify` empty→`untitled` fallback, ADR `writeFile` `wx` flag, generator→reviewer integration test, tier-boundary tests. 32 tests.
- **2026-06-19** — ✅ **Phase 2 complete.** Repo total: 22 commits, 2 MCP servers, 53 tests green.
- **Deferred (Phase 2 review):** #6 small-scale multi-region cache warning (correct behavior, note in README); #8 `@types/node` version alignment; #9 defensive `nextAdrNumber` catch.
- **2026-06-19** — Expanded Phase 3 (Security) and Phase 7 (Memory) into full TDD plans; committed planning docs (`2257c81`). Dispatched both as **parallel background agents in isolated git worktrees**.
- **2026-06-19** — Phase 3 done (8 commits): `@seos/security`, 18 tests. Phase 7 done (6 commits): `@seos/memory`, 6 tests. Both via autonomous TDD execution.
- **2026-06-19** — Final whole-package reviews run on both worktrees. Merged both branches into `main` (`a38d5e3`, `e6422ca`); resolved the lockfile overlap (`6e0589a`).
- **2026-06-19** — Hardening landed: security `639ac05` (`sk-proj-` keys, Windows path normalization, fail-loud OSV errors → 22 tests); memory `d65a946` (corrupt-file fails loud, kind-match test, write-semantics comment → 8 tests).
- **2026-06-19** — Worktrees + merged branches cleaned up. ✅ **Phases 3 & 7 complete.** Repo total: 42 commits, 4 MCP servers, **83 tests green** on `main`.
- **Deferred (Phase 3/7 reviews):** security multi-line & string-concat injection patterns, `spawn`/`execFile` coverage, auth-flow review; memory MCP resources + ADR ingestion. All documented in package READMEs as v0.1 gaps.
- **2026-06-19** — Added root [README.md](README.md) (project overview, server table, install/register). Expanded Phase 4 (QA) and Phase 5 (Performance) into detailed TDD plans (`0cf44fe`).
- **2026-06-19** — Dispatched Phases 4 & 5 as parallel worktree agents, but their worktree base predated the plan commit → both improvised from the coarse sub-spec and diverged from the reviewed contracts (final reviews flagged contract mismatches + a real N+1 brace-counting bug in Phase 5). **Discarded both worktree branches.**
- **2026-06-19** — Rebuilt Phases 4 & 5 directly on `main` from the detailed plans (one sequential agent, verbatim TDD). Agent caught a real bug in the plan's N+1 regex (`\bfind\b` can't match `findMany`) and fixed it via longest-first alternation. `@seos/qa` (10 tests) + `@seos/performance` (8 tests).
- **2026-06-19** — ✅ **Phases 4 & 5 complete.** Repo total: **6 MCP servers, 101 tests green** on `main`. Root README updated (4 & 5 → shipped, registration blocks added).
