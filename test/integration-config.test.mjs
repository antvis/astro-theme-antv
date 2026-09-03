import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
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
      markdown: { processor: markdownProcessor },
      output: "static",
      root: pathToFileURL(`${root}/`),
    },
    injectRoute(route) {
      injectedRoutes.push(route.pattern);
    },
    updateConfig(value) {
      update = value;
    },
  });

  assert.equal(Object.hasOwn(update, "publicDir"), false);
  assert.equal(Object.hasOwn(update, "output"), false);
  assert.ok(injectedRoutes.includes("/[locale]/result"));
  assert.ok(injectedRoutes.includes("/llms.txt"));
  assert.ok(injectedRoutes.includes("/llms-full.txt"));
  assert.ok(injectedRoutes.includes("/markdown/[locale]/[...route].md"));
  assert.ok(injectedRoutes.includes("/[locale]/[...route]"));
});
