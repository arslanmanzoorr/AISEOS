#!/usr/bin/env node
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkVersions } from "./tools/checkVersions.js";
import { auditDependency } from "./tools/auditDependency.js";
import { verifyApi } from "./tools/verifyApi.js";
import { getKnowledge } from "./tools/getKnowledge.js";
import { fileKnowledgeStore } from "./knowledge/store.js";

const KNOWLEDGE_PATH = process.env.SEOS_KNOWLEDGE_PATH ?? "./knowledge.json";

const server = new McpServer({ name: "seos-knowledge", version: "0.1.0" });

server.tool(
  "check_versions",
  "Check npm package versions against the registry",
  {
    packages: z.array(
      z.object({
        name: z.string(),
        requested: z.string().optional(),
      }),
    ),
  },
  async ({ packages }) => {
    const results = await checkVersions(packages);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  },
);

server.tool(
  "audit_dependency",
  "Audit a npm dependency for risk signals",
  { name: z.string() },
  async ({ name }) => {
    const result = await auditDependency(name);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "verify_api",
  "Verify that a package exports a given symbol path",
  {
    package: z.string(),
    symbolPath: z.string(),
  },
  async ({ package: pkg, symbolPath }) => {
    const result = await verifyApi(pkg, symbolPath);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "get_knowledge",
  "Load the stack knowledge profile with latest package versions",
  async () => {
    const result = await getKnowledge(
      fileKnowledgeStore(KNOWLEDGE_PATH),
      async (names) =>
        (await checkVersions(names.map((name) => ({ name })))).map((c) => ({
          name: c.name,
          latest: c.latest,
        })),
    );
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
