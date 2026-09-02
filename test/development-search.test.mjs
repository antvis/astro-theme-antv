import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { dev } from "astro";

const root = resolve("demos/basic-site");

test("serves live document and Demo search records during development", async (t) => {
  const server = await dev({
    root,
    configFile: "astro.base.config.mjs",
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  t.after(() => server.stop());

  const origin = `http://127.0.0.1:${server.address.port}`;
  const response = await fetch(`${origin}/platform/pagefind/dev-index.json`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const records = await response.json();
  assert.ok(
    records.some(
      (record) =>
        record.language === "zh" &&
        record.title === "快速开始" &&
        record.url === "/platform/zh/guide/" &&
        record.content.includes("这是一个静态文档页面"),
    ),
  );
  assert.ok(
    records.some(
      (record) =>
        record.language === "zh" &&
        record.title === "MDX 指南" &&
        record.url === "/platform/zh/guide/advanced/" &&
        record.content.includes("计算结果"),
    ),
  );
  assert.ok(
    records.some(
      (record) =>
        record.language === "en" &&
        record.title === "Hello" &&
        record.url === "/platform/en/examples/basic/simple/hello/" &&
        record.content.includes("import { message }"),
    ),
  );

  const page = await fetch(`${origin}/platform/zh/guide/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /data-search-mode="development"/);
  assert.match(
    html,
    /data-search-module-url="\/platform\/pagefind\/dev-index\.json"/,
  );
});
