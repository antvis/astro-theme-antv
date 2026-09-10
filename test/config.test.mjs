import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";
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

  expect(config.root).toBe(physicalRoot);
  expect(config.content.docs).toBe(resolve(physicalRoot, "docs"));
  expect(config.content.examples).toBe(resolve(physicalRoot, "examples"));
  expect(config.content.collectionName).toBe("docs");
  expect(config.demo.height).toBe(480);
  expect(config.search.enabled).toBe(true);
  expect(config.search.aliases).toEqual({});
  expect(config.search.pathBoosts).toEqual([]);
  expect(config.qa).toBeNull();
  expect(config.slots.home).toEqual({
    beforeHero: [],
    hero: [],
    afterHero: [],
    beforeFeatures: [],
    features: [],
    afterFeatures: [],
    beforeFooter: [],
  });
  expect(config.theme.tokens).toEqual({});
  expect(config.site.locales).toEqual(["zh", "en"]);
});

test("requires the explicit QA enabled switch", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    {
      ...baseConfig(),
      qa: {
        enabled: false,
      },
    },
    root,
  );

  expect(config.qa).toBeNull();
});

test("resolves a custom docs collection name", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = await resolveConfig(
    {
      ...baseConfig(),
      content: { docs: "./docs", collectionName: "documentation" },
    },
    root,
  );
  expect(config.content.collectionName).toBe("documentation");
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

  expect(config.theme.tokens).toEqual({
    "--brand": "#5b5bd6",
    "--surface-raised": "#fefefe",
  });
  await expect(
    resolveConfig(
      {
        ...baseConfig(),
        theme: { tokens: { light: { "--brand": "#5b5bd6" } } },
      },
      root,
    ),
  ).rejects.toSatisfy(
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
        enabled: true,
      },
    },
    root,
  );
  expect(config.search.enabled).toBe(true);
  expect(config.search.aliases).toEqual({ graph: ["chart"] });
  expect(config.qa?.path).toBe("result");
  expect(config.qa?.service).toEqual({
    development: "http://localhost:3000",
    production: "https://sive.antv.antgroup.com",
  });
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

  expect(config.slots.home.hero).toEqual([
    resolve(physicalRoot, "site/Home.astro"),
  ]);
  expect(config.slots.home.beforeFooter).toEqual([
    resolve(physicalRoot, "site/FooterNote.astro"),
  ]);
  expect(config.slots.home.afterHero).toEqual([]);
});

test("rejects example categories when example discovery is disabled", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const config = {
    ...baseConfig(),
    content: { examples: null },
    examples: [{ slug: "basic", title: { zh: "基础", en: "Basic" } }],
  };
  await expect(resolveConfig(config, root)).rejects.toThrow(
    /Example categories require content\.examples to be enabled/,
  );
});

test("rejects removed package output configuration", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  await expect(
    resolveConfig({ ...baseConfig(), output: "../dist" }, root),
  ).rejects.toThrow(/Configure Astro's standard outDir instead/);
});

test("rejects Astro output outside the root or overlapping protected inputs", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));
  const srcDir = resolve(root, "source");
  const publicDir = resolve(root, "static");
  const cacheDir = resolve(root, ".cache");
  await Promise.all([
    mkdir(srcDir),
    mkdir(publicDir),
    mkdir(cacheDir),
    mkdir(resolve(root, "docs")),
    mkdir(resolve(root, "examples")),
  ]);
  const workspace = { srcDir, publicDir, cacheDir };

  await expect(
    resolveConfig(baseConfig(), root, {
      ...workspace,
      outDir: resolve(root, "../dist"),
    }),
  ).rejects.toThrow(/dedicated directory inside the consumer root/);
  for (const outDir of [srcDir, resolve(publicDir, "generated"), cacheDir]) {
    await expect(
      resolveConfig(baseConfig(), root, { ...workspace, outDir }),
    ).rejects.toThrow(/overlaps a protected input or workspace directory/);
  }
  await resolveConfig(baseConfig(), root, {
    ...workspace,
    outDir: resolve(root, "build-output"),
  });
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

  expect(config.navigation[0].href).toBe("mailto:team@example.com");
  expect(config.versions.support).toBe("tel:+861012345678");
  expect(config.home.actions[0].href).toBe("tel:+861012345678");
});

test("rejects invalid origins and unsafe link schemes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "antv-site-config-"));

  await expect(
    resolveConfig(
      {
        ...baseConfig(),
        site: { ...baseConfig().site, origin: "ftp://fixture.example.com" },
      },
      root,
    ),
  ).rejects.toThrow(/URL must use HTTP or HTTPS/);
  await expect(
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
  ).rejects.toThrow(/must not include credentials, a path, a query, or a hash/);
  await expect(
    resolveConfig(
      {
        ...baseConfig(),
        navigation: [
          { text: { zh: "危险", en: "Unsafe" }, href: "javascript:alert(1)" },
        ],
      },
      root,
    ),
  ).rejects.toThrow(
    /Links must be relative or use HTTP, HTTPS, mailto, or tel/,
  );
  await expect(
    resolveConfig(
      {
        ...baseConfig(),
        versions: { invalid: "/guide preview/" },
      },
      root,
    ),
  ).rejects.toThrow(/Links must not contain whitespace/);
});
