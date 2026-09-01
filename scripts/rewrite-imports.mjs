// Post-build import rewriter.
//
// The package is published as plain ESM produced by `tsc` with
// `moduleResolution: "bundler"`, which lets the TypeScript *source* use
// extensionless relative imports (e.g. `from "./util"`). tsc emits those
// specifiers verbatim, but Node's native ESM loader requires relative import
// paths to carry an explicit file extension. This script walks the compiled
// `dist/**/*.js` output and restores a `.js` suffix onto every bare relative
// specifier it finds, so the published ESM loads under plain Node.
//
// Only relative specifiers starting with `./` or `../` are touched. Specifiers
// that already end in a known file extension (including `.json` and assets)
// are left as-is. Package specifiers (e.g. `astro/config`) are absolute and
// unaffected.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const hasExtension = /\.(?:js|json|mjs|cjs|css|svg|png|jpe?g|gif|webp|wasm)$/i;

async function findJavascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findJavascriptFiles(path));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

const bareRelativeFrom = /\bfrom\s*(["'])(\.\/[^"']+|\.\.\/[^"']+)\1/g;

let changedFiles = 0;
for (const file of await findJavascriptFiles(distRoot)) {
  const source = await readFile(file, "utf8");
  const rewritten = source.replace(bareRelativeFrom, (match, quote, specifier) =>
    hasExtension.test(specifier) ? match : `from ${quote}${specifier}.js${quote}`,
  );
  if (rewritten !== source) {
    await writeFile(file, rewritten);
    changedFiles += 1;
  }
}

// eslint-disable-next-line no-console
console.log(`@antv/site: rewrote import specifiers in ${changedFiles} file(s).`);
