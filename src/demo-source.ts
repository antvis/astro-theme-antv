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
  source: string, path: string, files: Record<string, string>, resolutions: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const visited = new Set([path.replace(/^\//, '')]);
  const visit = (code: string, importer: string) => {
    for (const name of demoImports(code, importer)) {
      if (!name.startsWith('.') && !name.startsWith('/')) continue;
      const file = resolutions[demoImportPath(name, importer)];
      if (!file || visited.has(file) || files[file] === undefined) continue;
      visited.add(file);
      result[file] = files[file]!;
      if (/\.[cm]?[jt]sx?$/.test(file)) visit(files[file]!, `/${file}`);
    }
  };
  visit(source, path);
  return result;
}
