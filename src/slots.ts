import type {
  HomeSlotName,
  ResolvedSiteConfig,
  SiteLocale,
} from "./compiler/config.js";
import type { SiteRegistry } from "./compiler/content.js";

export interface HomeSlotProps {
  locale: SiteLocale;
  slotName: HomeSlotName;
  config: ResolvedSiteConfig;
  registry: SiteRegistry;
}
