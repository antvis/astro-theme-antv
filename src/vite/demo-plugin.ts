import { compileDemoSource } from "../demo-source.js";
import { extname, relative, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import type { DemoRecord, SiteRegistry } from "../compiler/content.js";

const dependencyModuleId = "virtual:antv-demo-dependencies";
const resolvedDependencyModuleId = `\0${dependencyModuleId}`;

const publicModuleId = "virtual:antv-site-demos";
const resolvedModuleId = `\0${publicModuleId}`;
const registryModuleId = "virtual:antv-site-registry";
const resolvedRegistryModuleId = `\0${registryModuleId}`;
const publicEntryPrefix = "virtual:antv-site-demo-entry:";
const resolvedEntryPrefix = `\0${publicEntryPrefix}`;
const stylePrefix = 'virtual:antv-demo-style:';
const resolvedStylePrefix = `\0${stylePrefix}`;
const isStyle = (file: string) => /\.(css|less)$/.test(file);

const entryId = (prefix: string, demo: DemoRecord) =>
  `${prefix}${encodeURIComponent(demo.key)}${extname(demo.sourcePath)}`;

const entryKey = (id: string, prefix: string) => {
  const encodedKeyWithExtension = id.slice(prefix.length);
  const extension = extname(encodedKeyWithExtension);
  const encodedKey = extension
    ? encodedKeyWithExtension.slice(0, -extension.length)
    : encodedKeyWithExtension;
  return decodeURIComponent(encodedKey);
};

export function createDemoPlugin(registry: SiteRegistry): Plugin {
  const demos = new Map(registry.demos.map((demo) => [demo.key, demo]));
  const styleId = (file: string) => `${resolvedStylePrefix}${encodeURIComponent(relative(registry.config.root, file))}.js`;
  const demoModules = new Set([
    ...registry.demos.map((demo) => demo.sourcePath),
    ...Object.keys(registry.demoFiles?.files ?? {}).map((file) => resolve(registry.config.root, file)),
  ]);
  // Vite resolves symlinked workspaces to real paths unless preserveSymlinks is set.
  for (const file of demoModules) {
    try { demoModules.add(realpathSync(file)); } catch { /* Explicit aliases may be virtual. */ }
  }
  const packageDependencies = {
    ...Object.fromEntries((registry.demoFiles?.packages ?? []).map((name) => [name, name])),
    ...registry.config.demo.dependencies,
  };
  let base = "/";
  let isBuild = false;
  let server: ViteDevServer;
  return {
    name: "antv-site-demos",
    enforce: "pre",
    config(config) {
      // Native iframe import maps bypass Vite's import scanner.
      const excluded = config.optimizeDeps?.exclude ?? [];
      const include = [...new Set(Object.entries(packageDependencies).flat())].filter((source) =>
        !source.startsWith('.') && !source.startsWith('/') && !source.includes(':')
        && !excluded.some((name) => source === name || source.startsWith(`${name}/`)));
      // The editor is loaded from injected routes, outside the consumer's entry scan.
      if (!excluded.includes('sucrase')) include.push('@antv/astro-theme-antv > sucrase');
      return { optimizeDeps: { include } };
    },
    configResolved(config) {
      base = config.base;
      isBuild = config.command === "build";
    },
    configureServer(devServer) {
      server = devServer;
    },
    async resolveId(source, importer) {
      if (source === dependencyModuleId) return resolvedDependencyModuleId;
      if (source === publicModuleId) return resolvedModuleId;
      if (source === registryModuleId) return resolvedRegistryModuleId;
      if (source.startsWith(stylePrefix)) return `\0${source}`;
      if (source.startsWith(resolvedStylePrefix)) return source;
      if (source.startsWith(publicEntryPrefix)) {
        return `${resolvedEntryPrefix}${source.slice(publicEntryPrefix.length)}`;
      }
      // Browser style modules must never enter Astro's server module graph.
      if (this.environment.config.consumer !== "client" || !importer) return;
      let sourceImporter = importer;
      if (importer.startsWith(resolvedEntryPrefix)) {
        const key = entryKey(importer, resolvedEntryPrefix);
        const demo = demos.get(key);
        if (!demo) throw new Error(`Unknown demo entry: ${key}`);
        sourceImporter = demo.sourcePath;
      } else if (!demoModules.has(importer.split('?')[0]!) || isStyle(importer.split('?')[0]!)) return;

      const resolved = await this.resolve(source, sourceImporter, { skipSelf: true });
      if (!resolved || resolved.external) return resolved;
      // Package and workspace entries can import their own styles transitively.
      // Keep those styles attached to the module in native iframe imports too.
      if (isStyle(source)) return styleId(resolved.id);
      demoModules.add(resolved.id.split('?')[0]!);
      return resolved;
    },
    async load(id) {
      if (id.startsWith(resolvedStylePrefix)) {
        const file = resolve(registry.config.root, decodeURIComponent(id.slice(resolvedStylePrefix.length, -3)));
        // Inline Vite's compiled CSS so native iframe imports also apply styles in builds.
        return `import css from ${JSON.stringify(`${file}?inline`)};
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
export default css;`;
      }
      if (id === resolvedDependencyModuleId) {
        const dependencies = {
          "@antv/astro-theme-antv/table": fileURLToPath(
            new URL("../theme/demos/table.ts", import.meta.url)
          ),
          ...Object.fromEntries(Object.entries(registry.demoFiles?.resolutions ?? {}).map(([name, file]) =>
            [name, resolve(registry.config.root, file)])),
          ...packageDependencies,
        };
        const entries = await Promise.all(
          Object.entries(dependencies).map(async ([name, source]) => {
            const resolved = await this.resolve(
              source,
              resolve(registry.config.root, "package.json"),
              { skipSelf: true }
            );
            if (!resolved)
              throw new Error(`Unable to resolve demo dependency: ${name}`);
            if (!isStyle(source)) demoModules.add(resolved.id.split('?')[0]!);
            if (isStyle(source)) resolved.id = styleId(resolved.id);
            // URL-only entries bypass Vite's import analysis; allow the configured entry file.
            if (!isBuild) {
              // Import-map URLs bypass import analysis; use the optimizer's ESM wrappers for CommonJS.
              const optimizer = server.environments.client?.depsOptimizer;
              const optimized =
                optimizer?.metadata.optimized[source] ??
                optimizer?.metadata.discovered[source];
              if (optimizer && optimized)
                resolved.id = optimizer.getOptimizedDepId(optimized);
              const file = resolved.id.split("?")[0]!;
              if (!file.startsWith('\0') && !server.config.server.fs.allow.includes(file))
                server.config.server.fs.allow.push(file);
            }
            const url = isBuild
              ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({
                  type: "chunk",
                  id: resolved.id,
                  preserveSignature: "strict",
                })}`
              : JSON.stringify(resolved.id.startsWith('\0')
                ? `${base}@id/${resolved.id.replace('\0', '__x00__')}`
                : `${base}@fs${resolved.id}`);
            // Relative imports resolve against the demo URL (including base);
            // explicit root-relative imports also need their unprefixed key.
            const localKey = registry.demoFiles?.resolutions[name]
              ? `${base}${name.slice(1)}` : name;
            const keys =
              name.startsWith("/") && !extname(name)
                ? [localKey, `${localKey}.ts`]
                : [localKey];
            if (localKey !== name) keys.push(name);
            return keys
              .map((key) => `[${JSON.stringify(key)}]: ${url}`)
              .join(",");
          })
        );
        return `export const imports = {${entries.join(",")}}; export const resolutions = ${JSON.stringify(registry.demoFiles?.resolutions ?? {})};`;
      }
      if (id === resolvedRegistryModuleId) {
        return `export default ${JSON.stringify(registry)};`;
      }
      if (id === resolvedModuleId) {
        const entries = [...demos.values()].map(
          (demo) =>
            `${JSON.stringify(demo.key)}: async () => {
              ${registry.config.demo.setup ? `const {default: setup} = await import(${JSON.stringify(resolve(registry.config.root, registry.config.demo.setup))});
              await setup({container: document.getElementById('container'), path: ${JSON.stringify(`/${demo.relativeSourcePath}`)}});` : ''}
              return import(${JSON.stringify(entryId(publicEntryPrefix, demo))});
            }`,
        );
        return `export const demos = {${entries.join(",")}};`;
      }
      if (!id.startsWith(resolvedEntryPrefix)) return;

      const key = entryKey(id, resolvedEntryPrefix);
      const demo = demos.get(key);
      if (!demo) throw new Error(`Unknown demo entry: ${key}`);
      return {
        code: compileDemoSource(demo.source, demo.sourcePath).code,
        map: null,
      };
    },
  };
}
