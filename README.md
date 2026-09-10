# @antv/site

A focused Astro integration for static open-source documentation and repository-authored examples.

The package relies on Astro and Vite for development, static rendering, asset emission, module resolution, code splitting, and preview. It retains the shared capabilities product sites need—Pagefind search and a QA Result flow—without restoring the parallel CLI, browser compiler, online playground, IIFE vendor runtime, or custom dependency-graph analyzer.

## Install

```sh
pnpm add @antv/site astro
```

Node.js 22.12 or newer and Astro 7.2 are required.

## Configure the site

First register the localized documents as a normal Astro Content Collection in `src/content.config.ts`:

```ts
import { defineCollection } from "astro:content";
import { antvDocsLoader, antvDocsSchema } from "@antv/site/content";

export const collections = {
  docs: defineCollection({
    loader: antvDocsLoader({ base: "./docs" }),
    schema: antvDocsSchema,
  }),
};
```

The collection key (`docs` above) is the Astro Content Collection name the theme resolves documents through. It defaults to `docs`; match it to `content.collectionName` if you register the collection under a different name.

Then create `astro.config.mjs` in the consuming repository. The facade remains the shortest setup:

```js
import { defineConfig } from "@antv/site";

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
    examples: "./examples",
  },
  navigation: [
    {
      text: { zh: "文档", en: "Docs" },
      href: "/guide/",
    },
    {
      text: { zh: "示例", en: "Examples" },
      href: "/examples/",
    },
  ],
  search: {
    aliases: { graph: ["chart"] },
    pathBoosts: [{ prefix: "/guide/", weight: 500 }],
  },
  qa: {
    enabled: true,
  },
  examples: [
    {
      slug: "basic",
      title: { zh: "基础", en: "Basic" },
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
  slots: {
    home: {
      beforeFooter: ["./site/HomeFooter.astro"],
    },
  },
  theme: {
    tokens: {
      "--brand": "#5b5bd6",
      "--brand-strong": "#4a4ac7",
    },
  },
});
```

`theme.tokens` is a single CSS custom-property map applied to `:root`. It keeps product branding and theme customization in the consuming repository without exposing Astro internals or adding a package-owned color-mode switch.

The shared theme self-hosts Alibaba PuHuiTi 2.0 in the 400, 500, 600, 700, and 900 weights. All sites use it through `--font-sans`, while shared home-page headings use `--font-heading-weight: 900`. Consumers can override either token through `theme.tokens` when a product has a deliberate typography exception.

`site.origin` must be a bare HTTP(S) origin without credentials, a path, query, or fragment. Navigation, footer, home-action, and version links accept relative URLs plus HTTP(S), `mailto:`, and `tel:` schemes; unsafe schemes and control characters are rejected during configuration.

Use normal Astro commands:

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

The public `defineConfig` facade installs the integration and configures the bundled theme, sitemap, Demo ESM entries, and Pagefind indexing. `@antv/site` supports Astro's static output only and fails during configuration when non-static output is requested. It does not replace Astro's `srcDir` or `publicDir`: consumer pages, components, middleware, content configuration, and static assets remain in the standard Astro project tree.

The default footer also links to a downloadable `/llms.txt`. It is a compact Agent-oriented index of the configured site identity, version, localized public documents, runnable examples, repository, and `/llms-full.txt`. The full file combines the published document Markdown and Demo source, while `/markdown/{locale}/{slug}.md` exposes individual documents with canonical metadata. Draft and sidebar-hidden documents are excluded, localized document links are rewritten to their Agent-readable Markdown endpoints, and deployment `base` paths are included in every absolute URL. Supplying custom footer groups replaces the default groups, including the footer link.

Advanced Astro configurations can compose the same integration directly:

```js
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { antvSite } from "@antv/site";

export default defineConfig({
  base: "/my-library/",
  integrations: [antvSite(siteConfig), mdx(), sitemap()],
});
```

Use this standard Astro composition whenever the site needs Astro-level options such as `base`, redirects, or additional integrations. Server adapters are intentionally unsupported because generated content, Demo runners, QA routes, and Pagefind indexing are owned as a static-site pipeline. `antvSite()` returns only the package-owned core integration; advanced consumers explicitly install and enable `@astrojs/mdx` and `@astrojs/sitemap` when needed. The package `defineConfig` facade enables both by default. Internal theme links, canonical URLs, Demo iframes, QA navigation, static assets, and search assets all honor Astro's `base` value.

Set `qa.enabled` to `true` to enable the package-owned QA entry and Result route. With the switch omitted or `false`, neither is added to the downstream site. Each locale receives a Result route at /{locale}/result/ by default; change `qa.path` to use another route. The homepage stores the submitted text in `sessionStorage` and navigates without putting the question in the URL. The Result page only loads and mounts Sive's internal QA SDK. Sive reuses its existing session-cookie authentication, native QA session APIs, streaming conversation UI, follow-up composer, image upload, and visualization rendering; Site does not maintain an external QA protocol or its own Result runtime.

## Home slots

Consumers can add trusted Astro components around the shared home sections. The `hero` and `features` slots replace the corresponding default section when non-empty; the other slots insert content around them.

```js
slots: {
  home: {
    beforeHero: ["./site/Announcement.astro"],
    hero: ["./site/ProductHero.astro"],
    afterHero: [],
    beforeFeatures: [],
    features: [],
    afterFeatures: [],
    beforeFooter: ["./site/Community.astro"],
  },
}
```

Slot components receive `locale`, `slotName`, the resolved `config`, and the in-memory `registry`; the public `HomeSlotProps` type describes that contract. Slot paths are consumer-relative, validated before startup, watched by Astro, and compiled by Vite.

