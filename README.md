# @antv/astro-theme-antv

An Astro theme for bilingual documentation and runnable examples.

## Install

```sh
pnpm add @antv/astro-theme-antv astro@^7.2.0
pnpm add -D @astrojs/check typescript
```

Requires Node.js 22.12+ and Astro 7.2–7.x. Static sites only; server adapters are not supported.

## Configure the site

Register documents in `src/content.config.ts`:

```ts
import { defineCollection } from "astro:content";
import { antvDocsLoader, antvDocsSchema } from "@antv/astro-theme-antv/content";

export const collections = {
  docs: defineCollection({
    loader: antvDocsLoader({ base: "./docs" }),
    schema: antvDocsSchema,
  }),
};
```

The collection name defaults to `docs`. If you use another name, set `content.collectionName` to match.

Create `astro.config.mjs`:

```js
import { defineConfig } from "@antv/astro-theme-antv";

export default defineConfig({
  site: {
    title: "My Library",
    metaTitle: {
      zh: "My Library 可视化工具库 | AntV",
      en: "My Library Visualization Toolkit | AntV",
    },
    origin: "https://example.com",
    repository: "https://github.com/example/my-library",
    description: {
      zh: "项目文档与示例",
      en: "Project documentation and examples",
    },
  },
  content: {
    docs: "./docs",
    examples: null,
  },
  navigation: [
    {
      text: { zh: "文档", en: "Docs" },
      href: "/guide/",
    },
  ],
  home: {
    title: {
      zh: "静态文档与示例",
      en: "Static docs and examples",
    },
    description: {
      zh: "由 Astro 构建。",
      en: "Built with Astro.",
    },
  },
});
```

`site.title` is the short product name used in the header and other visible branding.
Optional `site.metaTitle` accepts a non-empty string or `{ zh, en }` translations and
controls the browser title: the homepage uses it directly, while other pages use
`Page title · metaTitle`. It defaults to `site.title` when omitted. The default
Open Graph sharing title follows the browser title; `home.openGraph.title` only
overrides the sharing title. `home.title` controls the visible homepage heading.

`site.origin` must be an HTTP(S) origin, such as `https://example.com`, without a path, query, or fragment.

Optional `site.verification` maps site ownership verification meta names to non-empty tokens:

```js
site: {
  // ...other site settings
  verification: {
    'google-site-verification': 'your-verification-token',
  },
},
```

The theme renders these tags in the shared page `<head>`, including static output. Omit this option to emit no verification tags; consumer middleware is unnecessary.

Top navigation supports links and two-level dropdown groups. Existing `{ text, href }` entries remain unchanged; use `{ text, children }` for a group. `children` must contain at least one link and cannot contain further groups or coexist with a parent `href`:

```js
navigation: [
  { text: { zh: "文档", en: "Docs" }, href: "/manual/" },
  {
    text: { zh: "工具", en: "Tools" },
    children: [
      { text: { zh: "数据", en: "Data" }, href: "/tools/" },
      { text: { zh: "编辑器", en: "Editor" }, href: "https://editor.example.com/" },
    ],
  },
],
```

All dropdown links are present in the initial HTML. Internal links receive the locale and Astro `base`; external links retain their URL and show a link icon. The matching child and its parent group are highlighted. Dropdowns open on desktop hover or summary activation, use inline disclosure on mobile, and support Tab, Enter/Space, arrow keys, Escape and outside-click dismissal. Only one header dropdown stays open at a time. Native disclosure remains usable without JavaScript; flat navigation, home actions and footer links keep their existing schema.

