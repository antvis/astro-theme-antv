import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import type { ResolvedSiteConfig } from "../compiler/config.js";
import type { QaPreviewProduct } from "../qa.js";

const publicModuleId = "virtual:antv-site-qa-preview-adapters";
const resolvedModuleId = `\0${publicModuleId}`;
const builtinAdapterModulePath = normalizePath(
  fileURLToPath(new URL("../qa-adapters/index.js", import.meta.url)),
);

const builtinAdapters: Record<
  QaPreviewProduct,
  { factory: string; loader: string }
> = {
  g2: {
    factory: "createG2PreviewAdapter",
    loader: '() => import("@antv/g2")',
  },
  g6: {
    factory: "createG6PreviewAdapter",
    loader: '() => import("@antv/g6")',
  },
  s2: {
    factory: "createS2PreviewAdapter",
    loader:
      '() => Promise.all([import("@antv/s2"), import("@antv/s2/dist/s2.min.css")]).then(([library]) => library)',
  },
  x6: {
    factory: "createX6PreviewAdapter",
    loader: '() => import("@antv/x6")',
  },
};

export function createQaPlugin(getConfig: () => ResolvedSiteConfig): Plugin {
  return {
    name: "antv-site-qa",
    enforce: "pre",
    resolveId(source) {
      if (source === publicModuleId) return resolvedModuleId;
    },
    load(id) {
      if (id !== resolvedModuleId) return;

      const config = getConfig().qa;
      const products = config?.previewProducts ?? [];
      const adapters = Object.entries(config?.previewAdapters ?? {});
      const builtinFactories = products.map(
        (product) => builtinAdapters[product].factory,
      );
      const imports = [
        ...(builtinFactories.length
          ? [
              `import { ${builtinFactories.join(", ")} } from ${JSON.stringify(builtinAdapterModulePath)};`,
            ]
          : []),
        ...adapters.map(
          ([, path], index) =>
            `import QaPreviewAdapter${index} from ${JSON.stringify(normalizePath(path))};`,
        ),
      ];
      const entries = [
        ...products.map((product) => {
          const { factory, loader } = builtinAdapters[product];
          return `[${JSON.stringify(product)}, ${factory}(${loader})]`;
        }),
        ...adapters.map(
          ([name], index) =>
            `[${JSON.stringify(name)}, QaPreviewAdapter${index}]`,
        ),
      ];
      return [
        ...imports,
        `export const qaPreviewAdapters = new Map([${entries.join(",")}]);`,
      ].join("\n");
    },
  };
}
