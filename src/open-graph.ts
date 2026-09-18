import { z } from "zod";
import { localize } from "./compiler/localization.js";

const text = z.union([
  z.string().min(1),
  z.strictObject({ zh: z.string().min(1), en: z.string().min(1) }),
]);

export const openGraphSchema = z.strictObject({
  title: text.optional(),
  description: text.optional(),
  image: z.string().min(1).optional(),
  imageAlt: text.optional(),
  type: z.enum(["website", "article"]).optional(),
});

export type OpenGraphOptions = z.infer<typeof openGraphSchema>;

interface Options {
  site: {
    title: string;
    origin: string;
    openGraph?: Pick<OpenGraphOptions, "image" | "imageAlt">;
  };
  locale: "zh" | "en";
  title: string;
  description: string;
  canonical: string;
  base?: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  openGraph?: OpenGraphOptions;
}

/** Resolve metadata once so each property is emitted exactly once in the head. */
export function createOpenGraphTags(options: Options): Record<string, string> {
  const { site, locale, openGraph: override = {} } = options;
  const title = localize(override.title, locale, options.title);
  const tags: Record<string, string> = {
    "og:title": title,
    "og:description": localize(
      override.description,
      locale,
      options.description,
    ),
    "og:url": options.canonical,
    "og:type": override.type ?? options.type ?? "website",
    "og:site_name": site.title,
    "og:locale": locale === "zh" ? "zh_CN" : "en_US",
  };
  // Keep image and alt from the same source; a default image's description
  // must not accidentally describe an unrelated document screenshot.
  const image = override.image ?? options.image ?? site.openGraph?.image;
  let alt = override.imageAlt;
  if (alt === undefined && !override.image) {
    alt = options.image ? options.imageAlt : site.openGraph?.imageAlt;
  }
  if (image) {
    const base = `/${(options.base ?? "/")
      .split("/")
      .filter(Boolean)
      .join("/")}`;
    let path = image;
    if (!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(image)) {
      path = image.startsWith("/") ? image : `/${image}`;
      if (base !== "/" && path !== base && !path.startsWith(`${base}/`)) {
        path = `${base}${path}`;
      }
    }
    const url = new URL(path, site.origin);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Open Graph images must use HTTP(S): ${image}`);
    }
    tags["og:image"] = url.href;
    tags["og:image:alt"] = localize(alt, locale, title);
  }
  return tags;
}
