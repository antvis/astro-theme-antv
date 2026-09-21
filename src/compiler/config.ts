import { realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  resolve,
} from "node:path";
import { z } from "zod";
import { openGraphSchema } from "../open-graph.js";
import type { OpenGraphOptions } from "../open-graph.js";
import { isWithin } from "../util.js";

export type SiteLocale = "zh" | "en";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface LocalizedLink {
  text: LocalizedText;
  href: string;
}

export type ContentComponent = string | { type: "link-card" };

export type AgentComponent =
  | {
      type: "code";
      language?: string;
      sourceRoot?: string;
      sourceExtension?: string;
    }
  | { type: "link-card" };

export type AnalyticsConfig = Record<string, Record<string, unknown>>;

export const homeSlotNames = [
  "beforeHero",
  "hero",
  "afterHero",
  "beforeFeatures",
  "features",
  "afterFeatures",
  "beforeFooter",
] as const;

export type HomeSlotName = (typeof homeSlotNames)[number];

export interface AntVSiteConfig {
  site: {
    title: string;
    origin: string;
    repository: string;
    description: LocalizedText;
    defaultLocale?: SiteLocale;
    locales?: SiteLocale[];
    favicon?: string;
    logo?: string;
    openGraph?: Pick<OpenGraphOptions, "image" | "imageAlt">;
  };
  content: {
    docs?: string;
    /** Name of the consumer's docs Astro Content Collection. Defaults to "docs". */
    collectionName?: string;
    examples?: string | null;
    edit?: {
      branch: string;
      path?: string;
      label?: LocalizedText;
    } | null;
    components?: Record<string, ContentComponent>;
    /** How MDX components are represented in machine-readable Markdown. */
    agentComponents?: Record<string, AgentComponent>;
    sidebar?: Record<string, LocalizedText & { order?: number }>;
  };
  navigation?: LocalizedLink[];
  versions?: Record<string, string>;
  analytics?: AnalyticsConfig;
  search?: {
    enabled?: boolean;
    aliases?: Record<string, string[]>;
    pathBoosts?: Array<{ prefix: string; weight: number }>;
  };
  qa?: {
    /** Enable the package-owned QA entry and QA route. */
    enabled?: boolean;
    path?: string;
  } | null;
  examples?: Array<{
    slug: string;
    title: LocalizedText;
    icon?: string;
  }>;
  home: {
    eyebrow?: LocalizedText;
    title: LocalizedText;
    description: LocalizedText;
    image?: string;
    imageAlt?: LocalizedText;
    openGraph?: OpenGraphOptions;
    featuresTitle?: LocalizedText;
    featuresDescription?: LocalizedText;
    actions?: LocalizedLink[];
    features?: Array<{
      title: LocalizedText;
      description: LocalizedText;
      icon?: string;
    }>;
  };
  theme?: {
    tokens?: Record<`--${string}`, string>;
  };
  footer?: {
    description?: LocalizedText;
    groups?: Array<{
      title: LocalizedText;
      links?: LocalizedLink[];
    }> | null;
    copyright?: LocalizedText;
    tagline?: LocalizedText;
  };
  slots?: {
    home?: Partial<Record<HomeSlotName, string[]>>;
  };
  demo?: {
    /** Demo import names mapped to installed packages or consumer-relative modules, emitted as native ESM entries. */
    dependencies?: Record<string, string>;
    height?: number;
  };
  /** @deprecated Configure Astro's standard `outDir` instead. */
  output?: never;
}

export interface SiteWorkspacePaths {
  outDir?: string;
  srcDir?: string;
  publicDir?: string;
  cacheDir?: string;
}

