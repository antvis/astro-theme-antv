import assert from "node:assert/strict";
import { access, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { antvSite } from "../dist/integration.js";

const baseConfig = () => ({
  site: {
    title: "Fixture",
    origin: "https://fixture.example.com",
    repository: "https://github.com/antvis/fixture",
    description: { zh: "测试", en: "Fixture" },
  },
  content: {},
  qa: {},
  home: {
    title: { zh: "标题", en: "Title" },
    description: { zh: "描述", en: "Description" },
  },
});

const markdownProcessor = {
  name: "fixture",
  options: {},
  async createRenderer() {
    return { render: async () => ({ code: "", metadata: {} }) };
  },
};

test("rejects non-static Astro output before mutating configuration", async () => {
  const integration = antvSite(baseConfig());
  const setup = integration.hooks["astro:config:setup"];
  await assert.rejects(
    setup({
      config: {
        output: "server",
        root: pathToFileURL(`${resolve(".")}/`),
      },
    }),
    /supports Astro static output only/,
  );
});

test("rejects Astro outDir that overlaps a custom source directory", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-integration-"));
  const srcDir = resolve(root, "source");
  await Promise.all([
    mkdir(resolve(root, "docs")),
    mkdir(resolve(root, "examples")),
    mkdir(srcDir),
    mkdir(resolve(root, "static")),
    mkdir(resolve(root, ".cache")),
  ]);
  const integration = antvSite(baseConfig());
  const setup = integration.hooks["astro:config:setup"];

  await assert.rejects(
    setup({
      config: {
        cacheDir: pathToFileURL(`${resolve(root, ".cache")}/`),
        outDir: pathToFileURL(`${srcDir}/`),
        output: "static",
        publicDir: pathToFileURL(`${resolve(root, "static")}/`),
        root: pathToFileURL(`${root}/`),
        srcDir: pathToFileURL(`${srcDir}/`),
      },
    }),
    /overlaps a protected input or workspace directory/,
  );
});

test("does not partially mutate Astro when a feature boundary fails", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-integration-"));
  await mkdir(resolve(root, "docs"));
  await mkdir(resolve(root, "examples"));
  const integration = antvSite({
    ...baseConfig(),
    slots: { home: { hero: ["./missing-home-slot.astro"] } },
  });
  const setup = integration.hooks["astro:config:setup"];
  const mutations = [];

  await assert.rejects(
    setup({
      addWatchFile(path) {
        mutations.push(["watch", path]);
      },
      command: "build",
      config: {
        base: "/",
        cacheDir: pathToFileURL(`${resolve(root, ".astro")}/`),
        markdown: { processor: markdownProcessor },
        outDir: pathToFileURL(`${resolve(root, "dist")}/`),
        output: "static",
        publicDir: pathToFileURL(`${resolve(root, "public")}/`),
        root: pathToFileURL(`${root}/`),
        srcDir: pathToFileURL(`${resolve(root, "src")}/`),
      },
      injectRoute(route) {
        mutations.push(["route", route.pattern]);
      },
      updateConfig() {
        mutations.push(["config"]);
      },
    }),
    /Home slot "hero" component does not exist/,
  );
  assert.deepEqual(mutations, []);
});

test("preserves Astro publicDir and injects QA as a dedicated route", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-integration-"));
  await mkdir(resolve(root, "docs"));
  await mkdir(resolve(root, "examples"));
  const injectedRoutes = [];
  let update;
  const integration = antvSite(baseConfig());
  const setup = integration.hooks["astro:config:setup"];

  await setup({
    addWatchFile() {},
    command: "build",
    config: {
      base: "/",
      cacheDir: pathToFileURL(`${resolve(root, ".astro")}/`),
      markdown: { processor: markdownProcessor },
      outDir: pathToFileURL(`${resolve(root, "dist")}/`),
      output: "static",
      publicDir: pathToFileURL(`${resolve(root, "public")}/`),
      root: pathToFileURL(`${root}/`),
      srcDir: pathToFileURL(`${resolve(root, "src")}/`),
    },
    injectRoute(route) {
      injectedRoutes.push(route);
    },
    updateConfig(value) {
      update = value;
    },
  });

  assert.equal(Object.hasOwn(update, "publicDir"), false);
  assert.equal(Object.hasOwn(update, "outDir"), false);
  assert.equal(Object.hasOwn(update, "output"), false);
  const routePatterns = injectedRoutes.map((route) => route.pattern);
  assert.ok(routePatterns.includes("/[locale]/result"));
  assert.ok(routePatterns.includes("/llms.txt"));
  assert.ok(routePatterns.includes("/llms-full.txt"));
  assert.ok(routePatterns.includes("/markdown/[locale]/[...route].md"));
  assert.ok(routePatterns.includes("/[locale]/[...route]"));
  await Promise.all(
    injectedRoutes.map((route) => access(new URL(route.entrypoint))),
  );
  assert.deepEqual(
    update.vite.plugins.map((plugin) => plugin.name),
    ["antv-site-slots", "antv-site-demos", "antv-site-qa"],
  );
  assert.equal(
    update.vite.define["import.meta.env.ANTV_SITE_DEVELOPMENT_SEARCH"],
    '"false"',
  );
  assert.equal(
    update.vite.define["import.meta.env.ANTV_SITE_DEVELOPMENT"],
    'false',
  );
  assert.ok(update.vite.server.fs.allow.includes(resolve("dist/theme")));
  assert.ok(update.vite.server.fs.allow.includes(resolve("dist/qa-adapters")));
});
