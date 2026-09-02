import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { build } from "astro";

const root = resolve("demos/basic-site");
const output = resolve(root, "dist");
const baseOutput = resolve(root, "dist-base");

const stylesheetHrefs = (html) =>
  [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(
    (match) => match[1],
  );

const readStylesheets = async (directory, html) =>
  (
    await Promise.all(
      stylesheetHrefs(html).map((href) =>
        readFile(resolve(directory, href.replace(/^\//, "")), "utf8"),
      ),
    )
  ).join("\n");

test("builds consumer pages, Astro content, and TypeScript/TSX demos", async () => {
  await build({ root });

  await Promise.all([
    access(resolve(output, "zh/guide/index.html")),
    access(resolve(output, "zh/guide/advanced/index.html")),
    access(resolve(output, "en/guide/advanced/index.html")),
    access(resolve(output, "consumer/index.html")),
    access(resolve(output, "en/examples/basic/simple/hello/index.html")),
    access(resolve(output, "en/examples/basic/simple/card/index.html")),
    access(resolve(output, "demos/basic/simple/hello/index.html")),
    access(resolve(output, "demos/basic/simple/card/index.html")),
    access(resolve(output, "zh/result/index.html")),
    access(resolve(output, "en/result/index.html")),
    access(resolve(output, "pagefind/pagefind.js")),
    access(resolve(output, "sitemap-index.xml")),
    access(resolve(output, "robots.txt")),
  ]);

  const page = await readFile(
    resolve(output, "zh/examples/basic/simple/hello/index.html"),
    "utf8",
  );
  assert.match(
    page,
    /<iframe[^>]+src="\/demos\/basic\/simple\/hello\/"/,
  );
  assert.doesNotMatch(page, /sandbox=/);
  assert.doesNotMatch(page, /playground/);
  assert.match(page, /message\.js/);
  assert.match(page, /data-search-open/);
  assert.match(page, /data-search-dialog/);
  assert.match(page, /data-search-module-url="\/pagefind\/pagefind\.js"/);
  assert.match(page, /data-pagefind-base-path="\/pagefind\/"/);
  assert.match(page, /data-site-base-path="\/"/);
  assert.match(page, /data-pagefind-body/);
  assert.match(
    page,
    /rel="canonical" href="https:\/\/fixture\.example\.com\/zh\/examples\/basic\/simple\/hello\/"/,
  );
  assert.match(page, /href="\/zh\/examples\/"/);
  assert.match(page, /href="\/en\/examples\/basic\/simple\/hello\/"/);
  assert.match(page, /--brand:#5b5bd6/);
  assert.match(page, /--surface-raised:#fefefe/);
  assert.doesNotMatch(page, /data-theme/);
  assert.doesNotMatch(page, /data-theme-toggle/);
  assert.doesNotMatch(page, /antv-site-theme/);

  const home = await readFile(resolve(output, "zh/index.html"), "utf8");
  assert.match(home, /data-antv-qa-entry/);
  assert.match(home, /data-default-stack="s2"/);
  assert.match(home, /data-result-url="\/zh\/result\/"/);
  assert.match(home, /href="\/zh\/examples\/"/);
  assert.match(home, /href="tel:\+861012345678"/);
  assert.match(home, /data-fixture-home-slot="beforeFooter"/);

  const document = await readFile(
    resolve(output, "zh/guide/index.html"),
    "utf8",
  );
  assert.match(document, /这是一个静态文档页面。/);
  assert.match(
    document,
    /class="sidebar-menu__link" href="\/zh\/guide\/" aria-current="page" title="快速开始"/,
  );
  assert.doesNotMatch(document, /sidebar-menu--docs"><\/ul>/);
  assert.match(document, /href="#安装"/);
  assert.doesNotMatch(document, /href="#undefined"/);
  assert.match(document, /href="\/en\/guide\/"/);
  assert.match(
    document,
    /<p><a href="\/en\/guide\/">Read in English<\/a><\/p>/,
  );
  assert.match(
    document,
    /<p><a href="\/zh\/guide\/advanced\/">MDX 指南<\/a><\/p>/,
  );
  assert.doesNotMatch(document, /advanced\.zh\.mdx/);
  assert.match(document, /data-code-src="\.\/snippet\.ts"/);
  assert.match(document, /Astro Content Collection/);
  assert.match(document, /href="mailto:team@example\.com"/);

  const mdxDocument = await readFile(
    resolve(output, "zh/guide/advanced/index.html"),
    "utf8",
  );
  assert.match(
    mdxDocument,
    /<p data-mdx-fixture(?:="true")?>计算结果：2<\/p>/,
  );
  assert.match(mdxDocument, /href="#mdx-内容"/);
  assert.match(
    mdxDocument,
    /href="\/zh\/guide\/advanced\/" aria-current="page" title="MDX 指南"/,
  );

  const rootRedirect = await readFile(resolve(output, "index.html"), "utf8");
  assert.match(rootRedirect, /url=\/zh\//);
  assert.match(rootRedirect, /href="\/zh\/"/);

  const consumerPage = await readFile(
    resolve(output, "consumer/index.html"),
    "utf8",
  );
  assert.match(consumerPage, /data-consumer-src-page/);

  const result = await readFile(
    resolve(output, "zh/result/index.html"),
    "utf8",
  );
  assert.match(result, /data-antv-result/);
  assert.match(result, /data-new-conversation-trigger/);
  assert.match(result, /data-new-conversation/);
  assert.match(result, /data-antv-qa-entry/);
  assert.match(result, /data-result-url="\/zh\/result\/"/);
  assert.match(result, /data-qa-service-base="https:\/\/sive\.antv\.antgroup\.com"/);
  assert.match(result, /href="\/zh\/"/);
  assert.match(await readStylesheets(output, result), /antv-result-page/);
  assert.doesNotMatch(await readStylesheets(output, document), /antv-result-page/);

  const runner = await readFile(
    resolve(output, "demos/basic/simple/hello/index.html"),
    "utf8",
  );
  assert.match(runner, /<script type="module"/);
  assert.match(runner, /color-scheme:\s*light/);
  assert.doesNotMatch(runner, /prefers-color-scheme/);

  const assets = await readdir(resolve(output, "_assets"));
  const styles = (
    await Promise.all(
      assets
        .filter((name) => name.endsWith(".css"))
        .map((name) => readFile(resolve(output, "_assets", name), "utf8")),
    )
  ).join("\n");
  assert.doesNotMatch(styles, /data-theme/);
  assert.doesNotMatch(styles, /prefers-color-scheme/);
  const demoAssets = assets.filter((name) =>
    name.includes("antv-site-demo-entry") && name.endsWith(".js"),
  );
  assert.equal(
    demoAssets.length,
    2,
    `Expected TypeScript and TSX Demo assets; got ${assets.join(", ")}`,
  );
  const demoCode = (
    await Promise.all(
      demoAssets.map((name) => readFile(resolve(output, "_assets", name), "utf8")),
    )
  ).join("\n");
  assert.match(demoCode, /hello from esm/);
  assert.match(demoCode, /hello from tsx/);
  assert.doesNotMatch(demoCode, /: HTMLElement/);
  assert.doesNotMatch(demoCode, /querySelector<HTMLElement>/);
  assert.doesNotMatch(demoCode, /<section data-demo-kind=/);
  const qaAsset = assets.find((name) => name.includes("QaResult"));
  assert.ok(qaAsset, `Expected a QA Result asset; got ${assets.join(", ")}`);
  assert.match(
    await readFile(resolve(output, "_assets", qaAsset), "utf8"),
    /fixture QA preview/,
  );
});

test("prefixes generated URLs for an Astro base deployment", async () => {
  await build({
    root,
    configFile: "astro.base.config.mjs",
  });

  await Promise.all([
    access(resolve(baseOutput, "zh/guide/index.html")),
    access(resolve(baseOutput, "zh/guide/advanced/index.html")),
    access(resolve(baseOutput, "pagefind/pagefind.js")),
    access(resolve(baseOutput, "sitemap-0.xml")),
  ]);

  const page = await readFile(
    resolve(baseOutput, "zh/examples/basic/simple/hello/index.html"),
    "utf8",
  );
  assert.match(
    page,
    /<iframe[^>]+src="\/platform\/demos\/basic\/simple\/hello\/"/,
  );
  assert.match(page, /data-search-module-url="\/platform\/pagefind\/pagefind\.js"/);
  assert.match(page, /data-pagefind-base-path="\/platform\/pagefind\/"/);
  assert.match(page, /data-site-base-path="\/platform\/"/);
  assert.match(
    page,
    /rel="canonical" href="https:\/\/fixture\.example\.com\/platform\/zh\/examples\/basic\/simple\/hello\/"/,
  );
  assert.match(page, /href="\/platform\/zh\/examples\/"/);
  assert.match(page, /href="\/platform\/en\/examples\/basic\/simple\/hello\/"/);

  const document = await readFile(
    resolve(baseOutput, "zh/guide/index.html"),
    "utf8",
  );
  assert.match(
    document,
    /<p><a href="\/platform\/en\/guide\/">Read in English<\/a><\/p>/,
  );
  assert.match(document, /href="\/platform\/zh\/guide\/advanced\/"/);

  const home = await readFile(resolve(baseOutput, "zh/index.html"), "utf8");
  assert.match(home, /data-result-url="\/platform\/zh\/result\/"/);

  const result = await readFile(
    resolve(baseOutput, "zh/result/index.html"),
    "utf8",
  );
  assert.match(result, /data-new-conversation-trigger/);
  assert.match(result, /data-new-conversation/);
  assert.match(result, /data-result-url="\/platform\/zh\/result\/"/);

  const rootRedirect = await readFile(
    resolve(baseOutput, "index.html"),
    "utf8",
  );
  assert.match(rootRedirect, /url=\/platform\/zh\//);
  assert.match(rootRedirect, /href="\/platform\/zh\/"/);

  const sitemap = await readFile(
    resolve(baseOutput, "sitemap-0.xml"),
    "utf8",
  );
  assert.match(
    sitemap,
    /https:\/\/fixture\.example\.com\/platform\/zh\/guide\/advanced\//,
  );
});
