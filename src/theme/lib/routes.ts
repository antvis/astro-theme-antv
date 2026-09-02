import { getAntvDocIdentity } from '../../content.js';
import { getDocsCollection } from './docs';
import { config, registry } from './site';

// The set of generated routes (Registry pages + every localized document) is
// identical across all page renders within a build. Computing it once per
// render duplicates the full document→identity walk per page, so it is cached
// here for the lifetime of the build process.
let generatedRoutesCache: Set<string> | undefined;

export async function getGeneratedRoutes(): Promise<Set<string>> {
  if (generatedRoutesCache) return generatedRoutesCache;
  const documents = (await getDocsCollection()).filter((entry) =>
    config.site.locales.includes(getAntvDocIdentity(entry.id).locale),
  );
  generatedRoutesCache = new Set<string>([
    ...registry.pages.map((page) => page.route),
    ...documents.map((entry) => getAntvDocIdentity(entry.id).route),
  ]);
  return generatedRoutesCache;
}
