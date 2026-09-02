import { dirname, extname } from "node:path";
import type { Plugin } from "vite";
import type { SiteRegistry } from "../compiler/content.js";

const publicModuleId = "virtual:antv-site-demos";
const resolvedModuleId = `\0${publicModuleId}`;
const registryModuleId = "virtual:antv-site-registry";
const resolvedRegistryModuleId = `\0${registryModuleId}`;
const publicEntryPrefix = "virtual:antv-site-demo-entry:";
const resolvedEntryPrefix = `\0${publicEntryPrefix}`;

export interface DemoModule {
  key: string;
  source: string;
  sourcePath: string;
}

const moduleMap = (registry: SiteRegistry) =>
  new Map<string, DemoModule>(
    registry.demos.map((demo) => [
      demo.key,
      { key: demo.key, source: demo.source, sourcePath: demo.sourcePath },
    ]),
  );

const entryId = (prefix: string, demo: DemoModule) =>
  `${prefix}${encodeURIComponent(demo.key)}${extname(demo.sourcePath)}`;

const entryKey = (id: string, prefix: string) => {
  const encodedKeyWithExtension = id.slice(prefix.length);
  const extension = extname(encodedKeyWithExtension);
  const encodedKey = extension
    ? encodedKeyWithExtension.slice(0, -extension.length)
    : encodedKeyWithExtension;
  return decodeURIComponent(encodedKey);
};

export function createDemoPlugin(getRegistry: () => SiteRegistry): Plugin {
  return {
    name: "antv-site-demos",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === publicModuleId) return resolvedModuleId;
      if (source === registryModuleId) return resolvedRegistryModuleId;
      if (source.startsWith(publicEntryPrefix)) {
        return `${resolvedEntryPrefix}${source.slice(publicEntryPrefix.length)}`;
      }
      if (!importer?.startsWith(resolvedEntryPrefix)) return;

      const key = entryKey(importer, resolvedEntryPrefix);
      const demo = moduleMap(getRegistry()).get(key);
      if (!demo) throw new Error(`Unknown demo entry: ${key}`);
      return this.resolve(source, demo.sourcePath, { skipSelf: true });
    },
    load(id) {
      const demos = moduleMap(getRegistry());
      if (id === resolvedRegistryModuleId) {
        return `export default ${JSON.stringify(getRegistry())};`;
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
        meta: {
          antvSite: {
            sourcePath: demo.sourcePath,
            resolveDir: dirname(demo.sourcePath),
          },
        },
      };
    },
  };
}
