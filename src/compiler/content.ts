import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { assertWithin, pathKey } from "../util";
import { localize as localized } from "./localization";
import type {
  LocalizedText,
  ResolvedSiteConfig,
  SiteLocale,
} from "./config";

const require = createRequire(import.meta.url);
const matter = require("gray-matter") as typeof import("gray-matter");

export interface DemoRecord {
  key: string;
  categorySlug: string;
  groupSlug: string;
  slug: string;
  filename: string;
  title: LocalizedText | string;
  screenshot?: string;
  source: string;
  sourcePath: string;
  relativeSourcePath: string;
}

export interface ExampleGroup {
  categorySlug: string;
  slug: string;
  title: Record<SiteLocale, string>;
  order?: number;
  demos: DemoRecord[];
}

export interface ExampleCategory {
  slug: string;
  title: LocalizedText;
  icon?: string;
  groups: ExampleGroup[];
}

interface GeneratedPageBase {
  locale: SiteLocale;
  route: string;
}

export interface HomePage extends GeneratedPageBase {
  type: "home";
}

export interface QaPage extends GeneratedPageBase {
  type: "qa";
}

export interface ExamplesPage extends GeneratedPageBase {
  type: "examples";
}

export interface ExampleCategoryPage extends GeneratedPageBase {
  type: "example-category";
  categorySlug: string;
}

export interface ExampleGroupPage extends GeneratedPageBase {
  type: "example-group";
  groupKey: string;
}

export interface DemoPage extends GeneratedPageBase {
  type: "demo";
  demoKey: string;
}

export type GeneratedPage =
  | HomePage
  | QaPage
  | ExamplesPage
  | ExampleCategoryPage
  | ExampleGroupPage
  | DemoPage;

export type SitePage = GeneratedPage;

export interface SiteRegistry {
  config: ResolvedSiteConfig;
  pages: SitePage[];
  categories: ExampleCategory[];
  groups: ExampleGroup[];
  demos: DemoRecord[];
  counts: {
    groups: number;
    demos: number;
    pages: number;
  };
}

const demoExtensionPattern = /\.(?:[cm]?[jt]sx?)$/i;

const titleFromSlug = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

async function walk(
  directory: string,
  predicate: (path: string) => boolean,
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path, predicate)));
    else if (predicate(path)) files.push(path);
  }

  return files;
}

function repairUnclosedFrontmatter(source: string): string | undefined {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return undefined;
  if (lines.slice(1).some((line) => line.trim() === "---")) return undefined;

  let sawField = false;
  let contentIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      if (sawField) {
        contentIndex = index + 1;
        break;
      }
      continue;
    }
    if (/^[A-Za-z0-9_-]+\s*:/.test(line)) {
      sawField = true;
      continue;
    }
    if (sawField) {
      contentIndex = index;
      break;
    }
  }
  if (!sawField || contentIndex < 0) return undefined;

  return [
    "---",
    ...lines.slice(1, contentIndex).filter((line) => line.trim()),
    "---",
    ...lines.slice(contentIndex),
  ].join("\n");
}

const errorCode = (error: unknown) =>
  error instanceof Error && "code" in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined;

function parseMatter(source: string, path: string) {
  try {
    return matter(source);
  } catch (error) {
    const repaired = repairUnclosedFrontmatter(source);
    if (!repaired) {
      throw new Error(`Invalid Markdown frontmatter: ${path}`, {
        cause: error,
      });
    }
    process.stderr.write(
      `@antv/site: repaired an unclosed frontmatter block in ${path}\n`,
    );
    return matter(repaired);
  }
}

const exampleLocales = ["zh", "en"] as const satisfies readonly SiteLocale[];

