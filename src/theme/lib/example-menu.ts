import { localize } from '../../compiler/localization.js';
import type { ExampleCategory } from '../../compiler/content.js';
import { withBase } from './paths';

export interface ExampleMenuDemo {
  key: string;
  label: string;
  href: string;
  thumbnail?: string;
}
export interface ExampleMenuGroup {
  key: string;
  label: string;
  href: string;
  demos: ExampleMenuDemo[];
}
export interface ExampleMenuCategory {
  key: string;
  label: string;
  href: string;
  icon?: string;
  groups: ExampleMenuGroup[];
}

/** Only navigation data; never include example source in the shared menu. */
export function exampleMenuData(categories: ExampleCategory[], locale: 'zh' | 'en'): ExampleMenuCategory[] {
  const catalog = withBase(`/${locale}/examples/`);
  return categories.filter((category) => category.groups.some((group) => group.demos.length))
    .map((category) => ({
      key: category.slug,
      label: localize(category.title, locale),
      href: `${catalog}#category-${category.slug}`,
      icon: category.icon,
      groups: category.groups.filter((group) => group.demos.length).map((group) => ({
        key: `${category.slug}/${group.slug}`,
        label: localize(group.title, locale),
        href: `${catalog}#group-${category.slug}-${group.slug.replaceAll('/', '-')}`,
        demos: group.demos.map((demo) => ({
          key: demo.key,
          label: localize(demo.title, locale, demo.slug),
          href: withBase(`/${locale}/examples/${demo.key}/`),
          thumbnail: demo.screenshot ? withBase(demo.screenshot) : undefined,
        })),
      })),
    }));
}

/** Static category links and the current path remain useful without JavaScript. */
export function exampleMenu(categories: ExampleCategory[], locale: 'zh' | 'en', currentRoute: string) {
  const isCatalog = currentRoute === `/${locale}/examples/`;
  const current = withBase(currentRoute);
  return exampleMenuData(categories, locale).map((category) => {
    const currentGroup = category.groups.find((group) => group.demos.some((demo) => demo.href === current));
    return {
      key: category.key,
      label: category.label,
      href: isCatalog ? `#category-${category.key}` : category.href,
      icon: category.icon,
      open: !isCatalog && Boolean(currentGroup),
      lazy: !isCatalog,
      children: (isCatalog ? category.groups : currentGroup ? [currentGroup] : []).map((group) => ({
        key: group.key,
        label: group.label,
        href: isCatalog ? group.href.slice(group.href.indexOf('#')) : group.href,
        open: !isCatalog,
        children: isCatalog ? [] : group.demos.map((demo) => ({ ...demo, current: demo.href === current })),
      })),
    };
  });
}
