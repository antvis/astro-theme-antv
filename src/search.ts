import { resolve } from "node:path";
import type { ResolvedSiteConfig } from "./compiler/config";

const assertPagefindResult = <Result extends { errors: string[] }>(
  result: Result,
  operation: string,
): Result => {
  if (result.errors.length) {
    throw new Error(`Pagefind ${operation} failed: ${result.errors.join("; ")}`);
  }
  return result;
};

export async function buildProductionSearch(
  config: ResolvedSiteConfig,
  outputDirectory: string,
): Promise<void> {
  if (!config.search.enabled) return;

  const pagefind = await import("pagefind");
  const created = assertPagefindResult(
    await pagefind.createIndex(),
    "index creation",
  );
  if (!created.index) {
    await pagefind.close();
    throw new Error("Pagefind did not create an index.");
  }

  try {
    assertPagefindResult(
      await created.index.addDirectory({ path: outputDirectory }),
      `site indexing for ${outputDirectory}`,
    );
    assertPagefindResult(
      await created.index.writeFiles({
        outputPath: resolve(outputDirectory, "pagefind"),
      }),
      "production file generation",
    );
  } finally {
    await created.index.deleteIndex();
    await pagefind.close();
  }
}
