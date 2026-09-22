import { access } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import type { InjectedRoute } from "astro";
import type { MarkdownProcessor } from "astro/markdown";
import type { Connect, Plugin, ViteDevServer } from "vite";
import type { ResolvedSiteConfig } from "../compiler/config.js";
import { scanSite } from "../compiler/content.js";
import { createLegacyContentMarkdownProcessor } from "../markdown.js";
import { createDemoPlugin } from "../vite/demo-plugin.js";
import { createSlotsPlugin } from "../vite/slots-plugin.js";
import { isWithin } from "../util.js";

const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));
const themeRoot = resolve(runtimeRoot, "theme");

const themeRoutes = [
  ["/", "pages/[locale]/index.astro"],
  ["/llms.txt", "pages/llms.txt.ts"],
  ["/llms-full.txt", "pages/llms-full.txt.ts"],
  [
    "/[locale]/[...route].md",
    "pages/[locale]/[...route].md.ts",
  ],
  ["/[locale]", "pages/[locale]/index.astro"],
  ["/[locale]/[...route]", "pages/[locale]/[...route].astro"],
  ["/demos/[...key]", "pages/demos/[...key].astro"],
] as const;

interface ThemeIntegrationOptions {
  config: ResolvedSiteConfig;
  markdownProcessor: MarkdownProcessor;
  getBase: () => string;
}

export interface ThemeIntegrationContribution {
  markdownProcessor: MarkdownProcessor;
  plugins: Plugin[];
  fsAllow: string[];
  restartRoots: string[];
  routes: InjectedRoute[];
  watchFiles: string[];
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

export async function prepareThemeIntegration({
  config,
  markdownProcessor,
  getBase,
}: ThemeIntegrationOptions): Promise<ThemeIntegrationContribution> {
  await validateHomeSlots(config);
  const registry = await scanSite(config);
  const slotPaths = Object.values(config.slots.home).flat();
  const examplePaths = config.content.examples
    ? [config.content.examples]
    : [];
  const routes: InjectedRoute[] = themeRoutes.map(([pattern, entrypoint]) => ({
    pattern,
    entrypoint: pathToFileURL(resolve(themeRoot, entrypoint)),
    prerender: true,
  }));
  if (config.qa) {
    routes.unshift({
      pattern: `/[locale]/${config.qa.path}`,
      entrypoint: pathToFileURL(resolve(themeRoot, "pages/[locale]/qa.astro")),
      prerender: true,
    });
  }
  return {
    markdownProcessor: createLegacyContentMarkdownProcessor(
      markdownProcessor,
      () => config,
      getBase,
    ),
    plugins: [
      ...tailwindcss(),
      createCssAssetNamingPlugin(),
      ...(config.qa ? [createQaRoutingPlugin(config, getBase)] : []),
      createSlotsPlugin(() => config),
      createDemoPlugin(registry),
    ],
    fsAllow: [
      themeRoot,
      config.content.docs,
      ...examplePaths,
      ...slotPaths.map(dirname),
    ],
    restartRoots: [...examplePaths, ...slotPaths],
    routes,
    watchFiles: [...examplePaths, ...slotPaths],
  };
}

function createCssAssetNamingPlugin(): Plugin {
  return {
    name: "antv-site-css-assets",
    apply: "build",
    outputOptions(output) {
      const assetFileNames = output.assetFileNames;
      return {
        ...output,
        // Native content hashes stay correct when CSS references other assets.
        hashCharacters: "hex",
        assetFileNames(asset) {
          const name = basename(asset.names[0] ?? "").toLowerCase();
          if (name.endsWith(".css")) {
            return `_assets/${name.slice(0, -4)}.[hash].css`;
          }
          return typeof assetFileNames === "function"
            ? assetFileNames(asset)
            : assetFileNames ?? "assets/[name]-[hash][extname]";
        },
      };
    },
  };
}

function createQaRoutingPlugin(
  config: ResolvedSiteConfig,
  getBase: () => string,
): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.url && (req.method === "GET" || req.method === "HEAD")) {
      const url = new URL(req.url, "http://localhost");
      for (const locale of config.site.locales) {
        const entry = `${getBase()}/${locale}/${config.qa!.path}/`.replace(/\/+/g, "/");
        if (!url.pathname.startsWith(entry)) continue;
        const sessionId = url.pathname.slice(entry.length);
        if (/^[\w-]+\/?$/.test(sessionId)) {
          req.url = entry + url.search;
        }
        break;
      }
    }
    next();
  };
  return {
    name: "antv-site-qa-routing",
    enforce: "post",
    configureServer(server) {
      // Astro installs its trailing-slash guard in a post hook. Rewrite before it.
      return () => {
        server.middlewares.stack.unshift({ route: "", handle: rewrite });
      };
    },
  };
}

export function setupThemeDevServer(
  server: ViteDevServer,
  restartRoots: string[],
): void {
  if (!restartRoots.length) return;
  server.watcher.add(restartRoots);
  server.watcher.on("all", (_event, path) => {
    if (!restartRoots.some((root) => isWithin(root, path))) return;
    void server.restart();
  });
}
