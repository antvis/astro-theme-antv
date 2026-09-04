import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { InjectedRoute } from "astro";
import type { Plugin } from "vite";
import type { ResolvedSiteConfig } from "../compiler/config.js";
import { createQaPlugin } from "../vite/qa-plugin.js";

const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));
const qaAdapterRoot = resolve(runtimeRoot, "qa-adapters");
const qaPage = resolve(runtimeRoot, "theme/pages/[locale]/qa.astro");

export interface QaIntegrationContribution {
  plugins: Plugin[];
  fsAllow: string[];
  routes: InjectedRoute[];
  watchFiles: string[];
}

async function validateQaPreviewAdapters(
  config: ResolvedSiteConfig,
): Promise<void> {
  await Promise.all(
    Object.entries(config.qa?.previewAdapters ?? {}).map(
      async ([name, path]) => {
        try {
          await access(path);
        } catch (error) {
          throw new Error(
            `QA preview adapter "${name}" does not exist: ${path}`,
            { cause: error },
          );
        }
      },
    ),
  );
}

export async function prepareQaIntegration(
  config: ResolvedSiteConfig,
): Promise<QaIntegrationContribution> {
  if (!config.qa) {
    return { plugins: [], fsAllow: [], routes: [], watchFiles: [] };
  }

  await validateQaPreviewAdapters(config);

  const previewAdapterPaths = Object.values(config.qa.previewAdapters);

  return {
    plugins: [createQaPlugin(() => config)],
    fsAllow: [qaAdapterRoot, ...previewAdapterPaths.map(dirname)],
    routes: [
      {
        pattern: `/[locale]/${config.qa.path}`,
        entrypoint: pathToFileURL(qaPage),
        prerender: true,
      },
    ],
    watchFiles: previewAdapterPaths,
  };
}
