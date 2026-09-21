import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { config } from './site';

function findVersion(directory: string, name: string): string | undefined {
  while (true) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name === name) return pkg.version;
    }
    const parent = dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

// Read manifests directly: Vite aliases and import-only exports need not resolve in Node.
const require = createRequire(join(config.root, 'package.json'));
export const demoDependencies: Record<string, string> = {};
for (const name of Object.keys(config.demo.dependencies)) {
  if (name.startsWith('.') || name.startsWith('/') || name.includes(':')) continue;
  const packageName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]!;
  if (demoDependencies[packageName]) continue;
  // A monorepo's own package may be provided through a Vite alias.
  const version = findVersion(config.root, packageName)
    ?? require.resolve.paths(packageName)?.reduce<string | undefined>((version, directory) => {
      const manifest = join(directory, packageName, 'package.json');
      return version ?? (existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).version : undefined);
    }, undefined);
  if (version) demoDependencies[packageName] = version;
}
