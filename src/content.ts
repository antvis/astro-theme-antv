import { glob } from "astro/loaders";
import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { openGraphSchema } from "./open-graph.js";

export interface AntvDocsLoaderOptions {
  /** Directory containing localized Markdown or MDX files, relative to the Astro root. */
  base?: string | URL;
  /** Override the default localized Markdown/MDX glob. */
  pattern?: string | string[];
}

export interface AntvDocIdentity {
  locale: "zh" | "en";
  slug: string;
  section: string;
  route: string;
}

export const antvDocsSchema = z.looseObject({
  title: z.string().min(1),
  description: z.string().optional(),
  screenshot: z.string().optional(),
  openGraph: openGraphSchema.optional(),
  order: z.number().default(0),
  sidebar: z
    .object({
      label: z.string().optional(),
      icon: z.string().optional(),
      hidden: z.boolean().default(false),
    })
    .default({ hidden: false }),
  draft: z.boolean().default(false),
});

const localizedDocumentPattern = /^(.*)\.(zh|en)\.(?:md|mdx)$/;

export function antvDocsLoader(
  options: AntvDocsLoaderOptions = {},
): Loader {
  return glob({
    base: options.base ?? "./docs",
    pattern: options.pattern ?? "**/*.{zh,en}.{md,mdx}",
    deferRender: true,
    generateId({ entry }) {
      const normalizedEntry = entry.replaceAll("\\", "/");
      const match = normalizedEntry.match(localizedDocumentPattern);
      if (!match) {
        throw new Error(
          `Localized documents must end in .zh.md, .en.md, .zh.mdx, or .en.mdx: ${entry}`,
        );
      }

      const [, sourcePath, locale] = match;
      const slug = sourcePath.replace(/(^|\/)index$/, "$1").replace(/\/$/, "");
      return `${locale}/${slug || "index"}`;
    },
  });
}

export function getAntvDocIdentity(id: string): AntvDocIdentity {
  const [locale, ...slugParts] = id.split("/");
  if (locale !== "zh" && locale !== "en") {
    throw new Error(`Invalid localized document id: ${id}`);
  }

  const idSlug = slugParts.join("/");
  if (!idSlug) throw new Error(`Localized document id has no slug: ${id}`);
  const slug = idSlug === "index" ? "" : idSlug;

  return {
    locale,
    slug,
    section: slug.split("/")[0] ?? "",
    route: `/${locale}/${slug ? `${slug}/` : ""}`,
  };
}
