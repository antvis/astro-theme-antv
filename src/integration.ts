import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { AntVSiteConfig, ResolvedSiteConfig } from "./compiler/config.js";
import { resolveConfig } from "./compiler/config.js";
import {
  prepareSearchIntegration,
  writeProductionSearch,
} from "./integration/search.js";
import {
  prepareThemeIntegration,
  setupThemeDevServer,
} from "./integration/theme.js";

export function antvSite(input: AntVSiteConfig): AstroIntegration {
  let config: ResolvedSiteConfig;
  let themeRestartRoots: string[] = [];

  return {
    name: "@antv/astro-theme-antv",
    hooks: {
      async "astro:config:setup"({
        addWatchFile,
        command,
        config: astroConfig,
        injectRoute,
        updateConfig,
      }) {
        const consumerRoot = fileURLToPath(astroConfig.root);
        if (astroConfig.output !== "static") {
          throw new Error(
            "@antv/astro-theme-antv supports Astro static output only. Remove the server output or adapter configuration.",
          );
        }

        config = await resolveConfig(input, consumerRoot, {
          outDir: fileURLToPath(astroConfig.outDir),
          srcDir: fileURLToPath(astroConfig.srcDir),
          publicDir: fileURLToPath(astroConfig.publicDir),
          cacheDir: fileURLToPath(astroConfig.cacheDir),
        });

        const theme = await prepareThemeIntegration({
          config,
          markdownProcessor: astroConfig.markdown.processor,
          getBase: () => astroConfig.base,
        });
        const search = prepareSearchIntegration({
          config,
          command,
        });
        themeRestartRoots = theme.restartRoots;

        for (const path of theme.watchFiles) {
          addWatchFile(path);
        }
        for (const route of [...theme.routes, ...search.routes]) {
          injectRoute(route);
        }

        updateConfig({
          site: config.site.origin,
          trailingSlash: "always",
          build: {
            format: "directory",
            assets: "_assets",
            // Keep compiled CSS out of the readable document/example HTML.
            inlineStylesheets: "never",
          },
          markdown: {
            processor: theme.markdownProcessor,
            shikiConfig: {
              langAlias: {
                // Legacy API docs use `sign` for TypeScript method signatures.
                sign: "typescript",
                ...astroConfig.markdown.shikiConfig?.langAlias,
              },
            },
          },
          vite: {
            build: {
              assetsInlineLimit(filePath, content) {
                // Keep compiled modules external without changing image/font policy.
                if (/\.[cm]?js$/.test(filePath)) return false;
                const limit = astroConfig.vite?.build?.assetsInlineLimit;
                return typeof limit === "function"
                  ? limit(filePath, content)
                  : typeof limit === "number"
                    ? content.byteLength < limit
                    : undefined;
              },
            },
            define: {
              "import.meta.env.ANTV_SITE_DEVELOPMENT": JSON.stringify(
                command === "dev" ? "true" : "false",
              ),
            },
            plugins: theme.plugins,
            server: {
              fs: {
                allow: [config.root, ...theme.fsAllow],
              },
            },
          },
        });
      },
      "astro:server:setup"({ server }) {
        setupThemeDevServer(server, themeRestartRoots);
      },
      async "astro:build:done"({ dir }) {
        await writeProductionSearch(config, dir);
      },
    },
  };
}
