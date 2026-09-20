import { createProcessor } from "@mdx-js/mdx";
import { parseExpressionAt } from "acorn";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { AgentComponent } from "./compiler/config.js";
import { assertWithin, assertRealpathWithin } from "./util.js";

const processor = createProcessor();
const markdownProcessor = createProcessor({ format: "md" });
type Node = ReturnType<typeof processor.parse>;
type Child = Node["children"][number];
type Jsx = Extract<Child, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;

export function fencedCode(source: string, language = "text"): string {
  const length =
    Math.max(2, ...[...source.matchAll(/`+/g)].map((m) => m[0].length)) + 1;
  const fence = "`".repeat(length);
  return `${fence}${language}\n${source}${
    source.endsWith("\n") ? "" : "\n"
  }${fence}`;
}

interface Options {
  filePath: string;
  canonical: string;
  components: Record<string, AgentComponent>;
  renderCode?: (component: { name: string; code: string; src?: string }) => string | Promise<string>;
  resolveDocument?: (
    source: string
  ) => { title: string; href: string } | undefined;
}

const escapeLabel = (text: string) =>
  text.replace(/[\\[\]]/g, "\\$&").replace(/\s+/g, " ");
const link = (text: string, href: string) =>
  `[${escapeLabel(text)}](<${href
    .replaceAll(">", "%3E")
    .replaceAll("<", "%3C")
    .replace(/\s/g, (c) => encodeURIComponent(c))}>)`;

/** Convert MDX syntax without evaluating imports, expressions or component code. */
export async function serializeAgentMarkdown(
  body: string,
  options: Options
): Promise<string> {
  const tree = (
    options.filePath.endsWith(".mdx") ? processor : markdownProcessor
  ).parse(body);
  const imports = new Map<string, { source: string; name?: string }>();
  for (const node of tree.children) {
    if (node.type !== "mdxjsEsm") continue;
    for (const statement of node.data?.estree?.body ?? []) {
      if (
        statement.type !== "ImportDeclaration" ||
        typeof statement.source.value !== "string"
      )
        continue;
      for (const specifier of statement.specifiers) {
        imports.set(specifier.local.name, {
          source: statement.source.value,
          name: specifier.type === 'ImportSpecifier'
            ? specifier.imported.type === 'Identifier' ? specifier.imported.name : String(specifier.imported.value)
            : undefined,
        });
      }
    }
  }
  const fail = (message: string): never => {
    throw new Error(`${options.filePath}: ${message}`);
  };
  const staticAttribute = (node: Jsx, name: string): string | undefined => {
    const attribute = node.attributes.find(
      (value) => value.type === "mdxJsxAttribute" && value.name === name
    );
    if (!attribute || attribute.type !== "mdxJsxAttribute") return undefined;
    if (typeof attribute.value === "string") return attribute.value;
    const statement = attribute.value?.data?.estree?.body[0];
    if (statement?.type === "ExpressionStatement") {
      // MDX removes indentation in multiline JSX attributes. Parse the
      // original expression to preserve source whitespace without evaluation.
      const expression = parseExpressionAt(
        body,
        statement.expression.range?.[0] ??
          fail(`${node.name}.${name} has no source position.`),
        { ecmaVersion: "latest" }
      );
      if (
        expression.type === "Literal" &&
        typeof expression.value === "string"
      )
        return expression.value;
      if (
        expression.type === "TemplateLiteral" &&
        expression.expressions.length === 0
      ) {
        return (
          expression.quasis[0]?.value.cooked ??
          fail(`${node.name}.${name} has an invalid escape.`)
        );
      }
    }
    return fail(
      `${node.name}.${name} must be a static string for Markdown export.`
    );
  };
  const start = (node: Child | Node) => node.position!.start.offset!;
  const end = (node: Child | Node) => node.position!.end.offset!;
  const inner = async (children: Child[], from: number, to: number) => {
    const parts: string[] = [];
    let cursor = from;
    for (const child of children) {
      parts.push(body.slice(cursor, start(child)), await render(child));
      cursor = end(child);
    }
    parts.push(body.slice(cursor, to));
    return parts.join("");
  };
  const renderChildren = (children: Child[]) =>
    children.length
      ? inner(children, start(children[0]!), end(children.at(-1)!))
      : "";
  const render = async (node: Child | Node): Promise<string> => {
    if (node.type === "link") {
      const target = options.resolveDocument?.(node.url);
      if (target) {
        const label = await renderChildren(node.children as Child[]);
        return `[${label}](<${target.href}>${
          node.title ? ` ${JSON.stringify(node.title)}` : ""
        })`;
      }
    }
    if (node.type === "mdxjsEsm") return "";
    if (
      node.type === "mdxFlowExpression" ||
      node.type === "mdxTextExpression"
    ) {
      if (!node.data?.estree?.body.length) return ""; // MDX comments.
      return link("Interactive content", options.canonical);
    }
    if (
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) {
      const imported = imports.get(node.name ?? "");
      const rule =
        options.components[node.name ?? ""] ??
        options.components[imported?.name ?? ''] ??
        (imported
          ? options.components[basename(imported.source).replace(/\.[^.]+$/, "")]
          : undefined);
      if (rule?.type === "code") {
        let code = staticAttribute(node, "code");
        const src = staticAttribute(node, "src");
        if ((code === undefined) === (src === undefined))
          return fail(`${node.name} requires either code or src.`);
        if (src !== undefined) {
          if (!rule.sourceRoot)
            return fail(`${node.name}.src requires a configured sourceRoot.`);
          const extension = rule.sourceExtension ?? "";
          const target = resolve(
            rule.sourceRoot,
            src.endsWith(extension) ? src : src + extension
          );
          assertWithin(rule.sourceRoot, target);
          await assertRealpathWithin(rule.sourceRoot, target);
          code = await readFile(target, "utf8");
        }
        if (options.renderCode) return options.renderCode({
          name: imported?.name ?? node.name ?? '', code: code!, src,
        });
        return `\n\n${fencedCode(code!, rule.language)}\n\n`;
      }
      if (rule?.type === "link-card") {
        const href = staticAttribute(node, "href");
        if (!href) return fail(`${node.name} requires href.`);
        const title = staticAttribute(node, "title") ?? href;
        const description = staticAttribute(node, "description");
        return `\n\n${link(title, href)}${
          description ? ` — ${description}` : ""
        }\n\n`;
      }
      if (!node.name || ["div", "span", "section"].includes(node.name))
        return renderChildren(node.children as Child[]);
      if (/^[A-Z]/.test(node.name)) {
        const content = await renderChildren(node.children as Child[]);
        if (content.trim()) return content;
        const document = imported && options.resolveDocument?.(imported.source);
        return document
          ? link(document.title, document.href)
          : link("Interactive content", options.canonical);
      }
    }
    if ("children" in node)
      return inner(node.children as Child[], start(node), end(node));
    return body.slice(start(node), end(node));
  };
  return (await render(tree)).trim();
}
