import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import type { DemoRecord, SiteRegistry } from "../compiler/content.js";
import { isWithin } from "../util.js";

const dependencyModuleId = "virtual:antv-demo-dependencies";
const resolvedDependencyModuleId = `\0${dependencyModuleId}`;

const publicModuleId = "virtual:antv-site-demos";
const resolvedModuleId = `\0${publicModuleId}`;
const registryModuleId = "virtual:antv-site-registry";
const resolvedRegistryModuleId = `\0${registryModuleId}`;
const publicEntryPrefix = "virtual:antv-site-demo-entry:";
const resolvedEntryPrefix = `\0${publicEntryPrefix}`;

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
  let base = "/";
  let isBuild = false;
  let server: ViteDevServer;
  return {
    name: "antv-site-demos",
    enforce: "pre",
    configResolved(config) {
      base = config.base;
      isBuild = config.command === "build";
    },
    configureServer(devServer) {
      server = devServer;
      server.watcher.add(registry.config.content.docs);
    },
    handleHotUpdate({ file, server }) {
      // Shared document source is read during SSR, outside Vite's module graph.
      if (
        isWithin(registry.config.content.docs, file) &&
        /\.[jt]sx?$/.test(file)
      ) {
        server.ws.send({ type: "full-reload" });
        return [];
      }
    },
    resolveId(source, importer) {
      if (source === dependencyModuleId) return resolvedDependencyModuleId;
      if (source === publicModuleId) return resolvedModuleId;
      if (source === registryModuleId) return resolvedRegistryModuleId;
      if (source.startsWith(publicEntryPrefix)) {
        return `${resolvedEntryPrefix}${source.slice(publicEntryPrefix.length)}`;
      }
      if (!importer?.startsWith(resolvedEntryPrefix)) return;

      const key = entryKey(importer, resolvedEntryPrefix);
      const demo = demos.get(key);
      if (!demo) throw new Error(`Unknown demo entry: ${key}`);
      return this.resolve(source, demo.sourcePath, { skipSelf: true });
    },
    async load(id) {
      if (id === resolvedDependencyModuleId) {
        const dependencies = {
          "@antv/astro-theme-antv/table": fileURLToPath(
            new URL("../theme/demos/table.ts", import.meta.url)
          ),
          ...registry.config.demo.dependencies,
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
            // URL-only entries bypass Vite's import analysis; allow the configured entry file.
            if (!isBuild) {
              const file = resolved.id.split("?")[0]!;
              if (!server.config.server.fs.allow.includes(file))
                server.config.server.fs.allow.push(file);
            }
            const url = isBuild
              ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({
                  type: "chunk",
                  id: resolved.id,
                  preserveSignature: "strict",
                })}`
              : JSON.stringify(`${base}@fs${resolved.id}`);
            const key = name.startsWith("/") ? `${base}${name.slice(1)}` : name;
            const keys =
              name.startsWith("/") && !extname(name)
                ? [key, `${key}.ts`]
                : [key];
            return keys
              .map((key) => `[${JSON.stringify(key)}]: ${url}`)
              .join(",");
          })
        );
        return `export const imports = {${entries.join(",")}};`;
      }
      if (id === resolvedRegistryModuleId) {
        return `export default ${JSON.stringify(registry)};`;
      }
      if (id === resolvedModuleId) {
        const entries = [...demos.values()].map(
          (demo) =>
            `${JSON.stringify(demo.key)}: () => import(${JSON.stringify(
              entryId(publicEntryPrefix, demo),
            )})`,
        );
        return `export const demos = {${entries.join(",")}};`;
      }
      if (!id.startsWith(resolvedEntryPrefix)) return;

      const key = entryKey(id, resolvedEntryPrefix);
      const demo = demos.get(key);
      if (!demo) throw new Error(`Unknown demo entry: ${key}`);
      return {
        code: demo.source,
        map: null,
      };
    },
  };
}
