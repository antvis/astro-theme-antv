import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/theme/", import.meta.url));
const outputRoot = fileURLToPath(new URL("../dist/theme/", import.meta.url));

await cp(sourceRoot, outputRoot, { recursive: true });

// eslint-disable-next-line no-console
console.log("@antv/site: copied Astro theme source to dist/theme.");
