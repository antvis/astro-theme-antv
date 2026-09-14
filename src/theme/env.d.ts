/// <reference types="astro/client" />

declare module "virtual:antv-site-demos" {
  export const demos: Record<string, () => Promise<unknown>>;
}

declare module "virtual:antv-site-registry" {
  const registry: import("./lib/compiler").SiteRegistry;
  export default registry;
}

declare module "virtual:antv-site-home-slots" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  import type { HomeSlotName } from "../compiler/config.js";

  export const homeSlots: Record<HomeSlotName, AstroComponentFactory[]>;
}
