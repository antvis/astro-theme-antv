import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import type { AstroIntegration } from "astro";
import type { AntVSiteConfig, ResolvedSiteConfig } from "./compiler/config";
import { resolveConfig } from "./compiler/config";
import type { SiteRegistry } from "./compiler/content";
import { scanSite } from "./compiler/content";
import { createLegacyContentMarkdownProcessor } from "./markdown";
import { buildProductionSearch } from "./search";
import { createDemoPlugin } from "./vite/demo-plugin";
import { createQaPlugin } from "./vite/qa-plugin";
import { createSlotsPlugin } from "./vite/slots-plugin";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const themeRoot = resolve(packageRoot, "dist/theme");

const isWithin = (parent: string, child: string) => {
  const path = relative(parent, child);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
};

async function preparePublicDirectory(
  config: ResolvedSiteConfig,
): Promise<string> {
  const stage = resolve(config.root, ".antv-site/public");
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  await cp(resolve(config.root, "public"), stage, {
    recursive: true,
    force: true,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  return stage;
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
          throw new Error(`QA preview adapter "${name}" does not exist: ${path}`, {
            cause: error,
          });
        }
      },
    ),
  );
}

async function validateHomeSlots(config: ResolvedSiteConfig): Promise<void> {
  await Promise.all(
    Object.entries(config.slots.home).flatMap(([slotName, components]) =>
      components.map(async (path) => {
        try {
          await access(path);
        } catch (error) {
          throw new Error(
            `Home slot "${slotName}" component does not exist: ${path}`,
            { cause: error },
          );
        }
      }),
    ),
  );
}

export function antvSite(input: AntVSiteConfig): AstroIntegration[] {
  let config: ResolvedSiteConfig;
  let registry: SiteRegistry;
  let publicDirectory: string;

  const core: AstroIntegration = {
    name: "@antv/site",
    hooks: {
      async "astro:config:setup"({
        addWatchFile,
        command,
        config: astroConfig,
        injectRoute,
        updateConfig,
      }) {
        const consumerRoot = fileURLToPath(astroConfig.root);
        config = await resolveConfig(input, consumerRoot);
        await validateQaPreviewAdapters(config);
        await validateHomeSlots(config);
        registry = await scanSite(config);
        publicDirectory = await preparePublicDirectory(config);
        if (config.content.examples) addWatchFile(config.content.examples);
        for (const path of Object.values(config.qa?.previewAdapters ?? {})) {
          addWatchFile(path);
        }
        for (const paths of Object.values(config.slots.home)) {
          for (const path of paths) addWatchFile(path);
        }

        for (const [pattern, entrypoint] of [
          ["/", "pages/index.astro"],
          ["/[locale]", "pages/[locale]/index.astro"],
          ["/[locale]/[...route]", "pages/[locale]/[...route].astro"],
          ["/demos/[...key]", "pages/demos/[...key].astro"],
        ] as const) {
          injectRoute({
            pattern,
            entrypoint: pathToFileURL(resolve(themeRoot, entrypoint)),
            prerender: true,
          });
        }
        if (command === "dev" && config.search.enabled) {
          injectRoute({
            pattern: "/pagefind/dev-index.json",
            entrypoint: pathToFileURL(
              resolve(themeRoot, "pages/pagefind/dev-index.ts"),
            ),
            prerender: false,
          });
        }

        updateConfig({
          publicDir: pathToFileURL(`${publicDirectory}${sep}`),
          outDir: pathToFileURL(`${config.output}${sep}`),
          site: config.site.origin,
          output: "static",
          trailingSlash: "always",
          build: { format: "directory", assets: "_assets" },
          markdown: {
            processor: createLegacyContentMarkdownProcessor(
              astroConfig.markdown.processor,
              () => config,
              () => astroConfig.base,
            ),
          },
          vite: {
            define: {
              "import.meta.env.ANTV_SITE_DEVELOPMENT_SEARCH": JSON.stringify(
                command === "dev" ? "true" : "false",
              ),
            },
            plugins: [
              createSlotsPlugin(() => config),
              createDemoPlugin(() => registry),
              createQaPlugin(() => config),
            ],
            server: {
              fs: {
                allow: [
                  config.root,
                  resolve(packageRoot, "dist/qa-adapters"),
                  themeRoot,
                  config.content.docs,
                  ...(config.content.examples ? [config.content.examples] : []),
                  ...Object.values(config.qa?.previewAdapters ?? {}).map(
                    dirname,
                  ),
                  ...Object.values(config.slots.home)
                    .flat()
                    .map(dirname),
                ],
              },
            },
          },
        });
      },
      "astro:server:setup"({ server }) {
        const roots = [
          ...(config.content.examples ? [config.content.examples] : []),
          resolve(config.root, "public"),
          ...Object.values(config.slots.home).flat(),
        ];
        server.watcher.add(roots);
        server.watcher.on("all", (_event, path) => {
          if (!roots.some((root) => isWithin(root, path))) return;
          void server.restart();
        });
      },
      async "astro:build:done"({ dir }) {
        await buildProductionSearch(config, fileURLToPath(dir));
      },
    },
  };

  return [core, mdx(), sitemap()];
}
