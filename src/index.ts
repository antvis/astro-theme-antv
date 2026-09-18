import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig as defineAstroConfig } from "astro/config";
import type { AntVSiteConfig } from "./compiler/config.js";
import { antvSite } from "./integration.js";

export { antvSite } from "./integration.js";

export const defineConfig = <const Config extends AntVSiteConfig>(
  config: Config,
) =>
  defineAstroConfig({
    integrations: [antvSite(config), mdx(), sitemap()],
  });

export type {
  AnalyticsConfig,
  AntVSiteConfig,
  HomeSlotName,
  LocalizedLink,
  LocalizedText,
  SiteLocale,
} from "./compiler/config.js";
export type { HomeSlotProps } from "./slots.js";
export default defineConfig;

export type { OpenGraphOptions } from "./open-graph.js";
