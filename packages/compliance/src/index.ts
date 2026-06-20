#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { checkCompliance } from "./checkCompliance.js";
import { appendAuditLog, verifyAuditLog } from "./auditLog.js";

const server = new McpServer({ name: "seos-compliance", version: "0.1.0" });

const controlsShape = z.object({
  encryptionAtRest: z.boolean().optional(),
  encryptionInTransit: z.boolean().optional(),
  accessControl: z.boolean().optional(),
  auditLogging: z.boolean().optional(),
  dataRetentionPolicy: z.boolean().optional(),
  incidentResponsePlan: z.boolean().optional(),
  dataSubjectRights: z.boolean().optional(),
  cardholderDataIsolation: z.boolean().optional(),
  phiSafeguards: z.boolean().optional(),
});

const eventShape = z.object({ actor: z.string(), action: z.string(), timestamp: z.string() });
const entryShape = eventShape.extend({ index: z.coerce.number(), prevHash: z.string(), hash: z.string() });

server.tool(
  "check_compliance",
  "Check a system's controls against SOC2, GDPR, HIPAA, or PCI; returns compliance status and gaps.",
  { framework: z.enum(["soc2", "gdpr", "hipaa", "pci"]), controls: controlsShape },
  async ({ framework, controls }) => ({ content: [{ type: "text", text: JSON.stringify(checkCompliance(framework, controls), null, 2) }] }),
);

server.tool(
  "append_audit_log",
  "Append a tamper-evident, hash-chained audit entry. Returns the new entry to persist.",
  { entries: z.array(entryShape), event: eventShape },
  async ({ entries, event }) => ({ content: [{ type: "text", text: JSON.stringify(appendAuditLog(entries, event), null, 2) }] }),
);

server.tool(
  "verify_audit_log",
  "Verify the integrity of a hash-chained audit log; reports the first tampered index if any.",
  { entries: z.array(entryShape) },
  async ({ entries }) => ({ content: [{ type: "text", text: JSON.stringify(verifyAuditLog(entries), null, 2) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
