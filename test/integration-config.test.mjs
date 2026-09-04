import { access, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { antvSite } from "../dist/integration.js";

const baseConfig = () => ({
  site: {
    title: "Fixture",
    origin: "https://fixture.example.com",
    repository: "https://github.com/antvis/fixture",
    description: { zh: "测试", en: "Fixture" },
  },
  content: {},
  qa: { enabled: true },
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
  await expect(
    setup({
      config: {
        output: "server",
        root: pathToFileURL(`${resolve(".")}/`),
      },
    }),
  ).rejects.toThrow(/supports Astro static output only/);
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

  await expect(
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
  ).rejects.toThrow(/overlaps a protected input or workspace directory/);
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

  await expect(
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
  ).rejects.toThrow(/Home slot "hero" component does not exist/);
  expect(mutations).toEqual([]);
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

  expect(Object.hasOwn(update, "publicDir")).toBe(false);
  expect(Object.hasOwn(update, "outDir")).toBe(false);
  expect(Object.hasOwn(update, "output")).toBe(false);
  const routePatterns = injectedRoutes.map((route) => route.pattern);
  expect(routePatterns).toContain("/[locale]/result");
  expect(routePatterns).toContain("/llms.txt");
  expect(routePatterns).toContain("/llms-full.txt");
  expect(routePatterns).toContain("/markdown/[locale]/[...route].md");
  expect(routePatterns).toContain("/[locale]/[...route]");
  await Promise.all(
    injectedRoutes.map((route) => access(new URL(route.entrypoint))),
  );
  expect(update.vite.plugins.map((plugin) => plugin.name)).toEqual([
    "antv-site-slots",
    "antv-site-demos",
    "antv-site-qa",
  ]);
  expect(update.vite.define["import.meta.env.ANTV_SITE_DEVELOPMENT_SEARCH"]).toBe(
    '"false"',
  );
  expect(update.vite.define["import.meta.env.ANTV_SITE_DEVELOPMENT"]).toBe(
    "false",
  );
  expect(update.vite.server.fs.allow).toContain(resolve("dist/theme"));
  expect(update.vite.server.fs.allow).toContain(resolve("dist/qa-adapters"));
});

test("does not add QA integration capabilities when the switch is disabled", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-integration-"));
  await Promise.all([mkdir(resolve(root, "docs")), mkdir(resolve(root, "examples"))]);
  const injectedRoutes = [];
  let update;
  const integration = antvSite({ ...baseConfig(), qa: { enabled: false } });
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

  expect(injectedRoutes.some((route) => route.pattern === "/[locale]/result")).toBe(false);
  expect(update.vite.plugins.some((plugin) => plugin.name === "antv-site-qa")).toBe(false);
  expect(update.vite.server.fs.allow.includes(resolve("dist/qa-adapters"))).toBe(false);
});
