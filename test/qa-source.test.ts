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
    expect(entrySource).toContain('sive:qa:pending-prompt');
    expect(entrySource).not.toContain('fetch(');
    expect(resultSource).not.toContain("params.get('q'");
    expect(resultSource).not.toContain("params.get('stack'");
    expect(resultSource).toContain("window.SiveQA.mount");
    expect(resultSource).not.toContain("fetch(");
    expect(resultSource).not.toContain("EventSource");
  });

  it("keeps suggestion copy in consumers and shares the SDK handoff", async () => {
    const component = await readFile(resolve(process.cwd(), "src/theme/components/QaEntry.astro"), "utf8");
    const entry = await readFile(resolve(process.cwd(), "src/theme/features/qa/entry.ts"), "utf8");
    expect(component).toContain("suggestions?: readonly string[]");
    expect(component).toContain("suggestions = []");
    expect(component).toContain("data-qa-suggestion={question}");
    expect(component).not.toContain("帮我配置state");
    expect(entry).toContain("event.submitter.dataset.qaSuggestion");
    expect(entry).toContain("sessionStorage.setItem(PENDING_PROMPT_KEY, text)");
    expect(entry).toContain("disconnectedCallback()");
    expect(entry).toContain("this.listeners?.abort()");
  });
});
