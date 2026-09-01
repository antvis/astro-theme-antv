import { normalizePath, type Plugin } from "vite";
import {
  homeSlotNames,
  type ResolvedSiteConfig,
} from "../compiler/config";

const publicModuleId = "virtual:antv-site-home-slots";
const resolvedModuleId = `\0${publicModuleId}`;

export function createSlotsPlugin(
  getConfig: () => ResolvedSiteConfig,
): Plugin {
  return {
    name: "antv-site-slots",
    enforce: "pre",
    resolveId(source) {
      if (source === publicModuleId) return resolvedModuleId;
    },
    load(id) {
      if (id !== resolvedModuleId) return;

      const imports: string[] = [];
      const exports: string[] = [];
      let componentIndex = 0;

      for (const slotName of homeSlotNames) {
        const bindings = getConfig().slots.home[slotName].map((path) => {
          const binding = `HomeSlot${componentIndex++}`;
          imports.push(
            `import ${binding} from ${JSON.stringify(normalizePath(path))};`,
          );
          return binding;
        });
        exports.push(`  ${slotName}: [${bindings.join(", ")}],`);
      }

      return [
        ...imports,
        "export const homeSlots = {",
        ...exports,
        "};",
      ].join("\n");
    },
  };
}