export interface ResolvedSiteConfig {
  root: string;
  site: {
    title: string;
    origin: string;
    repository: string;
    description: LocalizedText;
    defaultLocale: SiteLocale;
    locales: SiteLocale[];
    favicon?: string;
    logo?: string;
    openGraph?: Pick<OpenGraphOptions, "image" | "imageAlt">;
  };
  content: {
    docs: string;
    collectionName: string;
    examples: string | null;
    edit: {
      branch: string;
      path: string;
      label?: LocalizedText;
    } | null;
    components: Record<string, ContentComponent>;
    agentComponents: Record<string, AgentComponent>;
    sidebar: Record<string, LocalizedText & { order?: number }>;
  };
  navigation: LocalizedLink[];
  versions: Record<string, string>;
  analytics: AnalyticsConfig;
  search: {
    enabled: boolean;
    aliases: Record<string, string[]>;
    pathBoosts: Array<{ prefix: string; weight: number }>;
  };
  qa: {
    path: string;
    service: string;
  } | null;
  examples: Array<{ slug: string; title: LocalizedText; icon?: string }>;
  home: {
    eyebrow?: LocalizedText;
    title: LocalizedText;
    description: LocalizedText;
    image?: string;
    imageAlt?: LocalizedText;
    openGraph?: OpenGraphOptions;
    featuresTitle?: LocalizedText;
    featuresDescription?: LocalizedText;
    actions: LocalizedLink[];
    features: Array<{
      title: LocalizedText;
      description: LocalizedText;
      icon?: string;
    }>;
  };
  theme: {
    tokens: Record<string, string>;
  };
  footer: {
    description?: LocalizedText;
    groups: Array<{ title: LocalizedText; links: LocalizedLink[] }> | null;
    copyright?: LocalizedText;
    tagline?: LocalizedText;
  };
  slots: {
    home: Record<HomeSlotName, string[]>;
  };
  demo: {
    dependencies: Record<string, string>;
    height: number;
  };
}

const localizedTextSchema = z.strictObject({
  zh: z.string(),
  en: z.string(),
});

const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "URL must use HTTP or HTTPS.");

const siteOriginSchema = httpUrlSchema.refine((value) => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash
  );
}, "Site origin must not include credentials, a path, a query, or a hash.");

const supportedLinkProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);
const linkProtocolPattern = /^[a-z][a-z\d+.-]*:/i;
const safeHrefSchema = z
  .string()
  .min(1)
  .refine((value) => !/\s/.test(value), "Links must not contain whitespace.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Links must not contain control characters.",
  )
  .refine((value) => {
    if (!linkProtocolPattern.test(value)) return true;
    try {
      return supportedLinkProtocols.has(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Links must be relative or use HTTP, HTTPS, mailto, or tel.");

const sidebarItemSchema = localizedTextSchema.extend({
  order: z.number().optional(),
});

const linkSchema = z.strictObject({
  text: localizedTextSchema,
  href: safeHrefSchema,
});

const footerGroupSchema = z.strictObject({
  title: localizedTextSchema,
  links: z.array(linkSchema).default([]),
});

const cssTokenNameSchema = z
  .string()
  .regex(
    /^--[a-z][a-z0-9-]*$/,
    "Theme token names must be CSS custom properties.",
  );

const cssTokensSchema = z.record(cssTokenNameSchema, z.string()).default({});

const contentComponentSchema = z.union([
  z.string(),
  z.strictObject({
    type: z.literal("link-card"),
  }),
]);

const componentSlotSchema = z.array(z.string().min(1)).default([]);

const emptyHomeSlots: Record<HomeSlotName, string[]> = {
  beforeHero: [],
  hero: [],
  afterHero: [],
  beforeFeatures: [],
  features: [],
  afterFeatures: [],
  beforeFooter: [],
};

const homeSlotsSchema = z.strictObject(
  Object.fromEntries(
    homeSlotNames.map((name) => [name, componentSlotSchema]),
  ) as Record<HomeSlotName, typeof componentSlotSchema>,
);

const routeSegmentSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/,
    "Route segments must contain lowercase letters, numbers, slashes, or hyphens.",
  );

const configSchema = z
  .strictObject({
    site: z.strictObject({
      title: z.string().min(1),
      origin: siteOriginSchema,
      repository: httpUrlSchema,
      description: localizedTextSchema,
      defaultLocale: z.enum(["zh", "en"]).default("zh"),
      locales: z
        .array(z.enum(["zh", "en"]))
        .min(1)
        .default(["zh", "en"]),
      favicon: z.string().optional(),
      logo: z.string().optional(),
      openGraph: openGraphSchema.pick({ image: true, imageAlt: true }).optional(),
    }),
    content: z.strictObject({
      docs: z.string().default("./docs"),
      // Name of the Astro Content Collection the consumer registers with
      // antvDocsLoader in src/content.config.ts. The theme resolves documents
      // through this collection name (default "docs"), so consumers using the
      // default can copy the README snippet unchanged, while those needing a
      // different name keep it centralized here instead of duplicating it in
      // the theme.
      collectionName: z.string().min(1).default("docs"),
      examples: z.string().nullable().default("./examples"),
      edit: z
        .strictObject({
          branch: z.string().min(1),
          path: z.string().default(""),
          label: localizedTextSchema.optional(),
        })
        .nullable()
        .default(null),
      components: z.record(z.string(), contentComponentSchema).default({}),
      agentComponents: z
        .record(z.string(), z.discriminatedUnion("type", [
          z.strictObject({
            type: z.literal("code"),
            language: z.string().regex(/^[\w+-]+$/).optional(),
            sourceRoot: z.string().min(1).optional(),
            sourceExtension: z.string().regex(/^(\.[a-zA-Z0-9]+)?$/).optional(),
          }),
          z.strictObject({ type: z.literal("link-card") }),
        ]))
        .default({}),
      sidebar: z.record(z.string(), sidebarItemSchema).default({}),
    }),
    navigation: z.array(linkSchema).default([]),
    versions: z.record(z.string(), safeHrefSchema).default({}),
    analytics: z
      .record(z.string().min(1), z.record(z.string(), z.unknown()))
      .default({}),
    search: z
      .strictObject({
        enabled: z.boolean().default(true),
        aliases: z
          .record(z.string().min(1), z.array(z.string().min(1)))
          .default({}),
        pathBoosts: z
          .array(
            z.strictObject({
              prefix: z.string().min(1),
              weight: z.number(),
            }),
          )
          .default([]),
      })
      .default({ enabled: true, aliases: {}, pathBoosts: [] }),
    qa: z
      .strictObject({
        enabled: z.boolean().default(false),
        path: routeSegmentSchema.default("qa"),
      })
      .nullable()
      .default(null),
    examples: z
      .array(
        z.strictObject({
          slug: routeSegmentSchema,
          title: localizedTextSchema,
          icon: z.string().optional(),
        }),
      )
      .default([]),
    home: z.strictObject({
      eyebrow: localizedTextSchema.optional(),
      title: localizedTextSchema,
      description: localizedTextSchema,
      image: z.string().optional(),
      imageAlt: localizedTextSchema.optional(),
      openGraph: openGraphSchema.optional(),
      featuresTitle: localizedTextSchema.optional(),
      featuresDescription: localizedTextSchema.optional(),
      actions: z.array(linkSchema).default([]),
      features: z
        .array(
          z.strictObject({
            title: localizedTextSchema,
            description: localizedTextSchema,
            icon: z.string().optional(),
          }),
        )
        .default([]),
    }),
    theme: z
      .strictObject({
        tokens: cssTokensSchema,
      })
      .default({
        tokens: {},
      }),
    footer: z
      .strictObject({
        description: localizedTextSchema.optional(),
        groups: z.array(footerGroupSchema).nullable().default(null),
        copyright: localizedTextSchema.optional(),
        tagline: localizedTextSchema.optional(),
      })
      .default({ groups: null }),
    slots: z
      .strictObject({
        home: homeSlotsSchema.default(emptyHomeSlots),
      })
      .default({ home: emptyHomeSlots }),
    demo: z
      .strictObject({
        dependencies: z.record(z.string().min(1), z.string().min(1)).default({}),
        height: z.number().int().min(240).max(1200).default(480),
      })
      .default({
        height: 480,
        dependencies: {},
      }),
    output: z
      .never({
        error: "output was removed. Configure Astro's standard outDir instead.",
      })
      .optional(),
  })
  .superRefine((config, context) => {
    if (!config.site.locales.includes(config.site.defaultLocale)) {
      context.addIssue({
        code: "custom",
        path: ["site", "defaultLocale"],
        message: "site.defaultLocale must be included in site.locales.",
      });
    }
    if (new Set(config.site.locales).size !== config.site.locales.length) {
      context.addIssue({
        code: "custom",
        path: ["site", "locales"],
        message: "site.locales must not contain duplicates.",
      });
    }
    if (config.content.examples === null && config.examples.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["examples"],
        message: "Example categories require content.examples to be enabled.",
      });
    }
    const duplicateCategory = config.examples.find(
      (category, index) =>
        config.examples.findIndex(
          (candidate) => candidate.slug === category.slug,
        ) !== index,
    );
    if (duplicateCategory) {
      context.addIssue({
        code: "custom",
        path: ["examples"],
        message: `Duplicate example category slug: ${duplicateCategory.slug}`,
      });
    }
  });

const resolveFromRoot = (root: string, path: string) =>
  isAbsolute(path) ? path : resolve(root, path);

const errorCode = (error: unknown) =>
  error instanceof Error && "code" in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined;

async function resolvePhysicalPath(path: string): Promise<string> {
  let cursor = resolve(path);
  const suffix = [];

  while (true) {
    try {
      return resolve(await realpath(cursor), ...suffix);
    } catch (error) {
      if (errorCode(error) !== "ENOENT" && errorCode(error) !== "ENOTDIR")
        throw error;
      const parent = dirname(cursor);
      if (parent === cursor) throw error;
      suffix.unshift(basename(cursor));
      cursor = parent;
    }
  }
}

async function validateOutputPath(
  root: string,
  output: string,
  content: Pick<ResolvedSiteConfig["content"], "docs" | "examples">,
  workspace: SiteWorkspacePaths,
): Promise<void> {
  const physicalRoot = await resolvePhysicalPath(root);
  const physicalOutput = await resolvePhysicalPath(output);
  if (
    physicalOutput === physicalRoot ||
    !isWithin(physicalRoot, physicalOutput)
  ) {
    throw new Error(
      `Site output must be a dedicated directory inside the consumer root: ${physicalOutput}`,
    );
  }

  const protectedPaths = [
    content.docs,
    content.examples,
    workspace.srcDir ?? resolve(physicalRoot, "src"),
    workspace.publicDir ?? resolve(physicalRoot, "public"),
    workspace.cacheDir ?? resolve(physicalRoot, ".astro"),
    resolve(physicalRoot, ".antv-site"),
    resolve(physicalRoot, ".git"),
    resolve(physicalRoot, "node_modules"),
  ].filter((path): path is string => Boolean(path));

  for (const protectedPath of protectedPaths) {
    const physicalProtectedPath = await resolvePhysicalPath(protectedPath);
    if (
      isWithin(physicalOutput, physicalProtectedPath) ||
      isWithin(physicalProtectedPath, physicalOutput)
    ) {
      throw new Error(
        `Site output overlaps a protected input or workspace directory: ${physicalOutput} (protected: ${physicalProtectedPath})`,
      );
    }
  }
}

export async function resolveConfig(
  input: AntVSiteConfig,
  consumerRoot: string,
  workspace: SiteWorkspacePaths = {},
): Promise<ResolvedSiteConfig> {
  const config = configSchema.parse(input);
  const root = await resolvePhysicalPath(consumerRoot);
  const content = {
    ...config.content,
    docs: resolveFromRoot(root, config.content.docs),
    agentComponents: {
      Demo: {
        type: "code" as const,
        language: "ts",
        sourceRoot: resolveFromRoot(root, config.content.docs),
        sourceExtension: ".ts",
      },
      ...Object.fromEntries(
        Object.entries(config.content.agentComponents).map(([name, rule]) => [
          name,
          rule.type === "code" && rule.sourceRoot
            ? { ...rule, sourceRoot: resolveFromRoot(root, rule.sourceRoot) }
            : rule,
        ]),
      ),
    },
    examples: config.content.examples
      ? resolveFromRoot(root, config.content.examples)
      : null,
  };
  await validateOutputPath(
    root,
    workspace.outDir ?? resolve(root, "dist"),
    content,
    workspace,
  );

  return {
    ...config,
    root,
    content,
    qa: config.qa?.enabled
      ? {
          path: config.qa.path,
          service: "https://sive.antv.antgroup.com",
        }
      : null,
    slots: {
      home: Object.fromEntries(
        homeSlotNames.map((name) => [
          name,
          config.slots.home[name].map((component) =>
            resolveFromRoot(root, component),
          ),
        ]),
      ) as Record<HomeSlotName, string[]>,
    },
  } as ResolvedSiteConfig;
}
