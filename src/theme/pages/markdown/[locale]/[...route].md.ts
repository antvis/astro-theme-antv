import type { APIRoute, GetStaticPaths } from 'astro';
import {
  getAgentDocuments,
  serializeAgentDocument,
} from '../../../lib/agent-content';

interface MarkdownDocumentProps {
  content: string;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const documents = await getAgentDocuments();
  return Promise.all(
    documents.map(async (document) => ({
      params: {
        locale: document.locale,
        route: document.slug || 'index',
      },
      props: {
        content: await serializeAgentDocument(document, documents),
      } satisfies MarkdownDocumentProps,
    })),
  );
};

export const GET: APIRoute = ({ props }) =>
  new Response((props as MarkdownDocumentProps).content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
