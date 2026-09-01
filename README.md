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
    defaultStack: "g2",
    previewProducts: ["g2"],
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

The public `defineConfig` facade installs the integration and configures the bundled theme, static output, sitemap, public assets, Demo ESM entries, and Pagefind indexing. It no longer replaces Astro's `srcDir`: consumer pages, components, middleware, and content configuration remain in the standard Astro project tree.

Advanced Astro configurations can compose the same integration directly:

```js
import { defineConfig } from "astro/config";
import { antvSite } from "@antv/site";

export default defineConfig({
  base: "/my-library/",
  integrations: antvSite(siteConfig),
});
```

Use this standard Astro composition whenever the site needs Astro-level options such as `base`, adapters, redirects, or additional integrations. Internal theme links, canonical URLs, Demo iframes, QA navigation, static assets, and search assets all honor Astro's `base` value.

When qa is configured, each locale receives a Result route at /{locale}/result/ by default and the shared home page renders the package-owned QA entry. `qa.defaultStack` selects the initial G2, S2, G6, F2, X6, or L7 stack. Change `qa.path` to use another route. The platform owns the shared Sive service endpoints and protocol. The QA entry owns stack selection, authentication, session creation, history, and Result navigation; the Result page owns streaming responses, follow-up questions, Markdown rendering, code highlighting, and optional visualization previews.

Custom home components can reuse the same entry without reimplementing QA behavior:

```astro
---
import QaEntry from '@antv/site/qa-entry';
const { locale } = Astro.props;
---

<QaEntry locale={locale} />
```

G2, G6, and S2 have package-owned preview adapters. Consumers explicitly enable only the products they install, so unused visualization runtimes are neither resolved nor bundled. The visualization packages remain consumer dependencies rather than `@antv/site` dependencies; the built-ins currently target G2 5.x, G6 5.x, and S2 2.x:

```js
qa: {
  defaultStack: "g2",
  previewProducts: ["g2", "g6", "s2"],
  // Non-standard preview protocols can still provide custom adapters.
  previewAdapters: {
    custom: "./src/qa/custom-preview.ts",
  },
}
```

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
- optional QA Result routes, built-in preview products, and custom preview adapters;
- package-owned QA service endpoints, entry behavior, and configurable default stack;
- home content, feature cards, and controlled Astro component slots;
- CSS token overrides for consumer-defined branding and theme customization;
- footer content;
- Demo height and output directory.

Unknown keys are rejected. Removed features therefore fail fast instead of being silently ignored.

## Package boundary

Consumers import `defineConfig`, `antvSite`, and configuration types from the package root. The `@antv/site/content` subpath exports the Astro Content Loader and schema. The shared QA entry is available from `@antv/site/qa-entry`; lower-level browser-side QA session and history helpers remain available from `@antv/site/qa`. Compiled Node modules live in dist, while Astro theme source is included for the consumer build. Astro remains the peer build engine; Vite, Pagefind, and the sitemap integration are implementation dependencies.
