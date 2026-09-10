import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { InjectedRoute } from "astro";
import type { ResolvedSiteConfig } from "../compiler/config.js";

const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));
const qaPage = resolve(runtimeRoot, "theme/pages/[locale]/qa.astro");

export interface QaIntegrationContribution {
  routes: InjectedRoute[];
}

export async function prepareQaIntegration(
  config: ResolvedSiteConfig,
): Promise<QaIntegrationContribution> {
  if (!config.qa) {
    return { routes: [] };
  }

  return {
    routes: [
      {
        pattern: `/[locale]/${config.qa.path}`,
        entrypoint: pathToFileURL(qaPage),
        prerender: true,
      },
    ],
  };
}
