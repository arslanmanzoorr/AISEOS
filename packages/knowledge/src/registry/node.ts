import type { FetchFn } from "../types.js";

interface NodeRelease {
  version: string; // "v24.1.0"
  lts: string | false;
}

export async function fetchLatestLtsNode(fetchFn: FetchFn = fetch): Promise<string> {
  const res = await fetchFn("https://nodejs.org/dist/index.json");
  if (!res.ok) throw new Error(`nodejs.org returned ${res.status}`);
  const releases = (await res.json()) as NodeRelease[];
  const ltsMajors = releases
    .filter((r) => r.lts !== false)
    .map((r) => Number(r.version.replace(/^v/, "").split(".")[0]));
  if (ltsMajors.length === 0) return "";
  return String(Math.max(...ltsMajors));
}
