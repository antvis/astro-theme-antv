# @antv/site

A focused Astro integration for static open-source documentation and repository-authored examples.

## Install

```sh
pnpm add @antv/site astro
pnpm add -D @astrojs/check typescript
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

The collection name defaults to `docs`. If you use another name, set `content.collectionName` to match.

Then create `astro.config.mjs`. Unknown configuration keys are rejected:

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

Use `theme.tokens` to override global CSS custom properties.

The default font is Alibaba PuHuiTi 2.0. Override `--font-sans` to change the font or `--font-heading-weight` to change the home-page heading weight (default: `900`).

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

`@antv/site` supports static sites only; server adapters are not supported. Keep custom pages and components in `src/` and static assets in `public/` as in a standard Astro project.

The site provides `/llms.txt` as an AI-readable index, `/llms-full.txt` for full document content and example source, and `/markdown/{locale}/{slug}.md` for individual documents. Draft and sidebar-hidden documents are excluded. Custom footer groups replace the default groups, including the `/llms.txt` link.

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

Use this form for Astro options such as `base`, redirects, or additional integrations. Pass the site settings shown above as `siteConfig`. Install `@astrojs/mdx` and `@astrojs/sitemap` separately when using these integrations directly; the package's `defineConfig` enables both by default. Set `base` when deploying under a subpath.

Set `qa.enabled` to `true` to enable the QA entry and result page at `/{locale}/result/`. Change `qa.path` to customize the route. QA is disabled by default and requires access to Sive's QA service and authentication.

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

Slot paths are relative to your project root. Components receive `locale`, `slotName`, `config`, and `registry`; import `HomeSlotProps` from `@antv/site` for their types.

## Shared updates

Import the opt-in announcement carousel in a home slot or another Astro component:

```astro
---
import { Updates } from '@antv/site/components';
const { locale } = Astro.props;
---

<Updates locale={locale} />
```

Announcements come from `https://assets.antv.antgroup.com/antv/banner-messages.json`
and update without rebuilding the site. JavaScript and access to this feed are
required. Missing translations fall back to the other locale.

The component is not added by default. It includes responsive card styles;
set section spacing in your own layout.

## Shared components

Import supported UI from `@antv/site/components`: `QaEntry`, `Updates`, and `Carousel`.
`QaEntry` accepts `locale`, an optional `placeholder`, and optional `suggestions`
(an array of question strings in the current locale):

```astro
<QaEntry locale={locale} suggestions={questions.map((question) => question[locale])} />
```

Clicking a suggestion submits it immediately. Enter sends; Shift+Enter adds a line.
Questions are limited to 4,000 characters and are not included in URLs.
Omit `suggestions` to hide the shortcuts. The component requires `qa.enabled: true`.

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

`Carousel` includes pagination and autoplay.
Set `disabled` while asynchronous content is loading; remove the `disabled` attribute
from the rendered `antv-carousel` element once cards are ready. Optional `pageLabel`
accepts a `{page}` placeholder; `list` gives the track list semantics (provide
`role="listitem"` on each card).

Customize geometry through inherited CSS properties on a wrapper:
`--carousel-columns`, `--carousel-gap`, `--carousel-track-padding`, and
`--carousel-pagination-margin`. Defaults show 3/2/1 cards at desktop/1000px/767px;
when setting `--carousel-columns`, supply your own responsive overrides as needed.

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

Frontmatter must contain `title`; `description`, `order`, `draft`, and `sidebar.label` / `sidebar.hidden` are optional. Use standard Astro/MDX syntax for components in `.mdx` files.

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

Demo filenames must reference JavaScript or TypeScript files inside their own `demo` directory. Route keys must be unique.

Use relative imports to reference other files from a Demo source file.

## Demo safety

Only include trusted Demo code: examples run with the same origin as your site, not in an isolated security sandbox. For untrusted submissions or public online editing, use a dedicated sandbox service.
