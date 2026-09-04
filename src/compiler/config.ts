import { realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { z } from "zod";
import {
  qaPreviewProducts,
  qaProducts,
  qaServiceEndpoints,
  type QaPreviewProduct,
  type QaProduct,
} from "../qa.js";

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
    sidebar?: Record<string, LocalizedText & { order?: number }>;
  };
  navigation?: LocalizedLink[];
  versions?: Record<string, string>;
  search?: {
    enabled?: boolean;
    aliases?: Record<string, string[]>;
    pathBoosts?: Array<{ prefix: string; weight: number }>;
  };
  qa?: {
    path?: string;
    defaultStack?: QaProduct;
    /** Omit for every built-in preview product; use [] to disable built-ins. */
    previewProducts?: QaPreviewProduct[];
    previewAdapters?: Record<string, string>;
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
    showStats?: boolean;
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
    sidebar: Record<string, LocalizedText & { order?: number }>;
  };
  navigation: LocalizedLink[];
  versions: Record<string, string>;
  search: {
    enabled: boolean;
    aliases: Record<string, string[]>;
    pathBoosts: Array<{ prefix: string; weight: number }>;
  };
  qa: {
    path: string;
    defaultStack: QaProduct;
    service: {
      development: string;
      production: string;
    };
    previewProducts: QaPreviewProduct[];
    previewAdapters: Record<string, string>;
  } | null;
  examples: Array<{ slug: string; title: LocalizedText; icon?: string }>;
  home: {
    eyebrow?: LocalizedText;
    title: LocalizedText;
    description: LocalizedText;
    image?: string;
    imageAlt?: LocalizedText;
    showStats: boolean;
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
    height: number;
  };
}

const localizedTextSchema = z.strictObject({
  zh: z.string(),
  en: z.string(),
});

const httpUrlSchema = z.url().refine(
  (value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  "URL must use HTTP or HTTPS.",
);

const siteOriginSchema = httpUrlSchema.refine(
  (value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  },
  "Site origin must not include credentials, a path, a query, or a hash.",
);

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

const qaPreviewAdapterNameSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "QA preview adapter names must contain lowercase letters, numbers, or hyphens.",
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
      sidebar: z.record(z.string(), sidebarItemSchema).default({}),
    }),
    navigation: z.array(linkSchema).default([]),
    versions: z.record(z.string(), safeHrefSchema).default({}),
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
        path: routeSegmentSchema.default("result"),
        defaultStack: z.enum(qaProducts).default("g2"),
        previewProducts: z.array(z.enum(qaPreviewProducts)).optional(),
        previewAdapters: z
          .record(qaPreviewAdapterNameSchema, z.string().min(1))
          .default({}),
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
      showStats: z.boolean().default(true),
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
        height: z.number().int().min(240).max(1200).default(480),
      })
      .default({
        height: 480,
      }),
    output: z
      .never({
        error:
          "output was removed. Configure Astro's standard outDir instead.",
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
    const qa = config.qa;
    if (qa) {
      const configuredPreviewProducts = qa.previewProducts ?? [];
      const duplicatePreviewProduct = configuredPreviewProducts.find(
        (product, index) => configuredPreviewProducts.indexOf(product) !== index,
      );
      if (duplicatePreviewProduct) {
        context.addIssue({
          code: "custom",
          path: ["qa", "previewProducts"],
          message: `Duplicate QA preview product: ${duplicatePreviewProduct}`,
        });
      }
      const conflictingPreviewAdapter = configuredPreviewProducts.find(
        (product) => product in qa.previewAdapters,
      );
      if (conflictingPreviewAdapter) {
        context.addIssue({
          code: "custom",
          path: ["qa", "previewAdapters", conflictingPreviewAdapter],
          message: `QA preview adapter "${conflictingPreviewAdapter}" conflicts with an enabled built-in preview product.`,
        });
      }
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

export const resolveFromRoot = (root: string, path: string) =>
  isAbsolute(path) ? path : resolve(root, path);

const isWithin = (parent: string, child: string) => {
  const path = relative(parent, child);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
};

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
    qa: config.qa
      ? {
          ...config.qa,
          service: qaServiceEndpoints,
          previewProducts:
            config.qa.previewProducts ??
            qaPreviewProducts.filter(
              (product) => !(product in (config.qa?.previewAdapters ?? {})),
            ),
          previewAdapters: Object.fromEntries(
            Object.entries(config.qa.previewAdapters).map(([name, path]) => [
              name,
              resolveFromRoot(root, path),
            ]),
          ),
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
