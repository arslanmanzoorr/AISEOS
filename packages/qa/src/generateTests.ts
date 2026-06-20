import type { SourceFile, TestKind } from "./types.js";

function exportedNames(content: string): string[] {
  const names = new Set<string>();
  for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of content.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=/g)) names.add(m[1]);
  return [...names];
}

function moduleSpecifier(path: string): string {
  const base = path.replace(/^.*\//, "").replace(/\.tsx?$/, ".js");
  return `./${base}`;
}

export function generateTests(file: SourceFile, kind: TestKind): string {
  const names = exportedNames(file.content);
  if (names.length === 0) {
    return `// No exported symbols found in ${file.path}; nothing to generate.`;
  }
  const spec = moduleSpecifier(file.path);
  const header = `// ${kind} tests for ${file.path} (generated skeleton — fill in assertions)\n`;
  const importLine = `import { ${names.join(", ")} } from "${spec}";\nimport { describe, it, expect } from "vitest";\n\n`;
  const blocks = names
    .map((n) => `describe("${n}", () => {\n  it("TODO: specify behavior", () => {\n    expect(${n}).toBeDefined();\n  });\n});\n`)
    .join("\n");
  return header + importLine + blocks;
}