Configure analytics using the built-in `Baidu` adapter or component names exported by [astro-analytics](https://github.com/Destiner/astro-analytics). Each value is passed directly as that component's props. Include only the services you use:

```js
analytics: {
  Baidu: { id: "0123456789abcdef0123456789abcdef" },
  GoogleAnalytics: { id: "G-XXXXXXXXXX" },
  SimpleAnalytics: {},
  Matomo: { id: "1", url: "https://analytics.example.com/" },
},
```

`Baidu.id` is the 32-character hexadecimal site ID from the Baidu tracking script URL (`hm.js?<id>`). The theme initializes `window._hmt` before asynchronously loading that script.

Configured components render at the end of the body on all theme pages in production builds, including any `noscript` fallback they provide. Omit `analytics` to disable tracking; development builds never enable it. Unknown component names fail the build.

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "check": "astro check",
    "preview": "astro preview"
  }
}
```

After adding documents below, run `pnpm dev` and open `/zh/` or `/en/`. Use `pnpm build` and `pnpm preview` to build and preview the site.

## Content conventions

Localized documents use a locale suffix:

```text
docs/
  guide/
    index.zh.md
    index.en.md
    advanced.zh.mdx
    advanced.en.mdx
```

Frontmatter must contain `title`; `description`, `order`, `draft`, and `sidebar.label` / `sidebar.hidden` / `sidebar.icon` are optional. `sidebar.icon` uses the same icon names or image URLs as example categories. Use standard Astro/MDX syntax for components in `.mdx` files. Set `template: page` for a full-width custom page under the shared site header and footer, without the document sidebar, visible title, toolbar, table of contents, or Markdown typography. The default `template: doc` preserves the document layout; Markdown endpoints remain available with either template.

Each published document has a Markdown URL alongside its HTML page: `/zh/guide/` is exported as `/zh/guide.md` (and `/en/guide/` as `/en/guide.md`). The document toolbar, copy action, and `llms.txt` index use this same URL, including the configured Astro `base` prefix.

Example detail pages also expose Markdown containing source and supporting files (for example, `/zh/examples/general/line/basic.md`), discoverable from the page, a `text/markdown` alternate link, and `llms.txt`.

Example sidebars statically render top-level categories and the current group, with links to the static catalog. Expansion or search loads shared localized JSON at `/[locale]/examples/menu.json` and renders only open branches or matching results. Sidebar navigation is excluded from the main content and search index.

Document sidebars retain top-level entries and the current branch in HTML. Other branches load on expansion from a shared static directory at `/[locale]/docs/[section]/`, which also provides complete navigation without JavaScript. Both sidebars are excluded from the document’s main content and search index.

Document and example detail pages, and their Markdown exports, link to `/llms.txt` as the shared resource index. It groups documents and examples by language, lists Markdown URLs and document descriptions, and uses site-relative paths with the configured Astro `base`. Read relevant individual pages first; `/llms-full.txt` remains available for the complete documentation.

Both `/llms.txt` and `/llms-full.txt` include only Chinese by default. Configure `llms.locales` to export English or both languages without changing the site's HTML pages or individual Markdown exports:

```ts
llms: {
  locales: ['zh'], // Default. Use ['en'] or ['zh', 'en'] as needed.
},
```

## Interactive document demos

Import `Demo` in MDX to add an editable example:

```mdx
import { Demo } from '@antv/astro-theme-antv/components';

