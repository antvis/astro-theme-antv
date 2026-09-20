import { parse, type Node } from 'acorn';
import { transform } from 'sucrase';

/** Compile and load dependencies in the iframe's own JavaScript realm. */
export async function runDemo(source: string, path: string, dependencies: Record<string, () => Promise<unknown>>) {
  const code = transform(source, { transforms: ['typescript'], filePath: path }).code;
  const tree = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const imports = new Set<string>();
  const visit = (node: Node) => {
    const value = node as Node & Record<string, any>;
    if (['ImportDeclaration', 'ImportExpression', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && value.source) {
      if (value.source.type !== 'Literal' || typeof value.source.value !== 'string') {
        throw new Error('Demo imports must use literal module names.');
      }
      imports.add(value.source.value);
    }
    for (const child of Object.values(value).flat()) {
      if (child && typeof child === 'object' && typeof child.type === 'string') visit(child);
    }
  };
  visit(tree);
  const modules = new Map<string, unknown>();
  await Promise.all([...imports].map(async (name) => {
    const key = name.startsWith('.')
      ? new URL(name, `https://demo.invalid${path}`).pathname.replace(/\.ts$/, '') : name;
    const load = Object.hasOwn(dependencies, key) ? dependencies[key] : undefined;
    if (!load) throw new Error(`Unsupported demo import: ${name}`);
    modules.set(name, { ...((await load()) as object), __esModule: true });
  }));
  const require = (name: string) => {
    if (!modules.has(name)) throw new Error(`Unsupported demo import: ${name}`);
    return modules.get(name);
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('require', 'exports', 'module',
    `${transform(code, { transforms: ['imports'], filePath: path }).code}\n//# sourceURL=antv-demo.ts`);
  const module = { exports: {} };
  await execute(require, module.exports, module);
}
