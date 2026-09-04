import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { HookParameters, InjectedRoute } from "astro";
import type { ResolvedSiteConfig } from "../compiler/config.js";
import { buildProductionSearch } from "../search.js";

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
  define: Record<string, string>;
  routes: InjectedRoute[];
}

export function prepareSearchIntegration({
  config,
  command,
}: SearchIntegrationOptions): SearchIntegrationContribution {
  return {
    define: {
      "import.meta.env.ANTV_SITE_DEVELOPMENT_SEARCH": JSON.stringify(
        command === "dev" ? "true" : "false",
      ),
    },
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

export async function writeProductionSearch(
  config: ResolvedSiteConfig,
  outputDirectory: URL,
): Promise<void> {
  await buildProductionSearch(config, fileURLToPath(outputDirectory));
}
