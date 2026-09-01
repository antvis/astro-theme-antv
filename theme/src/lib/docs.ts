import { getCollection } from 'astro:content';
import { config } from './site';

/**
 * Fetch the consumer's docs Content Collection using the configured collection
 * name (default "docs"). The theme never hard-codes the collection name so a
 * consumer that registers it under a different name only has to set
 * `content.collectionName` once in the site config.
 *
 * Entries marked as draft are always excluded; `includeHidden` keeps entries
 * hidden from the sidebar when building the docs navigation.
 */
export async function getDocsCollection(includeHidden = true) {
  return getCollection(config.content.collectionName, (entry) =>
    !entry.data.draft && (includeHidden || !entry.data.sidebar.hidden),
  );
}