<Demo code={`document.getElementById('container').textContent = 'Hello';`} />
<Demo src="guide/demos/shared-chart" />
<Demo src="guide/demos/shared-chart" height={400} />
```

Provide either static `code` or a `src` path to a JavaScript or TypeScript file relative to `content.docs`.
Plain Markdown pages can reuse fragments with a standalone `<!-- include: ./shared/options.md -->` line. Paths are relative to the including file and must remain inside `content.docs`; nested includes are supported, fragment frontmatter is omitted, and cycles are rejected. HTML rendering and Markdown exports expand the same content. Use root-relative links and assets in shared fragments. Exclude fragment-only directories from `antvDocsLoader` with a negative glob, for example `pattern: ['**/*.{zh,en}.{md,mdx}', '!shared/**']`, so they do not create duplicate pages. Include directives inside code fences remain literal; MDX uses its normal component imports.

Demos run in an iframe using `srcdoc`, without a separate preview route; the parent page retains the complete source in build-time `<pre><code>` HTML and page-level Markdown, readable without JavaScript.

Demos use Sucrase to compile TypeScript and JSX in both the initial preview and editor runs, with the automatic JSX runtime by default (classic JSX pragmas are supported). They use native ES modules to load dependencies. Install packages used by your demos in the site. The theme discovers their imports automatically; use `demo.dependencies` only when overriding module resolution, for example:

```js
demo: {
  dependencies: {
    'legacy-package': './src/legacy-package-esm.ts',
  },
},
```

Document demos without a `height` prop fit their rendered content. `demo.height` supplies the initial viewport (and the fallback for percentage-sized charts); an explicit `<Demo height={400} />` keeps a fixed preview height. Gallery previews retain their pane layout.

JSX demos also register the automatic JSX runtime. Development import maps use Vite’s optimized ESM wrappers when available. For legacy packages without an optimized wrapper, map to their ESM entry when using named imports.

Gallery previews show the shared loading indicator until the iframe completes or reports an error, including when switching examples or rerunning code. Use top-level `await` for asynchronous setup that must finish before the preview is ready.

Use normal relative imports for local JavaScript, TypeScript, JSX and JSON modules, for example `import data from '../../../data/dag.json'` or `import Settings from './settings'`. The theme follows static imports, re-exports and literal dynamic imports recursively from gallery entries and document `Demo` components. It resolves file extensions and directory `index` modules, checks that dependencies stay inside the site root, and watches collected files. No per-file `demo.dependencies` entries or Vite aliases are needed. Inline document demos resolve relative imports from their Markdown file.

Each example page contains only its own referenced local files in read-only source tabs, Markdown and export fields. Gallery navigation replaces these panels with those from the destination page; unrelated examples are not embedded in hidden HTML. StackBlitz exports preserve the entry's site-relative path and its transitive supporting files, so relative imports work unchanged; unrelated files and npm dependencies are excluded. The source tab remains editable, copying uses the selected file, and running/exporting uses the current entry source. Save new dependencies in the example source so they can be collected before using them in the browser editor or export. Computed dynamic import paths and non-module assets are not automatically collected.

Existing demos can also import standalone CSS or Less files (`import './index.less'`). Install `less` in the consuming site for Less compilation. Vite compiles these styles for both initial previews and editor reruns, including static builds; source tabs, Markdown and StackBlitz retain the original style files, and exported projects include the Less compiler when needed. Stylesheet-internal `@import` and `url()` resources are not automatically collected for export; keep these demo styles self-contained. Styles imported transitively by demo package or workspace modules also stay attached to those modules when running native iframe previews. This does not change the theme UI's Tailwind styling.

Common iframe initialization belongs in `demo.setup`, not in every example source:

```js
demo: { setup: './src/demo/setup.ts' },
```

The local module must export a default function (which may be async) accepting `DemoSetupContext` (`container: HTMLElement`, `path: string`). `path` is the original site-relative source path with a leading slash. Each fresh gallery preview or inline Demo iframe awaits setup before loading the example; setup failures appear in the existing error panel. Use the path when some demos already own their layout. Without `setup`, existing behavior is unchanged.

The setup module and its transitive JS/TS/CSS dependencies are collected separately from example source tabs. Their complete source is included in Markdown without adding a separate runtime environment section to the source panel. StackBlitz projects retain these files and use a generated `demo-entry.js` to await setup before importing the editable example. Setup runs inside the iframe or exported project, never in the documentation page. Consumer-specific SDK registration and DOM belong in that module, not in the theme.

Keep `demo.dependencies` for deliberate module overrides or dependencies that cannot be inferred from source. The theme pre-optimizes discovered and configured package imports for iframe execution, respecting `optimizeDeps.exclude`; additional compatibility exceptions can still be configured through Vite. Existing explicit root-relative local mappings remain supported (with the corresponding Vite alias for initial gallery previews). Exports retain their physical source directories and include a Vite alias configuration when these mappings are used, so relative imports inside aliased modules keep working.

For data previews, the built-in table helper needs no dependency configuration:

```ts
import { table } from '@antv/astro-theme-antv/table';

