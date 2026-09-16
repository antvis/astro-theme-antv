import { relative, resolve } from 'node:path';
import type { CollectionEntry } from 'astro:content';
import type { ResolvedSiteConfig } from '../../compiler/config.js';
import { getAntvDocIdentity } from '../../content.js';
import { isWithin, pathKey } from '../../util.js';

export interface DocumentPage {
  type: 'document';
  locale: 'zh' | 'en';
  route: string;
  slug: string;
  section: string;
  title: string;
  description: string;
  order: number;
  sourcePath?: string;
  entry: CollectionEntry<'docs'>;
}

const sourcePathFor = (
  entry: CollectionEntry<'docs'>,
  config: ResolvedSiteConfig,
) => {
  if (!entry.filePath) return undefined;
  const sourcePath = resolve(config.root, entry.filePath);
  if (!isWithin(config.content.docs, sourcePath)) {
    throw new Error(
      `Document entry escaped the configured docs root: ${entry.filePath}`,
    );
  }
  return pathKey(relative(config.content.docs, sourcePath));
};

export const toDocumentPage = (
  entry: CollectionEntry<'docs'>,
  config: ResolvedSiteConfig,
): DocumentPage => {
  const identity = getAntvDocIdentity(entry.id);
  return {
    type: 'document',
    ...identity,
    title: entry.data.title,
    description: entry.data.description || entry.data.title,
    order: entry.data.order,
    sourcePath: sourcePathFor(entry, config),
    entry,
  };
};