## Shared updates

Import the opt-in announcement carousel in a home slot or another Astro component:

```astro
---
import { Updates } from '@antv/site/components';
const { locale } = Astro.props;
---

<Updates locale={locale} />
```

The component fetches `https://assets.antv.antgroup.com/antv/banner-messages.json`
in the browser, so announcements can change without rebuilding a static site.
It renders localized `title`/`subTitle`, `img` and `link` directly from the feed;
missing translations fall back to the other locale. It does not rewrite upstream
copy or use a bundled announcement snapshot. Links and images accept only absolute
HTTP(S) URLs. Failed requests time out after 10 seconds and offer a retry; empty
feeds show an empty state. JavaScript is required to load announcements.

The component owns its card styles and responsive 3/2/1-card track; the host owns
section spacing and surrounding content. It is not inserted into layouts by default.
Pagination follows actual scroll destinations, is disabled when every card fits,
and autoplay pauses on hover/focus, manual interaction, hidden pages and reduced motion.

## Shared components

Import supported UI from `@antv/site/components`: `QaEntry`, `Updates`, and `Carousel`.
Keep site-specific content and layout in the existing home slots. For a custom card
carousel, pass cards through the default slot:

```astro
---
import { Carousel } from '@antv/site/components';
const { locale } = Astro.props;
---

<Carousel locale={locale} label="Featured projects" list>
  <article role="listitem">First project</article>
  <article role="listitem">Second project</article>
</Carousel>
```

`Carousel` owns track markup, scroll-snap, pagination, autoplay and lifecycle cleanup.
It refreshes when direct slot children change and reconnects safely after removal.
Set `disabled` while asynchronous content is loading; remove the `disabled` attribute
from the rendered `antv-carousel` element once cards are ready. Optional `pageLabel`
accepts a `{page}` placeholder; `list` gives the track list semantics (provide
`role="listitem"` on each card).

Customize geometry through inherited CSS properties on a wrapper:
`--carousel-columns`, `--carousel-gap`, `--carousel-track-padding`, and
`--carousel-pagination-margin`. Defaults show 3/2/1 cards at desktop/1000px/767px;
when setting `--carousel-columns`, supply your own responsive overrides as needed.
Consumer pages do not need browser mounting scripts or internal DOM selectors.

The old `@antv/site/qa-entry`, `@antv/site/updates`, and `@antv/site/carousel`
entry points remain available for compatibility. Use the shared components entry
for new code; the DOM-level carousel helper is no longer the recommended integration.

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

Each `.md` or `.mdx` file is an Astro content entry. Frontmatter must contain `title`; `description`, `order`, `draft`, and `sidebar.label` / `sidebar.hidden` are optional. Routes and the theme consume entries through `getCollection()` and `render()`, and MDX is enabled through the official `@astrojs/mdx` integration. The package keeps compatibility transforms for localized `.md` links, configured static components, link cards, and `<code src="...">`; new MDX should use normal Astro/MDX syntax rather than those legacy string transforms. Astro owns Markdown/MDX rendering, headings, content watching, and the collection data store.

Examples keep source in the consuming repository:

```text
examples/
  basic/
    simple/
      index.zh.md
      index.en.md
      demo/
        meta.json
        hello.ts
        message.ts
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

`meta.json` is validated before routes are generated. Demo filenames must reference JavaScript or TypeScript modules inside their own `demo` directory, and duplicate route keys are rejected. Group Markdown frontmatter is parsed strictly; malformed or unclosed frontmatter fails the build with the source path instead of being repaired heuristically.

Relative imports in Demo source resolve from the original source file. Vite emits standard ESM chunks and automatically shares common chunks where beneficial.

## Demo trust boundary

Demo code is repository-authored application code. It runs in a same-origin iframe so normal ESM imports, assets, Canvas, WebGL, workers, and library behavior work without a second runtime system.

This package does not execute untrusted user submissions. If a site needs a public code sandbox or arbitrary online editing, integrate a dedicated sandbox service as a separate product boundary.

The parent page contains the static source and a reload action. There is no browser-side compiler, editable playground, IIFE format, custom vendor grouping, or package-owned dependency graph.

## Supported configuration

The public configuration covers:

- site identity, locales, repository, logo, and favicon;
- document and example roots, and the docs Content Collection name;
- navigation, versions, edit links, and static Markdown component transforms;
- built-in Pagefind search, aliases, and path ranking boosts;
- optional QA Result routes and entry behavior backed by Sive's SDK;
- home content, feature cards, and controlled Astro component slots;
- CSS token overrides for consumer-defined branding and theme customization;
- footer content;
- Demo height.

Unknown keys are rejected. Removed features therefore fail fast instead of being silently ignored.

## Package boundary

Consumers import `defineConfig`, `antvSite`, and configuration types from the package root. The `@antv/site/content` subpath exports the Astro Content Loader and schema; `@antv/site/components` exports supported Astro UI components. UI is deliberately separate from the Node-loaded configuration facade, and adding a shared component does not require a new package subpath. QA has no consumer-facing browser-helper subpath. The package build emits NodeNext-compatible ESM directly, without a regex-based post-build import rewrite, then copies the consumer-compiled Astro theme source into `dist/theme`. npm publishes only `dist`; `src/theme` is a repository source directory, not a separate package path. Astro remains the peer build engine; Vite, Pagefind, and the sitemap integration are implementation dependencies.

## Repository demo

`demos/basic-site` is the smallest runnable consumer site and the fixture used by the targeted integration tests. Build the package first so the demo can import `dist/index.js` and `dist/content.js`, then run it with normal Astro commands from that directory.
