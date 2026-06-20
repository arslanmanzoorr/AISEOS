export type FetchFn = typeof fetch;

export type Severity = "high" | "medium" | "low";

export interface SourceFile {
  path: string;
  content: string;
}

export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  file?: string;
}

export interface BundleAsset {
  name: string;
  sizeBytes: number;
}

export interface BuildStats {
  assets: BundleAsset[];
}

export interface LoadResult {
  concurrency: number;
  latencyMs: number;
  errorRate: number; // 0..1
}

export type LoadRunner = (target: string, concurrency: number) => Promise<{ latencyMs: number; errorRate: number }>;
