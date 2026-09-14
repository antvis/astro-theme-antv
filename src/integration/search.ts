import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { HookParameters, InjectedRoute } from "astro";
import * as pagefind from "pagefind";
import type { ResolvedSiteConfig } from "../compiler/config.js";

const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));
const developmentSearchPage = resolve(
  runtimeRoot,
  "theme/pages/pagefind/dev-index.ts",
);

type ConfigSetupOptions = HookParameters<"astro:config:setup">;

interface SearchIntegrationOptions {
  config: ResolvedSiteConfig;
  command: ConfigSetupOptions["command"];
}

export interface SearchIntegrationContribution {
  routes: InjectedRoute[];
}

export function prepareSearchIntegration({
  config,
  command,
}: SearchIntegrationOptions): SearchIntegrationContribution {
  return {
    routes:
      command === "dev" && config.search.enabled
        ? [
            {
              pattern: "/pagefind/dev-index.json",
              entrypoint: pathToFileURL(developmentSearchPage),
              prerender: false,
            },
          ]
        : [],
  };
}

const assertPagefindResult = <Result extends { errors: string[] }>(
  result: Result,
  operation: string,
): Result => {
  if (result.errors.length) {
    throw new Error(`Pagefind ${operation} failed: ${result.errors.join("; ")}`);
  }
  return result;
};

export async function writeProductionSearch(
  config: ResolvedSiteConfig,
  output: URL,
): Promise<void> {
  if (!config.search.enabled) return;
  const outputDirectory = fileURLToPath(output);
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
