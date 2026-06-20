import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "@seos/context";

import { scanSecrets } from "./scanSecrets.js";
import { scanVulnerabilities } from "./scanDependencies.js";
import { scanCode } from "./scanCode.js";
import { threatModel } from "./threatModel.js";

const fileShape = { files: z.array(z.object({ path: z.string(), content: z.string() })) };

export function registerTools(server: McpServer, _ctx: ToolContext): void {
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
}
