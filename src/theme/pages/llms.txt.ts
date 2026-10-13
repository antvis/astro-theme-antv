import type { APIRoute } from 'astro';
import { localize } from '../../compiler/localization.js';
import {
  currentSiteVersion,
  getAgentDocuments,
  getAgentDocumentSections,
  inlineText,
  markdownLinkText,
} from '../lib/agent-content';
import { markdownRouteFor, withBase } from '../lib/paths';
import { config, registry } from '../lib/site';

export const GET: APIRoute = async () => {
  const documents = await getAgentDocuments();
  const { locales } = config.llms;
  const primaryLocale = locales[0]!;
  const sections = [
    `# ${markdownLinkText(config.site.title)}`,
    `> ${inlineText(localize(config.site.description, primaryLocale))}`,
    'Find relevant documents and examples under your language below, then read their Markdown links for content and source code.',
    '## Agent resources',
    [
      `- [Full documentation](${withBase('/llms-full.txt')}): Combined Markdown content for all published documents.`,
      `- [Site](${withBase(`/${primaryLocale}/`)})`,
      `- [Source repository](${config.site.repository})`,
      `- Languages: ${locales.join(', ')}`,
      ...(currentSiteVersion ? [`- Current version: ${currentSiteVersion}`] : []),
    ].join('\n'),
  ];

  for (const locale of locales) {
    sections.push(`## ${locale === 'zh' ? '中文文档' : 'English documentation'}`);
    for (const section of getAgentDocumentSections(documents, locale)) {
      sections.push(
        `### ${markdownLinkText(section.title)}`,
        section.documents
          .map((document) => {
            const description = inlineText(
              document.entry.data.description || '',
            );
            const summary = description && description !== inlineText(document.entry.data.title)
              ? `: ${description}` : '';
            return `- [${markdownLinkText(document.entry.data.title)}](${withBase(document.markdownRoute)})${summary}`;
          })
          .join('\n'),
      );
    }
    if (registry.demos.length > 0) {
      sections.push(
        `## ${locale === 'zh' ? '中文示例' : 'English examples'}`,
        [...registry.demos]
          .sort((left, right) => left.key.localeCompare(right.key))
          .map((demo) =>
            `- [${markdownLinkText(localize(demo.title, locale, demo.slug))}](${withBase(markdownRouteFor(locale, `examples/${demo.key}`))})`,
          )
          .join('\n'),
      );
    }
  }

  return new Response(`${sections.join('\n\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
