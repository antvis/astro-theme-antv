import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const importsOf = async (path) => {
  const source = await readFile(resolve(path), "utf8");
  return [
    ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s+["']([^"']+)["']/g),
  ].map((match) => match[1]);
};

test("keeps integration dependencies flowing through the Astro adapter", async () => {
  const configImports = await importsOf("src/compiler/config.ts");
  assert.equal(
    configImports.some(
      (specifier) =>
        specifier === "astro" ||
        specifier.startsWith("astro/") ||
        specifier === "vite" ||
        specifier.startsWith("vite/"),
    ),
    false,
  );

  const adapterImports = await importsOf("src/astro/adapter.ts");
  assert.deepEqual(
    adapterImports
      .filter((specifier) => specifier.startsWith("../integration/"))
      .sort(),
    [
      "../integration/qa.js",
      "../integration/search.js",
      "../integration/theme.js",
    ],
  );
  assert.deepEqual(await importsOf("src/integration.ts"), [
    "./astro/adapter.js",
  ]);

  const forbiddenFeatureImports = new Set([
    "./qa.js",
    "./search.js",
    "./theme.js",
    "../astro/adapter.js",
  ]);
  for (const path of [
    "src/integration/qa.ts",
    "src/integration/search.ts",
    "src/integration/theme.ts",
  ]) {
    const imports = await importsOf(path);
    assert.equal(
      imports.some((specifier) => forbiddenFeatureImports.has(specifier)),
      false,
      `${path} must not call another integration boundary`,
    );
  }
});