await table([{ name: 'Alice', value: 10 }], document.getElementById('container')!);
```

`table` accepts an array of records or `{ url: '…' }` for a JSON array.

## Examples

To enable examples, set `content.examples` to `"./examples"` and add the following files:

```text
examples/
  basic/
    simple/
      index.zh.md
      index.en.md
      demo/
        meta.json
        hello.ts
```

A minimal metadata file is:

```json
{
  "title": { "zh": "简单示例", "en": "Simple" },
  "demos": [
    {
      "filename": "hello.ts",
      "title": { "zh": "你好", "en": "Hello" }
    }
  ]
}
```

Demo filenames must reference JavaScript or TypeScript files inside their own `demo` directory. Route keys must be unique.

Only include trusted Demo code: examples run with the same origin as your site, not in an isolated security sandbox.

## Customize

Tailwind CSS 4 is included: the theme registers the Vite plugin and loads the
shared stylesheet. Sites can use utility classes directly in their components
without installing Tailwind or adding a CSS entry point. Site sources are scanned
automatically, and the installed theme directory is included explicitly.

Use `tablet:` (up to 1200px) and `mobile:` (up to 640px) for responsive styles.
The theme keeps its existing reset instead of enabling Preflight; utilities use
`!important` to override the theme's unlayered styles. Site-specific CSS stays in
the site, and brand values remain available through the theme's CSS variables,
for example `text-[var(--brand)]`.

Set `theme.tokens` to override CSS variables, for example `{ "--brand": "#5b5bd6" }`.

The theme loads a shared announcement in the browser from the fixed URL
`https://assets.antv.antgroup.com/antv/announcement.json`. Publish a JSON object
with this structure (the endpoint must allow cross-origin requests):

```json
{
  "title": { "zh": "新版本已发布", "en": "A new release is available" },
  "link": {
    "text": { "zh": "了解更多", "en": "Learn more" },
    "href": "https://example.com/releases"
  }
}
```

Use `slots.home` to add your own Astro components. Paths are relative to the project root:

```js
slots: {
  home: {
    hero: ["./site/ProductHero.astro"],
    beforeFooter: ["./site/Community.astro"],
  },
}
```

`hero` and `features` replace the default sections. Other slots insert content around them. Components receive the props described by `HomeSlotProps`, available from the package root.

Default homepage decorative effects apply only to the built-in sections. Style your custom slot content in its own Astro components.

The custom `hero` slot disables the default page-wide decorative background.

`Updates` supports optional `card` and `skeleton` slots for product-owned announcement styling while retaining the shared feed loading, retry and carousel behavior. The `card` slot must contain a single `<a>` with `<strong>` (title), `[data-update-description]` (summary) and an `<img>` placeholder (populated or removed by the loader). The `skeleton` slot supplies the loading placeholders. Custom cards should hide images with the `hidden` attribute. The optional `style` prop sets the wrapper's minimum height and existing Carousel variables such as `--carousel-gap` and `--carousel-pagination-margin`; the default appearance is unchanged.

Optional components `QaEntry`, `Updates`, `Carousel`, and `Loading` are available from `@antv/astro-theme-antv/components`. QA requires `qa.enabled: true` and access to Sive's QA service and authentication. Session links use the static QA entry with an `sessionId` query parameter, such as `/zh/qa/?sessionId=<sessionId>` (including any configured `base` and `qa.path`). Use a Sive QA SDK release that supports this query format. No session-subpath rewrites are required; the previous `/zh/qa/<sessionId>` format is no longer supported.

