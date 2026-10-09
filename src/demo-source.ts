import { transform } from "sucrase";

/** Compile both initial previews and editor runs with the same JSX semantics. */
export function compileDemoSource(
  source: string,
  filePath: string,
): { code: string; sourceExtension: "ts" | "tsx" } {
  // Plain TypeScript permits angle-bracket assertions, which conflict with JSX.
  if (!/\.[jt]sx$/i.test(filePath)) {
    try {
      return {
        code: transform(source, { transforms: ["typescript"], filePath }).code,
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
    filePath,
  });
  return { code, sourceExtension: "tsx" };
}
