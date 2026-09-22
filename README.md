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

`site.origin` must be an HTTP(S) origin, such as `https://example.com`, without a path, query, or fragment.

Configure analytics using component names exported by [astro-analytics](https://github.com/Destiner/astro-analytics). Each value is passed directly as that component's props. Include only the services you use:

```js
analytics: {
  GoogleAnalytics: { id: "G-XXXXXXXXXX" },
  SimpleAnalytics: {},
  Matomo: { id: "1", url: "https://analytics.example.com/" },
},
```

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

Frontmatter must contain `title`; `description`, `order`, `draft`, and `sidebar.label` / `sidebar.hidden` / `sidebar.icon` are optional. `sidebar.icon` uses the same icon names or image URLs as example categories. Use standard Astro/MDX syntax for components in `.mdx` files.

Each published document has a Markdown URL alongside its HTML page: `/zh/guide/` is exported as `/zh/guide.md` (and `/en/guide/` as `/en/guide.md`). The document toolbar, copy action, and `llms.txt` index use this same URL, including the configured Astro `base` prefix.

## Interactive document demos

Import `Demo` in MDX to add an editable example:

```mdx
import { Demo } from '@antv/astro-theme-antv/components';

<Demo code={`document.getElementById('container').textContent = 'Hello';`} />
<Demo src="guide/demos/shared-chart" />
```

Provide either static `code` or a `src` path to a `.ts` file relative to `content.docs`.
Demos run in an iframe using `srcdoc`, without a separate preview route; the parent page retains the complete source in build-time `<pre><code>` HTML and page-level Markdown, readable without JavaScript.

Demos use Sucrase to remove TypeScript types and native ES modules to load dependencies. For package imports, install them in your site and configure their imports in `astro.config.mjs`:

```js
demo: {
  dependencies: {
    '@antv/g6': '@antv/g6',
  },
},
```

For legacy packages, map to their ESM entry when using named imports; CommonJS default imports remain supported through Vite.

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

Optional components `QaEntry`, `Updates`, `Carousel`, and `Loading` are available from `@antv/astro-theme-antv/components`. QA requires `qa.enabled: true` and access to Sive's QA service and authentication.

For Astro options such as `base` or additional integrations, use Astro's `defineConfig` with `antvSite(siteConfig)` in `integrations`. Install and add `@astrojs/mdx` and `@astrojs/sitemap` if needed; the package's `defineConfig` includes both by default.

The package's `defineConfig` defaults Markdown and MDX syntax highlighting to Shiki's `one-light` theme. When configuring Astro directly, set `markdown.shikiConfig.theme` to `one-light` for the same appearance.

See [the basic site](./demos/basic-site) for a complete example.

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
| Homepage | Existing site title and localized description | `home.image`, then site default |
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
