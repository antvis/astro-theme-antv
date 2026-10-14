import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { config, registry } from './site';
import { referencedDemoFiles } from '../../demo-source.js';

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
const demoFiles = registry.demoFiles?.files ?? {};
const demoResolutions = registry.demoFiles?.resolutions ?? {};

// Export the physical module tree and let Vite preserve configured root aliases.
const aliases = Object.keys(config.demo.dependencies).filter((name) =>
  name.startsWith('/') && demoResolutions[name],
).map((name) => `{find:${JSON.stringify(name)},replacement:fileURLToPath(new URL(${JSON.stringify(`./${demoResolutions[name]}`)},import.meta.url))}`);
export const demoExportConfig = aliases.length
  ? `import {fileURLToPath} from "node:url";export default {resolve:{alias:[${aliases.join(',')}]}};` : undefined;
const dependencies = {
  ...Object.fromEntries((registry.demoFiles?.packages ?? []).map((name) => [name, name])),
  ...config.demo.dependencies,
};
for (const name of Object.keys(dependencies)) {
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
// Exported Vite projects must compile the same Less source as the local preview.
if (Object.keys(demoFiles).some((name) => name.endsWith('.less'))) {
  const version = findVersion(dirname(require.resolve('less')), 'less');
  if (version) demoDependencies.less = version;
}

// Gallery navigation keeps file tabs and export inputs mounted across examples.
// Include its shared files, without attaching document-only controls to every gallery page.
export const filesForDemo = (source: string, path: string) =>
  referencedDemoFiles(source, path, demoFiles, demoResolutions);

export const galleryFiles = Object.assign({}, ...registry.demos.map((demo) =>
  filesForDemo(demo.source, `/${demo.relativeSourcePath}`),
)) as Record<string, string>;