For Astro options such as `base` or additional integrations, use Astro's `defineConfig` with `antvSite(siteConfig)` in `integrations`. Install and add `@astrojs/mdx` and `@astrojs/sitemap` if needed; the package's `defineConfig` includes both by default.

The package's `defineConfig` defaults Markdown and MDX syntax highlighting to Shiki's `one-light` theme. When configuring Astro directly, set `markdown.shikiConfig.theme` to `one-light` for the same appearance.

See [the basic site](./demos/basic-site) for a complete example.

## robots.txt

The theme provides a prerendered `/robots.txt` endpoint by default:

```text
User-agent: *
Allow: /

Sitemap: https://your-site.example.com/sitemap-index.xml
```

To customize crawl rules or sitemap locations, create `robots.txt` in Astro's
`publicDir` (`public/` by default). The theme then skips its endpoint and Astro
copies your file unchanged. Custom `publicDir` paths are supported.

For a site deployed under a base such as `/project/`, the generated Sitemap URL
is `https://your-site.example.com/project/sitemap-index.xml`, and Astro serves
the endpoint under `/project/robots.txt`. Crawlers only discover robots rules at
the origin root `/robots.txt`: the domain owner must add this Sitemap declaration
to that root file. A subpath deployment cannot configure other sites on the same
domain.

## Open Graph sharing metadata

The theme renders Open Graph tags directly in the HTML `<head>` for home,
documentation, chart guides, example lists and example detail pages. No browser
JavaScript or extra integration is required. Existing sites automatically get
`og:title`, `og:description`, `og:url`, `og:type`, `og:site_name` and `og:locale`.

Set a default sharing image in your downstream `astro.config.mjs`:

```js
site: {
  // Keep the existing title, origin, repository and description.
  openGraph: {
    image: '/images/share.png',
    imageAlt: { zh: '项目分享封面', en: 'Project sharing cover' },
  },
},
```

Place that image at `public/images/share.png`, or use an absolute HTTP(S) CDN URL.
A 1200 × 630 image is a useful default for sharing cards; the theme does not
create or resize images. All local image paths resolve from the site root,
including Astro's `base`, regardless of the document's directory. Already-prefixed
paths are not prefixed twice. `site.origin` supplies the production origin;
localhost and URL query parameters do not leak into sharing URLs.

Pages automatically reuse their existing metadata:

| Page | Title and description | Image fallback |
| --- | --- | --- |
| Homepage | `site.metaTitle` (falls back to `site.title`) and localized description | `home.image`, then site default |
| Documentation / chart guide | Document title and description | Frontmatter `screenshot`, then site default |
| Example detail | Example title and generated description | Example `screenshot`, then site default |
| Example category / group / list | Existing page title and description | Site default |

The default sharing title matches the HTML `<title>`, including the site suffix.
Documentation defaults to `og:type=article`; other pages use `website`.
`og:url` always matches the canonical URL. Locales map to `zh_CN` and `en_US`.
When no image is available, `og:image` and `og:image:alt` are omitted.

Override the homepage separately when its decorative illustration is unsuitable
for a sharing card:

```js
home: {
  // Keep the existing homepage settings.
  openGraph: {
    title: { zh: '项目首页分享标题', en: 'Project homepage sharing title' },
    description: { zh: '分享摘要', en: 'Sharing summary' },
    image: '/images/home-share.png',
    imageAlt: { zh: '首页分享封面', en: 'Homepage sharing cover' },
  },
},
```

For an individual Markdown or MDX document, add optional frontmatter:

```yaml
---
title: Quick start
description: Create your first chart.
openGraph:
  title: Build your first chart
  description: A practical guide with runnable examples.
  image: /images/quick-start.png
  imageAlt: A chart built with the library
  type: article
---
```

Use the same `openGraph` object on a demo entry in `examples/**/demo/meta.json`
