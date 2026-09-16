import type { APIRoute } from 'astro';
import { localize } from '../../compiler/localization.js';
import {
  absoluteSiteUrl,
  currentSiteVersion,
  getAgentDocuments,
  getAgentDocumentSections,
  inlineText,
  markdownLinkText,
} from '../lib/agent-content';
import { config, registry } from '../lib/site';

export const GET: APIRoute = async () => {
  const documents = await getAgentDocuments();
  const sections = [
    `# ${markdownLinkText(config.site.title)}`,
    `> ${inlineText(localize(config.site.description, config.site.defaultLocale))}`,
    'Use the Markdown links below for machine-readable content; canonical page links are the authoritative human-facing URLs.',
    '## Agent resources',
    [
      `- [Full documentation](${absoluteSiteUrl('/llms-full.txt')}): Combined Markdown content for all published documents.`,
      `- [Canonical site](${absoluteSiteUrl(`/${config.site.defaultLocale}/`)})`,
      `- [Source repository](${config.site.repository})`,
      `- Languages: ${config.site.locales.join(', ')}`,
      ...(currentSiteVersion ? [`- Current version: ${currentSiteVersion}`] : []),
    ].join('\n'),
  ];

  for (const locale of config.site.locales) {
    sections.push(`## ${locale === 'zh' ? '中文文档' : 'English documentation'}`);
    for (const section of getAgentDocumentSections(documents, locale)) {
      sections.push(
        `### ${markdownLinkText(section.title)}`,
        section.documents
          .map((document) => {
            const description = inlineText(
              document.entry.data.description || document.entry.data.title,
            );
            const canonicalLabel = locale === 'zh' ? '页面' : 'Canonical page';
            return `- [${markdownLinkText(document.entry.data.title)}](${absoluteSiteUrl(document.markdownRoute)}): ${description} — [${canonicalLabel}](${absoluteSiteUrl(document.route)})`;
          })
          .join('\n'),
      );
    }
  }

  if (registry.demos.length > 0) {
    for (const locale of config.site.locales) {
      const description = locale === 'zh'
        ? '可运行示例及其源码。'
        : 'Runnable example with its source code.';
      sections.push(
        `## ${locale === 'zh' ? '中文示例' : 'English examples'}`,
        [...registry.demos]
          .sort((left, right) => left.key.localeCompare(right.key))
          .map((demo) =>
            `- [${markdownLinkText(localize(demo.title, locale, demo.slug))}](${absoluteSiteUrl(`/${locale}/examples/${demo.key}/`)}): ${description}`,
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
