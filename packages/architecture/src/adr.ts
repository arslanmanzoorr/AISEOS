import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AdrRecord } from "./types.js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export async function nextAdrNumber(dir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 1;
  }
  let max = 0;
  for (const name of entries) {
    const m = /^(\d{4})-.*\.md$/.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export async function writeAdr(record: AdrRecord, dir = "docs/adr"): Promise<string> {
  await mkdir(dir, { recursive: true });
  const n = await nextAdrNumber(dir);
  const num = String(n).padStart(4, "0");
  const slug = slugify(record.decision);
  const status = record.status ?? "accepted";
  const path = resolve(join(dir, `${num}-${slug}.md`));

  const body = [
    `# ${n}. ${record.decision}`,
    "",
    `- Status: ${status}`,
    `- Date: ${record.date}`,
    "",
    "## Decision",
    "",
    record.decision,
    "",
    "## Reason",
    "",
    record.reason,
    "",
  ].join("\n");

  await writeFile(path, body, "utf8");
  return path;
}
