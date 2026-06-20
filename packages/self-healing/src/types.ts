export type SignalSource = "log" | "error" | "metric";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Signal {
  source: SignalSource;
  message: string;
  severity?: Severity;
}

export interface Issue {
  id: string;
  signature: string; // normalized message used for grouping
  count: number;
  severity: Severity;
  sample: string; // first raw message in the group
}

export interface RootCause {
  issueId: string;
  category: string; // e.g. "connectivity", "null-reference", "memory", "concurrency", "unknown"
  hypothesis: string;
  evidence: string[];
}

export interface FixProposal {
  category: string;
  summary: string;
  patch: string; // textual recommendation, not an applied diff
  tests: string; // a Vitest stub
}

export type CommandRunner = (command: string, args: string[]) => Promise<string>;

export interface PrResult {
  branch: string;
  commands: string[]; // the command plan that was run (joined argv), for transparency
  merged: false; // ALWAYS false — self-healing never merges
}
