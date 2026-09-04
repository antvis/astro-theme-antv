import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
);
const projectTsconfig = JSON.parse(
  await readFile(resolve(packageRoot, "tsconfig.json"), "utf8"),
);
const buildTsconfig = JSON.parse(
  await readFile(resolve(packageRoot, "tsconfig.build.json"), "utf8"),
);
const requirePackageSubpath = createRequire(import.meta.url);

test("publishes a site configuration facade without a parallel CLI", async () => {
  expect(packageJson.name).toBe("@antv/site");
  expect(packageJson.bin).toBeUndefined();
  expect(Object.keys(packageJson.exports)).toEqual([
    ".",
    "./content",
  ]);
  expect(packageJson.files).toEqual(["dist"]);
  expect(projectTsconfig.extends).toBe("astro/tsconfigs/strict");
  expect(projectTsconfig.compilerOptions.types[0]).toBe("node");
  expect(buildTsconfig.compilerOptions.outDir).toBe("dist");
  expect(buildTsconfig.compilerOptions.module).toBe("NodeNext");
  expect(buildTsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
  expect(buildTsconfig.exclude).toEqual(["src/theme"]);
  expect(packageJson.peerDependencies.astro).toBe(">=7.2.0 <8");
  expect(packageJson.license).toBe("MIT");
  expect(packageJson.repository).toEqual({
    type: "git",
    url: "https://github.com/antvis/site.git",
  });
  expect(packageJson.homepage).toBe("https://github.com/antvis/site#readme");
  expect(packageJson.bugs.url).toBe("https://github.com/antvis/site/issues");
  expect(packageJson.dependencies["@antv/g2"]).toBeUndefined();
  expect(packageJson.dependencies["@antv/g6"]).toBeUndefined();
  expect(packageJson.dependencies["@antv/s2"]).toBeUndefined();

  for (const dependency of [
    "esbuild",
    "codemirror",
    "sucrase",
  ]) {
    expect(packageJson.dependencies[dependency]).toBeUndefined();
  }
  expect(packageJson.dependencies.pagefind).toBe("1.5.2");
  expect(packageJson.dependencies["@astrojs/mdx"]).toBe("7.0.8");
  expect(packageJson.dependencies.dompurify).toBe("3.4.14");
  expect(packageJson.dependencies["highlight.js"]).toBe("11.12.0");

  const publicApi = await import("../dist/index.js");
  const { defineConfig } = publicApi;
  const siteConfig = {
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
  };
  const publicConfig = defineConfig(siteConfig);
  expect(defineConfig).toBeTypeOf("function");
  expect(publicApi.default).toBe(defineConfig);
  expect(publicApi.qaProducts).toEqual(["g2", "s2", "g6", "f2", "x6", "l7"]);
  expect(publicApi.qaPreviewProducts).toEqual(["g2", "s2", "g6"]);
  expect(publicApi.antvSite).toBeTypeOf("function");
  expect(publicApi.antvSite(siteConfig).name).toBe("@antv/site");
  expect(publicConfig.integrations?.length).toBe(3);
  expect(publicConfig.integrations?.[0]?.name).toBe("@antv/site");
  expect(publicConfig.integrations?.[1]?.name).toBe("@astrojs/mdx");
  expect(publicConfig.integrations?.[2]?.name).toBe("@astrojs/sitemap");

  const contentApi = await import("../dist/content.js");
  expect(contentApi.antvDocsLoader().name).toBe("glob-loader");
  expect(contentApi.antvDocsSchema.parse({ title: "Guide" })).toEqual({
    title: "Guide",
    order: 0,
    sidebar: { hidden: false },
    draft: false,
  });
  expect(contentApi.getAntvDocIdentity("zh/guide")).toEqual({
    locale: "zh",
    slug: "guide",
    section: "guide",
    route: "/zh/guide/",
  });

  expect(() => requirePackageSubpath("@antv/site/qa")).toThrow(
    /Package subpath '.\/qa'/,
  );
  expect(() => requirePackageSubpath("@antv/site/qa-entry")).toThrow(
    /Package subpath '.\/qa-entry'/,
  );

  await access(resolve(packageRoot, "dist/integration.js"));
  await access(resolve(packageRoot, "dist/content.js"));
  await access(resolve(packageRoot, "dist/qa.js"));
  await access(resolve(packageRoot, "dist/qa-browser.js"));
  await access(resolve(packageRoot, "LICENSE"));
  await access(resolve(packageRoot, "dist/qa-adapters/index.js"));
  await access(resolve(packageRoot, "dist/search.js"));
  await access(resolve(packageRoot, "dist/slots.js"));
  await access(resolve(packageRoot, "dist/vite/demo-plugin.js"));
  await access(resolve(packageRoot, "dist/vite/qa-plugin.js"));
  await access(resolve(packageRoot, "dist/vite/slots-plugin.js"));
  await access(resolve(packageRoot, "dist/theme/components/Demo.astro"));
  await access(resolve(packageRoot, "dist/theme/components/QaResult.astro"));
  await access(resolve(packageRoot, "dist/theme/components/QaEntry.astro"));
  await access(resolve(packageRoot, "dist/theme/features/qa/result.ts"));
  await access(resolve(packageRoot, "dist/theme/components/SiteSearch.astro"));
  await access(resolve(packageRoot, "dist/theme/features/products/client.ts"));
  await access(resolve(packageRoot, "dist/theme/styles/product.css"));
  await access(resolve(packageRoot, "dist/theme/lib/agent-content.ts"));
  const globalStyles = await readFile(
    resolve(packageRoot, "dist/theme/styles/global.css"),
    "utf8",
  );
  const fontStyles = await readFile(
    resolve(packageRoot, "dist/theme/styles/fonts.css"),
    "utf8",
  );
  const homeFontStyles = await readFile(
    resolve(packageRoot, "dist/theme/styles/home-font.css"),
    "utf8",
  );
  expect(globalStyles).toMatch(/--font-sans:/);
  expect(globalStyles).toMatch(/--font-heading-weight: 900/);
  expect(globalStyles).toMatch(/font-family: var\(--font-sans\)/);
  expect(fontStyles).toMatch(/font-family: "Alibaba PuHuiTi 2\.0"/);
  expect(homeFontStyles).toMatch(/font-family: "Alibaba PuHuiTi 2\.0"/);
  for (const font of ["Regular", "Medium", "SemiBold", "Bold", "Heavy"]) {
    await access(
      resolve(
        packageRoot,
        `dist/theme/assets/fonts/AlibabaPuHuiTi-2-${font}.woff2`,
      ),
    );
    expect(`${fontStyles}\n${homeFontStyles}`).toMatch(
      new RegExp(`AlibabaPuHuiTi-2-${font}\\.woff2`),
    );
  }
  await access(resolve(packageRoot, "dist/theme/pages/llms.txt.ts"));
  await access(resolve(packageRoot, "dist/theme/pages/llms-full.txt.ts"));
  await access(
    resolve(packageRoot, "dist/theme/pages/markdown/[locale]/[...route].md.ts"),
  );
  await access(resolve(packageRoot, "dist/theme/pages/demos/[...key].astro"));
  await access(resolve(packageRoot, "demos/basic-site/astro.config.mjs"));
  for (const removedPath of [
    "dist/theme/tsconfig.json",
    "src/theme/tsconfig.json",
    "theme/src/components/Demo.astro",
    "theme/tsconfig.json",
    "test/fixtures/basic-site/astro.config.mjs",
    "src/cli.ts",
    "src/demo-runtime/index.ts",
    "dist/cli.js",
    "dist/compiler/registry.js",
    "dist/demo-runtime/index.js",
    "dist/runtime/build.js",
    "dist/verify.js",
    "dist/theme/features/qa/client.ts",
    "dist/theme/features/qa/history.ts",
    "dist/theme/features/qa/index.ts",
    "scripts/rewrite-imports.mjs",
  ]) {
    await expect(access(resolve(packageRoot, removedPath))).rejects.toThrow();
  }
});
