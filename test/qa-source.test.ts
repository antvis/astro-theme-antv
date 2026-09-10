import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("QA SDK boundary", () => {
  it("keeps prompts out of result URLs and mounts the external SDK", async () => {
    const entrySource = await readFile(
      resolve(process.cwd(), "src/theme/features/qa/entry.ts"),
      "utf8",
    );
    const resultSource = await readFile(
      resolve(process.cwd(), "src/theme/features/qa/result.ts"),
      "utf8",
    );

    expect(entrySource).not.toContain("searchParams.set('q'");
    expect(entrySource).not.toContain("searchParams.set('stack'");
    expect(resultSource).not.toContain("params.get('q'");
    expect(resultSource).not.toContain("params.get('stack'");
    expect(resultSource).toContain("window.SiveQA.mount");
    expect(resultSource).not.toContain("fetch(");
    expect(resultSource).not.toContain("EventSource");
  });
});
