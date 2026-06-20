# Engineering OS

> Engineering discipline for AI-assisted development — as Model Context Protocol servers.

![Protocol: MCP](https://img.shields.io/badge/protocol-MCP-6E56CF)
![Node](https://img.shields.io/badge/node-%E2%89%A524-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A510-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-ESM-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-143%20passing-brightgreen)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

**A governance layer for AI-assisted software development.** Engineering OS is a suite of [Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers that sit between a coding assistant and your codebase, enforcing the engineering discipline of a mature software organization — version and dependency safety, hallucination detection, architecture and security review, automated QA, performance analysis, deployment scaffolding, institutional memory, multi-agent code review, automated remediation, and compliance.

The premise is simple: most failures in AI-generated code aren't reasoning failures, they're *discipline* failures — an outdated dependency, a hallucinated API, a leaked secret, an unreviewed architecture, a missing test. Engineering OS makes that discipline automatic.

---

## Capabilities

Each capability is an independent MCP server you can run on its own or compose with the others. Every tool is deterministic and side-effect-free where possible, with all network and filesystem access injected — so they run fast and behave predictably.

| Domain | Server | What it does | Tools |
|--------|--------|--------------|-------|
| **Knowledge** | `@seos/knowledge` | Validates package versions against the live npm registry (semver-range aware), scores dependencies for abandonment risk, detects hallucinated APIs on installed packages, and serves a curated stack profile. | `check_versions`, `audit_dependency`, `verify_api`, `get_knowledge` |
| **Architecture** | `@seos/architecture` | Captures scale requirements, generates a structured architecture proposal, reviews it against design rules, and records Architecture Decision Records. | `intake_requirements`, `generate_architecture`, `review_design`, `write_adr` |
| **Security** | `@seos/security` | Secret scanning with frontend-leak escalation, live CVE lookups via [OSV.dev](https://osv.dev), static injection/XSS/eval detection, and threat modeling. | `scan_secrets`, `scan_dependencies`, `scan_code`, `threat_model` |
| **Quality** | `@seos/qa` | Generates test skeletons from a file's real exported symbols, enforces a coverage threshold, and detects regressions between test runs. | `generate_tests`, `check_coverage`, `detect_regressions` |
| **Performance** | `@seos/performance` | Detects backend N+1 queries and `SELECT *`, flags oversized frontend bundles against a budget, and runs staged load simulations. | `analyze_backend`, `analyze_frontend`, `simulate_load` |
| **Operations** | `@seos/devops` | Generates deployment infrastructure (Dockerfile, CI pipeline, health checks), observability scaffolding (logging/metrics/tracing), and reliability readiness checks. | `generate_infra`, `generate_observability`, `check_reliability` |
| **Memory** | `@seos/memory` | Persistent institutional memory — decisions, project context, and historical incidents that survive across sessions, behind a swappable store interface. | `record_decision`, `query_decisions`, `set_context`, `get_context`, `record_history`, `search_history` |
| **Review** | `@seos/review-board` | A multi-agent review board where each agent votes approve/reject; a change is approved only when no agent rejects. Extensible via a `ReviewAgent` interface. | `review_pr` |
| **Remediation** | `@seos/self-healing` | Turns production signals into a fix: dedupes logs/errors/metrics into issues, hypothesizes a root cause, proposes a fix and regression test, and opens a pull request — **never merging on its own**. | `ingest_signals`, `root_cause`, `propose_fix`, `create_pr` |
| **Compliance** | `@seos/compliance` | Checks a system against SOC 2 / GDPR / HIPAA / PCI control checklists and maintains a tamper-evident, hash-chained audit log. | `check_compliance`, `append_audit_log`, `verify_audit_log` |

## Requirements

- **Node.js** 24 or newer
- **pnpm** 10 or newer

## Installation

```bash
git clone <your-repo-url> engineering-os
cd engineering-os
pnpm install
pnpm -r build
```

## Connecting to a coding assistant

Engineering OS speaks MCP over stdio, so it works with any MCP-capable client (Claude Code, Claude Desktop, and others). After building, add the servers you want to your MCP configuration. A full configuration enabling every server:

```json
{
  "mcpServers": {
    "seos-knowledge": {
      "command": "node",
      "args": ["./packages/knowledge/dist/index.js"],
      "env": { "SEOS_KNOWLEDGE_PATH": "./packages/knowledge/knowledge.json" }
    },
    "seos-architecture": {
      "command": "node",
      "args": ["./packages/architecture/dist/index.js"],
      "env": { "SEOS_ADR_DIR": "./docs/adr" }
    },
    "seos-security": {
      "command": "node",
      "args": ["./packages/security/dist/index.js"]
    },
    "seos-qa": {
      "command": "node",
      "args": ["./packages/qa/dist/index.js"]
    },
    "seos-performance": {
      "command": "node",
      "args": ["./packages/performance/dist/index.js"]
    },
    "seos-devops": {
      "command": "node",
      "args": ["./packages/devops/dist/index.js"]
    },
    "seos-review-board": {
      "command": "node",
      "args": ["./packages/review-board/dist/index.js"]
    },
    "seos-self-healing": {
      "command": "node",
      "args": ["./packages/self-healing/dist/index.js"]
    },
    "seos-compliance": {
      "command": "node",
      "args": ["./packages/compliance/dist/index.js"]
    },
    "seos-memory": {
      "command": "node",
      "args": ["./packages/memory/dist/index.js"],
      "env": { "SEOS_MEMORY_PATH": "./memory.json" }
    }
  }
}
```

You don't need to enable all of them — each server stands alone. Start with `seos-knowledge` and `seos-security`, then add others as needed.

## Configuration

Most servers need no configuration. Those that do read a single environment variable:

| Server | Variable | Default | Purpose |
|--------|----------|---------|---------|
| `@seos/knowledge` | `SEOS_KNOWLEDGE_PATH` | `./knowledge.json` (next to the binary) | Path to the curated stack profile |
| `@seos/architecture` | `SEOS_ADR_DIR` | `docs/adr` | Directory where Architecture Decision Records are written |
| `@seos/memory` | `SEOS_MEMORY_PATH` | `./memory.json` (next to the binary) | Path to the persistent memory store |

Each package's own `README.md` documents its tools and options in full.

## Design principles

- **Deterministic primitives, not model calls.** These servers impose structure and catch known failure modes with transparent, testable rules. The assistant does the open-ended reasoning; Engineering OS keeps it honest.
- **Dependency injection throughout.** Network and filesystem access is injected, so behavior is predictable and the full suite runs offline.
- **Fail loud, never a false "all clear."** A check that cannot complete reports an error rather than silently passing.
- **One responsibility per module, one concern per server.** Every server is independently installable, testable, and replaceable.

## Project structure

```
engineering-os/
├── packages/
│   ├── knowledge/        # version, dependency & API governance
│   ├── architecture/     # architecture proposals & decision records
│   ├── security/         # secrets, CVEs, static analysis, threat modeling
│   ├── qa/               # test generation, coverage, regression detection
│   ├── performance/      # backend, frontend & load analysis
│   ├── devops/           # infrastructure, observability, reliability
│   ├── memory/           # persistent decisions, context & history
│   ├── review-board/     # multi-agent change review
│   ├── self-healing/     # signal → root cause → fix → pull request
│   └── compliance/       # SOC2/GDPR/HIPAA/PCI checks & audit log
└── docs/
    └── adr/              # Architecture Decision Records
```

## Development

```bash
pnpm -r build            # build every package
pnpm -r test             # run the full test suite
pnpm --filter @seos/security test     # test a single package
```

The codebase is TypeScript (ESM, NodeNext) and tested with Vitest. Contributions follow test-driven development: a failing test, the minimal implementation, a passing test.

## License

MIT
