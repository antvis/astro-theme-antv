import type {
  HomeSlotName,
  ResolvedSiteConfig,
  SiteLocale,
} from "./compiler/config";
import type { SiteRegistry } from "./compiler/content";

export interface HomeSlotProps {
  locale: SiteLocale;
  slotName: HomeSlotName;
  config: ResolvedSiteConfig;
  registry: SiteRegistry;
}
