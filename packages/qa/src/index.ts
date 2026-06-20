#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { generateTests } from "./generateTests.js";
import { checkCoverage } from "./checkCoverage.js";
import { detectRegressions } from "./detectRegressions.js";

const server = new McpServer({ name: "seos-qa", version: "0.1.0" });

server.tool(
  "generate_tests",
  "Generate a Vitest test skeleton for a source file's exported symbols (skeleton only — assertions are left as TODOs).",
  {
    file: z.object({ path: z.string(), content: z.string() }),
    kind: z.enum(["unit", "integration", "e2e"]),
  },
  async ({ file, kind }) => ({ content: [{ type: "text", text: JSON.stringify({ test: generateTests(file, kind) }, null, 2) }] }),
);

server.tool(
  "check_coverage",
  "Enforce a minimum line-coverage threshold against a coverage-summary; returns pass/fail and actual percentage.",
  {
    summary: z.object({ total: z.object({ lines: z.object({ pct: z.coerce.number() }) }) }),
    minimum: z.coerce.number().optional(),
  },
  async ({ summary, minimum }) => ({ content: [{ type: "text", text: JSON.stringify(checkCoverage(summary, minimum), null, 2) }] }),
);

server.tool(
  "detect_regressions",
  "Given a baseline and current set of test results, return the names of previously-passing tests that no longer pass.",
  {
    baseline: z.array(z.object({ name: z.string(), status: z.enum(["passed", "failed", "skipped"]) })),
    current: z.array(z.object({ name: z.string(), status: z.enum(["passed", "failed", "skipped"]) })),
  },
  async ({ baseline, current }) => ({
    content: [{ type: "text", text: JSON.stringify({ regressions: detectRegressions(baseline, current) }, null, 2) }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
