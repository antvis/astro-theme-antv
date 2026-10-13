import type { APIRoute, GetStaticPaths } from 'astro';
import {
  getAgentDocuments,
  serializeAgentDocument,
  serializeAgentExample,
} from '../../lib/agent-content';

import { config, registry } from '../../lib/site';

interface MarkdownDocumentProps {
  content: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const documents = await getAgentDocuments();
  const documentPaths = await Promise.all(
    documents.map(async (document) => ({
      params: {
        locale: document.locale,
        route: document.slug || 'index',
      },
      props: {
        content: await serializeAgentDocument(document, documents, true),
      } satisfies MarkdownDocumentProps,
    })),
  );
  return [
    ...documentPaths,
    ...config.site.locales.flatMap((locale) => registry.demos.map((demo) => ({
      params: { locale, route: `examples/${demo.key}` },
      props: { content: serializeAgentExample(demo, locale) } satisfies MarkdownDocumentProps,
    }))),
  ];
};

export const GET: APIRoute = ({ props }) =>
  new Response((props as MarkdownDocumentProps).content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
