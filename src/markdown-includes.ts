import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseMatter } from './compiler/content.js';
import { assertRealpathWithin, assertWithin } from './util.js';

/** Expand Markdown fragments without creating duplicate public documentation pages. */
export async function expandMarkdownIncludes(
  markdown: string,
  file: string,
  root: string,
  ancestors: string[] = [],
): Promise<string> {
  if (!markdown.includes('<!-- include:')) return markdown;
  root = await realpath(root);
  const path = await realpath(resolve(file));
  if (ancestors.includes(path)) throw new Error(`Circular Markdown include: ${[...ancestors, path].join(' -> ')}`);
  const output: string[] = [];
  let fence: { character: string; length: number } | undefined;
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { character: marker[1]![0]!, length: marker[1]!.length };
      else if (marker[1]![0] === fence.character && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
      output.push(line);
      continue;
    }
    const include = !fence && line.match(/^<!-- include: (\.[^\r\n]+\.md) -->$/);
    if (!include) { output.push(line); continue; }
    const target = resolve(dirname(path), include[1]!);
    assertWithin(root, target);
    await assertRealpathWithin(root, target);
    const { content } = parseMatter(await readFile(target, 'utf8'), target);
    output.push(await expandMarkdownIncludes(content, target, root, [...ancestors, path]));
  }
  return output.join('\n');
}
