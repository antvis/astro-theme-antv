import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { assertRealpathWithin, assertWithin, pathKey } from "../util.js";
import { localize as localized } from "./localization.js";
import type {
  LocalizedText,
  ResolvedSiteConfig,
  SiteLocale,
} from "./config.js";

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

export type SitePage =
  | HomePage
  | QaPage
  | ExamplesPage
  | ExampleCategoryPage
  | ExampleGroupPage
  | DemoPage;

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
const routePathPattern = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/;

const metadataLocalizedTextSchema = z.strictObject({
  zh: z.string().min(1),
  en: z.string().min(1),
});
const metadataTitleSchema = z.union([
  z.string().min(1),
  metadataLocalizedTextSchema,
]);
const exampleMetadataSchema = z.strictObject({
  title: metadataTitleSchema.optional(),
  demos: z
    .array(
      z.strictObject({
        filename: z
          .string()
          .min(1)
          .regex(demoExtensionPattern, "Demo files must be JavaScript or TypeScript modules."),
        title: metadataTitleSchema,
        screenshot: z.string().min(1).optional(),
      }),
    )
    .default([]),
});

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

const errorCode = (error: unknown) =>
  error instanceof Error && "code" in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined;

function parseMatter(source: string, path: string) {
  try {
    return matter(source);
  } catch (error) {
    throw new Error(`Invalid Markdown frontmatter: ${path}`, {
      cause: error,
    });
  }
}

function parseExampleMetadata(source: string, path: string) {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid Demo metadata JSON: ${path}`, { cause: error });
  }

  const parsed = exampleMetadataSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid Demo metadata: ${path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
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
  const demoKeys = new Set<string>();

  for (const metaPath of metaFiles) {
    const groupDirectory = dirname(dirname(metaPath));

    const examplesRoot = config.content.examples!;
    const relativeGroup = pathKey(relative(examplesRoot, groupDirectory));
    const [categorySlug, ...groupParts] = relativeGroup.split("/");
    if (!categorySlug) {
      throw new Error(`Example group has no category: ${groupDirectory}`);
    }
    const groupSlug = groupParts.join("/").toLowerCase();
    if (!groupSlug) {
      throw new Error(`Example group has no slug beneath its category: ${groupDirectory}`);
    }
    if (!routePathPattern.test(categorySlug) || !routePathPattern.test(groupSlug)) {
      throw new Error(
        `Example category and group paths must use lowercase route segments: ${relativeGroup}`,
      );
    }
    const meta = parseExampleMetadata(await readFile(metaPath, "utf8"), metaPath);
    const demoDirectory = dirname(metaPath);
    const placeholderTitle =
      typeof meta.title === "object" &&
      meta.title.zh === "中文分类" &&
      meta.title.en === "Category";
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

    for (const item of meta.demos) {
      const sourcePath = resolve(demoDirectory, item.filename);
      assertWithin(demoDirectory, sourcePath);
      await assertRealpathWithin(demoDirectory, sourcePath);
      const source = await readFile(sourcePath, "utf8");
      const slug = item.filename
        .replace(demoExtensionPattern, "")
        .toLowerCase();
      if (!routePathPattern.test(slug)) {
        throw new Error(`Demo filename does not produce a safe route: ${item.filename}`);
      }
      const key = [categorySlug, groupSlug, slug].filter(Boolean).join("/");
      if (demoKeys.has(key)) {
        throw new Error(`Duplicate Demo route key: ${key}`);
      }
      demoKeys.add(key);
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
