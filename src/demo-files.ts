import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import type { SiteRegistry } from './compiler/content.js';
import { serializeAgentMarkdown } from './agent-markdown.js';
import { demoImports, demoImportPath } from './demo-source.js';
import { assertWithin, assertRealpathWithin, pathKey } from './util.js';

export interface DemoFiles {
  packages: string[];
  files: Record<string, string>;
  resolutions: Record<string, string>;
}

/** Collect only modules reachable from runnable examples, never unrelated source files. */
export async function collectDemoFiles(registry: SiteRegistry): Promise<DemoFiles> {
  const { config } = registry;
  const files: Record<string, string> = {};
  const resolutions: Record<string, string> = {};
  const visited = new Set<string>();
  const packages = new Set<string>();
  const key = (file: string) => pathKey(relative(config.root, file));
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.json', '.css', '.less'];
  const resolveFile = async (target: string, importer: string) => {
    assertWithin(config.root, target);
    const candidates = [target, ...extensions.map((extension) => target + extension),
      ...extensions.map((extension) => resolve(target, `index${extension}`))];
    if (target.endsWith('.js')) candidates.push(target.slice(0, -3) + '.ts', target.slice(0, -3) + '.tsx');
    for (const candidate of candidates) {
      if (!(await stat(candidate).catch(() => undefined))?.isFile()) continue;
      await assertRealpathWithin(config.root, candidate);
      if (!extensions.includes(extname(candidate))) {
        throw new Error(`Unsupported local demo module ${candidate} imported by ${importer}; use JS, TS, JSON, CSS or Less.`);
      }
      return candidate;
    }
    throw new Error(`Unable to resolve local demo dependency ${target} imported by ${importer}`);
  };
  const visit = async (source: string, importer: string) => {
    for (const name of demoImports(source, importer)) {
      const configured = config.demo.dependencies[name];
      if (!name.startsWith('.') && !name.startsWith('/')) {
        if (!name.includes(':')) packages.add(name);
        continue;
      }
      if (configured && !configured.startsWith('.')) continue;
      const target = configured?.startsWith('.') ? resolve(config.root, configured)
        : name.startsWith('/') ? resolve(config.root, `.${name}`) : resolve(dirname(importer), name);
      const file = await resolveFile(target, importer);
      const filename = key(file);
      resolutions[demoImportPath(name, `/${key(importer)}`)] = filename;
      files[filename] ??= await readFile(file, 'utf8');
      if (visited.has(file)) continue;
      visited.add(file);
      if (/\.[cm]?[jt]sx?$/.test(file)) await visit(files[filename]!, file);
    }
  };
  for (const demo of registry.demos) await visit(demo.source, demo.sourcePath);
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.mdx?$/.test(file)) {
        await serializeAgentMarkdown(await readFile(file, 'utf8'), {
          filePath: file, canonical: config.site.origin, components: config.content.agentComponents,
          renderCode: async ({ name, code, src }) => {
            if (name !== 'Demo') return '';
            // DocumentDemo resolves src beneath docs; inline code has the document as its base.
            const importer = src ? resolve(config.content.docs, extname(src) ? src : `${src}.ts`) : file;
            await visit(code, importer);
            return '';
          },
        });
      }
    }
  };
  await walk(config.content.docs);
  return { files, resolutions, packages: [...packages].sort() };
}
