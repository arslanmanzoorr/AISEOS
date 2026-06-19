import { describe, it, expect } from "vitest";
import { fetchLatestLtsNode } from "../../src/registry/node.js";

function stubFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => body }) as Response) as unknown as typeof fetch;
}

describe("fetchLatestLtsNode", () => {
  it("returns the highest LTS major version", async () => {
    const latest = await fetchLatestLtsNode(
      stubFetch([
        { version: "v24.1.0", lts: "Krypton" },
        { version: "v22.5.0", lts: "Jod" },
        { version: "v23.0.0", lts: false },
      ]),
    );
    expect(latest).toBe("24");
  });
});
