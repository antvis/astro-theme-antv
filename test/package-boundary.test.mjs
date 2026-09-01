import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
);

test("publishes a site configuration facade without a parallel CLI", async () => {
  assert.equal(packageJson.name, "@antv/site");
  assert.equal(packageJson.bin, undefined);
  assert.deepEqual(Object.keys(packageJson.exports), [
    ".",
    "./content",
    "./qa",
    "./qa-entry",
  ]);
  assert.equal(packageJson.peerDependencies.astro, ">=7.2.0 <8");
  assert.equal(packageJson.dependencies["@antv/g2"], undefined);
  assert.equal(packageJson.dependencies["@antv/g6"], undefined);
  assert.equal(packageJson.dependencies["@antv/s2"], undefined);

  for (const dependency of [
    "esbuild",
    "codemirror",
    "sucrase",
  ]) {
    assert.equal(packageJson.dependencies[dependency], undefined);
  }
  assert.equal(packageJson.dependencies.pagefind, "1.5.2");
  assert.equal(packageJson.dependencies["@astrojs/mdx"], "7.0.8");
  assert.equal(packageJson.dependencies.dompurify, "3.4.14");
  assert.equal(packageJson.dependencies["highlight.js"], "11.12.0");

  const publicApi = await import("../dist/index.js");
  const { defineConfig } = publicApi;
  const publicConfig = defineConfig({
    site: {
      title: "Fixture",
      origin: "https://fixture.example.com",
      repository: "https://github.com/antvis/fixture",
      description: { zh: "测试", en: "Fixture" },
    },
    content: {},
    home: {
      title: { zh: "标题", en: "Title" },
      description: { zh: "描述", en: "Description" },
    },
  });
  assert.equal(typeof defineConfig, "function");
  assert.equal(publicApi.default, defineConfig);
  assert.deepEqual(publicApi.qaProducts, ["g2", "s2", "g6", "f2", "x6", "l7"]);
  assert.deepEqual(publicApi.qaPreviewProducts, ["g2", "s2", "g6"]);
  assert.equal(typeof publicApi.antvSite, "function");
  assert.equal(publicConfig.integrations?.length, 3);
  assert.equal(publicConfig.integrations?.[0]?.name, "@antv/site");
  assert.equal(publicConfig.integrations?.[1]?.name, "@astrojs/mdx");
  assert.equal(publicConfig.integrations?.[2]?.name, "@astrojs/sitemap");

  const contentApi = await import("../dist/content.js");
  assert.equal(contentApi.antvDocsLoader().name, "glob-loader");
  assert.deepEqual(
    contentApi.antvDocsSchema.parse({ title: "Guide" }),
    {
      title: "Guide",
      order: 0,
      sidebar: { hidden: false },
      draft: false,
    },
  );
  assert.deepEqual(contentApi.getAntvDocIdentity("zh/guide"), {
    locale: "zh",
    slug: "guide",
    section: "guide",
    route: "/zh/guide/",
  });

  await access(resolve(packageRoot, "dist/integration.js"));
  await access(resolve(packageRoot, "dist/content.js"));
  await access(resolve(packageRoot, "dist/qa.js"));
  await access(resolve(packageRoot, "dist/qa-adapters/index.js"));
  await access(resolve(packageRoot, "dist/search.js"));
  await access(resolve(packageRoot, "dist/slots.js"));
  await access(resolve(packageRoot, "dist/vite/demo-plugin.js"));
  await access(resolve(packageRoot, "dist/vite/qa-plugin.js"));
  await access(resolve(packageRoot, "dist/vite/slots-plugin.js"));
  await access(resolve(packageRoot, "theme/src/components/Demo.astro"));
  await access(resolve(packageRoot, "theme/src/components/QaResult.astro"));
  await access(resolve(packageRoot, "theme/src/components/QaEntry.astro"));
  await access(resolve(packageRoot, "theme/src/components/SiteSearch.astro"));
  await access(resolve(packageRoot, "theme/src/pages/demos/[...key].astro"));
  for (const removedPath of [
    "src/cli.ts",
    "src/demo-runtime/index.ts",
    "dist/cli.js",
    "dist/compiler/registry.js",
    "dist/demo-runtime/index.js",
    "dist/runtime/build.js",
    "dist/verify.js",
  ]) {
    await assert.rejects(access(resolve(packageRoot, removedPath)));
  }
});
