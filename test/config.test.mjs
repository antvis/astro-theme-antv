import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { resolveConfig } from "../dist/compiler/config.js";

const baseConfig = () => ({
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

test("resolves the minimal site config with defaults", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  await mkdir(resolve(root, "docs"));
  await mkdir(resolve(root, "examples"));
  const config = await resolveConfig(baseConfig(), root);
  const physicalRoot = await realpath(root);

  assert.equal(config.root, physicalRoot);
  assert.equal(config.content.docs, resolve(physicalRoot, "docs"));
  assert.equal(config.content.examples, resolve(physicalRoot, "examples"));
  assert.equal(config.content.collectionName, "docs");
  assert.equal(config.demo.height, 480);
  assert.equal(config.search.enabled, true);
  assert.deepEqual(config.search.aliases, {});
  assert.deepEqual(config.search.pathBoosts, []);
  assert.equal(config.qa, null);
  assert.deepEqual(config.slots.home, {
    beforeHero: [],
    hero: [],
    afterHero: [],
    beforeFeatures: [],
    features: [],
    afterFeatures: [],
    beforeFooter: [],
  });
  assert.deepEqual(config.theme.tokens, {});
  assert.deepEqual(config.site.locales, ["zh", "en"]);
  assert.equal(config.output, resolve(physicalRoot, "dist"));
});

test("resolves a custom docs collection name", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    { ...baseConfig(), content: { docs: "./docs", collectionName: "documentation" } },
    root,
  );
  assert.equal(config.content.collectionName, "documentation");
});


test("resolves flat theme tokens and rejects removed color-mode maps", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    {
      ...baseConfig(),
      theme: {
        tokens: {
          "--brand": "#5b5bd6",
          "--surface-raised": "#fefefe",
        },
      },
    },
    root,
  );

  assert.deepEqual(config.theme.tokens, {
    "--brand": "#5b5bd6",
    "--surface-raised": "#fefefe",
  });
  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        theme: { tokens: { light: { "--brand": "#5b5bd6" } } },
      },
      root,
    ),
    (error) =>
      Array.isArray(error?.issues) &&
      error.issues.some(
        (issue) => issue.path.join(".") === "theme.tokens.light",
      ),
  );
});

test("resolves search and QA configuration for the Astro integration", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    {
      ...baseConfig(),
      search: {
        aliases: { graph: ["chart"] },
        pathBoosts: [{ prefix: "/guide/", weight: 500 }],
      },
      qa: {
        defaultStack: "s2",
        previewProducts: ["g2", "s2"],
        previewAdapters: { custom: "./qa/custom.ts" },
      },
    },
    root,
  );
  const physicalRoot = await realpath(root);

  assert.equal(config.search.enabled, true);
  assert.deepEqual(config.search.aliases, { graph: ["chart"] });
  assert.equal(config.qa?.path, "result");
  assert.equal(config.qa?.defaultStack, "s2");
  assert.deepEqual(config.qa?.previewProducts, ["g2", "s2"]);
  assert.deepEqual(config.qa?.service, {
    development: "http://localhost:3000",
    production: "https://sive.antv.antgroup.com",
  });
  assert.equal(
    config.qa?.previewAdapters.custom,
    resolve(physicalRoot, "qa/custom.ts"),
  );
});

test("defaults omitted QA preview products to every available built-in", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const defaults = await resolveConfig(
    { ...baseConfig(), qa: {} },
    root,
  );
  const disabled = await resolveConfig(
    { ...baseConfig(), qa: { previewProducts: [] } },
    root,
  );
  const customOverride = await resolveConfig(
    {
      ...baseConfig(),
      qa: { previewAdapters: { g2: "./qa/g2.ts" } },
    },
    root,
  );

  assert.deepEqual(defaults.qa?.previewProducts, ["g2", "s2", "g6"]);
  assert.deepEqual(disabled.qa?.previewProducts, []);
  assert.deepEqual(customOverride.qa?.previewProducts, ["s2", "g6"]);
  assert.equal(
    customOverride.qa?.previewAdapters.g2,
    resolve(await realpath(root), "qa/g2.ts"),
  );
});

test("rejects duplicate and conflicting built-in QA preview adapters", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));

  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        qa: { previewProducts: ["g2", "g2"] },
      },
      root,
    ),
    /Duplicate QA preview product: g2/,
  );
  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        qa: {
          previewProducts: ["g2"],
          previewAdapters: { g2: "./qa/g2.ts" },
        },
      },
      root,
    ),
    /conflicts with an enabled built-in preview product/,
  );
});

test("resolves controlled home slot components from the consumer root", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    {
      ...baseConfig(),
      slots: {
        home: {
          hero: ["./site/Home.astro"],
          beforeFooter: ["./site/FooterNote.astro"],
        },
      },
    },
    root,
  );
  const physicalRoot = await realpath(root);

  assert.deepEqual(config.slots.home.hero, [
    resolve(physicalRoot, "site/Home.astro"),
  ]);
  assert.deepEqual(config.slots.home.beforeFooter, [
    resolve(physicalRoot, "site/FooterNote.astro"),
  ]);
  assert.deepEqual(config.slots.home.afterHero, []);
});

test("rejects example categories when example discovery is disabled", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = {
    ...baseConfig(),
    content: { examples: null },
    examples: [{ slug: "basic", title: { zh: "基础", en: "Basic" } }],
  };
  await assert.rejects(
    resolveConfig(config, root),
    /Example categories require content\.examples to be enabled/,
  );
});

test("rejects output outside the consumer root", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  await assert.rejects(
    resolveConfig({ ...baseConfig(), output: "../dist" }, root),
    /dedicated directory inside the consumer root/,
  );
});

test("accepts safe links and preserves non-HTTP link schemes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    {
      ...baseConfig(),
      navigation: [
        { text: { zh: "邮件", en: "Email" }, href: "mailto:team@example.com" },
      ],
      versions: { support: "tel:+861012345678" },
      home: {
        ...baseConfig().home,
        actions: [
          { text: { zh: "联系", en: "Contact" }, href: "tel:+861012345678" },
        ],
      },
    },
    root,
  );

  assert.equal(config.navigation[0].href, "mailto:team@example.com");
  assert.equal(config.versions.support, "tel:+861012345678");
  assert.equal(config.home.actions[0].href, "tel:+861012345678");
});

test("rejects invalid origins and unsafe link schemes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));

  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        site: { ...baseConfig().site, origin: "ftp://fixture.example.com" },
      },
      root,
    ),
    /URL must use HTTP or HTTPS/,
  );
  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        site: {
          ...baseConfig().site,
          origin: "https://fixture.example.com/docs?preview=true",
        },
      },
      root,
    ),
    /must not include credentials, a path, a query, or a hash/,
  );
  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        navigation: [
          { text: { zh: "危险", en: "Unsafe" }, href: "javascript:alert(1)" },
        ],
      },
      root,
    ),
    /Links must be relative or use HTTP, HTTPS, mailto, or tel/,
  );
  await assert.rejects(
    resolveConfig(
      {
        ...baseConfig(),
        versions: { invalid: "/guide preview/" },
      },
      root,
    ),
    /Links must not contain whitespace/,
  );
});