async function readExampleGroupMetadata(
  directory: string,
  metadataTitle: LocalizedText | string | undefined,
  fallback: string,
): Promise<{ title: Record<SiteLocale, string>; order?: number }> {
  const title = {} as Record<SiteLocale, string>;
  let order: number | undefined;

  for (const locale of exampleLocales) {
    let documentTitle = "";
    try {
      const path = resolve(directory, `index.${locale}.md`);
      const source = await readFile(path, "utf8");
      const document = parseMatter(source, path);
      documentTitle = localized(document.data.title, locale, "");
      const documentOrder = Number(document.data.order);
      if (order === undefined && Number.isFinite(documentOrder)) {
        order = documentOrder;
      }
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    title[locale] = documentTitle || localized(metadataTitle, locale, fallback);
  }

  return { title, order };
}

const routeFor = (...parts: Array<string | undefined>) =>
  `/${parts.filter(Boolean).join("/")}/`;

export async function scanSite(
  config: ResolvedSiteConfig,
): Promise<SiteRegistry> {
  const configuredCategories = new Map(
    config.examples.map((category) => [category.slug, category]),
  );
  const metaFiles = config.content.examples
    ? await walk(config.content.examples, (path) =>
        path.endsWith(`${sep}demo${sep}meta.json`),
      )
    : [];
  const groups: ExampleGroup[] = [];
  const demos: DemoRecord[] = [];

  for (const metaPath of metaFiles) {
    const groupDirectory = dirname(dirname(metaPath));

    const examplesRoot = config.content.examples!;
    const relativeGroup = pathKey(relative(examplesRoot, groupDirectory));
    const [categorySlug, ...groupParts] = relativeGroup.split("/");
    if (!categorySlug) {
      throw new Error(`Example group has no category: ${groupDirectory}`);
    }
    const groupSlug = groupParts.join("/").toLowerCase();
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as {
      title?: LocalizedText;
      demos?: Array<{
        filename: string;
        title: LocalizedText | string;
        screenshot?: string;
      }>;
    };
    const demoDirectory = dirname(metaPath);
    const placeholderTitle =
      meta.title?.zh === "中文分类" && meta.title?.en === "Category";
    const groupMetadata = await readExampleGroupMetadata(
      groupDirectory,
      placeholderTitle ? undefined : meta.title,
      titleFromSlug(groupSlug),
    );
    const group: ExampleGroup = {
      categorySlug,
      slug: groupSlug,
      ...groupMetadata,
      demos: [],
    };

    for (const item of meta.demos || []) {
      const sourcePath = resolve(demoDirectory, item.filename);
      assertWithin(examplesRoot, sourcePath);
      const source = await readFile(sourcePath, "utf8");
      const slug = item.filename
        .replace(demoExtensionPattern, "")
        .toLowerCase();
      const key = [categorySlug, groupSlug, slug].filter(Boolean).join("/");
      const record = {
        key,
        categorySlug,
        groupSlug,
        slug,
        filename: item.filename,
        title: item.title,
        screenshot: item.screenshot,
        source,
        sourcePath,
        relativeSourcePath: pathKey(relative(config.root, sourcePath)),
      };
      group.demos.push(record);
      demos.push(record);
    }

    groups.push(group);
  }

  groups.sort(
    (a, b) =>
      (a.order ?? Number.POSITIVE_INFINITY) -
        (b.order ?? Number.POSITIVE_INFINITY) || a.slug.localeCompare(b.slug),
  );

  const discoveredCategorySlugs = [
    ...new Set(groups.map((group) => group.categorySlug)),
  ];
  const categories = [
    ...config.examples.map((category) => ({ ...category })),
    ...discoveredCategorySlugs
      .filter((slug) => !configuredCategories.has(slug))
      .map((slug) => ({
        slug,
        title: { zh: titleFromSlug(slug), en: titleFromSlug(slug) },
      })),
  ].map((category) => ({
    ...category,
    groups: groups.filter((group) => group.categorySlug === category.slug),
  }));

  const pages: SitePage[] = [];
  for (const locale of config.site.locales) {
    pages.push({ type: "home", locale, route: routeFor(locale) });
    if (config.qa) {
      pages.push({
        type: "qa",
        locale,
        route: routeFor(locale, config.qa.path),
      });
    }
    if (config.content.examples) {
      pages.push({
        type: "examples",
        locale,
        route: routeFor(locale, "examples"),
      });
    }

    for (const category of categories) {
      pages.push({
        type: "example-category",
        locale,
        route: routeFor(locale, "examples", category.slug),
        categorySlug: category.slug,
      });
    }

    for (const group of groups) {
      pages.push({
        type: "example-group",
        locale,
        route: routeFor(locale, "examples", group.categorySlug, group.slug),
        groupKey: `${group.categorySlug}/${group.slug}`,
      });
    }

    for (const demo of demos) {
      pages.push({
        type: "demo",
        locale,
        route: routeFor(locale, "examples", demo.key),
        demoKey: demo.key,
      });
    }
  }

  const pageRoutes = new Set<string>();
  for (const page of pages) {
    if (pageRoutes.has(page.route)) {
      throw new Error(`Duplicate generated route: ${page.route}`);
    }
    pageRoutes.add(page.route);
  }

  return {
    config,
    pages,
    categories,
    groups,
    demos,
    counts: {
      groups: groups.length,
      demos: demos.length,
      pages: pages.length,
    },
  };
}
