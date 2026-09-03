import type { APIRoute } from 'astro';
import { localize } from '../lib/compiler';
import {
  absoluteSiteUrl,
  currentSiteVersion,
  getAgentDocuments,
  getAgentDocumentSections,
  inlineText,
  markdownLinkText,
  serializeAgentDocument,
} from '../lib/agent-content';
import { config, registry } from '../lib/site';

const fencedSource = (source: string, filename: string) => {
  const longestFence = Math.max(
    2,
    ...[...source.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = '`'.repeat(longestFence + 1);
  const language = filename.split('.').pop() || 'text';
  return `${fence}${language}\n${source.trim()}\n${fence}`;
};

export const GET: APIRoute = async () => {
  const documents = await getAgentDocuments();
  const parts = [
    `# ${markdownLinkText(config.site.title)} — Full Documentation`,
    `> ${inlineText(localize(config.site.description, config.site.defaultLocale))}`,
    [
      `- Canonical site: ${absoluteSiteUrl(`/${config.site.defaultLocale}/`)}`,
      `- Source repository: ${config.site.repository}`,
      `- Languages: ${config.site.locales.join(', ')}`,
      ...(currentSiteVersion ? [`- Current version: ${currentSiteVersion}`] : []),
    ].join('\n'),
  ];

  for (const locale of config.site.locales) {
    parts.push(`## ${locale === 'zh' ? '中文文档' : 'English documentation'}`);
    for (const section of getAgentDocumentSections(documents, locale)) {
      parts.push(`### ${markdownLinkText(section.title)}`);
      for (const document of section.documents) {
        parts.push(
          `#### ${markdownLinkText(document.entry.data.title)}`,
          [
            `- Canonical page: ${absoluteSiteUrl(document.route)}`,
            `- Markdown source: ${absoluteSiteUrl(document.markdownRoute)}`,
            `- Description: ${inlineText(document.entry.data.description || document.entry.data.title)}`,
          ].join('\n'),
          serializeAgentDocument(document, documents),
        );
      }
    }
  }

  if (registry.demos.length > 0) {
    parts.push('## Examples');
    for (const demo of [...registry.demos].sort((left, right) =>
      left.key.localeCompare(right.key),
    )) {
      parts.push(
        `### ${markdownLinkText(localize(demo.title, config.site.defaultLocale, demo.slug))}`,
        [
          ...config.site.locales.map((locale) =>
            `- ${locale} page: ${absoluteSiteUrl(`/${locale}/examples/${demo.key}/`)}`,
          ),
          `- Source path: ${demo.relativeSourcePath}`,
        ].join('\n'),
        fencedSource(demo.source, demo.filename),
      );
    }
  }

  return new Response(`${parts.join('\n\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
