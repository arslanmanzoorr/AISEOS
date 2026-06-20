import type { ReliabilityConfig, ReliabilityResult } from "./types.js";

const REQUIRED: (keyof ReliabilityConfig)[] = ["backupStrategy", "restoreStrategy", "rollbackStrategy"];

export function checkReliability(config: ReliabilityConfig): ReliabilityResult {
  const missing = REQUIRED.filter((k) => !config[k] || config[k]!.trim() === "");
  return { ready: missing.length === 0, missing };
}
