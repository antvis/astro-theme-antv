import type { CollectionEntry } from 'astro:content';
import { posix } from 'node:path';
import { getAntvDocIdentity, localize } from './compiler';
import { getDocsCollection } from './docs';
import { withBase } from './paths';
import { config } from './site';

type SiteLocale = 'zh' | 'en';

export interface AgentDocument {
  entry: CollectionEntry<'docs'>;
  locale: SiteLocale;
  slug: string;
  section: string;
  sectionTitle: string;
  sectionOrder: number;
  route: string;
  markdownRoute: string;
}

export interface AgentDocumentSection {
  title: string;
  documents: AgentDocument[];
}

export const currentSiteVersion = Object.keys(config.versions)[0];

export const inlineText = (value: string) => value.replace(/\s+/g, ' ').trim();

export const markdownLinkText = (value: string) =>
  inlineText(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');

export const absoluteSiteUrl = (route: string) =>
  new URL(withBase(route), config.site.origin).href;

const markdownRouteFor = (locale: SiteLocale, slug: string) =>
  `/markdown/${locale}/${slug || 'index'}.md`;

export async function getAgentDocuments(): Promise<AgentDocument[]> {
  const localeOrder = new Map(
    config.site.locales.map((locale, index) => [locale, index]),
  );
  const documents = (await getDocsCollection(false)).flatMap<AgentDocument>((entry) => {
    const identity = getAntvDocIdentity(entry.id);
    if (!config.site.locales.includes(identity.locale)) return [];
    const configuredSection = config.content.sidebar[identity.section];
    return [{
      entry,
      ...identity,
      sectionTitle: localize(
        configuredSection,
        identity.locale,
        identity.section || (identity.locale === 'zh' ? '概览' : 'Overview'),
      ),
      sectionOrder: configuredSection?.order ?? Number.POSITIVE_INFINITY,
      markdownRoute: markdownRouteFor(identity.locale, identity.slug),
    }];
  });

  return documents.sort(
    (left, right) =>
      (localeOrder.get(left.locale) ?? Number.POSITIVE_INFINITY) -
        (localeOrder.get(right.locale) ?? Number.POSITIVE_INFINITY) ||
      left.sectionOrder - right.sectionOrder ||
      left.section.localeCompare(right.section) ||
      left.entry.data.order - right.entry.data.order ||
      left.slug.localeCompare(right.slug),
  );
}

export function getAgentDocumentSections(
  documents: AgentDocument[],
  locale: SiteLocale,
): AgentDocumentSection[] {
  const sections = new Map<string, AgentDocumentSection>();
  for (const document of documents) {
    if (document.locale !== locale) continue;
    const section = sections.get(document.section);
    if (section) section.documents.push(document);
    else {
      sections.set(document.section, {
        title: document.sectionTitle,
        documents: [document],
      });
    }
  }
  return [...sections.values()];
}

const rewriteLocalizedDocumentLinks = (
  body: string,
  document: AgentDocument,
  documentsByFilePath: Map<string, AgentDocument>,
) => {
  if (!document.entry.filePath) return body;
  const sourcePath = document.entry.filePath.replaceAll('\\', '/');
  return body.replace(
    /\]\(((?:\.\.?\/)[^)\s]+?)\.(zh|en)\.(mdx|md)([?#][^)\s]+)?\)/g,
    (match, reference, locale, extension, suffix = '') => {
      const targetPath = posix.normalize(
        posix.join(
          posix.dirname(sourcePath),
          `${reference}.${locale}.${extension}`,
        ),
      );
      const target = documentsByFilePath.get(targetPath);
      return target
        ? `](${absoluteSiteUrl(target.markdownRoute)}${suffix})`
        : match;
    },
  );
};

const filePathIndexes = new WeakMap<
  AgentDocument[],
  Map<string, AgentDocument>
>();

const indexAgentDocumentsByFilePath = (documents: AgentDocument[]) => {
  const cached = filePathIndexes.get(documents);
  if (cached) return cached;
  const index = new Map(
    documents.flatMap((candidate) =>
      candidate.entry.filePath
        ? [[candidate.entry.filePath.replaceAll('\\', '/'), candidate] as const]
        : [],
    ),
  );
  filePathIndexes.set(documents, index);
  return index;
};

export function serializeAgentDocument(
  document: AgentDocument,
  documents: AgentDocument[],
): string {
  const metadata = [
    `title: ${JSON.stringify(document.entry.data.title)}`,
    `description: ${JSON.stringify(document.entry.data.description || document.entry.data.title)}`,
    `language: ${JSON.stringify(document.locale)}`,
    `canonical: ${JSON.stringify(absoluteSiteUrl(document.route))}`,
    ...(currentSiteVersion
      ? [`version: ${JSON.stringify(currentSiteVersion)}`]
      : []),
  ];
  const body = rewriteLocalizedDocumentLinks(
    document.entry.body.trim(),
    document,
    indexAgentDocumentsByFilePath(documents),
  );
  return ['---', ...metadata, '---', '', body, ''].join('\n');
}
