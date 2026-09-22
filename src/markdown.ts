import { readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MarkdownProcessor } from "astro/markdown";
import type {
  ContentComponent,
  ResolvedSiteConfig,
  SiteLocale,
} from "./compiler/config.js";
import { assertRealpathWithin, assertWithin, isWithin, pathKey } from "./util.js";

const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const componentAttributePattern =
  /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const decodeHtmlAttribute = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const parseComponentAttributes = (source: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(componentAttributePattern)) {
    attributes[match[1]] = decodeHtmlAttribute(match[2] ?? match[3] ?? "");
  }
  return attributes;
};

const externalUrlPattern = /^(?:https?:)?\/\//i;
const unsafeUrlPattern = /^[a-z][a-z\d+.-]*:/i;

const withBase = (value: string, base: string) => {
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  const basePrefix = base === "/" ? "" : `/${base.replace(/^\/+|\/+$/g, "")}`;
  if (
    basePrefix &&
    (value === basePrefix || value.startsWith(`${basePrefix}/`))
  ) {
    return value;
  }
  return `${basePrefix}${value}` || "/";
};

const withTrailingSlash = (path: string) => {
  if (path.endsWith("/") || /\/[^/]+\.[^/]+$/.test(path)) return path;
  return `${path}/`;
};

const localizeCardHref = (
  href: string | undefined,
  locale: SiteLocale,
  base: string,
) => {
  const value = String(href || "").trim();
  if (!value) return null;
  if (externalUrlPattern.test(value) || value.startsWith("#")) return value;
  if (unsafeUrlPattern.test(value)) return null;

  const suffixIndex = value.search(/[?#]/);
  const path = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);
  if (!path.startsWith("/")) return `${withTrailingSlash(path)}${suffix}`;

  const localizedPath = /^\/(?:zh|en)(?:\/|$)/.test(path)
    ? path
    : `/${locale}${path === "/" ? "" : path}`;
  return `${withBase(withTrailingSlash(localizedPath), base)}${suffix}`;
};

const safeCardCover = (cover: string | undefined, base: string) => {
  const value = String(cover || "").trim();
  if (!value) return null;
  if (externalUrlPattern.test(value)) return value;
  if (value.startsWith("/")) return withBase(value, base);
  return null;
};

const cardLayoutClass = (width: string | undefined) => {
  const percentage = Number.parseFloat(width ?? "");
  if (Number.isFinite(percentage) && percentage <= 35) return "col-span-2 [@media(640px<width<=900px)]:col-span-3";
  if (Number.isFinite(percentage) && percentage <= 55) return "col-span-3";
  return "col-span-full";
};

const renderLinkCard = (
  attributesSource: string,
  locale: SiteLocale,
  base: string,
): string => {
  const attributes = parseComponentAttributes(attributesSource);
  const href = localizeCardHref(attributes.href, locale, base);
  if (!href) return "";
  const cover = safeCardCover(attributes.cover, base);
  const external = externalUrlPattern.test(href);
  const action = locale === "zh" ? "查看详情" : "View details";
  const title = attributes.title || href;
  return [
    `<a class="group/card flex min-w-0 min-h-47 flex-col overflow-hidden [border:1px_solid_var(--border)] rounded-[var(--radius-medium)] bg-[var(--surface-raised)] text-[var(--text)] no-underline [transition:border-color_160ms_ease,box-shadow_160ms_ease,transform_160ms_ease] hover:border-[color-mix(in_srgb,var(--brand)_36%,var(--border))] hover:shadow-[0_12px_30px_color-mix(in_srgb,var(--brand)_9%,transparent)] hover:text-[var(--text)] hover:[transform:translateY(-2px)] active:[transform:translateY(0)] focus-visible:[outline:2px_solid_var(--brand)] focus-visible:outline-offset-3 [@media(width<=640px)]:min-h-0 [@media(width<=640px)]:col-span-full motion-reduce:transition-none motion-reduce:hover:transform-none ${cardLayoutClass(attributes.width)}" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noreferrer"' : ""}>`,
    cover
      ? `  <span class="block h-31 overflow-hidden [border-bottom:1px_solid_var(--border-soft)] bg-[var(--surface-subtle)] [@media(width<=640px)]:h-28"><img class="block size-full object-cover [transition:transform_240ms_ease] group-hover/card:[transform:scale(1.025)] motion-reduce:transition-none motion-reduce:group-hover/card:transform-none" src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async"></span>`
      : "",
    '  <span class="flex min-h-0 flex-1 flex-col items-start pt-4.5 px-5 pb-[17px]">',
    `    <strong class="text-[var(--text-strong)] text-[16px] font-medium leading-6">${escapeHtml(title)}</strong>`,
    attributes.description
      ? `    <span class="line-clamp-3 mt-2 text-[var(--muted)] text-[14px] leading-[22px]">${escapeHtml(attributes.description)}</span>`
      : "",
    `    <span class="inline-flex items-center gap-[5px] mt-auto pt-4 text-[var(--brand-strong)] text-[13px] font-medium [&_span]:[transition:transform_160ms_ease] group-hover/card:[&_span]:[transform:translateX(2px)] motion-reduce:[&_span]:transition-none motion-reduce:group-hover/card:[&_span]:transform-none">${escapeHtml(action)} <span aria-hidden="true">→</span></span>`,
    "  </span>",
    "</a>",
  ]
    .filter(Boolean)
    .join("\n");
};

function expandLinkCards(
  markdown: string,
  name: string,
  locale: SiteLocale,
  base: string,
): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<${escapedName}\\b([^>]*)>(?:\\s*)<\\/${escapedName}>|<${escapedName}\\b([^>]*)\\/>`,
    "gi",
  );
  const matches = [...markdown.matchAll(pattern)];
  if (!matches.length) return markdown;

  const output: string[] = [];
  let cursor = 0;
  for (let index = 0; index < matches.length; ) {
    const group = [matches[index]!];
    let nextIndex = index + 1;
    while (
      nextIndex < matches.length &&
      /^\s*$/.test(
        markdown.slice(
          group.at(-1)!.index! + group.at(-1)![0].length,
          matches[nextIndex]!.index!,
        ),
      )
    ) {
      group.push(matches[nextIndex]!);
      nextIndex += 1;
    }

    output.push(markdown.slice(cursor, group[0]!.index));
    const cards = group
      .map((match) =>
        renderLinkCard(match[1] ?? match[2] ?? "", locale, base),
      )
      .filter(Boolean);
    if (cards.length) {
      output.push(
        `<div class="grid grid-cols-6 gap-4 mt-5 mb-7 [@media(width<=640px)]:grid-cols-1 [@media(width<=640px)]:gap-3">\n${cards.join("\n")}\n</div>`,
      );
    }
    cursor = group.at(-1)!.index! + group.at(-1)![0].length;
    index = nextIndex;
  }
  output.push(markdown.slice(cursor));
  return output.join("");
}

function expandConfiguredComponents(
  markdown: string,
  components: Record<string, ContentComponent>,
  locale: SiteLocale,
  base: string,
): string {
  let expanded = markdown;
  for (const [name, component] of Object.entries(components)) {
    if (typeof component === "string") {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expanded = expanded.replace(
        new RegExp(`<${escapedName}\\s*\\/>`, "g"),
        component,
      );
    } else if (component.type === "link-card") {
      expanded = expandLinkCards(expanded, name, locale, base);
    }
  }
  return expanded;
}

async function expandLegacyCodeSources(
  markdown: string,
  markdownPath: string,
  docsRoot: string,
): Promise<string> {
  const pattern = /<code\s+src=["']([^"']+)["']\s*><\/code>/g;
  const matches = [...markdown.matchAll(pattern)];
  let expanded = markdown;

  for (const match of matches) {
    const sourcePath = resolve(dirname(markdownPath), match[1]);
    assertWithin(docsRoot, sourcePath);
    await assertRealpathWithin(docsRoot, sourcePath);
    const source = await readFile(sourcePath, "utf8");
    const language = extname(sourcePath).replace(/^\./, "") || "text";
    const replacement = [
      `<figure class="legacy-code-reference" data-code-src="${escapeHtml(match[1])}">`,
      `<figcaption>${escapeHtml(match[1])}</figcaption>`,
      `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(source)}</code></pre>`,
      "</figure>",
    ].join("\n");
    expanded = expanded.replace(match[0], replacement);
  }

  return expanded;
}

function rewriteLocalizedMarkdownLinks(
  markdown: string,
  markdownPath: string,
  docsRoot: string,
  base: string,
): string {
  return markdown.replace(
    /\]\(((?:\.\.?\/)[^)\s]+?)\.(zh|en)\.(mdx|md)([?#][^)\s]+)?\)/g,
    (_match, reference, locale, ext, suffix = "") => {
      const target = resolve(
        dirname(markdownPath),
        `${reference}.${locale}.${ext}`,
      );
      assertWithin(docsRoot, target);
      const slug = pathKey(relative(docsRoot, target))
        .replace(new RegExp(`\\.${locale}\\.${ext}$`), "")
        .replace(/\/index$/, "");
      return `](${withBase(`/${locale}/${slug ? `${slug}/` : ""}`, base)}${suffix})`;
    },
  );
}

async function prepareLegacyContent(
  markdown: string,
  markdownPath: string,
  config: ResolvedSiteConfig,
  locale: SiteLocale,
  base: string,
): Promise<string> {
  const componentsExpanded = expandConfiguredComponents(
    markdown,
    config.content.components,
    locale,
    base,
  );
  const linksRewritten = rewriteLocalizedMarkdownLinks(
    componentsExpanded,
    markdownPath,
    config.content.docs,
    base,
  );
  return expandLegacyCodeSources(
    linksRewritten,
    markdownPath,
    config.content.docs,
  );
}

export function createLegacyContentMarkdownProcessor(
  processor: MarkdownProcessor,
  getConfig: () => ResolvedSiteConfig,
  getBase: () => string = () => "/",
): MarkdownProcessor {
  const wrapped: MarkdownProcessor = {
    name: processor.name,
    options: processor.options,
    async createRenderer(shared) {
      const renderer = await processor.createRenderer(shared);
      return {
        async render(content, options) {
          if (!options?.fileURL || options.fileURL.protocol !== "file:") {
            return renderer.render(content, options);
          }

          const config = getConfig();
          const markdownPath = resolve(fileURLToPath(options.fileURL));
          if (!isWithin(config.content.docs, markdownPath)) {
            return renderer.render(content, options);
          }

          const locale = markdownPath.match(/\.(zh|en)\.md$/)?.[1];
          if (locale !== "zh" && locale !== "en") {
            return renderer.render(content, options);
          }

          return renderer.render(
            await prepareLegacyContent(
              content,
              markdownPath,
              config,
              locale,
              getBase(),
            ),
            options,
          );
        },
      };
    },
  };

  if (processor.createMdxRenderer) {
    wrapped.createMdxRenderer = processor.createMdxRenderer.bind(processor);
  }
  return wrapped;
}
