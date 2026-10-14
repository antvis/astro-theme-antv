import type { CollectionEntry } from 'astro:content';
import { posix, resolve, relative, extname } from 'node:path';
import { pathKey } from '../../util.js';
import { getAntvDocIdentity } from '../../content.js';
import { localize } from '../../compiler/localization.js';
import { getDocsCollection } from './docs';
import { markdownRouteFor, withBase } from './paths';
import { config } from './site';
import type { DemoRecord } from '../../compiler/content.js';
import { filesForDemo } from './demo-dependencies';
import { fencedCode, serializeAgentMarkdown } from '../../agent-markdown.js';

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

export async function getAgentDocuments(): Promise<AgentDocument[]> {
  const localeOrder = new Map(
    config.site.locales.map((locale, index) => [locale, index]),
  );
  const documents = (await getDocsCollection()).flatMap<AgentDocument>((entry) => {
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

export async function serializeAgentDocument(
  document: AgentDocument,
  documents: AgentDocument[],
  includeNavigation = false,
): Promise<string> {
  const metadata = [
    `title: ${JSON.stringify(document.entry.data.title)}`,
    `description: ${JSON.stringify(document.entry.data.description || document.entry.data.title)}`,
    `language: ${JSON.stringify(document.locale)}`,
    `canonical: ${JSON.stringify(absoluteSiteUrl(document.route))}`,
    ...(currentSiteVersion
      ? [`version: ${JSON.stringify(currentSiteVersion)}`]
      : []),
  ];
  const attached: Record<string, string> = {};
  const body = await serializeAgentMarkdown((document.entry.body ?? '').trim(), {
    filePath: document.entry.filePath ?? '',
    canonical: absoluteSiteUrl(document.route),
    components: config.content.agentComponents,
    renderCode: ({ name, code, src }) => {
      const rule = config.content.agentComponents[name];
      if (name === 'Demo') {
        const file = src ? resolve(config.content.docs, extname(src) ? src : `${src}.ts`)
          : resolve(config.root, document.entry.filePath ?? 'inline-demo.ts');
        Object.assign(attached, filesForDemo(code, `/${pathKey(relative(config.root, file))}`));
      }
      return `\n\n${fencedCode(code, rule?.type === 'code' ? rule.language : 'ts')}\n\n`;
    },
    resolveDocument: (source) => {
      if (!document.entry.filePath) return undefined;
      const match = source.match(/^((?:\.\.?\/)[^?#]+\.(?:zh|en)\.mdx?)([?#].*)?$/);
      if (!match) return undefined;
      const target = indexAgentDocumentsByFilePath(documents).get(
        posix.normalize(
          posix.join(
            posix.dirname(document.entry.filePath.replaceAll('\\', '/')),
            match[1],
          ),
        ),
      );
      return target
        ? {
            title: target.entry.data.title,
            href: absoluteSiteUrl(target.markdownRoute) + (match[2] ?? ''),
          }
        : undefined;
    },
  });
  const sharedSources = Object.entries(attached)
    .map(([name, code]) => `### ${name}\n\n${fencedCode(code, name.split('.').pop())}`);
  return ['---', ...metadata, '---', '',
    ...(includeNavigation ? [agentIndexLink(document.locale), ''] : []),
    body, ...sharedSources, ''].join('\n');
}

function agentIndexLink(locale: SiteLocale) {
  const zh = locale === 'zh';
  return `[${zh ? '资料索引' : 'Resource index'}](${withBase('/llms.txt')})`;
}

/** Export the same source and supporting files as the runnable example. */
export function serializeAgentExample(demo: DemoRecord, locale: SiteLocale): string {
  const title = localize(demo.title, locale, demo.slug);
  const isZh = locale === 'zh';
  const canonical = absoluteSiteUrl(`/${locale}/examples/${demo.key}/`);
  return [
    '---',
    `title: ${JSON.stringify(title)}`,
    `language: ${JSON.stringify(locale)}`,
    `canonical: ${JSON.stringify(canonical)}`,
    ...(currentSiteVersion ? [`version: ${JSON.stringify(currentSiteVersion)}`] : []),
    '---',
    '',
    `# ${markdownLinkText(title)}`,
    '',
    `[${isZh ? '运行示例' : 'Live example'}](${canonical})`,
    '',
    agentIndexLink(locale),
    '',
    isZh ? '页面需要一个 `id="container"` 的 DOM 元素。以下为原始示例源码。' : 'Provide a DOM element with `id="container"`. The original example source follows.',
    '',
    `## ${isZh ? '源码' : 'Source'}`,
    '',
    fencedCode(demo.source, demo.filename.split('.').pop()),
    '',
    ...Object.entries(filesForDemo(demo.source, `/${demo.relativeSourcePath}`)).flatMap(([name, source]) => [
      `## ${markdownLinkText(name)}`, '', fencedCode(source, name.split('.').pop()), '',
    ]),
  ].join('\n');
}
