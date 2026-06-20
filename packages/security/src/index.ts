#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { localContext } from "@seos/context";
import { registerTools } from "./register.js";

const server = new McpServer({ name: "seos-security", version: "0.1.0" });
registerTools(server, localContext());
await server.connect(new StdioServerTransport());
