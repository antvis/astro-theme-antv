import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { config } from './site';
import { toDocumentPage } from './documents';

type DocsCollectionEntry = CollectionEntry<'docs'>;

/**
 * Fetch the consumer's docs Content Collection using the configured collection
 * name (default "docs"). The theme never hard-codes the collection name so a
 * consumer that registers it under a different name only has to set
 * `content.collectionName` once in the site config.
 *
 * Only drafts are excluded. Sidebar visibility is handled by the navigation.
 */
export async function getDocsCollection(): Promise<DocsCollectionEntry[]> {
  const entries = await getCollection(config.content.collectionName) as DocsCollectionEntry[];
  return entries.filter((entry) => !entry.data.draft);
}

/** Shared by detail sidebars and their static, per-section directory. */
export async function getDocumentItems() {
  return (await getDocsCollection())
    .filter((entry) => !entry.data.sidebar.hidden)
    .map((entry) => toDocumentPage(entry, config))
    .map((item) => ({
      ...item,
      title: item.entry.data.sidebar.label || item.title,
      icon: item.entry.data.sidebar.icon,
    }))
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
