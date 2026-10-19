import { parse } from "es-module-lexer/js";
import { transform } from "sucrase";

/** Compile both initial previews and editor runs with the same JSX semantics. */
export function compileDemoSource(
  source: string,
  filePath: string,
  keepUnusedImports = false,
): { code: string; sourceExtension: "ts" | "tsx" } {
  // Plain TypeScript permits angle-bracket assertions, which conflict with JSX.
  if (!/\.[jt]sx$/i.test(filePath)) {
    try {
      return {
        code: transform(source, { transforms: ["typescript"], filePath, keepUnusedImports }).code,
        sourceExtension: "ts",
      };
    } catch {
      // Inline demos may contain JSX even when their synthetic path ends in .ts.
    }
  }
  const comments =
    source.match(/^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)\s*)*/)?.[0] ?? "";
  const jsxPragma = comments.match(/@jsx\s+([\w$.]+)/)?.[1];
  const jsxFragmentPragma = comments.match(/@jsxFrag\s+([\w$.]+)/)?.[1];
  const runtime = comments.match(/@jsxRuntime\s+(classic|automatic)\b/)?.[1];
  const { code } = transform(source, {
    transforms: ["typescript", "jsx"],
    jsxRuntime:
      runtime === "classic" || (!runtime && jsxPragma)
        ? "classic"
        : "automatic",
    jsxPragma,
    jsxFragmentPragma,
    production: true,
    keepUnusedImports,
    filePath,
  });
  return { code, sourceExtension: "tsx" };
}

/** Static module edges only; comments and strings are not dependencies. */
export function demoImports(source: string, path: string): string[] {
  const { code } = compileDemoSource(source, path, true);
  const [imports] = parse(code, path);
  return [...new Set(
    imports
      // Preserve string-literal-only dynamic imports, excluding template literals.
      .filter((item) => item.d < 0 || code[item.s] !== '`')
      .map((item) => item.n)
      .filter((name): name is string => name !== undefined),
  )];
}

export function demoImportPath(name: string, importer: string): string {
  return new URL(name, new URL(importer, 'https://demo.invalid')).pathname;
}

/** Keep source tabs, Markdown and exports on the same transitive file set. */
export function referencedDemoFiles(
  source: string, path: string, files: Record<string, string>, resolutions: Record<string, string>, requireFiles = false,
): Record<string, string> {
  const result: Record<string, string> = {};
  const visited = new Set([path.replace(/^\//, '')]);
  const visit = (code: string, importer: string) => {
    for (const name of demoImports(code, importer)) {
      if (!name.startsWith('.') && !name.startsWith('/')) continue;
      const file = resolutions[demoImportPath(name, importer)];
      if (file && visited.has(file)) continue;
      if (!file || files[file] === undefined) {
        if (requireFiles) throw new Error(`Save the ${name} dependency in the example source before exporting.`);
        continue;
      }
      visited.add(file);
      result[file] = files[file]!;
      if (/\.[cm]?[jt]sx?$/.test(file)) visit(files[file]!, `/${file}`);
    }
  };
  visit(source, path);
  return result;
}

/** Package imports used by an entry and its selected local modules. */
export function referencedDemoPackages(source: string, path: string, files: Record<string, string>): string[] {
  const packages = new Set<string>();
  const modules: [string, string][] = [[path, source], ...Object.entries(files)
    .filter(([name]) => /\.[cm]?[jt]sx?$/.test(name))];
  for (const [file, code] of modules) {
    for (const name of demoImports(code, file)) {
      if (name.startsWith('.') || name.startsWith('/') || name.includes(':')) continue;
      packages.add(name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]!);
    }
  }
  if (Object.keys(files).some((name) => name.endsWith('.less'))) packages.add('less');
  return [...packages];
}
/** Shared environment entry is independent of the editable example source. */
export function demoSetupPath(setup?: string): string | undefined {
  return setup ? demoImportPath(setup, '/index.ts') : undefined;
}

export function demoSetupSource(setup?: string): string {
  return setup ? `import ${JSON.stringify(setup)};` : '';
}

/** Keep a standalone export's environment sequencing identical to iframe runs. */
export function demoExportEntry(path: string, setup?: string, sourcePath = path): string {
  const filename = path.replace(/^\//, '');
  return `${setup ? `const { default: setup } = await import(${JSON.stringify(`.${setup}`)});\nawait setup({container: document.getElementById('container'), path: ${JSON.stringify(sourcePath)}});\n` : ''}await import(${JSON.stringify(`./${filename}`)});`;
}
