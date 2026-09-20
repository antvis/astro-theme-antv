/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    antvDocument?: import('astro:content').CollectionEntry<'docs'>;
    inlineDemoSources?: Promise<string[]>;
  }
}

declare module "virtual:antv-site-demos" {
  export const demos: Record<string, () => Promise<unknown>>;
}

declare module "virtual:antv-site-registry" {
  const registry: import("../compiler/content.js").SiteRegistry;
  export default registry;
}

declare module "virtual:antv-site-home-slots" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  import type { HomeSlotName } from "../compiler/config.js";

  export const homeSlots: Record<HomeSlotName, AstroComponentFactory[]>;
}

declare module "virtual:antv-demo-dependencies" {
  export const dependencies: Record<string, () => Promise<unknown>>;
}
