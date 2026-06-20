#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { ingestSignals } from "./ingestSignals.js";
import { rootCause } from "./rootCause.js";
import { proposeFix } from "./proposeFix.js";
import { createPr } from "./createPr.js";

const severity = z.enum(["critical", "high", "medium", "low"]);
const server = new McpServer({ name: "seos-self-healing", version: "0.1.0" });

server.tool(
  "ingest_signals",
  "Group raw logs/errors/metrics into deduplicated issues (by normalized signature).",
  { signals: z.array(z.object({ source: z.enum(["log", "error", "metric"]), message: z.string(), severity: severity.optional() })) },
  async ({ signals }) => ({ content: [{ type: "text", text: JSON.stringify(ingestSignals(signals), null, 2) }] }),
);

const issueShape = {
  id: z.string(),
  signature: z.string(),
  count: z.coerce.number(),
  severity,
  sample: z.string(),
};

server.tool(
  "root_cause",
  "Hypothesize the root cause category of an issue from its signature.",
  issueShape,
  async (issue) => ({ content: [{ type: "text", text: JSON.stringify(rootCause(issue), null, 2) }] }),
);

const rootCauseShape = {
  issueId: z.string(),
  category: z.string(),
  hypothesis: z.string(),
  evidence: z.array(z.string()),
};

server.tool(
  "propose_fix",
  "Propose a fix (summary, patch recommendation, regression test stub) for a root cause.",
  rootCauseShape,
  async (cause) => ({ content: [{ type: "text", text: JSON.stringify(proposeFix(cause), null, 2) }] }),
);

server.tool(
  "create_pr",
  "Open a PR for a proposed fix via git/gh. NEVER merges — a human and the review board approve.",
  { category: z.string(), summary: z.string(), patch: z.string(), tests: z.string() },
  async (fix) => ({ content: [{ type: "text", text: JSON.stringify(await createPr(fix), null, 2) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
