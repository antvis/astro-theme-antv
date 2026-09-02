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
  AntVSiteConfig,
  HomeSlotName,
  LocalizedLink,
  LocalizedText,
  SiteLocale,
} from "./compiler/config.js";
export type {
  QaProduct,
  QaPreviewProduct,
  QaPreviewAdapter,
  QaPreviewContainer,
  QaPreviewInstance,
} from "./qa.js";
export { qaPreviewProducts, qaProducts } from "./qa.js";
export type { HomeSlotProps } from "./slots.js";
export default defineConfig;
