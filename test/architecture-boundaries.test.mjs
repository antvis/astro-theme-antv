import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";

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
  expect(
    configImports.some(
      (specifier) =>
        specifier === "astro" ||
        specifier.startsWith("astro/") ||
        specifier === "vite" ||
        specifier.startsWith("vite/"),
    ),
  ).toBe(false);

  const adapterImports = await importsOf("src/astro/adapter.ts");
  expect(
    adapterImports
      .filter((specifier) => specifier.startsWith("../integration/"))
      .sort(),
  ).toEqual([
      "../integration/qa.js",
      "../integration/search.js",
      "../integration/theme.js",
  ]);
  expect(await importsOf("src/integration.ts")).toEqual(["./astro/adapter.js"]);

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
    expect(
      imports.some((specifier) => forbiddenFeatureImports.has(specifier)),
    ).toBe(false);
  }
});
