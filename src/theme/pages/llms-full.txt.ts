import type { APIRoute } from 'astro';
import { localize } from '../../compiler/localization.js';
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
import { demoFiles } from '../lib/demo-dependencies';
import { withBase } from '../lib/paths';
import { fencedCode } from '../../agent-markdown.js';

export const GET: APIRoute = async () => {
  const documents = await getAgentDocuments();
  const { locales } = config.llms;
  const primaryLocale = locales[0]!;
  const parts = [
    `# ${markdownLinkText(config.site.title)} — Full Documentation`,
    `> ${inlineText(localize(config.site.description, primaryLocale))}`,
    [
      `- [Resource index](${withBase('/llms.txt')})`,
      `- Canonical site: ${absoluteSiteUrl(`/${primaryLocale}/`)}`,
      `- Source repository: ${config.site.repository}`,
      `- Languages: ${locales.join(', ')}`,
      ...(currentSiteVersion ? [`- Current version: ${currentSiteVersion}`] : []),
    ].join('\n'),
  ];

  for (const locale of locales) {
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
          await serializeAgentDocument(document, documents),
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
        `### ${markdownLinkText(localize(demo.title, primaryLocale, demo.slug))}`,
        [
          ...locales.map((locale) =>
            `- ${locale} page: ${absoluteSiteUrl(`/${locale}/examples/${demo.key}/`)}`,
          ),
          `- Source path: ${demo.relativeSourcePath}`,
        ].join('\n'),
        fencedCode(demo.source, demo.filename.split('.').pop() || 'text'),
        ...Object.entries(demoFiles).filter(([name]) => demo.source.includes(`/${name}`))
          .map(([name, code]) => `### ${name}\n\n${fencedCode(code, name.split('.').pop())}`),
      );
    }
  }

  return new Response(`${parts.join('\n\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
