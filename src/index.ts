import { defineConfig as defineAstroConfig } from "astro/config";
import type { AntVSiteConfig } from "./compiler/config";
import { antvSite } from "./integration";

export { antvSite } from "./integration";

export const defineConfig = <const Config extends AntVSiteConfig>(
  config: Config,
) =>
  defineAstroConfig({
    integrations: antvSite(config),
  });

export type {
  AntVSiteConfig,
  HomeSlotName,
  LocalizedLink,
  LocalizedText,
  SiteLocale,
} from "./compiler/config";
export type {
  QaProduct,
  QaPreviewProduct,
  QaPreviewAdapter,
  QaPreviewContainer,
  QaPreviewInstance,
} from "./qa";
export { qaPreviewProducts, qaProducts } from "./qa";
export type { HomeSlotProps } from "./slots";
export default defineConfig;
