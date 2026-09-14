import type { APIRoute } from 'astro';
import { getDocsCollection } from '../../lib/docs';
import { getAntvDocIdentity, localize } from '../../lib/compiler';
import { withBase } from '../../lib/paths';
import { config, registry } from '../../lib/site';

interface DevelopmentSearchRecord {
  url: string;
  title: string;
  content: string;
  language: 'zh' | 'en';
}

export const prerender = false;

export const GET: APIRoute = async () => {
  const documents = await getDocsCollection();
  const documentRecords = documents.flatMap<DevelopmentSearchRecord>((entry) => {
    const identity = getAntvDocIdentity(entry.id);
    if (!config.site.locales.includes(identity.locale)) return [];
    return [{
      url: withBase(identity.route),
      title: entry.data.title,
      content: [entry.data.title, entry.data.description, entry.body]
        .filter(Boolean)
        .join('\n'),
      language: identity.locale,
    }];
  });
  const demoRecords = config.site.locales.flatMap<DevelopmentSearchRecord>(
    (locale) => registry.demos.map((demo) => ({
      url: withBase(`/${locale}/examples/${demo.key}/`),
      title: localize(demo.title, locale, demo.slug),
      content: [localize(demo.title, locale, demo.slug), demo.source].join('\n'),
      language: locale,
    })),
  );

  return Response.json([...documentRecords, ...demoRecords], {
    headers: { 'Cache-Control': 'no-store' },
  });
};
