import type { SiteRegistry } from './compiler';
import registryData from 'virtual:antv-site-registry';

export const registry = registryData as SiteRegistry;
export const config = registry.config;
export const categoriesBySlug = new Map(
  registry.categories.map((category) => [category.slug, category]),
);
export const groupsByKey = new Map(
  registry.groups.map((group) => [
    `${group.categorySlug}/${group.slug}`,
    group,
  ]),
);
export const demosByKey = new Map(
  registry.demos.map((demo) => [demo.key, demo]),
);
