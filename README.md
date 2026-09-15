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

Frontmatter must contain `title`; `description`, `order`, `draft`, and `sidebar.label` / `sidebar.hidden` are optional. Use standard Astro/MDX syntax for components in `.mdx` files.

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

Set `theme.tokens` to override CSS variables, for example `{ "--brand": "#5b5bd6" }`.

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

Optional components `QaEntry`, `Updates`, and `Carousel` are available from `@antv/astro-theme-antv/components`. QA requires `qa.enabled: true` and access to Sive's QA service and authentication.

For Astro options such as `base` or additional integrations, use Astro's `defineConfig` with `antvSite(siteConfig)` in `integrations`. Install and add `@astrojs/mdx` and `@astrojs/sitemap` if needed; the package's `defineConfig` includes both by default.

See [the basic site](./demos/basic-site) for a complete example.
