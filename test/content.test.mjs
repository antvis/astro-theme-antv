import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { resolveConfig } from "../dist/compiler/config.js";
import { scanSite } from "../dist/compiler/content.js";
import { createLegacyContentMarkdownProcessor } from "../dist/markdown.js";

const baseConfig = () => ({
  site: {
    title: "Fixture",
    origin: "https://fixture.example.com",
    repository: "https://github.com/antvis/fixture",
    description: { zh: "测试", en: "Fixture" },
  },
  content: { docs: "./docs", examples: "./examples" },
  home: {
    title: { zh: "标题", en: "Title" },
    description: { zh: "描述", en: "Description" },
  },
});

async function createExampleFixture(metadata, sources = {}) {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-content-"));
  const demoDirectory = resolve(root, "examples/basic/simple/demo");
  await mkdir(resolve(root, "docs"), { recursive: true });
  await mkdir(demoDirectory, { recursive: true });
  await writeFile(
    resolve(demoDirectory, "meta.json"),
    typeof metadata === "string" ? metadata : JSON.stringify(metadata),
  );
  await Promise.all(
    Object.entries(sources).map(async ([path, source]) => {
      const target = resolve(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source);
    }),
  );
  return {
    root,
    demoDirectory,
    config: await resolveConfig(baseConfig(), root),
  };
}

test("rejects malformed and invalid Demo metadata with its source path", async () => {
  const malformed = await createExampleFixture("{");
  await assert.rejects(
    scanSite(malformed.config),
    (error) =>
      error instanceof Error &&
      error.message.startsWith("Invalid Demo metadata JSON: ") &&
      error.message.endsWith("/examples/basic/simple/demo/meta.json"),
  );

  const invalid = await createExampleFixture({
    demos: [{ filename: "chart.css", title: "Chart" }],
  });
  await assert.rejects(
    scanSite(invalid.config),
    /Invalid Demo metadata: .*meta\.json:.*JavaScript or TypeScript modules/s,
  );
});

test("rejects Demo source traversal and duplicate generated route keys", async () => {
  const traversal = await createExampleFixture({
    demos: [{ filename: "../outside.ts", title: "Outside" }],
  });
  await assert.rejects(scanSite(traversal.config), /escaped its root/);

  const duplicate = await createExampleFixture(
    {
      demos: [
        { filename: "hello.ts", title: "First" },
        { filename: "hello.ts", title: "Second" },
      ],
    },
    { "examples/basic/simple/demo/hello.ts": "export {};" },
  );
  await assert.rejects(
    scanSite(duplicate.config),
    /Duplicate Demo route key: basic\/simple\/hello/,
  );
});

test("rejects Demo sources that escape through symbolic links", async () => {
  const fixture = await createExampleFixture({
    demos: [{ filename: "leak.ts", title: "Leak" }],
  });
  const outside = await mkdtemp(resolve(tmpdir(), "antv-site-outside-"));
  const secret = resolve(outside, "secret.ts");
  await writeFile(secret, "export const secret = true;");
  await symlink(secret, resolve(fixture.demoDirectory, "leak.ts"));

  await assert.rejects(scanSite(fixture.config), /escaped its root/);
});

test("rejects legacy code sources that escape through symbolic links", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-markdown-"));
  const docs = resolve(root, "docs");
  const markdownPath = resolve(docs, "guide.zh.md");
  const outside = await mkdtemp(resolve(tmpdir(), "antv-site-outside-"));
  const secret = resolve(outside, "secret.ts");
  await mkdir(docs);
  await writeFile(markdownPath, "# Guide");
  await writeFile(secret, "export const secret = true;");
  await symlink(secret, resolve(docs, "leak.ts"));
  const config = await resolveConfig(
    { ...baseConfig(), content: { docs, examples: null } },
    root,
  );
  const processor = createLegacyContentMarkdownProcessor(
    {
      name: "fixture",
      options: {},
      async createRenderer() {
        return {
          async render(content) {
            return { code: content, metadata: {} };
          },
        };
      },
    },
    () => config,
  );
  const renderer = await processor.createRenderer({});

  await assert.rejects(
    renderer.render('<code src="./leak.ts"></code>', {
      fileURL: pathToFileURL(markdownPath),
    }),
    /escaped its root/,
  );
});

test("fails closed when example group frontmatter is invalid", async () => {
  const fixture = await createExampleFixture(
    {
      demos: [{ filename: "hello.ts", title: "Hello" }],
    },
    {
      "examples/basic/simple/demo/hello.ts": "export {};",
      "examples/basic/simple/index.zh.md": "---\ntitle: [\n\nBroken content",
    },
  );

  await assert.rejects(
    scanSite(fixture.config),
    /Invalid Markdown frontmatter: .*index\.zh\.md/,
  );
});
