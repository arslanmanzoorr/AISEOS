import type { Issue, Severity, Signal } from "./types.js";

const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function signature(message: string): string {
  return message
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, "ADDR")
    .replace(/\d+/g, "N")
    .replace(/\s+/g, " ")
    .trim();
}

export function ingestSignals(signals: Signal[]): Issue[] {
  const groups = new Map<string, { sample: string; count: number; severity: Severity }>();
  const order: string[] = [];

  for (const s of signals) {
    const sig = signature(s.message);
    const sev = s.severity ?? "medium";
    const existing = groups.get(sig);
    if (!existing) {
      groups.set(sig, { sample: s.message, count: 1, severity: sev });
      order.push(sig);
    } else {
      existing.count += 1;
      if (RANK[sev] > RANK[existing.severity]) existing.severity = sev;
    }
  }

  return order.map((sig, i) => {
    const g = groups.get(sig)!;
    return { id: `issue-${i + 1}`, signature: sig, count: g.count, severity: g.severity, sample: g.sample };
  });
}
