import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "@seos/context";
import { runBoard } from "./board.js";
import { defaultAgents } from "./agents.js";

export function registerTools(server: McpServer, _ctx: ToolContext): void {
  server.tool(
    "review_pr",
    "Run the multi-agent review board (documentation, secret-scan, large-file) over a pull request; approves only when no agent rejects.",
    {
      files: z.array(z.object({ path: z.string(), content: z.string() })),
      description: z.string().optional(),
    },
    async (pr) => ({ content: [{ type: "text", text: JSON.stringify(await runBoard(pr, defaultAgents), null, 2) }] }),
  );
}
